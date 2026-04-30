#!/usr/bin/env node
/**
 * gramatr-mcp — Local MCP server entry point.
 *
 * Usage:
 *   gramatr-mcp start                 One-command setup: configure + login + verify + doctor
 *   gramatr-mcp                       Start the stdio MCP server (default)
 *   gramatr-mcp --mode admin          Start server in admin privilege mode
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
 *   gramatr-mcp setup cursor          Auto-configure Cursor MCP settings
 *   gramatr-mcp setup windsurf        Auto-configure Windsurf MCP settings
 *   gramatr-mcp setup vscode          Auto-configure VS Code MCP settings
 *   gramatr-mcp setup all             Configure all supported local clients
 *   gramatr-mcp setup auto            Auto-detect and install detected local clients
 *   gramatr-mcp setup auto --list     List detected install targets only
 *   gramatr-mcp setup auto --yes      Install all detected targets (non-interactive)
 *   gramatr-mcp setup web             Show web connector instructions + prompt suggestion
 *   gramatr-mcp setup web chatgpt     Show ChatGPT web connector instructions
 *   gramatr-mcp setup web gemini      Show Gemini web connector instructions
 *   gramatr-mcp setup clean-install   Clean artifacts, then reinstall all supported local clients
 *   gramatr-mcp setup verify [target] Verify local MCP/hook install health
 *   gramatr-mcp setup verify --json    Emit verification results as JSON
 *   gramatr-mcp setup verify --show-prompts  Include install guidance prompts in verify output
 *   gramatr-mcp build-mcpb            Build a Claude Desktop .mcpb manifest bundle
 *   gramatr-mcp admin <command>        Admin user/org/team management
 *   gramatr-mcp admin --help          Show admin command help
 *   gramatr-mcp brain upload <file>   Upload a local file to the grāmatr brain
 *   gramatr-mcp brain upload --dir <dir>  Upload all supported files in a directory
 *   gramatr-mcp brain --help          Show brain subcommand help
 *   gramatr-mcp hook <name> [args...] Run a hook (session-start, ...)
 *   gramatr-mcp hook --list           List registered hooks
 *   gramatr-mcp daemon start          Start the persistent IPC daemon
 *   gramatr-mcp daemon stop           Send shutdown request to running daemon
 *   gramatr-mcp daemon status         Print daemon liveness and session count
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