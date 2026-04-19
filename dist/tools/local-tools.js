/**
 * Local-only tools — handled entirely by the local MCP server.
 * Never proxied to the remote. Zero latency, zero network.
 */
import { cache } from '../cache/lru-cache.js';
import { getTools } from '../proxy/tool-registry.js';
import { getToken, getServerUrl } from '../server/auth.js';
import { getSessionId, getToolCallCount } from '../intelligence/session-manager.js';
import { queueSize } from '../queue/offline-queue.js';
import { getWebToolDefinitions, isWebTool, handleWebTool } from './web-tools.js';
import { getMetrics, resetMetrics } from '../metrics/collector.js';
import { VERSION } from '../hooks/lib/version.js';
/**
 * Local tool definitions — these get merged into tools/list alongside remote tools.
 */
export function getLocalToolDefinitions() {
    return [
        {
            name: 'gramatr_local_status',
            description: 'Show local MCP server status: cache stats, auth state, remote tool count, uptime, metrics summary.',
            inputSchema: { type: 'object', properties: {} },
            annotations: { readOnlyHint: true },
        },
        {
            name: 'gramatr_local_clear_cache',
            description: 'Clear the local LRU cache. Use after bulk mutations or when stale data is suspected.',
            inputSchema: { type: 'object', properties: {} },
        },
        {
            name: 'gramatr_local_config',
            description: 'Show current local MCP server configuration: auth source, server URL, cache settings.',
            inputSchema: { type: 'object', properties: {} },
            annotations: { readOnlyHint: true },
        },
        {
            name: 'gramatr_local_metrics',
            description: 'Show per-tool call counts, latency distributions (p50/p95/p99), cache hit rate, errors.',
            inputSchema: {
                type: 'object',
                properties: {
                    reset: { type: 'boolean', description: 'Reset metrics to zero after reading (default false).' },
                },
            },
            annotations: { readOnlyHint: true },
        },
        ...getWebToolDefinitions(),
    ];
}
const startTime = Date.now();
/**
 * Check if a tool name is a local-only tool.
 */
export function isLocalTool(name) {
    return name.startsWith('gramatr_local_');
}
/**
 * Handle a local tool call.
 */
export async function handleLocalTool(toolName, args) {
    // Web tools are async (network calls)
    if (isWebTool(toolName)) {
        return handleWebTool(toolName, args);
    }
    switch (toolName) {
        case 'gramatr_local_status':
            return handleStatus();
        case 'gramatr_local_clear_cache':
            return handleClearCache();
        case 'gramatr_local_config':
            return handleConfig();
        case 'gramatr_local_metrics':
            return handleMetrics(args);
        default:
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: `Unknown local tool: ${toolName}` }) }],
                isError: true,
            };
    }
}
function handleStatus() {
    const uptimeMs = Date.now() - startTime;
    const uptimeMin = Math.floor(uptimeMs / 60_000);
    const cacheStats = cache.stats();
    const remoteToolCount = getTools().length;
    const hasAuth = !!getToken();
    const sid = getSessionId();
    const metrics = getMetrics();
    const status = {
        server: {
            name: 'gramatr-mcp',
            version: VERSION,
            uptime: uptimeMin < 60
                ? `${uptimeMin}m`
                : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`,
            transport: 'stdio',
        },
        session: {
            id: sid ? `${sid.substring(0, 8)}...` : null,
            tool_calls: getToolCallCount(),
        },
        auth: {
            authenticated: hasAuth,
            server_url: getServerUrl(),
        },
        tools: {
            remote: remoteToolCount,
            local: getLocalToolDefinitions().length,
            total: remoteToolCount + getLocalToolDefinitions().length,
        },
        cache: cacheStats,
        offline_queue: {
            pending: queueSize(),
        },
        metrics: {
            total_calls: metrics.total_calls,
            total_errors: metrics.total_errors,
            cache_hit_rate: metrics.cache.hit_rate,
        },
    };
    return {
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
    };
}
function handleClearCache() {
    const before = cache.stats().size;
    cache.clear();
    return {
        content: [{ type: 'text', text: JSON.stringify({ cleared: before, message: `Cleared ${before} cached entries.` }) }],
    };
}
function handleConfig() {
    const hasToken = !!getToken();
    const config = {
        auth: {
            source: hasToken ? '~/.gramatr.json' : 'none',
            has_token: hasToken,
        },
        remote: {
            server_url: getServerUrl(),
            endpoint: `${getServerUrl()}/mcp`,
        },
        cache: {
            max_size: cache.stats().maxSize,
            ttl_ms: cache.stats().ttlMs,
            current_size: cache.stats().size,
        },
        transport: 'stdio',
    };
    return {
        content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
    };
}
function handleMetrics(args) {
    const snapshot = getMetrics();
    if (args.reset === true) {
        resetMetrics();
    }
    return {
        content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }],
    };
}
//# sourceMappingURL=local-tools.js.map