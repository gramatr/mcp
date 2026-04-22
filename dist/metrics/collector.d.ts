/**
 * Simple in-process metrics collector.
 *
 * Tracks counters and latency distributions for the local MCP server.
 * No persistence — stats reset on process restart. Exposed via
 * gramatr_local_status so you can see usage patterns + performance.
 */
/**
 * Record a tool call completion with its latency.
 */
export declare function recordCall(toolName: string, latencyMs: number, isError?: boolean): void;
/**
 * Record a cache hit.
 */
export declare function recordCacheHit(): void;
/**
 * Record a cache miss.
 */
export declare function recordCacheMiss(): void;
interface ToolStats {
    calls: number;
    avg_ms: number;
    min_ms: number;
    max_ms: number;
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    errors: number;
}
interface MetricsSummary {
    cache: {
        hits: number;
        misses: number;
        hit_rate: string;
    };
    top_tools: Array<{
        name: string;
    } & ToolStats>;
    total_calls: number;
    total_errors: number;
}
/**
 * Get a snapshot of all metrics for reporting.
 */
export declare function getMetrics(): MetricsSummary;
/**
 * Reset all metrics (used for testing).
 */
export declare function resetMetrics(): void;
export {};
//# sourceMappingURL=collector.d.ts.map