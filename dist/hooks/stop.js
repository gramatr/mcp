import { readHookInput } from './lib/gramatr-hook-utils.js';
import { submitPendingClassificationFeedback } from './lib/feedback.js';
import { resolveHookClientRuntime } from './lib/client-runtime.js';
import { STOP_FEEDBACK_TIMEOUT_MS } from './generated/hook-timeouts.js';
function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((resolve) => {
            setTimeout(() => resolve(null), timeoutMs);
        }),
    ]);
}
export async function runStopHook(_args = []) {
    const runtime = resolveHookClientRuntime(_args);
    try {
        const input = await readHookInput();
        await withTimeout(submitPendingClassificationFeedback({
            sessionId: input.session_id || 'unknown',
            clientType: runtime.clientType,
            agentName: runtime.agentName,
        }), STOP_FEEDBACK_TIMEOUT_MS);
    }
    catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[gramatr] stop hook error: ${detail}\n`);
    }
    process.stdout.write(JSON.stringify({}));
    return 0;
}
//# sourceMappingURL=stop.js.map