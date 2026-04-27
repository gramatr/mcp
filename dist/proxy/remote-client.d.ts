/**
 * Remote MCP client — HTTP connection to api.gramatr.com/mcp.
 *
 * Uses native fetch with keepAlive for connection pooling.
 * All requests include the Bearer token from auth.ts.
 * Handles 401 by refreshing the token once and retrying.
 */
/**
 * Call a remote MCP tool via JSON-RPC over HTTP.
 */
export declare function callRemoteTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
/**
 * Fetch the remote tool list via tools/list.
 */
export declare function fetchRemoteToolList(): Promise<unknown>;
/**
 * Fetch the remote prompt list via prompts/list.
 */
export declare function fetchRemotePromptList(): Promise<unknown>;
/**
 * Fetch a specific prompt via prompts/get.
 */
export declare function fetchRemotePrompt(name: string, args?: Record<string, string>): Promise<unknown>;
/**
 * Fetch the remote resource list via resources/list.
 */
export declare function fetchRemoteResourceList(): Promise<unknown>;
/**
 * Read a specific resource via resources/read.
 */
export declare function fetchRemoteResource(uri: string): Promise<unknown>;
//# sourceMappingURL=remote-client.d.ts.map