/**
 * sync-projects.ts — Client-side project sync heartbeat (#997).
 *
 * Fetches recently-updated projects from the server and upserts them into
 * the local SQLite cache. Called on session-start (always) and periodically
 * during active sessions (every 5 minutes).
 *
 * Graceful degradation: if the server is unreachable, skips silently.
 */
import { getServerUrl, getToken } from '../../server/auth.js';
import { upsertLocalProject } from './hook-state.js';
// ── Constants ────────────────────────────────────────────────────────────────
/** Sync request timeout (ms). */
const SYNC_TIMEOUT_MS = 5000;
/** Periodic sync interval (ms). 5 minutes. */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** SQLite key for last sync timestamp — stored as a project with a well-known ID. */
const SYNC_META_PROJECT_ID = '__sync_meta__';
const SYNC_META_SLUG = '__sync_meta__';
// ── Internal state ───────────────────────────────────────────────────────────
let _lastSyncAt = null;
let _periodicTimer = null;
// ── Core sync function ───────────────────────────────────────────────────────
/**
 * Fetch projects updated since the last sync from the server and upsert
 * them into the local SQLite cache.
 *
 * @returns Number of projects updated, or 0 on failure.
 */
export async function syncProjectsFromServer() {
    try {
        const serverUrl = getServerUrl();
        const token = getToken();
        // Build URL with optional since parameter
        const url = new URL(`${serverUrl}/api/v1/projects/sync`);
        if (_lastSyncAt) {
            url.searchParams.set('since', _lastSyncAt);
        }
        const headers = {
            Accept: 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(url.toString(), {
            headers,
            signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
        });
        if (!response.ok) {
            return 0;
        }
        const data = (await response.json());
        if (!data.projects || data.projects.length === 0) {
            // Update last sync even when there are no new projects
            if (data.synced_at) {
                _lastSyncAt = data.synced_at;
            }
            return 0;
        }
        // Upsert each project into local SQLite
        let updated = 0;
        for (const project of data.projects) {
            try {
                upsertLocalProject({
                    id: project.id,
                    slug: project.slug,
                    org_id: project.org_id,
                });
                updated++;
            }
            catch {
                // Non-critical — individual project upsert failure should not stop the rest
            }
        }
        // Record sync timestamp for next delta sync
        if (data.synced_at) {
            _lastSyncAt = data.synced_at;
        }
        return updated;
    }
    catch {
        // Graceful failure — server unreachable, network error, timeout
        return 0;
    }
}
// ── Periodic sync ────────────────────────────────────────────────────────────
/**
 * Start periodic project sync (every 5 minutes).
 * Safe to call multiple times — only one timer will be active.
 */
export function startPeriodicSync() {
    if (_periodicTimer)
        return;
    _periodicTimer = setInterval(() => {
        syncProjectsFromServer().catch(() => {
            // Silent — periodic sync is best-effort
        });
    }, SYNC_INTERVAL_MS);
    // Allow the process to exit even if the timer is running
    if (_periodicTimer && typeof _periodicTimer === 'object' && 'unref' in _periodicTimer) {
        _periodicTimer.unref();
    }
}
/**
 * Stop periodic project sync. Primarily for tests.
 */
export function stopPeriodicSync() {
    if (_periodicTimer) {
        clearInterval(_periodicTimer);
        _periodicTimer = null;
    }
}
/**
 * Reset internal state. For tests only.
 */
export function _resetSyncState() {
    _lastSyncAt = null;
    stopPeriodicSync();
}
//# sourceMappingURL=sync-projects.js.map