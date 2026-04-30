#!/usr/bin/env node
/**
 * gramatr — Local MCP server entry point.
 *
 * Usage:
 *   gramatr start                 One-command setup: configure + login + verify + doctor
 *   gramatr                       Start the stdio MCP server (default)
 *   gramatr --mode admin          Start server in admin privilege mode
 *   gramatr login                 Authenticate and store local credentials
 *   gramatr add-api-key           Store an API key in local config
 *   gramatr logout                Remove stored credentials
 *   gramatr clear-creds           Remove all stored local credentials
 *   gramatr setup claude          Auto-configure Claude Code settings and hooks
 *   gramatr setup claude --clean-install  Remove legacy Claude/PAI/Fabric artifacts first
 *   gramatr setup codex           Auto-configure Codex hook settings
 *   gramatr setup claude-desktop  Auto-configure Claude Desktop MCP settings
 *   gramatr setup chatgpt-desktop Auto-configure ChatGPT Desktop MCP settings
 *   gramatr setup gemini          Auto-configure Gemini CLI extension files
 *   gramatr setup cursor          Auto-configure Cursor MCP settings
 *   gramatr setup windsurf        Auto-configure Windsurf MCP settings
 *   gramatr setup vscode          Auto-configure VS Code MCP settings
 *   gramatr setup all             Configure all supported local clients
 *   gramatr setup auto            Auto-detect and install detected local clients
 *   gramatr setup auto --list     List detected install targets only
 *   gramatr setup auto --yes      Install all detected targets (non-interactive)
 *   gramatr setup web             Show web connector instructions + prompt suggestion
 *   gramatr setup web chatgpt     Show ChatGPT web connector instructions
 *   gramatr setup web gemini      Show Gemini web connector instructions
 *   gramatr setup clean-install   Clean artifacts, then reinstall all supported local clients
 *   gramatr setup verify [target] Verify local MCP/hook install health
 *   gramatr setup verify --json    Emit verification results as JSON
 *   gramatr setup verify --show-prompts  Include install guidance prompts in verify output
 *   gramatr build-mcpb            Build a Claude Desktop .mcpb manifest bundle
 *   gramatr admin <command>        Admin user/org/team management
 *   gramatr admin --help          Show admin command help
 *   gramatr brain upload <file>   Upload a local file to the grāmatr brain
 *   gramatr brain upload --dir <dir>  Upload all supported files in a directory
 *   gramatr brain --help          Show brain subcommand help
 *   gramatr hook <name> [args...] Run a hook (session-start, ...)
 *   gramatr hook --list           List registered hooks
 *   gramatr daemon start          Start the persistent IPC daemon
 *   gramatr daemon stop           Send shutdown request to running daemon
 *   gramatr daemon status         Print daemon liveness and session count
 *   gramatr --version             Print version
 *   gramatr --help                Show help
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