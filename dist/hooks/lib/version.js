/**
 * version.ts — runtime resolution of the installed gramatr version.
 *
 * Reads `version` from the nearest package.json walking up from this module's
 * location. package.json is the SINGLE source of truth — it's the file the
 * version-bump process already updates, so there is zero possibility of drift.
 *
 * Works in two environments:
 *   1. Source checkout: packages/client/core/version.ts →
 *      packages/client/package.json (found one directory up).
 *   2. Installed client: ~/.gramatr/core/version.ts →
 *      ~/.gramatr/package.json (copied by installClientFiles()).
 *
 * If the file cannot be resolved (unexpected layout), falls back to '0.0.0'
 * rather than throwing — the version check is opportunistic and must never
 * break the hook.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
function findPackageJson(startDir) {
    let dir = startDir;
    for (let i = 0; i < 5; i++) {
        const candidate = join(dir, 'package.json');
        if (existsSync(candidate))
            return candidate;
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return null;
}
export function resolveVersion() {
    try {
        if (typeof __GRAMATR_VERSION__ === 'string' && __GRAMATR_VERSION__.length > 0) {
            return __GRAMATR_VERSION__;
        }
        const here = dirname(fileURLToPath(import.meta.url));
        const pkgPath = findPackageJson(here);
        if (!pkgPath)
            return '0.0.0';
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
export const VERSION = resolveVersion();
//# sourceMappingURL=version.js.map