/**
 * setup-platforms — Platform-specific setup functions.
 *
 * Extracted from setup.ts for SRP: each target's setup logic
 * (Codex, Gemini, OpenCode, web connectors, generic MCP targets).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, } from 'node:fs';
import { join, dirname } from 'node:path';
import { getGramatrDirFromEnv, getGramatrUrlFromEnv } from '../config-runtime.js';
import { buildCodexHooksFile, ensureCodexHooksFeature, mergeManagedHooks, } from '../setup/integrations.js';
import { CODEX_BLOCK_END, CODEX_BLOCK_START, CODEX_GUIDANCE, buildInstallPromptSuggestion, } from '../setup/instructions.js';
import { buildGeminiExtensionManifest, buildGeminiHooksFile, buildLocalMcpServerEntry, buildOpenCodeMcpServerEntry, getGeminiExtensionDir, getGeminiHooksPath, getGeminiManifestPath, getOpenCodeConfigPath, mergeMcpServerConfig, } from '../setup/targets.js';
import { buildConnectorInstructions, buildPromptSuggestion, validateServerReachability, } from '../setup/web-connector.js';
import { deployPlatformBinary, resolveBinaryPath } from './setup-shared.js';
import { readJsonFile, readClaudeConfig, escapeRegExp, upsertManagedBlock, ensureLocalSettings, getCodexHooksPath, getCodexConfigPath, getCodexAgentsPath, HOME, } from './setup-config-io.js';
function toTomlString(value) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
function stripTomlSection(content, section) {
    const pattern = new RegExp(`^\\[${escapeRegExp(section)}\\]\\n[\\s\\S]*?(?=^\\[[^\\n]+\\]\\n|\\s*$)`, 'm');
    return content.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}
export function ensureCodexMcpServerConfig(configToml) {
    const gramatrDir = getGramatrDirFromEnv() || join(HOME, '.gramatr');
    const gramatrUrl = getGramatrUrlFromEnv() || 'https://api.gramatr.com/mcp';
    const base = stripTomlSection(stripTomlSection(configToml.trimEnd(), 'mcp_servers.gramatr.env'), 'mcp_servers.gramatr');
    const { command: mcpCommand, args: mcpArgs } = resolveBinaryPath();
    const block = [
        '[mcp_servers.gramatr]',
        `command = ${toTomlString(mcpCommand)}`,
        ...(mcpArgs.length > 0 ? [`args = [${mcpArgs.map(toTomlString).join(', ')}]`] : []),
        '',
        '[mcp_servers.gramatr.env]',
        `GRAMATR_DIR = ${toTomlString(gramatrDir)}`,
        `GRAMATR_URL = ${toTomlString(gramatrUrl)}`,
    ].join('\n');
    return `${base ? `${base}\n\n` : ''}${block}\n`;
}
export function emitInstallPromptSuggestion(target) {
    const promptBlock = buildInstallPromptSuggestion(target);
    process.stderr.write('\n━━━ Prompt Suggestion (copy into custom instructions) ━━━\n\n');
    process.stdout.write(promptBlock + '\n');
    process.stderr.write('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.stderr.write('[gramatr-mcp] Paste the prompt block above into your custom instructions / project knowledge.\n');
}
export function setupCodex(dryRun = false, showPrompts = false) {
    deployPlatformBinary(dryRun);
    const hooksPath = getCodexHooksPath();
    const configPath = getCodexConfigPath();
    const agentsPath = getCodexAgentsPath();
    const hooksConfig = readClaudeConfig(hooksPath);
    const managedHooks = buildCodexHooksFile(join(HOME, '.gramatr'));
    const mergedHooks = mergeManagedHooks(hooksConfig, managedHooks);
    const existingToml = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
    const updatedToml = ensureCodexMcpServerConfig(ensureCodexHooksFeature(existingToml));
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
    process.stderr.write(`[gramatr-mcp] Configured Codex MCP + hooks in ${configPath}\n`);
    process.stderr.write(`[gramatr-mcp] Configured Codex guidance in ${agentsPath}\n`);
    process.stderr.write('[gramatr-mcp] Restart Codex or start a new session to pick up the change.\n');
    if (showPrompts)
        emitInstallPromptSuggestion('codex');
}
/**
 * Generic MCP-only target setup — merges the gramatr MCP server entry into
 * the target's JSON config file. Used by all platforms that support MCP via
 * a JSON config (Claude Desktop, ChatGPT Desktop, Cursor, Windsurf, VS Code).
 */
export function setupMcpTarget(targetName, configPath, dryRun) {
    deployPlatformBinary(dryRun);
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
export function setupGemini(dryRun = false, showPrompts = false) {
    deployPlatformBinary(dryRun);
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
        if (showPrompts)
            emitInstallPromptSuggestion('gemini-cli');
        return;
    }
    mkdirSync(join(extensionDir, 'hooks'), { recursive: true });
    ensureLocalSettings();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n', 'utf8');
    process.stderr.write(`[gramatr-mcp] Configured Gemini extension manifest in ${manifestPath}\n`);
    process.stderr.write(`[gramatr-mcp] Configured Gemini hooks in ${hooksPath}\n`);
    process.stderr.write('[gramatr-mcp] Restart Gemini CLI to pick up the change.\n');
    if (showPrompts)
        emitInstallPromptSuggestion('gemini-cli');
}
export function setupOpenCode(dryRun = false, showPrompts = false) {
    deployPlatformBinary(dryRun);
    const configPath = getOpenCodeConfigPath(HOME);
    const gramatrUrl = getGramatrUrlFromEnv() || 'https://api.gramatr.com/mcp';
    const mcpEntry = buildOpenCodeMcpServerEntry(HOME, gramatrUrl);
    // OpenCode stores its config as JSON with an mcp section (similar to Cursor/VS Code)
    const current = readJsonFile(configPath, {});
    const next = mergeMcpServerConfig(current, mcpEntry);
    if (dryRun) {
        process.stderr.write('[gramatr-mcp] Dry run — would write OpenCode config to: ' + configPath + '\n');
        process.stderr.write(JSON.stringify(next, null, 2) + '\n');
        if (showPrompts)
            emitInstallPromptSuggestion('opencode');
        return;
    }
    mkdirSync(dirname(configPath), { recursive: true });
    ensureLocalSettings();
    writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
    process.stderr.write(`[gramatr-mcp] Configured OpenCode MCP server in ${configPath}\n`);
    process.stderr.write('[gramatr-mcp] Copy the plugin scaffold from packages/mcp/src/setup/examples/gramatr-opencode-plugin.ts\n');
    process.stderr.write('[gramatr-mcp] Restart OpenCode to pick up the change.\n');
    if (showPrompts)
        emitInstallPromptSuggestion('opencode');
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
//# sourceMappingURL=setup-platforms.js.map