/**
 * gramatr setup — Main orchestrator for multi-platform setup.
 *
 * Delegates to focused modules:
 *   - setup-config-io.ts  — Config file reading/writing, path resolution
 *   - setup-legacy.ts     — Legacy artifact cleanup (pre-rebrand remnants)
 *   - setup-platforms.ts  — Platform-specific setup (Codex, Gemini, OpenCode, web, generic MCP)
 *   - setup-shared.ts     — Binary resolution / deployment (npx no-ops)
 *
 * This file owns: setupClaude(), setupAutoInstall(), verifySetupInstall(),
 * getAutoDetectedTargets(), and the convenience wrappers for MCP-only targets
 * (Claude Desktop, ChatGPT Desktop, Cursor, Windsurf, VS Code).
 *
 * Usage:
 *   gramatr setup claude       Configure Claude Code
 *   gramatr setup claude --dry Run without writing
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
export { deployPlatformBinary, resolveBinaryPath, } from "./setup-shared.js";
// ── Local imports from sub-modules ──
import { addPluginRegistration, ensureLocalSettings, getClaudeConfigPath, getClaudeMarkdownPath, getClaudeSettingsPath, getCodexAgentsPath, getCodexConfigPath as getCodexConfigPathFn, getCodexHooksPath as getCodexHooksPathFn, getGramatrPluginDir, HOME, hasHookCommand, parseJson, readClaudeConfig, readManagedBlock, removeGramatrHooks, upsertManagedBlock, writeMarketplaceManifest, writePluginFiles, } from "./setup-config-io.js";
import { runCleanInstall } from "./setup-legacy.js";
import { emitInstallPromptSuggestion, setupCodex, setupGemini, setupMcpTarget, setupOpenCode, } from "./setup-platforms.js";
import { deployPlatformBinary, resolveBinaryPath } from "./setup-shared.js";
import { migrateSettingsJson } from "../hooks/lib/gramatr-hook-utils.js";
import { CLAUDE_CODE_HOOKS } from "../setup/generated/platform-hooks.js";
import { VERSION } from "../hooks/lib/version.js";
export const AUTO_TARGET_ORDER = [
    "claude",
    "codex",
    "opencode",
    "gemini",
    "claude-desktop",
    "chatgpt-desktop",
    "cursor",
    "windsurf",
    "vscode",
];
// ── writeHookWrappers — OS-specific thin wrappers for hook dispatch ──
// Writes gramatr-hook (Unix) and gramatr-hook.cmd (Windows) into $GRAMATR_DIR/bin/.
// Prefers the globally installed binary; falls back to npx if not in PATH.
// Runtime check so the wrapper stays correct after package installs/upgrades.
function writeHookWrappers(gramatrDir) {
    const binDir = join(gramatrDir, 'bin');
    mkdirSync(binDir, { recursive: true });
    const shWrapper = join(binDir, 'gramatr-hook');
    writeFileSync(shWrapper, '#!/bin/sh\nif command -v gramatr >/dev/null 2>&1; then\n  exec gramatr hook "$@"\nelse\n  exec npx -y --prefer-offline @gramatr/mcp hook "$@"\nfi\n', { mode: 0o755 });
    const cmdWrapper = join(binDir, 'gramatr-hook.cmd');
    writeFileSync(cmdWrapper, '@echo off\nwhere gramatr >nul 2>&1\nif %ERRORLEVEL% == 0 (\n  gramatr hook %*\n) else (\n  npx -y --prefer-offline @gramatr/mcp hook %*\n)\n');
}
// ── setupClaude — the primary Claude Code setup ──
export function setupClaude(dryRun = false, cleanInstall = false, showPrompts = false, showStatusLine = true) {
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
    const pluginDir = getGramatrPluginDir();
    const pluginJson = {
        name: "gramatr",
        version: VERSION,
        description: "gramatr — Real-Time Intelligent Context Engineering",
        author: { name: "gramatr", email: "support@gramatr.com", url: "https://gramatr.com" },
        homepage: "https://gramatr.com",
        repository: "https://github.com/gramatr/gramatr",
        license: "MIT",
        keywords: ["intelligence", "memory", "routing", "context", "mcp"],
    };
    const { command: mcpCommand, args: mcpArgs } = resolveBinaryPath();
    const mcpJson = { gramatr: { command: mcpCommand, ...(mcpArgs.length > 0 && { args: mcpArgs }) } };
    const statusLineCommand = mcpCommand === 'gramatr'
        ? 'gramatr statusline'
        : 'npx -y --prefer-offline @gramatr/mcp statusline';
    // Strip gramatr-owned keys and hooks so we write a clean slate
    const { statusLine: _statusLine, daidentity: _daidentity, principal: _principal, attribution: _attribution, alwaysThinkingEnabled: _alwaysThinkingEnabled, mcpServers: existingMcpServersRaw, ...settingsWithoutGramatrKeys } = removeGramatrHooks(settings);
    // Claude Code does not auto-load hooks from plugin directories — they must be
    // written directly into settings.json. Build from the same source as hooks.json
    // so plugin dir and settings.json stay in sync.
    const pluginHooksJson = buildPluginHooksJson();
    // Remove any existing mcpServers.gramatr entry — we now distribute exclusively
    // via the Claude Marketplace plugin, so direct registration must be cleaned up
    // on both new installs and upgrades (where the old installer wrote it).
    // mcpServers is extracted from settingsWithoutGramatrKeys above so it doesn't
    // get re-spread back in and shadow the cleaned version.
    const { gramatr: _gramatrMcpServer, ...mcpServersWithoutGramatr } = existingMcpServersRaw ?? {};
    const cleanedMcpServers = Object.keys(mcpServersWithoutGramatr).length > 0 ? mcpServersWithoutGramatr : undefined;
    const mergedSettings = addPluginRegistration({
        ...settingsWithoutGramatrKeys,
        ...(CLAUDE_CODE_HOOKS.settings ?? {}),
        ...(showStatusLine ? { statusLine: { type: 'command', command: statusLineCommand } } : {}),
        hooks: pluginHooksJson.hooks,
        ...(cleanedMcpServers !== undefined ? { mcpServers: cleanedMcpServers } : {}),
        env: (() => {
            // Strip legacy token keys before spreading — old installer versions wrote
            // GRAMATR_TOKEN directly into the env block, which bakes the token into
            // every spawned process and survives login (env vars can't be updated in
            // a running process). We own all GRAMATR_* keys; let auth.ts read from
            // ~/.gramatr.json instead.
            const { GRAMATR_TOKEN: _t, AIOS_MCP_TOKEN: _lt, GRAMATR_URL: _u, PATH: _path, ...existingEnv } = settingsWithoutGramatrKeys.env ?? {};
            return {
                ...existingEnv,
                GRAMATR_DIR: gramatrDir,
                GRAMATR_URL: 'https://api.gramatr.com/mcp',
            };
        })(),
    }, gramatrDir);
    const mergedMarkdown = upsertManagedBlock(currentMarkdown, CLAUDE_CODE_GUIDANCE, CLAUDE_BLOCK_START, CLAUDE_BLOCK_END);
    if (dryRun) {
        process.stderr.write("[gramatr] Dry run — would write plugin to: " + pluginDir + "\n");
        process.stderr.write("[gramatr] Dry run — would write Claude settings to: " + settingsPath + "\n");
        process.stderr.write(JSON.stringify({
            extraKnownMarketplaces: mergedSettings.extraKnownMarketplaces,
            enabledPlugins: mergedSettings.enabledPlugins,
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
    writeMarketplaceManifest(gramatrDir);
    writePluginFiles(pluginDir, pluginJson, buildPluginHooksJson(), mcpJson);
    writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2) + "\n", "utf8");
    writeFileSync(markdownPath, mergedMarkdown, "utf8");
    process.stderr.write(`[gramatr] Wrote plugin files to ${pluginDir}\n`);
    process.stderr.write(`[gramatr] Registered plugin in ${settingsPath}\n`);
    process.stderr.write(`[gramatr] Configured Claude guidance in ${markdownPath}\n`);
    process.stderr.write("[gramatr] Restart Claude Code to pick up the change.\n");
    if (showPrompts)
        emitInstallPromptSuggestion("claude-code");
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
    if (cleanInstall) {
        runCleanInstall(dryRun);
    }
    for (const target of selected) {
        switch (target) {
            case "claude":
                setupClaude(dryRun, false, showPrompts);
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
    process.stderr.write(`[gramatr] Auto setup completed for ${selected.length} target(s).\n`);
    return selected.length;
}
// ── Verification ──
function addResult(items, severity, label, detail) {
    items.push({ severity, label, detail });
}
function verifyClaude(items) {
    const settingsPath = getClaudeSettingsPath();
    const markdownPath = getClaudeMarkdownPath();
    const settings = parseJson(settingsPath);
    const enabledPlugins = settings?.enabledPlugins;
    const pluginEnabled = enabledPlugins && enabledPlugins["gramatr@gramatr"] === true;
    if (pluginEnabled) {
        addResult(items, "ok", "claude.plugin", `${settingsPath} has enabledPlugins['gramatr@gramatr']`);
    }
    else {
        addResult(items, "error", "claude.plugin", `${settingsPath} missing enabledPlugins['gramatr@gramatr'] — run: npx @gramatr/mcp setup claude`);
    }
    // Check that the gramatr marketplace is registered — without this, Claude Code
    // silently fails to install gramatr@gramatr even when enabledPlugins is set.
    const extraMarketplaces = settings?.extraKnownMarketplaces;
    const marketplaceRegistered = extraMarketplaces && extraMarketplaces["gramatr"];
    if (marketplaceRegistered) {
        addResult(items, "ok", "claude.marketplace", `${settingsPath} has extraKnownMarketplaces['gramatr']`);
    }
    else {
        addResult(items, "error", "claude.marketplace", `${settingsPath} missing extraKnownMarketplaces['gramatr'] — plugin will silently fail to install. Run: npx @gramatr/mcp setup claude`);
    }
    // Check that plugin files exist on disk
    const pluginJsonPath = join(getGramatrPluginDir(), ".claude-plugin", "plugin.json");
    if (existsSync(pluginJsonPath)) {
        addResult(items, "ok", "claude.plugin_files", `Plugin files present at ${getGramatrPluginDir()}`);
    }
    else {
        addResult(items, "error", "claude.plugin_files", `Plugin files missing at ${getGramatrPluginDir()} — run: npx @gramatr/mcp setup claude`);
    }
    const pluginDir = getGramatrPluginDir();
    const pluginHooksPath = join(pluginDir, "hooks", "hooks.json");
    const pluginHooks = parseJson(pluginHooksPath);
    const hasPromptHook = hasHookCommand(pluginHooks, "UserPromptSubmit", "hook user-prompt-submit");
    const hasSessionStartHook = hasHookCommand(pluginHooks, "SessionStart", "hook session-start");
    if (hasPromptHook && hasSessionStartHook) {
        addResult(items, "ok", "claude.hooks", `${pluginHooksPath} includes session-start + user-prompt-submit`);
    }
    else {
        addResult(items, "error", "claude.hooks", `${pluginHooksPath} missing required hooks (session-start=${hasSessionStartHook}, user-prompt-submit=${hasPromptHook})`);
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
        addResult(items, "warn", `${label}.mcp_server`, `${configPath} has legacy mcpServers.gramatr entry — run 'gramatr setup claude' to clean up`);
    }
    else {
        addResult(items, "ok", `${label}.mcp_server`, `${configPath} has no legacy mcpServers.gramatr entry`);
    }
}
function verifyOpenCode(items) {
    verifyJsonMcpTarget(items, "opencode", getOpenCodeConfigPath(HOME));
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
        addResult(items, "warn", "runtime.settings", `${gmtrJsonPath} user.name not set — run: npx @gramatr/mcp setup claude`);
    }
}
function printPromptBlocks(target) {
    if (target === "all" || target === "claude") {
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
    if (target === "all" || target === "claude")
        verifyClaude(items);
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