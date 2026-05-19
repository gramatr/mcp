/**
 * db-path.ts — Canonical path resolver for the gramatr state database.
 *
 * Extracted from hook-state.ts so both the daemon (sqlite-owner.ts) and
 * hook processes (hook-state.ts) resolve the path identically.
 *
 * Resolution order:
 *   1. GRAMATR_STATE_DB env var — absolute override (supports ':memory:' in tests)
 *   2. GRAMATR_DIR env var + 'state.db'
 *   3. HOME (or USERPROFILE on Windows) + '.gramatr/state.db'
 */
/**
 * Returns the absolute path to the gramatr state database.
 *
 * Returns ':memory:' when GRAMATR_STATE_DB=:memory: is set — callers that
 * skip filesystem operations (daemon sentinel, checkpoint PRAGMAs) should
 * check for this value before doing anything that requires a real file.
 */
export declare function getStateDatabasePath(): string;
//# sourceMappingURL=db-path.d.ts.map