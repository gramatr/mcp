/**
 * ipc-protocol.ts — Types for the gramatr daemon IPC protocol.
 *
 * Newline-delimited JSON-RPC 2.0 over a Unix domain socket.
 * One JSON object per line; no framing beyond the newline terminator.
 *
 * This file is types-only — no runtime code.
 */
export interface DaemonRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: DaemonMethod;
    params: Record<string, unknown>;
}
export interface DaemonResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export type DaemonMethod = 'tool/call' | 'session/register' | 'session/release' | 'session/context/get' | 'session/context/set' | 'project/resolve' | 'project/cache-set' | 'db/query' | 'agent/store' | 'agent/get' | 'agent/list' | 'agent/expire' | 'daemon/ping' | 'daemon/shutdown' | 'orchestration/run-create' | 'orchestration/run-get' | 'orchestration/run-list' | 'orchestration/run-update' | 'orchestration/task-enqueue' | 'orchestration/task-get' | 'orchestration/task-list' | 'orchestration/task-pickup' | 'orchestration/task-complete' | 'orchestration/approval-create' | 'orchestration/approval-resolve' | 'orchestration/approval-get' | 'orchestration/status-dashboard';
/**
 * Parameters for the db/query IPC method.
 *
 * Forwards the three most-called read operations to the daemon's owned
 * SQLite connection. Hook processes check for the daemon.active sentinel
 * file before routing through IPC (Sprint 3 will wire the async call path).
 */
export interface DbQueryParams {
    operation: 'getSessionContext' | 'getLastSessionForProject' | 'getLocalProjectByDirectory';
    args: Record<string, unknown>;
}
export type OrchestrationExecutionMode = 'open' | 'sandbox';
export type OrchestrationRunStatus = 'prd_writing' | 'prd_pending_approval' | 'task_breakdown' | 'tasks_pending_approval' | 'dispatching' | 'active' | 'complete' | 'failed' | 'cancelled';
export type OrchestrationTaskStatus = 'queued' | 'in_progress' | 'done' | 'failed';
export type OrchestrationApprovalStage = 'prd' | 'tasks';
export type OrchestrationApprovalStatus = 'pending' | 'approved' | 'rejected';
export type OrchestrationAccessScope = 'read_only' | 'working_dir_only' | 'open';
export interface OrchestrationRun {
    id: string;
    user_id: string;
    project_id: string;
    goal: string;
    status: OrchestrationRunStatus;
    execution_mode: OrchestrationExecutionMode;
    prd_entity_id: string | null;
    prd_content: string | null;
    breakdown_json: string | null;
    tags: string | null;
    approved_tools: string | null;
    base_branch: string | null;
    working_directory: string | null;
    access_scope: OrchestrationAccessScope;
    credential_manifest: string | null;
    created_at: string;
    updated_at: string;
}
/** One entry in the credential manifest stored on an OrchestrationRun. */
export interface CredentialEntry {
    name: string;
    bitwarden_id: string;
    description: string;
    tasks: number[];
}
export interface OrchestrationTask {
    id: string;
    run_id: string;
    project_id: string;
    user_id: string | null;
    sequence_number: number;
    title: string;
    description: string;
    status: OrchestrationTaskStatus;
    task_branch: string | null;
    pr_url: string | null;
    pr_number: number | null;
    assigned_agent_uuid: string | null;
    assigned_agent_ref: string | null;
    agent_system_prompt_ref: string | null;
    assigned_session_id: string | null;
    dispatched_at: string | null;
    picked_up_at: string | null;
    completed_at: string | null;
    result_summary: string | null;
    credential_uuids: string | null;
    created_at: string;
    updated_at: string;
}
export interface OrchestrationApproval {
    id: string;
    run_id: string;
    stage: OrchestrationApprovalStage;
    status: OrchestrationApprovalStatus;
    feedback: string | null;
    created_at: string;
    resolved_at: string | null;
}
export interface OrchestrationProjectSummary {
    project_id: string;
    run_id: string;
    goal: string;
    status: OrchestrationRunStatus;
    total_tasks: number;
    done_tasks: number;
    active_tasks: number;
    pending_approval: OrchestrationApprovalStage | null;
}
export declare const DAEMON_UNAVAILABLE: unique symbol;
export type DaemonUnavailable = typeof DAEMON_UNAVAILABLE;
/** Parameters for the `project/resolve` IPC method. */
export interface ProjectResolveParams {
    git_remote?: string;
    directory?: string;
    slug?: string;
}
/** Response shape for a successful `project/resolve` hit. */
export interface ProjectResolveHit {
    found: true;
    project_id: string;
    slug: string;
}
/** Response shape for a `project/resolve` miss. */
export interface ProjectResolveMiss {
    found: false;
}
export type ProjectResolveResult = ProjectResolveHit | ProjectResolveMiss;
//# sourceMappingURL=ipc-protocol.d.ts.map