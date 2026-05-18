/**
 * Simple in-process metrics collector.
 *
 * Tracks counters and latency distributions for the local MCP server.
 * No persistence — stats reset on process restart. Exposed via
 * local_status so you can see usage patterns + performance.
 */
const MAX_SAMPLES = 500;
const counters = {
    calls: new Map(),
    latency: new Map(),
    cacheHits: 0,
    cacheMisses: 0,
    errors: new Map(),
    requiredActionCalls: new Map(),
    enrichmentHits: new Map(),
    enrichmentMisses: new Map(),
    injectionBytesTotal: 0,
    injectionCount: 0,
    injectionBytesLast: 0,
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
    counters.requiredActionCalls.clear();
    counters.enrichmentHits.clear();
    counters.enrichmentMisses.clear();
    counters.injectionBytesTotal = 0;
    counters.injectionCount = 0;
    counters.injectionBytesLast = 0;
}
// ── #2658 — lean-packet compliance & cache telemetry ──
/**
 * Record one call to a required-action enrichment tool. `status` should be
 * the value returned in the tool response (`ready`, `generating`, `failed`,
 * `not_needed`); unknown values are stored verbatim so we can spot drift.
 */
export function recordRequiredActionCall(tool, status) {
    const key = `${tool}|${status}`;
    counters.requiredActionCalls.set(key, (counters.requiredActionCalls.get(key) ?? 0) + 1);
    // Map tool → enrichment "kind" for the cache-hit-ratio metric.
    const kind = toEnrichmentKind(tool);
    if (!kind)
        return;
    if (status === "ready" || status === "not_needed") {
        counters.enrichmentHits.set(kind, (counters.enrichmentHits.get(kind) ?? 0) + 1);
    }
    else if (status === "generating" || status === "failed") {
        counters.enrichmentMisses.set(kind, (counters.enrichmentMisses.get(kind) ?? 0) + 1);
    }
}
function toEnrichmentKind(tool) {
    // PR-4 (#2761) — get_reverse_engineering and get_quality_gates branches
    // are dead post-cutover (replaced by gramatr://enrichment/<ref_id>/* reads);
    // kept here for transitional rollouts where older clients may still emit
    // the deprecated tool names against an older server.
    if (tool.endsWith("get_reverse_engineering"))
        return "reverse_engineering";
    if (tool.endsWith("get_quality_gates"))
        return "quality_gates";
    if (tool.endsWith("add_quality_gate_criteria"))
        return "quality_gates";
    if (tool.endsWith("get_composed_agent"))
        return "composed_agent";
    return null;
}
/**
 * Record the byte size of the latest `<gramatr-classification>` injection.
 * Used to verify the lean-packet shape is actually smaller in practice.
 */
export function recordInjectionSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0)
        return;
    counters.injectionBytesLast = bytes;
    counters.injectionBytesTotal += bytes;
    counters.injectionCount += 1;
}
/**
 * Snapshot the compliance / cache telemetry. Read by local_status / tests.
 */
export function getComplianceMetrics() {
    const reqOut = {};
    for (const [k, v] of counters.requiredActionCalls.entries())
        reqOut[k] = v;
    const ratioOut = {};
    const kinds = new Set([
        ...counters.enrichmentHits.keys(),
        ...counters.enrichmentMisses.keys(),
    ]);
    for (const kind of kinds) {
        const hits = counters.enrichmentHits.get(kind) ?? 0;
        const misses = counters.enrichmentMisses.get(kind) ?? 0;
        const total = hits + misses;
        ratioOut[kind] = {
            hits,
            misses,
            ratio: total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : "0%",
        };
    }
    return {
        required_action_calls: reqOut,
        enrichment_cache_hit_ratio: ratioOut,
        injection_size_bytes: {
            last: counters.injectionBytesLast,
            avg: counters.injectionCount > 0
                ? Math.round(counters.injectionBytesTotal / counters.injectionCount)
                : 0,
            count: counters.injectionCount,
        },
    };
}
//# sourceMappingURL=collector.js.map