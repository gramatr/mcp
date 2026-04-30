/**
 * setup-legacy — Legacy migration: cleanup of pre-rebrand artifacts.
 *
 * Extracted from setup.ts for SRP: all legacy detection, sanitization,
 * managed-block stripping, and clean-install logic.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, lstatSync, readlinkSync, unlinkSync, } from 'node:fs';
import { join, dirname } from 'node:path';
import { getClaudeDesktopConfigPath, getChatgptDesktopConfigPath, getCursorConfigPath, getGeminiHooksPath, getGeminiManifestPath, getVscodeConfigPath, getWindsurfConfigPath, } from '../setup/targets.js';
import { readJsonFile, escapeRegExp, getClaudeConfigPath, getClaudeMarkdownPath, getClaudeSettingsPath, getCodexAgentsPath, getCodexHooksPath, HOME, } from './setup-config-io.js';
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
const LEGACY_MCP_KEY_PATTERNS = [/^aios/i, /^pai$/i, /^pai[-_]/i, /^fabric/i, /^gramatr$/i];
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
    { start: '<!-- gramatr-START -->', end: '<!-- gramatr-END -->' }, // gramatr-allow: legacy marker detection
    { start: '<!-- PAI-START -->', end: '<!-- PAI-END -->' },
    { start: '<!-- FABRIC-START -->', end: '<!-- FABRIC-END -->' },
    { start: '<!-- GMTR-START -->', end: '<!-- GMTR-END -->' },
];
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
    if (command.includes('/gramatr-client/'))
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
export function cleanLegacyClaudeArtifacts(dryRun) {
    process.stderr.write('[gramatr-mcp] clean-install: removing legacy pre-rebrand artifacts\n');
    const legacyDirs = [
        join(HOME, 'gramatr-client'),
        join(HOME, '.claude', 'hooks'),
    ];
    for (const dir of legacyDirs)
        removeDirectoryIfExists(dir, dryRun);
    // Remove stale ~/.gramatr/package.json left by old @gramatr/client installs.
    // Claude Code reads this file to identify the marketplace — if it says @gramatr/client
    // (deprecated), hooks silently fail to load. Setup will rewrite it as @gramatr/mcp.
    removeFileIfExists(join(HOME, '.gramatr', 'package.json'), dryRun);
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
    // Remove all skills and agents — gramatr delivers these via the plugin system,
    // so anything in ~/.claude/skills/ or ~/.claude/agents/ is legacy PAI/Fabric content.
    removeDirectoryIfExists(join(HOME, '.claude', 'skills'), dryRun);
    removeDirectoryIfExists(join(HOME, '.claude', 'agents'), dryRun);
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
                if (target.includes('gramatr-client')
                    || target.includes('/packages/client/bin/gramatr')
                    || target.includes('/fabric/')
                    || target.includes('/pai/')) {
                    stale = true;
                }
            }
            else {
                const body = readFileSync(shimPath, 'utf8');
                if (body.includes('gramatr-client')
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
function cleanLegacyGmtrDir(dryRun) {
    const gmtrDir = join(HOME, '.gmtr');
    if (!existsSync(gmtrDir))
        return;
    process.stderr.write(`[gramatr-mcp] clean-install: removing legacy ~/.gmtr/ directory\n`);
    if (!dryRun) {
        try {
            rmSync(gmtrDir, { recursive: true, force: true });
        }
        catch { /* non-fatal */ }
    }
}
function cleanStaleSocketAndPid() {
    const gramatrDir = join(HOME, '.gramatr');
    const sockPath = join(gramatrDir, 'daemon.sock');
    const pidPath = join(gramatrDir, 'daemon.pid');
    // Only remove sock/pid if the daemon is not actually running
    let daemonAlive = false;
    if (existsSync(pidPath)) {
        try {
            const pid = parseInt(readFileSync(pidPath, 'utf8').trim(), 10);
            if (!Number.isNaN(pid)) {
                try {
                    process.kill(pid, 0);
                    daemonAlive = true;
                }
                catch { /* dead */ }
            }
        }
        catch { /* unreadable */ }
    }
    if (!daemonAlive) {
        try {
            unlinkSync(sockPath);
        }
        catch { /* already gone */ }
        try {
            unlinkSync(pidPath);
        }
        catch { /* already gone */ }
    }
}
export function runCleanInstall(dryRun) {
    process.stderr.write('[gramatr-mcp] clean-install: running global legacy cleanup across known install targets\n');
    cleanAllInstallTargets(dryRun);
    cleanLegacyClaudeArtifacts(dryRun);
    cleanLegacyHomeNodeShims(dryRun);
    cleanLegacyGmtrDir(dryRun);
    if (!dryRun)
        cleanStaleSocketAndPid();
}
//# sourceMappingURL=setup-legacy.js.map