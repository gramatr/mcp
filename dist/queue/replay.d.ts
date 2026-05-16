/**
 * Queue Replay — drains the offline queue by replaying mutations in order.
 *
 * Called on:
 *   1. Server startup (catch up on anything queued from last session)
 *   2. First successful remote call after a network failure
 *
 * Max 3 attempts per entry. Drops entries that keep failing.
 */
/**
 * Replay all queued calls. Idempotent — safe to call multiple times.
 * Returns counts of replayed and dropped entries.
 */
export declare function replayQueue(): Promise<{
    replayed: number;
    dropped: number;
    remaining: number;
}>;
//# sourceMappingURL=replay.d.ts.map