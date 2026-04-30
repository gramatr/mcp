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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
// 24-hour TTL — projects don't change identity frequently
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// ── Cache class ───────────────────────────────────────────────────────────────
class ProjectCache {
    byRemote = new Map();
    byDirectory = new Map();
    bySlug = new Map();
    /** Add or update a project entry in all applicable index maps. */
    set(entry) {
        if (entry.gitRemote)
            this.byRemote.set(entry.gitRemote, entry);
        if (entry.directory)
            this.byDirectory.set(entry.directory, entry);
        this.bySlug.set(entry.slug, entry);
    }
    /** Look up by git remote URL. Returns null on cache miss or TTL expiry. */
    getByRemote(remote) {
        const entry = this.byRemote.get(remote);
        return entry && !this._isExpired(entry) ? entry : null;
    }
    /** Look up by working directory path. Returns null on cache miss or TTL expiry. */
    getByDirectory(dir) {
        const entry = this.byDirectory.get(dir);
        return entry && !this._isExpired(entry) ? entry : null;
    }
    /** Look up by project slug. Returns null on cache miss or TTL expiry. */
    getBySlug(slug) {
        const entry = this.bySlug.get(slug);
        return entry && !this._isExpired(entry) ? entry : null;
    }
    /**
     * Remove a project entry from all index maps by project ID.
     * Scans all maps — O(n) but the cache is small and invalidation is rare.
     */
    invalidate(id) {
        for (const [key, entry] of this.byRemote) {
            if (entry.id === id)
                this.byRemote.delete(key);
        }
        for (const [key, entry] of this.byDirectory) {
            if (entry.id === id)
                this.byDirectory.delete(key);
        }
        for (const [key, entry] of this.bySlug) {
            if (entry.id === id)
                this.bySlug.delete(key);
        }
    }
    /** Total number of unique project entries (by slug). */
    size() {
        return this.bySlug.size;
    }
    /**
     * Persist the cache to a JSON file on shutdown.
     * Silently skips on write errors — the cache is advisory only.
     */
    save(path) {
        try {
            const dir = dirname(path);
            if (!existsSync(dir))
                mkdirSync(dir, { recursive: true });
            // De-duplicate: slug map is canonical (every entry is in bySlug)
            const entries = [...this.bySlug.values()].filter((e) => !this._isExpired(e));
            writeFileSync(path, JSON.stringify(entries, null, 2), 'utf8');
        }
        catch {
            // Non-fatal — cache miss on next start is safe
        }
    }
    /**
     * Restore the cache from a JSON file on startup.
     * Silently skips on read/parse errors — cache starts empty.
     */
    load(path) {
        try {
            if (!existsSync(path))
                return;
            const raw = readFileSync(path, 'utf8');
            const entries = JSON.parse(raw);
            if (!Array.isArray(entries))
                return;
            for (const item of entries) {
                if (!isProjectEntry(item))
                    continue;
                if (this._isExpired(item))
                    continue;
                this.set(item);
            }
        }
        catch {
            // Non-fatal — cache starts empty
        }
    }
    _isExpired(entry) {
        return Date.now() - entry.cachedAt > CACHE_TTL_MS;
    }
}
// ── Type guard ────────────────────────────────────────────────────────────────
function isProjectEntry(v) {
    if (v === null || typeof v !== 'object')
        return false;
    const o = v;
    return (typeof o.id === 'string' &&
        typeof o.slug === 'string' &&
        typeof o.cachedAt === 'number' &&
        (o.gitRemote === null || typeof o.gitRemote === 'string') &&
        (o.directory === null || typeof o.directory === 'string'));
}
// ── Singleton ─────────────────────────────────────────────────────────────────
export const projectCache = new ProjectCache();
/**
 * Returns the filesystem path for the project cache JSON file.
 * Uses GRAMATR_DIR env override when available, otherwise ~/.gramatr/.
 */
export function getProjectCachePath() {
    const dir = getGramatrDirFromEnv() ?? join(getHomeDir(), '.gramatr');
    return join(dir, 'project-cache.json');
}
//# sourceMappingURL=project-cache.js.map