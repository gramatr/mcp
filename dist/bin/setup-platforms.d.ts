/**
 * setup-platforms — Platform-specific setup functions.
 *
 * Extracted from setup.ts for SRP: each target's setup logic
 * (Codex, Gemini, OpenCode, web connectors, generic MCP targets).
 */
import { buildInstallPromptSuggestion } from '../setup/instructions.js';
export declare function ensureCodexMcpServerConfig(configToml: string): string;
export declare function emitInstallPromptSuggestion(target: Parameters<typeof buildInstallPromptSuggestion>[0]): void;
export declare function setupCodex(dryRun?: boolean, showPrompts?: boolean): void;
/**
 * Generic MCP-only target setup — merges the gramatr MCP server entry into
 * the target's JSON config file. Used by all platforms that support MCP via
 * a JSON config (Claude Desktop, ChatGPT Desktop, Cursor, Windsurf, VS Code).
 */
export declare function setupMcpTarget(targetName: string, configPath: string, dryRun: boolean): void;
export declare function setupGemini(dryRun?: boolean, showPrompts?: boolean): void;
export declare function setupOpenCode(dryRun?: boolean, showPrompts?: boolean): void;
export declare function setupWeb(target?: 'claude-web' | 'chatgpt-web' | 'gemini-web'): Promise<void>;
//# sourceMappingURL=setup-platforms.d.ts.map