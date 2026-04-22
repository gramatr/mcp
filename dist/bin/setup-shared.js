/**
 * setup-shared — Small shared utilities used across setup modules.
 *
 * Contains binary resolution and deployment (both no-ops in npx mode).
 */
// gramatr-allow: C1 — CLI entry point, reads HOME for config path
const HOME = process.env.HOME || process.env.USERPROFILE || '';
/**
 * Resolve the path to the gramatr binary.
 * Resolves the MCP server command — npx for first-run / CI, local install thereafter.
 */
export function resolveBinaryPath() {
    return { command: 'npx', args: ['-y', '@gramatr/mcp'] };
}
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
export function deployPlatformBinary(_dryRun = false) {
    // No-op: MCP server and hooks now use npx @gramatr/mcp (no compiled binary).
    // Compiled binaries are broken on macOS (Gatekeeper) and Windows (silent stdout).
    // Kept as a function so callers don't need updating.
    return true;
}
//# sourceMappingURL=setup-shared.js.map