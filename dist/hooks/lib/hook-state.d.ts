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
    platform: string | null;
    arch: string | null;
}
export interface TurnRecord {
    session_id: string;
    client_session_id: string | null;
    project_id: string | null;
    agent_name: string | null;
    turn_number: number | null;
    timestamp: string | null;
    prompt: string | null;
    effort_level: string | null;
    intent_type: string | null;
    confidence: number | null;
    tokens_saved: number | null;
}
export interface DirectiveCacheEntry {
    key: string;
    user_id: string;
    value: unknown;
    cached_at: string;
    expires_at: string;
}
export interface OutboxEntry {
    id: number;
    tool_name: string;
    args_json: string;
    created_at: string;
    replicated_at: string | null;
    attempts: number;
    last_error: string | null;
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
export interface LocalProject {
    id: string;
    slug: string;
    git_remote: string | null;
    directory: string | null;
    org_id: string | null;
    created_at: string;
    updated_at: string;
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
export declare function getSessionContextByProject(projectId: string): SessionContext | null;
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
export declare function getLastSessionForProject(projectId: string): Pick<SessionLogEntry, "session_id" | "interaction_id" | "entity_id" | "client_type" | "agent_name" | "ended_at"> | null;
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
/** Upsert a project record in the local SQLite database. */
export declare function upsertLocalProject(project: {
    id: string;
    slug: string;
    git_remote?: string | null;
    directory?: string | null;
    org_id?: string | null;
}): void;
/** Look up a project by its slug. */
export declare function getLocalProjectBySlug(slug: string): LocalProject | null;
/** Look up a project by its directory path. */
export declare function getLocalProjectByDirectory(directory: string): LocalProject | null;
/**
 * Write a cached directive/project-context value under (key, user_id).
 * TTL defaults to 24h. Keys are free-form (e.g. 'directives', 'phase_template',
 * 'project_context'). Overwrites any existing row.
 */
export declare function setCachedDirective(key: string, userId: string, value: unknown, ttlHours?: number): void;
/**
 * Read a cached directive. Returns null when the row is missing or expired.
 * Corrupt JSON is treated as a miss (not a throw) so callers can degrade cleanly.
 */
export declare function getCachedDirective(key: string, userId: string): unknown | null;
/** Enqueue a mutation to be replicated asynchronously. */
export declare function enqueueOutboxMutation(toolName: string, args: Record<string, unknown>): void;
/**
 * Attempt to replicate every unreplicated outbox row. On success the row is
 * marked replicated_at. Rows that reach three failed attempts keep their
 * last_error and remain in the table for manual inspection — they are not
 * retried on subsequent drains. Rows replicated more than seven days ago are
 * GC'd to keep the DB bounded.
 */
export declare function drainOutbox(callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>): Promise<void>;
/** Current unreplicated outbox size. Exposed for diagnostics + tests. */
export declare function getOutboxPendingCount(): number;
/** Diagnostic — read every outbox row (primarily for tests). */
export declare function listOutboxEntries(): OutboxEntry[];
/**
 * Test-only hook: inject an outbox row with arbitrary args_json so the
 * JSON.parse failure path in drainOutbox can be exercised. Production code
 * never calls this — the marker prefix keeps it discoverable.
 */
export declare function __testOnlyInsertOutboxRaw(toolName: string, argsJsonLiteral: string): number;
/** All-time tokens saved across every session recorded in the local DB. Fast SQLite SUM. */
export declare function getAllTimeTokensSaved(): number;
/** List all locally known projects, sorted by most recently active. */
export declare function listLocalProjects(limit?: number): LocalProject[];
//# sourceMappingURL=hook-state.d.ts.map