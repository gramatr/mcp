import { callMcpToolDetailed, resolveMcpUrl, saveLastClassification, } from './gramatr-hook-utils.js';
export const MIN_PROMPT_LENGTH = 10;
export const TRIVIAL_PATTERNS = /^(hi|hey|hello|yo|ok|yes|no|thanks|thank you|sure|yep|nope|k|bye|quit|exit)\b/i;
export function shouldSkipPromptRouting(prompt) {
    const trimmed = prompt.trim();
    return trimmed.length < MIN_PROMPT_LENGTH || TRIVIAL_PATTERNS.test(trimmed);
}
export async function routePrompt(options) {
    const result = await callMcpToolDetailed('gramatr_route_request', {
        prompt: options.prompt,
        ...(options.projectId ? { project_id: options.projectId } : {}),
        ...(options.sessionId ? { session_id: options.sessionId } : {}),
        ...(options.includeStatusline ? { include_statusline: true } : {}),
        ...(options.statuslineSize ? { statusline_size: options.statuslineSize } : {}),
    }, options.timeoutMs ?? 15000);
    return {
        route: result.data,
        error: result.error,
    };
}
export async function fetchEnrichment(enrichmentId, timeoutMs = 2000) {
    try {
        const result = await callMcpToolDetailed('gramatr_get_enrichment', { enrichment_id: enrichmentId, timeout_ms: timeoutMs }, timeoutMs + 1000);
        if (result.data && result.data.status === 'ready') {
            return result.data;
        }
        return null;
    }
    catch {
        return null;
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
                action: `Verify connectivity to ${resolveMcpUrl()}.`,
            };
        case 'http_error':
        case 'mcp_error':
        case 'parse_error':
        case 'unknown':
        default:
            return {
                title: 'Routing request failed before intelligence could be injected.',
                detail: error.detail,
                action: `Inspect the response from ${resolveMcpUrl()} and the gramatr_route_request handler.`,
            };
    }
}
export function persistClassificationResult(options) {
    saveLastClassification(options.rootDir, {
        timestamp: new Date().toISOString(),
        original_prompt: options.prompt,
        effort_level: options.route?.classification?.effort_level || null,
        intent_type: options.route?.classification?.intent_type || null,
        confidence: options.route?.classification?.confidence ?? null,
        memory_tier: options.route?.classification?.memory_tier || null,
        memory_scope: options.route?.classification?.memory_scope
            || options.route?.routing_signals?.memory_scope
            || null,
        classifier_model: options.route?.execution_summary?.classifier_model || null,
        downstream_model: options.downstreamModel || null,
        client_type: options.clientType,
        agent_name: options.agentName,
        pending_feedback: true,
        feedback_submitted_at: null,
    });
}
//# sourceMappingURL=routing.js.map