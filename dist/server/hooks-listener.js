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
import { callRemoteTool } from '../proxy/remote-client.js';
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
function formatTokens(n) {
    if (n >= 1_000_000_000)
        return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}
function formatCount(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}
/**
 * Assemble the rendered statusline string.
 *
 *   small:   ● grāmatr │ branch ✎N │ ⚡119M saved
 *   medium:  ● grāmatr │ project · branch ✎N │ ⚡119M saved │ standard/analyze 94%
 *   large:   ● grāmatr v0.12.7 ⬆0.12.8 │ project · branch ✎N │ ⚡119M saved │ ◇168K obs │ standard/analyze 94%
 */
function renderStatusline(body, stats, classification) {
    const size = body.size ?? 'medium';
    const git = body.git_state ?? {};
    const branch = git.branch || 'HEAD';
    const project = body.project_id ? body.project_id.replace(/^.*\//, '') : '';
    const savings = stats?.token_savings_total ?? 0;
    const observations = stats?.observations_total ?? 0;
    const serverVersion = stats?.server_version;
    const clientVersion = stats?.client_version;
    const dirty = (git.modified ?? 0) > 0 ? ` ✎${git.modified}` : '';
    const branchStr = branch + dirty;
    const savingsStr = savings > 0 ? `⚡${formatTokens(savings)} saved` : '';
    // Classification segment: "standard/analyze 94%"
    const classifStr = classification?.effort_level && classification?.intent_type
        ? `${classification.effort_level}/${classification.intent_type}${classification.confidence ? ` ${classification.confidence}%` : ''}`
        : '';
    // Upgrade indicator: ⬆X.Y.Z when server version is newer than client
    const upgradeStr = serverVersion && clientVersion && serverVersion !== clientVersion
        ? ` ⬆${serverVersion}`
        : '';
    if (size === 'small') {
        const parts = ['  ● grāmatr', branchStr, savingsStr].filter(Boolean);
        return parts.join(' │ ') + '\n';
    }
    if (size === 'medium') {
        const loc = project ? `${project} · ${branchStr}` : branchStr;
        const parts = ['  ● grāmatr', loc];
        if (savingsStr)
            parts.push(savingsStr);
        if (classifStr)
            parts.push(classifStr);
        return parts.join(' │ ') + '\n';
    }
    // large
    const versionStr = clientVersion ? `grāmatr v${clientVersion}${upgradeStr}` : 'grāmatr';
    const loc = project ? `${project} · ${branchStr}` : branchStr;
    const parts = [`  ● ${versionStr}`, loc];
    if (savingsStr)
        parts.push(savingsStr);
    if (observations > 0)
        parts.push(`◇${formatCount(observations)} obs`);
    if (classifStr)
        parts.push(classifStr);
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
    // ── POST /hooks/statusline — render statusline ──
    // Fetches all-time stats from the remote stats API (fast — Redis-backed, ~10ms).
    // Falls back to local SQLite on any remote failure so the statusline never goes blank.
    if (url.pathname === '/hooks/statusline' && method === 'POST') {
        const raw = await readBody(req);
        try {
            const body = JSON.parse(raw);
            // Pull last classification from session context for the effort/intent segment.
            const sessionCtx = (body.session_id
                ? sessionStore.get(body.session_id)
                : sessionStore.get('__latest__')) ?? null;
            const lastClassif = sessionCtx?.['last_classification'];
            const classification = lastClassif ? {
                effort_level: lastClassif['effort_level'],
                intent_type: lastClassif['intent_type'],
                confidence: typeof lastClassif['confidence'] === 'number'
                    ? Math.round(lastClassif['confidence'] * 100)
                    : undefined,
            } : null;
            // Fetch all-time stats from remote API. Fast path: Redis-backed on the server.
            // Fall back to local SQLite on any failure so statusline never goes blank.
            let tokenSavingsTotal = 0;
            let observationsTotal = 0;
            let serverVersion;
            const { getAllTimeTokensSaved } = await import('../hooks/lib/hook-state.js');
            try {
                const { resolveAuthToken, resolveMcpUrl } = await import('../hooks/lib/gramatr-hook-utils.js');
                const token = resolveAuthToken();
                const mcpUrl = resolveMcpUrl();
                const baseUrl = mcpUrl.replace(/\/mcp\/?$/, '');
                const resp = await fetch(`${baseUrl}/api/v1/stats/statusline`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    signal: AbortSignal.timeout(2000),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    tokenSavingsTotal = typeof data['tokens_saved_total'] === 'number' ? data['tokens_saved_total'] : 0;
                    observationsTotal = typeof data['observation_count'] === 'number' ? data['observation_count'] : 0;
                    serverVersion = typeof data['server_version'] === 'string' ? data['server_version'] : undefined;
                }
                else {
                    tokenSavingsTotal = getAllTimeTokensSaved();
                }
            }
            catch {
                tokenSavingsTotal = getAllTimeTokensSaved();
            }
            // Read the installed client version from the package.json bundled with this module.
            let clientVersion;
            try {
                const { readFileSync } = await import('node:fs');
                const { join: pathJoin, dirname } = await import('node:path');
                const { fileURLToPath } = await import('node:url');
                const pkgPath = pathJoin(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
                clientVersion = pkg.version;
            }
            catch { /* non-critical */ }
            const stats = { token_savings_total: tokenSavingsTotal, observations_total: observationsTotal, server_version: serverVersion, client_version: clientVersion };
            const rendered = renderStatusline(body, stats, classification);
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