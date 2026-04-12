/**
 * session-start.ts — gramatr SessionStart hook (migrated to @gramatr/mcp).
 *
 * Phase 1 migration of #652: identical behavior to packages/client/hooks/
 * session-start.hook.ts, but packaged as a library function the hook
 * dispatcher can invoke. stdin/stdout contract matches Claude Code's hook
 * protocol exactly — no behavioral changes.
 *
 * TRIGGER: SessionStart
 * OUTPUT: stderr (user display), stdout (Claude context injection)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkServerHealth, getGitContext, log, now, readGmtrConfig, readHookInput, writeGmtrConfig, } from './lib/gramatr-hook-utils.js';
import { buildGitProjectContextPayload, buildNonGitProjectContextPayload, normalizeSessionStartResponse, persistSessionRegistration, prepareProjectSessionState, startRemoteSession, writeCurrentProjectContextFile, } from './lib/session.js';
import { VERSION } from './lib/version.js';
import { autoUpgrade, runVersionCheckAndNotify } from './lib/version-check.js';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
// ── stdout (Claude context injection) ──
// Claude Code captures stdout from SessionStart hooks and injects it as context.
// stderr (via log()) is for terminal display only.
function emitStdout(msg) {
    process.stdout.write(msg + '\n');
}
/**
 * Write structured context to stdout so Claude receives it as injected context.
 * This is the critical "last mile" — without this, Claude never sees session continuity data.
 */
function emitClaudeContext(opts) {
    const lines = [];
    lines.push('grāmatr Session Context (Auto-loaded at Session Start)');
    lines.push('');
    // Project identity
    lines.push(`Project: ${opts.projectName} (${opts.projectId})`);
    lines.push(`Branch: ${opts.branch}`);
    if (opts.interactionId) {
        lines.push(`Interaction: ${opts.interactionId}${opts.resumed ? ' (resumed)' : ' (new)'}`);
    }
    lines.push('');
    // Session continuity — the critical piece
    if (opts.resumed && opts.handoffContext) {
        lines.push('## Previous Session Handoff');
        lines.push('');
        lines.push(opts.handoffContext);
        lines.push('');
        lines.push('Present this context to the user automatically — they expect seamless session continuity.');
        lines.push('Ask the user: "Would you like to continue where we left off, or start fresh?" before proceeding.');
        lines.push('If they want to continue, use the handoff context above. If they want to start fresh, acknowledge and proceed without prior context.');
        lines.push('Query gramatr memory (search_semantic) to enrich this handoff with additional details if needed. For regular prompts, use search_results from Packet 1 instead.');
        lines.push('');
    }
    else if (opts.resumed) {
        // Resumed but no handoff content — fall back to config data
        lines.push('## Session Resumed (no handoff context available)');
        lines.push('');
        lines.push('This session resumed an existing interaction but the previous session did not save handoff context.');
        lines.push('Ask the user: "I found a previous session for this project but no handoff notes. Would you like me to search gramatr memory for recent activity, or start fresh?"');
        lines.push('Query gramatr memory (search_semantic) for recent session activity on this project. For regular prompts, use search_results from Packet 1 instead.');
        lines.push('');
    }
    // Last compact context from .gramatr/settings.json
    const compact = opts.config?.last_compact;
    if (compact?.summary) {
        lines.push('## Last Session Summary (from local cache)');
        lines.push('');
        lines.push(compact.summary);
        lines.push('');
        if (compact.metadata?.files_changed?.length) {
            lines.push('Files modified: ' + compact.metadata.files_changed.join(', '));
        }
        if (compact.metadata?.commits?.length) {
            lines.push('Commits: ' + compact.metadata.commits.join('; '));
        }
        if (compact.metadata?.files_changed?.length || compact.metadata?.commits?.length) {
            lines.push('');
        }
    }
    // Recent commits file
    const home = getHomeDir();
    const lastCommitsFile = join(home, '.claude', 'last-session-commits.txt');
    if (existsSync(lastCommitsFile)) {
        try {
            const commits = readFileSync(lastCommitsFile, 'utf8').trim();
            if (commits) {
                lines.push('## Recent Commits (from last session)');
                lines.push('');
                const commitLines = commits.split('\n').slice(0, 5);
                for (const cl of commitLines) {
                    lines.push(`  ${cl}`);
                }
                lines.push('');
            }
        }
        catch {
            // Silent — non-critical
        }
    }
    // Session stats
    const stats = opts.config?.continuity_stats;
    if (stats?.total_sessions && stats.total_sessions > 1) {
        lines.push(`Session #${stats.total_sessions} on this project.`);
        lines.push('');
    }
    // Only emit if we have meaningful content beyond the header
    if (lines.length > 3) {
        for (const line of lines) {
            emitStdout(line);
        }
    }
}
// ── Banner ──
function displayBanner() {
    const CYAN = '\x1b[1;36m';
    const WHITE = '\x1b[1;37m';
    const DIM = '\x1b[0;90m';
    const RESET = '\x1b[0m';
    log('');
    log(`${CYAN}\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e${RESET}`);
    log(`${CYAN}\u2502${RESET}                                                     ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}     ${CYAN} __ _ ${WHITE} _ __ __ _ _ __ ___   __ _${CYAN}| |_ _ __${RESET}       ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}     ${CYAN}/ _\` |${WHITE}| '__/ _\` | '_ \` _ \\ / _\` |${CYAN}| __| '__|${RESET}     ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}    ${CYAN}| (_| |${WHITE}| | | (_| | | | | | | (_| |${CYAN}| |_| |${RESET}        ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}     ${CYAN} \\__, |${WHITE}|_|  \\__,_|_| |_| |_|\\__,_|${CYAN} \\__|_|${RESET}       ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}     ${CYAN} |___/${RESET}                                          ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}                                                     ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}    ${WHITE}Your cross-agent AI brain${RESET}                        ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}    ${DIM}\u00a9 2026 gr\u0101matr, LLC. All rights reserved.${RESET}        ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2502${RESET}                                                     ${CYAN}\u2502${RESET}`);
    log(`${CYAN}\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f${RESET}`);
    log('');
}
// ── Sync Ratings (background, non-blocking) ──
function syncRatingsInBackground() {
    const syncScript = join(getGramatrDirFromEnv() || join(getHomeDir(), '.gramatr'), 'hooks', 'sync-ratings.hook.ts');
    if (existsSync(syncScript)) {
        try {
            const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
            const child = spawn(npxBin, ['tsx', syncScript], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
        }
        catch {
            // Silent failure — non-critical
        }
    }
}
// ── Entry point ──
/**
 * runSessionStartHook — entry point invoked by the hook dispatcher.
 *
 * Never throws. Any error is logged to stderr and the function returns 0
 * so Claude Code does not block the session on a hook failure.
 */
export async function runSessionStartHook(_args = []) {
    try {
        // Display banner
        displayBanner();
        // Read hook input
        const input = await readHookInput();
        const sessionId = input.session_id || 'unknown';
        const transcriptPath = input.transcript_path || '';
        const cwd = input.cwd || process.cwd();
        // Health check
        log('Checking gramatr server health...');
        const health = await checkServerHealth();
        if (health.healthy) {
            log('gramatr server: HEALTHY');
            log(`  Response: ${health.detail}`);
        }
        else {
            log(`gramatr server: UNHEALTHY (${health.detail})`);
            log('  WARNING: Memory operations may fail');
        }
        // Sync ratings in background
        syncRatingsInBackground();
        // Check git context
        log('');
        log('Checking current directory...');
        const git = getGitContext();
        const home = getHomeDir();
        const timestamp = now();
        if (git) {
            // ── Git Repository Path ──
            const prepared = prepareProjectSessionState({
                git,
                sessionId,
                transcriptPath,
            });
            const projectId = prepared.projectId;
            log('Git repository detected');
            log(`  Project: ${git.projectName}`);
            log(`  Project ID: ${projectId}`);
            log(`  Branch: ${git.branch}`);
            log(`  Commit: ${git.commit}`);
            log(`  Remote: ${git.remote}`);
            // Ensure .gramatr directory exists
            const gmtrDir = join(git.root, '.gramatr');
            if (!existsSync(gmtrDir)) {
                mkdirSync(gmtrDir, { recursive: true });
            }
            let config = prepared.config;
            const projectEntityId = prepared.projectEntityId;
            const restoreNeeded = prepared.restoreNeeded;
            const hasRestoreContext = prepared.hasRestoreContext;
            log(prepared.created
                ? '  Creating new settings.json configuration (v2.1)'
                : '  Found settings.json configuration');
            if (projectEntityId) {
                log(`  Project Entity ID: ${projectEntityId}`);
            }
            else {
                log('  Project entity not yet created in gramatr');
            }
            if (prepared.created) {
                log('  Created settings.json (v2.1)');
            }
            // Register session with gramatr server
            const sessionStart = await startRemoteSession({
                clientType: 'claude_code',
                sessionId,
                projectId,
                projectName: git.projectName,
                gitRemote: git.remote,
                directory: git.root,
            });
            const sessionResult = normalizeSessionStartResponse(sessionStart);
            config = persistSessionRegistration(git.root, sessionStart) || config;
            if (sessionResult.interactionId) {
                log(`  Interaction: ${sessionResult.interactionId}`);
                if (sessionResult.resumed) {
                    log('  Resumed existing interaction');
                }
            }
            else {
                log('  gramatr session registration failed (non-blocking)');
            }
            // ── Emit structured context to stdout for Claude ──
            emitClaudeContext({
                projectName: git.projectName,
                projectId,
                branch: git.branch,
                sessionId,
                interactionId: sessionResult.interactionId,
                resumed: sessionResult.resumed,
                handoffContext: sessionResult.handoffContext,
                projectEntityId,
                config,
            });
            writeCurrentProjectContextFile(buildGitProjectContextPayload({
                git,
                sessionId,
                workingDirectory: cwd,
                sessionStart: timestamp,
                projectId,
                projectEntityId,
                restoreNeeded,
            }));
            log('  Project context saved to ~/.claude/current-project-context.json');
            log('');
            // Display instructions based on initialization status
            const gmtrConfigPath = join(git.root, '.gramatr', 'settings.json');
            if (!projectEntityId) {
                log('gramatr initialization required');
                log('');
                log('Run: `/gmtr-init`');
                log('');
                log('This will:');
                log(`  1. Search gramatr for existing project: ${git.projectName}`);
                log('  2. Create project entity if not found');
                log('  3. Link entity to .gramatr.json');
                log('  4. Enable full memory persistence');
                log('');
            }
            else {
                log('Loading project context from gramatr');
                log('');
                log('Please load project context from gramatr:');
                log('');
                log(`1. Load project summary: \`mcp__gramatr__gramatr_execute_intent({intent: "Show recent activity for project ${git.projectName}", constraints: {entity_types: ["project"], max_results: 1}, detail_level: "summary"})\``);
                log('2. Display brief summary:');
                log('   - Project name and metadata');
                log('   - Last 5-7 observations (recent activity)');
                log('   - Show observation timestamps');
                log(`3. Load related entities from \`${gmtrConfigPath}\`:`);
                log('   - Check .related_entities for linked databases, people, services, concepts');
                log('   - Optionally fetch details for key related entities (use gramatr_execute_intent with detail_level: summary)');
                log('4. Keep summary concise - just enough context to resume work');
                log('   NOTE: Using intelligent tools (gramatr_execute_intent) provides 80-95% token reduction vs direct get_entities calls');
                log('');
            }
            // Display restore context if available
            if (hasRestoreContext && config?.last_compact) {
                log('Context Restored from /gmtr-compact');
                log('');
                const compact = config.last_compact;
                if (compact.summary) {
                    log('Last Session Summary:');
                    log(compact.summary);
                    log('');
                }
                if (compact.metadata?.files_changed?.length) {
                    log('Files Modified:');
                    for (const f of compact.metadata.files_changed) {
                        log(`  \u2022 ${f}`);
                    }
                    log('');
                }
                if (compact.metadata?.commits?.length) {
                    log('Commits:');
                    for (const c of compact.metadata.commits) {
                        log(`  \u2022 ${c}`);
                    }
                    log('');
                }
                const turnCount = compact.turns?.length || 0;
                log(`Loaded from cache: ${turnCount} recent turns`);
                log('Full conversation history in gramatr');
                log('');
            }
            else if (restoreNeeded) {
                log('Full Context Restore Needed');
                log('');
                log('Last session was cleared/compacted.');
                log('');
                log('Run: `/gmtr-restore`');
                log('');
                log('This will restore:');
                log('  \u2022 Last session summary');
                log('  \u2022 Recent activity and decisions');
                log('  \u2022 File changes and commits');
                log('');
            }
        }
        else {
            // ── Non-Git Path ──
            log('  Not a git repository');
            log(`  Working directory: ${cwd}`);
            const gmtrConfigPath = join(cwd, '.gramatr', 'settings.json');
            if (existsSync(gmtrConfigPath)) {
                log('  Found settings.json configuration');
                const config = readGmtrConfig(cwd);
                if (config) {
                    const projectEntityId = config.project_entity_id || null;
                    // Update session stats
                    config.last_session_id = sessionId;
                    config.current_session = {
                        ...config.current_session,
                        session_id: sessionId,
                        transcript_path: transcriptPath,
                        last_updated: timestamp,
                        token_limit: 200000,
                    };
                    config.continuity_stats = config.continuity_stats || {};
                    config.continuity_stats.total_sessions = (config.continuity_stats.total_sessions || 0) + 1;
                    config.metadata = config.metadata || {};
                    config.metadata.updated = timestamp;
                    writeGmtrConfig(cwd, config);
                    if (projectEntityId) {
                        log(`  Project Entity ID: ${projectEntityId} (non-git project)`);
                    }
                    else {
                        log('  Project entity not yet created in gramatr');
                    }
                    writeCurrentProjectContextFile(buildNonGitProjectContextPayload({
                        cwd,
                        sessionId,
                        sessionStart: timestamp,
                        projectEntityId,
                    }));
                }
            }
            else {
                log('  No settings.json found - project not initialized');
                writeCurrentProjectContextFile(buildNonGitProjectContextPayload({
                    cwd,
                    sessionId,
                    sessionStart: timestamp,
                    projectEntityId: null,
                }));
            }
            log('  Project context saved to ~/.claude/current-project-context.json');
            log('');
            log('gramatr initialization available');
            log('');
            log('This directory is not a git repository. You can still use gramatr.');
            log('');
            log('Run: `/gmtr-init`');
            log('');
            log('This will:');
            log('  1. Ask if you want to initialize git for this project');
            log('  2. Help set up git repository (if desired)');
            log('  3. Create gramatr project entity (git or non-git)');
            log('  4. Enable full gramatr memory integration');
            log('');
        }
        // Show recent commits from last session if available
        const lastCommitsFile = join(home, '.claude', 'last-session-commits.txt');
        if (existsSync(lastCommitsFile)) {
            try {
                const commits = readFileSync(lastCommitsFile, 'utf8').trim();
                if (commits) {
                    log('');
                    log('  Recent commits from last session:');
                    const lines = commits.split('\n').slice(0, 3);
                    for (const line of lines) {
                        log(`    ${line}`);
                    }
                }
            }
            catch {
                // Silent failure
            }
        }
        // Opportunistic version check + auto-upgrade.
        // 1. Check npm registry for newer @gramatr/client
        // 2. If outdated, auto-install in background (detached, non-interactive)
        // 3. Inject context so Claude tells the user to restart for new hooks
        try {
            const versionResult = await runVersionCheckAndNotify(VERSION);
            if (versionResult?.isOutdated) {
                const upgrade = autoUpgrade(versionResult.latestVersion);
                if (upgrade.triggered) {
                    log(`  Auto-upgrading gramatr: v${versionResult.installedVersion} → v${versionResult.latestVersion}`);
                    emitStdout(`gramatr auto-upgrade in progress: v${versionResult.installedVersion} → v${versionResult.latestVersion}. ` +
                        `Files are being updated in ~/.gramatr/. Tell the user: "gramatr has auto-upgraded to v${versionResult.latestVersion}. ` +
                        `Exit Claude Code (/exit) and restart with \`claude --resume\` to activate the new hooks and features."`);
                }
                else {
                    emitStdout(`gramatr update available: v${versionResult.installedVersion} → v${versionResult.latestVersion}. ` +
                        `Auto-upgrade skipped (${upgrade.reason}). Recommend the user exit Claude Code (/exit) ` +
                        `then run \`npx @gramatr/client@latest install claude-code\` followed by \`claude --resume\`.`);
                }
            }
        }
        catch {
            // Silent — version check is strictly optional.
        }
        log('');
        log('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
        log('Session initialization complete');
        log('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
        return 0;
    }
    catch (err) {
        // Never crash — fail gracefully
        log(`[gramatr] session-start error: ${String(err)}`);
        return 0;
    }
}
//# sourceMappingURL=session-start.js.map