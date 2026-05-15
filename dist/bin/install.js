/**
 * gramatr install / uninstall — idempotent Claude Code setup (#2472).
 *
 * Single command that fully wires gramatr into Claude Code:
 *   - Auth check (skips device-flow when token already present)
 *   - Drop hook script to ~/.gramatr/scripts/hook-userpromptsubmit.sh
 *   - Merge UserPromptSubmit entry into ~/.claude/settings.json (sentinel-safe)
 *   - Merge gramatr section into ~/.claude/CLAUDE.md (sentinel-safe)
 *   - Optional cleanup of legacy 14-handler scaffold + daemon cruft
 *
 * Idempotency contract: every step computes desired state, compares to
 * current, and writes only the diff. Re-running install on an
 * already-installed system produces no observable changes.
 *
 * Scope: Claude Code only in v1. Codex / Cursor / Gemini stay on `setup`
 * subcommands until follow-up.
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, } from "node:fs";
import { platform as osPlatform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildConnectorInstructions, buildPromptSuggestion } from "../setup/web-connector.js";
/** Sentinel pair carved into ~/.claude/CLAUDE.md. */
export const GRAMATR_MD_START = "<!-- GRAMATR-START -->";
export const GRAMATR_MD_END = "<!-- GRAMATR-END -->";
/** Comment marker we insert on the UserPromptSubmit hook command so we can
 * identify a gramatr-owned entry without depending on the script path
 * (paths drift across machines — markers don't). */
const HOOK_OWNER_TAG = "# gramatr-managed: UserPromptSubmit";
const SESSION_END_OWNER_TAG = "# gramatr-managed: SessionEnd";
const SESSION_START_OWNER_TAG = "# gramatr-managed: SessionStart";
const STOP_HOOK_OWNER_TAG = "# gramatr-managed: Stop";
const HOOK_SCRIPT_FILENAME = "hook-userpromptsubmit.sh";
const HOOK_REL_PATH = join("scripts", HOOK_SCRIPT_FILENAME);
const SESSION_END_SCRIPT_FILENAME = "hook-sessionend.sh";
const SESSION_END_REL_PATH = join("scripts", SESSION_END_SCRIPT_FILENAME);
const SESSION_START_SCRIPT_FILENAME = "hook-sessionstart.sh";
const SESSION_START_REL_PATH = join("scripts", SESSION_START_SCRIPT_FILENAME);
const STOP_HOOK_SCRIPT_FILENAME = "hook-stop.sh";
const STOP_HOOK_REL_PATH = join("scripts", STOP_HOOK_SCRIPT_FILENAME);
// ── path helpers (parameterized by home so tests can use tmpdir) ────────────
export function claudeSettingsPath(home) {
    return join(home, ".claude", "settings.json");
}
export function claudeMarkdownPath(home) {
    return join(home, ".claude", "CLAUDE.md");
}
export function gramatrDir(home) {
    return join(home, ".gramatr");
}
export function gramatrHookScriptPath(home) {
    return join(gramatrDir(home), HOOK_REL_PATH);
}
export function gramatrSessionEndScriptPath(home) {
    return join(gramatrDir(home), SESSION_END_REL_PATH);
}
export function gramatrSessionStartScriptPath(home) {
    return join(gramatrDir(home), SESSION_START_REL_PATH);
}
export function gramatrStopScriptPath(home) {
    return join(gramatrDir(home), STOP_HOOK_REL_PATH);
}
export function gramatrTokenPath(home) {
    return join(home, ".gramatr.json");
}
/** Path to Claude Code slash-command directory. */
export function claudeCommandsDir(home) {
    return join(home, ".claude", "commands");
}
/**
 * Resolve the claude_desktop_config.json path for the current platform.
 * macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
 * Windows: %APPDATA%\Claude\claude_desktop_config.json
 * Linux: ~/.config/Claude/claude_desktop_config.json
 */
export function claudeDesktopConfigPath(home, platform = osPlatform()) {
    if (platform === "darwin") {
        return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    }
    if (platform === "win32") {
        // gramatr-allow: C1 — Windows fallback for APPDATA when not present
        const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
        return join(appData, "Claude", "claude_desktop_config.json");
    }
    return join(home, ".config", "Claude", "claude_desktop_config.json");
}
/** Resolve the bundled SessionEnd hook script source inside @gramatr/mcp. */
export function resolveBundledSessionEndHookSource() {
    const here = fileURLToPath(import.meta.url);
    const pkgRoot = resolve(dirname(here), "..", "..");
    const candidate = join(pkgRoot, "scripts", SESSION_END_SCRIPT_FILENAME);
    if (existsSync(candidate))
        return candidate;
    const devCandidate = resolve(dirname(here), "..", "..", "scripts", SESSION_END_SCRIPT_FILENAME);
    return devCandidate;
}
/** Resolve the bundled SessionStart hook script source inside @gramatr/mcp (#2475). */
export function resolveBundledSessionStartHookSource() {
    const here = fileURLToPath(import.meta.url);
    const pkgRoot = resolve(dirname(here), "..", "..");
    const candidate = join(pkgRoot, "scripts", SESSION_START_SCRIPT_FILENAME);
    if (existsSync(candidate))
        return candidate;
    const devCandidate = resolve(dirname(here), "..", "..", "scripts", SESSION_START_SCRIPT_FILENAME);
    return devCandidate;
}
/** Resolve the bundled Stop hook script source inside @gramatr/mcp (#2476). */
export function resolveBundledStopHookSource() {
    const here = fileURLToPath(import.meta.url);
    const pkgRoot = resolve(dirname(here), "..", "..");
    const candidate = join(pkgRoot, "scripts", STOP_HOOK_SCRIPT_FILENAME);
    if (existsSync(candidate))
        return candidate;
    const devCandidate = resolve(dirname(here), "..", "..", "scripts", STOP_HOOK_SCRIPT_FILENAME);
    return devCandidate;
}
/** Resolve the bundled hook script source inside the @gramatr/mcp package. */
export function resolveBundledHookSource() {
    // Compiled output lives at packages/mcp/dist/bin/install.js.
    // Source lives at packages/mcp/src/bin/install.ts.
    // The script ships from packages/mcp/scripts/hook-userpromptsubmit.sh
    // and is included in the npm tarball via the package "files" array.
    const here = fileURLToPath(import.meta.url);
    // Walk up to the package root (two parents from dist/bin/install.js,
    // and src/bin/install.ts both land at packages/mcp/).
    const pkgRoot = resolve(dirname(here), "..", "..");
    const candidate = join(pkgRoot, "scripts", HOOK_SCRIPT_FILENAME);
    if (existsSync(candidate))
        return candidate;
    // Fallback for ts-run during development.
    const devCandidate = resolve(dirname(here), "..", "..", "scripts", HOOK_SCRIPT_FILENAME);
    return devCandidate;
}
// ── atomic IO ──────────────────────────────────────────────────────────────
function ensureDir(path) {
    mkdirSync(path, { recursive: true });
}
function readFileOr(path, fallback) {
    try {
        return readFileSync(path, "utf8");
    }
    catch {
        return fallback;
    }
}
function parseJsonOr(raw, fallback) {
    if (raw === null)
        return fallback;
    try {
        const parsed = JSON.parse(raw);
        return (parsed ?? fallback);
    }
    catch {
        return fallback;
    }
}
function atomicWriteFile(path, content, mode = 0o644) {
    ensureDir(dirname(path));
    const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmp, content, { mode });
    renameSync(tmp, path);
}
function backupFile(path) {
    if (!existsSync(path))
        return null;
    const ts = Math.floor(Date.now() / 1000);
    const dest = `${path}.bak-${ts}`;
    copyFileSync(path, dest);
    return dest;
}
export function buildHookCommand(home) {
    return `${gramatrHookScriptPath(home)} ${HOOK_OWNER_TAG}`;
}
export function buildSessionEndHookCommand(home) {
    return `${gramatrSessionEndScriptPath(home)} ${SESSION_END_OWNER_TAG}`;
}
export function buildSessionStartHookCommand(home) {
    return `${gramatrSessionStartScriptPath(home)} ${SESSION_START_OWNER_TAG}`;
}
export function buildStopHookCommand(home) {
    return `${gramatrStopScriptPath(home)} ${STOP_HOOK_OWNER_TAG}`;
}
function isGramatrHookCommand(cmd) {
    if (cmd.includes(HOOK_OWNER_TAG))
        return true;
    if (cmd.includes(SESSION_END_OWNER_TAG))
        return true;
    if (cmd.includes(SESSION_START_OWNER_TAG))
        return true;
    if (cmd.includes(STOP_HOOK_OWNER_TAG))
        return true;
    // Legacy detection: any reference to gramatr-hook, gramatr-mcp,
    // hook-userpromptsubmit, hook-sessionend, hook-sessionstart, hook-stop, or ~/.gramatr/ path.
    return (cmd.includes("gramatr-hook") ||
        cmd.includes("@gramatr/mcp") ||
        cmd.includes(HOOK_SCRIPT_FILENAME) ||
        cmd.includes(SESSION_END_SCRIPT_FILENAME) ||
        cmd.includes(SESSION_START_SCRIPT_FILENAME) ||
        cmd.includes(STOP_HOOK_SCRIPT_FILENAME) ||
        cmd.includes(".gramatr/"));
}
/**
 * Merge the UserPromptSubmit hook entry into the settings object. Returns
 * { next, legacyRemoved } where legacyRemoved counts hook entries that
 * referenced gramatr but were stale (different script path / event).
 *
 * Behaviour:
 *   - Removes ALL legacy gramatr-tagged commands across every hook event
 *     when removeLegacy=true (matches issue spec: 14-handler scaffold).
 *   - Inserts a single UserPromptSubmit entry pointing at our owned script.
 *   - No-ops when the same entry already exists with the same command.
 */
export function mergeUserPromptSubmitHookIntoSettings(settings, home, removeLegacy) {
    const cmd = buildHookCommand(home);
    const hooks = { ...(settings.hooks ?? {}) };
    let legacyRemoved = 0;
    if (removeLegacy) {
        for (const [event, entries] of Object.entries(hooks)) {
            if (!Array.isArray(entries))
                continue;
            const filtered = [];
            for (const entry of entries) {
                const cmds = Array.isArray(entry.hooks) ? entry.hooks : [];
                const keptCmds = cmds.filter((c) => {
                    const v = typeof c.command === "string" ? c.command : "";
                    if (!v)
                        return true;
                    if (isGramatrHookCommand(v)) {
                        legacyRemoved += 1;
                        return false;
                    }
                    return true;
                });
                if (keptCmds.length > 0) {
                    filtered.push({ ...entry, hooks: keptCmds });
                }
                else if (cmds.length === 0) {
                    filtered.push(entry);
                }
            }
            if (filtered.length > 0) {
                hooks[event] = filtered;
            }
            else {
                delete hooks[event];
            }
        }
    }
    // Add our entry. Preserve any non-gramatr UserPromptSubmit entries.
    const ups = Array.isArray(hooks.UserPromptSubmit) ? [...hooks.UserPromptSubmit] : [];
    const alreadyPresent = ups.some((e) => (e.hooks ?? []).some((c) => c.command === cmd));
    if (!alreadyPresent) {
        ups.push({
            matcher: "*",
            hooks: [{ type: "command", command: cmd }],
        });
    }
    hooks.UserPromptSubmit = ups;
    // Add SessionEnd entry. Preserve any non-gramatr SessionEnd entries.
    const seCmd = buildSessionEndHookCommand(home);
    const seEntries = Array.isArray(hooks.SessionEnd) ? [...hooks.SessionEnd] : [];
    const seAlreadyPresent = seEntries.some((e) => (e.hooks ?? []).some((c) => c.command === seCmd));
    if (!seAlreadyPresent) {
        seEntries.push({
            matcher: "*",
            hooks: [{ type: "command", command: seCmd }],
        });
    }
    hooks.SessionEnd = seEntries;
    // Add SessionStart entry. Preserve any non-gramatr SessionStart entries (#2475).
    const ssCmd = buildSessionStartHookCommand(home);
    const ssEntries = Array.isArray(hooks.SessionStart) ? [...hooks.SessionStart] : [];
    const ssAlreadyPresent = ssEntries.some((e) => (e.hooks ?? []).some((c) => c.command === ssCmd));
    if (!ssAlreadyPresent) {
        ssEntries.push({
            matcher: "*",
            hooks: [{ type: "command", command: ssCmd }],
        });
    }
    hooks.SessionStart = ssEntries;
    // Add Stop entry. Preserve any non-gramatr Stop entries (#2476).
    const stopCmd = buildStopHookCommand(home);
    const stopEntries = Array.isArray(hooks.Stop) ? [...hooks.Stop] : [];
    const stopAlreadyPresent = stopEntries.some((e) => (e.hooks ?? []).some((c) => c.command === stopCmd));
    if (!stopAlreadyPresent) {
        stopEntries.push({
            matcher: "*",
            hooks: [{ type: "command", command: stopCmd }],
        });
    }
    hooks.Stop = stopEntries;
    return { next: { ...settings, hooks }, legacyRemoved };
}
/**
 * Inverse of mergeUserPromptSubmitHookIntoSettings — strip gramatr
 * UserPromptSubmit entries (and any other gramatr-tagged hook commands
 * left behind), preserve non-gramatr hooks intact.
 */
export function removeUserPromptSubmitHookFromSettings(settings) {
    const hooks = { ...(settings.hooks ?? {}) };
    let removed = 0;
    for (const [event, entries] of Object.entries(hooks)) {
        if (!Array.isArray(entries))
            continue;
        const filtered = [];
        for (const entry of entries) {
            const cmds = Array.isArray(entry.hooks) ? entry.hooks : [];
            const keptCmds = cmds.filter((c) => {
                const v = typeof c.command === "string" ? c.command : "";
                if (!v)
                    return true;
                if (isGramatrHookCommand(v)) {
                    removed += 1;
                    return false;
                }
                return true;
            });
            if (keptCmds.length > 0) {
                filtered.push({ ...entry, hooks: keptCmds });
            }
            else if (cmds.length === 0) {
                filtered.push(entry);
            }
        }
        if (filtered.length > 0) {
            hooks[event] = filtered;
        }
        else {
            delete hooks[event];
        }
    }
    const next = { ...settings };
    if (Object.keys(hooks).length > 0) {
        next.hooks = hooks;
    }
    else {
        delete next.hooks;
    }
    return { next, removed };
}
// ── CLAUDE.md sentinel block merge ─────────────────────────────────────────
/**
 * Strip the meta-instruction preamble from the bundled doc so only the
 * canonical section ships into ~/.claude/CLAUDE.md.
 *
 * The doc at docs/global-claude-md-gramatr-section.md begins with a
 * "# gramatr global CLAUDE.md section" + intro paragraph + "---" rule.
 * Everything after the `---` is the section body.
 */
export function extractCanonicalSection(docText) {
    const idx = docText.indexOf("\n---\n");
    if (idx === -1)
        return docText.trim();
    return docText.slice(idx + 5).trim();
}
/** Sentinel-safe upsert into CLAUDE.md. Preserves all out-of-block content. */
export function upsertGramatrSection(existing, sectionBody) {
    const block = `${GRAMATR_MD_START}\n${sectionBody.trim()}\n${GRAMATR_MD_END}`;
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escape(GRAMATR_MD_START)}[\\s\\S]*?${escape(GRAMATR_MD_END)}`, "m");
    if (re.test(existing)) {
        return existing.replace(re, block);
    }
    const trimmed = existing.trimEnd();
    return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}
/** Sentinel-safe removal from CLAUDE.md. */
export function stripGramatrSection(existing) {
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\n*${escape(GRAMATR_MD_START)}[\\s\\S]*?${escape(GRAMATR_MD_END)}\\n*`, "m");
    return (existing
        .replace(re, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd() + "\n");
}
function listMatching(dir, predicate) {
    try {
        return readdirSync(dir)
            .filter(predicate)
            .map((n) => join(dir, n));
    }
    catch {
        return [];
    }
}
function detectLegacyArtifacts(home) {
    const out = [];
    const gdir = gramatrDir(home);
    const bin = join(gdir, "bin");
    for (const p of listMatching(bin, (n) => n.startsWith("gramatr-hook")))
        out.push(p);
    for (const p of listMatching(gdir, (n) => n.startsWith("state.db")))
        out.push(p);
    const debug = join(gdir, "debug");
    if (existsSync(debug))
        out.push(debug);
    const cdir = join(home, ".claude");
    for (const p of listMatching(cdir, (n) => /^mcp-needs-auth-cache\.json\.bak-/.test(n))) {
        out.push(p);
    }
    return out;
}
function removeLegacyArtifacts(paths, dryRun) {
    if (dryRun)
        return { removed: paths };
    const removed = [];
    for (const p of paths) {
        try {
            const s = statSync(p);
            if (s.isDirectory()) {
                rmSync(p, { recursive: true, force: true });
            }
            else {
                unlinkSync(p);
            }
            removed.push(p);
        }
        catch {
            /* best-effort */
        }
    }
    return { removed };
}
// ── legacy slash-command cleanup (#2490) ──────────────────────────────────
/** Filenames in ~/.claude/commands/ known to be gramatr-flavored legacy. */
const LEGACY_SLASH_COMMAND_FILENAMES = new Set([
    "save-handoff.md",
    "gramatr-restore.md",
    "gramatr-compact.md",
]);
/**
 * Heuristic: file content looks gramatr-flavored if it references retired
 * daemon paths or the gramatr namespace.
 */
function isGramatrFlavoredSlashCommand(content) {
    return (content.includes("~/.gramatr/.state/") ||
        content.includes(".gramatr/.state/") ||
        content.includes("~/.gramatr/bin/gramatr-hook") ||
        content.includes(".gramatr/bin/gramatr-hook") ||
        /\bgrāmatr\b/i.test(content) ||
        /\bgramatr\b/i.test(content));
}
/**
 * Scan ~/.claude/commands/*.md for legacy gramatr-flavored slash commands.
 * Returns absolute paths of files that match.
 *
 * Match rules:
 *   - Filename in LEGACY_SLASH_COMMAND_FILENAMES AND content gramatr-flavored.
 *   - OR content references retired daemon paths (~/.gramatr/.state/, etc.).
 *
 * Non-gramatr slash commands are preserved.
 */
export function detectLegacySlashCommands(home) {
    const dir = claudeCommandsDir(home);
    let files;
    try {
        files = readdirSync(dir).filter((n) => n.endsWith(".md"));
    }
    catch {
        return [];
    }
    const out = [];
    for (const name of files) {
        const path = join(dir, name);
        let content = "";
        try {
            content = readFileSync(path, "utf8");
        }
        catch {
            continue;
        }
        const knownStale = LEGACY_SLASH_COMMAND_FILENAMES.has(name);
        const refsRetiredPath = content.includes("~/.gramatr/.state/") ||
            content.includes(".gramatr/.state/") ||
            content.includes("~/.gramatr/bin/gramatr-hook") ||
            content.includes(".gramatr/bin/gramatr-hook");
        if (refsRetiredPath) {
            out.push(path);
            continue;
        }
        if (knownStale && isGramatrFlavoredSlashCommand(content)) {
            out.push(path);
        }
    }
    return out;
}
/** Remove the given slash-command files. Best-effort, returns removed paths. */
export function cleanupLegacySlashCommands(home, dryRun = false) {
    const matches = detectLegacySlashCommands(home);
    if (dryRun)
        return matches;
    const removed = [];
    for (const p of matches) {
        try {
            unlinkSync(p);
            removed.push(p);
        }
        catch {
            /* best-effort */
        }
    }
    return removed;
}
// ── client detection (#2472) ──────────────────────────────────────────────
/**
 * Detect which client this machine looks like:
 *   - claude-code if ~/.claude/settings.json exists OR ~/.claude.json has mcpServers
 *   - else claude-desktop if claude_desktop_config.json exists
 *   - else claude-web
 */
export function detectClient(home, platform = osPlatform()) {
    if (existsSync(claudeSettingsPath(home)))
        return "claude-code";
    const claudeJsonPath = join(home, ".claude.json");
    if (existsSync(claudeJsonPath)) {
        try {
            const raw = readFileSync(claudeJsonPath, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && parsed.mcpServers) {
                return "claude-code";
            }
        }
        catch {
            /* fall through */
        }
    }
    // ~/.claude/ exists (even empty) → assume claude-code is being set up.
    if (existsSync(join(home, ".claude")))
        return "claude-code";
    if (existsSync(claudeDesktopConfigPath(home, platform)))
        return "claude-desktop";
    return "claude-web";
}
// ── auth helpers ──────────────────────────────────────────────────────────
export function hasValidToken(home) {
    const path = gramatrTokenPath(home);
    try {
        const raw = readFileSync(path, "utf8");
        const parsed = JSON.parse(raw);
        return typeof parsed.token === "string" && parsed.token.length > 0;
    }
    catch {
        return false;
    }
}
// ── install / uninstall orchestrators ─────────────────────────────────────
export async function install(opts) {
    const log = opts.log ?? ((m) => process.stderr.write(`${m}\n`));
    const dryRun = !!opts.dryRun;
    const cleanLegacy = !!opts.cleanLegacy || !!opts.nonInteractive;
    const platform = opts.platformOverride ?? osPlatform();
    const client = opts.client ?? detectClient(opts.home, platform);
    const summary = {
        client,
        hookScriptWritten: false,
        sessionEndScriptWritten: false,
        sessionStartScriptWritten: false,
        stopScriptWritten: false,
        settingsUpdated: false,
        claudeMdUpdated: false,
        desktopConfigUpdated: false,
        legacyEntriesRemoved: 0,
        legacyFilesRemoved: [],
        legacySlashCommandsRemoved: [],
        backups: [],
    };
    // Dispatch to non-claude-code branches early.
    if (client === "claude-web") {
        summary.webInstructions = buildWebInstallInstructions(opts.mcpServerUrl);
        log("[gramatr] claude-web detected — no local filesystem changes.");
        log(summary.webInstructions);
        return summary;
    }
    if (client === "claude-desktop") {
        const cfgPath = opts.desktopConfigPathOverride ?? claudeDesktopConfigPath(opts.home, platform);
        const updated = installClaudeDesktop({
            configPath: cfgPath,
            home: opts.home,
            mcpServerUrl: opts.mcpServerUrl,
            dryRun,
            log,
        });
        summary.desktopConfigUpdated = updated.updated;
        if (updated.backup)
            summary.backups.push(updated.backup);
        log(`[gramatr] claude-desktop ${dryRun ? "(dry-run) " : ""}config at ${cfgPath}`);
        log("[gramatr] restart Claude Desktop after install to load the new MCP server.");
        return summary;
    }
    // ─── claude-code path (legacy default — full hook + settings + CLAUDE.md) ──
    // 1. Hook script
    const hookSrc = opts.hookSourcePath ?? resolveBundledHookSource();
    const hookDst = gramatrHookScriptPath(opts.home);
    const desiredHook = readFileOr(hookSrc, null);
    if (desiredHook === null) {
        log(`[gramatr] hook source missing: ${hookSrc}`);
    }
    else {
        const currentHook = readFileOr(hookDst, null);
        if (currentHook !== desiredHook) {
            if (!dryRun) {
                ensureDir(dirname(hookDst));
                atomicWriteFile(hookDst, desiredHook, 0o755);
                try {
                    chmodSync(hookDst, 0o755);
                }
                catch {
                    /* mode flag on write covered most cases */
                }
            }
            summary.hookScriptWritten = true;
            log(`[gramatr] hook script ${dryRun ? "(dry-run) " : ""}→ ${hookDst}`);
        }
    }
    // 1b. SessionEnd hook script
    const seHookSrc = opts.sessionEndHookSourcePath ?? resolveBundledSessionEndHookSource();
    const seHookDst = gramatrSessionEndScriptPath(opts.home);
    const seDesired = readFileOr(seHookSrc, null);
    if (seDesired === null) {
        log(`[gramatr] SessionEnd hook source missing: ${seHookSrc}`);
    }
    else {
        const current = readFileOr(seHookDst, null);
        if (current !== seDesired) {
            if (!dryRun) {
                ensureDir(dirname(seHookDst));
                atomicWriteFile(seHookDst, seDesired, 0o755);
                try {
                    chmodSync(seHookDst, 0o755);
                }
                catch {
                    /* mode flag on write covered most cases */
                }
            }
            summary.sessionEndScriptWritten = true;
            log(`[gramatr] SessionEnd hook script ${dryRun ? "(dry-run) " : ""}→ ${seHookDst}`);
        }
    }
    // 1c. SessionStart hook script (#2475)
    const ssHookSrc = opts.sessionStartHookSourcePath ?? resolveBundledSessionStartHookSource();
    const ssHookDst = gramatrSessionStartScriptPath(opts.home);
    const ssDesired = readFileOr(ssHookSrc, null);
    if (ssDesired === null) {
        log(`[gramatr] SessionStart hook source missing: ${ssHookSrc}`);
    }
    else {
        const current = readFileOr(ssHookDst, null);
        if (current !== ssDesired) {
            if (!dryRun) {
                ensureDir(dirname(ssHookDst));
                atomicWriteFile(ssHookDst, ssDesired, 0o755);
                try {
                    chmodSync(ssHookDst, 0o755);
                }
                catch {
                    /* mode flag on write covered most cases */
                }
            }
            summary.sessionStartScriptWritten = true;
            log(`[gramatr] SessionStart hook script ${dryRun ? "(dry-run) " : ""}→ ${ssHookDst}`);
        }
    }
    // 1d. Stop hook script (#2476)
    const stopHookSrc = opts.stopHookSourcePath ?? resolveBundledStopHookSource();
    const stopHookDst = gramatrStopScriptPath(opts.home);
    const stopDesired = readFileOr(stopHookSrc, null);
    if (stopDesired === null) {
        log(`[gramatr] Stop hook source missing: ${stopHookSrc}`);
    }
    else {
        const current = readFileOr(stopHookDst, null);
        if (current !== stopDesired) {
            if (!dryRun) {
                ensureDir(dirname(stopHookDst));
                atomicWriteFile(stopHookDst, stopDesired, 0o755);
                try {
                    chmodSync(stopHookDst, 0o755);
                }
                catch {
                    /* mode flag on write covered most cases */
                }
            }
            summary.stopScriptWritten = true;
            log(`[gramatr] Stop hook script ${dryRun ? "(dry-run) " : ""}→ ${stopHookDst}`);
        }
    }
    // 2. settings.json
    const settingsPath = claudeSettingsPath(opts.home);
    const settingsRaw = readFileOr(settingsPath, null);
    const settings = parseJsonOr(settingsRaw, {});
    const merged = mergeUserPromptSubmitHookIntoSettings(settings, opts.home, cleanLegacy);
    summary.legacyEntriesRemoved = merged.legacyRemoved;
    const desiredSettings = JSON.stringify(merged.next, null, 2) + "\n";
    const currentSettingsText = settingsRaw ?? "";
    if (desiredSettings !== currentSettingsText) {
        if (!dryRun) {
            const bak = backupFile(settingsPath);
            if (bak)
                summary.backups.push(bak);
            atomicWriteFile(settingsPath, desiredSettings, 0o600);
        }
        summary.settingsUpdated = true;
        log(`[gramatr] settings.json ${dryRun ? "(dry-run) " : ""}→ UserPromptSubmit hook merged` +
            (merged.legacyRemoved > 0
                ? ` (removed ${merged.legacyRemoved} legacy entr${merged.legacyRemoved === 1 ? "y" : "ies"})`
                : ""));
    }
    // 3. CLAUDE.md
    const mdPath = claudeMarkdownPath(opts.home);
    const sectionBody = opts.claudeMdSection ?? loadCanonicalSection();
    const currentMd = readFileOr(mdPath, "");
    const desiredMd = upsertGramatrSection(currentMd, sectionBody);
    if (desiredMd !== currentMd) {
        if (!dryRun) {
            const bak = backupFile(mdPath);
            if (bak)
                summary.backups.push(bak);
            atomicWriteFile(mdPath, desiredMd, 0o644);
        }
        summary.claudeMdUpdated = true;
        log(`[gramatr] CLAUDE.md ${dryRun ? "(dry-run) " : ""}→ sentinel block upserted`);
    }
    // 4. Legacy cruft (only with --clean-legacy / non-interactive — we never
    // delete files behind the user's back in interactive runs).
    if (cleanLegacy) {
        const legacy = detectLegacyArtifacts(opts.home);
        if (legacy.length > 0) {
            const res = removeLegacyArtifacts(legacy, dryRun);
            summary.legacyFilesRemoved = res.removed;
            for (const p of res.removed)
                log(`[gramatr] cleaned ${dryRun ? "(dry-run) " : ""}${p}`);
        }
        // Also clean up legacy slash commands (#2490).
        const removedCmds = cleanupLegacySlashCommands(opts.home, dryRun);
        summary.legacySlashCommandsRemoved = removedCmds;
        for (const p of removedCmds) {
            log(`[gramatr] cleaned legacy slash command ${dryRun ? "(dry-run) " : ""}${p}`);
        }
    }
    else {
        const legacy = detectLegacyArtifacts(opts.home);
        if (legacy.length > 0) {
            log(`[gramatr] note: detected ${legacy.length} legacy artifact${legacy.length === 1 ? "" : "s"}; rerun with --clean-legacy to remove`);
        }
        const staleCmds = detectLegacySlashCommands(opts.home);
        if (staleCmds.length > 0) {
            log(`[gramatr] note: detected ${staleCmds.length} legacy slash command${staleCmds.length === 1 ? "" : "s"}; rerun with --clean-legacy to remove`);
        }
    }
    return summary;
}
/**
 * Build the claude-desktop mcpServers entry for gramatr. Uses HTTP transport
 * since Desktop supports it and we get a free Bearer token from ~/.gramatr.json.
 */
export function buildDesktopMcpEntry(home, serverUrl = "https://api.gramatr.com/mcp") {
    const token = readBearerToken(home);
    const headers = {};
    if (token)
        headers.Authorization = `Bearer ${token}`;
    return {
        type: "http",
        url: serverUrl,
        headers,
    };
}
function readBearerToken(home) {
    try {
        const raw = readFileSync(gramatrTokenPath(home), "utf8");
        const parsed = JSON.parse(raw);
        return typeof parsed.token === "string" && parsed.token.length > 0 ? parsed.token : null;
    }
    catch {
        return null;
    }
}
/**
 * Merge gramatr entry into a claude-desktop config object. Returns the next
 * object and whether a change was made. Idempotent.
 */
export function mergeDesktopConfig(current, entry) {
    const servers = { ...(current.mcpServers ?? {}) };
    const existing = servers.gramatr;
    const same = existing && JSON.stringify(existing) === JSON.stringify(entry);
    if (same)
        return { next: current, changed: false };
    servers.gramatr = entry;
    return { next: { ...current, mcpServers: servers }, changed: true };
}
function installClaudeDesktop(opts) {
    const entry = buildDesktopMcpEntry(opts.home, opts.mcpServerUrl);
    const raw = readFileOr(opts.configPath, null);
    const current = parseJsonOr(raw, {});
    const { next, changed } = mergeDesktopConfig(current, entry);
    if (!changed)
        return { updated: false, backup: null };
    const desired = JSON.stringify(next, null, 2) + "\n";
    if (opts.dryRun)
        return { updated: true, backup: null };
    const backup = backupFile(opts.configPath);
    atomicWriteFile(opts.configPath, desired, 0o600);
    return { updated: true, backup };
}
/** Remove gramatr entry from claude-desktop config. */
export function uninstallDesktopConfig(current) {
    if (!current.mcpServers || !current.mcpServers.gramatr) {
        return { next: current, changed: false };
    }
    const servers = { ...current.mcpServers };
    delete servers.gramatr;
    const next = { ...current };
    if (Object.keys(servers).length > 0) {
        next.mcpServers = servers;
    }
    else {
        delete next.mcpServers;
    }
    return { next, changed: true };
}
// ── claude-web instructions (#2472) ───────────────────────────────────────
/**
 * Build the copy-paste instructions for claude-web. No filesystem writes.
 * Combines connector steps with the canonical prompt suggestion block.
 */
export function buildWebInstallInstructions(serverUrl) {
    const conn = buildConnectorInstructions({ serverUrl, target: "claude-web" });
    const suggestion = buildPromptSuggestion("claude-web");
    const lines = [];
    lines.push("# gramatr — claude-web manual setup");
    lines.push("");
    lines.push("Claude Web (claude.ai) has no local install. Follow these steps:");
    lines.push("");
    for (let i = 0; i < conn.steps.length; i++) {
        lines.push(`  ${i + 1}. ${conn.steps[i]}`);
    }
    lines.push("");
    lines.push("Paste the following block into Settings > Profile > Custom Instructions:");
    lines.push("");
    lines.push("---");
    lines.push(suggestion);
    lines.push("---");
    return lines.join("\n");
}
export async function uninstall(opts) {
    const log = opts.log ?? ((m) => process.stderr.write(`${m}\n`));
    const dryRun = !!opts.dryRun;
    const platform = opts.platformOverride ?? osPlatform();
    const client = opts.client ?? detectClient(opts.home, platform);
    const summary = {
        client,
        hookEntryRemoved: false,
        claudeMdSectionRemoved: false,
        hookScriptRemoved: false,
        sessionEndScriptRemoved: false,
        sessionStartScriptRemoved: false,
        stopScriptRemoved: false,
        desktopConfigUpdated: false,
        legacySlashCommandsRemoved: [],
        tokenRemoved: false,
        backups: [],
    };
    if (client === "claude-web") {
        log("[gramatr] claude-web: no local state to remove. Disconnect the connector inside claude.ai.");
        if (opts.purge) {
            const tokPath = gramatrTokenPath(opts.home);
            if (existsSync(tokPath)) {
                if (!dryRun)
                    unlinkSync(tokPath);
                summary.tokenRemoved = true;
            }
        }
        return summary;
    }
    if (client === "claude-desktop") {
        const cfgPath = opts.desktopConfigPathOverride ?? claudeDesktopConfigPath(opts.home, platform);
        const raw = readFileOr(cfgPath, null);
        if (raw !== null) {
            const current = parseJsonOr(raw, {});
            const { next, changed } = uninstallDesktopConfig(current);
            if (changed) {
                if (!dryRun) {
                    const bak = backupFile(cfgPath);
                    if (bak)
                        summary.backups.push(bak);
                    atomicWriteFile(cfgPath, JSON.stringify(next, null, 2) + "\n", 0o600);
                }
                summary.desktopConfigUpdated = true;
                log(`[gramatr] claude-desktop ${dryRun ? "(dry-run) " : ""}removed gramatr mcpServers entry`);
            }
        }
        if (opts.purge) {
            const tokPath = gramatrTokenPath(opts.home);
            if (existsSync(tokPath)) {
                if (!dryRun)
                    unlinkSync(tokPath);
                summary.tokenRemoved = true;
            }
        }
        return summary;
    }
    // 1. settings.json
    const settingsPath = claudeSettingsPath(opts.home);
    const settingsRaw = readFileOr(settingsPath, null);
    if (settingsRaw !== null) {
        const settings = parseJsonOr(settingsRaw, {});
        const stripped = removeUserPromptSubmitHookFromSettings(settings);
        if (stripped.removed > 0) {
            const next = JSON.stringify(stripped.next, null, 2) + "\n";
            if (!dryRun) {
                const bak = backupFile(settingsPath);
                if (bak)
                    summary.backups.push(bak);
                atomicWriteFile(settingsPath, next, 0o600);
            }
            summary.hookEntryRemoved = true;
            log(`[gramatr] settings.json ${dryRun ? "(dry-run) " : ""}→ removed ${stripped.removed} gramatr hook entr${stripped.removed === 1 ? "y" : "ies"}`);
        }
    }
    // 2. CLAUDE.md
    const mdPath = claudeMarkdownPath(opts.home);
    const currentMd = readFileOr(mdPath, null);
    if (currentMd !== null && currentMd.includes(GRAMATR_MD_START)) {
        const next = stripGramatrSection(currentMd);
        if (next !== currentMd) {
            if (!dryRun) {
                const bak = backupFile(mdPath);
                if (bak)
                    summary.backups.push(bak);
                atomicWriteFile(mdPath, next, 0o644);
            }
            summary.claudeMdSectionRemoved = true;
            log(`[gramatr] CLAUDE.md ${dryRun ? "(dry-run) " : ""}→ sentinel block removed`);
        }
    }
    // 3. hook script
    const hookDst = gramatrHookScriptPath(opts.home);
    if (existsSync(hookDst)) {
        if (!dryRun) {
            const bak = backupFile(hookDst);
            if (bak)
                summary.backups.push(bak);
            unlinkSync(hookDst);
        }
        summary.hookScriptRemoved = true;
        log(`[gramatr] hook script ${dryRun ? "(dry-run) " : ""}→ removed ${hookDst}`);
    }
    // 3b. SessionEnd hook script
    const seHookDst = gramatrSessionEndScriptPath(opts.home);
    if (existsSync(seHookDst)) {
        if (!dryRun) {
            const bak = backupFile(seHookDst);
            if (bak)
                summary.backups.push(bak);
            unlinkSync(seHookDst);
        }
        summary.sessionEndScriptRemoved = true;
        log(`[gramatr] SessionEnd hook script ${dryRun ? "(dry-run) " : ""}→ removed ${seHookDst}`);
    }
    // 3c. SessionStart hook script (#2475)
    const ssHookDst = gramatrSessionStartScriptPath(opts.home);
    if (existsSync(ssHookDst)) {
        if (!dryRun) {
            const bak = backupFile(ssHookDst);
            if (bak)
                summary.backups.push(bak);
            unlinkSync(ssHookDst);
        }
        summary.sessionStartScriptRemoved = true;
        log(`[gramatr] SessionStart hook script ${dryRun ? "(dry-run) " : ""}→ removed ${ssHookDst}`);
    }
    // 3d. Stop hook script (#2476)
    const stopHookDst = gramatrStopScriptPath(opts.home);
    if (existsSync(stopHookDst)) {
        if (!dryRun) {
            const bak = backupFile(stopHookDst);
            if (bak)
                summary.backups.push(bak);
            unlinkSync(stopHookDst);
        }
        summary.stopScriptRemoved = true;
        log(`[gramatr] Stop hook script ${dryRun ? "(dry-run) " : ""}→ removed ${stopHookDst}`);
    }
    // 3e. Legacy slash commands (always cleaned during uninstall; #2490).
    const removedCmds = cleanupLegacySlashCommands(opts.home, dryRun);
    summary.legacySlashCommandsRemoved = removedCmds;
    for (const p of removedCmds) {
        log(`[gramatr] removed legacy slash command ${dryRun ? "(dry-run) " : ""}${p}`);
    }
    // 4. token (only on --purge)
    if (opts.purge) {
        const tokPath = gramatrTokenPath(opts.home);
        if (existsSync(tokPath)) {
            if (!dryRun) {
                const bak = backupFile(tokPath);
                if (bak)
                    summary.backups.push(bak);
                unlinkSync(tokPath);
            }
            summary.tokenRemoved = true;
            log(`[gramatr] token ${dryRun ? "(dry-run) " : ""}→ removed ${tokPath}`);
        }
    }
    return summary;
}
// ── canonical section loader ──────────────────────────────────────────────
/** Locate the canonical section doc that ships in the repo. */
function loadCanonicalSection() {
    const here = fileURLToPath(import.meta.url);
    const candidates = [
        // From compiled dist/bin/install.js — walk up to repo root.
        resolve(dirname(here), "..", "..", "..", "..", "docs", "global-claude-md-gramatr-section.md"),
        // From source src/bin/install.ts in dev.
        resolve(dirname(here), "..", "..", "..", "..", "docs", "global-claude-md-gramatr-section.md"),
        // Packaged inside the npm tarball (alongside scripts/).
        resolve(dirname(here), "..", "..", "docs", "global-claude-md-gramatr-section.md"),
    ];
    for (const c of candidates) {
        if (existsSync(c))
            return extractCanonicalSection(readFileSync(c, "utf8"));
    }
    // Fallback: minimal inline copy so install still works if the doc
    // wasn't bundled into the npm tarball.
    return INLINE_FALLBACK_SECTION;
}
const INLINE_FALLBACK_SECTION = `## gramatr classification block — agent contract

If a \`<gramatr-classification>...</gramatr-classification>\` block appears in this turn's context, parse the JSON inside it and follow this protocol literally.

- \`call_route_request\`: invoke \`mcp__gramatr__route_request\` with \`directive.params_for_route_request\` verbatim.
- \`respond_directly\`: answer using only the block's classification + context.

After substantive work, call \`classification_feedback\` with \`was_correct\` based on whether the classification matched the actual work.
`;
// ── CLI entrypoints ───────────────────────────────────────────────────────
function resolveHome() {
    // gramatr-allow: C1 — CLI entry point, reads HOME for config path
    return process.env.HOME || process.env.USERPROFILE || "";
}
function parseClientFlag(argv) {
    for (const a of argv) {
        if (a.startsWith("--client=")) {
            const v = a.slice("--client=".length);
            if (v === "claude-code" || v === "claude-desktop" || v === "claude-web")
                return v;
            process.stderr.write(`[gramatr] unknown --client value: ${v} (expected claude-code|claude-desktop|claude-web)\n`);
        }
    }
    return undefined;
}
export async function runInstallCli(argv) {
    const home = resolveHome();
    if (!home) {
        process.stderr.write("[gramatr] HOME is not set; cannot install.\n");
        return 1;
    }
    const opts = {
        home,
        client: parseClientFlag(argv),
        cleanLegacy: argv.includes("--clean-legacy"),
        nonInteractive: argv.includes("--non-interactive") || argv.includes("--yes") || argv.includes("-y"),
        dryRun: argv.includes("--dry-run"),
    };
    // Auth check — defer to existing login flow when no token is present and
    // we're allowed to be interactive. We don't run device-flow in dry-run.
    if (!hasValidToken(home) && !opts.dryRun) {
        try {
            const { loginBrowser } = await import("./login.js");
            process.stderr.write("[gramatr] no token found; running login...\n");
            await loginBrowser();
        }
        catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[gramatr] login failed: ${detail}\n`);
            process.stderr.write("[gramatr] proceeding with install — re-run `gramatr login` later.\n");
        }
    }
    const summary = await install(opts);
    process.stderr.write("\n[gramatr] install summary:\n");
    process.stderr.write(`  client: ${summary.client}\n`);
    if (summary.client === "claude-web") {
        // Instructions already printed via log().
        return 0;
    }
    if (summary.client === "claude-desktop") {
        process.stderr.write(`  claude-desktop config: ${summary.desktopConfigUpdated ? "updated" : "up-to-date"}\n`);
        if (summary.backups.length > 0) {
            process.stderr.write(`  backups: ${summary.backups.length}\n`);
        }
        process.stderr.write("\n  Restart Claude Desktop to activate.\n");
        return 0;
    }
    process.stderr.write(`  hook script: ${summary.hookScriptWritten ? "written" : "up-to-date"}\n`);
    process.stderr.write(`  SessionEnd hook script: ${summary.sessionEndScriptWritten ? "written" : "up-to-date"}\n`);
    process.stderr.write(`  SessionStart hook script: ${summary.sessionStartScriptWritten ? "written" : "up-to-date"}\n`);
    process.stderr.write(`  Stop hook script: ${summary.stopScriptWritten ? "written" : "up-to-date"}\n`);
    process.stderr.write(`  settings.json: ${summary.settingsUpdated ? "updated" : "up-to-date"}\n`);
    process.stderr.write(`  CLAUDE.md: ${summary.claudeMdUpdated ? "updated" : "up-to-date"}\n`);
    if (summary.legacyEntriesRemoved > 0) {
        process.stderr.write(`  legacy hook entries removed: ${summary.legacyEntriesRemoved}\n`);
    }
    if (summary.legacyFilesRemoved.length > 0) {
        process.stderr.write(`  legacy files removed: ${summary.legacyFilesRemoved.length}\n`);
    }
    if (summary.legacySlashCommandsRemoved.length > 0) {
        process.stderr.write(`  legacy slash commands removed: ${summary.legacySlashCommandsRemoved.length}\n`);
    }
    if (summary.backups.length > 0) {
        process.stderr.write(`  backups: ${summary.backups.length}\n`);
        for (const b of summary.backups)
            process.stderr.write(`    ${b}\n`);
    }
    process.stderr.write("\n  Restart Claude Code to activate.\n");
    return 0;
}
export async function runUninstallCli(argv) {
    const home = resolveHome();
    if (!home) {
        process.stderr.write("[gramatr] HOME is not set; cannot uninstall.\n");
        return 1;
    }
    const summary = await uninstall({
        home,
        client: parseClientFlag(argv),
        purge: argv.includes("--purge"),
        dryRun: argv.includes("--dry-run"),
    });
    process.stderr.write("\n[gramatr] uninstall summary:\n");
    process.stderr.write(`  client: ${summary.client}\n`);
    if (summary.client === "claude-web") {
        process.stderr.write("  (no local state — disconnect the connector inside claude.ai)\n");
        if (summary.tokenRemoved)
            process.stderr.write(`  token: removed\n`);
        return 0;
    }
    if (summary.client === "claude-desktop") {
        process.stderr.write(`  claude-desktop config: ${summary.desktopConfigUpdated ? "updated" : "not present"}\n`);
        if (summary.tokenRemoved)
            process.stderr.write(`  token: removed\n`);
        return 0;
    }
    process.stderr.write(`  hook entry: ${summary.hookEntryRemoved ? "removed" : "not present"}\n`);
    process.stderr.write(`  CLAUDE.md section: ${summary.claudeMdSectionRemoved ? "removed" : "not present"}\n`);
    process.stderr.write(`  hook script: ${summary.hookScriptRemoved ? "removed" : "not present"}\n`);
    process.stderr.write(`  SessionEnd hook script: ${summary.sessionEndScriptRemoved ? "removed" : "not present"}\n`);
    process.stderr.write(`  SessionStart hook script: ${summary.sessionStartScriptRemoved ? "removed" : "not present"}\n`);
    process.stderr.write(`  Stop hook script: ${summary.stopScriptRemoved ? "removed" : "not present"}\n`);
    if (summary.legacySlashCommandsRemoved.length > 0) {
        process.stderr.write(`  legacy slash commands removed: ${summary.legacySlashCommandsRemoved.length}\n`);
    }
    if (summary.tokenRemoved)
        process.stderr.write(`  token: removed\n`);
    if (summary.backups.length > 0) {
        process.stderr.write(`  backups: ${summary.backups.length}\n`);
    }
    return 0;
}
//# sourceMappingURL=install.js.map