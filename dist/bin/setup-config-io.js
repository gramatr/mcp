/**
 * setup-config-io — Config file reading/writing, path resolution, managed block helpers.
 *
 * Extracted from setup.ts for SRP: pure I/O utilities with no setup orchestration.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, } from 'node:fs';
import { join, dirname } from 'node:path';
import { getGramatrDirFromEnv } from '../config-runtime.js';
// gramatr-allow: C1 — CLI entry point, reads HOME for config path
const HOME = process.env.HOME || process.env.USERPROFILE || '';
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
export function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
export function parseJson(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return null;
    }
}
export function readManagedBlock(path, startMarker, endMarker) {
    if (!existsSync(path))
        return null;
    const body = readFileSync(path, 'utf8');
    const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`, 'm');
    const match = body.match(pattern);
    return match ? match[0] : null;
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
export function hasHookCommand(config, eventName, needle) {
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
export { HOME };
//# sourceMappingURL=setup-config-io.js.map