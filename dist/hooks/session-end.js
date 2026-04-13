import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { appendLine, deriveProjectId, getCommitCountSince, getCommitLogSince, getCommitsSince, getFilesChanged, getGitContext, log, now, readGmtrConfig, readHookInput, resolveAuthToken, writeGmtrConfig, } from './lib/gramatr-hook-utils.js';
import { endRemoteSession, flushTurns } from './lib/session-end.js';
import { getLastSessionCommitsPath, getSessionHistoryLogPath } from './lib/session.js';
import { getHomeDir } from '../config-runtime.js';
export async function runSessionEndHook(_args = []) {
    try {
        const input = await readHookInput();
        const sessionId = input.session_id || 'unknown';
        const reason = input.reason || 'other';
        const timestamp = now();
        const git = getGitContext();
        if (!git)
            return 0;
        const config = readGmtrConfig(git.root);
        // Prefer stored project_id (may be server-assigned UUID) over re-deriving
        const projectId = config?.project_id || deriveProjectId(git.remote, git.projectName);
        const sessionStart = config?.current_session?.last_updated || config?.metadata?.updated || '';
        let commitsCount = 0;
        const commitsFile = getLastSessionCommitsPath();
        const sessionHistoryLog = getSessionHistoryLogPath();
        mkdirSync(dirname(sessionHistoryLog), { recursive: true });
        if (sessionStart) {
            commitsCount = getCommitCountSince(sessionStart);
            if (commitsCount > 0) {
                if (!existsSync(dirname(commitsFile))) {
                    mkdirSync(dirname(commitsFile), { recursive: true });
                }
                writeFileSync(commitsFile, getCommitLogSince(sessionStart).join('\n') + '\n');
            }
        }
        appendLine(sessionHistoryLog, `Session ended at ${timestamp} (reason: ${reason}, session: ${sessionId})`);
        if (config) {
            config.metadata = config.metadata || {};
            config.metadata.updated = timestamp;
            config.metadata.last_session_end_reason = reason;
            config.project_id = projectId;
            writeGmtrConfig(git.root, config);
        }
        if (!resolveAuthToken())
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
        const sessionEntityId = config?.current_session?.gramatr_entity_id || '';
        const interactionId = config?.current_session?.interaction_id || '';
        const stateDir = join(process.env.GRAMATR_DIR || join(getHomeDir(), '.gramatr'), '.state');
        let toolCallCount = 0;
        // Flush turns (prompt metadata per turn)
        try {
            const turnsFile = join(stateDir, 'turns.jsonl');
            if (existsSync(turnsFile)) {
                const lines = readFileSync(turnsFile, 'utf8').trim().split('\n').filter(Boolean);
                const turns = lines.map((line) => JSON.parse(line));
                if (turns.length > 0) {
                    await flushTurns({
                        sessionId: sessionEntityId || sessionId,
                        projectId,
                        turns,
                    });
                }
                unlinkSync(turnsFile);
            }
        }
        catch {
            log('  Turn flush failed (non-critical)');
        }
        // Collect tool call history for handoff enrichment
        let toolCallHistory = [];
        try {
            const opHistoryFile = join(stateDir, 'op-history.jsonl');
            if (existsSync(opHistoryFile)) {
                const lines = readFileSync(opHistoryFile, 'utf8').trim().split('\n').filter(Boolean);
                toolCallHistory = lines.map((line) => JSON.parse(line));
                toolCallCount = toolCallHistory.length;
                unlinkSync(opHistoryFile);
            }
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
        // Clean up remaining state files
        try {
            for (const f of ['last-op.json', 'stats.json', 'classification-savings.json']) {
                const p = join(stateDir, f);
                if (existsSync(p))
                    unlinkSync(p);
            }
        }
        catch {
            // Non-critical
        }
        await endRemoteSession({
            entityId: sessionEntityId || sessionId,
            sessionId,
            interactionId,
            projectId,
            summary,
            toolCallCount,
        });
        return 0;
    }
    catch (err) {
        log(`[gramatr] session-end error: ${String(err)}`);
        return 0;
    }
}
//# sourceMappingURL=session-end.js.map