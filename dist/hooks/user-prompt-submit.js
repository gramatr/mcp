import { getClaudeModelFromEnv, getCompactConfig, getGramatrTimeoutFromEnv, isGramatrEnrichEnabledFromEnv, } from "../config-runtime.js";
import { HOOK_ROUTE_TIMEOUT_CAP_MS, HOOK_ROUTE_TIMEOUT_DEFAULT_MS, } from "./generated/hook-timeouts.js";
import { resolveHookClientRuntime } from "./lib/client-runtime.js";
import { writeCompact } from "./lib/compact-writer.js";
import { deriveProjectId, getGitContext, readHookInput, resolveUserId, } from "./lib/gramatr-hook-utils.js";
import { appendOpHistory, appendTurn, enqueueOutboxMutation, getAllTimeTokensSaved, getCachedDirective, getSessionContext, getSessionTurnCount, hydrateSessionContextFromServer, isFilesystemAvailable, savePacket, setCachedDirective, setLatestClassification, } from "./lib/hook-state.js";
import { emitStatus, formatFailureWarning, formatIntelligence, } from "./lib/intelligence.js";
import { appendPacketDebugLog } from "./lib/packet-debug-log.js";
import { persistClassificationResult, routePrompt, shouldSkipPromptRouting, } from "./lib/routing.js";
import { resolveLocalProjectUuid } from "./lib/session.js";
let turnCounter = 0;
const TIMEOUT_MS = getGramatrTimeoutFromEnv(HOOK_ROUTE_TIMEOUT_DEFAULT_MS);
const ENABLED = isGramatrEnrichEnabledFromEnv();
const COMPACT_CFG = getCompactConfig();
const COMPACT_TURN_THRESHOLD = COMPACT_CFG.every_turns;
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
        case "auth":
            return { reason: "auth", detail };
        case "timeout":
            return { reason: "timeout", detail };
        case "network_error":
            return { reason: "server_down", detail };
        case "http_error":
        case "mcp_error":
            return { reason: "server_error", detail };
        case "parse_error":
            return { reason: "parse_error", detail };
        default:
            return { reason: "unknown", detail };
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
        const prompt = input.prompt || "";
        const sessionId = input.session_id || "unknown";
        if (!prompt || shouldSkipPromptRouting(prompt)) {
            if (prompt)
                process.stderr.write("[gramatr] enricher: trivial prompt, skipped\n");
            process.stdout.write(JSON.stringify({}));
            return 0;
        }
        // If user_id is missing, degrade silently — session-start already surfaced
        // the re-auth notice once when the session opened.
        if (!resolveUserId()) {
            process.stdout.write(JSON.stringify({}));
            return 0;
        }
        const downstreamModel = getClaudeModelFromEnv() || (input.model ?? "") || "";
        const git = getGitContext();
        // In filesystem-locked sandboxes, SQLite can't bridge separate hook processes.
        // Fetch session context from the server so we have project_id + interaction_id.
        let sessionContext = getSessionContext(sessionId);
        if (!sessionContext && !isFilesystemAvailable()) {
            await hydrateSessionContextFromServer(sessionId);
            sessionContext = getSessionContext(sessionId);
        }
        // Resolve project UUID: local caches first (SQLite + project.json),
        // then session context (may contain server-assigned UUID), then derive
        // text slug from git remote as last resort (#938).
        const localUuid = git
            ? resolveLocalProjectUuid({ directory: git.root, projectName: git.projectName })
            : null;
        const projectId = localUuid ||
            sessionContext?.project_id ||
            (git ? deriveProjectId(git.remote, git.projectName) : null) ||
            undefined;
        // gramatr interaction_id is the cross-agent session key — use it for
        // both session_id (server history) and interaction_id (explicit resolution).
        const gramatrInteractionId = sessionContext?.interaction_id || null;
        const gramatrSessionId = gramatrInteractionId || sessionId;
        process.stderr.write("[gramatr] classifying...\n");
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
                ? routed.error.reason === "timeout"
                    ? "timeout"
                    : "error"
                : result
                    ? "ok"
                    : "skipped",
            elapsed_ms: elapsed,
            packet: result ?? null,
            error: routed.error ? { reason: routed.error.reason, detail: routed.error.detail } : null,
        });
        // v2 unified packet — enrichment is always merged inline by the server
        const packetTokenSavings = result?.execution?.token_savings || result?.token_savings || {};
        emitStatus(result, elapsed, lastFailure);
        try {
            const ts = packetTokenSavings;
            const es = result?.execution_summary || {};
            const cl = result?.classification || {};
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
                memory_delivered: result?.memory?.search_results?.length ?? null,
                downstream_model: downstreamModel || null,
                server_version: es.server_version || null,
                stage_timing: es.stage_timing ? JSON.stringify(es.stage_timing) : null,
                recorded_at: Date.now(),
                original_prompt: prompt.substring(0, 500),
                pending_feedback: true,
                feedback_submitted_at: null,
                client_type: runtime.clientType,
                agent_name: runtime.agentName,
                memory_tier: null,
                memory_scope: cl.memory_scope || result?.routing_signals?.memory_scope || null,
            });
            if (tokensSaved > 0) {
                appendOpHistory({
                    session_id: gramatrSessionId,
                    tool: "classification",
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
            const cl = result?.classification || {};
            const _es = result?.execution_summary || {};
            const hookInput = input;
            appendTurn({
                session_id: gramatrSessionId,
                client_session_id: hookInput.session_id ?? null,
                project_id: sessionContext?.project_id ?? (projectId || null),
                agent_name: runtime.agentName || null,
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
        // Smart compact: fires at threshold + every remind_every turns after.
        // auto=true  → silent background save, no injection
        // auto=false → escalating reminder hint, no forced compact
        try {
            const turnCount = getSessionTurnCount(gramatrSessionId);
            const pastThreshold = turnCount > 0 && turnCount >= COMPACT_TURN_THRESHOLD;
            const atThreshold = turnCount > 0 && turnCount % COMPACT_TURN_THRESHOLD === 0;
            const atReminder = pastThreshold &&
                turnCount > COMPACT_TURN_THRESHOLD &&
                (turnCount - COMPACT_TURN_THRESHOLD) % COMPACT_CFG.remind_every === 0;
            if (atThreshold || atReminder) {
                const projectSlug = git?.projectName ?? projectId ?? "project";
                if (COMPACT_CFG.auto) {
                    // Silent mode: save + queue handoff, no injection
                    const compact = writeCompact({
                        sessionId: gramatrSessionId,
                        projectId: projectId ?? null,
                        projectSlug,
                        gitRoot: git?.root ?? null,
                    });
                    const sessionCtx = getSessionContext(gramatrSessionId);
                    if (sessionCtx?.entity_id) {
                        enqueueOutboxMutation("add_observation", {
                            entity_id: sessionCtx.entity_id,
                            content: `[auto-compact turn ${compact.turnCount}] ${compact.summary}`,
                        });
                    }
                    // Continue to packet injection — no return
                }
                else {
                    // Reminder mode: inject escalating hint, do NOT compact
                    const turnsOver = turnCount - COMPACT_TURN_THRESHOLD;
                    const urgency = turnsOver >= COMPACT_TURN_THRESHOLD
                        ? "high"
                        : turnsOver >= COMPACT_CFG.remind_every * 2
                            ? "medium"
                            : "low";
                    const hints = {
                        low: `gramatr has saved your context. Run \`/clear\` to reset — your session will restore automatically.`,
                        medium: `gramatr: your session context is filling up. Run \`/clear\` soon to preserve continuity. Enable \`auto_compact.auto\` in ~/.gramatr/settings.json to do this automatically.`,
                        high: `⚠ gramatr: you're approaching your context limit. Run \`/clear\` now — your session will restore from the saved snapshot.`,
                    };
                    process.stdout.write(JSON.stringify({
                        hookSpecificOutput: {
                            hookEventName: "UserPromptSubmit",
                            additionalContext: `[gramatr auto-compact — turn ${turnCount}/${COMPACT_TURN_THRESHOLD}]\n${hints[urgency]}`,
                        },
                    }));
                    return 0;
                }
            }
            // Frequent handoff save: every 10 turns, queue session state to gramatr
            if (turnCount > 0 && turnCount % 10 === 0) {
                const sessionCtx = getSessionContext(gramatrSessionId);
                if (sessionCtx?.entity_id && sessionCtx.project_id) {
                    try {
                        enqueueOutboxMutation("session_end", {
                            session_id: gramatrSessionId,
                            project_id: sessionCtx.project_id,
                            reason: "periodic_handoff",
                        });
                    }
                    catch {
                        /* non-critical */
                    }
                }
            }
        }
        catch {
            // Non-critical — compact failure must never block the prompt
        }
        // #1214: cache directives + phase_template + project context from the v2
        // packet so a later degraded-mode response can still respect hard gates
        // and phase sequencing when the server is unreachable.
        try {
            if (result) {
                const userId = sessionContext?.entity_id || "default";
                const behavioralRules = result.behavioral_rules;
                const behavioralDirectives = result.behavioral_directives;
                if (behavioralRules || behavioralDirectives) {
                    setCachedDirective("directives", userId, {
                        behavioral_rules: behavioralRules ?? null,
                        behavioral_directives: behavioralDirectives ?? null,
                    });
                }
                const phaseTemplate = result.phase_template ?? (result.packet_1 && result.packet_1.phase_template) ?? null;
                if (phaseTemplate) {
                    setCachedDirective("phase_template", userId, phaseTemplate);
                }
                const manifestProjectId = result.manifest?.project_id ?? projectId ?? null;
                if (manifestProjectId) {
                    setCachedDirective("project_context", userId, {
                        project_id: manifestProjectId,
                        interaction_id: result.manifest?.interaction_id ?? gramatrInteractionId ?? null,
                        session_id: result.manifest?.session_id ?? gramatrSessionId,
                    });
                }
            }
        }
        catch {
            // Non-critical — cache is best-effort.
        }
        if (!result || !result.classification) {
            if (lastFailure) {
                // #1214: degraded mode — use cached directives + phase template so the
                // model still sees hard gates and the phase sequence when the server
                // call errors or times out.
                let degradedNotes = "";
                try {
                    const userId = sessionContext?.entity_id || "default";
                    const cachedDirectives = getCachedDirective("directives", userId);
                    const cachedPhases = getCachedDirective("phase_template", userId);
                    if (cachedDirectives || cachedPhases) {
                        const degradedPacket = {
                            schema: "gmtr.intelligence.contract.v2.degraded",
                            note: "Server unavailable — directives loaded from local cache.",
                            ...(cachedDirectives ? { cached_directives: cachedDirectives } : {}),
                            ...(cachedPhases ? { cached_phase_template: cachedPhases } : {}),
                        };
                        degradedNotes = `\n\n${JSON.stringify(degradedPacket)}`;
                    }
                }
                catch {
                    // Ignore cache read errors — degraded-mode fallback is best effort.
                }
                // Record a degraded classification so agent-gate knows the server is
                // unavailable (not that routing was skipped). effort='degraded' is the
                // signal; agent-gate allows through with a warning instead of hard-denying.
                try {
                    setLatestClassification({
                        session_id: gramatrSessionId,
                        classifier_model: null,
                        classifier_time_ms: null,
                        tokens_saved: 0,
                        savings_ratio: null,
                        effort: "degraded",
                        intent: null,
                        confidence: null,
                        memory_delivered: null,
                        downstream_model: null,
                        server_version: null,
                        stage_timing: null,
                        recorded_at: Date.now(),
                        original_prompt: null,
                        pending_feedback: false,
                        feedback_submitted_at: null,
                        client_type: runtime.clientType,
                        agent_name: runtime.agentName,
                        memory_tier: null,
                        memory_scope: null,
                    });
                }
                catch {
                    /* non-critical */
                }
                process.stdout.write(JSON.stringify({
                    hookSpecificOutput: {
                        hookEventName: "UserPromptSubmit",
                        additionalContext: formatFailureWarning(lastFailure) + degradedNotes,
                    },
                }));
            }
            else {
                process.stdout.write(JSON.stringify({}));
            }
            return 0;
        }
        // Enrich execution.token_savings with local all-time aggregate before formatting
        const allTimeTokensSaved = getAllTimeTokensSaved();
        if (result.execution?.token_savings) {
            result.execution.token_savings.all_time = allTimeTokensSaved;
        }
        else if (result.execution) {
            result.execution.token_savings = {
                all_time: allTimeTokensSaved,
            };
        }
        // Generate a per-turn UUID and save the full packet to SQLite before formatting.
        // The turn_id is injected into context so the agent can retrieve the packet via
        // local_fetch_packet — isolating concurrent agents on the same machine.
        const localTurnId = crypto.randomUUID();
        const sessionCtx = getSessionContext(gramatrSessionId);
        const cl = result.classification;
        try {
            savePacket({
                id: localTurnId,
                session_id: gramatrSessionId,
                project_id: sessionCtx?.project_id ?? projectId ?? null,
                effort: cl?.effort_level ?? null,
                intent: cl?.intent_type ?? null,
                created_at: Date.now(),
                payload: JSON.stringify(result),
            });
        }
        catch {
            /* non-critical — agent falls back to inline prefix */
        }
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "UserPromptSubmit",
                additionalContext: formatIntelligence(result, null, localTurnId),
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