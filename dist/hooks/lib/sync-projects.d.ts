/**
 * sync-projects.ts — Client-side project sync heartbeat (#997).
 *
 * Fetches recently-updated projects from the server and upserts them into
 * the local SQLite cache. Called on session-start (always) and periodically
 * during active sessions (every 5 minutes).
 *
 * Graceful degradation: if the server is unreachable, skips silently.
 */
/** Periodic sync interval (ms). 5 minutes. */
export declare const SYNC_INTERVAL_MS: number;
/**
 * Fetch projects updated since the last sync from the server and upsert
 * them into the local SQLite cache.
 *
 * @returns Number of projects updated, or 0 on failure.
 */
export declare function syncProjectsFromServer(): Promise<number>;
/**
 * Start periodic project sync (every 5 minutes).
 * Safe to call multiple times — only one timer will be active.
 */
export declare function startPeriodicSync(): void;
/**
 * Stop periodic project sync. Primarily for tests.
 */
export declare function stopPeriodicSync(): void;
/**
 * Reset internal state. For tests only.
 */
export declare function _resetSyncState(): void;
//# sourceMappingURL=sync-projects.d.ts.map