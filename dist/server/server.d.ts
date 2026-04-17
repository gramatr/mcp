/**
 * grāmatr Local MCP Server
 *
 * A stdio-based MCP server that proxies all remote gramatr tools, prompts,
 * and resources with local auth injection, input validation, and LRU caching.
 *
 * Features:
 *   - Proxy all remote gramatr tools with auth injection
 *   - Proxy remote prompts (server-defined prompt templates)
 *   - Proxy remote resources
 *   - JSON Schema input validation (fail-fast on bad args)
 *   - LRU cache (100 entries, 60s TTL, mutation invalidation)
 *   - Auto session manager (session_start on first call, session_end on exit)
 *   - Packet 2 auto-fetch for gramatr_route_request
 *   - Offline queue with replay (mutations persist across restarts)
 *   - Local-only tools: status, config, clear_cache, metrics, web_fetch, web_search
 *   - In-process metrics: call counts, latency percentiles, cache hit rate
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
/**
 * Create and configure the MCP server.
 */
export declare function createServer(): Server;
/**
 * Start the server: load tools, prompts, resources from remote, then listen on stdio.
 */
export declare function startServer(): Promise<void>;
//# sourceMappingURL=server.d.ts.map