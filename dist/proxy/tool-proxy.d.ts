/**
 * Tool Proxy — routes tool calls to local handlers, cache, or remote.
 *
 * Flow:
 *   1. Local tool? → handle locally (zero latency)
 *   2. Validate input against JSON Schema
 *   3. Ensure session is started (auto session_start)
 *   4. Cached? → return cached result
 *   5. Proxy to remote → post-process → cache result → return
 *   6. Mutation? → invalidate cache after success
 *   7. route_request? → auto-fetch Packet 2 if pending
 */
export interface ToolCallResult {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Route a tool call: local → cache → remote.
 * Validates input, manages sessions, auto-fetches Packet 2.
 * Returns the MCP tool response format.
 */
export declare function proxyToolCall(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult>;
//# sourceMappingURL=tool-proxy.d.ts.map