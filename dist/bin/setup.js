/**
 * gramatr setup — Main orchestrator for multi-platform setup.
 *
 * Delegates to focused modules:
 *   - setup-config-io.ts  — Config file reading/writing, path resolution
 *   - setup-legacy.ts     — Legacy artifact cleanup (pre-rebrand remnants)
 *   - setup-platforms.ts  — Platform-specific setup (Codex, Gemini, OpenCode, web, generic MCP)
 *   - setup-shared.ts     — Binary resolution / deployment (npx no-ops)
 *
 * This file owns: setupClaudeCode(), setupAutoInstall(), verifySetupInstall(),
 * getAutoDetectedTargets(), and the convenience wrappers for MCP-only targets
 * (Claude Desktop, ChatGPT Desktop, Cursor, Windsurf, VS Code).
 *
 * Usage:
 *   gramatr setup claude-code       Configure Claude Code
 *   gramatr setup claude-code --dry Run without writing
 *   gramatr setup claude            Alias for claude-code (legacy)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CLAUDE_BLOCK_END, CLAUDE_BLOCK_START, CLAUDE_CODE_GUIDANCE, CODEX_BLOCK_END, CODEX_BLOCK_START, } from "../setup/instructions.js";
import { buildPluginHooksJson } from "../setup/integrations.js";
import { getChatgptDesktopConfigPath, getClaudeDesktopConfigPath, getCursorConfigPath, getGeminiHooksPath, getGeminiManifestPath, getOpenCodeConfigPath, getVscodeConfigPath, getWindsurfConfigPath, } from "../setup/targets.js";
// ── Re-export everything from sub-modules so consumers keep importing from setup.js ──
export { addPluginRegistration, ensureLocalSettings, escapeRegExp, getClaudeConfigPath, getClaudeMarkdownPath, getClaudeSettingsPath, getCodexAgentsPath, getCodexConfigPath, getCodexHooksPath, getGramatrPluginDir, getGramatrSettingsPath, hasHookCommand, parseJson, readClaudeConfig, readJsonFile, readManagedBlock, removeGramatrHooks, upsertManagedBlock, writeMarketplaceManifest, writePluginFiles, } from "./setup-config-io.js";
export { runCleanInstall } from "./setup-legacy.js";
export { emitInstallPromptSuggestion, ensureCodexMcpServerConfig, setupCodex, setupGemini, setupMcpTarget, setupOpenCode, setupWeb, } from "./setup-platforms.js";
export { deployPlatformBinary, resolveBinaryPath, writeHookWrappers, } from "./setup-shared.js";
// ── Local imports from sub-modules ──
import { migrateSettingsJson } from "../hooks/lib/gramatr-hook-utils.js";
import { CLAUDE_CODE_HOOKS } from "../setup/generated/platform-hooks.js";
import { addPluginRegistration, ensureLocalSettings, getClaudeConfigPath, getClaudeMarkdownPath, getClaudeSettingsPath, getCodexAgentsPath, getCodexConfigPath as getCodexConfigPathFn, getCodexHooksPath as getCodexHooksPathFn, HOME, hasHookCommand, parseJson, readClaudeConfig, readManagedBlock, removeGramatrHooks, upsertManagedBlock, } from "./setup-config-io.js";
import { runCleanInstall } from "./setup-legacy.js";
import { emitInstallPromptSuggestion, setupCodex, setupGemini, setupMcpTarget, setupOpenCode, } from "./setup-platforms.js";
import { deployPlatformBinary, resolveBinaryPath, writeHookWrappers } from "./setup-shared.js";
import { killStaleMcpServers } from "./login.js";
export const AUTO_TARGET_ORDER = [
    "claude-code",
    "codex",
    "opencode",
    "gemini",
    "claude-desktop",
    "chatgpt-desktop",
    "cursor",
    "windsurf",
    "vscode",
];
// ── setupClaudeCode — the primary Claude Code setup ──
export function setupClaudeCode(dryRun = false, cleanInstall = false, showPrompts = false, showStatusLine = true, remoteUrl = 'https://api.gramatr.com/marketplace') {
    if (!dryRun) {
        killStaleMcpServers();
    }
    migrateSettingsJson();
    if (cleanInstall) {
        runCleanInstall(dryRun);
    }
    deployPlatformBinary(dryRun);
    const settingsPath = getClaudeSettingsPath();
    const markdownPath = getClaudeMarkdownPath();
    const settings = readClaudeConfig(settingsPath);
    const currentMarkdown = existsSync(markdownPath) ? readFileSync(markdownPath, "utf8") : "";
    const gramatrDir = join(HOME, ".gramatr");
    const { command: mcpCommand, args: mcpArgs } = resolveBinaryPath();
    // v0.20.24 (#2767) — statusLine is no longer written by the CLI installer.
    // The plugin's settings.json declares the statusLine (file-cache pattern:
    // shell reads ${CLAUDE_PROJECT_DIR}/.gramatr/statusline-${CLAUDE_SESSION_ID}.txt,
    // and the agent writes that file each turn via the gramatr://session/{id}/statusline
    // resource). The legacy `npx -y --prefer-offline @gramatr/mcp statusline`
    // command was removed because (a) npm publishing is frozen at v0.20.16, (b)
    // statusline runs in a shell context that cannot do OAuth, and (c) the new
    // architecture has no network call on the shell hot path.
    // showStatusLine retained as a no-op flag so call sites do not break.
    void showStatusLine;
    // Strip gramatr-owned keys and hooks so we write a clean slate. statusLine
    // is intentionally stripped (legacy installs may carry a broken `npx ... statusline`
    // entry pointing at a frozen npm package — #2767). We do NOT re-add it.
    const { statusLine: _statusLine, daidentity: _daidentity, principal: _principal, attribution: _attribution, alwaysThinkingEnabled: _alwaysThinkingEnabled, mcpServers: existingMcpServersRaw, enabledPlugins: existingEnabledPlugins, extraKnownMarketplaces: existingExtraMarketplaces, ...settingsWithoutGramatrKeys } = removeGramatrHooks(settings);
    // Claude Code does not auto-load hooks from plugin directories — they must be
    // written directly into settings.json. Build from the same source as hooks.json
    // so plugin dir and settings.json stay in sync.
    const pluginHooksJson = buildPluginHooksJson();
    // Build the direct mcpServers.gramatr entry — Claude Code uses the daemon-based
    // binary as its MCP server (stdio transport).
    const { gramatr: _existingGramatrMcpServer, ...mcpServersWithoutGramatr } = existingMcpServersRaw ?? {};
    const gramatrMcpEntry = {
        command: mcpCommand,
        ...(mcpArgs.length > 0 && { args: mcpArgs }),
    };
    const mergedMcpServers = { ...mcpServersWithoutGramatr, gramatr: gramatrMcpEntry };
    // Keep non-gramatr plugins/marketplaces, strip only gramatr ones
    const { 'gramatr@gramatr': _gramatrPlugin, ...remainingPlugins } = existingEnabledPlugins ?? {};
    const cleanedEnabledPlugins = Object.keys(remainingPlugins).length > 0 ? remainingPlugins : undefined;
    const { gramatr: _gramatrMarketplace, ...remainingMarketplaces } = existingExtraMarketplaces ?? {};
    const cleanedExtraMarketplaces = Object.keys(remainingMarketplaces).length > 0 ? remainingMarketplaces : undefined;
    // Build ~/.claude.json content — mcpServers.gramatr lives here (not in settings.json)
    const configPath = getClaudeConfigPath();
    const configRaw = existsSync(configPath)
        ? (() => { try {
            return JSON.parse(readFileSync(configPath, 'utf8'));
        }
        catch {
            return {};
        } })()
        : {};
    const { gramatr: _existingGramatrConfig, ...otherMcpServers } = configRaw.mcpServers ?? {};
    const updatedConfig = {
        ...configRaw,
        mcpServers: {
            ...otherMcpServers,
            gramatr: gramatrMcpEntry,
        },
    };
    // When the local gramatr binary is not installed, add the hosted marketplace
    // URL via addPluginRegistration so Claude Code can discover and load the
    // plugin directly from the server without a local file install.
    // When the binary IS installed locally, the plugin dir is written to disk by
    // writeHookWrappers/writeMarketplaceManifest and Claude Code loads it from
    // the local file:// path — we don't need extraKnownMarketplaces in that case.
    const isRemoteOnly = mcpCommand !== 'gramatr';
    const baseSettings = {
        ...settingsWithoutGramatrKeys,
        ...(CLAUDE_CODE_HOOKS.settings ?? {}),
        // v0.20.24 — statusLine intentionally NOT written here. The plugin's
        // settings.json (shipped via marketplace artifact) declares the
        // file-cache statusLine command. See packages/mcp/scripts/build-marketplace.mjs.
        hooks: pluginHooksJson.hooks,
        ...(cleanedEnabledPlugins !== undefined ? { enabledPlugins: cleanedEnabledPlugins } : {}),
        ...(cleanedExtraMarketplaces !== undefined ? { extraKnownMarketplaces: cleanedExtraMarketplaces } : {}),
    };
    const settingsWithMarketplace = isRemoteOnly
        ? addPluginRegistration(baseSettings, gramatrDir, remoteUrl)
        : baseSettings;
    const mergedSettings = {
        ...settingsWithMarketplace,
        env: (() => {
            // Strip legacy token keys before spreading — old installer versions wrote
            // GRAMATR_TOKEN directly into the env block, which bakes the token into
            // every spawned process and survives login (env vars can't be updated in
            // a running process). We own all GRAMATR_* keys; let auth.ts read from
            // ~/.gramatr.json instead.
            const { GRAMATR_TOKEN: _t, AIOS_MCP_TOKEN: _lt, GRAMATR_URL: _u, PATH: _path, ...existingEnv } = settingsWithoutGramatrKeys.env ?? {};
            // Write ~/.gramatr/bin at the front of PATH so gramatr-hook is always
            // findable by Claude Code's hook shell. Use a fixed minimal base rather
            // than snapshotting process.env.PATH, which caused exponential duplication
            // on repeated setup runs.
            const sep = process.platform === "win32" ? ";" : ":";
            const gramatrBin = `${HOME}/.gramatr/bin`;
            const basePath = process.platform === "win32"
                ? (process.env.PATH ?? "")
                : "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
            return {
                ...existingEnv,
                GRAMATR_DIR: gramatrDir,
                GRAMATR_URL: "https://api.gramatr.com/mcp",
                PATH: `${gramatrBin}${sep}${basePath}`,
            };
        })(),
    };
    const mergedMarkdown = upsertManagedBlock(currentMarkdown, CLAUDE_CODE_GUIDANCE, CLAUDE_BLOCK_START, CLAUDE_BLOCK_END);
    if (dryRun) {
        process.stderr.write("[gramatr] Dry run — would write Claude settings to: " + settingsPath + "\n");
        process.stderr.write("[gramatr] Dry run — would write MCP server config to: " + configPath + "\n");
        process.stderr.write(JSON.stringify({
            mcpServers: updatedConfig.mcpServers,
        }, null, 2) + "\n");
        process.stderr.write("[gramatr] Dry run — would write Claude guidance to: " + markdownPath + "\n");
        process.stderr.write(mergedMarkdown + "\n");
        if (showPrompts)
            emitInstallPromptSuggestion("claude-code");
        return;
    }
    mkdirSync(join(HOME, ".claude"), { recursive: true });
    ensureLocalSettings();
    writeHookWrappers(gramatrDir);
    writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2) + "\n", "utf8");
    writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2) + "\n", "utf8");
    writeFileSync(markdownPath, mergedMarkdown, "utf8");
    process.stderr.write(`[gramatr] Registered MCP server in ${configPath}\n`);
    process.stderr.write(`[gramatr] Configured Claude hooks in ${settingsPath}\n`);
    process.stderr.write(`[gramatr] Configured Claude guidance in ${markdownPath}\n`);
    process.stderr.write("[gramatr] Restart Claude Code to pick up the change.\n");
    if (showPrompts)
        emitInstallPromptSuggestion("claude-code");
}
/** @deprecated Use setupClaudeCode() — "claude" is a legacy alias */
export function setupClaude(dryRun = false, cleanInstall = false, showPrompts = false, showStatusLine = true, remoteUrl = 'https://api.gramatr.com/marketplace') {
    return setupClaudeCode(dryRun, cleanInstall, showPrompts, showStatusLine, remoteUrl);
}
// ── Convenience wrappers for MCP-only targets ──
export function setupClaudeDesktop(dryRun = false, showPrompts = false) {
    setupMcpTarget("Claude Desktop", getClaudeDesktopConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion("claude-desktop");
}
export function setupChatgptDesktop(dryRun = false, showPrompts = false) {
    setupMcpTarget("ChatGPT Desktop", getChatgptDesktopConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion("chatgpt-desktop");
}
export function setupCursor(dryRun = false, showPrompts = false) {
    setupMcpTarget("Cursor", getCursorConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion("cursor");
}
export function setupWindsurf(dryRun = false, showPrompts = false) {
    setupMcpTarget("Windsurf", getWindsurfConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion("windsurf");
}
export function setupVscode(dryRun = false, showPrompts = false) {
    setupMcpTarget("VS Code", getVscodeConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion("vscode");
}
// ── Auto-detect + auto-install ──
export function getAutoDetectedTargets() {
    const checks = {
        "claude-code": existsSync(join(HOME, ".claude")) || existsSync(getClaudeConfigPath()),
        claude: existsSync(join(HOME, ".claude")) || existsSync(getClaudeConfigPath()),
        codex: existsSync(join(HOME, ".codex")),
        opencode: existsSync(join(HOME, ".config", "opencode")) || existsSync("opencode.json"),
        gemini: existsSync(join(HOME, ".gemini")),
        "claude-desktop": existsSync(dirname(getClaudeDesktopConfigPath(HOME))),
        "chatgpt-desktop": existsSync(dirname(getChatgptDesktopConfigPath(HOME))),
        cursor: existsSync(join(HOME, ".cursor")),
        windsurf: existsSync(join(HOME, ".windsurf")),
        vscode: existsSync(join(HOME, ".vscode")),
    };
    return AUTO_TARGET_ORDER.filter((target) => checks[target]);
}
export function setupAutoInstall(options = {}) {
    const dryRun = options.dryRun === true;
    const cleanInstall = options.cleanInstall === true;
    const listOnly = options.listOnly === true;
    const showPrompts = options.showPrompts === true;
    const detected = getAutoDetectedTargets();
    const requested = Array.isArray(options.selectedTargets) && options.selectedTargets.length > 0
        ? Array.from(new Set(options.selectedTargets))
        : null;
    const selected = requested ?? detected;
    process.stderr.write("[gramatr] auto-detect scan complete\n");
    if (detected.length === 0 && !requested) {
        process.stderr.write("[gramatr] No supported local clients detected.\n");
        process.stderr.write("[gramatr] Install manually with: setup <target>\n");
        return 0;
    }
    process.stderr.write(`[gramatr] Detected targets: ${detected.join(", ")}\n`);
    process.stderr.write(`[gramatr] Selected targets: ${selected.join(", ")}\n`);
    if (requested) {
        const undetected = requested.filter((target) => !detected.includes(target));
        if (undetected.length > 0) {
            process.stderr.write(`[gramatr] Requested targets not detected locally (will still configure): ${undetected.join(", ")}\n`);
        }
    }
    if (listOnly) {
        process.stderr.write("[gramatr] list-only mode: no setup changes made.\n");
        return selected.length;
    }
    for (const target of selected) {
        switch (target) {
            case "claude-code":
                setupClaudeCode(dryRun, cleanInstall, showPrompts);
                break;
            case "claude": // legacy alias
                setupClaudeCode(dryRun, cleanInstall, showPrompts);
                break;
            case "codex":
                setupCodex(dryRun, showPrompts);
                break;
            case "opencode":
                setupOpenCode(dryRun, showPrompts);
                break;
            case "gemini":
                setupGemini(dryRun, showPrompts);
                break;
            case "claude-desktop":
                setupClaudeDesktop(dryRun, showPrompts);
                break;
            case "chatgpt-desktop":
                setupChatgptDesktop(dryRun, showPrompts);
                break;
            case "cursor":
                setupCursor(dryRun, showPrompts);
                break;
            case "windsurf":
                setupWindsurf(dryRun, showPrompts);
                break;
            case "vscode":
                setupVscode(dryRun, showPrompts);
                break;
            default:
                break;
        }
    }
    if (cleanInstall && !selected.some((target) => target === "claude-code" || target === "claude")) {
        process.stderr.write("[gramatr] clean-install requested, but no Claude Code target selected. Legacy cleanup is only applied during setup claude-code.\n");
    }
    process.stderr.write(`[gramatr] Auto setup completed for ${selected.length} target(s).\n`);
    return selected.length;
}
// ── Verification ──
function addResult(items, severity, label, detail) {
    items.push({ severity, label, detail });
}
function collectHookCommands(config, eventName) {
    if (!config || typeof config !== "object")
        return [];
    const hooksRoot = config.hooks;
    if (!hooksRoot || typeof hooksRoot !== "object")
        return [];
    const entries = hooksRoot[eventName];
    if (!Array.isArray(entries))
        return [];
    return entries.flatMap((entry) => Array.isArray(entry?.hooks)
        ? entry.hooks
            .map((hook) => (typeof hook?.command === "string" ? hook.command : null))
            .filter((command) => command !== null)
        : []);
}
function usesCanonicalLauncher(command) {
    return /\bgramatr-hook\b/.test(command);
}
function verifyClaudeCode(items) {
    const settingsPath = getClaudeSettingsPath();
    const configPath = getClaudeConfigPath();
    const markdownPath = getClaudeMarkdownPath();
    const settings = parseJson(settingsPath);
    const claudeConfig = parseJson(configPath);
    // Check that mcpServers.gramatr is registered in ~/.claude.json (not settings.json)
    const mcpServers = claudeConfig?.mcpServers;
    const gramatrMcpServer = mcpServers && typeof mcpServers.gramatr?.command === "string";
    if (gramatrMcpServer) {
        addResult(items, "ok", "claude.mcp_server", `${configPath} has mcpServers.gramatr`);
    }
    else {
        addResult(items, "error", "claude.mcp_server", `${configPath} missing mcpServers.gramatr — run: npx @gramatr/mcp setup claude-code`);
    }
    const misplacedMcpServer = !!settings?.mcpServers &&
        typeof settings.mcpServers === "object" &&
        typeof settings.mcpServers.gramatr === "object";
    if (misplacedMcpServer) {
        addResult(items, "error", "claude.settings_boundary", `${settingsPath} should not contain mcpServers.gramatr — run: npx @gramatr/mcp setup claude-code`);
    }
    else {
        addResult(items, "ok", "claude.settings_boundary", `${settingsPath} keeps mcpServers.gramatr out of settings.json`);
    }
    // Check that settings.json hooks include the required gramatr hook commands.
    // hasHookCommand expects an object with a `hooks` key (same shape as hooks.json),
    // so we pass the whole settings object — it reads settings.hooks[eventName].
    const hasPromptHook = hasHookCommand(settings, "UserPromptSubmit", "hook user-prompt-submit");
    const hasSessionStartHook = hasHookCommand(settings, "SessionStart", "hook session-start");
    if (hasPromptHook && hasSessionStartHook) {
        addResult(items, "ok", "claude.hooks", `${settingsPath} includes session-start + user-prompt-submit hooks`);
    }
    else {
        addResult(items, "error", "claude.hooks", `${settingsPath} missing required hooks (session-start=${hasSessionStartHook}, user-prompt-submit=${hasPromptHook}) — run: npx @gramatr/mcp setup claude-code`);
    }
    const claudeCommands = [
        ...collectHookCommands(settings, "SessionStart"),
        ...collectHookCommands(settings, "UserPromptSubmit"),
        ...collectHookCommands(settings, "PreToolUse"),
        ...collectHookCommands(settings, "PostToolUse"),
        ...collectHookCommands(settings, "Stop"),
    ].filter((command) => command.includes("gramatr"));
    const hasCanonicalClaudeLauncher = claudeCommands.length > 0 && claudeCommands.every(usesCanonicalLauncher);
    if (hasCanonicalClaudeLauncher) {
        addResult(items, "ok", "claude.launcher", `${settingsPath} uses the canonical gramatr-hook launcher`);
    }
    else {
        addResult(items, "error", "claude.launcher", `${settingsPath} has non-canonical hook commands — run: npx @gramatr/mcp setup claude-code`);
    }
    const envPath = typeof settings?.env?.PATH === "string" ? String(settings.env.PATH) : "";
    const sep = process.platform === "win32" ? ";" : ":";
    const pathEntries = envPath.split(sep).filter(Boolean);
    const expectedClaudeBin = `${HOME}/.gramatr/bin`;
    if (pathEntries.includes(expectedClaudeBin)) {
        addResult(items, "ok", "claude.path_injection", `${settingsPath} injects ${expectedClaudeBin} into PATH`);
    }
    else {
        addResult(items, "error", "claude.path_injection", `${settingsPath} missing PATH injection for ${expectedClaudeBin}`);
    }
    const managedBlock = readManagedBlock(markdownPath, CLAUDE_BLOCK_START, CLAUDE_BLOCK_END);
    if (managedBlock) {
        addResult(items, "ok", "claude.guidance", `${markdownPath} contains managed gramatr guidance block`);
    }
    else {
        addResult(items, "warn", "claude.guidance", `${markdownPath} missing managed guidance block`);
    }
}
function verifyCodex(items) {
    const hooksPath = getCodexHooksPathFn();
    const configPath = getCodexConfigPathFn();
    const agentsPath = getCodexAgentsPath();
    const repoLocalHooksPath = join(process.cwd(), ".codex", "hooks.json");
    const hooks = parseJson(hooksPath);
    const hasPromptHook = hasHookCommand(hooks, "UserPromptSubmit", "hook user-prompt-submit");
    const hasSessionStartHook = hasHookCommand(hooks, "SessionStart", "hook session-start");
    const hasStopHook = hasHookCommand(hooks, "Stop", "hook stop");
    if (hasPromptHook && hasSessionStartHook && hasStopHook) {
        addResult(items, "ok", "codex.hooks", `${hooksPath} includes session-start + user-prompt-submit + stop`);
    }
    else {
        addResult(items, "error", "codex.hooks", `${hooksPath} missing required hooks (session-start=${hasSessionStartHook}, user-prompt-submit=${hasPromptHook}, stop=${hasStopHook})`);
    }
    const codexCommands = [
        ...collectHookCommands(hooks, "SessionStart"),
        ...collectHookCommands(hooks, "UserPromptSubmit"),
        ...collectHookCommands(hooks, "Stop"),
    ].filter((command) => command.includes("gramatr"));
    const hasCanonicalCodexLauncher = codexCommands.length > 0 && codexCommands.every(usesCanonicalLauncher);
    if (hasCanonicalCodexLauncher) {
        addResult(items, "ok", "codex.launcher", `${hooksPath} uses the canonical gramatr-hook launcher`);
    }
    else {
        addResult(items, "error", "codex.launcher", `${hooksPath} has non-canonical hook commands — run: npx @gramatr/mcp setup codex`);
    }
    const configToml = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    const hooksEnabled = /^\s*codex_hooks\s*=\s*true\s*$/m.test(configToml);
    if (hooksEnabled) {
        addResult(items, "ok", "codex.feature_flag", `${configPath} enables codex_hooks`);
    }
    else {
        addResult(items, "error", "codex.feature_flag", `${configPath} missing codex_hooks = true`);
    }
    const hasMcpServer = /^\[mcp_servers\.gramatr\]\s*$/m.test(configToml) && /^\s*command\s*=\s*.+$/m.test(configToml);
    if (hasMcpServer) {
        addResult(items, "ok", "codex.mcp_server", `${configPath} contains mcp_servers.gramatr`);
    }
    else {
        addResult(items, "error", "codex.mcp_server", `${configPath} missing mcp_servers.gramatr`);
    }
    const hasScopedEnv = /^\[mcp_servers\.gramatr\.env\]\s*$/m.test(configToml);
    const configWithoutScopedEnv = configToml.replace(/^\[mcp_servers\.gramatr\.env\]\n(?:\s*GRAMATR_(?:DIR|URL)\s*=.*\n?)*/m, "");
    const hasLegacyTopLevelEnv = /^\s*GRAMATR_(?:DIR|URL)\s*=\s*.+$/m.test(configWithoutScopedEnv);
    if (hasScopedEnv && !hasLegacyTopLevelEnv) {
        addResult(items, "ok", "codex.env_scope", `${configPath} keeps GRAMATR_* env scoped under [mcp_servers.gramatr.env]`);
    }
    else {
        addResult(items, "error", "codex.env_scope", `${configPath} has stale or missing GRAMATR_* env scoping — run: npx @gramatr/mcp setup codex`);
    }
    if (existsSync(repoLocalHooksPath)) {
        addResult(items, "error", "codex.duplicate_hooks", `${repoLocalHooksPath} exists alongside global Codex hooks and can cause duplicate execution`);
    }
    else {
        addResult(items, "ok", "codex.duplicate_hooks", `no repo-local Codex hooks detected under ${join(process.cwd(), ".codex")}`);
    }
    const managedBlock = readManagedBlock(agentsPath, CODEX_BLOCK_START, CODEX_BLOCK_END);
    if (managedBlock) {
        addResult(items, "ok", "codex.guidance", `${agentsPath} contains managed gramatr guidance block`);
    }
    else {
        addResult(items, "warn", "codex.guidance", `${agentsPath} missing managed guidance block`);
    }
}
function verifyJsonMcpTarget(items, label, configPath) {
    const json = parseJson(configPath);
    const gramatrServer = json?.mcpServers && typeof json.mcpServers === "object"
        ? json.mcpServers.gramatr
        : null;
    if (gramatrServer) {
        addResult(items, "warn", `${label}.mcp_server`, `${configPath} has legacy mcpServers.gramatr entry — run 'gramatr setup claude-code' to clean up`);
    }
    else {
        addResult(items, "ok", `${label}.mcp_server`, `${configPath} has no legacy mcpServers.gramatr entry`);
    }
}
function verifyOpenCode(items) {
    const configPath = getOpenCodeConfigPath(HOME);
    const json = parseJson(configPath);
    const gramatrServer = json?.mcp && typeof json.mcp === "object"
        ? json.mcp.gramatr
        : null;
    if (gramatrServer) {
        addResult(items, "ok", "opencode.mcp_server", `${configPath} has mcp.gramatr`);
    }
    else {
        addResult(items, "error", "opencode.mcp_server", `${configPath} missing mcp.gramatr`);
    }
}
function verifyGemini(items) {
    const manifestPath = getGeminiManifestPath(HOME);
    const hooksPath = getGeminiHooksPath(HOME);
    const manifest = parseJson(manifestPath);
    const geminiServer = manifest?.mcpServers && typeof manifest.mcpServers === "object"
        ? manifest.mcpServers.gramatr
        : null;
    if (geminiServer) {
        addResult(items, "warn", "gemini.manifest", `${manifestPath} has legacy mcpServers.gramatr entry — run 'gramatr setup gemini' to clean up`);
    }
    else {
        addResult(items, "ok", "gemini.manifest", `${manifestPath} has no legacy mcpServers.gramatr entry`);
    }
    const hooks = parseJson(hooksPath);
    const hasBeforeAgent = hasHookCommand(hooks, "BeforeAgent", "hook user-prompt-submit");
    const hasSessionStart = hasHookCommand(hooks, "SessionStart", "hook session-start");
    if (hasBeforeAgent && hasSessionStart) {
        addResult(items, "ok", "gemini.hooks", `${hooksPath} includes BeforeAgent + SessionStart hooks`);
    }
    else {
        addResult(items, "warn", "gemini.hooks", `${hooksPath} missing expected hooks (before-agent=${hasBeforeAgent}, session-start=${hasSessionStart})`);
    }
}
function verifyLocalSettings(items) {
    const gmtrJsonPath = join(HOME, ".gramatr.json");
    const gmtrJson = parseJson(gmtrJsonPath);
    const hasUserName = Boolean(gmtrJson?.user?.name);
    if (hasUserName) {
        addResult(items, "ok", "runtime.settings", `${gmtrJsonPath} has user.name set`);
    }
    else {
        addResult(items, "warn", "runtime.settings", `${gmtrJsonPath} user.name not set — run: gramatr login (or add user.name to ~/.gramatr.json)`);
    }
}
function printPromptBlocks(target) {
    if (target === "all" || target === "claude-code" || target === "claude") {
        const block = readManagedBlock(getClaudeMarkdownPath(), CLAUDE_BLOCK_START, CLAUDE_BLOCK_END);
        process.stderr.write("\n━━━ Claude Managed Guidance Block ━━━\n\n");
        process.stdout.write((block || "[missing managed block]\n") + "\n");
    }
    if (target === "all" || target === "codex") {
        const block = readManagedBlock(getCodexAgentsPath(), CODEX_BLOCK_START, CODEX_BLOCK_END);
        process.stderr.write("\n━━━ Codex Managed Guidance Block ━━━\n\n");
        process.stdout.write((block || "[missing managed block]\n") + "\n");
    }
}
export function verifySetupInstall(target = "all", options = {}) {
    const items = [];
    verifyLocalSettings(items);
    if (target === "all" || target === "claude-code" || target === "claude")
        verifyClaudeCode(items);
    if (target === "all" || target === "codex")
        verifyCodex(items);
    if (target === "all" || target === "opencode")
        verifyOpenCode(items);
    if (target === "all" || target === "claude-desktop") {
        verifyJsonMcpTarget(items, "claude-desktop", getClaudeDesktopConfigPath(HOME));
    }
    if (target === "all" || target === "chatgpt-desktop") {
        verifyJsonMcpTarget(items, "chatgpt-desktop", getChatgptDesktopConfigPath(HOME));
    }
    if (target === "all" || target === "cursor") {
        verifyJsonMcpTarget(items, "cursor", getCursorConfigPath(HOME));
    }
    if (target === "all" || target === "windsurf") {
        verifyJsonMcpTarget(items, "windsurf", getWindsurfConfigPath(HOME));
    }
    if (target === "all" || target === "vscode") {
        verifyJsonMcpTarget(items, "vscode", getVscodeConfigPath(HOME));
    }
    if (target === "all" || target === "gemini")
        verifyGemini(items);
    const hasError = items.some((item) => item.severity === "error");
    const hasWarn = items.some((item) => item.severity === "warn");
    if (options.json) {
        process.stdout.write(JSON.stringify({
            ok: !hasError,
            warnings: hasWarn,
            target,
            checks: items,
        }, null, 2) + "\n");
    }
    else {
        process.stderr.write(`\n[gramatr] Setup verification target=${target}\n`);
        for (const item of items) {
            const marker = item.severity === "ok" ? "OK" : item.severity === "warn" ? "WARN" : "ERROR";
            process.stderr.write(`  [${marker}] ${item.label}: ${item.detail}\n`);
        }
    }
    if (options.showPrompts) {
        printPromptBlocks(target);
    }
    if (hasError) {
        process.stderr.write("[gramatr] Verification failed. Re-run setup for the failing target(s).\n");
        return 1;
    }
    if (hasWarn) {
        process.stderr.write("[gramatr] Verification completed with warnings.\n");
    }
    else {
        process.stderr.write("[gramatr] Verification passed.\n");
    }
    return 0;
}
//# sourceMappingURL=setup.js.map