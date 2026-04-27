/**
 * Simple in-memory LRU cache for reducing redundant remote round-trips.
 *
 * - Keyed by tool name + serialized args
 * - TTL-based expiration (default 60s)
 * - Evicts on mutation tools (create, update, delete, batch)
 * - Max 100 entries, LRU eviction when full
 * - Dies with the process — no persistence, no disk
 */
export declare class LRUCache {
    private cache;
    private maxSize;
    private ttlMs;
    private hits;
    private misses;
    private evictions;
    constructor(maxSize?: number, ttlMs?: number);
    /**
     * Build a cache key from tool name + args.
     */
    private key;
    /**
     * Check if a tool call is cacheable.
     */
    isCacheable(toolName: string): boolean;
    /**
     * Check if a tool is a mutation (triggers cache invalidation).
     */
    isMutation(toolName: string): boolean;
    /**
     * Get a cached result. Returns undefined on miss or expiry.
     */
    get(toolName: string, args: Record<string, unknown>): unknown | undefined;
    /**
     * Store a result in the cache.
     */
    set(toolName: string, args: Record<string, unknown>, value: unknown): void;
    /**
     * Clear the entire cache. Called on mutation tool calls.
     */
    clear(): void;
    /**
     * Get cache statistics for the local status tool.
     */
    stats(): {
        size: number;
        maxSize: number;
        ttlMs: number;
        hits: number;
        misses: number;
        evictions: number;
        hitRate: string;
    };
}
/** Singleton cache instance. */
export declare const cache: LRUCache;
//# sourceMappingURL=lru-cache.d.ts.map