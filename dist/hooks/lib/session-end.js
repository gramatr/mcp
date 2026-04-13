import { callMcpToolDetailed } from './gramatr-hook-utils.js';
export async function flushTurns(options) {
    const result = await callMcpToolDetailed('gramatr_batch_save_turns', {
        session_id: options.sessionId,
        project_id: options.projectId,
        turns: options.turns,
    }, 15000);
    return { ok: result.data !== null, hadError: result.error !== null };
}
export async function endRemoteSession(options) {
    const result = await callMcpToolDetailed('gramatr_session_end', {
        entity_id: options.entityId,
        session_id: options.sessionId,
        interaction_id: options.interactionId,
        project_id: options.projectId,
        summary: options.summary,
        tool_call_count: options.toolCallCount,
    }, 15000);
    return { ok: result.data !== null, hadError: result.error !== null };
}
//# sourceMappingURL=session-end.js.map