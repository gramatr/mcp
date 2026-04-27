import { writeCompact } from './lib/compact-writer.js';
import { getGitContext } from './lib/gramatr-hook-utils.js';
import { getSessionContext } from './lib/hook-state.js';
import { resolveLocalProjectUuid } from './lib/session.js';
export async function runCompactHook(_args = []) {
    try {
        const git = getGitContext();
        if (!git) {
            process.stderr.write('[gramatr] compact: no git context found\n');
            return 1;
        }
        const sessionCtx = getSessionContext();
        const sessionId = sessionCtx?.session_id ?? 'unknown';
        const projectId = sessionCtx?.project_id
            ?? resolveLocalProjectUuid({ directory: git.root, projectName: git.projectName })
            ?? null;
        const result = writeCompact({ sessionId, projectId, projectSlug: git.projectName, gitRoot: git.root });
        process.stderr.write(`[gramatr] compact saved: ${result.id} (${result.turnCount} turns)\n`);
        process.stdout.write(`${result.summary}\n`);
        return 0;
    }
    catch (err) {
        process.stderr.write(`[gramatr] compact error: ${String(err)}\n`);
        return 1;
    }
}
//# sourceMappingURL=compact.js.map