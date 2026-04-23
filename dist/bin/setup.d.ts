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
 *   gramatr-mcp setup claude       Configure Claude Code
 *   gramatr-mcp setup claude --dry Run without writing
 */
export { addPluginRegistration, ensureLocalSettings, escapeRegExp, getClaudeConfigPath, getClaudeMarkdownPath, getClaudeSettingsPath, getCodexAgentsPath, getCodexConfigPath, getCodexHooksPath, getGramatrPluginDir, getGramatrSettingsPath, hasHookCommand, parseJson, readClaudeConfig, readJsonFile, readManagedBlock, removeGramatrHooks, upsertManagedBlock, writeMarketplaceManifest, writePluginFiles, } from "./setup-config-io.js";
export { runCleanInstall } from "./setup-legacy.js";
export { emitInstallPromptSuggestion, ensureCodexMcpServerConfig, setupCodex, setupGemini, setupMcpTarget, setupOpenCode, setupWeb, } from "./setup-platforms.js";
export { deployPlatformBinary, resolveBinaryPath, } from "./setup-shared.js";
type SetupTarget = "all" | "claude" | "codex" | "opencode" | "claude-desktop" | "chatgpt-desktop" | "gemini" | "cursor" | "windsurf" | "vscode";
export type InstallableTarget = Exclude<SetupTarget, "all">;
export declare const AUTO_TARGET_ORDER: InstallableTarget[];
export declare function setupClaude(dryRun?: boolean, cleanInstall?: boolean, showPrompts?: boolean): void;
export declare function setupClaudeDesktop(dryRun?: boolean, showPrompts?: boolean): void;
export declare function setupChatgptDesktop(dryRun?: boolean, showPrompts?: boolean): void;
export declare function setupCursor(dryRun?: boolean, showPrompts?: boolean): void;
export declare function setupWindsurf(dryRun?: boolean, showPrompts?: boolean): void;
export declare function setupVscode(dryRun?: boolean, showPrompts?: boolean): void;
export declare function getAutoDetectedTargets(): InstallableTarget[];
export declare function setupAutoInstall(options?: {
    dryRun?: boolean;
    cleanInstall?: boolean;
    listOnly?: boolean;
    selectedTargets?: InstallableTarget[];
    showPrompts?: boolean;
}): number;
export declare function verifySetupInstall(target?: SetupTarget, options?: {
    json?: boolean;
    showPrompts?: boolean;
}): number;
//# sourceMappingURL=setup.d.ts.map