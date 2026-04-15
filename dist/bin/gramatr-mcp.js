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
import { VERSION } from '../hooks/lib/version.js';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
const ALL_LOCAL_SETUP_TARGETS = [
    'claude',
    'codex',
    'gemini',
    'claude-desktop',
    'chatgpt-desktop',
    'cursor',
    'windsurf',
    'vscode',
];
export function parseAutoTargetSelection(raw, detected) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized)
        return detected;
    if (normalized === 'all' || normalized === '*')
        return detected;
    if (normalized === 'none' || normalized === 'cancel' || normalized === 'q' || normalized === 'quit')
        return null;
    const indexes = normalized
        .split(',')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => Number.parseInt(chunk, 10));
    if (indexes.length === 0 || indexes.some((n) => Number.isNaN(n))) {
        return detected;
    }
    const selected = indexes
        .map((n) => detected[n - 1])
        .filter((value) => typeof value === 'string');
    return selected.length > 0 ? Array.from(new Set(selected)) : detected;
}
async function promptAutoTargetSelection(detected) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
    });
    try {
        process.stderr.write('\n[gramatr-mcp] Select install targets for setup auto:\n');
        detected.forEach((target, index) => {
            process.stderr.write(`  ${index + 1}. ${target}\n`);
        });
        process.stderr.write('  Enter numbers (e.g. 1,3,4), or `all`, or `none` to cancel.\n');
        const answer = await rl.question('  Selection [all]: ');
        return parseAutoTargetSelection(answer, detected);
    }
    finally {
        rl.close();
    }
}
export function printHelp() {
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
    gramatr-mcp setup claude --clean-install
                                      Remove legacy Claude + PAI/Fabric/AIOS artifacts first
    gramatr-mcp setup codex            Configure Codex hook wiring
    gramatr-mcp setup claude-desktop   Configure Claude Desktop to use this server
    gramatr-mcp setup chatgpt-desktop  Configure ChatGPT Desktop to use this server
    gramatr-mcp setup gemini           Configure Gemini CLI extension files
    gramatr-mcp setup cursor           Configure Cursor MCP wiring
    gramatr-mcp setup windsurf         Configure Windsurf MCP wiring
    gramatr-mcp setup vscode           Configure VS Code MCP wiring
    gramatr-mcp setup all              Configure all supported local clients
    gramatr-mcp setup auto             Detect and install supported local clients
    gramatr-mcp setup auto --list      List detected setup targets only
    gramatr-mcp setup auto --yes       Install all detected targets non-interactively
    gramatr-mcp setup web              Show claude.ai web connector setup + prompt
    gramatr-mcp setup web chatgpt      Show ChatGPT web connector setup + prompt
    gramatr-mcp setup web gemini       Show Gemini web connector setup + prompt
    gramatr-mcp setup clean-install    Clean stale artifacts + reinstall all supported local clients
    gramatr-mcp setup <target> --show-prompts
                                      Print optional prompt suggestions after setup writes files
    gramatr-mcp setup verify [target]  Verify install wiring (all|claude|codex|...)
    gramatr-mcp setup verify --json    Emit verify output as JSON
    gramatr-mcp setup verify --show-prompts
                                      Include install prompt guidance in verify output
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
    gramatr-mcp setup claude --clean-install
                                          Remove stale legacy artifacts before writing setup
    gramatr-mcp setup claude-desktop     Write Claude Desktop config
    gramatr-mcp setup chatgpt-desktop    Write ChatGPT Desktop config
    gramatr-mcp setup gemini             Write Gemini extension manifest/hooks
    gramatr-mcp setup cursor             Write Cursor MCP config
    gramatr-mcp setup windsurf           Write Windsurf MCP config
    gramatr-mcp setup vscode             Write VS Code MCP config
    gramatr-mcp setup all                Configure all supported local clients
    gramatr-mcp setup auto               Detect and install supported local clients
    gramatr-mcp setup auto --list        List detected setup targets only
    gramatr-mcp setup auto --yes         Install all detected targets non-interactively
    gramatr-mcp setup clean-install      Clean stale artifacts, then reinstall all supported local clients
    gramatr-mcp setup <target> --show-prompts
                                          Print optional prompt suggestions after setup writes files
    gramatr-mcp setup verify             Verify setup wiring + managed guidance blocks
    gramatr-mcp setup verify --json      Emit verify output as JSON
    gramatr-mcp setup verify --show-prompts
                                          Include install guidance prompts in verify output
    gramatr-mcp setup claude --dry       Preview without writing
`);
}
export async function cliMain(cliArgs = process.argv.slice(2)) {
    // Handle hook subcommand — MUST be before any heavyweight imports so hook
    // invocation stays under the 250ms cold-start budget for UserPromptSubmit /
    // SessionStart. See issue #652 comment 4230136578 for the latency budget.
    if (cliArgs.includes('--version') || cliArgs.includes('-v')) {
        process.stdout.write(`${VERSION}\n`);
        process.exit(0);
    }
    if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
        printHelp();
        process.exit(0);
    }
    if (cliArgs[0] === 'hook') {
        const { runHook } = await import('./hook-dispatcher.js');
        const code = await runHook(cliArgs[1], cliArgs.slice(2));
        process.exit(code);
    }
    if (cliArgs[0] === 'login') {
        const { main: runLogin } = await import('./login.js');
        await runLogin();
        return;
    }
    if (cliArgs[0] === 'add-api-key') {
        const { main: runAddApiKey } = await import('./add-api-key.js');
        process.exit(await runAddApiKey());
    }
    if (cliArgs[0] === 'logout') {
        const { main: runLogout } = await import('./logout.js');
        process.exit(runLogout());
    }
    if (cliArgs[0] === 'clear-creds') {
        const { main: runClearCreds } = await import('./clear-creds.js');
        process.exit(runClearCreds());
    }
    if (cliArgs[0] === 'build-mcpb') {
        await import('./build-mcpb.js');
        return;
    }
    // Handle setup subcommand
    if (cliArgs[0] === 'setup') {
        const target = cliArgs[1];
        const dryRun = cliArgs.includes('--dry');
        const cleanInstall = cliArgs.includes('--clean-install') || cliArgs.includes('--clean');
        const showPrompts = cliArgs.includes('--show-prompts');
        const json = cliArgs.includes('--json');
        if (target === 'claude') {
            const { setupClaude } = await import('./setup.js');
            setupClaude(dryRun, cleanInstall, showPrompts);
            return;
        }
        if (target === 'codex') {
            if (cleanInstall) {
                const { runCleanInstall } = await import('./setup.js');
                runCleanInstall(dryRun);
            }
            const { setupCodex } = await import('./setup.js');
            setupCodex(dryRun, showPrompts);
            return;
        }
        if (target === 'claude-desktop') {
            if (cleanInstall) {
                const { runCleanInstall } = await import('./setup.js');
                runCleanInstall(dryRun);
            }
            const { setupClaudeDesktop } = await import('./setup.js');
            setupClaudeDesktop(dryRun, showPrompts);
            return;
        }
        if (target === 'chatgpt-desktop') {
            if (cleanInstall) {
                const { runCleanInstall } = await import('./setup.js');
                runCleanInstall(dryRun);
            }
            const { setupChatgptDesktop } = await import('./setup.js');
            setupChatgptDesktop(dryRun, showPrompts);
            return;
        }
        if (target === 'gemini') {
            if (cleanInstall) {
                const { runCleanInstall } = await import('./setup.js');
                runCleanInstall(dryRun);
            }
            const { setupGemini } = await import('./setup.js');
            setupGemini(dryRun, showPrompts);
            return;
        }
        if (target === 'cursor') {
            if (cleanInstall) {
                const { runCleanInstall } = await import('./setup.js');
                runCleanInstall(dryRun);
            }
            const { setupCursor } = await import('./setup.js');
            setupCursor(dryRun, showPrompts);
            return;
        }
        if (target === 'windsurf') {
            if (cleanInstall) {
                const { runCleanInstall } = await import('./setup.js');
                runCleanInstall(dryRun);
            }
            const { setupWindsurf } = await import('./setup.js');
            setupWindsurf(dryRun, showPrompts);
            return;
        }
        if (target === 'vscode') {
            if (cleanInstall) {
                const { runCleanInstall } = await import('./setup.js');
                runCleanInstall(dryRun);
            }
            const { setupVscode } = await import('./setup.js');
            setupVscode(dryRun, showPrompts);
            return;
        }
        if (target === 'web') {
            if (cleanInstall) {
                const { runCleanInstall } = await import('./setup.js');
                runCleanInstall(dryRun);
            }
            const webTarget = cliArgs[2];
            const resolved = webTarget === 'chatgpt' ? 'chatgpt-web'
                : webTarget === 'gemini' ? 'gemini-web'
                    : 'claude-web';
            const { setupWeb } = await import('./setup.js');
            await setupWeb(resolved);
            return;
        }
        if (target === 'auto') {
            const { setupAutoInstall, getAutoDetectedTargets } = await import('./setup.js');
            const listOnly = cliArgs.includes('--list') || cliArgs.includes('--list-only');
            const assumeYes = cliArgs.includes('--yes') || cliArgs.includes('-y');
            const interactiveAllowed = Boolean(process.stdin.isTTY && process.stdout.isTTY);
            let selectedTargets;
            if (!listOnly && !assumeYes && interactiveAllowed) {
                const detected = getAutoDetectedTargets();
                const selected = await promptAutoTargetSelection(detected);
                if (selected === null) {
                    process.stderr.write('[gramatr-mcp] setup auto cancelled.\n');
                    process.exit(1);
                }
                selectedTargets = selected;
            }
            setupAutoInstall({
                dryRun,
                cleanInstall,
                listOnly,
                selectedTargets,
                showPrompts,
            });
            return;
        }
        if (target === 'all') {
            const { setupAutoInstall } = await import('./setup.js');
            setupAutoInstall({
                dryRun,
                cleanInstall,
                listOnly: false,
                selectedTargets: ALL_LOCAL_SETUP_TARGETS,
                showPrompts,
            });
            return;
        }
        if (target === 'clean-install') {
            const { setupAutoInstall } = await import('./setup.js');
            setupAutoInstall({
                dryRun,
                cleanInstall: true,
                listOnly: false,
                selectedTargets: ALL_LOCAL_SETUP_TARGETS,
                showPrompts,
            });
            return;
        }
        if (target === 'verify') {
            const verifyTargetRaw = cliArgs.find((arg, index) => index > 1 && !arg.startsWith('--')) || 'all';
            const verifyTarget = verifyTargetRaw;
            const { verifySetupInstall } = await import('./setup.js');
            process.exit(verifySetupInstall(verifyTarget, { json, showPrompts }));
        }
        process.stderr.write(`[gramatr-mcp] Unknown setup target: ${target}\n`);
        process.stderr.write('  Supported: claude | codex | claude-desktop | chatgpt-desktop | gemini | cursor | windsurf | vscode | all | auto | web | clean-install | verify\n');
        process.exit(1);
    }
    // Default: start the stdio server. Lazy-loaded so the `hook` and `setup`
    // paths don't pay the MCP SDK import cost.
    const { startServer } = await import('../server/server.js');
    await startServer();
}
const isEntrypoint = process.argv[1] != null
    && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
    cliMain().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[gramatr-mcp] Fatal: ${message}\n`);
        process.exit(1);
    });
}
//# sourceMappingURL=gramatr-mcp.js.map