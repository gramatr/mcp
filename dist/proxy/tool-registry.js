/**
 * Tool Registry — fetches tool definitions from the remote server
 * and registers them on the local MCP server.
 *
 * On startup, calls tools/list on the remote server and caches the
 * result. Each tool is registered on the local server with its
 * original inputSchema (Zod-validated by the remote, passed through
 * as JSON Schema for the local client to see).
 */
import { fetchRemoteToolList } from './remote-client.js';
let cachedTools = null;
/**
 * Fetch and cache the remote tool list.
 * Called once at server startup.
 */
export async function loadRemoteTools() {
    if (cachedTools)
        return cachedTools;
    const result = (await fetchRemoteToolList());
    const tools = result?.tools || [];
    cachedTools = tools.map((t) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
        annotations: t.annotations,
    }));
    return cachedTools;
}
/**
 * Get the cached tool list (must call loadRemoteTools first).
 */
export function getTools() {
    return cachedTools || [];
}
/**
 * Check if a tool name is in the remote registry.
 */
export function isRemoteTool(name) {
    return getTools().some((t) => t.name === name);
}
/**
 * Get the input schema for a specific tool (for local validation).
 */
export function getToolSchema(name) {
    const tool = getTools().find((t) => t.name === name);
    return tool?.inputSchema || null;
}
//# sourceMappingURL=tool-registry.js.map