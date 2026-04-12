import { parseTranscript } from './lib/transcript-parser.js';
import { getGitContext, readHookInput } from './lib/gramatr-hook-utils.js';
import { submitPendingClassificationFeedback } from './lib/feedback.js';
export async function runStopHook(_args = []) {
    try {
        const input = await readHookInput();
        if (!input.transcript_path)
            return 0;
        const git = getGitContext();
        if (!git)
            return 0;
        const parsed = parseTranscript(input.transcript_path);
        await submitPendingClassificationFeedback({
            rootDir: git.root,
            sessionId: input.session_id || 'unknown',
            originalPrompt: parsed?.lastUserPrompt || '',
            clientType: 'claude_code',
            agentName: 'Claude Code',
        });
        return 0;
    }
    catch {
        return 0;
    }
}
//# sourceMappingURL=stop.js.map