import { getClaudeModelFromEnv, getCompactConfig, getContextWindowConfig, getGramatrTimeoutFromEnv, isGramatrEnrichEnabledFromEnv, } from "../config-runtime.js";
import { HOOK_ROUTE_TIMEOUT_CAP_MS, HOOK_ROUTE_TIMEOUT_DEFAULT_MS, } from "./generated/hook-timeouts.js";
import { resolveHookClientRuntime } from "./lib/client-runtime.js";
import { deriveProjectId, getGitContext, readHookInput, resolveUserId, } from "./lib/gramatr-hook-utils.js";
import { appendOpHistory, appendTurn, enqueueOutboxMutation, getCachedDirective, getSessionContext, getSessionTurnCount, hydrateSessionContextFromServer, isFilesystemAvailable, savePacket, setCachedDirective, setLatestClassification, } from "./lib/hook-state.js";
import { pullSessionContextFromLocal, wasDaemonAvailable } from "../proxy/local-client.js";
import { buildLeanInjection, emitStatus, formatFailureWarning, formatIntelligence, renderLeanInjection, } from "./lib/intelligence.js";
import { recordInjectionSize } from "../metrics/collector.js";
import { appendPacketDebugLog } from "./lib/packet-debug-log.js";
import { persistClassificationResult, routePrompt, shouldSkipPromptRouting, } from "./lib/routing.js";
import { resolveLocalProjectUuid } from "./lib/session.js";
let turnCounter = 0;
const TIMEOUT_MS = getGramatrTimeoutFromEnv(HOOK_ROUTE_TIMEOUT_DEFAULT_MS);
const ENABLED = isGramatrEnrichEnabledFromEnv();
const COMPACT_CFG = getCompactConfig();
const CTX_WIN_CFG = getContextWindowConfig();
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
        case "auth_expired":
            return { reason: "auth_expired", detail };
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
                await appendOpHistory({
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
            await appendTurn({
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
        // Token-based context window tracking.
        // The Stop hook writes ctx_tokens_used into the daemon session context after
        // every assistant response. We read it here and act on configurable thresholds.
        // Falls back gracefully when the daemon is unavailable or no tokens are recorded.
        const additionalContextParts = [];
        try {
            const daemonCtx = await pullSessionContextFromLocal(gramatrSessionId);
            const ctxTokensUsed = daemonCtx?.ctx_tokens_used ?? 0;
            const ctxLimit = CTX_WIN_CFG.limit;
            const warnPct = CTX_WIN_CFG.warn_pct;
            const advisePct = CTX_WIN_CFG.advise_pct;
            const compactPct = CTX_WIN_CFG.compact_pct;
            if (ctxTokensUsed > 0) {
                const pct = Math.round((ctxTokensUsed / ctxLimit) * 100);
                const usedK = Math.round(ctxTokensUsed / 1000);
                const limitK = Math.round(ctxLimit / 1000);
                if (pct >= compactPct && COMPACT_CFG.auto) {
                    // Auto-compact: save handoff via MCP tool, then instruct model to tell user to /clear.
                    // grāmatr restores full context on the next session_bootstrap (source='clear').
                    additionalContextParts.push(`[gramatr: context ${pct}% full (${usedK}K/${limitK}K) — auto-compact triggered]\nMANDATORY: Your context window is critically full. You MUST: 1) Call save_handoff immediately to preserve session state, 2) Tell the user to run /clear. grāmatr will automatically restore your full context on the next prompt.`);
                }
                else if (pct >= advisePct) {
                    // Red/urgent: MANDATORY surface to user
                    additionalContextParts.push(`[gramatr: context ${pct}% full (${usedK}K/${limitK}K) — run /save-handoff then /clear]\nMANDATORY: Tell the user their context window is ${pct}% full and they should run /save-handoff then /clear now.`);
                }
                else if (pct >= warnPct) {
                    // Amber hint: advisory only
                    additionalContextParts.push(`[gramatr: context ~${pct}% full (${usedK}K/${limitK}K) — consider /save-handoff + /clear soon]`);
                }
            }
        }
        catch {
            // Non-critical — context window check must never block the prompt
        }
        // Frequent handoff save: every 10 turns, queue session state to gramatr
        try {
            const turnCount = getSessionTurnCount(gramatrSessionId);
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
            // Non-critical
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
                // Write session identity to .gramatr/session.json so the statusline bin
                // can call GET /api/v1/statusline/:session_id without auth.
                const resolvedSessionId = result.manifest?.session_id ?? gramatrSessionId;
                if (resolvedSessionId) {
                    try {
                        const { mkdirSync, writeFileSync } = await import('node:fs');
                        const { join } = await import('node:path');
                        // gramatr-allow: c1
                        const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
                        const gramatrDir = join(projectDir, '.gramatr');
                        mkdirSync(gramatrDir, { recursive: true });
                        writeFileSync(join(gramatrDir, 'session.json'), JSON.stringify({ session_id: resolvedSessionId }, null, 2) + '\n', 'utf8');
                    }
                    catch { /* non-critical */ }
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
                const ctxHint = additionalContextParts.length > 0 ? additionalContextParts.join('\n') + '\n\n' : '';
                process.stdout.write(JSON.stringify({
                    hookSpecificOutput: {
                        hookEventName: "UserPromptSubmit",
                        additionalContext: ctxHint + formatFailureWarning(lastFailure) + degradedNotes,
                    },
                }));
            }
            else if (additionalContextParts.length > 0) {
                process.stdout.write(JSON.stringify({
                    hookSpecificOutput: {
                        hookEventName: "UserPromptSubmit",
                        additionalContext: additionalContextParts.join('\n'),
                    },
                }));
            }
            else {
                process.stdout.write(JSON.stringify({}));
            }
            return 0;
        }
        // Use server-assigned turn_id if present; fall back to local UUID for resilience.
        // The turn_id is injected into context so the agent can retrieve the packet via
        // local_fetch_packet — isolating concurrent agents on the same machine.
        const manifest = result?.manifest;
        const localTurnId = typeof manifest?.turn_id === 'string' ? manifest.turn_id : crypto.randomUUID();
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
        const intelligenceContext = formatIntelligence(result, null, localTurnId);
        // #2658 — telemetry: record the injected payload size so we can verify
        // the lean shape (no inline RE/QG/composed_agent) is actually smaller.
        // Best-effort: failures in the metrics collector must never affect the
        // hook output path.
        try {
            const lean = buildLeanInjection(result);
            if (lean) {
                const { bytes } = renderLeanInjection(lean);
                recordInjectionSize(bytes);
            }
        }
        catch {
            // Non-critical
        }
        const daemonWarning = !wasDaemonAvailable()
            ? '⚠ grāmatr daemon disconnected — run /mcp in Claude Code to reconnect your session.\n\n'
            : '';
        const ctxHintPrefix = additionalContextParts.length > 0 ? additionalContextParts.join('\n') + '\n\n' : '';
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "UserPromptSubmit",
                additionalContext: daemonWarning + ctxHintPrefix + intelligenceContext,
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