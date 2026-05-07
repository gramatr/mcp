/**
 * orchestration-pickup.ts — Session-start hook integration for orchestration tasks.
 *
 * Called from session-start after project_id is resolved. Checks if there is a
 * queued orchestration task for this project and returns formatted injection text
 * so Claude receives the task assignment as session context.
 *
 * Non-blocking: if the daemon is unavailable or no task is queued, returns null.
 */
import type { OrchestrationTask, OrchestrationAccessScope } from '../../daemon/ipc-protocol.js';
export interface OrchestrationPickupResult {
    task: OrchestrationTask;
    injectionText: string;
    orchDir: string;
    workingDir: string | null;
    accessScope: OrchestrationAccessScope;
}
/**
 * Attempt to claim the next queued orchestration task for this project/session.
 *
 * Returns null when:
 *   - no task is queued for the project
 *   - the daemon is unavailable
 *   - any error occurs (always non-blocking)
 */
export declare function pickupOrchestrationTask(params: {
    projectId: string;
    sessionId: string;
}): Promise<OrchestrationPickupResult | null>;
//# sourceMappingURL=orchestration-pickup.d.ts.map