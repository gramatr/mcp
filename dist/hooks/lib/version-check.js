/**
 * version-check.ts — opportunistic npm registry version check.
 *
 * Queries https://registry.npmjs.org/gramatr/latest on a 3s timeout, caches
 * the result for one hour under ~/.gramatr/.cache/version-check.json, and
 * reports whether the installed client is behind the published version.
 *
 * Design constraints (see issue #468 sibling work):
 *   - Never throws. Any failure returns null and the caller proceeds normally.
 *   - Never writes to stdout — stdout is Claude Code's context channel.
 *   - Fast cache-hit path (no network, no heavy work).
 *   - Zero new runtime dependencies. Uses global fetch (Node 18+).
 */
import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { VERSION_CACHE_TTL_MS, VERSION_FETCH_TIMEOUT_MS } from "../generated/hook-timeouts.js";
import { detectInstallLayout } from "./install-detect.js";
const REGISTRY_URL = "https://registry.npmjs.org/@gramatr%2fmcp/latest";
/**
 * Compare two semver-style version strings ("X.Y.Z").
 * Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 *
 * Non-numeric or missing segments are treated as 0.
 */
export function compareVersions(a, b) {
    const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
    const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const av = pa[i] ?? 0;
        const bv = pb[i] ?? 0;
        if (av < bv)
            return -1;
        if (av > bv)
            return 1;
    }
    return 0;
}
export function getCachePath(home = homedir()) {
    return join(home, ".gramatr", ".cache", "version-check.json");
}
function readCache(path) {
    try {
        if (!existsSync(path))
            return null;
        const raw = readFileSync(path, "utf8");
        const parsed = JSON.parse(raw);
        if (typeof parsed.latestVersion !== "string" || typeof parsed.fetchedAt !== "number") {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
function writeCache(path, data) {
    try {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
    }
    catch {
        // Cache is best-effort. Silent failure is acceptable.
    }
}
async function fetchLatestVersion() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(REGISTRY_URL, {
                signal: controller.signal,
                headers: { Accept: "application/json" },
            });
            if (!res.ok)
                return null;
            const body = (await res.json());
            if (typeof body?.version !== "string")
                return null;
            return body.version;
        }
        finally {
            clearTimeout(timer);
        }
    }
    catch {
        return null;
    }
}
/**
 * Check the installed version against the latest published on npm.
 * Returns null on any failure — callers must treat this as optional.
 */
export async function checkLatestVersion(installedVersion, options = {}) {
    try {
        const cachePath = options.cachePath ?? getCachePath();
        const now = options.now ?? Date.now();
        const cached = readCache(cachePath);
        if (cached && now - cached.fetchedAt < VERSION_CACHE_TTL_MS) {
            return {
                latestVersion: cached.latestVersion,
                installedVersion,
                isOutdated: compareVersions(cached.latestVersion, installedVersion) > 0,
                cached: true,
            };
        }
        const latestVersion = await fetchLatestVersion();
        if (!latestVersion)
            return null;
        writeCache(cachePath, {
            latestVersion,
            fetchedAt: now,
            lastNotifiedVersion: cached?.lastNotifiedVersion,
        });
        return {
            latestVersion,
            installedVersion,
            isOutdated: compareVersions(latestVersion, installedVersion) > 0,
            cached: false,
        };
    }
    catch {
        return null;
    }
}
/**
 * Record that the user has been notified for a given latest version.
 * Suppresses repeat notifications until a newer version is published.
 */
export function markNotified(latestVersion, cachePath = getCachePath()) {
    try {
        const current = readCache(cachePath);
        if (!current)
            return;
        writeCache(cachePath, { ...current, lastNotifiedVersion: latestVersion });
    }
    catch {
        // Best-effort.
    }
}
export function shouldNotify(result, cachePath = getCachePath()) {
    if (!result.isOutdated)
        return false;
    const cached = readCache(cachePath);
    if (cached?.lastNotifiedVersion === result.latestVersion)
        return false;
    return true;
}
/**
 * Format the upgrade notification banner. Caller decides where to write it
 * (must be stderr — stdout is reserved for Claude context).
 */
export function formatUpgradeNotification(installed, latest) {
    const bar = "\u2501".repeat(60);
    return [
        bar,
        "  gramatr update available",
        "",
        `  Installed: ${installed}`,
        `  Latest:    ${latest}`,
        "",
        "  To upgrade:",
        "    1. Type /exit to leave Claude Code",
        "    2. Run: npm install -g @gramatr/mcp@latest",
        "    3. If gramatr --version still shows the old version:  hash -r  (bash) or  rehash  (zsh)",
        "    4. Restart: claude --resume",
        "",
        "  Why restart? gramatr's hooks are loaded by Claude Code at",
        "  session start. New hook code requires a fresh session.",
        bar,
        "",
    ].join("\n");
}
/**
 * One-shot helper for hooks: check and, if appropriate, print the
 * notification to stderr. Safe to call from any hook — never throws,
 * never blocks longer than VERSION_FETCH_TIMEOUT_MS in the cache-miss path.
 */
export async function runVersionCheckAndNotify(installedVersion, options = {}) {
    const stream = options.stream ?? process.stderr;
    const cachePath = options.cachePath ?? getCachePath();
    const result = await checkLatestVersion(installedVersion, { cachePath });
    if (!result)
        return null;
    if (shouldNotify(result, cachePath)) {
        try {
            stream.write(formatUpgradeNotification(result.installedVersion, result.latestVersion));
        }
        catch {
            // Silent — never break the hook.
        }
        markNotified(result.latestVersion, cachePath);
    }
    return result;
}
// ── Auto-upgrade ──────────────────────────────────────────────────────────
const UPGRADE_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes — prevent concurrent upgrades
function getUpgradeLockPath(home = homedir()) {
    return join(home, ".gramatr", ".cache", "upgrade.lock");
}
function isUpgradeLocked(lockPath = getUpgradeLockPath()) {
    try {
        if (!existsSync(lockPath))
            return false;
        const raw = readFileSync(lockPath, "utf8");
        const lock = JSON.parse(raw);
        if (typeof lock.startedAt !== "number")
            return false;
        return Date.now() - lock.startedAt < UPGRADE_LOCK_TTL_MS;
    }
    catch {
        return false;
    }
}
function writeUpgradeLock(version, lockPath = getUpgradeLockPath()) {
    try {
        mkdirSync(dirname(lockPath), { recursive: true });
        writeFileSync(lockPath, JSON.stringify({ version, startedAt: Date.now() }) + "\n");
    }
    catch {
        // Best-effort.
    }
}
/**
 * Format the hint message shown when auto-upgrade is skipped because the
 * package was installed via `npm i -g` or via an unknown layout.
 *
 * Safe to call from any hook — no I/O, no side effects.
 */
export function formatUpgradeHint(installed, latest) {
    return (`gramatr update available: v${installed} → v${latest}\n` +
        `To upgrade: npm i -g @gramatr/mcp@latest`);
}
/**
 * Auto-upgrade gramatr when a newer version is available.
 *
 * Behaviour depends on the detected install layout:
 *
 *   'direct'     — Spawns `npx @gramatr/mcp@{version} install claude-code
 *                  --yes` as a detached background process. Files are written
 *                  to ~/.gramatr/. New hook code takes effect after restart.
 *   'npm-global' — Skips the background spawn entirely (writing to ~/.gramatr/
 *                  has no effect when the on-PATH binary is npm-managed). The
 *                  caller should surface formatUpgradeHint() instead.
 *   'unknown'    — Same as 'npm-global': skip, let caller surface the hint.
 *
 * Safety:
 *   - Layout detection runs before any I/O.
 *   - Lock file prevents concurrent upgrades (10min TTL).
 *   - --yes flag ensures non-interactive (no stdin prompts).
 *   - Detached + unref'd so the parent process can exit.
 *   - Never throws — returns result indicating what happened.
 */
export function autoUpgrade(latestVersion, options = {}) {
    const stream = options.stream ?? process.stderr;
    const lockPath = options.lockPath ?? getUpgradeLockPath();
    // Detect (or accept an injected) install layout before touching the lock.
    const layout = options.layout ?? detectInstallLayout({ argv1: options.argv1 });
    if (layout === "npm-global" || layout === "unknown") {
        return {
            triggered: false,
            version: latestVersion,
            reason: layout === "npm-global"
                ? "npm-global install — run: npm i -g @gramatr/mcp@latest"
                : "unknown install layout — run: npm i -g @gramatr/mcp@latest",
            layout,
        };
    }
    if (isUpgradeLocked(lockPath)) {
        return {
            triggered: false,
            version: latestVersion,
            reason: "upgrade already in progress",
            layout,
        };
    }
    writeUpgradeLock(latestVersion, lockPath);
    try {
        const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
        const child = spawn(npxBin, ["@gramatr/mcp@" + latestVersion, "install", "claude-code", "--yes"], {
            detached: true,
            stdio: "ignore",
            env: { ...process.env, GRAMATR_AUTO_UPGRADE: "1" },
        });
        child.unref();
        const bar = "━".repeat(60);
        stream.write([
            "",
            bar,
            `  gramatr upgrading: v${latestVersion} — getting smarter`,
            "",
            "  Downloading and installing in the background...",
            "  When done, restart Claude Code to activate new hooks.",
            "",
            "  After restart, if gramatr --version still shows the old version:",
            "    hash -r     # bash",
            "    rehash      # zsh",
            bar,
            "",
        ].join("\n"));
        return { triggered: true, version: latestVersion, layout };
    }
    catch (err) {
        return {
            triggered: false,
            version: latestVersion,
            reason: err?.message || "spawn failed",
            layout,
        };
    }
}
//# sourceMappingURL=version-check.js.map