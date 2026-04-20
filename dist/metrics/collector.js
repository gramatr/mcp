/**
 * Simple in-process metrics collector.
 *
 * Tracks counters and latency distributions for the local MCP server.
 * No persistence — stats reset on process restart. Exposed via
 * gramatr_local_status so you can see usage patterns + performance.
 */
const MAX_SAMPLES = 500;
const counters = {
    calls: new Map(),
    latency: new Map(),
    cacheHits: 0,
    cacheMisses: 0,
    errors: new Map(),
};
/**
 * Record a tool call completion with its latency.
 */
export function recordCall(toolName, latencyMs, isError = false) {
    counters.calls.set(toolName, (counters.calls.get(toolName) ?? 0) + 1);
    if (isError) {
        counters.errors.set(toolName, (counters.errors.get(toolName) ?? 0) + 1);
        return;
    }
    let samples = counters.latency.get(toolName);
    if (!samples) {
        samples = { count: 0, total: 0, min: Number.MAX_SAFE_INTEGER, max: 0, recent: [] };
        counters.latency.set(toolName, samples);
    }
    samples.count++;
    samples.total += latencyMs;
    if (latencyMs < samples.min)
        samples.min = latencyMs;
    if (latencyMs > samples.max)
        samples.max = latencyMs;
    // Ring buffer for percentile estimation
    samples.recent.push(latencyMs);
    if (samples.recent.length > MAX_SAMPLES) {
        samples.recent.shift();
    }
}
/**
 * Record a cache hit.
 */
export function recordCacheHit() {
    counters.cacheHits++;
}
/**
 * Record a cache miss.
 */
export function recordCacheMiss() {
    counters.cacheMisses++;
}
/**
 * Compute a specific percentile from a sorted array.
 */
function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
    return sorted[idx];
}
/**
 * Get a snapshot of all metrics for reporting.
 */
export function getMetrics() {
    const totalCalls = Array.from(counters.calls.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(counters.errors.values()).reduce((a, b) => a + b, 0);
    const totalCache = counters.cacheHits + counters.cacheMisses;
    // Top 10 most-called tools with latency stats
    const topTools = Array.from(counters.calls.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, calls]) => {
        const s = counters.latency.get(name);
        if (!s || s.count === 0) {
            return {
                name,
                calls,
                avg_ms: 0,
                min_ms: 0,
                max_ms: 0,
                p50_ms: 0,
                p95_ms: 0,
                p99_ms: 0,
                errors: counters.errors.get(name) ?? 0,
            };
        }
        const sorted = [...s.recent].sort((a, b) => a - b);
        return {
            name,
            calls,
            avg_ms: Math.round(s.total / s.count),
            min_ms: s.min === Number.MAX_SAFE_INTEGER ? 0 : s.min,
            max_ms: s.max,
            p50_ms: percentile(sorted, 0.5),
            p95_ms: percentile(sorted, 0.95),
            p99_ms: percentile(sorted, 0.99),
            errors: counters.errors.get(name) ?? 0,
        };
    });
    return {
        cache: {
            hits: counters.cacheHits,
            misses: counters.cacheMisses,
            hit_rate: totalCache > 0 ? `${((counters.cacheHits / totalCache) * 100).toFixed(1)}%` : '0%',
        },
        top_tools: topTools,
        total_calls: totalCalls,
        total_errors: totalErrors,
    };
}
/**
 * Reset all metrics (used for testing).
 */
export function resetMetrics() {
    counters.calls.clear();
    counters.latency.clear();
    counters.errors.clear();
    counters.cacheHits = 0;
    counters.cacheMisses = 0;
}
//# sourceMappingURL=collector.js.map