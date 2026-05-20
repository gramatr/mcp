#!/usr/bin/env node
// packages/mcp/src/bin/plugin-proxy.ts
// Minimal stdio→HTTP proxy. Intercepts session_bootstrap to inject git context.
// All other JSON-RPC messages forwarded to api.gramatr.com/mcp unchanged.
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
                return JSON.parse(lastData);
            }
            catch {
                // Fall through to error response
            }
        }
        return { jsonrpc: '2.0', error: { code: -32603, message: 'Empty SSE response from remote' } };
    }
    // Plain JSON response
    try {
        return await res.json();
    }
    catch {
        return { jsonrpc: '2.0', error: { code: -32603, message: `Non-JSON response from remote: ${res.status}` } };
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
    // Intercept session_bootstrap tool calls to inject git context
    if (method === 'tools/call' &&
        msg.params !== null &&
        typeof msg.params === 'object') {
        const params = msg.params;
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
            const response = await forwardToRemote(enriched);
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
    // Notifications have no id and expect no response
    if (msg.id === undefined || msg.id === null) {
        forwardToRemote(msg).catch(() => undefined);
        return null;
    }
    return forwardToRemote(msg);
}
// ── Main: readline loop ───────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, terminal: false });
function writeResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
}
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
//# sourceMappingURL=plugin-proxy.js.map