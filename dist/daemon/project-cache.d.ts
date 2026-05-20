/**
 * project-cache.ts — In-process project identity cache for the gramatr daemon.
 *
 * The most expensive operation in session-start is resolving
 * `git remote → project_id`. This module caches the result in the daemon
 * process so repeated lookups are Map lookups (~0ms) rather than SQLite or
 * remote server calls.
 *
 * The cache is keyed on three lookup axes simultaneously:
 *   - git remote URL  (e.g. "git@github.com:org/repo.git")
 *   - working directory (e.g. "/home/user/work/myproject")
 *   - project slug    (e.g. "org/repo")
 *
 * On daemon start: restored from ~/.gramatr/project-cache.json (warm start).
 * On daemon shutdown: persisted to the same file.
 * Skip load/save when GRAMATR_STATE_DB === ':memory:' (test mode).
 */
export interface ProjectEntry {
    id: string;
    slug: string;
    gitRemote: string | null;
    directory: string | null;
    cachedAt: number;
}
declare class ProjectCache {
    private byRemote;
    private byDirectory;
    private bySlug;
    /** Add or update a project entry in all applicable index maps. */
    set(entry: ProjectEntry): void;
    /** Look up by git remote URL. Returns null on cache miss or TTL expiry. */
    getByRemote(remote: string): ProjectEntry | null;
    /** Look up by working directory path. Returns null on cache miss or TTL expiry. */
    getByDirectory(dir: string): ProjectEntry | null;
    /** Look up by project slug. Returns null on cache miss or TTL expiry. */
    getBySlug(slug: string): ProjectEntry | null;
    /**
     * Remove a project entry from all index maps by project ID.
     * Scans all maps — O(n) but the cache is small and invalidation is rare.
     */
    invalidate(id: string): void;
    /** Total number of unique project entries (by slug). */
    size(): number;
    /**
     * Persist the cache to a JSON file on shutdown.
     * Silently skips on write errors — the cache is advisory only.
     */
    save(path: string): void;
    /**
     * Restore the cache from a JSON file on startup.
     * Silently skips on read/parse errors — cache starts empty.
     */
    load(path: string): void;
    private _isExpired;
}
export declare const projectCache: ProjectCache;
/**
 * Returns the filesystem path for the project cache JSON file.
 * Uses GRAMATR_DIR env override when available, otherwise ~/.gramatr/.
 */
export declare function getProjectCachePath(): string;
export {};
//# sourceMappingURL=project-cache.d.ts.map