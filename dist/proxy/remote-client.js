/**
 * Remote MCP client — HTTP connection to api.gramatr.com/mcp.
 *
 * Uses native fetch with keepAlive for connection pooling.
 * All requests include the Bearer token from auth.ts.
 * Handles 401 by refreshing the token once and retrying.
 */
import { getToken, refreshToken, getServerUrl } from '../server/auth.js';
const DEBUG = !!process.env.GRAMATR_DEBUG;
function debugLog(label, data) {
    if (!DEBUG)
        return;
    const json = JSON.stringify(data, null, 2);
    process.stderr.write(`[gramatr-debug] ${label}:\n${json}\n\n`);
}
let requestId = 0;
/**
 * Call a remote MCP tool via JSON-RPC over HTTP.
 */
export async function callRemoteTool(toolName, args) {
    const payload = {
        jsonrpc: '2.0',
        id: ++requestId,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
    };
    let response = await postToRemote(payload);
    // Handle 401 — refresh token and retry once
    if (response.status === 401) {
        refreshToken();
        response = await postToRemote(payload);
    }
    if (!response.ok) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Remote server error: HTTP ${response.status} ${response.statusText}`);
    }
    const body = await parseSSEResponse(response);
    if (body.error) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Remote tool error: ${body.error.message}`);
    }
    return body.result;
}
/**
 * Fetch the remote tool list via tools/list.
 */
export async function fetchRemoteToolList() {
    const payload = {
        jsonrpc: '2.0',
        id: ++requestId,
        method: 'tools/list',
        params: {},
    };
    const response = await postToRemote(payload);
    if (!response.ok) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Failed to fetch tool list: HTTP ${response.status}`);
    }
    const body = await parseSSEResponse(response);
    if (body.error) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Tool list error: ${body.error.message}`);
    }
    return body.result;
}
/**
 * Fetch the remote prompt list via prompts/list.
 */
export async function fetchRemotePromptList() {
    const payload = {
        jsonrpc: '2.0',
        id: ++requestId,
        method: 'prompts/list',
        params: {},
    };
    const response = await postToRemote(payload);
    if (!response.ok) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Failed to fetch prompt list: HTTP ${response.status}`);
    }
    const body = await parseSSEResponse(response);
    if (body.error) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Prompt list error: ${body.error.message}`);
    }
    return body.result;
}
/**
 * Fetch a specific prompt via prompts/get.
 */
export async function fetchRemotePrompt(name, args) {
    const payload = {
        jsonrpc: '2.0',
        id: ++requestId,
        method: 'prompts/get',
        params: { name, arguments: args },
    };
    const response = await postToRemote(payload);
    if (!response.ok) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Failed to fetch prompt: HTTP ${response.status}`);
    }
    const body = await parseSSEResponse(response);
    if (body.error) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Prompt error: ${body.error.message}`);
    }
    return body.result;
}
/**
 * Fetch the remote resource list via resources/list.
 */
export async function fetchRemoteResourceList() {
    const payload = {
        jsonrpc: '2.0',
        id: ++requestId,
        method: 'resources/list',
        params: {},
    };
    const response = await postToRemote(payload);
    if (!response.ok) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Failed to fetch resource list: HTTP ${response.status}`);
    }
    const body = await parseSSEResponse(response);
    if (body.error) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Resource list error: ${body.error.message}`);
    }
    return body.result;
}
/**
 * Read a specific resource via resources/read.
 */
export async function fetchRemoteResource(uri) {
    const payload = {
        jsonrpc: '2.0',
        id: ++requestId,
        method: 'resources/read',
        params: { uri },
    };
    const response = await postToRemote(payload);
    if (!response.ok) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Failed to read resource: HTTP ${response.status}`);
    }
    const body = await parseSSEResponse(response);
    if (body.error) {
        // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
        throw new Error(`Resource read error: ${body.error.message}`);
    }
    return body.result;
}
/**
 * POST a JSON-RPC payload to the remote MCP endpoint.
 */
async function postToRemote(payload) {
    const serverUrl = getServerUrl();
    const token = getToken();
    const url = `${serverUrl}/mcp`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    debugLog(`→ POST ${url} [${payload.method}]`, {
        ...payload,
        // Redact large argument values in debug output
        params: payload.params && typeof payload.params === 'object'
            ? Object.fromEntries(Object.entries(payload.params).map(([k, v]) => [
                k,
                typeof v === 'string' && v.length > 500 ? `${v.slice(0, 200)}... [${v.length} chars]` : v,
            ]))
            : payload.params,
    });
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
    });
    debugLog(`← ${response.status} ${response.statusText} [${payload.method}]`, {
        status: response.status,
        headers: Object.fromEntries([...response.headers.entries()].filter(([k]) => !k.toLowerCase().includes('authorization'))),
    });
    return response;
}
/**
 * Parse an SSE response from the MCP server.
 * The server returns `event: message\ndata: {...}\n\n` format.
 */
async function parseSSEResponse(response) {
    const text = await response.text();
    if (DEBUG) {
        const preview = text.length > 2000 ? `${text.slice(0, 2000)}... [${text.length} chars]` : text;
        debugLog('← response body', preview);
    }
    // Try direct JSON parse first (some responses are plain JSON)
    try {
        return JSON.parse(text);
    }
    catch {
        // Fall through to SSE parsing
    }
    // Parse SSE format: extract the data line
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
                return JSON.parse(data);
            }
            catch {
                // Malformed data line — continue
            }
        }
    }
    // gramatr-allow: B1 — standalone proxy package, no @gramatr/core dependency
    throw new Error(`Could not parse remote response: ${text.substring(0, 200)}`);
}
//# sourceMappingURL=remote-client.js.map