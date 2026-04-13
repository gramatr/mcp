import { readHookInput } from './lib/gramatr-hook-utils.js';
import { submitPendingClassificationFeedback } from './lib/feedback.js';
export async function runStopHook(_args = []) {
    try {
        const input = await readHookInput();
        await submitPendingClassificationFeedback({
            sessionId: input.session_id || 'unknown',
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