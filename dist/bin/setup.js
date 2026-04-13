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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGramatrDirFromEnv, getGramatrUrlFromEnv } from '../config-runtime.js';
import { buildClaudeHooksFile, buildCodexHooksFile, buildClaudeMcpServerEntry, ensureCodexHooksFeature, mergeManagedHooks, } from '../setup/integrations.js';
import { CLAUDE_BLOCK_END, CLAUDE_BLOCK_START, CLAUDE_CODE_GUIDANCE, CODEX_BLOCK_END, CODEX_BLOCK_START, CODEX_GUIDANCE, buildInstallPromptSuggestion, } from '../setup/instructions.js';
import { buildGeminiExtensionManifest, buildGeminiHooksFile, buildLocalMcpServerEntry, getChatgptDesktopConfigPath, getClaudeDesktopConfigPath, getCursorConfigPath, getGeminiExtensionDir, getGeminiHooksPath, getGeminiManifestPath, getVscodeConfigPath, getWindsurfConfigPath, mergeMcpServerConfig, } from '../setup/targets.js';
import { buildConnectorInstructions, buildPromptSuggestion, validateServerReachability, } from '../setup/web-connector.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// gramatr-allow: C1 — CLI entry point, reads HOME for config path
const HOME = process.env.HOME || process.env.USERPROFILE || '';
/**
 * Resolve the path to the gramatr-mcp binary.
 * Prefers the compiled dist version, falls back to npx.
 */
export function resolveBinaryPath() {
    // Check if we're installed globally or locally
    const localBin = resolve(__dirname, '../bin/gramatr-mcp.js');
    if (existsSync(localBin)) {
        return { command: 'node', args: [localBin] };
    }
    // Fallback to npx (slower but always works)
    return { command: 'npx', args: ['-y', '@gramatr/mcp'] };
}
/**
 * Get the Claude Code config file path.
 * Claude Code stores global MCP config in ~/.claude.json
 */
export function getClaudeConfigPath() {
    return join(HOME, '.claude.json');
}
export function getClaudeSettingsPath() {
    return join(HOME, '.claude', 'settings.json');
}
export function getCodexHooksPath() {
    return join(HOME, '.codex', 'hooks.json');
}
export function getCodexConfigPath() {
    return join(HOME, '.codex', 'config.toml');
}
export function getClaudeMarkdownPath() {
    return join(HOME, '.claude', 'CLAUDE.md');
}
export function getCodexAgentsPath() {
    return join(HOME, '.codex', 'AGENTS.md');
}
export function getGramatrSettingsPath() {
    const gramatrDir = getGramatrDirFromEnv() || join(HOME, '.gramatr');
    return join(gramatrDir, 'settings.json');
}
export function readJsonFile(path, fallback) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return fallback;
    }
}
/**
 * Read existing Claude config or return empty.
 */
export function readClaudeConfig(configPath) {
    try {
        const raw = readFileSync(configPath, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
export function upsertManagedBlock(existing, content, startMarker, endMarker) {
    const block = content.trim();
    const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`, 'm');
    if (pattern.test(existing)) {
        return existing.replace(pattern, block);
    }
    const trimmed = existing.trim();
    return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}
export function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function ensureLocalSettings() {
    const settingsPath = getGramatrSettingsPath();
    const settingsDir = dirname(settingsPath);
    const current = existsSync(settingsPath)
        ? readClaudeConfig(settingsPath)
        : {};
    const principalName = process.env.GRAMATR_PRINCIPAL_NAME || current.principal?.name || 'User';
    const principalTimezone = process.env.GRAMATR_PRINCIPAL_TIMEZONE || current.principal?.timezone || 'UTC';
    const next = {
        ...current,
        daidentity: current.daidentity || {
            name: 'gramatr',
            fullName: 'gramatr — Personal AI',
            displayName: 'gramatr',
            color: '#3B82F6',
        },
        principal: {
            ...(current.principal || {}),
            name: principalName,
            timezone: principalTimezone,
        },
    };
    mkdirSync(settingsDir, { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
}
export function emitInstallPromptSuggestion(target) {
    const promptBlock = buildInstallPromptSuggestion(target);
    process.stderr.write('\n━━━ Prompt Suggestion (copy into custom instructions) ━━━\n\n');
    process.stdout.write(promptBlock + '\n');
    process.stderr.write('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.stderr.write('[gramatr-mcp] Paste the prompt block above into your custom instructions / project knowledge.\n');
}
export function setupClaude(dryRun = false) {
    const configPath = getClaudeConfigPath();
    const settingsPath = getClaudeSettingsPath();
    const markdownPath = getClaudeMarkdownPath();
    const config = readClaudeConfig(configPath);
    const settings = readClaudeConfig(settingsPath);
    const currentMarkdown = existsSync(markdownPath) ? readFileSync(markdownPath, 'utf8') : '';
    const localEntry = buildClaudeMcpServerEntry();
    const resolvedArgs = localEntry.args?.[0]?.startsWith('~/')
        ? [localEntry.args[0].replace(/^~\//, `${HOME}/`)]
        : (localEntry.args || []);
    const serverEntry = { command: localEntry.command };
    if (resolvedArgs.length > 0)
        serverEntry.args = resolvedArgs;
    const managedHooks = buildClaudeHooksFile(join(HOME, '.gramatr'));
    const gramatrUrl = getGramatrUrlFromEnv() || 'https://api.gramatr.com/mcp';
    const mergedSettings = {
        ...settings,
        ...mergeManagedHooks(settings, managedHooks),
        env: {
            ...settings.env,
            GRAMATR_DIR: join(HOME, '.gramatr'),
            GRAMATR_URL: gramatrUrl,
            PATH: `${HOME}/.gramatr/bin:/usr/local/bin:/usr/bin:/bin`,
        },
        statusLine: {
            type: 'command',
            command: `npx tsx ${join(HOME, '.gramatr', 'bin', 'statusline.ts')}`,
        },
    };
    const mergedMarkdown = upsertManagedBlock(currentMarkdown, CLAUDE_CODE_GUIDANCE, CLAUDE_BLOCK_START, CLAUDE_BLOCK_END);
    // Check if already configured
    const existing = config.mcpServers?.['gramatr'];
    if (existing) {
        const existingCmd = existing.command;
        const existingArgs = existing.args || [];
        if (existingCmd === serverEntry.command
            && JSON.stringify(existingArgs) === JSON.stringify(serverEntry.args || [])) {
            process.stderr.write('[gramatr-mcp] Claude Code MCP server already configured. Refreshing hooks and guidance.\n');
        }
        else {
            process.stderr.write('[gramatr-mcp] Updating existing gramatr MCP server config.\n');
        }
    }
    // Merge into config
    if (!config.mcpServers) {
        config.mcpServers = {};
    }
    config.mcpServers['gramatr'] = serverEntry;
    if (dryRun) {
        process.stderr.write('[gramatr-mcp] Dry run — would write to: ' + configPath + '\n');
        process.stderr.write(JSON.stringify(config.mcpServers['gramatr'], null, 2) + '\n');
        process.stderr.write('[gramatr-mcp] Dry run — would write Claude hooks to: ' + settingsPath + '\n');
        process.stderr.write(JSON.stringify(mergedSettings.hooks, null, 2) + '\n');
        process.stderr.write('[gramatr-mcp] Dry run — would write Claude guidance to: ' + markdownPath + '\n');
        process.stderr.write(mergedMarkdown + '\n');
        return;
    }
    // Write back
    mkdirSync(join(HOME, '.claude'), { recursive: true });
    ensureLocalSettings();
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2) + '\n', 'utf8');
    writeFileSync(markdownPath, mergedMarkdown, 'utf8');
    process.stderr.write(`[gramatr-mcp] Configured Claude Code MCP server in ${configPath}\n`);
    process.stderr.write(`[gramatr-mcp] Configured Claude hooks in ${settingsPath}\n`);
    process.stderr.write(`[gramatr-mcp] Configured Claude guidance in ${markdownPath}\n`);
    process.stderr.write('[gramatr-mcp] Restart Claude Code to pick up the change.\n');
    // Show what was written
    process.stderr.write('\n  mcpServers.gramatr:\n');
    process.stderr.write(`    command: ${serverEntry.command}\n`);
    if ((serverEntry.args || []).length > 0) {
        process.stderr.write(`    args: ${JSON.stringify(serverEntry.args)}\n`);
    }
    process.stderr.write('\n');
    emitInstallPromptSuggestion('claude-code');
}
export function setupCodex(dryRun = false) {
    const hooksPath = getCodexHooksPath();
    const configPath = getCodexConfigPath();
    const agentsPath = getCodexAgentsPath();
    const hooksConfig = readClaudeConfig(hooksPath);
    const managedHooks = buildCodexHooksFile(join(HOME, '.gramatr'));
    const mergedHooks = mergeManagedHooks(hooksConfig, managedHooks);
    const existingToml = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
    const updatedToml = ensureCodexHooksFeature(existingToml);
    const existingAgents = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : '';
    const updatedAgents = upsertManagedBlock(existingAgents, CODEX_GUIDANCE, CODEX_BLOCK_START, CODEX_BLOCK_END);
    if (dryRun) {
        process.stderr.write('[gramatr-mcp] Dry run — would write to: ' + hooksPath + '\n');
        process.stderr.write(JSON.stringify(mergedHooks, null, 2) + '\n');
        process.stderr.write('[gramatr-mcp] Dry run — would write to: ' + configPath + '\n');
        process.stderr.write(updatedToml);
        process.stderr.write('\n[gramatr-mcp] Dry run — would write to: ' + agentsPath + '\n');
        process.stderr.write(updatedAgents + '\n');
        return;
    }
    mkdirSync(join(HOME, '.codex'), { recursive: true });
    ensureLocalSettings();
    writeFileSync(hooksPath, JSON.stringify(mergedHooks, null, 2) + '\n', 'utf8');
    writeFileSync(configPath, updatedToml, 'utf8');
    writeFileSync(agentsPath, updatedAgents, 'utf8');
    process.stderr.write(`[gramatr-mcp] Configured Codex hooks in ${hooksPath}\n`);
    process.stderr.write(`[gramatr-mcp] Enabled Codex hooks in ${configPath}\n`);
    process.stderr.write(`[gramatr-mcp] Configured Codex guidance in ${agentsPath}\n`);
    process.stderr.write('[gramatr-mcp] Restart Codex or start a new session to pick up the change.\n');
    emitInstallPromptSuggestion('codex');
}
/**
 * Generic MCP-only target setup — merges the gramatr MCP server entry into
 * the target's JSON config file. Used by all platforms that support MCP via
 * a JSON config (Claude Desktop, ChatGPT Desktop, Cursor, Windsurf, VS Code).
 */
export function setupMcpTarget(targetName, configPath, dryRun) {
    const current = readJsonFile(configPath, {});
    const gramatrUrl = getGramatrUrlFromEnv() || 'https://api.gramatr.com/mcp';
    const next = mergeMcpServerConfig(current, buildLocalMcpServerEntry(HOME, gramatrUrl));
    if (dryRun) {
        process.stderr.write(`[gramatr-mcp] Dry run — would write ${targetName} config to: ${configPath}\n`);
        process.stderr.write(JSON.stringify(next, null, 2) + '\n');
        return;
    }
    mkdirSync(dirname(configPath), { recursive: true });
    ensureLocalSettings();
    writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
    process.stderr.write(`[gramatr-mcp] Configured ${targetName} MCP server in ${configPath}\n`);
    process.stderr.write(`[gramatr-mcp] Restart ${targetName} to pick up the change.\n`);
}
export function setupClaudeDesktop(dryRun = false) {
    setupMcpTarget('Claude Desktop', getClaudeDesktopConfigPath(HOME), dryRun);
    if (!dryRun)
        emitInstallPromptSuggestion('claude-desktop');
}
export function setupChatgptDesktop(dryRun = false) {
    setupMcpTarget('ChatGPT Desktop', getChatgptDesktopConfigPath(HOME), dryRun);
    if (!dryRun)
        emitInstallPromptSuggestion('chatgpt-desktop');
}
export function setupCursor(dryRun = false) {
    setupMcpTarget('Cursor', getCursorConfigPath(HOME), dryRun);
    if (!dryRun)
        emitInstallPromptSuggestion('cursor');
}
export function setupWindsurf(dryRun = false) {
    setupMcpTarget('Windsurf', getWindsurfConfigPath(HOME), dryRun);
    if (!dryRun)
        emitInstallPromptSuggestion('windsurf');
}
export function setupVscode(dryRun = false) {
    setupMcpTarget('VS Code', getVscodeConfigPath(HOME), dryRun);
    if (!dryRun)
        emitInstallPromptSuggestion('vscode');
}
export function setupGemini(dryRun = false) {
    const extensionDir = getGeminiExtensionDir(HOME);
    const manifestPath = getGeminiManifestPath(HOME);
    const hooksPath = getGeminiHooksPath(HOME);
    const gramatrUrl = getGramatrUrlFromEnv() || 'https://api.gramatr.com/mcp';
    const manifest = buildGeminiExtensionManifest(HOME, gramatrUrl);
    const hooks = buildGeminiHooksFile(HOME);
    if (dryRun) {
        process.stderr.write('[gramatr-mcp] Dry run — would write Gemini manifest to: ' + manifestPath + '\n');
        process.stderr.write(JSON.stringify(manifest, null, 2) + '\n');
        process.stderr.write('[gramatr-mcp] Dry run — would write Gemini hooks to: ' + hooksPath + '\n');
        process.stderr.write(JSON.stringify(hooks, null, 2) + '\n');
        return;
    }
    mkdirSync(join(extensionDir, 'hooks'), { recursive: true });
    ensureLocalSettings();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n', 'utf8');
    process.stderr.write(`[gramatr-mcp] Configured Gemini extension manifest in ${manifestPath}\n`);
    process.stderr.write(`[gramatr-mcp] Configured Gemini hooks in ${hooksPath}\n`);
    process.stderr.write('[gramatr-mcp] Restart Gemini CLI to pick up the change.\n');
    emitInstallPromptSuggestion('gemini-cli');
}
export async function setupWeb(target = 'claude-web') {
    const gramatrUrl = getGramatrUrlFromEnv() || 'https://api.gramatr.com/mcp';
    // Check reachability first
    process.stderr.write(`[gramatr-mcp] Checking server reachability at ${gramatrUrl}...\n`);
    const reachability = await validateServerReachability(gramatrUrl);
    if (reachability.reachable) {
        process.stderr.write(`[gramatr-mcp] Server is reachable (HTTP ${reachability.statusCode})\n\n`);
    }
    else {
        process.stderr.write(`[gramatr-mcp] Warning: server unreachable — ${reachability.error}\n`);
        process.stderr.write('[gramatr-mcp] Setup instructions generated anyway. Verify connectivity before use.\n\n');
    }
    // Build and display connector instructions
    const instructions = buildConnectorInstructions({ serverUrl: gramatrUrl, target });
    process.stderr.write('━━━ Connector Setup Instructions ━━━\n\n');
    process.stderr.write(`  Target:     ${instructions.target}\n`);
    process.stderr.write(`  Server URL: ${instructions.serverUrl}\n`);
    process.stderr.write(`  Auth:       ${instructions.authMethod}\n`);
    process.stderr.write(`  Server card: ${instructions.serverCardUrl}\n\n`);
    for (let i = 0; i < instructions.steps.length; i++) {
        process.stderr.write(`  ${i + 1}. ${instructions.steps[i]}\n`);
    }
    // Build and display the prompt suggestion
    const promptBlock = buildPromptSuggestion(target);
    process.stderr.write('\n━━━ Prompt Suggestion (copy into custom instructions) ━━━\n\n');
    // Write to stdout so it's easily pipeable/copyable
    process.stdout.write(promptBlock + '\n');
    process.stderr.write('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.stderr.write('[gramatr-mcp] Paste the prompt block above into your custom instructions / project knowledge.\n');
}
//# sourceMappingURL=setup.js.map