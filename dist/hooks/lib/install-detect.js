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
import { homedir } from "node:os";
import { join, resolve } from "node:path";
/**
 * Compute the default npm global prefix candidates for the current
 * platform. These are the directory roots under which `npm i -g` places
 * packages (i.e. `{prefix}/lib/node_modules/{pkg}`).
 *
 * We include:
 *   - npm_config_prefix env var (set by npm when running scripts)
 *   - npm_config_globalconfig env var prefix (indirect indicator)
 *   - Well-known platform paths: /usr/local, /usr, /opt/homebrew
 *   - ~/.npm-global (common nvm / manual prefix)
 *   - $NVM_DIR/versions/node/{version} paths
 *   - $VOLTA_HOME / .volta paths
 *   - Derived from $PATH: any bin dir whose parent looks like an npm prefix
 */
function defaultNpmGlobalPrefixes(home) {
    const candidates = [];
    // 1. npm sets npm_config_prefix when it runs scripts.
    const envPrefix = process.env["npm_config_prefix"];
    if (envPrefix) {
        candidates.push(envPrefix);
    }
    // 2. Common fixed system prefixes.
    candidates.push("/usr/local", "/usr", "/opt/homebrew");
    // 3. ~/.npm-global — conventional manual global prefix.
    candidates.push(join(home, ".npm-global"));
    // 4. NVM: $NVM_DIR/versions/node — each version is a prefix.
    const nvmDir = process.env["NVM_DIR"];
    if (nvmDir) {
        candidates.push(join(nvmDir, "versions", "node"));
    }
    // 5. Volta: ~/.volta/tools/image/node
    const voltaHome = process.env["VOLTA_HOME"] ?? join(home, ".volta");
    candidates.push(join(voltaHome, "tools", "image", "node"));
    // 6. Windows: %APPDATA%\npm
    if (process.platform === "win32") {
        const appdata = process.env["APPDATA"];
        if (appdata) {
            candidates.push(join(appdata, "npm"));
        }
    }
    return candidates;
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
export function detectInstallLayout(options = {}) {
    try {
        const home = options.home ?? homedir();
        const argv1 = options.argv1 ?? process.argv[1];
        if (typeof argv1 !== "string" || argv1 === "")
            return "unknown";
        const binaryPath = resolve(argv1);
        // Check for direct ~/.gramatr/ install first — more specific.
        const directRoot = join(home, ".gramatr") + "/";
        if (binaryPath.startsWith(directRoot) || binaryPath === join(home, ".gramatr")) {
            return "direct";
        }
        // Fingerprint: paths that npm places binaries in always contain one of
        // these substrings on any platform.
        const npmFingerprints = [
            "/lib/node_modules/",
            "/node_modules/.bin/",
            "\\node_modules\\.bin\\",
            "\\lib\\node_modules\\",
        ];
        for (const fp of npmFingerprints) {
            if (binaryPath.includes(fp)) {
                return "npm-global";
            }
        }
        // Check against known prefix candidates (prefix + any of its subdirs).
        const prefixes = options.npmGlobalPrefixes ?? defaultNpmGlobalPrefixes(home);
        for (const prefix of prefixes) {
            if (!prefix)
                continue;
            const normalised = prefix.endsWith("/") ? prefix : prefix + "/";
            if (binaryPath.startsWith(normalised)) {
                return "npm-global";
            }
        }
        return "unknown";
    }
    catch {
        return "unknown";
    }
}
//# sourceMappingURL=install-detect.js.map