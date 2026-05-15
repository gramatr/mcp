/**
 * orchestration-complete.ts — Session-end hook integration for orchestration tasks.
 *
 * Called from session-end before saveHandoff. Marks the task complete via
 * daemon IPC and writes the agent's output as an observation on the run's
 * project memory entity — so subsequent agents see what was built and decided.
 */
import type { SessionContext } from '../lib/hook-state.js';
export declare function completeOrchestrationTask(params: {
    sessionContext: SessionContext | null;
    commitLog?: string | null;
}): Promise<{
    completed: boolean;
    run_complete: boolean;
}>;
//# sourceMappingURL=orchestration-complete.d.ts.map