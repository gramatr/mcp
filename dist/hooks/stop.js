import { resolveHookClientRuntime } from './lib/client-runtime.js';
import { writeCompact } from './lib/compact-writer.js';
import { getGitContext, readHookInput } from './lib/gramatr-hook-utils.js';
import { getSessionContext } from './lib/hook-state.js';
import { resolveLocalProjectUuid } from './lib/session.js';
import { extractLastInputTokens } from './lib/transcript-parser.js';
import { pullSessionContextFromLocal, pushSessionContextToLocal } from '../proxy/local-client.js';
export async function runStopHook(_args = []) {
    resolveHookClientRuntime(_args);
    // Write compact on every stop — fallback for SessionEnd not firing on /exit.
    // This ensures last_compact in settings.json always reflects the latest session state.
    try {
        const input = await readHookInput();
        const sessionId = input.session_id || 'unknown';
        const git = getGitContext();
        if (git && sessionId !== 'unknown') {
            const sessionCtx = getSessionContext(sessionId);
            const projectId = sessionCtx?.project_id
                ?? resolveLocalProjectUuid({ directory: git.root, projectName: git.projectName })
                ?? null;
            writeCompact({ sessionId, projectId, projectSlug: git.projectName, gitRoot: git.root });
        }
        // Token tracking: read cumulative input_tokens from last assistant turn in transcript,
        // then merge into the daemon session context for UserPromptSubmit to read next turn.
        if (sessionId !== 'unknown' && input.transcript_path) {
            const inputTokens = extractLastInputTokens(input.transcript_path);
            if (inputTokens !== null && inputTokens > 0) {
                // Pull existing context, merge ctx_tokens_used, push back.
                const existing = await pullSessionContextFromLocal(sessionId);
                const merged = {
                    ...(existing ?? {}),
                    session_id: sessionId,
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