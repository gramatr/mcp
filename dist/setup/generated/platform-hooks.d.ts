/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/platforms/*.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-04-22T20:27:03.938Z
 */
export interface PlatformHookEntry {
    hook: string;
    matcher?: string;
    name?: string;
    statusMessage?: string;
    timeout?: number;
    description?: string;
}
export interface PlatformMcpServer {
    command: string;
    args?: string[];
    timeout?: number;
    env?: Record<string, string>;
}
export interface PlatformConfig {
    name: string;
    display_name: string;
    description: string;
    client_flag: string;
    config_file: string;
    hooks: Record<string, PlatformHookEntry[]>;
    mcp_server: PlatformMcpServer;
    settings?: Record<string, unknown>;
    instruction_blocks: string[];
}
/** grāmatr for ChatGPT — ChatGPT official plugin/add-on — sandbox environment, OAuth auth, OpenAPI manifest */
export declare const CHATGPT_ADDON_HOOKS: PlatformConfig;
/** ChatGPT Desktop — ChatGPT Desktop app integration via MCP server config (hookless) */
export declare const CHATGPT_DESKTOP_HOOKS: PlatformConfig;
/** grāmatr — ChatGPT Custom GPT instructions — ~8000 char budget, MCP pre-wired at GPT level, shareable link */
export declare const CHATGPT_GPT_HOOKS: PlatformConfig;
/** ChatGPT Project — ChatGPT Project instructions — 5000 char budget, MCP connected at project level */
export declare const CHATGPT_PROJECT_HOOKS: PlatformConfig;
/** ChatGPT Web — ChatGPT Web (chat.openai.com) integration via MCP — hookless, paste into personal prompt or custom GPT */
export declare const CHATGPT_WEB_HOOKS: PlatformConfig;
/** grāmatr for Claude — Claude.ai official MCP add-on — Anthropic partner program, sandbox environment */
export declare const CLAUDE_ADDON_HOOKS: PlatformConfig;
/** Claude Code — Claude Code CLI integration with full hook lifecycle */
export declare const CLAUDE_CODE_HOOKS: PlatformConfig;
/** Claude Desktop — Claude Desktop app integration via MCP server config (hookless) */
export declare const CLAUDE_DESKTOP_HOOKS: PlatformConfig;
/** Claude Project — Claude.ai Project instructions — larger budget than personal, MCP connected at project level */
export declare const CLAUDE_PROJECT_HOOKS: PlatformConfig;
/** Claude Web — Claude Web (claude.ai) integration via MCP — hookless, paste instructions into personal prompt */
export declare const CLAUDE_WEB_HOOKS: PlatformConfig;
/** Codex — OpenAI Codex CLI integration with session and prompt hooks */
export declare const CODEX_HOOKS: PlatformConfig;
/** Cursor — Cursor IDE integration via MCP server config (hookless, uses route_request) */
export declare const CURSOR_HOOKS: PlatformConfig;
/** Gemini CLI — Gemini CLI integration via extension manifest and hooks */
export declare const GEMINI_CLI_HOOKS: PlatformConfig;
/** OpenCode — OpenCode plugin-based integration (no hooks file, uses plugin architecture) */
export declare const OPENCODE_HOOKS: PlatformConfig;
/** VS Code — VS Code integration with Copilot/Continue via MCP server config (hookless) */
export declare const VSCODE_HOOKS: PlatformConfig;
/** Windsurf — Windsurf IDE integration via MCP server config (hookless) */
export declare const WINDSURF_HOOKS: PlatformConfig;
/** All platform configs keyed by platform name */
export declare const PLATFORM_HOOKS: Record<string, PlatformConfig>;
//# sourceMappingURL=platform-hooks.d.ts.map