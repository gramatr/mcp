import { callTool } from '../../proxy/local-client.js';
export async function flushTurns(options) {
    try {
        await callTool('gramatr_batch_save_turns', {
            session_id: options.sessionId,
            project_id: options.projectId,
            turns: options.turns,
        });
        return { ok: true, hadError: false };
    }
    catch {
        return { ok: false, hadError: true };
    }
}
export async function endRemoteSession(options) {
    try {
        await callTool('gramatr_session_end', {
            entity_id: options.entityId,
            session_id: options.sessionId,
            interaction_id: options.interactionId,
            project_id: options.projectId,
            summary: options.summary,
            tool_call_count: options.toolCallCount,
            ...(options.reason !== undefined && { reason: options.reason }),
            ...(options.gitBranch !== undefined && { git_branch: options.gitBranch }),
            ...(options.gitRemote !== undefined && { git_remote: options.gitRemote }),
            ...(options.clientType !== undefined && { client_type: options.clientType }),
            ...(options.agentName !== undefined && { agent_name: options.agentName }),
            ...(options.startedAt !== undefined && { started_at: options.startedAt }),
            ...(options.commitLog !== undefined && { commit_log: options.commitLog }),
        });
        return { ok: true, hadError: false };
    }
    catch {
        return { ok: false, hadError: true };
    }
}
//# sourceMappingURL=session-end.js.map