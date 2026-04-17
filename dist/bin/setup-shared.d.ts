/**
 * setup-shared — Small shared utilities used across setup modules.
 *
 * Contains binary resolution and deployment (both no-ops in npx mode).
 */
/**
 * Resolve the path to the gramatr binary.
 * Prefers the compiled Bun binary at ~/.gramatr/bin/gramatr (self-contained,
 * no Node version dependency). Falls back to npx for first-run / not-yet-installed.
 */
export declare function resolveBinaryPath(): {
    command: string;
    args: string[];
};
/**
 * Deploy the correct platform-specific pre-compiled binary to ~/.gramatr/bin/.
 *
 * Checks for platform-specific binaries (e.g. gramatr-linux-x64) in the package
 * dist/ directory, then falls back to the generic 'gramatr' binary from
 * build-binary.mjs. If neither exists, logs a warning and returns false so the
 * caller can fall back to npx.
 *
 * Uses atomic copy (write to .new, then rename) to avoid partial-binary issues.
 */
export declare function deployPlatformBinary(_dryRun?: boolean): boolean;
//# sourceMappingURL=setup-shared.d.ts.map