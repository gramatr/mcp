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
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, lstatSync, readlinkSync, unlinkSync, } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGramatrDirFromEnv, getGramatrUrlFromEnv } from '../config-runtime.js';
import { buildClaudeHooksFile, buildCodexHooksFile, buildClaudeMcpServerEntry, ensureCodexHooksFeature, mergeManagedHooks, } from '../setup/integrations.js';
import { CLAUDE_BLOCK_END, CLAUDE_BLOCK_START, CLAUDE_CODE_GUIDANCE, CODEX_BLOCK_END, CODEX_BLOCK_START, CODEX_GUIDANCE, buildInstallPromptSuggestion, } from '../setup/instructions.js';
import { buildGeminiExtensionManifest, buildGeminiHooksFile, buildLocalMcpServerEntry, getChatgptDesktopConfigPath, getClaudeDesktopConfigPath, getCursorConfigPath, getGeminiExtensionDir, getGeminiHooksPath, getGeminiManifestPath, getVscodeConfigPath, getWindsurfConfigPath, mergeMcpServerConfig, } from '../setup/targets.js';
import { buildConnectorInstructions, buildPromptSuggestion, validateServerReachability, } from '../setup/web-connector.js';
import { installPlatformBinary } from '../setup/platform.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// gramatr-allow: C1 — CLI entry point, reads HOME for config path
const HOME = process.env.HOME || process.env.USERPROFILE || '';
export const AUTO_TARGET_ORDER = [
    'claude',
    'codex',
    'gemini',
    'claude-desktop',
    'chatgpt-desktop',
    'cursor',
    'windsurf',
    'vscode',
];
const LEGACY_HOOK_BASENAMES = [
    'LoadContext.hook.ts',
    'SecurityValidator.hook.ts',
    'RatingCapture.hook.ts',
    'VoiceGate.hook.ts',
    'AutoWorkCreation.hook.ts',
    'WorkCompletionLearning.hook.ts',
    'RelationshipMemory.hook.ts',
    'SessionSummary.hook.ts',
    'UpdateCounts.hook.ts',
    'IntegrityCheck.hook.ts',
];
const LEGACY_MCP_KEY_PATTERNS = [/^aios/i, /^pai$/i, /^pai[-_]/i, /^fabric/i];
const LEGACY_CLAUDE_ARTIFACT_PATTERNS = [
    /^pai[-_]/i,
    /^pai$/i,
    /^fabric[-_]/i,
    /^fabric$/i,
    /^aios[-_]/i,
    /^aios$/i,
    /^extract[-_]?wisdom/i,
    /^pattern[-_]/i,
    /^official[-_]?pattern/i,
    /^becreative$/i,
    /^beexpert$/i,
];
const LEGACY_MANAGED_BLOCK_MARKERS = [
    { start: '<!-- AIOS-START -->', end: '<!-- AIOS-END -->' },
    { start: '<!-- PAI-START -->', end: '<!-- PAI-END -->' },
    { start: '<!-- FABRIC-START -->', end: '<!-- FABRIC-END -->' },
    { start: '<!-- GMTR-START -->', end: '<!-- GMTR-END -->' },
];
/**
 * Resolve the path to the gramatr binary.
 * Prefers the compiled Bun binary at ~/.gramatr/bin/gramatr (self-contained,
 * no Node version dependency). Falls back to npx for first-run / not-yet-installed.
 */
export function resolveBinaryPath() {
    const bunBin = join(HOME, '.gramatr', 'bin', 'gramatr');
    if (existsSync(bunBin)) {
        return { command: bunBin, args: [] };
    }
    // Fallback to npx (first install, before binary is deployed)
    return { command: 'npx', args: ['-y', '@gramatr/mcp'] };
}
/**
 * Deploy the correct platform-specific pre-compiled binary to ~/.gramatr/bin/.
 *
 * Checks for platform-specific binaries (e.g. gramatr-linux-x64) in the package
 * dist/ directory, then falls back to the generic 'gramatr' binary from
 * build-binary.mjs. If neither exists, logs a warning and returns false so the
 * caller can fall back to npx.
 *
 * Uses atomic copy (write to .new, then rename) to avoid partial-binary issues.
 */
export function deployPlatformBinary(dryRun = false) {
    // __dirname is src/bin/ at compile time; dist/ is ../../dist relative to that
    const distDir = resolve(__dirname, '..', '..', 'dist');
    const destDir = join(HOME, '.gramatr', 'bin');
    const result = installPlatformBinary({ distDir, destDir, dryRun });
    switch (result.status) {
        case 'installed':
            process.stderr.write(`[gramatr-mcp] ${result.message}\n`);
            return true;
        case 'fallback':
            process.stderr.write(`[gramatr-mcp] Platform binary not found (${result.message}). Will use npx fallback.\n`);
            return false;
        case 'skipped':
            process.stderr.write(`[gramatr-mcp] Binary install skipped: ${result.message}\n`);
            return false;
        default:
            return false;
    }
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
    const binaryPath = join(gramatrDir, 'bin', 'gramatr');
    const base = stripTomlSection(stripTomlSection(configToml.trimEnd(), 'mcp_servers.gramatr.env'), 'mcp_servers.gramatr');
    const block = [
        '[mcp_servers.gramatr]',
        `command = ${toTomlString(binaryPath)}`,
        '',
        '[mcp_servers.gramatr.env]',
        `GRAMATR_DIR = ${toTomlString(gramatrDir)}`,
        `GRAMATR_URL = ${toTomlString(gramatrUrl)}`,
    ].join('\n');
    return `${base ? `${base}\n\n` : ''}${block}\n`;
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
function matchesLegacyClaudeArtifact(name) {
    const stem = name.replace(/\.md$/i, '');
    return LEGACY_CLAUDE_ARTIFACT_PATTERNS.some((pattern) => pattern.test(stem));
}
function sanitizeLegacyMcpServers(raw) {
    if (!raw.mcpServers || typeof raw.mcpServers !== 'object')
        return raw;
    const servers = raw.mcpServers;
    const next = {};
    for (const [key, value] of Object.entries(servers)) {
        if (LEGACY_MCP_KEY_PATTERNS.some((pattern) => pattern.test(key)))
            continue;
        next[key] = value;
    }
    return { ...raw, mcpServers: next };
}
function stripManagedBlock(content, startMarker, endMarker) {
    const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`, 'gm');
    return content.replace(pattern, '').trimEnd() + '\n';
}
function isLegacyHookCommand(command) {
    if (command.includes('/.claude/hooks/'))
        return true;
    if (command.includes('/aios-v2-client/'))
        return true;
    if (command.includes('/fabric/'))
        return true;
    if (command.includes('/pai/'))
        return true;
    return LEGACY_HOOK_BASENAMES.some((basename) => command.includes(`/${basename}`));
}
function sanitizeHookEventArray(value) {
    if (!Array.isArray(value))
        return value;
    return value
        .map((entry) => {
        if (!entry || typeof entry !== 'object')
            return entry;
        const commands = entry.hooks;
        if (!Array.isArray(commands))
            return entry;
        const filtered = commands.filter((cmd) => {
            const command = typeof cmd?.command === 'string' ? cmd.command : '';
            return !command || !isLegacyHookCommand(command);
        });
        if (filtered.length === 0)
            return null;
        return { ...entry, hooks: filtered };
    })
        .filter(Boolean);
}
function sanitizeHookFile(hookFile) {
    const hooksRoot = hookFile.hooks;
    if (!hooksRoot || typeof hooksRoot !== 'object')
        return hookFile;
    const nextHooks = { ...hooksRoot };
    for (const [eventName, value] of Object.entries(nextHooks)) {
        nextHooks[eventName] = sanitizeHookEventArray(value);
    }
    return { ...hookFile, hooks: nextHooks };
}
function removeDirectoryIfExists(path, dryRun) {
    if (!existsSync(path))
        return;
    if (dryRun) {
        process.stderr.write(`[gramatr-mcp] clean-install dry-run: would remove ${path}\n`);
        return;
    }
    rmSync(path, { recursive: true, force: true });
    process.stderr.write(`[gramatr-mcp] clean-install: removed ${path}\n`);
}
function removeFileIfExists(path, dryRun) {
    if (!existsSync(path))
        return;
    if (dryRun) {
        process.stderr.write(`[gramatr-mcp] clean-install dry-run: would remove ${path}\n`);
        return;
    }
    rmSync(path, { force: true });
    process.stderr.write(`[gramatr-mcp] clean-install: removed ${path}\n`);
}
function cleanLegacyClaudeArtifacts(dryRun) {
    process.stderr.write('[gramatr-mcp] clean-install: removing legacy Claude + PAI/Fabric/AIOS artifacts\n');
    const legacyDirs = [
        join(HOME, 'aios-v2-client'),
        join(HOME, '.claude', 'hooks'),
    ];
    for (const dir of legacyDirs)
        removeDirectoryIfExists(dir, dryRun);
    const commandsDir = join(HOME, '.claude', 'commands');
    if (existsSync(commandsDir)) {
        try {
            for (const entry of readdirSync(commandsDir)) {
                if (!entry.endsWith('.md'))
                    continue;
                if (!matchesLegacyClaudeArtifact(entry))
                    continue;
                removeFileIfExists(join(commandsDir, entry), dryRun);
            }
        }
        catch {
            // non-critical
        }
    }
    const skillsDir = join(HOME, '.claude', 'skills');
    if (existsSync(skillsDir)) {
        try {
            for (const entry of readdirSync(skillsDir)) {
                const path = join(skillsDir, entry);
                if (!statSync(path).isDirectory())
                    continue;
                if (!matchesLegacyClaudeArtifact(entry))
                    continue;
                removeDirectoryIfExists(path, dryRun);
            }
        }
        catch {
            // non-critical
        }
    }
    const clientHooksDir = join(HOME, '.gramatr', 'hooks');
    if (existsSync(clientHooksDir)) {
        for (const basename of LEGACY_HOOK_BASENAMES) {
            removeFileIfExists(join(clientHooksDir, basename), dryRun);
        }
        try {
            for (const entry of readdirSync(clientHooksDir)) {
                if (!entry.endsWith('.sh'))
                    continue;
                removeFileIfExists(join(clientHooksDir, entry), dryRun);
            }
        }
        catch {
            // non-critical
        }
    }
}
function sanitizeLegacyMcpServersInFile(path, dryRun) {
    const current = readJsonFile(path, {});
    const next = sanitizeLegacyMcpServers(current);
    if (JSON.stringify(next) === JSON.stringify(current))
        return;
    if (dryRun) {
        process.stderr.write(`[gramatr-mcp] clean-install dry-run: would sanitize legacy mcpServers in ${path}\n`);
        return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
    process.stderr.write(`[gramatr-mcp] clean-install: sanitized legacy mcpServers in ${path}\n`);
}
function sanitizeHookFileAtPath(path, dryRun, label) {
    const current = readJsonFile(path, {});
    const next = sanitizeHookFile(current);
    if (JSON.stringify(next) === JSON.stringify(current))
        return;
    if (dryRun) {
        process.stderr.write(`[gramatr-mcp] clean-install dry-run: would sanitize legacy hooks in ${path}\n`);
        return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
    process.stderr.write(`[gramatr-mcp] clean-install: sanitized legacy hooks (${label}) in ${path}\n`);
}
function stripLegacyManagedBlocks(path, dryRun) {
    if (!existsSync(path))
        return;
    const current = readFileSync(path, 'utf8');
    let next = current;
    for (const marker of LEGACY_MANAGED_BLOCK_MARKERS) {
        next = stripManagedBlock(next, marker.start, marker.end);
    }
    if (next === current)
        return;
    if (dryRun) {
        process.stderr.write(`[gramatr-mcp] clean-install dry-run: would strip legacy managed blocks in ${path}\n`);
        return;
    }
    writeFileSync(path, next, 'utf8');
    process.stderr.write(`[gramatr-mcp] clean-install: stripped legacy managed blocks in ${path}\n`);
}
function cleanAllInstallTargets(dryRun) {
    sanitizeLegacyMcpServersInFile(getClaudeConfigPath(), dryRun);
    sanitizeLegacyMcpServersInFile(join(HOME, '.claude', 'mcp.json'), dryRun);
    sanitizeLegacyMcpServersInFile(getClaudeDesktopConfigPath(HOME), dryRun);
    sanitizeLegacyMcpServersInFile(getChatgptDesktopConfigPath(HOME), dryRun);
    sanitizeLegacyMcpServersInFile(getCursorConfigPath(HOME), dryRun);
    sanitizeLegacyMcpServersInFile(getWindsurfConfigPath(HOME), dryRun);
    sanitizeLegacyMcpServersInFile(getVscodeConfigPath(HOME), dryRun);
    sanitizeLegacyMcpServersInFile(getGeminiManifestPath(HOME), dryRun);
    sanitizeHookFileAtPath(getClaudeSettingsPath(), dryRun, 'claude');
    sanitizeHookFileAtPath(getCodexHooksPath(), dryRun, 'codex');
    sanitizeHookFileAtPath(getGeminiHooksPath(HOME), dryRun, 'gemini');
    stripLegacyManagedBlocks(getClaudeMarkdownPath(), dryRun);
    stripLegacyManagedBlocks(getCodexAgentsPath(), dryRun);
}
function cleanLegacyHomeNodeShims(dryRun) {
    const candidates = new Set();
    candidates.add(join(HOME, '.local', 'bin', 'gramatr-mcp'));
    candidates.add(join(HOME, '.local', 'bin', 'gramatr'));
    candidates.add(join(HOME, 'bin', 'gramatr-mcp'));
    candidates.add(join(HOME, 'bin', 'gramatr'));
    candidates.add(join(HOME, 'bin', 'gramatr-mac'));
    for (const shimPath of candidates) {
        if (!existsSync(shimPath))
            continue;
        try {
            let stale = false;
            if (lstatSync(shimPath).isSymbolicLink()) {
                const target = readlinkSync(shimPath);
                if (target.includes('aios-v2-client')
                    || target.includes('/packages/client/bin/gramatr')
                    || target.includes('/fabric/')
                    || target.includes('/pai/')) {
                    stale = true;
                }
            }
            else {
                const body = readFileSync(shimPath, 'utf8');
                if (body.includes('aios-v2-client')
                    || body.includes('/packages/client/bin/gramatr')
                    || body.includes('/fabric/')
                    || body.includes('/pai/')) {
                    stale = true;
                }
            }
            if (!stale)
                continue;
            if (dryRun) {
                process.stderr.write(`[gramatr-mcp] clean-install dry-run: would remove stale shim ${shimPath}\n`);
            }
            else {
                unlinkSync(shimPath);
                process.stderr.write(`[gramatr-mcp] clean-install: removed stale shim ${shimPath}\n`);
            }
        }
        catch {
            // non-critical
        }
    }
}
export function runCleanInstall(dryRun) {
    process.stderr.write('[gramatr-mcp] clean-install: running global legacy cleanup across known install targets\n');
    cleanAllInstallTargets(dryRun);
    cleanLegacyClaudeArtifacts(dryRun);
    cleanLegacyHomeNodeShims(dryRun);
}
export function emitInstallPromptSuggestion(target) {
    const promptBlock = buildInstallPromptSuggestion(target);
    process.stderr.write('\n━━━ Prompt Suggestion (copy into custom instructions) ━━━\n\n');
    process.stdout.write(promptBlock + '\n');
    process.stderr.write('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.stderr.write('[gramatr-mcp] Paste the prompt block above into your custom instructions / project knowledge.\n');
}
export function setupClaude(dryRun = false, cleanInstall = false, showPrompts = false) {
    if (cleanInstall) {
        runCleanInstall(dryRun);
    }
    deployPlatformBinary(dryRun);
    const configPath = getClaudeConfigPath();
    const settingsPath = getClaudeSettingsPath();
    const markdownPath = getClaudeMarkdownPath();
    const config = readClaudeConfig(configPath);
    const settings = readClaudeConfig(settingsPath);
    const currentMarkdown = existsSync(markdownPath) ? readFileSync(markdownPath, 'utf8') : '';
    const localEntry = buildClaudeMcpServerEntry();
    const resolvedCommand = localEntry.command.startsWith('~/')
        ? localEntry.command.replace(/^~\//, `${HOME}/`)
        : localEntry.command;
    const resolvedArgs = (localEntry.args || []).map(a => a.startsWith('~/') ? a.replace(/^~\//, `${HOME}/`) : a);
    const serverEntry = { command: resolvedCommand };
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
        if (showPrompts)
            emitInstallPromptSuggestion('claude-code');
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
    if (showPrompts)
        emitInstallPromptSuggestion('claude-code');
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
export function setupClaudeDesktop(dryRun = false, showPrompts = false) {
    setupMcpTarget('Claude Desktop', getClaudeDesktopConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion('claude-desktop');
}
export function setupChatgptDesktop(dryRun = false, showPrompts = false) {
    setupMcpTarget('ChatGPT Desktop', getChatgptDesktopConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion('chatgpt-desktop');
}
export function setupCursor(dryRun = false, showPrompts = false) {
    setupMcpTarget('Cursor', getCursorConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion('cursor');
}
export function setupWindsurf(dryRun = false, showPrompts = false) {
    setupMcpTarget('Windsurf', getWindsurfConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion('windsurf');
}
export function setupVscode(dryRun = false, showPrompts = false) {
    setupMcpTarget('VS Code', getVscodeConfigPath(HOME), dryRun);
    if (showPrompts)
        emitInstallPromptSuggestion('vscode');
}
export function getAutoDetectedTargets() {
    const checks = {
        claude: existsSync(join(HOME, '.claude')) || existsSync(getClaudeConfigPath()),
        codex: existsSync(join(HOME, '.codex')),
        gemini: existsSync(join(HOME, '.gemini')),
        'claude-desktop': existsSync(dirname(getClaudeDesktopConfigPath(HOME))),
        'chatgpt-desktop': existsSync(dirname(getChatgptDesktopConfigPath(HOME))),
        cursor: existsSync(join(HOME, '.cursor')),
        windsurf: existsSync(join(HOME, '.windsurf')),
        vscode: existsSync(join(HOME, '.vscode')),
    };
    return AUTO_TARGET_ORDER.filter((target) => checks[target]);
}
export function setupAutoInstall(options = {}) {
    const dryRun = options.dryRun === true;
    const cleanInstall = options.cleanInstall === true;
    const listOnly = options.listOnly === true;
    const showPrompts = options.showPrompts === true;
    const detected = getAutoDetectedTargets();
    const requested = Array.isArray(options.selectedTargets) && options.selectedTargets.length > 0
        ? Array.from(new Set(options.selectedTargets))
        : null;
    const selected = requested ?? detected;
    process.stderr.write('[gramatr-mcp] auto-detect scan complete\n');
    if (detected.length === 0 && !requested) {
        process.stderr.write('[gramatr-mcp] No supported local clients detected.\n');
        process.stderr.write('[gramatr-mcp] Install manually with: setup <target>\n');
        return 0;
    }
    process.stderr.write(`[gramatr-mcp] Detected targets: ${detected.join(', ')}\n`);
    process.stderr.write(`[gramatr-mcp] Selected targets: ${selected.join(', ')}\n`);
    if (requested) {
        const undetected = requested.filter((target) => !detected.includes(target));
        if (undetected.length > 0) {
            process.stderr.write(`[gramatr-mcp] Requested targets not detected locally (will still configure): ${undetected.join(', ')}\n`);
        }
    }
    if (listOnly) {
        process.stderr.write('[gramatr-mcp] list-only mode: no setup changes made.\n');
        return selected.length;
    }
    if (cleanInstall) {
        runCleanInstall(dryRun);
    }
    for (const target of selected) {
        switch (target) {
            case 'claude':
                setupClaude(dryRun, false, showPrompts);
                break;
            case 'codex':
                setupCodex(dryRun, showPrompts);
                break;
            case 'gemini':
                setupGemini(dryRun, showPrompts);
                break;
            case 'claude-desktop':
                setupClaudeDesktop(dryRun, showPrompts);
                break;
            case 'chatgpt-desktop':
                setupChatgptDesktop(dryRun, showPrompts);
                break;
            case 'cursor':
                setupCursor(dryRun, showPrompts);
                break;
            case 'windsurf':
                setupWindsurf(dryRun, showPrompts);
                break;
            case 'vscode':
                setupVscode(dryRun, showPrompts);
                break;
            default:
                break;
        }
    }
    process.stderr.write(`[gramatr-mcp] Auto setup completed for ${selected.length} target(s).\n`);
    return selected.length;
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
function addResult(items, severity, label, detail) {
    items.push({ severity, label, detail });
}
function parseJson(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return null;
    }
}
function hasHookCommand(config, eventName, needle) {
    if (!config || typeof config !== 'object')
        return false;
    const hooksRoot = config.hooks;
    if (!hooksRoot || typeof hooksRoot !== 'object')
        return false;
    const entries = hooksRoot[eventName];
    if (!Array.isArray(entries))
        return false;
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object')
            continue;
        const commands = entry.hooks;
        if (!Array.isArray(commands))
            continue;
        for (const command of commands) {
            const value = command?.command;
            if (typeof value === 'string' && value.includes(needle)) {
                return true;
            }
        }
    }
    return false;
}
function readManagedBlock(path, startMarker, endMarker) {
    if (!existsSync(path))
        return null;
    const body = readFileSync(path, 'utf8');
    const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`, 'm');
    const match = body.match(pattern);
    return match ? match[0] : null;
}
function verifyClaude(items) {
    const configPath = getClaudeConfigPath();
    const settingsPath = getClaudeSettingsPath();
    const markdownPath = getClaudeMarkdownPath();
    const config = parseJson(configPath);
    const gramatrServer = config?.mcpServers && typeof config.mcpServers === 'object'
        ? config.mcpServers.gramatr
        : null;
    if (gramatrServer) {
        addResult(items, 'ok', 'claude.mcp_server', `${configPath} contains mcpServers.gramatr`);
    }
    else {
        addResult(items, 'error', 'claude.mcp_server', `${configPath} missing mcpServers.gramatr`);
    }
    const settings = parseJson(settingsPath);
    const hasPromptHook = hasHookCommand(settings, 'UserPromptSubmit', 'hook user-prompt-submit');
    const hasSessionStartHook = hasHookCommand(settings, 'SessionStart', 'hook session-start');
    if (hasPromptHook && hasSessionStartHook) {
        addResult(items, 'ok', 'claude.hooks', `${settingsPath} includes session-start + user-prompt-submit`);
    }
    else {
        addResult(items, 'error', 'claude.hooks', `${settingsPath} missing required hooks (session-start=${hasSessionStartHook}, user-prompt-submit=${hasPromptHook})`);
    }
    const managedBlock = readManagedBlock(markdownPath, CLAUDE_BLOCK_START, CLAUDE_BLOCK_END);
    if (managedBlock) {
        addResult(items, 'ok', 'claude.guidance', `${markdownPath} contains managed gramatr guidance block`);
    }
    else {
        addResult(items, 'warn', 'claude.guidance', `${markdownPath} missing managed guidance block`);
    }
}
function verifyCodex(items) {
    const hooksPath = getCodexHooksPath();
    const configPath = getCodexConfigPath();
    const agentsPath = getCodexAgentsPath();
    const hooks = parseJson(hooksPath);
    const hasPromptHook = hasHookCommand(hooks, 'UserPromptSubmit', 'hook user-prompt-submit');
    const hasSessionStartHook = hasHookCommand(hooks, 'SessionStart', 'hook session-start');
    const hasStopHook = hasHookCommand(hooks, 'Stop', 'hook stop');
    if (hasPromptHook && hasSessionStartHook && hasStopHook) {
        addResult(items, 'ok', 'codex.hooks', `${hooksPath} includes session-start + user-prompt-submit + stop`);
    }
    else {
        addResult(items, 'error', 'codex.hooks', `${hooksPath} missing required hooks (session-start=${hasSessionStartHook}, user-prompt-submit=${hasPromptHook}, stop=${hasStopHook})`);
    }
    const configToml = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
    const hooksEnabled = /^\s*codex_hooks\s*=\s*true\s*$/m.test(configToml);
    if (hooksEnabled) {
        addResult(items, 'ok', 'codex.feature_flag', `${configPath} enables codex_hooks`);
    }
    else {
        addResult(items, 'error', 'codex.feature_flag', `${configPath} missing codex_hooks = true`);
    }
    const hasMcpServer = /^\[mcp_servers\.gramatr\]\s*$/m.test(configToml)
        && /^\s*command\s*=\s*.+$/m.test(configToml);
    if (hasMcpServer) {
        addResult(items, 'ok', 'codex.mcp_server', `${configPath} contains mcp_servers.gramatr`);
    }
    else {
        addResult(items, 'error', 'codex.mcp_server', `${configPath} missing mcp_servers.gramatr`);
    }
    const managedBlock = readManagedBlock(agentsPath, CODEX_BLOCK_START, CODEX_BLOCK_END);
    if (managedBlock) {
        addResult(items, 'ok', 'codex.guidance', `${agentsPath} contains managed gramatr guidance block`);
    }
    else {
        addResult(items, 'warn', 'codex.guidance', `${agentsPath} missing managed guidance block`);
    }
}
function verifyJsonMcpTarget(items, label, configPath) {
    const json = parseJson(configPath);
    const gramatrServer = json?.mcpServers && typeof json.mcpServers === 'object'
        ? json.mcpServers.gramatr
        : null;
    if (gramatrServer) {
        addResult(items, 'ok', `${label}.mcp_server`, `${configPath} contains mcpServers.gramatr`);
    }
    else {
        addResult(items, 'warn', `${label}.mcp_server`, `${configPath} missing mcpServers.gramatr`);
    }
}
function verifyGemini(items) {
    const manifestPath = getGeminiManifestPath(HOME);
    const hooksPath = getGeminiHooksPath(HOME);
    const manifest = parseJson(manifestPath);
    const geminiServer = manifest?.mcpServers && typeof manifest.mcpServers === 'object'
        ? manifest.mcpServers.gramatr
        : null;
    if (geminiServer) {
        addResult(items, 'ok', 'gemini.manifest', `${manifestPath} contains mcpServers.gramatr`);
    }
    else {
        addResult(items, 'warn', 'gemini.manifest', `${manifestPath} missing mcpServers.gramatr`);
    }
    const hooks = parseJson(hooksPath);
    const hasBeforeAgent = hasHookCommand(hooks, 'BeforeAgent', 'hook user-prompt-submit');
    const hasSessionStart = hasHookCommand(hooks, 'SessionStart', 'hook session-start');
    if (hasBeforeAgent && hasSessionStart) {
        addResult(items, 'ok', 'gemini.hooks', `${hooksPath} includes BeforeAgent + SessionStart hooks`);
    }
    else {
        addResult(items, 'warn', 'gemini.hooks', `${hooksPath} missing expected hooks (before-agent=${hasBeforeAgent}, session-start=${hasSessionStart})`);
    }
}
function verifyLocalSettings(items) {
    const settingsPath = getGramatrSettingsPath();
    const settings = parseJson(settingsPath);
    if (!settings) {
        addResult(items, 'error', 'runtime.settings', `${settingsPath} is missing or invalid JSON`);
        return;
    }
    const hasPrincipal = Boolean(settings.principal?.name);
    const hasIdentity = Boolean(settings.daidentity?.name);
    if (hasPrincipal && hasIdentity) {
        addResult(items, 'ok', 'runtime.settings', `${settingsPath} initialized with principal + daidentity`);
    }
    else {
        addResult(items, 'warn', 'runtime.settings', `${settingsPath} missing expected fields (principal=${hasPrincipal}, daidentity=${hasIdentity})`);
    }
}
function printPromptBlocks(target) {
    if (target === 'all' || target === 'claude') {
        const block = readManagedBlock(getClaudeMarkdownPath(), CLAUDE_BLOCK_START, CLAUDE_BLOCK_END);
        process.stderr.write('\n━━━ Claude Managed Guidance Block ━━━\n\n');
        process.stdout.write((block || '[missing managed block]\n') + '\n');
    }
    if (target === 'all' || target === 'codex') {
        const block = readManagedBlock(getCodexAgentsPath(), CODEX_BLOCK_START, CODEX_BLOCK_END);
        process.stderr.write('\n━━━ Codex Managed Guidance Block ━━━\n\n');
        process.stdout.write((block || '[missing managed block]\n') + '\n');
    }
}
export function verifySetupInstall(target = 'all', options = {}) {
    const items = [];
    verifyLocalSettings(items);
    if (target === 'all' || target === 'claude')
        verifyClaude(items);
    if (target === 'all' || target === 'codex')
        verifyCodex(items);
    if (target === 'all' || target === 'claude-desktop') {
        verifyJsonMcpTarget(items, 'claude-desktop', getClaudeDesktopConfigPath(HOME));
    }
    if (target === 'all' || target === 'chatgpt-desktop') {
        verifyJsonMcpTarget(items, 'chatgpt-desktop', getChatgptDesktopConfigPath(HOME));
    }
    if (target === 'all' || target === 'cursor') {
        verifyJsonMcpTarget(items, 'cursor', getCursorConfigPath(HOME));
    }
    if (target === 'all' || target === 'windsurf') {
        verifyJsonMcpTarget(items, 'windsurf', getWindsurfConfigPath(HOME));
    }
    if (target === 'all' || target === 'vscode') {
        verifyJsonMcpTarget(items, 'vscode', getVscodeConfigPath(HOME));
    }
    if (target === 'all' || target === 'gemini')
        verifyGemini(items);
    const hasError = items.some((item) => item.severity === 'error');
    const hasWarn = items.some((item) => item.severity === 'warn');
    if (options.json) {
        process.stdout.write(JSON.stringify({
            ok: !hasError,
            warnings: hasWarn,
            target,
            checks: items,
        }, null, 2) + '\n');
    }
    else {
        process.stderr.write(`\n[gramatr-mcp] Setup verification target=${target}\n`);
        for (const item of items) {
            const marker = item.severity === 'ok' ? 'OK' : item.severity === 'warn' ? 'WARN' : 'ERROR';
            process.stderr.write(`  [${marker}] ${item.label}: ${item.detail}\n`);
        }
    }
    if (options.showPrompts) {
        printPromptBlocks(target);
    }
    if (hasError) {
        process.stderr.write('[gramatr-mcp] Verification failed. Re-run setup for the failing target(s).\n');
        return 1;
    }
    if (hasWarn) {
        process.stderr.write('[gramatr-mcp] Verification completed with warnings.\n');
    }
    else {
        process.stderr.write('[gramatr-mcp] Verification passed.\n');
    }
    return 0;
}
//# sourceMappingURL=setup.js.map