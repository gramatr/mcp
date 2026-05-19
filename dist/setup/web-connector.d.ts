/**
 * Web Connector — setup utilities for hookless web clients.
 *
 * Web-based clients (claude.ai, ChatGPT web, Gemini web) cannot run a local
 * MCP server or hooks. Instead they connect directly to the hosted gramatr
 * MCP endpoint. This module generates:
 *
 *   1. Structured connector setup instructions (steps to add the MCP server)
 *   2. A copyable prompt suggestion block (paste into custom instructions)
 *   3. Server reachability validation
 */
export type AuthMethod = 'bearer' | 'oauth';
export interface ConnectorInstructionsOptions {
    /** MCP server URL. Defaults to production gramatr endpoint. */
    serverUrl?: string;
    /** Authentication method. Defaults to 'bearer' (API key). */
    authMethod?: AuthMethod;
    /** Target platform for tailored instructions. */
    target?: 'claude-web' | 'chatgpt-web' | 'gemini-web';
}
export interface ConnectorInstructions {
    /** The MCP server URL to enter in the web client. */
    serverUrl: string;
    /** Authentication method described in the steps. */
    authMethod: AuthMethod;
    /** Target platform. */
    target: string;
    /** Ordered setup steps for the user. */
    steps: string[];
    /** The server-card discovery URL. */
    serverCardUrl: string;
    /** Hosted markdown setup guide served by the MCP server. */
    setupGuideUrl: string;
}
export interface ReachabilityResult {
    /** Whether the server health endpoint responded successfully. */
    reachable: boolean;
    /** The URL that was checked. */
    serverUrl: string;
    /** Human-readable error if unreachable. */
    error?: string;
    /** HTTP status code if a response was received. */
    statusCode?: number;
}
export declare function buildConnectorInstructions(options?: ConnectorInstructionsOptions): ConnectorInstructions;
export declare function buildPromptSuggestion(target?: string): string;
export declare function buildServerCardUrl(mcpUrl: string): string;
export declare function buildSetupGuideUrl(mcpUrl: string, target: string): string;
export declare function validateServerReachability(serverUrl?: string): Promise<ReachabilityResult>;
//# sourceMappingURL=web-connector.d.ts.map