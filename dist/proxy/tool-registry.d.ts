/**
 * Tool Registry — fetches tool definitions from the remote server
 * and registers them on the local MCP server.
 *
 * On startup, calls tools/list on the remote server and caches the
 * result. Each tool is registered on the local server with its
 * original inputSchema (Zod-validated by the remote, passed through
 * as JSON Schema for the local client to see).
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: Record<string, unknown>;
}
/**
 * Fetch and cache the remote tool list.
 * Called once at server startup.
 */
export declare function loadRemoteTools(): Promise<ToolDefinition[]>;
/**
 * Get the cached tool list (must call loadRemoteTools first).
 */
export declare function getTools(): ToolDefinition[];
/**
 * Check if a tool name is in the remote registry.
 */
export declare function isRemoteTool(name: string): boolean;
/**
 * Get the input schema for a specific tool (for local validation).
 */
export declare function getToolSchema(name: string): Record<string, unknown> | null;
//# sourceMappingURL=tool-registry.d.ts.map