/**
 * install-detect.ts — detect how gramatr was installed.
 *
 * Distinguishes three layouts:
 *   - 'npm-global'  — binary lives under an npm global prefix
 *                     (e.g. /usr/local/lib/node_modules, ~/.npm-global/lib/…)
 *   - 'direct'      — binary lives under ~/.gramatr/ (direct install)
 *   - 'unknown'     — neither pattern matched
 *
 * Design constraints:
 *   - Never throws. Returns 'unknown' on any error.
 *   - Zero runtime dependencies beyond Node built-ins.
 *   - Works on Linux, macOS, Windows.
 *   - Fully injectable for unit tests (all I/O via options).
 */
export type InstallLayout = "npm-global" | "direct" | "unknown";
export interface DetectInstallLayoutOptions {
    /**
     * Override the running binary path (default: process.argv[1]).
     * In tests, pass a synthetic path to simulate different layouts.
     */
    argv1?: string;
    /**
     * Override the home directory (default: os.homedir()).
     */
    home?: string;
    /**
     * Override npm global prefix candidates.
     * Defaults to a set of well-known platform-specific paths.
     */
    npmGlobalPrefixes?: string[];
}
/**
 * Detect the install layout based on the running binary's path.
 *
 * Strategy:
 *   1. Resolve process.argv[1] to an absolute path.
 *   2. If it starts with ~/.gramatr/ → 'direct'
 *   3. If it starts with any npm global prefix candidate → 'npm-global'
 *      We also accept paths that contain '/lib/node_modules/' or
 *      '/node_modules/.bin/' which are reliable npm-global fingerprints,
 *      regardless of the prefix root.
 *   4. Otherwise → 'unknown'
 */
export declare function detectInstallLayout(options?: DetectInstallLayoutOptions): InstallLayout;
//# sourceMappingURL=install-detect.d.ts.map