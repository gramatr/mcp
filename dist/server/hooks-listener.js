/**
 * hooks-listener.ts — Local HTTP IPC server for hook subprocesses.
 *
 * The local MCP proxy server opens a lightweight HTTP listener on a random
 * localhost port at startup. Callers (statusline, any separate-process tool)
 * discover the port via ~/.gramatr/.hooks-port.
 *
 * Security: every request must present X-Hooks-Secret matching the value in
 * ~/.gramatr/.hooks-secret (written at startup, mode 0o600). This prevents
 * other processes on the same machine from hijacking the channel. The secret
 * is regenerated on each server start.
 *
 * Auth policy: callers never carry a JWT. The local server holds the token
 * and manages all outbound calls to the central server. No fallback to direct
 * remote calls — if the local server is unavailable, callers show offline.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
import { callRemoteTool, fetchRemoteResource } from '../proxy/remote-client.js';
import { getToken } from './auth.js';
// ── In-memory session context store ──
// Keys: session_id (string) + '__latest__' sentinel for the most recent write.
// Hooks that don't know the session_id (e.g. a status query) fall back to __latest__.
const sessionStore = new Map();
// ── Per-server-instance shared secret ──
let _secret = null;
/** Return the current IPC secret. Null until startHooksListener() has run. */
export function getHooksSecret() {
    return _secret;
}
// ── Port + secret file paths ──
function getGramatrDir() {
    return getGramatrDirFromEnv() || join(getHomeDir(), '.gramatr');
}
function getPortFilePath() {
    return join(getGramatrDir(), '.hooks-port');
}
function getSecretFilePath() {
    return join(getGramatrDir(), '.hooks-secret');
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
// ── Statusline rendering helpers ──
/**
 * Extract the parsed JSON payload from an MCP resources/read result.
 * The MCP envelope is: { contents: [{ text: "<json string>" }] }
 * Returns null on any parse or shape error.
 */
function extractResourceJson(settled) {
    if (settled.status !== 'fulfilled')
        return null;
    try {
        const result = settled.value;
        const text = result?.contents?.[0]?.text;
        if (typeof text !== 'string')
            return null;
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
function formatTokens(n) {
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}
/**
 * Assemble the rendered statusline string from resource data and git state.
 *
 *   small:  ● grāmatr │ branch │ ⚡Xk saved
 *   medium: ● grāmatr │ project @ branch [±N ✎M] │ ⚡Xk saved │ N calls
 *   large:  ● grāmatr │ project @ branch [±N ✎M ?U] │ ⚡Xk saved │ N calls │ 85% cache
 */
function renderStatusline(body, stats, _profile) {
    const size = body.size ?? 'medium';
    const git = body.git_state ?? {};
    const branch = git.branch || 'HEAD';
    const project = body.project_id ? body.project_id.replace(/^.*\//, '') : '';
    const savings = stats?.token_savings_total ?? 0;
    const calls = stats?.tool_call_count ?? 0;
    const cacheRate = stats?.cache_hit_rate ?? 0;
    // Build git annotation: ↑N↓M for ahead/behind, ✎N for modified
    const aheadBehind = [
        (git.ahead ?? 0) > 0 ? `↑${git.ahead}` : '',
        (git.behind ?? 0) > 0 ? `↓${git.behind}` : '',
    ].filter(Boolean).join('');
    const dirty = (git.modified ?? 0) > 0 ? `✎${git.modified}` : '';
    const untracked = (git.untracked ?? 0) > 0 ? `?${git.untracked}` : '';
    const gitSuffix = [aheadBehind, dirty].filter(Boolean).join(' ');
    const gitFull = [aheadBehind, dirty, untracked].filter(Boolean).join(' ');
    const branchStr = branch + (gitSuffix ? ` ${gitSuffix}` : '');
    const branchFull = branch + (gitFull ? ` ${gitFull}` : '');
    const savingsStr = savings > 0 ? `⚡${formatTokens(savings)} saved` : '';
    if (size === 'small') {
        const parts = ['  ● grāmatr', branchStr, savingsStr].filter(Boolean);
        return parts.join(' │ ') + '\n';
    }
    if (size === 'medium') {
        const loc = project ? `${project} @ ${branchStr}` : branchStr;
        const parts = ['  ● grāmatr', loc];
        if (savingsStr)
            parts.push(savingsStr);
        if (calls > 0)
            parts.push(`${calls} calls`);
        return parts.join(' │ ') + '\n';
    }
    // large
    const loc = project ? `${project} @ ${branchFull}` : branchFull;
    const parts = ['  ● grāmatr', loc];
    if (savingsStr)
        parts.push(savingsStr);
    if (calls > 0)
        parts.push(`${calls} calls`);
    if (cacheRate > 0)
        parts.push(`${Math.round(cacheRate * 100)}% cache`);
    return parts.join(' │ ') + '\n';
}
// ── Route handlers ──
async function handleRequest(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const method = (req.method || 'GET').toUpperCase();
    // ── Secret check — reject any caller that doesn't know the secret ──
    const presented = req.headers['x-hooks-secret'];
    if (!_secret || presented !== _secret) {
        json(res, 401, { error: 'Unauthorized' });
        return;
    }
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
    // ── POST /hooks/statusline — render statusline via MCP resources ──
    // Reads gramatr://session/stats and gramatr://user/profile via the local
    // MCP proxy instead of hitting the deprecated REST endpoint.
    if (url.pathname === '/hooks/statusline' && method === 'POST') {
        const raw = await readBody(req);
        try {
            const token = getToken();
            if (!token) {
                json(res, 503, { error: 'Local server not authenticated — run npx gramatr login' });
                return;
            }
            const body = JSON.parse(raw);
            // Fetch stats + profile in parallel; tolerate individual failures gracefully.
            const [statsResult, profileResult] = await Promise.allSettled([
                fetchRemoteResource('gramatr://session/stats'),
                fetchRemoteResource('gramatr://user/profile'),
            ]);
            const stats = extractResourceJson(statsResult);
            const profile = extractResourceJson(profileResult);
            const rendered = renderStatusline(body, stats, profile);
            json(res, 200, { rendered });
        }
        catch (err) {
            json(res, 502, { error: err instanceof Error ? err.message : String(err) });
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
    const dir = getGramatrDir();
    try {
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
    }
    catch { /* non-critical */ }
    // Generate a fresh per-run secret and persist it so callers can read it.
    _secret = randomBytes(32).toString('hex');
    try {
        writeFileSync(getSecretFilePath(), _secret, { mode: 0o600 });
    }
    catch { /* non-critical — callers will get 401 if they can't read the secret */ }
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
                writeFileSync(getPortFilePath(), String(port), { mode: 0o600 });
            }
            catch { /* non-critical */ }
            resolve(port);
        });
        _server.once('error', reject);
    });
}
/**
 * Stop the hooks listener and remove the port + secret files.
 */
export function stopHooksListener() {
    _server?.close();
    _server = null;
    _secret = null;
    try {
        unlinkSync(getPortFilePath());
    }
    catch { /* best-effort */ }
    try {
        unlinkSync(getSecretFilePath());
    }
    catch { /* best-effort */ }
}
//# sourceMappingURL=hooks-listener.js.map