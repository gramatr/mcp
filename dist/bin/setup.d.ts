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
export declare function setupClaude(dryRun?: boolean): void;
export declare function setupCodex(dryRun?: boolean): void;
export declare function setupClaudeDesktop(dryRun?: boolean): void;
export declare function setupChatgptDesktop(dryRun?: boolean): void;
export declare function setupCursor(dryRun?: boolean): void;
export declare function setupWindsurf(dryRun?: boolean): void;
export declare function setupVscode(dryRun?: boolean): void;
export declare function setupGemini(dryRun?: boolean): void;
export declare function setupWeb(target?: 'claude-web' | 'chatgpt-web' | 'gemini-web'): Promise<void>;
//# sourceMappingURL=setup.d.ts.map