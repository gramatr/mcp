#!/usr/bin/env node
// packages/mcp/src/bin/plugin-proxy.ts
// Minimal stdio→HTTP proxy. Intercepts session_bootstrap to inject git context.
// All other JSON-RPC messages forwarded to api.gramatr.com/mcp unchanged.
// Auth is non-blocking: proxy starts immediately, gramatr_authenticate tool
// handles device flow on demand.
import { createInterface } from 'node:readline';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
// CLI binaries read process.env at init — this is the config boundary.
// gramatr-allow: c1
const REMOTE_URL = process.env.GRAMATR_URL ?? 'https://api.gramatr.com/mcp';
// Plugin data directory — set by Claude Code when it spawns this stdio server.
// gramatr-allow: c1
const PLUGIN_DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? '';
// gramatr-allow: c1
const ENV_API_KEY = process.env.GRAMATR_API_KEY ?? '';
// gramatr-allow: c1
const ENV_TOKEN = process.env.GRAMATR_TOKEN ?? '';
// gramatr-allow: c1
const HOME_DIR = process.env.HOME ?? '';
// Derive the base server URL (strip /mcp suffix) for device-flow endpoints.
const REMOTE_BASE = REMOTE_URL.replace(/\/mcp\/?$/, '');
// Typed error for device-flow authentication failures — satisfies B1.no-generic-error.
class ProxyAuthError extends Error {
    constructor(message) { super(message); this.name = 'ProxyAuthError'; }
}
function getToken() {
    // Explicit env overrides (CI, testing, headless)
    const envToken = ENV_API_KEY || ENV_TOKEN;
    if (envToken)
        return envToken;
    // Plugin-scoped token file — written by the device-flow auth (#2867)
    if (PLUGIN_DATA_DIR) {
        try {
            const cfg = JSON.parse(readFileSync(join(PLUGIN_DATA_DIR, 'token.json'), 'utf8'));
            if (typeof cfg.token === 'string' && cfg.token)
                return cfg.token;
        }
        catch { /* not yet written */ }
    }
    // Claude Code OAuth token — written by Claude Code's OAuth flow for the HTTP gramatr server.
    // The gramatr HTTP server completes OAuth during initialize (before any hooks fire), so this
    // token is available by the time session_bootstrap or route_request is called.
    try {
        const credFile = resolve(HOME_DIR, '.claude', '.credentials.json');
        const creds = JSON.parse(readFileSync(credFile, 'utf8'));
        const mcpOAuth = creds.mcpOAuth;
        if (mcpOAuth) {
            for (const entry of Object.values(mcpOAuth)) {
                if (entry.serverUrl === REMOTE_URL &&
                    entry.accessToken &&
                    (!entry.expiresAt || Date.now() < Number(entry.expiresAt))) {
                    return entry.accessToken;
                }
            }
        }
    }
    catch { /* credentials.json missing or malformed */ }
    return '';
}
// Run the RFC 8628 device flow and persist the token to PLUGIN_DATA_DIR/token.json.
// Returns the acquired access token.
async function runDeviceFlow() {
    const startRes = await fetch(`${REMOTE_BASE}/device/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'gramatr-local-extras' }),
        signal: AbortSignal.timeout(10000),
    });
    if (!startRes.ok) {
        const text = await startRes.text().catch(() => '');
        throw new ProxyAuthError(`Device flow start failed: HTTP ${startRes.status} ${text}`);
    }
    const startPayload = await startRes.json();
    const deviceCode = startPayload.device_code;
    const userCode = startPayload.user_code;
    const verificationUriComplete = startPayload.verification_uri_complete;
    const interval = typeof startPayload.interval === 'number' ? startPayload.interval : 5;
    process.stderr.write('grāmatr: Authentication required\n');
    if (verificationUriComplete) {
        process.stderr.write(`Open this URL to authorize: ${verificationUriComplete}\n`);
    }
    process.stderr.write(`Or visit https://app.gramatr.com/device and enter code: ${userCode}\n`);
    process.stderr.write('Waiting for authorization...\n');
    // Poll until authorized or error.
    let accessToken;
    while (!accessToken) {
        await new Promise((res) => setTimeout(res, interval * 1000));
        const pollRes = await fetch(`${REMOTE_BASE}/device/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: deviceCode }),
            signal: AbortSignal.timeout(10000),
        });
        let pollPayload = {};
        try {
            pollPayload = await pollRes.json();
        }
        catch { /* non-JSON body — treat as transient */ }
        if (pollRes.ok && typeof pollPayload.access_token === 'string') {
            accessToken = pollPayload.access_token;
            break;
        }
        // authorization_pending — keep polling
        if (pollRes.status === 428 || pollPayload.error === 'authorization_pending') {
            continue;
        }
        // Any other status is a hard error
        const errMsg = (pollPayload.error_description ?? pollPayload.error ?? `HTTP ${pollRes.status}`);
        throw new ProxyAuthError(`Device flow polling failed: ${errMsg}`);
    }
    // Persist the token to PLUGIN_DATA_DIR/token.json
    if (PLUGIN_DATA_DIR) {
        mkdirSync(PLUGIN_DATA_DIR, { recursive: true });
        writeFileSync(join(PLUGIN_DATA_DIR, 'token.json'), JSON.stringify({ token: accessToken }, null, 2) + '\n', 'utf8');
    }
    process.stderr.write('grāmatr: Authenticated successfully.\n');
    return accessToken;
}
// Synthetic tool definition injected into tools/list responses.
const SYNTHETIC_AUTH_TOOL = {
    name: 'gramatr_authenticate',
    description: 'Authenticate the grāmatr local proxy via device flow. Call this once if grāmatr tools are returning auth errors.',
    inputSchema: { type: 'object', properties: {}, required: [] },
};
function writeSessionFile(responseText) {
    if (!PLUGIN_DATA_DIR)
        return;
    try {
        const parsed = JSON.parse(responseText);
        const sessionId = parsed.session_id ?? parsed.gramatr_session_id;
        const projectId = parsed.project_id;
        if (sessionId || projectId) {
            mkdirSync(PLUGIN_DATA_DIR, { recursive: true });
            writeFileSync(join(PLUGIN_DATA_DIR, 'session.json'), JSON.stringify({ session_id: sessionId, project_id: projectId }, null, 2) + '\n', 'utf8');
        }
    }
    catch { /* not JSON or missing fields */ }
}
async function forwardToRemote(message) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
    };
    if (token)
        headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(REMOTE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
    });
    const httpStatus = res.status;
    const contentType = res.headers.get('content-type') ?? '';
    // SSE response: read full body and extract the last data: line
    if (contentType.includes('text/event-stream')) {
        const text = await res.text();
        // Find the last non-empty `data:` line
        const lines = text.split('\n');
        let lastData = null;
        for (const line of lines) {
            if (line.startsWith('data:')) {
                const payload = line.slice(5).trim();
                if (payload && payload !== '[DONE]')
                    lastData = payload;
            }
        }
        if (lastData) {
            try {
                return { response: JSON.parse(lastData), httpStatus };
            }
            catch {
                // Fall through to error response
            }
        }
        return { response: { jsonrpc: '2.0', error: { code: -32603, message: 'Empty SSE response from remote' } }, httpStatus };
    }
    // Plain JSON response
    try {
        return { response: await res.json(), httpStatus };
    }
    catch {
        return { response: { jsonrpc: '2.0', error: { code: -32603, message: `Non-JSON response from remote: ${res.status}` } }, httpStatus };
    }
}
function getGitRemote(cwd) {
    try {
        const result = spawnSync('git', ['-C', cwd, 'remote', 'get-url', 'origin'], {
            timeout: 2000,
            encoding: 'utf8',
        });
        if (result.status === 0 && result.stdout) {
            return result.stdout.trim();
        }
    }
    catch {
        // Swallow errors — git may not be installed or cwd may not be a repo
    }
    return '';
}
function getProjectId(cwd) {
    try {
        const projectFile = join(cwd, '.gramatr', 'project.json');
        if (existsSync(projectFile)) {
            const data = JSON.parse(readFileSync(projectFile, 'utf8'));
            if (typeof data.project_id === 'string' && data.project_id) {
                return data.project_id;
            }
        }
    }
    catch {
        // File missing or invalid JSON — ignore
    }
    return undefined;
}
async function handleMessage(msg) {
    const method = msg.method;
    const msgId = msg.id ?? null;
    // ── Synthetic gramatr_authenticate tool ──────────────────────────────────
    if (method === 'tools/call' && msg.params !== null && typeof msg.params === 'object') {
        const params = msg.params;
        if (params.name === 'gramatr_authenticate') {
            try {
                await runDeviceFlow();
                return {
                    jsonrpc: '2.0',
                    id: msgId,
                    result: {
                        content: [{ type: 'text', text: 'Authenticated successfully. grāmatr proxy is now connected.' }],
                    },
                };
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                return {
                    jsonrpc: '2.0',
                    id: msgId,
                    error: { code: -32001, message: `grāmatr: authentication failed — ${errMsg}` },
                };
            }
        }
        // Intercept session_bootstrap tool calls to inject git context
        if (params.name === 'session_bootstrap') {
            const args = (params.arguments ?? {});
            const cwd = typeof args.cwd === 'string' ? args.cwd : process.cwd();
            // Inject git_remote if not already present
            if (!args.git_remote) {
                const gitRemote = getGitRemote(cwd);
                if (gitRemote)
                    args.git_remote = gitRemote;
            }
            // Inject project_id if not already present and found locally
            if (!args.project_id) {
                const projectId = getProjectId(cwd);
                if (projectId)
                    args.project_id = projectId;
            }
            // Build enriched message
            const enriched = {
                ...msg,
                params: { ...params, arguments: args },
            };
            const { response, httpStatus } = await forwardToRemote(enriched);
            process.stderr.write(`grāmatr-proxy: tools/call session_bootstrap → HTTP ${httpStatus}\n`);
            if (httpStatus === 401) {
                return {
                    jsonrpc: '2.0',
                    id: msgId,
                    error: { code: -32001, message: 'grāmatr: not authenticated — call gramatr_authenticate to connect' },
                };
            }
            // Write session.json so the statusline script can read session_id
            try {
                const r = response;
                const contentArr = r.result?.content;
                const text = typeof contentArr?.[0]?.text === 'string' ? contentArr[0].text : '';
                if (text)
                    writeSessionFile(text);
            }
            catch { /* pass through */ }
            return response;
        }
    }
    // ── tools/list — inject synthetic gramatr_authenticate tool ─────────────
    if (method === 'tools/list') {
        // Notifications have no id and expect no response
        if (msgId === undefined || msgId === null) {
            forwardToRemote(msg).catch(() => undefined);
            return null;
        }
        const { response, httpStatus } = await forwardToRemote(msg);
        process.stderr.write(`grāmatr-proxy: tools/list → HTTP ${httpStatus}\n`);
        if (httpStatus === 401) {
            // Return a minimal tools/list with just the auth tool so the user can authenticate
            return {
                jsonrpc: '2.0',
                id: msgId,
                result: { tools: [SYNTHETIC_AUTH_TOOL] },
            };
        }
        // Append synthetic tool to the server's tool list
        try {
            const r = response;
            const result = r.result;
            if (result && Array.isArray(result.tools)) {
                result.tools = [...result.tools, SYNTHETIC_AUTH_TOOL];
            }
        }
        catch { /* pass through unmodified */ }
        return response;
    }
    // ── Notifications have no id and expect no response ──────────────────────
    if (msgId === undefined || msgId === null) {
        forwardToRemote(msg).catch(() => undefined);
        return null;
    }
    // ── Forward all other messages ────────────────────────────────────────────
    const { response, httpStatus } = await forwardToRemote(msg);
    process.stderr.write(`grāmatr-proxy: ${method ?? '(unknown)'} → HTTP ${httpStatus}\n`);
    if (httpStatus === 401) {
        return {
            jsonrpc: '2.0',
            id: msgId,
            error: { code: -32001, message: 'grāmatr: not authenticated — call gramatr_authenticate to connect' },
        };
    }
    return response;
}
// ── Main: readline loop ───────────────────────────────────────────────────────
function writeResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
}
async function main() {
    // Attach the stdio listener immediately — no blocking auth before this point.
    // The initialize handshake must succeed before any tools are called.
    const rl = createInterface({ input: process.stdin, terminal: false });
    // Log token resolution status to stderr for diagnostics.
    process.stderr.write(`grāmatr-proxy: starting — token ${getToken() ? 'found' : 'not found (call gramatr_authenticate)'}\n`);
    rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed)
            return;
        let msg;
        try {
            msg = JSON.parse(trimmed);
        }
        catch {
            // Unparseable input — ignore
            return;
        }
        handleMessage(msg)
            .then((response) => {
            if (response !== null) {
                writeResponse(response);
            }
        })
            .catch((err) => {
            // Return a JSON-RPC error response if we have a request id
            const id = msg.id ?? null;
            const errMsg = err instanceof Error ? err.message : String(err);
            writeResponse({
                jsonrpc: '2.0',
                id,
                error: { code: -32603, message: `Proxy error: ${errMsg}` },
            });
        });
    });
    rl.on('close', () => {
        process.exit(0);
    });
}
main().catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`grāmatr: Fatal proxy error: ${errMsg}\n`);
    process.exit(1);
});
//# sourceMappingURL=plugin-proxy.js.map