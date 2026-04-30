/**
 * Remote MCP client — HTTP connection to api.gramatr.com/mcp.
 *
 * Uses native fetch with keepAlive for connection pooling.
 * All requests include the Bearer token from auth.ts.
 * Handles 401 by refreshing the token once and retrying.
 */
export interface SessionContext {
    sessionId?: string | null;
    projectId?: string | null;
}
/**
 * Call a remote MCP tool via JSON-RPC over HTTP.
 */
export declare function callRemoteTool(toolName: string, args: Record<string, unknown>, sessionContext?: SessionContext): Promise<unknown>;
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
export interface CurrentUser {
    user_id: string;
    actor_role: 'user' | 'team_admin' | 'org_admin' | 'high_admin';
    entitlement_level: 'individual' | 'team' | 'enterprise' | 'api';
}
/**
 * Fetch the authenticated user's role and entitlement level from the REST API.
 *
 * Uses the same auth token as MCP JSON-RPC calls but hits the REST endpoint
 * directly (not via MCP JSON-RPC). Returns null on any failure — never throws.
 * Timeout: 5000ms.
 */
export declare function fetchCurrentUser(): Promise<CurrentUser | null>;
//# sourceMappingURL=remote-client.d.ts.map