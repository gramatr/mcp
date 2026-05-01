/**
 * setup-shared — Small shared utilities used across setup modules.
 */
import { execSync } from 'node:child_process';
/**
 * Returns the best available invocation for the gramatr server.
 * Prefers the globally installed binary (no network, no cache miss) over npx.
 * Falls back to npx only when the binary is not in PATH.
 */
export function resolveBinaryPath() {
    try {
        const cmd = process.platform === 'win32' ? 'where gramatr' : 'which gramatr';
        execSync(cmd, { stdio: 'pipe' });
        return { command: 'gramatr', args: [] };
    }
    catch {
        return { command: 'npx', args: ['-y', '@gramatr/mcp'] };
    }
}
export function deployPlatformBinary(_dryRun = false) {
    // No-op: hooks use `npx -y --prefer-offline @gramatr/mcp hook` so there is
    // nothing to deploy. The globally installed package is always current.
    return true;
}
//# sourceMappingURL=setup-shared.js.map