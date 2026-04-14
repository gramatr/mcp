import { getClaudeModelFromEnv, getGramatrPacket2WaitMsFromEnv, getGramatrPacketModeFromEnv, getGramatrTimeoutFromEnv, isGramatrEnrichEnabledFromEnv, } from '../config-runtime.js';
import { deriveProjectId, getGitContext, readHookInput, } from './lib/gramatr-hook-utils.js';
import { emitStatus, formatFailureWarning, formatIntelligence, mergeEnrichmentIntoRoute, } from './lib/intelligence.js';
import { fetchEnrichment, persistClassificationResult, routePrompt, shouldSkipPromptRouting, } from './lib/routing.js';
import { appendOpHistory, appendTurn, getSessionContext, hydrateSessionContextFromServer, isFilesystemAvailable, setLatestClassification, } from './lib/hook-state.js';
import { resolveHookClientRuntime } from './lib/client-runtime.js';
import { appendPacketDebugLog } from './lib/packet-debug-log.js';
let turnCounter = 0;
const TIMEOUT_MS = getGramatrTimeoutFromEnv(60000);
const ENABLED = isGramatrEnrichEnabledFromEnv();
const PACKET_MODE = getGramatrPacketModeFromEnv();
const PACKET2_WAIT_MS = getGramatrPacket2WaitMsFromEnv(20000);
const HOOK_ROUTE_TIMEOUT_CAP_MS = 60000;
const HOOK_PACKET2_TIMEOUT_CAP_MS = 15000;
const HOOK_PACKET2_WAIT_CAP_MS = 20000;
const HOOK_PACKET2_POLL_MS = 500;
function persistLastClassification(prompt, sessionId, route, downstreamModel, clientType, agentName) {
    try {
        persistClassificationResult({
            sessionId,
            prompt,
            route,
            downstreamModel,
            clientType,
            agentName,
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
    const runtime = resolveHookClientRuntime(_args);
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
        let sessionContext = getSessionContext(sessionId);
        if (!sessionContext && !isFilesystemAvailable()) {
            await hydrateSessionContextFromServer(sessionId);
            sessionContext = getSessionContext(sessionId);
        }
        const projectId = sessionContext?.project_id || (git ? deriveProjectId(git.remote, git.projectName) : null) || undefined;
        // gramatr interaction_id is the cross-agent session key — use it for
        // both session_id (server history) and interaction_id (explicit resolution).
        const gramatrInteractionId = sessionContext?.interaction_id || null;
        const gramatrSessionId = gramatrInteractionId || sessionId;
        process.stderr.write('[gramatr] classifying...\n');
        const t0 = Date.now();
        const routed = await routePrompt({
            prompt,
            projectId,
            sessionId: gramatrSessionId,
            interactionId: gramatrInteractionId || undefined,
            timeoutMs: Math.min(TIMEOUT_MS, HOOK_ROUTE_TIMEOUT_CAP_MS),
        });
        const result = routed.route;
        const elapsed = Date.now() - t0;
        const isV2 = result?.schema === 'gmtr.intelligence.contract.v2';
        let lastFailure = null;
        if (!result && routed.error) {
            lastFailure = mapRoutingFailure(routed.error.reason, routed.error.detail);
        }
        // Debug log — rolling 100-entry JSONL at ~/.gramatr/debug/packets.jsonl
        appendPacketDebugLog({
            ts: new Date().toISOString(),
            project_id: projectId ?? null,
            session_id: gramatrSessionId,
            client_type: runtime.clientType,
            agent_name: runtime.agentName,
            downstream_model: downstreamModel,
            status: !result && routed.error
                ? (routed.error.reason === 'timeout' ? 'timeout' : 'error')
                : result ? 'ok' : 'skipped',
            elapsed_ms: elapsed,
            packet: result ?? null,
            error: routed.error ? { reason: routed.error.reason, detail: routed.error.detail } : null,
        });
        let enrichment = null;
        const packet1 = result?.packet_1;
        // v2: manifest is a top-level field; v1: it's nested under packet_1
        const manifest = isV2 ? result?.manifest : (packet1?.manifest || result);
        // v2: token_savings lives under result.execution; v1: under packet_1 or result directly
        const packetTokenSavings = packet1?.token_savings
            || (isV2 ? result?.execution?.token_savings : result?.token_savings)
            || {};
        const packet2Required = Boolean(
        // v2: enrichment.required is the canonical signal
        result?.enrichment?.required === true
            // v1 fallbacks
            || result?.packet_2?.required === true
            || manifest?.packet_2_status === 'required'
            || manifest?.packet_2_required === true);
        const enrichmentId = result?.enrichment?.enrichment_id
            || result?.packet_2?.enrichment_id
            || manifest?.enrichment_id;
        if (result && packet2Required && enrichmentId) {
            enrichment = await fetchEnrichment(enrichmentId, {
                mode: PACKET_MODE,
                timeoutMs: HOOK_PACKET2_TIMEOUT_CAP_MS,
                waitMs: Math.min(PACKET2_WAIT_MS, HOOK_PACKET2_WAIT_CAP_MS),
                pollMs: HOOK_PACKET2_POLL_MS,
            });
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
                memory_delivered: isV2
                    ? (result?.memory?.search_results?.length ?? null)
                    : ((packet1?.memory_context || result?.memory_context)?.results?.length ?? null),
                downstream_model: downstreamModel || null,
                server_version: es.server_version || null,
                stage_timing: es.stage_timing ? JSON.stringify(es.stage_timing) : null,
                recorded_at: Date.now(),
                original_prompt: prompt.substring(0, 500),
                pending_feedback: true,
                feedback_submitted_at: null,
                client_type: runtime.clientType,
                agent_name: runtime.agentName,
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
        persistLastClassification(prompt, sessionId, result, downstreamModel, runtime.clientType, runtime.agentName);
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