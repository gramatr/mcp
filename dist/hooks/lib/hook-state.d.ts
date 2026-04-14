/**
 * hook-state.ts — Centralized SQLite state store for all gramatr hooks.
 *
 * Replaces the scattered ~/.gramatr/.state/ JSON/JSONL files with a single
 * ~/.gramatr/state.db SQLite database. All hook processes share this DB;
 * WAL mode ensures safe concurrent writes from simultaneous hook invocations.
 *
 * Set GRAMATR_STATE_DB=:memory: in tests to avoid touching the filesystem.
 */
export interface SessionContext {
    session_id: string;
    project_id: string | null;
    interaction_id: string | null;
    entity_id: string | null;
    project_name: string | null;
    git_root: string | null;
    git_branch: string | null;
    git_remote: string | null;
    working_directory: string | null;
    session_start: string | null;
    updated_at: string;
    client_type: string | null;
    agent_name: string | null;
}
export interface TurnRecord {
    session_id: string;
    turn_number: number | null;
    timestamp: string | null;
    prompt: string | null;
    effort_level: string | null;
    intent_type: string | null;
    confidence: number | null;
    tokens_saved: number | null;
}
export interface OpRecord {
    session_id: string;
    tool: string;
    time_ms: number;
    tokens_saved: number;
    timestamp: number;
}
export interface ClassificationRecord {
    session_id: string;
    classifier_model: string | null;
    classifier_time_ms: number | null;
    tokens_saved: number | null;
    savings_ratio: number | null;
    effort: string | null;
    intent: string | null;
    confidence: number | null;
    memory_delivered: number | null;
    downstream_model: string | null;
    server_version: string | null;
    stage_timing: string | null;
    recorded_at: number;
    original_prompt: string | null;
    pending_feedback: boolean;
    feedback_submitted_at: string | null;
    client_type: string | null;
    agent_name: string | null;
    memory_tier: string | null;
    memory_scope: string | null;
}
export interface SessionLogEntry {
    session_id: string;
    project_id: string | null;
    ended_at: string;
    reason: string;
    commit_log: string | null;
    interaction_id: string | null;
    entity_id: string | null;
    client_type: string | null;
    agent_name: string | null;
    synced_at: string | null;
}
/** Lean shape received from server during session-start sync (Issue #720). */
export interface RemoteSessionRecord {
    id: string;
    client_session_id: string | null;
    interaction_id: string | null;
    client_type: string | null;
    agent_name: string | null;
    git_branch: string | null;
    started_at: string | null;
    ended_at: string | null;
    status: string;
    reason: string | null;
    summary: string | null;
}
/** Close and reset the DB connection. Primarily for tests. */
export declare function closeDb(): void;
/**
 * Returns true when the state DB is backed by the real filesystem.
 * Returns false when the process could not create/open the state DB file
 * (e.g. a filesystem-locked sandbox) and fell back to :memory:.
 * In-memory mode means cross-hook state (session context) is not shared
 * between processes — hooks must call hydrateSessionContextFromServer()
 * to fetch context from the server instead.
 */
export declare function isFilesystemAvailable(): boolean;
/**
 * Fetch session context and populate the in-memory DB so synchronous readers
 * (getSessionContext) work without hitting the filesystem.
 *
 * Called by user-prompt-submit and session-end when getSessionContext() returns
 * null in a fresh process (SQLite cross-process IPC unavailable or filesystem
 * locked). Priority:
 *
 *   1. Local hooks server in-memory store (Phase IV, fast, no auth needed)
 *   2. Remote REST API (Phase III fallback, needs auth)
 *
 * No-op if both sources are unreachable — hooks already have null-safe logic.
 */
export declare function hydrateSessionContextFromServer(sessionId: string): Promise<void>;
/** Write current project/session context so other hooks can read it. */
export declare function setSessionContext(ctx: SessionContext): void;
/**
 * Read session context.
 *
 * Prefer an exact session-id match when provided. Fallback to the most-recent
 * row preserves legacy behavior for callers that do not pass a session id.
 */
export declare function getSessionContext(sessionId?: string): SessionContext | null;
/** Append one turn record. Called once per user-prompt-submit invocation. */
export declare function appendTurn(turn: TurnRecord): void;
/** Return all turns for a session and delete them atomically. Called at session-end. */
export declare function flushTurns(sessionId: string): TurnRecord[];
/** Append one op record. Called once per gramatr tool call. */
export declare function appendOpHistory(op: OpRecord): void;
/** Return all op records for a session and delete them atomically. Called at session-end. */
export declare function flushOpHistory(sessionId: string): OpRecord[];
/** Overwrite the latest classification result for a session. */
export declare function setLatestClassification(record: ClassificationRecord): void;
/** Read the latest classification record for a session. */
export declare function getLatestClassification(sessionId: string): ClassificationRecord | null;
/** Mark pending feedback as submitted for a session. */
export declare function markClassificationFeedbackSubmitted(sessionId: string, submittedAt?: string): void;
/** Append a session-end entry. Replaces session-history.log + last-session-commits.txt. */
export declare function appendSessionLog(entry: SessionLogEntry): void;
/**
 * Return the most recent session log entry for a project.
 * Used by session-start to find the prior interaction_id for cross-agent resumption.
 */
export declare function getLastSessionForProject(projectId: string): Pick<SessionLogEntry, 'session_id' | 'interaction_id' | 'entity_id' | 'client_type' | 'agent_name' | 'ended_at'> | null;
/** Return the commit log from the most recent session that had commits. */
export declare function getLastSessionCommits(): string | null;
/**
 * Upsert sessions received from the server during session-start sync (Issue #720).
 * Uses INSERT OR IGNORE to preserve local commit_log if the row already exists.
 * The synced_at column records when the server record arrived locally.
 */
export declare function upsertSessionsFromServer(sessions: RemoteSessionRecord[]): void;
/**
 * Backfill session_log rows when the server assigns a stable UUID to replace
 * a locally-derived project_id (e.g. 'gramatr/gramatr' → 'a3f9b2c1-...').
 * Called by persistSessionRegistration whenever project_id changes.
 * Returns the number of rows updated.
 */
export declare function migrateProjectId(oldProjectId: string, newProjectId: string): number;
/** Mark a local session as synced to the server after a successful session-end call. */
export declare function markSessionSynced(sessionId: string, syncedAt?: string): void;
/** Count total sessions for a project (for "Session #N" display). */
export declare function getProjectSessionCount(projectId: string): number;
//# sourceMappingURL=hook-state.d.ts.map