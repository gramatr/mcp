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
 *   gramatr-mcp setup codex           Auto-configure Codex hook settings
 *   gramatr-mcp setup claude-desktop  Auto-configure Claude Desktop MCP settings
 *   gramatr-mcp setup chatgpt-desktop Auto-configure ChatGPT Desktop MCP settings
 *   gramatr-mcp setup gemini          Auto-configure Gemini CLI extension files
 *   gramatr-mcp setup web             Show web connector instructions + prompt suggestion
 *   gramatr-mcp setup web chatgpt     Show ChatGPT web connector instructions
 *   gramatr-mcp setup web gemini      Show Gemini web connector instructions
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
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write('0.0.5\n');
    process.exit(0);
}
if (args.includes('--help') || args.includes('-h')) {
    process.stderr.write(`
  gramatr-mcp — Local MCP server for grāmatr

  Proxies all remote gramatr tools with local auth injection, caching,
  offline queueing, and local web tools. Also hosts the migrated hook
  runtime used by Claude Code, Codex, and Gemini integrations.

  Usage:
    gramatr-mcp                        Start the server (stdio)
    gramatr-mcp login                  Authenticate and store local credentials
    gramatr-mcp add-api-key            Store an API key in local config
    gramatr-mcp logout                 Remove stored credentials
    gramatr-mcp clear-creds            Remove all stored local credentials
    gramatr-mcp setup claude           Configure Claude Code to use this server
    gramatr-mcp setup codex            Configure Codex hook wiring
    gramatr-mcp setup claude-desktop   Configure Claude Desktop to use this server
    gramatr-mcp setup chatgpt-desktop  Configure ChatGPT Desktop to use this server
    gramatr-mcp setup gemini           Configure Gemini CLI extension files
    gramatr-mcp setup web              Show claude.ai web connector setup + prompt
    gramatr-mcp setup web chatgpt      Show ChatGPT web connector setup + prompt
    gramatr-mcp setup web gemini       Show Gemini web connector setup + prompt
    gramatr-mcp build-mcpb             Build a Claude Desktop .mcpb bundle
    gramatr-mcp hook <name> [args...]  Run a hook (stdin → stdout contract)
    gramatr-mcp hook --list            List registered hooks
    gramatr-mcp --version              Print version
    gramatr-mcp --help                 Show this help

  Configuration:
    Auth token:    ~/.gramatr.json (token field)
    Server URL:    GRAMATR_URL env or ~/.gramatr.json server_url
    API key:       GRAMATR_API_KEY env (overrides token)

  Setup:
    gramatr-mcp setup claude             Write MCP config to ~/.claude.json
    gramatr-mcp setup claude-desktop     Write Claude Desktop config
    gramatr-mcp setup chatgpt-desktop    Write ChatGPT Desktop config
    gramatr-mcp setup gemini             Write Gemini extension manifest/hooks
    gramatr-mcp setup claude --dry       Preview without writing
`);
    process.exit(0);
}
async function main() {
    // Handle hook subcommand — MUST be before any heavyweight imports so hook
    // invocation stays under the 250ms cold-start budget for UserPromptSubmit /
    // SessionStart. See issue #652 comment 4230136578 for the latency budget.
    if (args[0] === 'hook') {
        const { runHook } = await import('./hook-dispatcher.js');
        const code = await runHook(args[1], args.slice(2));
        process.exit(code);
    }
    if (args[0] === 'login') {
        const { main: runLogin } = await import('./login.js');
        await runLogin();
        return;
    }
    if (args[0] === 'add-api-key') {
        const { main: runAddApiKey } = await import('./add-api-key.js');
        process.exit(await runAddApiKey());
    }
    if (args[0] === 'logout') {
        const { main: runLogout } = await import('./logout.js');
        process.exit(runLogout());
    }
    if (args[0] === 'clear-creds') {
        const { main: runClearCreds } = await import('./clear-creds.js');
        process.exit(runClearCreds());
    }
    if (args[0] === 'build-mcpb') {
        await import('./build-mcpb.js');
        return;
    }
    // Handle setup subcommand
    if (args[0] === 'setup') {
        const target = args[1];
        const dryRun = args.includes('--dry');
        if (target === 'claude') {
            const { setupClaude } = await import('./setup.js');
            setupClaude(dryRun);
            return;
        }
        if (target === 'codex') {
            const { setupCodex } = await import('./setup.js');
            setupCodex(dryRun);
            return;
        }
        if (target === 'claude-desktop') {
            const { setupClaudeDesktop } = await import('./setup.js');
            setupClaudeDesktop(dryRun);
            return;
        }
        if (target === 'chatgpt-desktop') {
            const { setupChatgptDesktop } = await import('./setup.js');
            setupChatgptDesktop(dryRun);
            return;
        }
        if (target === 'gemini') {
            const { setupGemini } = await import('./setup.js');
            setupGemini(dryRun);
            return;
        }
        if (target === 'cursor') {
            const { setupCursor } = await import('./setup.js');
            setupCursor(dryRun);
            return;
        }
        if (target === 'windsurf') {
            const { setupWindsurf } = await import('./setup.js');
            setupWindsurf(dryRun);
            return;
        }
        if (target === 'vscode') {
            const { setupVscode } = await import('./setup.js');
            setupVscode(dryRun);
            return;
        }
        if (target === 'web') {
            const webTarget = args[2];
            const resolved = webTarget === 'chatgpt' ? 'chatgpt-web'
                : webTarget === 'gemini' ? 'gemini-web'
                    : 'claude-web';
            const { setupWeb } = await import('./setup.js');
            await setupWeb(resolved);
            return;
        }
        process.stderr.write(`[gramatr-mcp] Unknown setup target: ${target}\n`);
        process.stderr.write('  Supported: claude | codex | claude-desktop | chatgpt-desktop | gemini | cursor | windsurf | vscode | web\n');
        process.exit(1);
    }
    // Default: start the stdio server. Lazy-loaded so the `hook` and `setup`
    // paths don't pay the MCP SDK import cost.
    const { startServer } = await import('../server/server.js');
    await startServer();
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[gramatr-mcp] Fatal: ${message}\n`);
    process.exit(1);
});
export {};
//# sourceMappingURL=gramatr-mcp.js.map