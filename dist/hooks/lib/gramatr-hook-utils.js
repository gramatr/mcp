/**
 * gramatr-hook-utils.ts — Shared utilities for all gramatr hooks
 *
 * Provides common functions: stdin reading, git context, config management,
 * MCP transport, auth token resolution, logging.
 *
 * ZERO external CLI dependencies — uses native TypeScript/Bun APIs only.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, appendFileSync, chmodSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { parseGitRemote } from './git-remote-parser.js';
import { getGramatrTokenFromEnv, getGramatrUrlFromEnv, getGramatrDirFromEnv, getHomeDir, } from '../../config-runtime.js';
import { HOOK_INPUT_READ_TIMEOUT_MS, HEALTH_CHECK_TIMEOUT_MS } from '../generated/hook-timeouts.js';
import { getSessionContext } from './hook-state.js';
// ── Constants ──
const HOME = getHomeDir();
// ── Logging ──
/** Write message to stderr (visible to user in terminal) */
export function log(msg) {
    process.stderr.write(msg + '\n');
}
// ── Timestamps ──
/** ISO timestamp in UTC */
export function now() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
// ── Stdin Reading ──
/** Read and parse JSON from stdin (hook input) */
export async function readHookInput() {
    const chunks = [];
    await new Promise((resolve) => {
        const timeout = setTimeout(() => { process.stdin.destroy(); resolve(); }, HOOK_INPUT_READ_TIMEOUT_MS);
        process.stdin.on('data', (chunk) => chunks.push(chunk));
        process.stdin.on('end', () => { clearTimeout(timeout); resolve(); });
        process.stdin.on('error', () => { clearTimeout(timeout); resolve(); });
        process.stdin.resume();
    });
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw.trim())
        return { session_id: 'unknown' };
    return JSON.parse(raw);
}
// ── Git Context ──
/** Get git context for current directory. Returns null if not in a git repo. */
export function getGitContext() {
    try {
        const isGit = execSync('git rev-parse --is-inside-work-tree', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (isGit !== 'true')
            return null;
        const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        let remote = 'no-remote';
        try {
            remote = execSync('git config --get remote.origin.url', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        }
        catch {
            // no remote configured
        }
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        const projectName = basename(root);
        return { root, remote, branch, commit, projectName };
    }
    catch {
        return null;
    }
}
// ── Project ID ──
/**
 * Derive normalized project_id from git remote URL.
 * Delegates to inlined parseGitRemote (#943, #971).
 * Returns org/repo format, or fallback project name.
 */
export function deriveProjectId(gitRemote, fallbackName) {
    if (!gitRemote || gitRemote === 'no-remote') {
        return fallbackName || 'unknown';
    }
    const parsed = parseGitRemote(gitRemote);
    return parsed || fallbackName || 'unknown';
}
// ── Config Management ──
/** Get the path to .gramatr/settings.json for a given root directory */
export function getConfigPath(rootDir) {
    return join(rootDir, '.gramatr', 'settings.json');
}
/** Read .gramatr/settings.json. Returns null if not found or invalid. */
export function readGmtrConfig(rootDir) {
    try {
        const configPath = getConfigPath(rootDir);
        if (!existsSync(configPath))
            return null;
        const raw = readFileSync(configPath, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/** Write .gramatr/settings.json atomically (write .tmp, then rename) */
export function writeGmtrConfig(rootDir, config) {
    const configPath = getConfigPath(rootDir);
    const tmpPath = configPath + '.tmp';
    const dir = join(rootDir, '.gramatr');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    renameSync(tmpPath, configPath);
    try {
        chmodSync(configPath, 0o600);
    }
    catch { /* non-fatal if fs doesn't support it */ }
}
/** Migrate config from v2.0 to v2.1 if needed */
export function migrateConfig(config, projectId) {
    const version = config.config_version || '0';
    if (version !== '0' && version !== 'null') {
        // Already migrated — just ensure project_id is current
        config.project_id = projectId;
        return config;
    }
    log('  Migrating settings.json to v2.1...');
    // Collect old identifiers
    const oldProjectId = config.project_id || config.project_name || '';
    const oldProjectName = config.project_name || '';
    // Build previously_known_as list
    const knownAs = new Set(config.previously_known_as || []);
    if (oldProjectId && oldProjectId !== projectId) {
        knownAs.add(oldProjectId);
    }
    if (oldProjectName && oldProjectName !== projectId && oldProjectName !== oldProjectId) {
        knownAs.add(oldProjectName);
    }
    config.config_version = '2.1';
    config.project_id = projectId;
    config.previously_known_as = Array.from(knownAs);
    config.migrated_at = now();
    log(`  Done migrating to v2.1 (project_id: ${projectId}, aliases: [${Array.from(knownAs).join(', ')}])`);
    return config;
}
/** Create a fresh v2.1 config */
export function createDefaultConfig(options) {
    const ts = now();
    return {
        version: '2.0',
        config_version: '2.1',
        project_entity_id: null,
        project_id: options.projectId,
        project_name: options.projectName,
        previously_known_as: [],
        git_remote: options.gitRemote,
        last_compact: null,
        related_entities: {
            databases: [],
            people: [],
            services: [],
            concepts: [],
            projects: [],
        },
        metadata: {
            created: ts,
            updated: ts,
            last_session_end_reason: 'new',
        },
    };
}
// ── Auth Token Resolution ──
/**
 * Resolve auth token. gramatr credentials NEVER live in CLI-specific config files.
 *
 * Priority:
 *   1. ~/.gramatr.json (canonical, gramatr-owned, vendor-agnostic)
 *   2. GRAMATR_TOKEN env var (CI, headless override)
 *   3. ~/.gramatr/settings.json auth.api_key (legacy, will be migrated)
 *
 * Token is NEVER stored in ~/.claude.json, ~/.codex/, or ~/.gemini/.
 */
export function resolveAuthToken() {
    // 1. ~/.gramatr.json (canonical source — written by installer, read by all platforms)
    try {
        const configPath = join(HOME, '.gramatr.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (config.token)
            return config.token;
    }
    catch {
        // No config file or parse error
    }
    // 2 & 3. Env vars (GRAMATR_TOKEN canonical, AIOS_MCP_TOKEN legacy alias)
    const envToken = getGramatrTokenFromEnv();
    if (envToken)
        return envToken;
    // 4. Legacy: ~/.gramatr/settings.json (will be migrated to ~/.gramatr.json)
    try {
        const gmtrDir = getGramatrDirFromEnv() || join(HOME, '.gramatr');
        const settingsPath = join(gmtrDir, 'settings.json');
        const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
        if (settings.auth?.api_key && settings.auth.api_key !== 'REPLACE_WITH_YOUR_API_KEY') {
            return settings.auth.api_key;
        }
    }
    catch {
        // Settings file not found or parse error
    }
    return null;
}
/**
 * Resolve the authenticated user's UUID.
 * Priority:
 *   1. SQLite session_context (most recent row) — set by session-start after login
 *   2. ~/.gramatr.json → user_id (canonical — written by login)
 *   3. ~/.gramatr/settings.json → auth.user_id (legacy fallback, removed after migration)
 * Returns null if absent — caller should treat this as "re-auth required."
 */
export function resolveUserId() {
    try {
        const ctx = getSessionContext();
        if (typeof ctx?.user_id === 'string' && ctx.user_id.length > 0)
            return ctx.user_id;
    }
    catch {
        // DB not yet initialized or unavailable
    }
    try {
        const configPath = join(HOME, '.gramatr.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (typeof config.user_id === 'string' && config.user_id.length > 0)
            return config.user_id;
    }
    catch {
        // No config file or parse error
    }
    // Legacy fallback — settings.json will be deleted after migration runs
    try {
        const gramatrDir = getGramatrDirFromEnv() || join(HOME, '.gramatr');
        const settings = JSON.parse(readFileSync(join(gramatrDir, 'settings.json'), 'utf8'));
        if (typeof settings?.auth?.user_id === 'string' && settings.auth.user_id.length > 0)
            return settings.auth.user_id;
    }
    catch {
        // settings.json absent or no auth.user_id
    }
    return null;
}
/**
 * One-time migration: read ~/.gramatr/settings.json, merge token/user_id/server_url
 * into ~/.gramatr.json, then delete settings.json.
 *
 * Safe to call on every startup — exits immediately if settings.json is absent.
 */
export function migrateSettingsJson() {
    const gramatrDir = getGramatrDirFromEnv() || join(HOME, '.gramatr');
    const settingsPath = join(gramatrDir, 'settings.json');
    if (!existsSync(settingsPath))
        return;
    let settings;
    try {
        settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    }
    catch {
        return; // unreadable — leave it alone
    }
    const configPath = join(HOME, '.gramatr.json');
    let config = {};
    try {
        config = JSON.parse(readFileSync(configPath, 'utf8'));
    }
    catch {
        // file absent — start fresh
    }
    let changed = false;
    const token = settings?.auth?.api_key;
    if (token && token !== 'REPLACE_WITH_YOUR_API_KEY' && !config.token) {
        config.token = token;
        changed = true;
    }
    const userId = settings?.auth?.user_id;
    if (userId && !config.user_id) {
        config.user_id = userId;
        changed = true;
    }
    const serverUrl = settings?.auth?.server_url;
    if (serverUrl && !config.server_url) {
        config.server_url = serverUrl;
        changed = true;
    }
    const autoCompact = settings?.auto_compact;
    if (autoCompact && !config.auto_compact) {
        config.auto_compact = autoCompact;
        changed = true;
    }
    if (changed) {
        try {
            writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
        }
        catch {
            return; // can't write — don't delete source
        }
    }
    try {
        unlinkSync(settingsPath);
    }
    catch {
        // non-fatal
    }
}
// ── MCP URL Resolution ──
/**
 * Resolve MCP server URL from config files.
 * Priority: ~/.gramatr.json > ~/.gramatr/settings.json > GRAMATR_URL env > default
 *
 * Intentionally does NOT read ~/.claude.json or ~/.claude/settings.json — gramatr
 * owns its own config files and must not couple to vendor-specific paths.
 */
export function resolveMcpUrl() {
    // 1. ~/.gramatr.json (canonical — written by auth CLI and installer)
    try {
        const configPath = join(HOME, '.gramatr.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (config.server_url)
            return config.server_url;
    }
    catch {
        // No config file or parse error
    }
    // 2. ~/.gramatr/settings.json (legacy auth.server_url — migrating to ~/.gramatr.json)
    try {
        const gmtrDir = getGramatrDirFromEnv() || join(HOME, '.gramatr');
        const settingsPath = join(gmtrDir, 'settings.json');
        const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
        if (settings.auth?.server_url)
            return settings.auth.server_url;
    }
    catch {
        // Settings file not found or parse error
    }
    // 3. Environment variable
    const envUrl = getGramatrUrlFromEnv();
    if (envUrl)
        return envUrl;
    // 4. Default
    return 'https://api.gramatr.com/mcp';
}
// ── Health Check ──
/** Check gramatr server health. Returns true if reachable. */
export async function checkServerHealth(timeoutMs = HEALTH_CHECK_TIMEOUT_MS) {
    const mcpUrl = resolveMcpUrl();
    const baseUrl = mcpUrl.replace(/\/mcp$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${baseUrl}/health`, {
            signal: controller.signal,
        });
        if (response.ok) {
            const body = await response.text();
            return { healthy: true, detail: body };
        }
        else if (response.status === 404 || response.status === 405) {
            return { healthy: true, detail: 'REACHABLE (no /health endpoint)' };
        }
        else {
            return { healthy: false, detail: `HTTP ${response.status}` };
        }
    }
    catch {
        return { healthy: false, detail: `Cannot reach ${baseUrl}` };
    }
    finally {
        clearTimeout(timeout);
    }
}
// ── File I/O Helpers ──
/** Read a JSON file. Returns null on failure. */
export function readJsonFile(filePath) {
    try {
        if (!existsSync(filePath))
            return null;
        return JSON.parse(readFileSync(filePath, 'utf8'));
    }
    catch {
        return null;
    }
}
/** Write JSON file (non-atomic, for temp files). */
export function writeJsonFile(filePath, data) {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
/** Append a line to a file */
export function appendLine(filePath, line) {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    appendFileSync(filePath, line + '\n', 'utf8');
}
// ── Git Helpers ──
/** Get commit count since a given timestamp */
export function getCommitCountSince(since) {
    try {
        const output = execSync(`git log --since="${since}" --oneline`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (!output)
            return 0;
        return output.split('\n').length;
    }
    catch {
        return 0;
    }
}
/** Get formatted commit log since a timestamp */
export function getCommitLogSince(since, maxCount = 5) {
    try {
        const output = execSync(`git log --since="${since}" --pretty=format:"%h - %s (%ar)" -${maxCount}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (!output)
            return [];
        return output.split('\n');
    }
    catch {
        return [];
    }
}
/** Get short commit log (hash + subject) since a timestamp */
export function getCommitsSince(since, maxCount = 5) {
    try {
        const output = execSync(`git log --since="${since}" --pretty=format:"%h %s" -${maxCount}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (!output)
            return [];
        return output.split('\n');
    }
    catch {
        return [];
    }
}
/** Get git status --short output */
export function getGitStatusShort(maxLines = 10) {
    try {
        const output = execSync('git status --short', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (!output)
            return [];
        return output.split('\n').slice(0, maxLines);
    }
    catch {
        return [];
    }
}
/** Get files changed between two refs */
export function getFilesChanged(fromRef, toRef = 'HEAD', maxCount = 10) {
    try {
        const output = execSync(`git diff --name-only ${fromRef}..${toRef}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (!output)
            return [];
        return output.split('\n').slice(0, maxCount);
    }
    catch {
        return [];
    }
}
/** Get recent commit log (formatted for display) */
export function getRecentCommits(count = 3) {
    try {
        const output = execSync(`git log --oneline -${count}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (!output)
            return [];
        return output.split('\n');
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=gramatr-hook-utils.js.map