/**
 * setup-shared — Small shared utilities used across setup modules.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
/**
 * Write stable local wrappers for hook dispatch.
 *
 * Client configs should invoke `gramatr-hook ...` and rely on PATH resolution
 * to reach these wrappers under ~/.gramatr/bin.
 */
export function writeHookWrappers(gramatrDir) {
    const binDir = join(gramatrDir, 'bin');
    mkdirSync(binDir, { recursive: true });
    const shWrapper = join(binDir, 'gramatr-hook');
    writeFileSync(shWrapper, '#!/bin/sh\nif command -v gramatr >/dev/null 2>&1; then\n  exec gramatr hook "$@"\nfi\nif [ -x "$(dirname "$0")/gramatr" ]; then\n  exec "$(dirname "$0")/gramatr" hook "$@"\nfi\nexec npx -y --prefer-offline @gramatr/mcp hook "$@"\n', { mode: 0o755 });
    const cmdWrapper = join(binDir, 'gramatr-hook.cmd');
    writeFileSync(cmdWrapper, '@echo off\nwhere gramatr >nul 2>&1\nif %ERRORLEVEL% == 0 (\n  gramatr hook %*\n) else (\n  npx -y --prefer-offline @gramatr/mcp hook %*\n)\n');
    const gramatrWrapper = join(binDir, 'gramatr');
    writeFileSync(gramatrWrapper, '#!/bin/sh\n# Locate gramatr and ensure the correct Node.js version is on PATH.\n# The gramatr binary uses #!/usr/bin/env node, so the nvm bin dir must\n# come first on PATH or it will pick up the system node which lacks node:sqlite.\nif [ -d "$HOME/.nvm/versions/node" ]; then\n  for bin_dir in "$HOME"/.nvm/versions/node/*/bin; do\n    if [ -x "$bin_dir/gramatr" ]; then\n      export PATH="$bin_dir:$PATH"\n      exec "$bin_dir/gramatr" "$@"\n    fi\n  done\nfi\nexec npx -y --prefer-offline @gramatr/mcp "$@"\n', { mode: 0o755 });
}
//# sourceMappingURL=setup-shared.js.map