import { deriveProjectId, getCommitCountSince, getCommitLogSince, getCommitsSince, getFilesChanged, getGitContext, log, now, readGmtrConfig, readHookInput, resolveAuthToken, writeGmtrConfig, } from './lib/gramatr-hook-utils.js';
import { endRemoteSession, flushTurns } from './lib/session-end.js';
import { isLocalHooksServerAvailable } from '../proxy/local-client.js';
import { appendSessionLog, flushOpHistory, flushTurns as flushTurnsDb, getSessionContext, hydrateSessionContextFromServer, isFilesystemAvailable, markSessionSynced, } from './lib/hook-state.js';
import { resolveHookClientRuntime } from './lib/client-runtime.js';
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
        // Prefer stored project_id (may be server-assigned UUID) over re-deriving
        const projectId = config?.project_id || deriveProjectId(git.remote, git.projectName);
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
        let summary = `Session ended (${reason}). Project: ${git.projectName} (${projectId}). Branch: ${branch}.`;
        if (commitsCount > 0)
            summary += ` Commits: ${commitsCount}. ${commitList.join('; ')}`;
        if (modified.length > 0)
            summary += ` Files: ${modified.join(', ')}`;
        const sessionEntityId = sessionCtx?.entity_id || '';
        const interactionId = sessionCtx?.interaction_id || '';
        let toolCallCount = 0;
        // Flush turns from SQLite (prompt metadata per turn)
        try {
            const turns = flushTurnsDb(sessionEntityId || sessionId);
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
        // Include tool call history in summary so server-side Llama can synthesize a rich handoff
        if (toolCallCount > 0) {
            summary += ` Tool calls: ${toolCallCount}.`;
            // Append top tool names for Llama context
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
            if (topTools)
                summary += ` Top tools: ${topTools}.`;
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