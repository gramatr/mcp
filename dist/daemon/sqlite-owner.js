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
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { getStateDatabasePath } from './db-path.js';
export class SqliteOwner {
    db = null;
    idleTimer = null;
    IDLE_CHECKPOINT_MS = 30_000;
    /**
     * Open the database connection and start the idle checkpoint interval.
     *
     * No-op when GRAMATR_STATE_DB=:memory:.
     */
    open() {
        const path = getStateDatabasePath();
        // Skip filesystem operations for in-memory test databases.
        if (path === ':memory:')
            return;
        // Ensure the parent directory exists.
        try {
            const dir = dirname(path);
            if (!existsSync(dir))
                mkdirSync(dir, { recursive: true });
        }
        catch {
            // Non-fatal — if we can't create the dir we'll fall through and let
            // DatabaseSync throw, which we also catch below.
        }
        try {
            this.db = new DatabaseSync(path);
            // Restrict permissions to owner-only — default umask may create 0644.
            try {
                chmodSync(path, 0o600);
            }
            catch { /* non-fatal */ }
            // Ensure WAL mode is set — safe to re-run if hook-state.ts already set it.
            this.db.exec('PRAGMA journal_mode = WAL');
            this.db.exec('PRAGMA synchronous = NORMAL');
            // Keep all TEMP objects (TEMP TABLEs, indices) in RAM — never written to disk.
            // This is the security boundary for sensitive ephemeral data such as composed
            // agent definitions: they live only in the daemon's address space and are
            // gone when the process exits. Nobody can read them from the .db file.
            this.db.exec('PRAGMA temp_store = MEMORY');
            // uuid_agents — composed agent definitions, RAM-only, daemon-lifetime.
            // Accessed exclusively through the IPC socket (agent/store, agent/get, agent/list).
            // Hook processes and external callers cannot read this table directly.
            this.db.exec(`
        CREATE TEMP TABLE IF NOT EXISTS uuid_agents (
          uuid        TEXT NOT NULL PRIMARY KEY,
          owner_id    TEXT NOT NULL,
          name        TEXT NOT NULL,
          definition  TEXT NOT NULL,
          created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          expires_at  TEXT,
          last_used   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          use_count   INTEGER NOT NULL DEFAULT 0
        )
      `);
        }
        catch (err) {
            // Non-fatal — daemon degrades without the checkpoint lifecycle.
            process.stderr.write(`[gramatr-daemon] sqlite-owner: failed to open ${path}: ${String(err)}\n`);
            this.db = null;
            return;
        }
        this.resetIdleTimer();
    }
    /**
     * Run PRAGMA wal_checkpoint(PASSIVE) — allows readers/writers to continue.
     * Pages are only checkpointed when no reader is blocking; safe to call anytime.
     */
    passiveCheckpoint() {
        if (!this.db)
            return;
        try {
            this.db.exec('PRAGMA wal_checkpoint(PASSIVE)');
        }
        catch {
            // Non-fatal — WAL file will be checkpointed on next opportunity.
        }
    }
    /**
     * Run PRAGMA wal_checkpoint(TRUNCATE) — waits for readers then zeroes the WAL.
     * Called on graceful shutdown to leave the DB in a clean state.
     */
    truncateCheckpoint() {
        if (!this.db)
            return;
        try {
            this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        }
        catch {
            // Non-fatal — passive checkpoint already ran; truncate is best-effort.
        }
    }
    /**
     * Reset (restart) the 30-second idle passive-checkpoint interval.
     * Call this on any activity (new connection, session register/release, context set).
     */
    resetIdleTimer() {
        if (this.idleTimer !== null) {
            clearInterval(this.idleTimer);
            this.idleTimer = null;
        }
        if (!this.db)
            return;
        this.idleTimer = setInterval(() => {
            this.passiveCheckpoint();
        }, this.IDLE_CHECKPOINT_MS);
        // setInterval keeps the event loop alive — unref so it doesn't prevent exit.
        if (typeof this.idleTimer === 'object' && this.idleTimer !== null && 'unref' in this.idleTimer) {
            this.idleTimer.unref();
        }
    }
    /**
     * Run a TRUNCATE checkpoint then close the connection.
     * Called in gracefulShutdown() before the process exits.
     */
    close() {
        if (this.idleTimer !== null) {
            clearInterval(this.idleTimer);
            this.idleTimer = null;
        }
        this.truncateCheckpoint();
        try {
            this.db?.close();
        }
        catch {
            // Non-fatal — process is exiting anyway.
        }
        this.db = null;
    }
    /**
     * Expose the underlying DatabaseSync for direct SQL in server.ts handlers.
     * Returns null when the DB is not open (memory mode or open() failed).
     */
    getDb() {
        return this.db;
    }
}
/** Module singleton — imported by server.ts and index.ts. */
export const sqliteOwner = new SqliteOwner();
//# sourceMappingURL=sqlite-owner.js.map