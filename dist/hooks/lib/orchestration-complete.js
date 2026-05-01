/**
 * orchestration-complete.ts — Session-end hook integration for orchestration tasks.
 *
 * Called from session-end before saveHandoff. Marks the task complete via
 * daemon IPC and writes the agent's output as an observation on the run's
 * project memory entity — so subsequent agents see what was built and decided.
 */
import { callViaDaemon } from '../../proxy/local-client.js';
import { DAEMON_UNAVAILABLE } from '../../daemon/ipc-protocol.js';
export async function completeOrchestrationTask(params) {
    try {
        const taskId = params.sessionContext?.orchestration_task_id;
        if (!taskId)
            return { completed: false, run_complete: false };
        const result = await callViaDaemon('orchestration/task-complete', {
            task_id: taskId,
            result_summary: params.commitLog ?? undefined,
        });
        if (result === DAEMON_UNAVAILABLE || result === null || result === undefined) {
            return { completed: false, run_complete: false };
        }
        const res = result;
        // Write agent output to project memory so subsequent agents have full context.
        // Non-blocking — memory is best-effort.
        if (res.task?.run_id) {
            try {
                const run = await callViaDaemon('orchestration/run-get', { id: res.task.run_id });
                if (run !== DAEMON_UNAVAILABLE && run !== null) {
                    const r = run;
                    if (r.prd_entity_id) {
                        const taskLabel = res.task.title
                            ? `Task ${res.task.sequence_number}: ${res.task.title}`
                            : `Task ${res.task.sequence_number}`;
                        const observation = [
                            `## ${taskLabel} — Completed`,
                            ``,
                            params.commitLog
                                ? `### What was built\n${params.commitLog}`
                                : `Task completed by agent session.`,
                        ].join('\n');
                        await callViaDaemon('tool/call', {
                            tool: 'add_observation',
                            params: {
                                entity_id: r.prd_entity_id,
                                content: observation,
                            },
                        });
                    }
                }
            }
            catch { /* non-critical */ }
        }
        return { completed: true, run_complete: res.run_complete ?? false };
    }
    catch {
        return { completed: false, run_complete: false };
    }
}
//# sourceMappingURL=orchestration-complete.js.map