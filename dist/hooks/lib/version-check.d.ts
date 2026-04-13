/**
 * version-check.ts — opportunistic npm registry version check.
 *
 * Queries https://registry.npmjs.org/gramatr/latest on a 3s timeout, caches
 * the result for one hour under ~/.gramatr/.cache/version-check.json, and
 * reports whether the installed client is behind the published version.
 *
 * Design constraints (see issue #468 sibling work):
 *   - Never throws. Any failure returns null and the caller proceeds normally.
 *   - Never writes to stdout — stdout is Claude Code's context channel.
 *   - Fast cache-hit path (no network, no heavy work).
 *   - Zero new runtime dependencies. Uses global fetch (Node 18+).
 */
export interface VersionCheckResult {
    latestVersion: string;
    installedVersion: string;
    isOutdated: boolean;
    cached: boolean;
}
/**
 * Compare two semver-style version strings ("X.Y.Z").
 * Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 *
 * Non-numeric or missing segments are treated as 0.
 */
export declare function compareVersions(a: string, b: string): number;
export declare function getCachePath(home?: string): string;
/**
 * Check the installed version against the latest published on npm.
 * Returns null on any failure — callers must treat this as optional.
 */
export declare function checkLatestVersion(installedVersion: string, options?: {
    cachePath?: string;
    now?: number;
}): Promise<VersionCheckResult | null>;
/**
 * Record that the user has been notified for a given latest version.
 * Suppresses repeat notifications until a newer version is published.
 */
export declare function markNotified(latestVersion: string, cachePath?: string): void;
export declare function shouldNotify(result: VersionCheckResult, cachePath?: string): boolean;
/**
 * Format the upgrade notification banner. Caller decides where to write it
 * (must be stderr — stdout is reserved for Claude context).
 */
export declare function formatUpgradeNotification(installed: string, latest: string): string;
/**
 * One-shot helper for hooks: check and, if appropriate, print the
 * notification to stderr. Safe to call from any hook — never throws,
 * never blocks longer than FETCH_TIMEOUT_MS in the cache-miss path.
 */
export declare function runVersionCheckAndNotify(installedVersion: string, options?: {
    cachePath?: string;
    stream?: NodeJS.WritableStream;
}): Promise<VersionCheckResult | null>;
export interface AutoUpgradeResult {
    triggered: boolean;
    version: string;
    reason?: string;
}
/**
 * Auto-upgrade gramatr when a newer version is available.
 *
 * Spawns `npx @gramatr/client@{version} install claude-code --yes` as a
 * detached background process. The install is idempotent: copies files to
 * ~/.gramatr/, merges hooks into ~/.claude/settings.json, re-registers MCP.
 * Existing auth token and URL are preserved (merge, not overwrite).
 *
 * The upgrade runs in the background so it doesn't block session start.
 * New hook code won't take effect until the user restarts Claude Code.
 *
 * Safety:
 *   - Lock file prevents concurrent upgrades (10min TTL)
 *   - --yes flag ensures non-interactive (no stdin prompts)
 *   - Detached + unref'd so the parent process can exit
 *   - Never throws — returns result indicating what happened
 */
export declare function autoUpgrade(latestVersion: string, options?: {
    stream?: NodeJS.WritableStream;
    lockPath?: string;
}): AutoUpgradeResult;
//# sourceMappingURL=version-check.d.ts.map