import { postAutoFeedback } from './lib/auto-feedback.js';
import { resolveHookClientRuntime } from './lib/client-runtime.js';
import { writeCompact } from './lib/compact-writer.js';
import { getGitContext, readHookInput } from './lib/gramatr-hook-utils.js';
import { enqueueOutboxMutation, getLatestPacketForSession, getSessionContext } from './lib/hook-state.js';
import { resolveLocalProjectUuid, startRemoteSession } from './lib/session.js';
import { extractLastInputTokens, extractLastTurnToolCalls } from './lib/transcript-parser.js';
import { pullSessionContextFromLocal, pushSessionContextToLocal } from '../proxy/local-client.js';
export async function runStopHook(_args = []) {
    resolveHookClientRuntime(_args);
    // Write compact on every stop — fallback for SessionEnd not firing on /exit.
    // This ensures last_compact in settings.json always reflects the latest session state.
    try {
        const input = await readHookInput();
        const claudeSessionId = input.session_id || 'unknown';
        const git = getGitContext();
        // Resolve the gramatr session ID (interaction_id) — all daemon context
        // writes must be keyed by this ID, not the Claude session ID, so that
        // user-prompt-submit.ts can find them via pullSessionContextFromLocal(gramatrSessionId).
        let gramatrSessionId = claudeSessionId;
        let resolvedInteractionId = null;
        if (claudeSessionId !== 'unknown') {
            // Pull the stored context to extract interaction_id.
            const storedCtx = await pullSessionContextFromLocal(claudeSessionId);
            const interactionId = storedCtx?.interaction_id;
            if (interactionId) {
                gramatrSessionId = interactionId;
                resolvedInteractionId = interactionId;
            }
            else {
                // No gramatr session exists yet — start one so ctx_tokens_used is stored
                // under a stable gramatr session ID from this point forward.
                if (git) {
                    const projectId = storedCtx?.project_id ??
                        resolveLocalProjectUuid({ directory: git.root, projectName: git.projectName }) ??
                        null;
                    if (projectId) {
                        try {
                            const sessionResp = await startRemoteSession({
                                clientType: 'claude-code',
                                sessionId: claudeSessionId,
                                projectId,
                                projectName: git.projectName,
                                gitRemote: git.remote ?? '',
                                gitBranch: git.branch,
                                directory: git.root,
                            });
                            if (sessionResp?.interaction_id) {
                                gramatrSessionId = sessionResp.interaction_id;
                                resolvedInteractionId = sessionResp.interaction_id;
                            }
                        }
                        catch {
                            // Non-critical — fall back to Claude session ID as key
                        }
                    }
                }
            }
        }
        if (git && claudeSessionId !== 'unknown') {
            const sessionCtx = getSessionContext(claudeSessionId);
            const projectId = sessionCtx?.project_id
                ?? resolveLocalProjectUuid({ directory: git.root, projectName: git.projectName })
                ?? null;
            await writeCompact({ sessionId: gramatrSessionId, projectId, projectSlug: git.projectName, gitRoot: git.root });
        }
        // Token tracking: read cumulative input_tokens from last assistant turn in transcript,
        // then merge into the daemon session context for UserPromptSubmit to read next turn.
        // Key by gramatrSessionId so user-prompt-submit.ts can find it.
        if (claudeSessionId !== 'unknown' && input.transcript_path) {
            const inputTokens = extractLastInputTokens(input.transcript_path);
            if (inputTokens !== null && inputTokens > 0) {
                // Pull existing context (keyed by gramatr session ID), merge ctx_tokens_used, push back.
                const existing = await pullSessionContextFromLocal(gramatrSessionId);
                const merged = {
                    ...(existing ?? {}),
                    session_id: gramatrSessionId,
                    ctx_tokens_used: inputTokens,
                };
                await pushSessionContextToLocal(merged);
            }
        }
        if (resolvedInteractionId && claudeSessionId !== 'unknown') {
            postAutoFeedback({
                sessionId: claudeSessionId,
                interactionId: resolvedInteractionId,
                clientType: 'claude-code',
            });
        }
        // #2658 — agent compliance telemetry: compare the most recent packet's
        // `directives.required_actions[]` against the set of tools the agent
        // actually invoked since the last user prompt. Each non-optional miss
        // is enqueued as a `learning_signal{kind: 'agent_compliance_miss'}` for
        // the classifier flywheel. Best-effort; failures must never block.
        try {
            if (claudeSessionId !== 'unknown' && input.transcript_path) {
                const packet = getLatestPacketForSession(gramatrSessionId);
                if (packet) {
                    recordComplianceMisses({
                        packet,
                        transcriptPath: input.transcript_path,
                        sessionId: gramatrSessionId,
                        projectId: (await pullSessionContextFromLocal(gramatrSessionId))?.project_id,
                    });
                }
            }
        }
        catch {
            // Non-critical — compliance telemetry must not block session shutdown.
        }
    }
    catch {
        // Non-critical — stop hook must never block
    }
    process.stdout.write(JSON.stringify({}));
    return 0;
}
function readRequiredActions(payload) {
    try {
        const parsed = JSON.parse(payload);
        const unified = parsed.unified_packet;
        const directives = parsed.directives ??
            unified?.directives;
        const raw = directives?.required_actions;
        if (!Array.isArray(raw))
            return [];
        return raw
            .map((r) => (r && typeof r === 'object' ? r : null))
            .filter((r) => r !== null);
    }
    catch {
        return [];
    }
}
/**
 * Compare packet `required_actions[]` against the tool_use entries in the
 * last turn of the transcript. Writes one `learning_signal{kind:
 * 'agent_compliance_miss'}` per non-optional missed call.
 */
export function recordComplianceMisses(ctx) {
    const required = readRequiredActions(ctx.packet.payload);
    if (required.length === 0)
        return;
    const calledShort = extractLastTurnToolCalls(ctx.transcriptPath);
    // Normalise — agents call MCP tools as `mcp__gramatr__create_entity` but
    // the packet references the short name (`create_entity`, `get_quality_gates`).
    const calledNormalised = new Set();
    for (const name of calledShort) {
        const parts = name.split('__');
        calledNormalised.add(parts[parts.length - 1] ?? name);
        calledNormalised.add(name);
    }
    for (const action of required) {
        if (action.optional === true)
            continue;
        const tool = action.call ?? action.tool;
        if (!tool)
            continue;
        if (calledNormalised.has(tool))
            continue;
        const observation = JSON.stringify({
            missed_tool: tool,
            phase: action.phase ?? null,
            effort_level: ctx.packet.effort,
            intent_type: ctx.packet.intent,
            session_id: ctx.sessionId,
            project_id: ctx.projectId ?? null,
            detected_at: new Date().toISOString(),
        });
        try {
            enqueueOutboxMutation('create_entity', {
                name: `compliance-miss-${ctx.sessionId.slice(-8)}-${tool}-${Date.now()}`,
                entity_type: 'learning_signal',
                metadata: {
                    kind: 'agent_compliance_miss',
                    missed_tool: tool,
                    phase: action.phase ?? null,
                    effort_level: ctx.packet.effort,
                    intent_type: ctx.packet.intent,
                    session_id: ctx.sessionId,
                    project_id: ctx.projectId ?? null,
                },
                observations: [observation],
            });
        }
        catch {
            // Non-critical — outbox unavailable
        }
    }
}
//# sourceMappingURL=stop.js.map