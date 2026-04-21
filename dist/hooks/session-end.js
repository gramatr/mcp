import { deriveProjectId, getCommitCountSince, getCommitLogSince, getCommitsSince, getFilesChanged, getGitContext, log, now, readGmtrConfig, readHookInput, resolveAuthToken, writeGmtrConfig, } from './lib/gramatr-hook-utils.js';
import { endRemoteSession, flushTurns } from './lib/session-end.js';
import { isLocalHooksServerAvailable } from '../proxy/local-client.js';
import { appendSessionLog, flushOpHistory, flushTurns as flushTurnsDb, getLatestClassification, getSessionContext, hydrateSessionContextFromServer, isFilesystemAvailable, markSessionSynced, } from './lib/hook-state.js';
import { resolveHookClientRuntime } from './lib/client-runtime.js';
import { resolveLocalProjectUuid } from './lib/session.js';
export async function runSessionEndHook(_args = []) {
    const runtime = resolveHookClientRuntime(_args);
    try {
        const input = await readHookInput();
        const sessionId = input.session_id || 'unknown';
        const reason = input.reason || 'other';
        const timestamp = now();
        const git = getGitContext();
        if (!git)
            return 0;
        const config = readGmtrConfig(git.root);
        // In filesystem-locked sandboxes, SQLite can't bridge separate hook processes.
        // Hydrate session context from the server so we have entity_id + interaction_id.
        let sessionCtx = getSessionContext(sessionId);
        if (!sessionCtx && !isFilesystemAvailable()) {
            await hydrateSessionContextFromServer(sessionId);
            sessionCtx = getSessionContext(sessionId);
        }
        // Resolve project UUID: local caches first (SQLite + project.json),
        // then session context (may be server-assigned UUID from SessionStart),
        // then config, then derive text slug as last resort (#938).
        const localUuid = resolveLocalProjectUuid({ directory: git.root, projectName: git.projectName });
        const projectId = localUuid
            || sessionCtx?.project_id
            || config?.project_id
            || deriveProjectId(git.remote, git.projectName);
        const sessionStart = sessionCtx?.session_start || config?.metadata?.updated || '';
        let commitsCount = 0;
        let commitLogText = null;
        if (sessionStart) {
            commitsCount = getCommitCountSince(sessionStart);
            if (commitsCount > 0) {
                commitLogText = getCommitLogSince(sessionStart).join('\n');
            }
        }
        if (config) {
            config.metadata = config.metadata || {};
            config.metadata.updated = timestamp;
            config.metadata.last_session_end_reason = reason;
            config.project_id = projectId;
            writeGmtrConfig(git.root, config);
        }
        if (!isLocalHooksServerAvailable() && !resolveAuthToken())
            return 0;
        let branch = git.branch || 'unknown';
        let commitList = [];
        let modified = [];
        if (commitsCount > 0 && sessionStart) {
            commitList = getCommitsSince(sessionStart, 10);
            modified = getFilesChanged(`HEAD~${Math.min(commitsCount, 20)}`, 'HEAD', 15);
        }
        const sessionEntityId = sessionCtx?.entity_id || '';
        const interactionId = sessionCtx?.interaction_id || '';
        let toolCallCount = 0;
        // Flush turns from SQLite (prompt metadata per turn)
        let turns = [];
        try {
            turns = flushTurnsDb(sessionEntityId || sessionId);
            if (turns.length > 0) {
                await flushTurns({
                    sessionId: sessionEntityId || sessionId,
                    projectId,
                    turns,
                });
            }
        }
        catch {
            log('  Turn flush failed (non-critical)');
        }
        // Collect tool call history for handoff enrichment
        let toolCallHistory = [];
        try {
            toolCallHistory = flushOpHistory(sessionEntityId || sessionId);
            toolCallCount = toolCallHistory.length;
        }
        catch {
            // Non-critical
        }
        // Build a structured handoff the next session can actually use.
        // When the on-device inference endpoint is ready, swap this for a
        // callReasoning() call — the structure stays identical.
        const toolCounts = {};
        for (const call of toolCallHistory) {
            if (call.tool)
                toolCounts[call.tool] = (toolCounts[call.tool] || 0) + 1;
        }
        const topTools = Object.entries(toolCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `${name}(${count})`)
            .join(', ');
        const summaryLines = [
            `## Session Summary`,
            `Project: ${git.projectName} | Branch: ${branch} | Ended: ${reason}`,
            '',
        ];
        if (commitsCount > 0) {
            summaryLines.push(`## Commits (${commitsCount})`);
            for (const c of commitList.slice(0, 8))
                summaryLines.push(`- ${c}`);
            summaryLines.push('');
        }
        if (modified.length > 0) {
            summaryLines.push(`## Files changed`);
            for (const f of modified)
                summaryLines.push(`- ${f}`);
            summaryLines.push('');
        }
        if (toolCallCount > 0) {
            summaryLines.push(`## Activity`);
            summaryLines.push(`- ${toolCallCount} tool calls${topTools ? `: ${topTools}` : ''}`);
            if (turns.length > 0)
                summaryLines.push(`- ${turns.length} turns recorded`);
            summaryLines.push('');
        }
        // Include recent turn prompts for Llama to synthesize when inference is available
        const recentPrompts = turns
            .filter(t => t.prompt && t.prompt.length > 0)
            .slice(-5)
            .map(t => `- [${t.effort_level ?? 'unknown'}] ${(t.prompt ?? '').slice(0, 120)}`);
        if (recentPrompts.length > 0) {
            summaryLines.push(`## Recent prompts`);
            summaryLines.push(...recentPrompts);
            summaryLines.push('');
        }
        const summary = summaryLines.join('\n').trim();
        // Check feedback loop health — warn if classifier feedback was never submitted
        try {
            const lastClassification = getLatestClassification(sessionId);
            if (lastClassification?.pending_feedback) {
                process.stderr.write('[gramatr] WARNING: classification feedback was never submitted this session. The classifier flywheel is not receiving training signal.\n');
            }
        }
        catch {
            // Non-critical
        }
        // Persist session log entry to SQLite (replaces session-history.log + last-session-commits.txt)
        try {
            appendSessionLog({
                session_id: sessionId,
                project_id: projectId,
                ended_at: timestamp,
                reason,
                commit_log: commitLogText,
                interaction_id: interactionId || null,
                entity_id: sessionEntityId || null,
                client_type: runtime.clientType,
                agent_name: runtime.agentName,
                synced_at: null,
            });
        }
        catch {
            // Non-critical
        }
        const endResult = await endRemoteSession({
            entityId: sessionEntityId || sessionId,
            sessionId,
            interactionId,
            projectId,
            summary,
            toolCallCount,
            reason,
            gitBranch: git.branch || '',
            gitRemote: git.remote || '',
            clientType: runtime.clientType,
            agentName: runtime.agentName,
            startedAt: sessionStart || '',
            commitLog: commitLogText,
        });
        if (!endResult.hadError) {
            try {
                markSessionSynced(sessionId);
            }
            catch { /* non-critical */ }
        }
        return 0;
    }
    catch (err) {
        log(`[gramatr] session-end error: ${String(err)}`);
        return 0;
    }
}
//# sourceMappingURL=session-end.js.map