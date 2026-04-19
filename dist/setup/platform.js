/**
 * Platform-specific binary resolution for gramatr setup.
 *
 * build-all-targets.mjs compiles 5 platform binaries into dist/.
 * This module detects the current OS/arch and maps it to the correct
 * pre-compiled binary name so `gramatr setup` installs the right one.
 */
import { existsSync, copyFileSync, renameSync, mkdirSync, chmodSync } from 'node:fs';
import { join, } from 'node:path';
/**
 * Map process.platform + process.arch to the pre-compiled binary filename
 * produced by build-all-targets.mjs.
 *
 * Returns null if the current platform/arch combination is not supported.
 */
export function getPlatformBinaryName(platform = process.platform, arch = process.arch) {
    const isWindows = platform === 'win32';
    const destName = isWindows ? 'gramatr.exe' : 'gramatr';
    switch (platform) {
        case 'darwin':
            if (arch === 'arm64')
                return { sourceName: 'gramatr-darwin-arm64', destName };
            if (arch === 'x64')
                return { sourceName: 'gramatr-darwin-x64', destName };
            return null;
        case 'linux':
            if (arch === 'x64')
                return { sourceName: 'gramatr-linux-x64', destName };
            if (arch === 'arm64')
                return { sourceName: 'gramatr-linux-arm64', destName };
            return null;
        case 'win32':
            if (arch === 'x64')
                return { sourceName: 'gramatr-windows-x64.exe', destName };
            return null;
        default:
            return null;
    }
}
/**
 * Install the correct pre-compiled binary for the current platform.
 *
 * 1. Resolves the platform-specific binary name
 * 2. Checks if it exists in distDir
 * 3. Copies it atomically (write .new, then rename) to destDir
 * 4. Returns 'fallback' if the binary is not found (caller should
 *    fall back to local bun build --compile)
 */
export function installPlatformBinary(options) {
    const { distDir, destDir, dryRun = false } = options;
    const platform = options.platform ?? process.platform;
    const arch = options.arch ?? process.arch;
    const binaryInfo = getPlatformBinaryName(platform, arch);
    if (!binaryInfo) {
        return {
            status: 'fallback',
            message: `Unsupported platform/arch: ${platform}/${arch}`,
        };
    }
    const sourcePath = join(distDir, binaryInfo.sourceName);
    if (!existsSync(sourcePath)) {
        // Also check for the generic 'gramatr' binary (from build-binary.mjs single-platform build)
        const genericPath = join(distDir, binaryInfo.destName);
        if (!existsSync(genericPath)) {
            return {
                status: 'fallback',
                message: `Binary not found: ${sourcePath} (and no generic ${genericPath})`,
            };
        }
        // Use the generic binary
        return copyBinaryAtomic(genericPath, destDir, binaryInfo.destName, dryRun, platform);
    }
    return copyBinaryAtomic(sourcePath, destDir, binaryInfo.destName, dryRun, platform);
}
function copyBinaryAtomic(sourcePath, destDir, destName, dryRun, platform) {
    const destPath = join(destDir, destName);
    const tempPath = `${destPath}.new`;
    if (dryRun) {
        return {
            status: 'installed',
            message: `Dry run: would copy ${sourcePath} -> ${destPath}`,
        };
    }
    mkdirSync(destDir, { recursive: true });
    copyFileSync(sourcePath, tempPath);
    // Set executable permission on non-Windows
    if (platform !== 'win32') {
        chmodSync(tempPath, 0o755);
    }
    renameSync(tempPath, destPath);
    return {
        status: 'installed',
        message: `Installed ${sourcePath} -> ${destPath}`,
    };
}
//# sourceMappingURL=platform.js.map