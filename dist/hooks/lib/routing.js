import { setLatestClassification } from './hook-state.js';
import { callTool } from '../../proxy/local-client.js';
import { extractToolPayload } from './tool-envelope.js';
import { ROUTING_DEFAULT_TIMEOUT_MS, } from '../generated/hook-timeouts.js';
export const MIN_PROMPT_LENGTH = 10;
export const TRIVIAL_PATTERNS = /^(hi|hey|hello|yo|ok|yes|no|thanks|thank you|sure|yep|nope|k|bye|quit|exit)\b/i;
export function shouldSkipPromptRouting(prompt) {
    const trimmed = prompt.trim();
    return trimmed.length < MIN_PROMPT_LENGTH || TRIVIAL_PATTERNS.test(trimmed);
}
export async function routePrompt(options) {
    const timeoutMs = options.timeoutMs ?? ROUTING_DEFAULT_TIMEOUT_MS;
    const args = {
        prompt: options.prompt,
        ...(options.projectId ? { project_id: options.projectId } : {}),
        ...(options.sessionId ? { session_id: options.sessionId } : {}),
        ...(options.interactionId ? { interaction_id: options.interactionId } : {}),
        ...(options.includeStatusline ? { include_statusline: true } : {}),
        ...(options.statuslineSize ? { statusline_size: options.statuslineSize } : {}),
    };
    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs));
        const raw = await Promise.race([
            callTool('gramatr_route_request', args),
            timeoutPromise,
        ]);
        const route = extractToolPayload(raw);
        if (!route) {
            return { route: null, error: { reason: 'parse_error', detail: 'Empty response from proxy' } };
        }
        return { route, error: null };
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (detail.includes('timeout')) {
            return { route: null, error: { reason: 'timeout', detail } };
        }
        if (detail.includes('401') || detail.toLowerCase().includes('unauthorized')) {
            return { route: null, error: { reason: 'auth', detail } };
        }
        if (detail.includes('ECONNREFUSED') || detail.includes('fetch') || detail.includes('network')) {
            return { route: null, error: { reason: 'network_error', detail } };
        }
        return { route: null, error: { reason: 'http_error', detail } };
    }
}
export function describeRoutingFailure(error) {
    switch (error.reason) {
        case 'auth':
            return {
                title: 'Routing request failed due to authentication.',
                detail: error.detail,
                action: 'Check the configured GRAMATR token for the hook runtime.',
            };
        case 'timeout':
            return {
                title: 'Routing request timed out.',
                detail: error.detail,
                action: 'Check gramatr server latency or increase the hook timeout.',
            };
        case 'network_error':
            return {
                title: 'Routing request could not reach the gramatr MCP endpoint.',
                detail: error.detail,
                action: 'Verify connectivity to the gramatr server (GRAMATR_URL env or ~/.gramatr.json).',
            };
        case 'http_error':
        case 'mcp_error':
        case 'parse_error':
        case 'unknown':
        default:
            return {
                title: 'Routing request failed before intelligence could be injected.',
                detail: error.detail,
                action: 'Inspect the gramatr_route_request handler response. Check GRAMATR_URL and auth token.',
            };
    }
}
export function persistClassificationResult(options) {
    const packet1 = options.route?.packet_1;
    const classification = packet1?.classification || options.route?.classification;
    const executionSummary = packet1?.execution_summary || options.route?.execution_summary;
    const routingSignals = packet1?.routing_signals || options.route?.routing_signals;
    const tokenSavings = packet1?.token_savings || options.route?.token_savings;
    const memoryContext = packet1?.memory_context || options.route?.memory_context;
    setLatestClassification({
        session_id: options.sessionId,
        classifier_model: executionSummary?.classifier_model || null,
        classifier_time_ms: executionSummary?.classifier_time_ms || null,
        tokens_saved: tokenSavings?.total_saved || tokenSavings?.tokens_saved || 0,
        savings_ratio: tokenSavings?.savings_ratio || null,
        effort: classification?.effort_level || null,
        intent: classification?.intent_type || null,
        confidence: classification?.confidence ?? null,
        memory_delivered: memoryContext?.results?.length || null,
        downstream_model: options.downstreamModel || null,
        server_version: executionSummary?.server_version || null,
        stage_timing: executionSummary?.stage_timing
            ? JSON.stringify(executionSummary.stage_timing)
            : null,
        recorded_at: Date.now(),
        original_prompt: options.prompt,
        pending_feedback: true,
        feedback_submitted_at: null,
        client_type: options.clientType,
        agent_name: options.agentName,
        memory_tier: null,
        memory_scope: classification?.memory_scope
            || routingSignals?.memory_scope
            || null,
    });
}
//# sourceMappingURL=routing.js.map