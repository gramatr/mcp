/**
 * local-client.ts — Hook-side daemon IPC client.
 *
 * Sprint 1: replaces the previous "spawn npx @gramatr/mcp via StdioClientTransport"
 * model. Tool calls now go through the persistent daemon over a Unix socket (~1ms)
 * instead of spawning a new process (~200-700ms).
 *
 * Call path:
 *   callTool(name, args)
 *     → callViaDaemon()    [try first, 8ms connect timeout]
 *     → callRemoteTool()   [fallback if daemon unavailable]
 *
 * Connection-per-call pattern is correct here — hooks are short-lived processes
 * and don't benefit from connection pooling.
 */
import { createConnection } from 'node:net';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { callRemoteTool } from './remote-client.js';
import { getDaemonSocketPath, readHttpCredentials } from '../daemon/startup.js';
import { DAEMON_UNAVAILABLE } from '../daemon/ipc-protocol.js';
// ── Request ID counter ──
let _requestId = 0;
// ── Socket utilities ──────────────────────────────────────────────────────────
/**
 * Open a Unix socket connection with a hard timeout.
 * Rejects with ENOENT, ECONNREFUSED, or 'connect timeout' — all map to DAEMON_UNAVAILABLE.
 */
async function openSocketWithTimeout(path, timeoutMs) {
    return new Promise((resolve, reject) => {
        const socket = createConnection(path);
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error('connect timeout'));
        }, timeoutMs);
        socket.once('connect', () => {
            clearTimeout(timer);
            resolve(socket);
        });
        socket.once('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
/**
 * Read a single newline-terminated line from the socket, with timeout.
 * Rejects with 'read timeout' or 'socket closed' — both map to DAEMON_UNAVAILABLE.
 */
async function readOneLine(socket, timeoutMs) {
    return new Promise((resolve, reject) => {
        const rl = createInterface({ input: socket, crlfDelay: Infinity });
        const timer = setTimeout(() => {
            rl.close();
            reject(new Error('read timeout'));
        }, timeoutMs);
        rl.once('line', (line) => {
            clearTimeout(timer);
            rl.close();
            resolve(line);
        });
        rl.once('close', () => {
            clearTimeout(timer);
            reject(new Error('socket closed'));
        });
        rl.once('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
// ── Daemon IPC ────────────────────────────────────────────────────────────────
/**
 * Send a JSON-RPC request to the daemon over the Unix socket.
 * Returns DAEMON_UNAVAILABLE if the socket is unreachable or the call fails.
 */
export async function callViaDaemon(method, params) {
    const sockPath = getDaemonSocketPath();
    let socket;
    try {
        socket = await openSocketWithTimeout(sockPath, 8);
        const req = {
            jsonrpc: '2.0',
            id: ++_requestId,
            method: method,
            params,
        };
        socket.write(JSON.stringify(req) + '\n');
        const line = await readOneLine(socket, 8000);
        const resp = JSON.parse(line);
        if (resp.error) {
            // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
            throw new Error(resp.error.message);
        }
        return resp.result;
    }
    catch {
        return DAEMON_UNAVAILABLE;
    }
    finally {
        try {
            socket?.destroy();
        }
        catch { /* ignore */ }
    }
}
// ── Tier 2: Localhost HTTP fallback ──────────────────────────────────────────
/**
 * Send a JSON-RPC request to the daemon via localhost HTTP (Tier 2 fallback).
 * Used when the IPC socket is unavailable (e.g. Windows named pipe not supported
 * in the current environment, or socket file missing but daemon is running).
 * Returns DAEMON_UNAVAILABLE if the HTTP server is unreachable or auth fails.
 */
async function callViaLocalHttp(method, params) {
    const creds = readHttpCredentials();
    if (!creds)
        return DAEMON_UNAVAILABLE;
    try {
        const req = {
            jsonrpc: '2.0',
            id: ++_requestId,
            method: method,
            params,
        };
        const response = await fetch(`http://127.0.0.1:${creds.port}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${creds.token}`,
            },
            body: JSON.stringify(req),
            signal: AbortSignal.timeout(9_000),
        });
        if (!response.ok)
            return DAEMON_UNAVAILABLE;
        const resp = await response.json();
        if (resp.error) {
            // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
            throw new Error(resp.error.message);
        }
        return resp.result;
    }
    catch {
        return DAEMON_UNAVAILABLE;
    }
}
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Returns true if the daemon socket file exists.
 * Does NOT guarantee the daemon process is alive — use isDaemonRunning() for that.
 */
export function isLocalHooksServerAvailable() {
    return existsSync(getDaemonSocketPath());
}
/**
 * Call a gramatr tool via the daemon (Tier 1 socket → Tier 2 HTTP → Tier 3 remote).
 * Never throws — returns an isError result on failure so hooks degrade gracefully.
 */
export async function callTool(name, args) {
    // Tier 1: IPC socket (Unix or Windows named pipe)
    const socketResult = await callViaDaemon('tool/call', { name, arguments: args });
    if (socketResult !== DAEMON_UNAVAILABLE) {
        return socketResult;
    }
    // Tier 2: localhost HTTP with shared secret
    const httpResult = await callViaLocalHttp('tool/call', { name, arguments: args });
    if (httpResult !== DAEMON_UNAVAILABLE) {
        return httpResult;
    }
    // Fallback: call the remote MCP server directly
    try {
        const result = await callRemoteTool(name, args);
        return result;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: 'text', text: `gramatr hook: tool call failed — ${message}` }],
            isError: true,
        };
    }
}
/**
 * Push session context to the daemon's in-memory store so other hooks in the
 * same session can retrieve it without hitting the DB.
 * Returns false if the daemon is unavailable (non-fatal).
 */
export async function pushSessionContextToLocal(ctx) {
    if (ctx === null || typeof ctx !== 'object')
        return false;
    const sessionId = ctx.session_id;
    if (!sessionId)
        return false;
    const result = await callViaDaemon('session/context/set', {
        session_id: sessionId,
        context: ctx,
    });
    return result !== DAEMON_UNAVAILABLE;
}
/**
 * Pull session context from the daemon's in-memory store.
 * Returns null if the daemon is unavailable or has no context for this session.
 */
export async function pullSessionContextFromLocal(sessionId) {
    const result = await callViaDaemon('session/context/get', { session_id: sessionId });
    if (result === DAEMON_UNAVAILABLE)
        return null;
    const typed = result;
    if (typed.value === null || typed.value === undefined)
        return null;
    return typed.value;
}
/** Reset module-level request ID counter for testing. Not for production use. */
export function _resetClientForTest() {
    _requestId = 0;
}
//# sourceMappingURL=local-client.js.map