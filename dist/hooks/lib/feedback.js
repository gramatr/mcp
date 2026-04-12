import { callMcpToolDetailed, markClassificationFeedbackSubmitted, readGmtrConfig, } from './gramatr-hook-utils.js';
export async function submitPendingClassificationFeedback(options) {
    const config = readGmtrConfig(options.rootDir);
    const last = config?.current_session?.last_classification;
    if (!last?.pending_feedback) {
        return { submitted: false, reason: 'no_pending_feedback' };
    }
    const originalPrompt = (options.originalPrompt || last.original_prompt || '').trim();
    if (!originalPrompt) {
        return { submitted: false, reason: 'missing_original_prompt' };
    }
    if (config?.current_session?.session_id && config.current_session.session_id !== options.sessionId) {
        return { submitted: false, reason: 'session_mismatch' };
    }
    const result = await callMcpToolDetailed('gramatr_classification_feedback', {
        timestamp: last.timestamp,
        was_correct: true,
        original_prompt: originalPrompt,
        downstream_model: last.downstream_model || undefined,
        downstream_provider: options.downstreamProvider,
        client_type: options.clientType,
        agent_name: options.agentName,
    }, 10000);
    if (result.data) {
        markClassificationFeedbackSubmitted(options.rootDir);
        return { submitted: true, reason: 'submitted' };
    }
    return { submitted: false, reason: result.error?.reason || 'unknown_error' };
}
//# sourceMappingURL=feedback.js.map