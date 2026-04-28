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
    //  prefixed mutations
    'save_diary',
    'save_handoff',
    'save_prd',
    'save_reflection',
    'submit_feedback',
    'update_criteria',
    'update_hard_problem',
    'session_start',
    'session_end',
    'batch_save_turns',
    'phase_transition',
    'classification_feedback',
    'generation_feedback',
    'suggestion_feedback',
    'groom_knowledge',
    'maintain_state',
    'compose_agent',
    'create_api_key',
    'revoke_api_key',
    'onboard_user',
    'classifier_manage',
]);
/** Tools that should never be cached (real-time or side-effectful). */
const UNCACHEABLE_TOOLS = new Set([
    'doctor',
    'get_metrics',
    'route_request',
    'execute_intent',
    'summarize_turn',
    'route_skills',
    'invoke_agent',
    'competitive_position',
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