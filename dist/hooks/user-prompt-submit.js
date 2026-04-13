import { getClaudeModelFromEnv, getGramatrTimeoutFromEnv, isGramatrEnrichEnabledFromEnv, } from '../config-runtime.js';
import { deriveProjectId, getGitContext, readHookInput, } from './lib/gramatr-hook-utils.js';
import { emitStatus, formatFailureWarning, formatIntelligence, mergeEnrichmentIntoRoute, } from './lib/intelligence.js';
import { fetchEnrichment, persistClassificationResult, routePrompt, shouldSkipPromptRouting, } from './lib/routing.js';
import { appendOpHistory, appendTurn, getSessionContext, hydrateSessionContextFromServer, isFilesystemAvailable, setLatestClassification, } from './lib/hook-state.js';
let turnCounter = 0;
const TIMEOUT_MS = getGramatrTimeoutFromEnv(30000);
const ENABLED = isGramatrEnrichEnabledFromEnv();
function persistLastClassification(prompt, sessionId, route, downstreamModel) {
    try {
        persistClassificationResult({
            sessionId,
            prompt,
            route,
            downstreamModel,
            clientType: 'claude_code',
            agentName: 'Claude Code',
        });
    }
    catch {
        // Non-critical
    }
}
function mapRoutingFailure(reason, detail) {
    switch (reason) {
        case 'auth':
            return { reason: 'auth', detail };
        case 'timeout':
            return { reason: 'timeout', detail };
        case 'network_error':
            return { reason: 'server_down', detail };
        case 'http_error':
        case 'mcp_error':
            return { reason: 'server_error', detail };
        case 'parse_error':
            return { reason: 'parse_error', detail };
        default:
            return { reason: 'unknown', detail };
    }
}
export async function runUserPromptSubmitHook(_args = []) {
    if (!ENABLED) {
        process.stdout.write(JSON.stringify({}));
        return 0;
    }
    try {
        const input = await readHookInput();
        const prompt = input.prompt || '';
        const sessionId = input.session_id || 'unknown';
        if (!prompt || shouldSkipPromptRouting(prompt)) {
            if (prompt)
                process.stderr.write('[gramatr] enricher: trivial prompt, skipped\n');
            process.stdout.write(JSON.stringify({}));
            return 0;
        }
        const downstreamModel = getClaudeModelFromEnv() ||
            (input.model ?? '') ||
            '';
        const git = getGitContext();
        // In filesystem-locked sandboxes, SQLite can't bridge separate hook processes.
        // Fetch session context from the server so we have project_id + interaction_id.
        let sessionContext = getSessionContext();
        if (!sessionContext && !isFilesystemAvailable()) {
            await hydrateSessionContextFromServer(sessionId);
            sessionContext = getSessionContext();
        }
        const projectId = sessionContext?.project_id || (git ? deriveProjectId(git.remote, git.projectName) : null) || undefined;
        // Pass gramatr interaction_id as session_id so route_request can load
        // conversation history. Fall back to the Claude session_id only if no
        // interaction has been registered yet (e.g. server was down at SessionStart).
        const gramatrSessionId = sessionContext?.interaction_id || sessionId;
        process.stderr.write('[gramatr] classifying...\n');
        const t0 = Date.now();
        const routed = await routePrompt({
            prompt,
            projectId,
            sessionId: gramatrSessionId,
            timeoutMs: TIMEOUT_MS,
        });
        const result = routed.route;
        const elapsed = Date.now() - t0;
        let lastFailure = null;
        if (!result && routed.error) {
            lastFailure = mapRoutingFailure(routed.error.reason, routed.error.detail);
        }
        let enrichment = null;
        const packet1 = result?.packet_1;
        const manifest = packet1?.manifest || result;
        const packetTokenSavings = packet1?.token_savings || result?.token_savings || {};
        if (result && manifest?.packet_2_status === 'required' && manifest?.enrichment_id) {
            enrichment = await fetchEnrichment(manifest.enrichment_id, 5000);
            if (enrichment) {
                mergeEnrichmentIntoRoute(result, enrichment);
            }
        }
        emitStatus(result, elapsed, lastFailure);
        try {
            const ts = packetTokenSavings;
            const es = packet1?.execution_summary || result?.execution_summary || {};
            const cl = packet1?.classification || result?.classification || {};
            const tokensSaved = ts.total_saved || ts.tokens_saved || 0;
            setLatestClassification({
                session_id: gramatrSessionId,
                classifier_model: es.classifier_model || null,
                classifier_time_ms: es.classifier_time_ms || null,
                tokens_saved: tokensSaved,
                savings_ratio: ts.savings_ratio || null,
                effort: cl.effort_level || null,
                intent: cl.intent_type || null,
                confidence: cl.confidence ?? null,
                memory_delivered: (packet1?.memory_context || result?.memory_context)?.results?.length || null,
                downstream_model: downstreamModel || null,
                server_version: es.server_version || null,
                stage_timing: es.stage_timing ? JSON.stringify(es.stage_timing) : null,
                recorded_at: Date.now(),
                original_prompt: prompt.substring(0, 500),
                pending_feedback: true,
                feedback_submitted_at: null,
                client_type: 'claude_code',
                agent_name: 'Claude Code',
                memory_tier: cl.memory_tier || null,
                memory_scope: cl.memory_scope || packet1?.routing_signals?.memory_scope || result?.routing_signals?.memory_scope || null,
            });
            if (tokensSaved > 0) {
                appendOpHistory({
                    session_id: gramatrSessionId,
                    tool: 'classification',
                    time_ms: es.classifier_time_ms || 0,
                    tokens_saved: tokensSaved,
                    timestamp: Date.now(),
                });
            }
        }
        catch {
            // Non-critical
        }
        persistLastClassification(prompt, sessionId, result, downstreamModel);
        try {
            const cl = packet1?.classification || result?.classification || {};
            const es = packet1?.execution_summary || result?.execution_summary || {};
            appendTurn({
                session_id: gramatrSessionId,
                turn_number: turnCounter++,
                timestamp: new Date().toISOString(),
                prompt: prompt.substring(0, 500),
                effort_level: cl.effort_level || null,
                intent_type: cl.intent_type || null,
                confidence: cl.confidence ?? null,
                tokens_saved: packetTokenSavings.total_saved || packetTokenSavings.tokens_saved || null,
            });
        }
        catch {
            // Non-critical
        }
        if (!result || !(packet1?.classification || result.classification)) {
            if (lastFailure) {
                process.stdout.write(JSON.stringify({
                    hookSpecificOutput: {
                        hookEventName: 'UserPromptSubmit',
                        additionalContext: formatFailureWarning(lastFailure),
                    },
                }));
            }
            else {
                process.stdout.write(JSON.stringify({}));
            }
            return 0;
        }
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'UserPromptSubmit',
                additionalContext: formatIntelligence(result, enrichment),
            },
        }));
        return 0;
    }
    catch {
        process.stdout.write(JSON.stringify({}));
        return 0;
    }
}
//# sourceMappingURL=user-prompt-submit.js.map