/**
 * server.ts — Unix socket IPC server for the gramatr daemon.
 *
 * Accepts newline-delimited JSON-RPC 2.0 connections. Each connection
 * can send one request and receives one response. Connections are
 * short-lived (hook processes are short-lived); no multiplexing needed.
 *
 * Error codes:
 *   -32600  Invalid request
 *   -32601  Method not found
 *   -32603  Internal error
 */
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { timingSafeEqual } from 'node:crypto';
import { callRemoteTool } from '../proxy/remote-client.js';
import { sessionRegistry } from './session-registry.js';
import { projectCache } from './project-cache.js';
import { sqliteOwner } from './sqlite-owner.js';
import { VERSION } from '../hooks/lib/version.js';
const contextStore = new Map();
const activeSockets = new Set();
let _server = null;
let _authToken = null;
function checkSocketAuth(line) {
    if (!_authToken)
        return true; // no token configured — allow (backward compat during startup)
    const PREFIX = 'AUTH ';
    if (!line.startsWith(PREFIX))
        return false;
    const provided = line.slice(PREFIX.length);
    try {
        const a = Buffer.from(provided);
        const b = Buffer.from(_authToken);
        if (a.length !== b.length)
            return false;
        return timingSafeEqual(a, b);
    }
    catch {
        return false;
    }
}
// ── db/query forwarding ───────────────────────────────────────────────────────
/**
 * Route read-only SQLite operations through the daemon's owned connection.
 *
 * Implements the same queries as hook-state.ts without importing that module
 * (which would open a competing DB connection). Results are returned as plain
 * JSON-serialisable objects so they can be sent over the IPC socket.
 *
 * Hook processes that set GRAMATR_USE_DAEMON_DB=1 (detected via daemon.active
 * sentinel) may call this method to avoid opening the file directly.
 * Sprint 3 will wire the async IPC call path in hook-state.ts.
 */
function handleDbQuery(operation, args) {
    const db = sqliteOwner.getDb();
    if (!db)
        return null;
    try {
        switch (operation) {
            case 'getSessionContext': {
                const sessionId = args['session_id'];
                if (sessionId && sessionId !== 'unknown') {
                    const scoped = db
                        .prepare('SELECT * FROM session_context WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1')
                        .get(sessionId);
                    if (scoped)
                        return scoped;
                }
                return (db
                    .prepare('SELECT * FROM session_context ORDER BY updated_at DESC LIMIT 1')
                    .get() ?? null);
            }
            case 'getLastSessionForProject': {
                const projectId = args['project_id'];
                if (!projectId)
                    return null;
                return (db
                    .prepare(`
              SELECT session_id, interaction_id, entity_id, client_type, agent_name, ended_at
              FROM session_log
              WHERE project_id = ?
              ORDER BY id DESC
              LIMIT 1
            `)
                    .get(projectId) ?? null);
            }
            case 'getLocalProjectByDirectory': {
                const directory = args['directory'];
                if (!directory)
                    return null;
                return (db
                    .prepare('SELECT * FROM projects WHERE directory = ? ORDER BY updated_at DESC LIMIT 1')
                    .get(directory) ?? null);
            }
            default: {
                throw Object.assign(new Error(`db/query: unknown operation: ${String(operation)}`), { code: -32601 });
            }
        }
    }
    catch (err) {
        if (err !== null && typeof err === 'object' && 'code' in err)
            throw err;
        // Wrap unexpected DB errors as internal errors.
        throw Object.assign(new Error(`db/query(${String(operation)}) failed: ${err instanceof Error ? err.message : String(err)}`), { code: -32603 });
    }
}
// ── Request dispatch ──────────────────────────────────────────────────────────
/**
 * Route a JSON-RPC 2.0 request to the appropriate handler.
 * Exported so the HTTP fallback server can share the same dispatch logic.
 */
export async function dispatchRpcRequest(req) {
    const { method, params } = req;
    switch (method) {
        case 'tool/call': {
            const name = params.name;
            const args = (params.arguments ?? {});
            if (typeof name !== 'string' || !name) {
                throw Object.assign(new Error('tool/call requires params.name (string)'), { code: -32600 });
            }
            return callRemoteTool(name, args);
        }
        case 'session/register': {
            const sessionId = params.session_id;
            if (typeof sessionId !== 'string' || !sessionId) {
                throw Object.assign(new Error('session/register requires params.session_id (string)'), { code: -32600 });
            }
            sessionRegistry.register(sessionId);
            return { ok: true };
        }
        case 'session/release': {
            const sessionId = params.session_id;
            if (typeof sessionId !== 'string' || !sessionId) {
                throw Object.assign(new Error('session/release requires params.session_id (string)'), { code: -32600 });
            }
            sessionRegistry.release(sessionId);
            return { ok: true };
        }
        case 'session/context/get': {
            const sessionId = params.session_id;
            // Try SQLite first (survives daemon restart if same DB file is re-opened).
            const db = sqliteOwner.getDb();
            if (db && typeof sessionId === 'string' && sessionId) {
                try {
                    const row = db
                        .prepare('SELECT * FROM session_context WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1')
                        .get(sessionId);
                    if (row)
                        return { value: row };
                }
                catch {
                    // Fall through to in-memory store below.
                }
            }
            // Fall back to in-memory map (populated before DB was available or on DB error).
            const value = typeof sessionId === 'string' ? contextStore.get(sessionId) ?? null : null;
            return { value };
        }
        case 'session/context/set': {
            const sessionId = params.session_id;
            if (typeof sessionId !== 'string' || !sessionId) {
                throw Object.assign(new Error('session/context/set requires params.session_id (string)'), { code: -32600 });
            }
            const ctx = params.context;
            // Always write to in-memory store first (fastest, daemon-lifetime guarantee).
            contextStore.set(sessionId, ctx);
            // Also persist to SQLite via daemon's own connection — same SQL as
            // hook-state.ts:setSessionContext. Do NOT import hook-state.ts here;
            // that module opens its own DB connection which would fight with ours.
            const dbForSet = sqliteOwner.getDb();
            if (dbForSet && ctx !== null && typeof ctx === 'object') {
                const c = ctx;
                try {
                    dbForSet
                        .prepare(`
              INSERT OR REPLACE INTO session_context
                (session_id, project_id, interaction_id, entity_id, project_name,
                 git_root, git_branch, git_remote, working_directory,
                 session_start, updated_at, client_type, agent_name, platform, arch)
              VALUES
                (@session_id, @project_id, @interaction_id, @entity_id, @project_name,
                 @git_root, @git_branch, @git_remote, @working_directory,
                 @session_start, @updated_at, @client_type, @agent_name, @platform, @arch)
            `)
                        .run({
                        '@session_id': c['session_id'] ?? sessionId,
                        '@project_id': c['project_id'] ?? null,
                        '@interaction_id': c['interaction_id'] ?? null,
                        '@entity_id': c['entity_id'] ?? null,
                        '@project_name': c['project_name'] ?? null,
                        '@git_root': c['git_root'] ?? null,
                        '@git_branch': c['git_branch'] ?? null,
                        '@git_remote': c['git_remote'] ?? null,
                        '@working_directory': c['working_directory'] ?? null,
                        '@session_start': c['session_start'] ?? null,
                        '@updated_at': c['updated_at'] ?? new Date().toISOString(),
                        '@client_type': c['client_type'] ?? null,
                        '@agent_name': c['agent_name'] ?? null,
                        '@platform': c['platform'] ?? null,
                        '@arch': c['arch'] ?? null,
                    });
                }
                catch {
                    // Non-fatal — in-memory store is the source of truth for daemon's lifetime.
                }
            }
            // Reset idle checkpoint timer on write activity.
            sqliteOwner.resetIdleTimer();
            return { ok: true };
        }
        case 'db/query': {
            const { operation, args } = params;
            const result = handleDbQuery(operation, args);
            return result;
        }
        case 'agent/expire': {
            // Sweep expired uuid_agents rows. Called at session start and periodically
            // to reclaim RAM from entries that have outlived their TTL.
            const sweepDb = sqliteOwner.getDb();
            if (!sweepDb)
                return { swept: 0 };
            const sweepResult = sweepDb.prepare(`DELETE FROM uuid_agents WHERE expires_at IS NOT NULL AND expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).run();
            return { swept: sweepResult.changes };
        }
        case 'agent/store': {
            // Store a composed agent definition in the RAM-only TEMP TABLE.
            // Data never reaches disk — exists only for the daemon's lifetime.
            const agentDb = sqliteOwner.getDb();
            if (!agentDb)
                return { ok: false, reason: 'db_unavailable' };
            const { uuid, owner_id, name, definition, expires_at } = params;
            if (!uuid || !owner_id || !name || !definition) {
                throw Object.assign(new Error('agent/store requires uuid, owner_id, name, definition'), { code: -32600 });
            }
            agentDb.prepare(`
        INSERT OR REPLACE INTO uuid_agents (uuid, owner_id, name, definition, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuid, owner_id, name, typeof definition === 'string' ? definition : JSON.stringify(definition), expires_at ?? null);
            return { ok: true, uuid };
        }
        case 'agent/get': {
            // Retrieve a composed agent by UUID. Returns null if not found or expired.
            const agentDb = sqliteOwner.getDb();
            if (!agentDb)
                return null;
            const { uuid } = params;
            if (!uuid)
                throw Object.assign(new Error('agent/get requires uuid'), { code: -32600 });
            const agentRow = agentDb.prepare(`
        SELECT uuid, owner_id, name, definition, created_at, expires_at, last_used, use_count
        FROM uuid_agents WHERE uuid = ?
      `).get(uuid);
            if (!agentRow)
                return null;
            if (agentRow['expires_at'] && new Date(agentRow['expires_at']) < new Date()) {
                agentDb.prepare('DELETE FROM uuid_agents WHERE uuid = ?').run(uuid);
                return null;
            }
            agentDb.prepare(`UPDATE uuid_agents SET last_used = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), use_count = use_count + 1 WHERE uuid = ?`).run(uuid);
            let parsed = agentRow['definition'];
            try {
                parsed = JSON.parse(agentRow['definition']);
            }
            catch { /* keep raw */ }
            return { ...agentRow, definition: parsed };
        }
        case 'agent/list': {
            // List non-expired composed agents for a user.
            const agentDb = sqliteOwner.getDb();
            if (!agentDb)
                return [];
            const { owner_id } = params;
            if (!owner_id)
                throw Object.assign(new Error('agent/list requires owner_id'), { code: -32600 });
            return agentDb.prepare(`
        SELECT uuid, name, created_at, expires_at, last_used, use_count
        FROM uuid_agents
        WHERE owner_id = ?
          AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ORDER BY last_used DESC
      `).all(owner_id);
        }
        case 'daemon/ping': {
            return {
                ok: true,
                version: VERSION,
                pid: process.pid,
                uptime: process.uptime(),
                sessions: sessionRegistry.count(),
            };
        }
        case 'daemon/shutdown': {
            // Schedule shutdown after response is sent
            setImmediate(() => {
                if (_server) {
                    _server.emit('daemon-shutdown');
                }
            });
            return { ok: true };
        }
        case 'project/resolve': {
            const p = params;
            let entry = null;
            if (p.git_remote)
                entry = projectCache.getByRemote(p.git_remote);
            if (!entry && p.directory)
                entry = projectCache.getByDirectory(p.directory);
            if (!entry && p.slug)
                entry = projectCache.getBySlug(p.slug);
            return entry
                ? { found: true, project_id: entry.id, slug: entry.slug }
                : { found: false };
        }
        case 'project/cache-set': {
            projectCache.set(params);
            return { ok: true };
        }
        // ── Orchestration ─────────────────────────────────────────────────────────
        case 'orchestration/run-create': {
            const { createRun } = await import('./orchestration-queue.js');
            const p = params;
            const { user_id, project_id, goal } = p;
            if (!user_id || !project_id || !goal)
                throw Object.assign(new Error('run-create requires user_id, project_id, goal'), { code: -32600 });
            return createRun({
                user_id, project_id, goal,
                execution_mode: p['execution_mode'],
                tags: p['tags'],
                base_branch: p['base_branch'],
                working_directory: p['working_directory'],
                access_scope: p['access_scope'],
            });
        }
        case 'orchestration/run-get': {
            const { getRun } = await import('./orchestration-queue.js');
            const { id } = params;
            if (!id)
                throw Object.assign(new Error('run-get requires id'), { code: -32600 });
            return getRun(id);
        }
        case 'orchestration/run-list': {
            const { listRuns } = await import('./orchestration-queue.js');
            return listRuns(params);
        }
        case 'orchestration/run-update': {
            const { updateRun } = await import('./orchestration-queue.js');
            const { id, ...fields } = params;
            if (!id)
                throw Object.assign(new Error('run-update requires id'), { code: -32600 });
            return updateRun(id, fields);
        }
        case 'orchestration/task-enqueue': {
            const { enqueueTasks } = await import('./orchestration-queue.js');
            const { tasks } = params;
            if (!Array.isArray(tasks) || tasks.length === 0)
                throw Object.assign(new Error('task-enqueue requires non-empty tasks array'), { code: -32600 });
            return enqueueTasks(tasks);
        }
        case 'orchestration/task-get': {
            const { getTask } = await import('./orchestration-queue.js');
            const { id } = params;
            if (!id)
                throw Object.assign(new Error('task-get requires id'), { code: -32600 });
            return getTask(id);
        }
        case 'orchestration/task-list': {
            const { listTasks } = await import('./orchestration-queue.js');
            return listTasks(params);
        }
        case 'orchestration/task-pickup': {
            const { pickupTask } = await import('./orchestration-queue.js');
            const { project_id, session_id } = params;
            if (!project_id || !session_id)
                throw Object.assign(new Error('task-pickup requires project_id, session_id'), { code: -32600 });
            return pickupTask({ project_id, session_id });
        }
        case 'orchestration/task-complete': {
            const { completeTask } = await import('./orchestration-queue.js');
            const { task_id, result_summary } = params;
            if (!task_id)
                throw Object.assign(new Error('task-complete requires task_id'), { code: -32600 });
            return completeTask({ task_id, result_summary });
        }
        case 'orchestration/approval-create': {
            const { createApproval } = await import('./orchestration-queue.js');
            const { run_id, stage } = params;
            if (!run_id || !stage)
                throw Object.assign(new Error('approval-create requires run_id, stage'), { code: -32600 });
            return createApproval({ run_id, stage: stage });
        }
        case 'orchestration/approval-resolve': {
            const { resolveApproval } = await import('./orchestration-queue.js');
            const { run_id, stage, status, feedback } = params;
            if (!run_id || !stage || !status)
                throw Object.assign(new Error('approval-resolve requires run_id, stage, status'), { code: -32600 });
            return resolveApproval({ run_id, stage: stage, status: status, feedback });
        }
        case 'orchestration/approval-get': {
            const { getApproval } = await import('./orchestration-queue.js');
            const { run_id, stage } = params;
            if (!run_id || !stage)
                throw Object.assign(new Error('approval-get requires run_id, stage'), { code: -32600 });
            return getApproval(run_id, stage);
        }
        case 'orchestration/status-dashboard': {
            const { statusDashboard } = await import('./orchestration-queue.js');
            return statusDashboard(params);
        }
        default: {
            throw Object.assign(new Error(`Method not found: ${String(method)}`), { code: -32601 });
        }
    }
}
// ── Connection handler ────────────────────────────────────────────────────────
function handleConnection(socket) {
    activeSockets.add(socket);
    socket.once('close', () => activeSockets.delete(socket));
    socket.on('error', () => {
        activeSockets.delete(socket);
        try {
            socket.destroy();
        }
        catch { /* ignore */ }
    });
    // Reset the idle checkpoint timer on every incoming connection.
    sqliteOwner.resetIdleTimer();
    const rl = createInterface({ input: socket, crlfDelay: Infinity });
    // First line must be AUTH <token>. Silently destroy on mismatch — no error
    // response to avoid leaking information to unauthorized callers.
    rl.once('line', (authLine) => {
        if (!checkSocketAuth(authLine)) {
            rl.close();
            socket.destroy();
            return;
        }
        // Auth passed — read the JSON-RPC request on the next line.
        rl.once('line', (line) => { void handleRpc(line, socket, rl); });
    });
}
async function handleRpc(line, socket, rl) {
    rl.close();
    let req;
    let id = 0;
    const sendError = (code, message, data) => {
        const resp = {
            jsonrpc: '2.0',
            id,
            error: { code, message, ...(data !== undefined ? { data } : {}) },
        };
        try {
            socket.write(JSON.stringify(resp) + '\n');
        }
        catch {
            // Socket may already be closed
        }
        finally {
            socket.end();
        }
    };
    const sendResult = (result) => {
        const resp = { jsonrpc: '2.0', id, result };
        try {
            socket.write(JSON.stringify(resp) + '\n');
        }
        catch {
            // Socket may already be closed
        }
        finally {
            socket.end();
        }
    };
    // Parse JSON-RPC request
    try {
        req = JSON.parse(line);
        id = req.id ?? 0;
    }
    catch {
        sendError(-32600, 'Invalid JSON in request');
        return;
    }
    if (!req || req.jsonrpc !== '2.0' || !req.method) {
        sendError(-32600, 'Invalid JSON-RPC 2.0 request');
        return;
    }
    // Dispatch
    try {
        const result = await dispatchRpcRequest(req);
        sendResult(result);
    }
    catch (err) {
        const isRpcError = err !== null && typeof err === 'object' && 'code' in err;
        const code = isRpcError ? err.code : -32603;
        const message = err instanceof Error ? err.message : String(err);
        sendError(code, message);
    }
}
// ── Public API ────────────────────────────────────────────────────────────────
export function createDaemonServer(authToken) {
    _authToken = authToken;
    const server = createServer(handleConnection);
    _server = server;
    server.on('error', (err) => {
        process.stderr.write(`[gramatr-daemon] server error: ${err.message}\n`);
    });
    return server;
}
export function getActiveSockets() {
    return activeSockets;
}
//# sourceMappingURL=server.js.map