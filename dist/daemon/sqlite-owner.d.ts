/**
 * sqlite-owner.ts — The daemon's owned SQLite connection.
 *
 * The daemon holds the single long-lived DatabaseSync connection to
 * ~/.gramatr/state.db. It is NOT an exclusive lock — hook processes can
 * still open WAL-mode concurrent readers/writers. The daemon becomes the
 * one reliable checkpointer because short-lived hook processes exit before
 * running checkpoints themselves (fix for #1296).
 *
 * Checkpoint lifecycle:
 *   PASSIVE  — every 30 s of idle (no active sessions; timer resets on activity)
 *   TRUNCATE — on graceful shutdown (SIGTERM, SIGINT, idle-empty)
 *
 * When GRAMATR_STATE_DB=:memory: (tests), open() and checkpoints are skipped.
 */
import { DatabaseSync } from 'node:sqlite';
export declare class SqliteOwner {
    private db;
    private idleTimer;
    private readonly IDLE_CHECKPOINT_MS;
    /**
     * Open the database connection and start the idle checkpoint interval.
     *
     * No-op when GRAMATR_STATE_DB=:memory:.
     */
    open(): void;
    /**
     * Run PRAGMA wal_checkpoint(PASSIVE) — allows readers/writers to continue.
     * Pages are only checkpointed when no reader is blocking; safe to call anytime.
     */
    passiveCheckpoint(): void;
    /**
     * Run PRAGMA wal_checkpoint(TRUNCATE) — waits for readers then zeroes the WAL.
     * Called on graceful shutdown to leave the DB in a clean state.
     */
    truncateCheckpoint(): void;
    /**
     * Reset (restart) the 30-second idle passive-checkpoint interval.
     * Call this on any activity (new connection, session register/release, context set).
     */
    resetIdleTimer(): void;
    /**
     * Run a TRUNCATE checkpoint then close the connection.
     * Called in gracefulShutdown() before the process exits.
     */
    close(): void;
    /**
     * Expose the underlying DatabaseSync for direct SQL in server.ts handlers.
     * Returns null when the DB is not open (memory mode or open() failed).
     */
    getDb(): DatabaseSync | null;
}
/** Module singleton — imported by server.ts and index.ts. */
export declare const sqliteOwner: SqliteOwner;
//# sourceMappingURL=sqlite-owner.d.ts.map