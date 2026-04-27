import { resolveHookClientRuntime } from './lib/client-runtime.js';
import { writeCompact } from './lib/compact-writer.js';
import { getGitContext, readHookInput } from './lib/gramatr-hook-utils.js';
import { getSessionContext } from './lib/hook-state.js';
import { resolveLocalProjectUuid } from './lib/session.js';
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
    }
    catch {
        // Non-critical — stop hook must never block
    }
    process.stdout.write(JSON.stringify({}));
    return 0;
}
//# sourceMappingURL=stop.js.map