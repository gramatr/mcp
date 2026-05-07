import { resolveHookClientRuntime } from './lib/client-runtime.js';
import { writeCompact } from './lib/compact-writer.js';
import { getGitContext, readHookInput } from './lib/gramatr-hook-utils.js';
import { getSessionContext } from './lib/hook-state.js';
import { resolveLocalProjectUuid, startRemoteSession } from './lib/session.js';
import { extractLastInputTokens } from './lib/transcript-parser.js';
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
        if (claudeSessionId !== 'unknown') {
            // Pull the stored context to extract interaction_id.
            const storedCtx = await pullSessionContextFromLocal(claudeSessionId);
            const interactionId = storedCtx?.interaction_id;
            if (interactionId) {
                gramatrSessionId = interactionId;
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
    }
    catch {
        // Non-critical — stop hook must never block
    }
    process.stdout.write(JSON.stringify({}));
    return 0;
}
//# sourceMappingURL=stop.js.map