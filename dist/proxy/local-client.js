/**
 * local-client.ts — Hook-side MCP client.
 *
 * Spawns `npx -y @gramatr/mcp` via the MCP stdio transport so hooks call
 * gramatr tools through the same server that Claude Code uses. Auth and
 * session state are handled by that server process (reads from
 * ~/.gramatr/settings.json). No direct HTTP calls or in-process proxy.
 *
 * Connection is lazy-initialized on first callTool and reused for the
 * lifetime of the hook process. Falls back to an error result (never
 * throws) so hooks always degrade gracefully when the server is unavailable.
 *
 * pushSessionContextToLocal / pullSessionContextFromLocal are retained as
 * no-ops for call-site compatibility.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const SERVER_COMMAND = 'npx';
const SERVER_ARGS = ['-y', '@gramatr/mcp'];
let _client = null;
let _connecting = null;
/** Reset singleton for testing. Not for production use. */
export function _resetClientForTest() {
    _client = null;
    _connecting = null;
}
async function getClient() {
    if (_client)
        return _client;
    if (_connecting)
        return _connecting;
    _connecting = (async () => {
        const transport = new StdioClientTransport({
            command: SERVER_COMMAND,
            args: SERVER_ARGS,
            stderr: 'inherit',
        });
        const client = new Client({ name: 'gramatr-hook', version: '1.0.0' }, { capabilities: {} });
        await client.connect(transport);
        _client = client;
        _connecting = null;
        return client;
    })();
    return _connecting;
}
/** Always true — the stdio server is available on demand via npx. */
export function isLocalHooksServerAvailable() {
    return true;
}
/**
 * Call a gramatr tool via the local MCP stdio server.
 * Never throws — returns an isError result on failure so hooks degrade gracefully.
 */
export async function callTool(name, args) {
    try {
        const client = await getClient();
        const result = await client.callTool({ name, arguments: args });
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
 * No-op — session context is persisted to SQLite via setSessionContext in hook-state.ts.
 * Retained for call-site compatibility.
 */
export async function pushSessionContextToLocal(_ctx) {
    return false;
}
/**
 * No-op — callers fall through to remote REST hydration via hydrateSessionContextFromServer.
 * Retained for call-site compatibility.
 */
export async function pullSessionContextFromLocal(_sessionId) {
    return null;
}
//# sourceMappingURL=local-client.js.map