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
import { type InstallLayout } from "./install-detect.js";
export type { InstallLayout };
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
 * never blocks longer than VERSION_FETCH_TIMEOUT_MS in the cache-miss path.
 */
export declare function runVersionCheckAndNotify(installedVersion: string, options?: {
    cachePath?: string;
    stream?: NodeJS.WritableStream;
}): Promise<VersionCheckResult | null>;
export interface AutoUpgradeResult {
    triggered: boolean;
    version: string;
    reason?: string;
    /** The detected install layout that determined the upgrade decision. */
    layout?: InstallLayout;
}
/**
 * Format the hint message shown when auto-upgrade is skipped because the
 * package was installed via `npm i -g` or via an unknown layout.
 *
 * Safe to call from any hook — no I/O, no side effects.
 */
export declare function formatUpgradeHint(installed: string, latest: string): string;
/**
 * Auto-upgrade gramatr when a newer version is available.
 *
 * Behaviour depends on the detected install layout:
 *
 *   'direct'     — Spawns `npx @gramatr/mcp@{version} install claude-code
 *                  --yes` as a detached background process. Files are written
 *                  to ~/.gramatr/. New hook code takes effect after restart.
 *   'npm-global' — Skips the background spawn entirely (writing to ~/.gramatr/
 *                  has no effect when the on-PATH binary is npm-managed). The
 *                  caller should surface formatUpgradeHint() instead.
 *   'unknown'    — Same as 'npm-global': skip, let caller surface the hint.
 *
 * Safety:
 *   - Layout detection runs before any I/O.
 *   - Lock file prevents concurrent upgrades (10min TTL).
 *   - --yes flag ensures non-interactive (no stdin prompts).
 *   - Detached + unref'd so the parent process can exit.
 *   - Never throws — returns result indicating what happened.
 */
export declare function autoUpgrade(latestVersion: string, options?: {
    stream?: NodeJS.WritableStream;
    lockPath?: string;
    /** Override layout detection for tests. Pass undefined to auto-detect. */
    layout?: InstallLayout;
    /** Override argv[1] for layout detection (used in tests). */
    argv1?: string;
}): AutoUpgradeResult;
//# sourceMappingURL=version-check.d.ts.map