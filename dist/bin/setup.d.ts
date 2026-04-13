/**
 * gramatr setup claude — auto-configure Claude Code to use the local MCP server.
 *
 * Writes the mcpServers entry into ~/.claude.json (Claude Code's global MCP config).
 * Safe: reads existing config, merges in the gramatr server entry, writes back.
 * Idempotent: running it twice produces the same result.
 *
 * Usage:
 *   gramatr-mcp setup claude       Configure Claude Code
 *   gramatr-mcp setup claude --dry Run without writing
 */
import { buildInstallPromptSuggestion } from '../setup/instructions.js';
interface ClaudeConfig {
    mcpServers?: Record<string, McpServerEntry>;
    [key: string]: unknown;
}
interface McpServerEntry {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    [key: string]: unknown;
}
/**
 * Resolve the path to the gramatr-mcp binary.
 * Prefers the compiled dist version, falls back to npx.
 */
export declare function resolveBinaryPath(): {
    command: string;
    args: string[];
};
/**
 * Get the Claude Code config file path.
 * Claude Code stores global MCP config in ~/.claude.json
 */
export declare function getClaudeConfigPath(): string;
export declare function getClaudeSettingsPath(): string;
export declare function getCodexHooksPath(): string;
export declare function getCodexConfigPath(): string;
export declare function getClaudeMarkdownPath(): string;
export declare function getCodexAgentsPath(): string;
export declare function getGramatrSettingsPath(): string;
export declare function readJsonFile<T>(path: string, fallback: T): T;
/**
 * Read existing Claude config or return empty.
 */
export declare function readClaudeConfig(configPath: string): ClaudeConfig;
export declare function upsertManagedBlock(existing: string, content: string, startMarker: string, endMarker: string): string;
export declare function escapeRegExp(text: string): string;
export declare function ensureLocalSettings(): void;
export declare function emitInstallPromptSuggestion(target: Parameters<typeof buildInstallPromptSuggestion>[0]): void;
export declare function setupClaude(dryRun?: boolean): void;
export declare function setupCodex(dryRun?: boolean): void;
/**
 * Generic MCP-only target setup — merges the gramatr MCP server entry into
 * the target's JSON config file. Used by all platforms that support MCP via
 * a JSON config (Claude Desktop, ChatGPT Desktop, Cursor, Windsurf, VS Code).
 */
export declare function setupMcpTarget(targetName: string, configPath: string, dryRun: boolean): void;
export declare function setupClaudeDesktop(dryRun?: boolean): void;
export declare function setupChatgptDesktop(dryRun?: boolean): void;
export declare function setupCursor(dryRun?: boolean): void;
export declare function setupWindsurf(dryRun?: boolean): void;
export declare function setupVscode(dryRun?: boolean): void;
export declare function setupGemini(dryRun?: boolean): void;
export declare function setupWeb(target?: 'claude-web' | 'chatgpt-web' | 'gemini-web'): Promise<void>;
export {};
//# sourceMappingURL=setup.d.ts.map