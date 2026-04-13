#!/usr/bin/env node
/**
 * gramatr-mcp — Local MCP server entry point.
 *
 * Usage:
 *   gramatr-mcp                       Start the stdio MCP server (default)
 *   gramatr-mcp login                 Authenticate and store local credentials
 *   gramatr-mcp add-api-key           Store an API key in local config
 *   gramatr-mcp logout                Remove stored credentials
 *   gramatr-mcp clear-creds           Remove all stored local credentials
 *   gramatr-mcp setup claude          Auto-configure Claude Code settings and hooks
 *   gramatr-mcp setup claude --clean-install  Remove legacy Claude/PAI/Fabric artifacts first
 *   gramatr-mcp setup codex           Auto-configure Codex hook settings
 *   gramatr-mcp setup claude-desktop  Auto-configure Claude Desktop MCP settings
 *   gramatr-mcp setup chatgpt-desktop Auto-configure ChatGPT Desktop MCP settings
 *   gramatr-mcp setup gemini          Auto-configure Gemini CLI extension files
 *   gramatr-mcp setup auto            Auto-detect and install detected local clients
 *   gramatr-mcp setup web             Show web connector instructions + prompt suggestion
 *   gramatr-mcp setup web chatgpt     Show ChatGPT web connector instructions
 *   gramatr-mcp setup web gemini      Show Gemini web connector instructions
 *   gramatr-mcp setup clean-install   Clean legacy install artifacts across known targets
 *   gramatr-mcp setup verify           Verify local MCP/hook install health
 *   gramatr-mcp build-mcpb            Build a Claude Desktop .mcpb manifest bundle
 *   gramatr-mcp hook <name> [args...] Run a hook (session-start, ...)
 *   gramatr-mcp hook --list           List registered hooks
 *   gramatr-mcp --version             Print version
 *   gramatr-mcp --help                Show help
 *
 * MCP clients configure this as:
 *   { "command": "node", "args": ["~/.gramatr/mcp/bin/gramatr-mcp.js"] }
 *
 * Or via npx (slower, checks npm on every invocation):
 *   { "command": "npx", "args": ["-y", "@gramatr/mcp"] }
 *
 * The `hook` subcommand family is the Phase 1 landing point for issue #652 —
 * client hooks (Claude Code, Codex, Gemini) invoke this binary directly
 * instead of shipping duplicated TypeScript in each integration package.
 */
export declare function parseAutoTargetSelection(raw: string, detected: string[]): string[] | null;
export declare function printHelp(): void;
export declare function cliMain(cliArgs?: string[]): Promise<void>;
//# sourceMappingURL=gramatr-mcp.d.ts.map