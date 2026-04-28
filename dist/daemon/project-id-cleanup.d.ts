/**
 * project-id-cleanup.ts — Resolve slug-format project_id values in state.db.
 *
 * Issue #1504 — the PostgreSQL entities table is clean (project-id-cleanup.ts
 * in @gramatr/persistence handles that). This module handles the client-side
 * SQLite store (state.db): session_context, session_log, and orchestration
 * tables that were written before or during the UUID migration and may still
 * carry slug-format project_id values.
 *
 * Runs once at daemon startup, fire-and-forget. Safe to interrupt.
 * Idempotent — UUID rows are skipped; only slugs are processed.
 */
import type { DatabaseSync } from 'node:sqlite';
interface CleanupResult {
    session_context: {
        checked: number;
        updated: number;
    };
    session_log: {
        checked: number;
        updated: number;
    };
    orchestration_tasks: {
        checked: number;
        updated: number;
    };
    skipped_slugs: string[];
}
/**
 * Scan state.db tables for slug project_id values and resolve them to UUIDs.
 *
 * Uses the daemon's owned DB connection (passed in) to avoid competing with
 * the hook-state.ts connection.
 */
export declare function runProjectIdCleanup(db: DatabaseSync, callRemote: (name: string, args: Record<string, unknown>) => Promise<unknown>): Promise<CleanupResult>;
export {};
//# sourceMappingURL=project-id-cleanup.d.ts.map