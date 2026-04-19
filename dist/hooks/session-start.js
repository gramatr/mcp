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
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkServerHealth, getGitContext, log, now, readGmtrConfig, readHookInput, writeGmtrConfig, } from './lib/gramatr-hook-utils.js';
import { normalizeSessionStartResponse, persistSessionRegistration, prepareProjectSessionState, resolveLocalProjectUuid, startRemoteSession, } from './lib/session.js';
import { getLastSessionCommits, getProjectSessionCount, setSessionContext, upsertSessionsFromServer, } from './lib/hook-state.js';
import { pushSessionContextToLocal } from '../proxy/local-client.js';
import { syncProjectsFromServer, startPeriodicSync } from './lib/sync-projects.js';
import { VERSION } from './lib/version.js';
import { autoUpgrade, runVersionCheckAndNotify } from './lib/version-check.js';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
import { resolveHookClientRuntime } from './lib/client-runtime.js';
// ── stdout (Claude context injection) ──
// Claude Code captures stdout from SessionStart hooks and injects it as context.
// stderr (via log()) is for terminal display only.
function emitStdout(msg) {
    process.stdout.write(msg + '\n');
}
function emitSessionStartHookOutput(additionalContext) {
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext,
        },
    }));
}
/**
 * Write structured context to stdout so Claude receives it as injected context.
 * This is the critical "last mile" — without this, Claude never sees session continuity data.
 */
function emitSessionContext(opts) {
    const lines = [];
    const compact = opts.config?.last_compact;
    const commits = getLastSessionCommits();
    const totalSessions = getProjectSessionCount(opts.projectId);
    const hasPriorContext = Boolean(opts.handoffContext || compact?.summary || commits || totalSessions > 0);
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
        lines.push('Present this context to the user automatically — they expect seamless session continuity across agents.');
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
    else if (hasPriorContext) {
        lines.push('## Session Startup Decision Required');
        lines.push('');
        lines.push('Ask the user: "Would you like to continue this project session from prior context, or start fresh?" before proceeding.');
        lines.push('If they choose continue, use the continuity context below plus Packet 1 search results.');
        lines.push('If they choose start fresh, acknowledge and ignore prior continuity context for this run.');
        lines.push('');
    }
    // Last compact context from .gramatr/settings.json
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
    // Recent commits from last session (stored in SQLite state DB)
    if (commits) {
        lines.push('## Recent Commits (from last session)');
        lines.push('');
        for (const cl of commits.split('\n').slice(0, 5)) {
            lines.push(`  ${cl}`);
        }
        lines.push('');
    }
    // Session stats — count from SQLite session_log
    if (totalSessions > 0) {
        lines.push(`Session #${totalSessions + 1} on this project.`);
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
    const runtime = resolveHookClientRuntime(_args);
    const codexMode = runtime.clientType === 'codex';
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    let capturedStdout = '';
    if (codexMode) {
        process.stdout.write = ((chunk) => {
            capturedStdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
            return true;
        });
    }
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
        const timestamp = now();
        if (git) {
            // ── Git Repository Path ──
            const prepared = prepareProjectSessionState({ git });
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
            // Pre-resolve project UUID from local caches (project.json + SQLite)
            // so the server can skip the resolution step when UUID is already known.
            const localUuid = resolveLocalProjectUuid({
                directory: git.root,
                projectName: git.projectName,
            });
            if (localUuid) {
                log(`  Pre-resolved project UUID: ${localUuid.slice(0, 8)}...`);
            }
            // Register session with gramatr server
            const sessionStart = await startRemoteSession({
                clientType: runtime.clientType,
                sessionId,
                projectId,
                projectName: git.projectName,
                gitRemote: git.remote,
                gitBranch: git.branch,
                directory: git.root,
                projectUuid: localUuid ?? undefined,
            });
            const sessionResult = normalizeSessionStartResponse(sessionStart);
            config = persistSessionRegistration(git.root, sessionStart, { gitRemote: git.remote }) || config;
            // Upsert recent sessions from server into local SQLite (#720)
            if (sessionResult.recentSessions.length > 0) {
                try {
                    upsertSessionsFromServer(sessionResult.recentSessions);
                }
                catch {
                    // Non-critical — local SQLite may not have synced_at column yet on older installs
                }
            }
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
            emitSessionContext({
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
            const sessionCtx = {
                session_id: sessionId,
                project_id: projectId,
                interaction_id: sessionResult.interactionId ?? null,
                entity_id: sessionResult.entityId ?? null,
                project_name: git.projectName,
                git_root: git.root,
                git_branch: git.branch,
                git_remote: git.remote,
                working_directory: cwd,
                session_start: timestamp,
                updated_at: timestamp,
                client_type: runtime.clientType,
                agent_name: runtime.agentName,
                platform: process.platform,
                arch: process.arch,
            };
            setSessionContext(sessionCtx);
            // Phase IV: also push to local hooks server for cross-hook IPC
            await pushSessionContextToLocal(sessionCtx);
            // Sync projects from server (#997) — always on session-start, then periodic
            try {
                const synced = await syncProjectsFromServer();
                if (synced > 0) {
                    log(`  Synced ${synced} project(s) from server`);
                }
                startPeriodicSync();
            }
            catch {
                // Non-critical — sync is best-effort
            }
            log('  Project context saved to state DB');
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
                    config.metadata = config.metadata || {};
                    config.metadata.updated = timestamp;
                    writeGmtrConfig(cwd, config);
                    if (projectEntityId) {
                        log(`  Project Entity ID: ${projectEntityId} (non-git project)`);
                    }
                    else {
                        log('  Project entity not yet created in gramatr');
                    }
                    const nonGitCtx = {
                        session_id: sessionId,
                        project_id: config.project_id ?? null,
                        interaction_id: null,
                        entity_id: null,
                        project_name: null,
                        git_root: null,
                        git_branch: null,
                        git_remote: null,
                        working_directory: cwd,
                        session_start: timestamp,
                        updated_at: timestamp,
                        client_type: runtime.clientType,
                        agent_name: runtime.agentName,
                        platform: process.platform,
                        arch: process.arch,
                    };
                    setSessionContext(nonGitCtx);
                    await pushSessionContextToLocal(nonGitCtx);
                }
            }
            else {
                log('  No settings.json found - project not initialized');
                const bareCtx = {
                    session_id: sessionId,
                    project_id: cwd,
                    interaction_id: null,
                    entity_id: null,
                    project_name: null,
                    git_root: null,
                    git_branch: null,
                    git_remote: null,
                    working_directory: cwd,
                    session_start: timestamp,
                    updated_at: timestamp,
                    client_type: runtime.clientType,
                    agent_name: runtime.agentName,
                    platform: process.platform,
                    arch: process.arch,
                };
                setSessionContext(bareCtx);
                await pushSessionContextToLocal(bareCtx);
            }
            log('  Project context saved to state DB');
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
        const lastCommits = getLastSessionCommits();
        if (lastCommits) {
            log('');
            log('  Recent commits from last session:');
            for (const line of lastCommits.split('\n').slice(0, 3)) {
                log(`    ${line}`);
            }
        }
        // Opportunistic version check + auto-upgrade.
        // 1. Check npm registry for newer @gramatr/mcp
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
                        `Restart ${runtime.agentName} to activate the new hooks and features."`);
                }
                else {
                    emitStdout(`gramatr update available: v${versionResult.installedVersion} → v${versionResult.latestVersion}. ` +
                        `Auto-upgrade skipped (${upgrade.reason}). Recommend reinstalling the local gramatr client integration for ${runtime.agentName} and restarting the client.`);
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
        if (codexMode) {
            process.stdout.write = originalStdoutWrite;
            emitSessionStartHookOutput(capturedStdout.trim());
        }
        return 0;
    }
    catch (err) {
        // Never crash — fail gracefully
        log(`[gramatr] session-start error: ${String(err)}`);
        if (codexMode) {
            process.stdout.write = originalStdoutWrite;
            emitSessionStartHookOutput(capturedStdout.trim());
        }
        return 0;
    }
}
//# sourceMappingURL=session-start.js.map