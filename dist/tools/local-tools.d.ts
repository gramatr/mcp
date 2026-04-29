/**
 * Local-only tools — handled entirely by the local MCP server.
 * Never proxied to the remote. Zero latency, zero network.
 */
import type { ToolCallResult } from "../proxy/tool-proxy.js";
import type { ToolDefinition } from "../proxy/tool-registry.js";
/**
 * Local tool definitions — these get merged into tools/list alongside remote tools.
 */
export declare function getLocalToolDefinitions(): ToolDefinition[];
/**
 * Check if a tool name is handled locally (fully or local-first).
 */
export declare function isLocalTool(name: string): boolean;
/**
 * Handle a local tool call.
 */
export declare function handleLocalTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult>;
//# sourceMappingURL=local-tools.d.ts.map