/**
 * orchestration-queue.ts — SQLite operations for the orchestration brain.
 *
 * All writes go through the daemon's owned connection (sqliteOwner.getDb()).
 * Never imported by hook processes — called only from server.ts dispatch.
 */
import type { OrchestrationRun, OrchestrationTask, OrchestrationApproval, OrchestrationTaskStatus, OrchestrationApprovalStage, OrchestrationApprovalStatus, OrchestrationProjectSummary, OrchestrationAccessScope } from './ipc-protocol.js';
export declare function createRun(params: {
    user_id: string;
    project_id: string;
    goal: string;
    execution_mode?: 'open' | 'sandbox';
    tags?: string | null;
    base_branch?: string | null;
    working_directory?: string | null;
    access_scope?: OrchestrationAccessScope;
}): OrchestrationRun;
export declare function getRun(id: string): OrchestrationRun | null;
export declare function listRuns(params: {
    user_id?: string;
    project_id?: string;
    include_completed?: boolean;
}): OrchestrationRun[];
export declare function updateRun(id: string, fields: Partial<Pick<OrchestrationRun, 'status' | 'prd_entity_id' | 'prd_content' | 'breakdown_json' | 'access_scope'>>): OrchestrationRun | null;
export declare function enqueueTasks(tasks: Array<{
    run_id: string;
    project_id: string;
    user_id?: string;
    sequence_number: number;
    title: string;
    description: string;
    task_branch?: string | null;
    assigned_agent_uuid?: string | null;
    assigned_agent_ref?: string | null;
    agent_system_prompt_ref?: string | null;
}>): OrchestrationTask[];
export declare function getTask(id: string): OrchestrationTask | null;
export declare function listTasks(params: {
    run_id?: string;
    project_id?: string;
    status?: OrchestrationTaskStatus | OrchestrationTaskStatus[];
}): OrchestrationTask[];
/**
 * Atomic task pickup — claims the next queued task for a session.
 * Uses a single UPDATE with RETURNING to avoid the SELECT+UPDATE race condition.
 * SQLite serializes all writes through the daemon process, so this is safe.
 */
export declare function pickupTask(params: {
    project_id: string;
    session_id: string;
}): OrchestrationTask | null;
export declare function completeTask(params: {
    task_id: string;
    result_summary?: string;
    pr_url?: string | null;
    pr_number?: number | null;
}): {
    task: OrchestrationTask | null;
    run_complete: boolean;
};
export declare function createApproval(params: {
    run_id: string;
    stage: OrchestrationApprovalStage;
}): OrchestrationApproval;
export declare function getApproval(run_id: string, stage: OrchestrationApprovalStage): OrchestrationApproval | null;
export declare function resolveApproval(params: {
    run_id: string;
    stage: OrchestrationApprovalStage;
    status: Exclude<OrchestrationApprovalStatus, 'pending'>;
    feedback?: string;
}): OrchestrationApproval | null;
export declare function statusDashboard(params: {
    user_id?: string;
    project_ids?: string[];
}): OrchestrationProjectSummary[];
//# sourceMappingURL=orchestration-queue.d.ts.map