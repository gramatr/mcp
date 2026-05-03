/**
 * Platform-specific binary resolution for gramatr setup.
 *
 * build-all-targets.mjs compiles 5 platform binaries into dist/.
 * This module detects the current OS/arch and maps it to the correct
 * pre-compiled binary name so `gramatr setup` installs the right one.
 */
export interface PlatformBinaryResult {
    /** Filename of the pre-compiled binary (e.g. 'gramatr-linux-x64') */
    sourceName: string;
    /** Destination filename (e.g. 'gramatr' or 'gramatr.exe') */
    destName: string;
}
/**
 * Map process.platform + process.arch to the pre-compiled binary filename
 * produced by build-all-targets.mjs.
 *
 * Returns null if the current platform/arch combination is not supported.
 */
export declare function getPlatformBinaryName(platform?: string, arch?: string): PlatformBinaryResult | null;
export interface InstallBinaryOptions {
    /** Directory containing pre-compiled binaries (e.g. packages/mcp/dist/) */
    distDir: string;
    /** Target directory (e.g. ~/.gramatr/bin/) */
    destDir: string;
    /** Override platform detection for testing */
    platform?: string;
    /** Override arch detection for testing */
    arch?: string;
    /** If true, log actions but do not write */
    dryRun?: boolean;
}
export interface InstallBinaryResult {
    status: 'installed' | 'fallback' | 'skipped';
    message: string;
}
/**
 * Install the correct pre-compiled binary for the current platform.
 *
 * 1. Resolves the platform-specific binary name
 * 2. Checks if it exists in distDir
 * 3. Copies it atomically (write .new, then rename) to destDir
 * 4. Returns 'fallback' if the binary is not found (caller should
 *    fall back to npx @gramatr/mcp)
 */
export declare function installPlatformBinary(options: InstallBinaryOptions): InstallBinaryResult;
//# sourceMappingURL=platform.d.ts.map