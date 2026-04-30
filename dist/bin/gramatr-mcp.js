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
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { VERSION } from "../hooks/lib/version.js";
const ALL_LOCAL_SETUP_TARGETS = [
    "claude",
    "codex",
    "opencode",
    "gemini",
    "claude-desktop",
    "chatgpt-desktop",
    "cursor",
    "windsurf",
    "vscode",
];
export function parseAutoTargetSelection(raw, detected) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized)
        return detected;
    if (normalized === "all" || normalized === "*")
        return detected;
    if (normalized === "none" ||
        normalized === "cancel" ||
        normalized === "q" ||
        normalized === "quit")
        return null;
    const indexes = normalized
        .split(",")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => Number.parseInt(chunk, 10));
    if (indexes.length === 0 || indexes.some((n) => Number.isNaN(n))) {
        return detected;
    }
    const selected = indexes
        .map((n) => detected[n - 1])
        .filter((value) => typeof value === "string");
    return selected.length > 0 ? Array.from(new Set(selected)) : detected;
}
async function promptAutoTargetSelection(detected) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
    });
    try {
        process.stderr.write("\n[gramatr] Select install targets for setup auto:\n");
        detected.forEach((target, index) => {
            process.stderr.write(`  ${index + 1}. ${target}\n`);
        });
        process.stderr.write("  Enter numbers (e.g. 1,3,4), or `all`, or `none` to cancel.\n");
        const answer = await rl.question("  Selection [all]: ");
        return parseAutoTargetSelection(answer, detected);
    }
    finally {
        rl.close();
    }
}
export function printHelp() {
    process.stderr.write(`
  gramatr — Local MCP server for grāmatr

  Proxies all remote gramatr tools with local auth injection, caching,
  offline queueing, and local web tools. Also hosts the migrated hook
  runtime used by Claude Code, Codex, and Gemini integrations.

  Usage:
    gramatr start                  One-command setup + login + verify + health check
    gramatr                            Start the server (stdio)
    gramatr login                  Authenticate and store local credentials
    gramatr add-api-key            Store an API key in local config
    gramatr logout                 Remove stored credentials
    gramatr clear-creds            Remove all stored local credentials
    gramatr setup claude           Configure Claude Code to use this server
    gramatr setup claude --clean-install
                                      Remove legacy pre-rebrand artifacts first
    gramatr setup codex            Configure Codex hook wiring
    gramatr setup claude-desktop   Configure Claude Desktop to use this server
    gramatr setup chatgpt-desktop  Configure ChatGPT Desktop to use this server
    gramatr setup gemini           Configure Gemini CLI extension files
    gramatr setup cursor           Configure Cursor MCP wiring
    gramatr setup windsurf         Configure Windsurf MCP wiring
    gramatr setup vscode           Configure VS Code MCP wiring
    gramatr setup all              Configure all supported local clients
    gramatr setup auto             Detect and install supported local clients
    gramatr setup auto --list      List detected setup targets only
    gramatr setup auto --yes       Install all detected targets non-interactively
    gramatr setup web              Show claude.ai web connector setup + prompt
    gramatr setup web chatgpt      Show ChatGPT web connector setup + prompt
    gramatr setup web gemini       Show Gemini web connector setup + prompt
    gramatr setup clean-install    Clean stale artifacts + reinstall all supported local clients
    gramatr setup <target> --show-prompts
                                      Print optional prompt suggestions after setup writes files
    gramatr setup verify [target]  Verify install wiring (all|claude|codex|...)
    gramatr setup verify --json    Emit verify output as JSON
    gramatr setup verify --show-prompts
                                      Include install prompt guidance in verify output
    gramatr admin <command>         Admin user/org/team management
    gramatr admin --help           Show admin subcommand help
    gramatr brain upload <file>    Upload a local file to the grāmatr brain
    gramatr brain upload --dir <dir>
                                      Upload all supported files in a directory
    gramatr brain --help           Show brain subcommand help
    gramatr build-mcpb             Build a Claude Desktop .mcpb bundle
    gramatr hook <name> [args...]  Run a hook (stdin → stdout contract)
    gramatr hook --list            List registered hooks
    gramatr daemon start           Start the persistent IPC daemon
    gramatr daemon stop            Send shutdown request to running daemon
    gramatr daemon status          Print daemon liveness and session count
    gramatr --mode <level>         Set initial privilege mode (user|team|org|admin)
    gramatr --version              Print version
    gramatr --help                 Show this help

  Privilege modes:
    user  (default) Core memory, search, entity CRUD, session tools
    team            User + team-scoped entity tools, shared playbooks
    org             Team + org admin tools (standards, benchmarks, member mgmt)
    admin           Full set — audit, API key admin, billing-adjacent ops

  Configuration:
    Auth token:    ~/.gramatr.json (token field)
    Server URL:    GRAMATR_URL env or ~/.gramatr.json server_url
    API key:       GRAMATR_API_KEY env (overrides token)

  Setup:
    gramatr setup claude             Write MCP config to ~/.claude.json
    gramatr setup claude --clean-install
                                          Remove stale legacy artifacts before writing setup
    gramatr setup claude-desktop     Write Claude Desktop config
    gramatr setup chatgpt-desktop    Write ChatGPT Desktop config
    gramatr setup gemini             Write Gemini extension manifest/hooks
    gramatr setup cursor             Write Cursor MCP config
    gramatr setup windsurf           Write Windsurf MCP config
    gramatr setup vscode             Write VS Code MCP config
    gramatr setup all                Configure all supported local clients
    gramatr setup auto               Detect and install supported local clients
    gramatr setup auto --list        List detected setup targets only
    gramatr setup auto --yes         Install all detected targets non-interactively
    gramatr setup clean-install      Clean stale artifacts, then reinstall all supported local clients
    gramatr setup <target> --show-prompts
                                          Print optional prompt suggestions after setup writes files
    gramatr setup verify             Verify setup wiring + managed guidance blocks
    gramatr setup verify --json      Emit verify output as JSON
    gramatr setup verify --show-prompts
                                          Include install guidance prompts in verify output
    gramatr setup claude --dry       Preview without writing

  Quick start:
    gramatr start                  Setup + login + verify + health check in one command
`);
}
export async function cliMain(cliArgs = process.argv.slice(2)) {
    // Handle hook subcommand — MUST be before any heavyweight imports so hook
    // invocation stays under the 250ms cold-start budget for UserPromptSubmit /
    // SessionStart. See issue #652 comment 4230136578 for the latency budget.
    if (cliArgs.includes("--version") || cliArgs.includes("-v")) {
        process.stdout.write(`${VERSION}\n`);
        process.exit(0);
    }
    if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
        printHelp();
        process.exit(0);
    }
    if (cliArgs[0] === "hook") {
        const { runHook } = await import("./hook-dispatcher.js");
        const code = await runHook(cliArgs[1], cliArgs.slice(2));
        process.exit(code);
    }
    if (cliArgs[0] === "statusline") {
        const { runStatusline } = await import("./statusline.js");
        await runStatusline(cliArgs.slice(1));
        process.exit(0);
    }
    if (cliArgs[0] === "daemon") {
        const sub = cliArgs[1];
        if (sub === "start") {
            const { startDaemon } = await import("../daemon/index.js");
            await startDaemon();
            return;
        }
        if (sub === "stop") {
            const { callViaDaemon } = await import("../proxy/local-client.js");
            const result = await callViaDaemon("daemon/shutdown", {});
            if (result === (await import("../daemon/ipc-protocol.js")).DAEMON_UNAVAILABLE) {
                process.stderr.write("[gramatr] daemon is not running\n");
                process.exit(1);
            }
            process.stderr.write("[gramatr] daemon shutdown requested\n");
            return;
        }
        if (sub === "status") {
            const { callViaDaemon } = await import("../proxy/local-client.js");
            const { DAEMON_UNAVAILABLE } = await import("../daemon/ipc-protocol.js");
            const result = await callViaDaemon("daemon/ping", {});
            if (result === DAEMON_UNAVAILABLE) {
                process.stderr.write("[gramatr] daemon is not running\n");
                process.exit(1);
            }
            const info = result;
            process.stderr.write(`[gramatr] daemon running — pid=${info.pid} version=${info.version} uptime=${Math.round(info.uptime)}s sessions=${info.sessions}\n`);
            return;
        }
        process.stderr.write(`[gramatr] Unknown daemon subcommand: ${String(sub)}\nUsage: daemon start|stop|status\n`);
        process.exit(1);
    }
    if (cliArgs[0] === "admin") {
        const { runAdmin } = await import("./admin.js");
        process.exit(await runAdmin(cliArgs.slice(1)));
    }
    if (cliArgs[0] === "brain") {
        const { runBrain } = await import("./brain.js");
        process.exit(await runBrain(cliArgs.slice(1)));
    }
    // 'upload' is a legacy alias for 'brain upload' — kept for backward compatibility
    if (cliArgs[0] === "upload") {
        const { runBrain } = await import("./brain.js");
        process.exit(await runBrain(["upload", ...cliArgs.slice(1)]));
    }
    if (cliArgs[0] === "start") {
        const write = (msg) => process.stderr.write(msg + "\n");
        const ok = (msg) => write(`  \x1b[32m✓\x1b[0m ${msg}`);
        const fail = (msg) => write(`  \x1b[31m✗\x1b[0m ${msg}`);
        write("");
        write("  \x1b[1mgrāmatr\x1b[0m — setting up your AI middleware");
        write("");
        // Step 1: Setup (auto, non-interactive)
        try {
            write("  Setting up local clients...");
            const { setupAutoInstall } = await import("./setup.js");
            setupAutoInstall({ dryRun: false, cleanInstall: false, listOnly: false, showPrompts: false });
            ok("Setup complete");
        }
        catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            fail(`Setup failed: ${detail}`);
            write("  Run manually: npx @gramatr/mcp setup auto");
            process.exit(1);
        }
        // Step 2: Authenticate (skip if already have token)
        try {
            const { readConfig, loginBrowser } = await import("./login.js");
            const config = readConfig();
            if (config.token) {
                ok("Already authenticated");
            }
            else {
                write("  Authenticating...");
                await loginBrowser();
                ok("Authenticated");
            }
        }
        catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            fail(`Authentication failed: ${detail}`);
            write("  Run manually: npx @gramatr/mcp login");
            // Non-fatal — continue to verify + doctor
        }
        // Step 3: Verify install
        try {
            const { verifySetupInstall } = await import("./setup.js");
            const verifyResult = verifySetupInstall("all", { json: false, showPrompts: false });
            if (verifyResult === 0) {
                ok("Install verified");
            }
            else {
                fail("Install verification found issues");
                write("  Run: npx @gramatr/mcp setup verify");
            }
        }
        catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            fail(`Verification failed: ${detail}`);
        }
        // Step 4: Health check
        try {
            const { checkServerHealth } = await import("./login.js");
            const health = await checkServerHealth();
            if (health.ok) {
                ok(`Server healthy (v${health.version || "unknown"})`);
            }
            else {
                fail(`Server unreachable: ${health.error}`);
                write("  Check GRAMATR_URL or server status");
            }
        }
        catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            fail(`Health check failed: ${detail}`);
        }
        write("");
        write("  \x1b[32mYou're ready.\x1b[0m Your next prompt will be enhanced by grāmatr.");
        write("");
        return;
    }
    if (cliArgs[0] === "login") {
        const { main: runLogin } = await import("./login.js");
        await runLogin();
        return;
    }
    if (cliArgs[0] === "add-api-key") {
        const { main: runAddApiKey } = await import("./add-api-key.js");
        process.exit(await runAddApiKey());
    }
    if (cliArgs[0] === "logout") {
        const { main: runLogout } = await import("./logout.js");
        process.exit(runLogout());
    }
    if (cliArgs[0] === "clear-creds") {
        const { main: runClearCreds } = await import("./clear-creds.js");
        process.exit(runClearCreds());
    }
    if (cliArgs[0] === "build-mcpb") {
        await import("./build-mcpb.js");
        return;
    }
    // Handle setup subcommand
    if (cliArgs[0] === "setup") {
        const target = cliArgs[1];
        const dryRun = cliArgs.includes("--dry");
        const cleanInstall = cliArgs.includes("--clean-install") || cliArgs.includes("--clean");
        const showPrompts = cliArgs.includes("--show-prompts");
        const json = cliArgs.includes("--json");
        if (target === "claude") {
            // ── Interactive prompts first — before any heavyweight imports ──
            // Deferring import('./setup.js') until after all readline questions prevents
            // the Node SQLite ExperimentalWarning (emitted when node:sqlite is first
            // imported) from splitting the prompt output mid-line. (#1694)
            let showStatusLine = true;
            if (!dryRun && process.stdin.isTTY && process.stderr.isTTY) {
                const rl = createInterface({ input: process.stdin, output: process.stderr });
                try {
                    const answer = await rl.question("  Show the grāmatr status line in Claude Code? [Y/n] ");
                    showStatusLine = answer.trim().toLowerCase() !== "n";
                }
                finally {
                    rl.close();
                }
            }
            // Prompt for auto-compact if not already configured
            const { readConfig: readGmtrConfig, writeConfig: writeGmtrConfig } = await import("./login.js");
            const latestConfig = readGmtrConfig();
            const existingAutoCompact = latestConfig?.auto_compact;
            if (existingAutoCompact?.auto === undefined &&
                !dryRun &&
                process.stdin.isTTY &&
                process.stderr.isTTY) {
                process.stderr.write("  grāmatr session continuity: saves full context every 15 turns — tasks, git state,\n");
                process.stderr.write("  recent work. Restores automatically after /clear so nothing is lost.\n");
                const rl3 = createInterface({ input: process.stdin, output: process.stderr });
                try {
                    const compactAnswer = await rl3.question("  Enable session continuity? [Y/n] ");
                    const enableAutoCompact = compactAnswer.trim().toLowerCase() !== "n";
                    writeGmtrConfig({
                        ...latestConfig,
                        auto_compact: { auto: enableAutoCompact, every_turns: 15, remind_every: 5 },
                    });
                }
                finally {
                    rl3.close();
                }
            }
            // All prompts done — now safe to import setup.js (triggers node:sqlite import)
            const { setupClaude } = await import("./setup.js");
            setupClaude(dryRun, cleanInstall, showPrompts, showStatusLine);
            return;
        }
        if (target === "codex") {
            if (cleanInstall) {
                const { runCleanInstall } = await import("./setup.js");
                runCleanInstall(dryRun);
            }
            const { setupCodex } = await import("./setup.js");
            setupCodex(dryRun, showPrompts);
            return;
        }
        if (target === "claude-desktop") {
            if (cleanInstall) {
                const { runCleanInstall } = await import("./setup.js");
                runCleanInstall(dryRun);
            }
            const { setupClaudeDesktop } = await import("./setup.js");
            setupClaudeDesktop(dryRun, showPrompts);
            return;
        }
        if (target === "chatgpt-desktop") {
            if (cleanInstall) {
                const { runCleanInstall } = await import("./setup.js");
                runCleanInstall(dryRun);
            }
            const { setupChatgptDesktop } = await import("./setup.js");
            setupChatgptDesktop(dryRun, showPrompts);
            return;
        }
        if (target === "gemini") {
            if (cleanInstall) {
                const { runCleanInstall } = await import("./setup.js");
                runCleanInstall(dryRun);
            }
            const { setupGemini } = await import("./setup.js");
            setupGemini(dryRun, showPrompts);
            return;
        }
        if (target === "cursor") {
            if (cleanInstall) {
                const { runCleanInstall } = await import("./setup.js");
                runCleanInstall(dryRun);
            }
            const { setupCursor } = await import("./setup.js");
            setupCursor(dryRun, showPrompts);
            return;
        }
        if (target === "windsurf") {
            if (cleanInstall) {
                const { runCleanInstall } = await import("./setup.js");
                runCleanInstall(dryRun);
            }
            const { setupWindsurf } = await import("./setup.js");
            setupWindsurf(dryRun, showPrompts);
            return;
        }
        if (target === "vscode") {
            if (cleanInstall) {
                const { runCleanInstall } = await import("./setup.js");
                runCleanInstall(dryRun);
            }
            const { setupVscode } = await import("./setup.js");
            setupVscode(dryRun, showPrompts);
            return;
        }
        if (target === "web") {
            if (cleanInstall) {
                const { runCleanInstall } = await import("./setup.js");
                runCleanInstall(dryRun);
            }
            const webTarget = cliArgs[2];
            const resolved = webTarget === "chatgpt"
                ? "chatgpt-web"
                : webTarget === "gemini"
                    ? "gemini-web"
                    : "claude-web";
            const { setupWeb } = await import("./setup.js");
            await setupWeb(resolved);
            return;
        }
        if (target === "auto") {
            const { setupAutoInstall, getAutoDetectedTargets } = await import("./setup.js");
            const listOnly = cliArgs.includes("--list") || cliArgs.includes("--list-only");
            const assumeYes = cliArgs.includes("--yes") || cliArgs.includes("-y");
            const interactiveAllowed = Boolean(process.stdin.isTTY && process.stdout.isTTY);
            let selectedTargets;
            if (!listOnly && !assumeYes && interactiveAllowed) {
                const detected = getAutoDetectedTargets();
                const selected = await promptAutoTargetSelection(detected);
                if (selected === null) {
                    process.stderr.write("[gramatr] setup auto cancelled.\n");
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
        if (target === "all") {
            const { setupAutoInstall } = await import("./setup.js");
            setupAutoInstall({
                dryRun,
                cleanInstall,
                listOnly: false,
                selectedTargets: ALL_LOCAL_SETUP_TARGETS,
                showPrompts,
            });
            return;
        }
        if (target === "clean-install") {
            const { setupAutoInstall } = await import("./setup.js");
            setupAutoInstall({
                dryRun,
                cleanInstall: true,
                listOnly: false,
                selectedTargets: ALL_LOCAL_SETUP_TARGETS,
                showPrompts,
            });
            return;
        }
        if (target === "verify") {
            const verifyTargetRaw = cliArgs.find((arg, index) => index > 1 && !arg.startsWith("--")) || "all";
            const verifyTarget = verifyTargetRaw;
            const { verifySetupInstall } = await import("./setup.js");
            process.exit(verifySetupInstall(verifyTarget, { json, showPrompts }));
        }
        process.stderr.write(`[gramatr] Unknown setup target: ${target}\n`);
        process.stderr.write("  Supported: claude | codex | claude-desktop | chatgpt-desktop | gemini | cursor | windsurf | vscode | all | auto | web | clean-install | verify\n");
        process.exit(1);
    }
    // ── --mode flag: set initial privilege mode before starting the server ──
    // Usage: gramatr --mode admin
    // Sets the session's privilege mode at startup. Session-scoped only — resets on restart.
    {
        const modeIdx = cliArgs.indexOf("--mode");
        if (modeIdx !== -1) {
            const modeValue = cliArgs[modeIdx + 1];
            const { isValidMode, setCurrentMode, PRIVILEGE_MODES } = await import("../proxy/tool-privilege.js");
            if (!modeValue || !isValidMode(modeValue)) {
                const valid = PRIVILEGE_MODES.join(" | ");
                process.stderr.write(`[gramatr] Invalid --mode value: "${String(modeValue)}". Must be one of: ${valid}\n`);
                process.exit(1);
                return;
            }
            setCurrentMode(modeValue);
            process.stderr.write(`[gramatr] Privilege mode set to: ${modeValue}\n`);
        }
    }
    // ── Unknown subcommand guard (#1696) ──
    // If the first positional arg looks like a subcommand (no leading '-') but
    // didn't match any handler above, reject it with a helpful error. Without this
    // guard, typos silently fall through and start the MCP server.
    if (cliArgs[0] && !cliArgs[0].startsWith("-")) {
        const KNOWN_SUBCOMMANDS = [
            "hook",
            "statusline",
            "daemon",
            "admin",
            "brain",
            "start",
            "login",
            "add-api-key",
            "logout",
            "clear-creds",
            "build-mcpb",
            "setup",
        ];
        const typed = cliArgs[0];
        process.stderr.write(`[gramatr] Unknown subcommand: ${typed}\n`);
        // Inline Levenshtein distance for "did you mean?" suggestions (no dependency needed)
        function levenshtein(a, b) {
            const m = a.length;
            const n = b.length;
            const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    dp[i][j] =
                        a[i - 1] === b[j - 1]
                            ? dp[i - 1][j - 1]
                            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
                }
            }
            return dp[m][n];
        }
        const suggestion = KNOWN_SUBCOMMANDS.map((cmd) => ({ cmd, dist: levenshtein(typed, cmd) }))
            .filter(({ dist }) => dist <= 2)
            .sort((a, b) => a.dist - b.dist)[0];
        if (suggestion) {
            process.stderr.write(`  Did you mean: gramatr ${suggestion.cmd}?\n`);
        }
        process.stderr.write("  Run: gramatr --help\n");
        process.exit(1);
    }
    // Auto-repair: if extraKnownMarketplaces.gramatr is missing from Claude settings,
    // the plugin silently fails to install. Re-run setup to fix it before starting.
    try {
        const { getClaudeSettingsPath, parseJson, getGramatrPluginDir } = await import("./setup-config-io.js");
        const { join } = await import("node:path");
        const { existsSync } = await import("node:fs");
        const settingsPath = getClaudeSettingsPath();
        const settings = parseJson(settingsPath);
        const pluginJsonPath = join(getGramatrPluginDir(), ".claude-plugin", "plugin.json");
        const marketplaceRegistered = settings?.extraKnownMarketplaces?.gramatr;
        if (!marketplaceRegistered || !existsSync(pluginJsonPath)) {
            process.stderr.write("[gramatr] Plugin marketplace not registered — running setup to repair...\n");
            const { setupClaude } = await import("./setup.js");
            setupClaude(false, false, false);
        }
    }
    catch {
        /* non-critical — proceed to start server regardless */
    }
    // Default: start the stdio server. Lazy-loaded so the `hook` and `setup`
    // paths don't pay the MCP SDK import cost.
    const { startServer } = await import("../server/server.js");
    await startServer();
}
// Detect if this module is the entry point. Handles both direct node invocation
// (process.argv[1] === this file) and npm bin shims (process.argv[1] is the
// shim wrapper that loads this file).
const thisFile = fileURLToPath(import.meta.url);
const isEntrypoint = process.argv[1] != null &&
    (process.argv[1] === thisFile ||
        process.argv[1].endsWith("gramatr") ||
        process.argv[1].endsWith("gramatr.cmd") ||
        process.argv[1].endsWith("gramatr.ps1") ||
        process.argv[1].endsWith("gramatr-mcp") ||
        process.argv[1].endsWith("gramatr-mcp.js") ||
        process.argv[1].endsWith("gramatr-mcp.cmd") ||
        process.argv[1].endsWith("gramatr-mcp.ps1"));
if (isEntrypoint) {
    cliMain().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[gramatr] Fatal: ${message}\n`);
        process.exit(1);
    });
}
//# sourceMappingURL=gramatr-mcp.js.map