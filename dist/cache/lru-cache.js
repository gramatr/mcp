/**
 * Simple in-memory LRU cache for reducing redundant remote round-trips.
 *
 * - Keyed by tool name + serialized args
 * - TTL-based expiration (default 60s)
 * - Evicts on mutation tools (create, update, delete, batch)
 * - Max 100 entries, LRU eviction when full
 * - Dies with the process — no persistence, no disk
 */
const DEFAULT_MAX_SIZE = 100;
const DEFAULT_TTL_MS = 60_000; // 60 seconds
/** Tools that mutate state — any call to these invalidates the entire cache. */
const MUTATION_TOOLS = new Set([
    'create_entity',
    'update_entity',
    'mark_entity_inactive',
    'reactivate_entity',
    'add_observation',
    'update_observation',
    'mark_observation_inactive',
    'create_relation',
    'batch_create_entities',
    'batch_add_observations',
    'batch_create_relations',
    'bulk_update_metadata',
    'change_embedding_model',
    // gramatr_ prefixed mutations
    'gramatr_save_diary',
    'gramatr_save_handoff',
    'gramatr_save_prd',
    'gramatr_save_reflection',
    'gramatr_submit_feedback',
    'gramatr_update_criteria',
    'gramatr_update_hard_problem',
    'gramatr_session_start',
    'gramatr_session_end',
    'gramatr_batch_save_turns',
    'gramatr_phase_transition',
    'gramatr_classification_feedback',
    'gramatr_generation_feedback',
    'gramatr_suggestion_feedback',
    'gramatr_groom_knowledge',
    'gramatr_maintain_state',
    'gramatr_compose_agent',
    'gramatr_create_api_key',
    'gramatr_revoke_api_key',
    'gramatr_onboard_user',
    'gramatr_classifier_manage',
]);
/** Tools that should never be cached (real-time or side-effectful). */
const UNCACHEABLE_TOOLS = new Set([
    'gramatr_doctor',
    'gramatr_get_metrics',
    'gramatr_route_request',
    'gramatr_execute_intent',
    'gramatr_summarize_turn',
    'gramatr_route_skills',
    'gramatr_invoke_agent',
    'gramatr_get_enrichment',
    'gramatr_competitive_position',
    'aggregate_stats',
]);
export class LRUCache {
    cache = new Map();
    maxSize;
    ttlMs;
    hits = 0;
    misses = 0;
    evictions = 0;
    constructor(maxSize = DEFAULT_MAX_SIZE, ttlMs = DEFAULT_TTL_MS) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }
    /**
     * Build a cache key from tool name + args.
     */
    key(toolName, args) {
        return `${toolName}:${JSON.stringify(args, Object.keys(args).sort())}`;
    }
    /**
     * Check if a tool call is cacheable.
     */
    isCacheable(toolName) {
        return !MUTATION_TOOLS.has(toolName) && !UNCACHEABLE_TOOLS.has(toolName);
    }
    /**
     * Check if a tool is a mutation (triggers cache invalidation).
     */
    isMutation(toolName) {
        return MUTATION_TOOLS.has(toolName);
    }
    /**
     * Get a cached result. Returns undefined on miss or expiry.
     */
    get(toolName, args) {
        const k = this.key(toolName, args);
        const entry = this.cache.get(k);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(k);
            this.misses++;
            return undefined;
        }
        // LRU: move to end (most recently used)
        this.cache.delete(k);
        this.cache.set(k, entry);
        this.hits++;
        return entry.value;
    }
    /**
     * Store a result in the cache.
     */
    set(toolName, args, value) {
        if (!this.isCacheable(toolName))
            return;
        const k = this.key(toolName, args);
        // Delete first to reset position in Map iteration order
        this.cache.delete(k);
        // Evict oldest if full
        while (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) {
                this.cache.delete(oldest);
                this.evictions++;
            }
        }
        this.cache.set(k, {
            value,
            expiresAt: Date.now() + this.ttlMs,
        });
    }
    /**
     * Clear the entire cache. Called on mutation tool calls.
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache statistics for the local status tool.
     */
    stats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttlMs: this.ttlMs,
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictions,
            hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%',
        };
    }
}
/** Singleton cache instance. */
export const cache = new LRUCache();
//# sourceMappingURL=lru-cache.js.map