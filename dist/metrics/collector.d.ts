/**
 * Simple in-process metrics collector.
 *
 * Tracks counters and latency distributions for the local MCP server.
 * No persistence — stats reset on process restart. Exposed via
 * local_status so you can see usage patterns + performance.
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
/**
 * Record one call to a required-action enrichment tool. `status` should be
 * the value returned in the tool response (`ready`, `generating`, `failed`,
 * `not_needed`); unknown values are stored verbatim so we can spot drift.
 */
export declare function recordRequiredActionCall(tool: string, status: string): void;
/**
 * Record the byte size of the latest `<gramatr-classification>` injection.
 * Used to verify the lean-packet shape is actually smaller in practice.
 */
export declare function recordInjectionSize(bytes: number): void;
export interface ComplianceMetricsSnapshot {
    required_action_calls: Record<string, number>;
    enrichment_cache_hit_ratio: Record<string, {
        hits: number;
        misses: number;
        ratio: string;
    }>;
    injection_size_bytes: {
        last: number;
        avg: number;
        count: number;
    };
}
/**
 * Snapshot the compliance / cache telemetry. Read by local_status / tests.
 */
export declare function getComplianceMetrics(): ComplianceMetricsSnapshot;
export {};
//# sourceMappingURL=collector.d.ts.map