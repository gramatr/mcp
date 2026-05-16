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
/** Sentinel pair carved into ~/.claude/CLAUDE.md. */
export declare const GRAMATR_MD_START = "<!-- GRAMATR-START -->";
export declare const GRAMATR_MD_END = "<!-- GRAMATR-END -->";
/** Target client for `gramatr install` (#2472, #2490). */
export type InstallClient = "claude-code" | "claude-desktop" | "claude-web";
export interface InstallOptions {
    home: string;
    /** Target client; default auto-detect. */
    client?: InstallClient;
    /**
     * When true, preserve legacy gramatr-tagged hook entries instead of
     * stripping them. Default (false) is the new clean-on behaviour shipped in
     * v0.20.6 — every reinstall sweeps stale grāmatr-owned entries and
     * re-adds only the canonical set.
     */
    keepLegacy?: boolean;
    /** Suppress interactive prompts. */
    nonInteractive?: boolean;
    /** Pre-authorization tier for grāmatr MCP tools in permissions.allow. */
    preAuthTier?: "none" | "read" | "all";
    /**
     * Project working directory whose `.claude/settings.json` should be swept
     * for stale grāmatr-owned hook entries on install/uninstall. Defaults to
     * `process.cwd()` when not provided.
     */
    projectCwd?: string;
    /**
     * Test/automation hook for the interactive pre-auth prompt. When provided,
     * `install()` calls this instead of reading stdin.
     */
    preAuthPrompt?: () => Promise<"none" | "read" | "all">;
    /** Print intended actions only, no writes. */
    dryRun?: boolean;
    /** Override source location for the hook script (test injection). */
    hookSourcePath?: string;
    /** Override source location for the SessionEnd hook script (test injection). */
    sessionEndHookSourcePath?: string;
    /** Override source location for the SessionStart hook script (test injection). */
    sessionStartHookSourcePath?: string;
    /** Override source location for the Stop hook script (test injection). */
    stopHookSourcePath?: string;
    /** Override canonical CLAUDE.md content to inject (test injection). */
    claudeMdSection?: string;
    /** Logger sink — defaults to process.stderr. */
    log?: (line: string) => void;
    /** Override platform for tests (darwin|win32|linux). */
    platformOverride?: NodeJS.Platform;
    /** Override claude-desktop config path for tests. */
    desktopConfigPathOverride?: string;
    /** MCP server URL written into claude-desktop config (default https://api.gramatr.com/mcp). */
    mcpServerUrl?: string;
}
export interface UninstallOptions {
    home: string;
    /** Target client; default auto-detect. */
    client?: InstallClient;
    /** Also remove ~/.gramatr.json (token + config). */
    purge?: boolean;
    dryRun?: boolean;
    log?: (line: string) => void;
    /** Override platform for tests (darwin|win32|linux). */
    platformOverride?: NodeJS.Platform;
    /** Override claude-desktop config path for tests. */
    desktopConfigPathOverride?: string;
    /** Project cwd whose .claude/settings.json to sweep on uninstall. */
    projectCwd?: string;
}
interface InstallSummary {
    client: InstallClient;
    hookScriptWritten: boolean;
    sessionEndScriptWritten: boolean;
    sessionStartScriptWritten: boolean;
    stopScriptWritten: boolean;
    settingsUpdated: boolean;
    claudeMdUpdated: boolean;
    /** claude-desktop config file written/updated. */
    desktopConfigUpdated: boolean;
    /** claude-web returned instructions instead of writing files. */
    webInstructions?: string;
    legacyEntriesRemoved: number;
    legacyFilesRemoved: string[];
    legacySlashCommandsRemoved: string[];
    /** Sweep of `<cwd>/.claude/settings.json` for stale grāmatr hook entries. */
    projectSettingsCleaned: {
        path: string;
        removed: number;
    } | null;
    /** Pre-authorization tier applied to permissions.allow. */
    preAuthTier: "none" | "read" | "all";
    backups: string[];
}
interface UninstallSummary {
    client: InstallClient;
    hookEntryRemoved: boolean;
    claudeMdSectionRemoved: boolean;
    hookScriptRemoved: boolean;
    sessionEndScriptRemoved: boolean;
    sessionStartScriptRemoved: boolean;
    stopScriptRemoved: boolean;
    desktopConfigUpdated: boolean;
    legacySlashCommandsRemoved: string[];
    /** Sweep of `<cwd>/.claude/settings.json` for stale grāmatr hook entries. */
    projectSettingsCleaned: {
        path: string;
        removed: number;
    } | null;
    tokenRemoved: boolean;
    backups: string[];
}
export declare function claudeSettingsPath(home: string): string;
export declare function claudeMarkdownPath(home: string): string;
export declare function gramatrDir(home: string): string;
export declare function gramatrHookScriptPath(home: string): string;
export declare function gramatrSessionEndScriptPath(home: string): string;
export declare function gramatrSessionStartScriptPath(home: string): string;
export declare function gramatrStopScriptPath(home: string): string;
export declare function gramatrTokenPath(home: string): string;
/** Path to Claude Code slash-command directory. */
export declare function claudeCommandsDir(home: string): string;
/**
 * Resolve the claude_desktop_config.json path for the current platform.
 * macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
 * Windows: %APPDATA%\Claude\claude_desktop_config.json
 * Linux: ~/.config/Claude/claude_desktop_config.json
 */
export declare function claudeDesktopConfigPath(home: string, platform?: NodeJS.Platform): string;
/** Resolve the bundled SessionEnd hook script source inside @gramatr/mcp. */
export declare function resolveBundledSessionEndHookSource(): string;
/** Resolve the bundled SessionStart hook script source inside @gramatr/mcp (#2475). */
export declare function resolveBundledSessionStartHookSource(): string;
/** Resolve the bundled Stop hook script source inside @gramatr/mcp (#2476). */
export declare function resolveBundledStopHookSource(): string;
/** Resolve the bundled hook script source inside the @gramatr/mcp package. */
export declare function resolveBundledHookSource(): string;
interface HookCommand {
    type?: string;
    command?: string;
}
interface HookEntry {
    matcher?: string;
    hooks?: HookCommand[];
}
interface ClaudeSettings {
    hooks?: Record<string, HookEntry[]>;
    [k: string]: unknown;
}
export declare function buildHookCommand(home: string): string;
export declare function buildSessionEndHookCommand(home: string): string;
export declare function buildSessionStartHookCommand(home: string): string;
export declare function buildStopHookCommand(home: string): string;
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
export declare function mergeUserPromptSubmitHookIntoSettings(settings: ClaudeSettings, home: string, removeLegacy: boolean): {
    next: ClaudeSettings;
    legacyRemoved: number;
};
/**
 * Inverse of mergeUserPromptSubmitHookIntoSettings — strip gramatr
 * UserPromptSubmit entries (and any other gramatr-tagged hook commands
 * left behind), preserve non-gramatr hooks intact.
 */
export declare function removeUserPromptSubmitHookFromSettings(settings: ClaudeSettings): {
    next: ClaudeSettings;
    removed: number;
};
/**
 * Sweep stale grāmatr-owned hook entries out of a project's local
 * `<cwd>/.claude/settings.json`. grāmatr hooks belong in the user-level
 * config only — if they exist in a project's local settings (from an older
 * install or a manual copy), they cause duplicate hook firing.
 *
 * This function NEVER adds grāmatr hooks to project settings; it only
 * removes them. User-authored hook entries are preserved untouched.
 *
 * Returns `null` if `<cwd>/.claude/settings.json` does not exist, otherwise
 * `{ path, removed }` reporting the sweep result (removed=0 is valid).
 */
export declare function cleanProjectLevelHooks(cwd: string, dryRun: boolean): {
    path: string;
    removed: number;
} | null;
/**
 * Read-tier pattern set — glob forms applied to `permissions.allow`. Claude
 * Code supports trailing `*` wildcards in this list (verified against the
 * grāmatr stop-hook permission grooming logic).
 */
export declare const PRE_AUTH_READ_PATTERNS: readonly string[];
export declare const PRE_AUTH_ALL_PATTERN = "mcp__gramatr__*";
/**
 * Apply a pre-authorization tier to a ClaudeSettings object's
 * `permissions.allow` array. Strips any prior `mcp__gramatr__*` patterns
 * (including the wildcard, the read-tier set, and any specific tool
 * names) so re-runs swap cleanly between tiers without accumulation.
 */
export declare function applyPreAuthTier(settings: ClaudeSettings, tier: "none" | "read" | "all"): ClaudeSettings;
/**
 * Strip the meta-instruction preamble from the bundled doc so only the
 * canonical section ships into ~/.claude/CLAUDE.md.
 *
 * The doc at docs/global-claude-md-gramatr-section.md begins with a
 * "# gramatr global CLAUDE.md section" + intro paragraph + "---" rule.
 * Everything after the `---` is the section body.
 */
export declare function extractCanonicalSection(docText: string): string;
/** Sentinel-safe upsert into CLAUDE.md. Preserves all out-of-block content. */
export declare function upsertGramatrSection(existing: string, sectionBody: string): string;
/** Sentinel-safe removal from CLAUDE.md. */
export declare function stripGramatrSection(existing: string): string;
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
export declare function detectLegacySlashCommands(home: string): string[];
/** Remove the given slash-command files. Best-effort, returns removed paths. */
export declare function cleanupLegacySlashCommands(home: string, dryRun?: boolean): string[];
/**
 * Detect which client this machine looks like:
 *   - claude-code if ~/.claude/settings.json exists OR ~/.claude.json has mcpServers
 *   - else claude-desktop if claude_desktop_config.json exists
 *   - else claude-web
 */
export declare function detectClient(home: string, platform?: NodeJS.Platform): InstallClient;
export declare function hasValidToken(home: string): boolean;
export declare function install(opts: InstallOptions): Promise<InstallSummary>;
interface DesktopMcpServerEntry {
    type?: string;
    url?: string;
    headers?: Record<string, string>;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
}
interface DesktopConfig {
    mcpServers?: Record<string, DesktopMcpServerEntry>;
    [k: string]: unknown;
}
/**
 * Build the claude-desktop mcpServers entry for gramatr. Uses HTTP transport
 * since Desktop supports it and we get a free Bearer token from ~/.gramatr.json.
 */
export declare function buildDesktopMcpEntry(home: string, serverUrl?: string): DesktopMcpServerEntry;
/**
 * Merge gramatr entry into a claude-desktop config object. Returns the next
 * object and whether a change was made. Idempotent.
 */
export declare function mergeDesktopConfig(current: DesktopConfig, entry: DesktopMcpServerEntry): {
    next: DesktopConfig;
    changed: boolean;
};
/** Remove gramatr entry from claude-desktop config. */
export declare function uninstallDesktopConfig(current: DesktopConfig): {
    next: DesktopConfig;
    changed: boolean;
};
/**
 * Build the copy-paste instructions for claude-web. No filesystem writes.
 * Combines connector steps with the canonical prompt suggestion block.
 */
export declare function buildWebInstallInstructions(serverUrl?: string): string;
export declare function uninstall(opts: UninstallOptions): Promise<UninstallSummary>;
export declare function runInstallCli(argv: string[]): Promise<number>;
export declare function runUninstallCli(argv: string[]): Promise<number>;
export {};
//# sourceMappingURL=install.d.ts.map