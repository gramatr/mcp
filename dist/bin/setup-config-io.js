/**
 * setup-config-io — Config file reading/writing, path resolution, managed block helpers.
 *
 * Extracted from setup.ts for SRP: pure I/O utilities with no setup orchestration.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getGramatrDirFromEnv } from "../config-runtime.js";
import { VERSION } from "../hooks/lib/version.js";
// gramatr-allow: C1 — CLI entry point, reads HOME for config path
const HOME = process.env.HOME || process.env.USERPROFILE || "";
export function getClaudeConfigPath() {
    return join(HOME, ".claude.json");
}
export function getClaudeSettingsPath() {
    return join(HOME, ".claude", "settings.json");
}
export function getCodexHooksPath() {
    return join(HOME, ".codex", "hooks.json");
}
export function getCodexConfigPath() {
    return join(HOME, ".codex", "config.toml");
}
export function getClaudeMarkdownPath() {
    return join(HOME, ".claude", "CLAUDE.md");
}
export function getCodexAgentsPath() {
    return join(HOME, ".codex", "AGENTS.md");
}
export function getGramatrSettingsPath() {
    const gramatrDir = getGramatrDirFromEnv() || join(HOME, ".gramatr");
    return join(gramatrDir, "settings.json");
}
/**
 * #2453 — Detect and clear a stale `Bearer` token from the user's Claude Code
 * MCP-server config (`~/.claude.json`).
 *
 * Some users have a legacy `mcpServers.gramatr` entry of `type: "http"` that
 * stores the auth token in `headers.Authorization`. When Redis evicts the
 * token, the server rejects the request with 401 AUTH_REQUIRED. Claude Code
 * then runs its built-in MCP OAuth handler, but the stale header is still
 * mounted on the connection and (as of Claude Code v?.?) the new token from
 * the OAuth callback is NOT written back to disk. This leaves the user in a
 * dead loop: stale token → 401 → OAuth dance → no token write → 401 → …
 *
 * The fix from @gramatr/mcp's side: strip the stale header out of
 * `~/.claude.json` proactively (during `gramatr login` and friends) so the
 * next connection attempt either succeeds anonymously (if the server allows
 * it, triggering Claude Code's OAuth from a clean state) or fails fast with
 * a clear "no token" error rather than the misleading "auth loop".
 *
 * This function ONLY clears the `Authorization` (and `authorization`) entries
 * from `mcpServers.gramatr.headers`. It preserves every other key in the
 * file, including non-gramatr mcpServers entries and unrelated headers.
 *
 * Returns true when a stale header was found and removed, false otherwise.
 */
export function clearStaleClaudeJsonAuthHeader(configPath) {
    const path = configPath ?? getClaudeConfigPath();
    let raw;
    try {
        raw = readFileSync(path, "utf8");
    }
    catch {
        return false;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return false;
    }
    const mcpServers = (parsed.mcpServers ?? {});
    const gramatr = mcpServers.gramatr;
    if (!gramatr || typeof gramatr !== "object")
        return false;
    const headers = gramatr.headers;
    if (!headers || typeof headers !== "object")
        return false;
    const hadAuthorization = "Authorization" in headers || "authorization" in headers;
    if (!hadAuthorization)
        return false;
    const { Authorization: _a, authorization: _b, ...remainingHeaders } = headers;
    const updatedGramatr = { ...gramatr };
    if (Object.keys(remainingHeaders).length > 0) {
        updatedGramatr.headers = remainingHeaders;
    }
    else {
        delete updatedGramatr.headers;
    }
    const updated = {
        ...parsed,
        mcpServers: {
            ...mcpServers,
            gramatr: updatedGramatr,
        },
    };
    writeFileSync(path, JSON.stringify(updated, null, 2) + "\n", { mode: 0o600 });
    return true;
}
const DEFAULT_GRAMATR_MCP_URL = "https://api.gramatr.com/mcp";
/**
 * #2455 — Write the gramatr access token into `~/.claude.json` as the
 * `mcpServers.gramatr.headers.Authorization` Bearer header so Claude Code's
 * built-in MCP client can authenticate against the gramatr HTTP transport.
 *
 * Claude Code reads bearer tokens from `~/.claude.json` (not `~/.gramatr.json`),
 * so the canonical gramatr CLI config file (`~/.gramatr.json`) is invisible to
 * it. This helper bridges that gap: every successful login path also writes
 * the new token here so headless SSH users (and anyone whose Claude Code MCP
 * OAuth dance silently fails) have a working bearer header immediately.
 *
 * Behaviour:
 *   - Missing file → creates skeleton `{ mcpServers: { gramatr: {...} } }`
 *   - Existing file with no `mcpServers` → adds the `gramatr` entry only
 *   - Existing `mcpServers.gramatr` → preserves every non-conflicting key
 *     (e.g. custom `env`, `type`, extra headers) and only updates
 *     `headers.Authorization`, `url` (if changed), and `type`
 *   - Existing `mcpServers.other-thing` → left untouched
 *   - Malformed JSON → throws (fail loud — never silently overwrite)
 *   - Atomic write via temp file + rename to avoid partial writes
 *   - Restrictive 0o600 mode preserved (or applied if file is new)
 *
 * Returns true on successful write, false when the file is owned by another
 * user / unwritable (warn-don't-crash).
 */
export function writeClaudeJsonAuthHeader(token, opts = {}) {
    // gramatr-allow: B1 — CLI helper, @gramatr/core error classes not depended on
    if (!token)
        throw new Error("writeClaudeJsonAuthHeader: token is required");
    const path = opts.configPath ?? getClaudeConfigPath();
    const url = opts.url ??
        // gramatr-allow: C1 — CLI helper reads GRAMATR_API_URL for default MCP endpoint baked into ~/.claude.json
        process.env.GRAMATR_API_URL ??
        DEFAULT_GRAMATR_MCP_URL;
    let parsed = {};
    let raw = null;
    try {
        raw = readFileSync(path, "utf8");
    }
    catch (err) {
        if (err?.code !== "ENOENT") {
            // Permission or other I/O issue — warn and bail; caller can surface.
            return false;
        }
    }
    if (raw !== null) {
        try {
            const candidate = JSON.parse(raw);
            if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
                // gramatr-allow: B1 — CLI helper, @gramatr/core error classes not depended on
                throw new Error(`~/.claude.json is not a JSON object (path: ${path})`);
            }
            parsed = candidate;
        }
        catch (err) {
            // gramatr-allow: B1 — fail loud per contract; CLI helper, no @gramatr/core dependency
            throw new Error(`writeClaudeJsonAuthHeader: refusing to overwrite malformed ${path}: ${err?.message ?? String(err)}`);
        }
    }
    const mcpServers = (parsed.mcpServers && typeof parsed.mcpServers === "object"
        ? parsed.mcpServers
        : {}) ?? {};
    const existingGramatr = mcpServers.gramatr && typeof mcpServers.gramatr === "object"
        ? mcpServers.gramatr
        : {};
    const existingHeaders = existingGramatr.headers && typeof existingGramatr.headers === "object"
        ? existingGramatr.headers
        : {};
    // Strip any case-variant of Authorization before re-applying the canonical
    // 'Authorization' key so we don't accumulate stale lowercase duplicates.
    const cleanedHeaders = {};
    for (const [k, v] of Object.entries(existingHeaders)) {
        if (k.toLowerCase() === "authorization")
            continue;
        cleanedHeaders[k] = v;
    }
    const updatedGramatr = {
        // Preserve any custom keys the user set (env, args, etc.).
        ...existingGramatr,
        type: typeof existingGramatr.type === "string" ? existingGramatr.type : "http",
        url: typeof existingGramatr.url === "string" ? existingGramatr.url : url,
        headers: {
            ...cleanedHeaders,
            Authorization: `Bearer ${token}`,
        },
    };
    const updated = {
        ...parsed,
        mcpServers: {
            ...mcpServers,
            gramatr: updatedGramatr,
        },
    };
    // Preserve file mode when present, else apply restrictive 0o600.
    let mode = 0o600;
    if (raw !== null) {
        try {
            mode = statSync(path).mode & 0o777;
        }
        catch {
            mode = 0o600;
        }
    }
    // Atomic write: temp file + rename.
    const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    try {
        writeFileSync(tmpPath, JSON.stringify(updated, null, 2) + "\n", { mode });
        renameSync(tmpPath, path);
        return true;
    }
    catch (_err) {
        // Restrictive perms or root-owned file — don't crash login, just warn.
        try {
            // best-effort cleanup of the temp file
            // (ignore failures — readFileSync on missing file is fine)
        }
        catch {
            /* noop */
        }
        return false;
    }
}
/**
 * Compare the token in `~/.gramatr.json` against the Bearer header in
 * `~/.claude.json`. Returns:
 *   - `synced` — both contain the same token (or both have no token)
 *   - `diverged` — both exist but differ (manual edit, or write-bridge skipped)
 *   - `missing-claude` — `~/.gramatr.json` has a token but `~/.claude.json` does not
 *   - `missing-gramatr` — `~/.claude.json` has a token but `~/.gramatr.json` does not
 *   - `neither` — no token in either file
 *   - `unreadable` — one of the files is malformed / unreadable
 */
export function getClaudeJsonSyncState(opts = {}) {
    const gramatrPath = opts.gramatrJsonPath ?? join(HOME, ".gramatr.json");
    const claudePath = opts.claudeJsonPath ?? getClaudeConfigPath();
    let gramatrToken;
    try {
        const raw = readFileSync(gramatrPath, "utf8");
        const parsed = JSON.parse(raw);
        if (typeof parsed.token === "string")
            gramatrToken = parsed.token;
    }
    catch (err) {
        if (err?.code !== "ENOENT")
            return "unreadable";
    }
    let claudeToken;
    try {
        const raw = readFileSync(claudePath, "utf8");
        const parsed = JSON.parse(raw);
        const mcp = parsed.mcpServers;
        const gramatr = mcp?.gramatr;
        const headers = gramatr?.headers;
        const auth = headers?.Authorization ??
            headers?.authorization;
        if (typeof auth === "string" && auth.startsWith("Bearer ")) {
            claudeToken = auth.slice(7).trim();
        }
    }
    catch (err) {
        if (err?.code !== "ENOENT")
            return "unreadable";
    }
    if (!gramatrToken && !claudeToken)
        return "neither";
    if (gramatrToken && !claudeToken)
        return "missing-claude";
    if (!gramatrToken && claudeToken)
        return "missing-gramatr";
    if (gramatrToken === claudeToken)
        return "synced";
    return "diverged";
}
export function readJsonFile(path, fallback) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return fallback;
    }
}
/**
 * Read existing Claude config or return empty.
 */
export function readClaudeConfig(configPath) {
    try {
        const raw = readFileSync(configPath, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
export function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function upsertManagedBlock(existing, content, startMarker, endMarker) {
    const block = content.trim();
    const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`, "m");
    if (pattern.test(existing)) {
        return existing.replace(pattern, block);
    }
    const trimmed = existing.trim();
    return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}
export function parseJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return null;
    }
}
export function readManagedBlock(path, startMarker, endMarker) {
    if (!existsSync(path))
        return null;
    const body = readFileSync(path, "utf8");
    const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`, "m");
    const match = body.match(pattern);
    return match ? match[0] : null;
}
export function ensureLocalSettings() {
    const settingsPath = getGramatrSettingsPath();
    const settingsDir = dirname(settingsPath);
    mkdirSync(settingsDir, { recursive: true });
}
export function hasHookCommand(config, eventName, needle) {
    if (!config || typeof config !== "object")
        return false;
    const hooksRoot = config.hooks;
    if (!hooksRoot || typeof hooksRoot !== "object")
        return false;
    const entries = hooksRoot[eventName];
    if (!Array.isArray(entries))
        return false;
    for (const entry of entries) {
        if (!entry || typeof entry !== "object")
            continue;
        const commands = entry.hooks;
        if (!Array.isArray(commands))
            continue;
        for (const command of commands) {
            const value = command?.command;
            if (typeof value === "string" && value.includes(needle)) {
                return true;
            }
        }
    }
    return false;
}
export function getGramatrPluginDir() {
    const gramatrDir = getGramatrDirFromEnv() || join(HOME, ".gramatr");
    // Plugin lives at <marketplace-root>/<plugin-name>/ — Claude Code resolves
    // plugins by looking for a subdirectory matching the plugin name under the
    // marketplace URL root.
    return join(gramatrDir, "gramatr");
}
export function writeMarketplaceManifest(gramatrDir) {
    const marketplaceDir = join(gramatrDir, ".claude-plugin");
    mkdirSync(marketplaceDir, { recursive: true });
    const manifest = {
        name: "gramatr",
        description: "gramatr — Real-Time Intelligent Context Engineering",
        author: { name: "gramatr", email: "support@gramatr.com", url: "https://gramatr.com" },
        plugins: [{ name: "gramatr", path: "gramatr" }],
    };
    writeFileSync(join(marketplaceDir, "marketplace.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    // Overwrite stale ~/.gramatr/package.json — old @gramatr/client installs left this
    // with the deprecated client identity, causing Claude Code to show "gramatr Client"
    // and refuse to load plugin hooks. Must be @gramatr/mcp to match the active package.
    const rootPkg = {
        name: "@gramatr/mcp",
        version: VERSION,
        description: "gramatr — Real-Time Intelligent Context Engineering",
        homepage: "https://gramatr.com",
    };
    writeFileSync(join(gramatrDir, "package.json"), JSON.stringify(rootPkg, null, 2) + "\n", "utf8");
}
export function writePluginFiles(pluginDir, pluginJson, hooksJson, mcpJson) {
    mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
    mkdirSync(join(pluginDir, "hooks"), { recursive: true });
    writeFileSync(join(pluginDir, ".claude-plugin", "plugin.json"), JSON.stringify(pluginJson, null, 2) + "\n", "utf8");
    writeFileSync(join(pluginDir, "hooks", "hooks.json"), JSON.stringify(hooksJson, null, 2) + "\n", "utf8");
    writeFileSync(join(pluginDir, ".mcp.json"), JSON.stringify(mcpJson, null, 2) + "\n", "utf8");
}
export function removeGramatrHooks(settings) {
    const { hooks, ...rest } = settings;
    if (!hooks)
        return rest;
    const filtered = {};
    for (const [event, entries] of Object.entries(hooks)) {
        if (!Array.isArray(entries))
            continue;
        const nonGramatr = entries.filter((entry) => {
            const cmds = entry.hooks ?? [];
            return !cmds.some((c) => typeof c.command === "string" && c.command.includes("@gramatr/mcp"));
        });
        if (nonGramatr.length > 0)
            filtered[event] = nonGramatr;
    }
    return Object.keys(filtered).length > 0 ? { hooks: filtered, ...rest } : rest;
}
/**
 * Add or update the gramatr plugin registration in Claude Code settings.
 *
 * @param settings      - Existing Claude Code settings object.
 * @param gramatrDir    - Local gramatr directory (used as fallback when remoteUrl is absent).
 * @param remoteUrl     - Hosted marketplace URL (e.g. 'https://api.gramatr.com/marketplace').
 *                        When provided, this takes precedence over the local file:// URL so
 *                        Claude Code fetches plugin assets from the hosted server rather than
 *                        requiring a local @gramatr/mcp installation.
 *                        Defaults to 'https://api.gramatr.com/marketplace'.
 */
export function addPluginRegistration(settings, gramatrDir, remoteUrl = "https://api.gramatr.com/marketplace") {
    const marketplaceUrl = remoteUrl ? remoteUrl : `file://${gramatrDir.replace(/\\/g, "/")}`;
    return {
        ...settings,
        extraKnownMarketplaces: {
            ...(settings.extraKnownMarketplaces ?? {}),
            gramatr: { source: { source: "url", url: marketplaceUrl } },
        },
        enabledPlugins: {
            ...(settings.enabledPlugins ?? {}),
            "gramatr@gramatr": true,
        },
    };
}
export { HOME };
//# sourceMappingURL=setup-config-io.js.map