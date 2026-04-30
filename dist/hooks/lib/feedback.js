import { callTool } from '../../proxy/local-client.js';
import { getLatestClassification, markClassificationFeedbackSubmitted } from './hook-state.js';
export async function submitPendingClassificationFeedback(options) {
    const last = getLatestClassification(options.sessionId);
    if (!last?.pending_feedback) {
        return { submitted: false, reason: 'no_pending_feedback' };
    }
    const originalPrompt = (last.original_prompt || '').trim();
    if (!originalPrompt) {
        return { submitted: false, reason: 'missing_original_prompt' };
    }
    try {
        await callTool('classification_feedback', {
            timestamp: new Date(last.recorded_at).toISOString(),
            original_prompt: originalPrompt,
            downstream_model: last.downstream_model || undefined,
            downstream_provider: options.downstreamProvider,
            client_type: options.clientType,
            agent_name: options.agentName,
        });
        markClassificationFeedbackSubmitted(options.sessionId);
        return { submitted: true, reason: 'submitted' };
    }
    catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[gramatr] feedback submission failed: ${detail}\n`);
        return { submitted: false, reason: 'call_tool_error' };
    }
}
//# sourceMappingURL=feedback.js.map