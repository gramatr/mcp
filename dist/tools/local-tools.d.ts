/**
 * Local tools — handled by the local MCP server.
 *
 * Most tools here are fully local (zero latency, zero network). Some, like
 * `resolve_project` and `objectives`, have special handling: they use local
 * state first and fall back (or pass through) to the remote server. These
 * tools must remain reachable via the local proxy even when GRAMATR_LOCAL_ONLY=1
 * (cloud addon active), because client hooks route through the local proxy.
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