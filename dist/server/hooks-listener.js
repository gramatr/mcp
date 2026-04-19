/**
 * hooks-listener.ts — Local HTTP IPC server for hook subprocesses.
 *
 * Phase IV: The local MCP proxy server opens a lightweight HTTP listener on a
 * random localhost port at startup and writes the port to ~/.gramatr/.hooks-port.
 * Hook subprocesses (session-start, user-prompt-submit, session-end) discover
 * this port and route calls through the local server instead of calling the
 * remote server directly.
 *
 * Benefits:
 *   - Auth managed in one place: the local server has the token; hooks never
 *     need to resolve or refresh it themselves.
 *   - Single enforcement point for data shapes and schema validation before
 *     any call reaches the remote API.
 *   - Cross-hook session context via in-process memory (no SQLite file needed).
 *   - Faster: localhost vs. internet round-trip for session context reads.
 *
 * Fallback: if the port file is absent (local server not running), hooks fall
 * back to direct remote calls with their own auth resolution.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
import { callRemoteTool } from '../proxy/remote-client.js';
// ── In-memory session context store ──
// Keys: session_id (string) + '__latest__' sentinel for the most recent write.
// Hooks that don't know the session_id (e.g. a status query) fall back to __latest__.
const sessionStore = new Map();
// ── Port file path ──
function getPortFilePath() {
    const dir = getGramatrDirFromEnv() || join(getHomeDir(), '.gramatr');
    return join(dir, '.hooks-port');
}
// ── Request helpers ──
async function readBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', () => resolve(''));
    });
}
function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}
// ── Route handlers ──
async function handleRequest(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const method = (req.method || 'GET').toUpperCase();
    // ── POST /hooks/tool — proxy a gramatr tool call with server-managed auth ──
    if (url.pathname === '/hooks/tool' && method === 'POST') {
        const raw = await readBody(req);
        try {
            const { name, args } = JSON.parse(raw);
            if (!name || typeof name !== 'string') {
                json(res, 400, { error: 'name is required' });
                return;
            }
            const result = await callRemoteTool(name, args ?? {});
            json(res, 200, { result });
        }
        catch (err) {
            json(res, 502, { error: err instanceof Error ? err.message : String(err) });
        }
        return;
    }
    // ── GET /hooks/session?session_id=xxx — retrieve session context ──
    if (url.pathname === '/hooks/session' && method === 'GET') {
        const sessionId = url.searchParams.get('session_id');
        const ctx = (sessionId ? sessionStore.get(sessionId) : null)
            ?? sessionStore.get('__latest__')
            ?? null;
        json(res, 200, { ctx });
        return;
    }
    // ── POST /hooks/session — store session context ──
    if (url.pathname === '/hooks/session' && method === 'POST') {
        const raw = await readBody(req);
        try {
            const ctx = JSON.parse(raw);
            const sessionId = ctx?.session_id;
            if (sessionId)
                sessionStore.set(sessionId, ctx);
            sessionStore.set('__latest__', ctx);
            json(res, 200, { ok: true });
        }
        catch {
            json(res, 400, { error: 'Invalid JSON' });
        }
        return;
    }
    json(res, 404, { error: 'Not found' });
}
// ── Lifecycle ──
let _server = null;
/**
 * Start the hooks IPC listener on a random localhost port.
 * Writes the port to ~/.gramatr/.hooks-port so hook subprocesses can find it.
 * Returns the assigned port number.
 */
export async function startHooksListener() {
    // Ensure the directory exists for the port file
    const dir = getGramatrDirFromEnv() || join(getHomeDir(), '.gramatr');
    try {
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
    }
    catch { /* non-critical — port file write will fail gracefully below */ }
    return new Promise((resolve, reject) => {
        _server = createServer((req, res) => {
            handleRequest(req, res).catch((err) => {
                json(res, 500, { error: err instanceof Error ? err.message : String(err) });
            });
        });
        _server.listen(0, '127.0.0.1', () => {
            const addr = _server.address();
            const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
            try {
                // mode 0o600: readable only by the current user
                writeFileSync(getPortFilePath(), String(port), { mode: 0o600 });
            }
            catch {
                // Non-critical — hooks will fall back to SQLite + direct remote
            }
            resolve(port);
        });
        _server.once('error', reject);
    });
}
/**
 * Stop the hooks listener and remove the port file.
 * Called on server shutdown so stale hooks know to fall back to direct remote.
 */
export function stopHooksListener() {
    _server?.close();
    _server = null;
    try {
        unlinkSync(getPortFilePath());
    }
    catch { /* best-effort cleanup */ }
}
//# sourceMappingURL=hooks-listener.js.map