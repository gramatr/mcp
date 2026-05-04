/**
 * git-gate.ts — PreToolUse hook for the Bash tool.
 *
 * Enforces behavioral gates on dangerous git operations:
 *   1. git push to main/master — denied (use a PR)
 *   2. git tag — denied unless binaries are built for current version.
 *      Supports both single-package npm libs and Turborepo / pnpm-workspace
 *      monorepos. Each workspace package that declares a `dist/`-targeted
 *      entry (`main`, `module`, `exports`, `bin`, `types` referencing
 *      `dist/...`) is verified independently. App packages that build to
 *      `.next/`, `out/`, etc. declare no `dist/` entry and are skipped.
 *      Stale builds — any `src/**\/*.ts` newer than the most recent file in
 *      `dist/` — are also rejected so a `git pull && git tag` without a
 *      rebuild is caught.
 *   3. git push --force / git reset --hard — denied (requires explicit
 *      user approval)
 *
 * All other Bash commands are allowed unconditionally.
 *
 * No external deps: pure Node built-ins (fs, path).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { HOOK_STDIN_DEFAULT_TIMEOUT_MS } from "./generated/hook-timeouts.js";
// ── Stdin ──
function readStdin(timeoutMs) {
    return new Promise((resolve) => {
        let data = "";
        const timer = setTimeout(() => resolve(data), timeoutMs);
        process.stdin.setEncoding("utf-8");
        process.stdin.on("data", (chunk) => {
            data += chunk;
        });
        process.stdin.on("end", () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.on("error", () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.resume();
    });
}
// ── Decision helpers ──
function buildPreToolUseOutput(allow, reason) {
    if (allow) {
        return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" } };
    }
    return {
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: reason || "Bash command blocked by gramatr git gate.",
        },
    };
}
// ── Workspace / build verification helpers (exported for tests) ──
/**
 * True iff workDir is a monorepo (pnpm-workspace.yaml present, or
 * package.json declares a non-empty `workspaces` array).
 */
export function isMonorepo(workDir) {
    if (existsSync(join(workDir, "pnpm-workspace.yaml")))
        return true;
    try {
        const pkg = JSON.parse(readFileSync(join(workDir, "package.json"), "utf8"));
        if (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0)
            return true;
        if (pkg.workspaces &&
            typeof pkg.workspaces === "object" &&
            Array.isArray(pkg.workspaces.packages) &&
            (pkg.workspaces.packages.length ?? 0) > 0) {
            return true;
        }
    }
    catch {
        // ignore
    }
    return false;
}
/**
 * Tiny YAML extractor: returns the strings from `packages:` array entries.
 * Handles the simple shape used by pnpm-workspace.yaml. Returns null if the
 * file uses something more complex (so callers can fall back).
 */
function readPnpmWorkspacePatterns(workDir) {
    const yamlPath = join(workDir, "pnpm-workspace.yaml");
    if (!existsSync(yamlPath))
        return null;
    let body;
    try {
        body = readFileSync(yamlPath, "utf8");
    }
    catch {
        return null;
    }
    const lines = body.split(/\r?\n/);
    const patterns = [];
    let inPackages = false;
    for (const raw of lines) {
        const line = raw.replace(/#.*$/, "").trimEnd();
        if (!line.trim())
            continue;
        if (/^packages\s*:/.test(line)) {
            inPackages = true;
            continue;
        }
        if (inPackages) {
            // Top-level key (no leading whitespace, ends with ':') ends the array.
            if (/^[A-Za-z0-9_-]+\s*:/.test(line)) {
                inPackages = false;
                continue;
            }
            const m = line.match(/^\s*-\s*(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/);
            if (m) {
                patterns.push(m[1] ?? m[2] ?? m[3] ?? "");
            }
            else {
                // Unknown shape inside packages: bail out.
                return null;
            }
        }
    }
    return patterns;
}
/**
 * Expand a simple glob pattern into directory paths. Supports literal
 * segments and single `*` wildcard segments only. Returns empty list if
 * the pattern uses anything more complex (`**`, character classes, etc.)
 * — caller can decide what to do.
 */
function expandSimpleGlob(workDir, pattern) {
    // Reject `**` and character classes: too complex.
    if (pattern.includes("**") || /[\[\]{}]/.test(pattern))
        return null;
    const segments = pattern.split("/").filter((s) => s.length > 0);
    let current = [workDir];
    for (const seg of segments) {
        const next = [];
        if (seg === "*") {
            for (const dir of current) {
                let entries;
                try {
                    entries = readdirSync(dir);
                }
                catch {
                    continue;
                }
                for (const entry of entries) {
                    const full = join(dir, entry);
                    try {
                        if (statSync(full).isDirectory())
                            next.push(full);
                    }
                    catch {
                        // skip unreadable
                    }
                }
            }
        }
        else if (seg.includes("*")) {
            // Partial wildcard inside a segment — treat as too complex.
            return null;
        }
        else {
            for (const dir of current) {
                const full = join(dir, seg);
                try {
                    if (statSync(full).isDirectory())
                        next.push(full);
                }
                catch {
                    // skip
                }
            }
        }
        current = next;
    }
    return current;
}
/**
 * Returns absolute paths to each workspace package directory.
 * Source priority: pnpm-workspace.yaml, then package.json `workspaces`.
 */
export function listWorkspacePackages(workDir) {
    let patterns = readPnpmWorkspacePatterns(workDir);
    if (!patterns) {
        try {
            const pkg = JSON.parse(readFileSync(join(workDir, "package.json"), "utf8"));
            if (Array.isArray(pkg.workspaces)) {
                patterns = pkg.workspaces.filter((p) => typeof p === "string");
            }
            else if (pkg.workspaces &&
                typeof pkg.workspaces === "object" &&
                Array.isArray(pkg.workspaces.packages)) {
                patterns = (pkg.workspaces.packages).filter((p) => typeof p === "string");
            }
        }
        catch {
            patterns = null;
        }
    }
    if (!patterns || patterns.length === 0)
        return [];
    const out = new Set();
    for (const pat of patterns) {
        const expanded = expandSimpleGlob(workDir, pat);
        if (expanded === null) {
            process.stderr.write(`[git-gate] complex glob "${pat}" — falling back to single-package check\n`);
            return [];
        }
        for (const dir of expanded) {
            // Only count directories that have a package.json
            if (existsSync(join(dir, "package.json")))
                out.add(dir);
        }
    }
    return Array.from(out);
}
/**
 * Walk an `exports` map looking for any string referencing `dist/`.
 */
function exportsReferenceDist(value) {
    if (typeof value === "string") {
        return /(^|\/)dist\//.test(value);
    }
    if (Array.isArray(value)) {
        return value.some(exportsReferenceDist);
    }
    if (value && typeof value === "object") {
        return Object.values(value).some(exportsReferenceDist);
    }
    return false;
}
/**
 * True iff the package.json declares any `dist/`-targeted entry.
 */
export function packageDeclaresDistEntry(pkgJson) {
    for (const field of ["main", "module", "types", "typings"]) {
        const v = pkgJson[field];
        if (typeof v === "string" && /(^|\/)dist\//.test(v))
            return true;
    }
    if (exportsReferenceDist(pkgJson.exports))
        return true;
    if (exportsReferenceDist(pkgJson.bin))
        return true;
    return false;
}
/**
 * Recursively find the newest mtime (ms) under a directory. Returns 0 if
 * nothing matches. `predicate` filters file paths.
 */
function newestMtimeUnder(dir, predicate, acc = { mtime: 0, path: "" }) {
    let entries;
    try {
        entries = readdirSync(dir);
    }
    catch {
        return acc;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        let s;
        try {
            s = statSync(full);
        }
        catch {
            continue;
        }
        if (s.isDirectory()) {
            // Skip nested node_modules
            if (entry === "node_modules")
                continue;
            newestMtimeUnder(full, predicate, acc);
        }
        else if (s.isFile() && predicate(full)) {
            const m = s.mtimeMs;
            if (m > acc.mtime) {
                acc.mtime = m;
                acc.path = full;
            }
        }
    }
    return acc;
}
/**
 * Returns true iff dist/ contains at least one .js file.
 */
function distHasJs(distDir) {
    return newestMtimeUnder(distDir, (p) => p.endsWith(".js")).mtime > 0;
}
/**
 * Verify a single package: dist/ exists, has .js files, and no src/**\/*.ts
 * is newer than the newest dist/ file. Packages that don't declare a
 * dist/ entry are skipped (ok:true).
 */
export function verifyPackageBuilt(pkgPath) {
    const pkgJsonPath = join(pkgPath, "package.json");
    let pkgJson;
    try {
        pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    }
    catch {
        // Not a real package — skip silently.
        return { ok: true };
    }
    if (!packageDeclaresDistEntry(pkgJson))
        return { ok: true };
    const pkgName = typeof pkgJson.name === "string" && pkgJson.name.length > 0 ? pkgJson.name : pkgPath;
    const distDir = join(pkgPath, "dist");
    if (!existsSync(distDir)) {
        return {
            ok: false,
            reason: `Run pnpm build before tagging. No dist/ directory in ${pkgName}.`,
        };
    }
    const newestDist = newestMtimeUnder(distDir, (p) => p.endsWith(".js"));
    if (newestDist.mtime === 0) {
        return {
            ok: false,
            reason: `Run pnpm build before tagging. No .js files in dist/ for ${pkgName}.`,
        };
    }
    const srcDir = join(pkgPath, "src");
    if (existsSync(srcDir)) {
        const newestSrc = newestMtimeUnder(srcDir, (p) => (p.endsWith(".ts") || p.endsWith(".tsx")) && !p.endsWith(".d.ts"));
        if (newestSrc.mtime > newestDist.mtime) {
            return {
                ok: false,
                reason: `Stale build for ${pkgName}: ${newestSrc.path} newer than dist/. ` +
                    `Re-run pnpm build.`,
            };
        }
    }
    return { ok: true };
}
/**
 * Top-level entry — verify build artifacts for the working tree before a
 * tag is allowed. Single-package and monorepo aware.
 */
export function verifyBuildBeforeTag(workDir, version) {
    if (!version) {
        return {
            ok: false,
            reason: "Cannot read version from package.json. Run pnpm build before tagging.",
        };
    }
    if (isMonorepo(workDir)) {
        const pkgs = listWorkspacePackages(workDir);
        if (pkgs.length === 0) {
            // Fallback to single-package mode if we couldn't enumerate.
            return verifyPackageBuilt(workDir);
        }
        for (const pkg of pkgs) {
            const r = verifyPackageBuilt(pkg);
            if (!r.ok)
                return r;
        }
        return { ok: true };
    }
    return verifyPackageBuilt(workDir);
}
/**
 * Check whether a Bash command triggers any git behavioral gate.
 * Exported for direct unit testing.
 */
export function checkGitCommand(command, cwd) {
    const trimmed = command.trim();
    // Only gate actual git commands — not gh, npm, or other tools whose
    // arguments may contain git-related strings.
    if (!trimmed.startsWith("git ") && !trimmed.startsWith("git\t")) {
        return { allow: true };
    }
    // Gate 1: git reset --hard — requires explicit user confirmation
    if (/^git\s+reset\s+--hard/.test(trimmed)) {
        return {
            allow: false,
            reason: "Destructive git command blocked by the gramatr git gate. " +
                "Ask the user to confirm they want this operation. " +
                "If they confirm, they can run the command directly by typing `! " + trimmed + "` in the prompt.",
        };
    }
    // Gate 2: push to main/master (with or without force/flags)
    if (/^git\s+push\b/.test(trimmed)) {
        const pushesToProtected = /^git\s+push\b.*\b(main|master)\b/.test(trimmed) ||
            /^git\s+push\b.*\S+:(main|master)\b/.test(trimmed);
        if (pushesToProtected) {
            return {
                allow: false,
                reason: "Use a PR to push to main. Direct pushes to main/master are not allowed.",
            };
        }
        // Force push to non-protected branches is allowed (standard after rebase)
    }
    // Gate 3: git tag — require binaries built for current version (Node/pnpm only)
    // Rust projects build on CI via tag push — no local artifact check needed.
    if (/git\s+tag\b/.test(trimmed)) {
        const workDir = cwd || process.cwd();
        if (!existsSync(join(workDir, "Cargo.toml"))) {
            let version;
            try {
                const pkg = JSON.parse(readFileSync(join(workDir, "package.json"), "utf8"));
                version = pkg.version;
            }
            catch {
                return {
                    allow: false,
                    reason: "Run pnpm build and build-all-targets before tagging. Could not verify build artifacts.",
                };
            }
            if (!version) {
                return {
                    allow: false,
                    reason: "Cannot read version from package.json. Run pnpm build before tagging.",
                };
            }
            const result = verifyBuildBeforeTag(workDir, version);
            if (!result.ok) {
                return { allow: false, reason: result.reason };
            }
        }
    }
    return { allow: true };
}
// ── Hook runner ──
export async function runGitGateHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_DEFAULT_TIMEOUT_MS);
    if (!raw.trim()) {
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
        return 0;
    }
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || input.tool_name !== "Bash") {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
            return 0;
        }
        const command = input.tool_input?.command || "";
        if (!command) {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
            return 0;
        }
        const result = checkGitCommand(command);
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(result.allow, result.reason)));
    }
    catch {
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
    }
    return 0;
}
//# sourceMappingURL=git-gate.js.map