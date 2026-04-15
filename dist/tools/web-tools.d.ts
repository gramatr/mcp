/**
 * Local web tools — handled in-process without round-tripping to the remote server.
 *
 * - gramatr_local_fetch: fetch a URL, return text content (with basic HTML stripping)
 * - gramatr_local_search: DuckDuckGo HTML search (no API key required)
 *
 * These are intentionally simple. For heavy scraping, use a dedicated service.
 */
import type { ToolCallResult } from '../proxy/tool-proxy.js';
import type { ToolDefinition } from '../proxy/tool-registry.js';
/**
 * Tool definitions for the web tools.
 */
export declare function getWebToolDefinitions(): ToolDefinition[];
/**
 * Check if a tool name is a web tool.
 */
export declare function isWebTool(name: string): boolean;
/**
 * Handle a web tool call.
 */
export declare function handleWebTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult>;
//# sourceMappingURL=web-tools.d.ts.map