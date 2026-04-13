/**
 * hook-state.ts — Centralized SQLite state store for all gramatr hooks.
 *
 * Replaces the scattered ~/.gramatr/.state/ JSON/JSONL files with a single
 * ~/.gramatr/state.db SQLite database. All hook processes share this DB;
 * WAL mode ensures safe concurrent writes from simultaneous hook invocations.
 *
 * Set GRAMATR_STATE_DB=:memory: in tests to avoid touching the filesystem.
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getGramatrDirFromEnv, getHomeDir } from '../../config-runtime.js';
// ── DB singleton ──
let _db = null;
/** Set to false if the state DB directory cannot be created or the file cannot be opened. */
let _filesystemAvailable = true;
function getDbPath() {
    if (process.env.GRAMATR_STATE_DB)
        return process.env.GRAMATR_STATE_DB;
    const dir = getGramatrDirFromEnv() || join(getHomeDir(), '.gramatr');
    return join(dir, 'state.db');
}
function getDb() {
    if (_db)
        return _db;
    const path = getDbPath();
    if (path !== ':memory:') {
        try {
            const dir = dirname(path);
            if (!existsSync(dir))
                mkdirSync(dir, { recursive: true });
        }
        catch {
            _filesystemAvailable = false;
        }
    }
    try {
        _db = new Database(_filesystemAvailable ? path : ':memory:');
    }
    catch {
        _filesystemAvailable = false;
        _db = new Database(':memory:');
    }
    _db.pragma('journal_mode = WAL');
    _db.pragma('synchronous = NORMAL');
    _db.exec(`
    CREATE TABLE IF NOT EXISTS session_context (
      session_id        TEXT PRIMARY KEY,
      project_id        TEXT,
      interaction_id    TEXT,
      entity_id         TEXT,
      project_name      TEXT,
      git_root          TEXT,
      git_branch        TEXT,
      git_remote        TEXT,
      working_directory TEXT,
      session_start     TEXT,
      updated_at        TEXT NOT NULL,
      client_type       TEXT,
      agent_name        TEXT
    );

    CREATE TABLE IF NOT EXISTS turns (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT NOT NULL,
      turn_number  INTEGER,
      timestamp    TEXT,
      prompt       TEXT,
      effort_level TEXT,
      intent_type  TEXT,
      confidence   REAL,
      tokens_saved INTEGER
    );

    CREATE TABLE IF NOT EXISTS op_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT NOT NULL,
      tool         TEXT,
      time_ms      INTEGER,
      tokens_saved INTEGER,
      timestamp    INTEGER
    );

    CREATE TABLE IF NOT EXISTS latest_classification (
      session_id            TEXT PRIMARY KEY,
      classifier_model      TEXT,
      classifier_time_ms    INTEGER,
      tokens_saved          INTEGER,
      savings_ratio         REAL,
      effort                TEXT,
      intent                TEXT,
      confidence            REAL,
      memory_delivered      INTEGER,
      downstream_model      TEXT,
      server_version        TEXT,
      stage_timing          TEXT,
      recorded_at           INTEGER NOT NULL,
      original_prompt       TEXT,
      pending_feedback      INTEGER DEFAULT 0,
      feedback_submitted_at TEXT,
      client_type           TEXT,
      agent_name            TEXT,
      memory_tier           TEXT,
      memory_scope          TEXT
    );

    CREATE TABLE IF NOT EXISTS session_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id     TEXT,
      project_id     TEXT,
      ended_at       TEXT,
      reason         TEXT,
      commit_log     TEXT,
      interaction_id TEXT,
      entity_id      TEXT,
      client_type    TEXT,
      agent_name     TEXT,
      synced_at      TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS session_log_session_id
      ON session_log(session_id)
      WHERE session_id IS NOT NULL;
  `);
    // Migrate existing DBs: add columns that were added after initial schema.
    // These are no-ops if the column already exists (SQLite 3.37+ IF NOT EXISTS).
    // For older SQLite we catch and ignore.
    const migrations = [
        'ALTER TABLE session_context ADD COLUMN entity_id TEXT',
        'ALTER TABLE session_context ADD COLUMN client_type TEXT',
        'ALTER TABLE session_context ADD COLUMN agent_name TEXT',
        'ALTER TABLE latest_classification ADD COLUMN original_prompt TEXT',
        'ALTER TABLE latest_classification ADD COLUMN pending_feedback INTEGER DEFAULT 0',
        'ALTER TABLE latest_classification ADD COLUMN feedback_submitted_at TEXT',
        'ALTER TABLE latest_classification ADD COLUMN client_type TEXT',
        'ALTER TABLE latest_classification ADD COLUMN agent_name TEXT',
        'ALTER TABLE latest_classification ADD COLUMN memory_tier TEXT',
        'ALTER TABLE latest_classification ADD COLUMN memory_scope TEXT',
        'ALTER TABLE session_log ADD COLUMN interaction_id TEXT',
        'ALTER TABLE session_log ADD COLUMN entity_id TEXT',
        'ALTER TABLE session_log ADD COLUMN client_type TEXT',
        'ALTER TABLE session_log ADD COLUMN agent_name TEXT',
        'ALTER TABLE session_log ADD COLUMN synced_at TEXT',
        // Unique index is safe to re-run (IF NOT EXISTS)
        'CREATE UNIQUE INDEX IF NOT EXISTS session_log_session_id ON session_log(session_id) WHERE session_id IS NOT NULL',
    ];
    for (const sql of migrations) {
        try {
            _db.exec(sql);
        }
        catch { /* column already exists */ }
    }
    return _db;
}
/** Close and reset the DB connection. Primarily for tests. */
export function closeDb() {
    _db?.close();
    _db = null;
}
/**
 * Returns true when the state DB is backed by the real filesystem.
 * Returns false when the process could not create/open the state DB file
 * (e.g. a filesystem-locked sandbox) and fell back to :memory:.
 * In-memory mode means cross-hook state (session context) is not shared
 * between processes — hooks must call hydrateSessionContextFromServer()
 * to fetch context from the server instead.
 */
export function isFilesystemAvailable() {
    // Ensure the DB has been attempted so the flag is accurate.
    getDb();
    return _filesystemAvailable;
}
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
export async function hydrateSessionContextFromServer(sessionId) {
    // ── Phase IV path: local hooks server ──
    try {
        const { pullSessionContextFromLocal } = await import('../../proxy/local-client.js');
        const localCtx = await pullSessionContextFromLocal(sessionId);
        if (localCtx) {
            setSessionContext(localCtx);
            return;
        }
    }
    catch {
        // Local server not available — fall through to remote REST
    }
    // ── Phase III fallback: remote REST API ──
    try {
        const { getServerUrl, getToken } = await import('../../server/auth.js');
        const serverUrl = getServerUrl();
        const token = getToken();
        const url = `${serverUrl}/api/v1/sessions?session_id=${encodeURIComponent(sessionId)}`;
        const headers = { Accept: 'application/json' };
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok)
            return;
        const data = await response.json();
        const session = data.sessions?.[0];
        if (!session)
            return;
        setSessionContext({
            session_id: session.client_session_id ?? sessionId,
            project_id: session.project_id ?? null,
            interaction_id: session.interaction_id ?? null,
            entity_id: null,
            project_name: null,
            git_root: null,
            git_branch: session.git_branch ?? null,
            git_remote: session.git_remote ?? null,
            working_directory: null,
            session_start: session.started_at ?? null,
            updated_at: session.updated_at ?? new Date().toISOString(),
            client_type: session.client_type ?? null,
            agent_name: session.agent_name ?? null,
        });
    }
    catch {
        // Non-critical — hooks degrade gracefully with a null session context.
    }
}
// ── Session context — cross-hook IPC ──
/** Write current project/session context so other hooks can read it. */
export function setSessionContext(ctx) {
    getDb().prepare(`
    INSERT OR REPLACE INTO session_context
      (session_id, project_id, interaction_id, entity_id, project_name, git_root,
       git_branch, git_remote, working_directory, session_start, updated_at,
       client_type, agent_name)
    VALUES
      (@session_id, @project_id, @interaction_id, @entity_id, @project_name, @git_root,
       @git_branch, @git_remote, @working_directory, @session_start, @updated_at,
       @client_type, @agent_name)
  `).run(ctx);
}
/** Read the most recently written session context. */
export function getSessionContext() {
    const row = getDb()
        .prepare('SELECT * FROM session_context ORDER BY updated_at DESC LIMIT 1')
        .get();
    return row ?? null;
}
// ── Turns — per-prompt metadata accumulated across user-prompt-submit calls ──
/** Append one turn record. Called once per user-prompt-submit invocation. */
export function appendTurn(turn) {
    getDb().prepare(`
    INSERT INTO turns
      (session_id, turn_number, timestamp, prompt, effort_level, intent_type, confidence, tokens_saved)
    VALUES
      (@session_id, @turn_number, @timestamp, @prompt, @effort_level, @intent_type, @confidence, @tokens_saved)
  `).run(turn);
}
/** Return all turns for a session and delete them atomically. Called at session-end. */
export function flushTurns(sessionId) {
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY id')
        .all(sessionId);
    db.prepare('DELETE FROM turns WHERE session_id = ?').run(sessionId);
    return rows;
}
// ── Op history — tool call log accumulated per session ──
/** Append one op record. Called once per gramatr tool call. */
export function appendOpHistory(op) {
    getDb().prepare(`
    INSERT INTO op_history (session_id, tool, time_ms, tokens_saved, timestamp)
    VALUES (@session_id, @tool, @time_ms, @tokens_saved, @timestamp)
  `).run(op);
}
/** Return all op records for a session and delete them atomically. Called at session-end. */
export function flushOpHistory(sessionId) {
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM op_history WHERE session_id = ? ORDER BY id')
        .all(sessionId);
    db.prepare('DELETE FROM op_history WHERE session_id = ?').run(sessionId);
    return rows;
}
// ── Latest classification — for statusline display and feedback ──
/** Overwrite the latest classification result for a session. */
export function setLatestClassification(record) {
    getDb().prepare(`
    INSERT OR REPLACE INTO latest_classification
      (session_id, classifier_model, classifier_time_ms, tokens_saved, savings_ratio,
       effort, intent, confidence, memory_delivered, downstream_model,
       server_version, stage_timing, recorded_at,
       original_prompt, pending_feedback, feedback_submitted_at,
       client_type, agent_name, memory_tier, memory_scope)
    VALUES
      (@session_id, @classifier_model, @classifier_time_ms, @tokens_saved, @savings_ratio,
       @effort, @intent, @confidence, @memory_delivered, @downstream_model,
       @server_version, @stage_timing, @recorded_at,
       @original_prompt, @pending_feedback, @feedback_submitted_at,
       @client_type, @agent_name, @memory_tier, @memory_scope)
  `).run({
        ...record,
        pending_feedback: record.pending_feedback ? 1 : 0,
    });
}
/** Read the latest classification record for a session. */
export function getLatestClassification(sessionId) {
    const row = getDb()
        .prepare('SELECT * FROM latest_classification WHERE session_id = ?')
        .get(sessionId);
    if (!row)
        return null;
    return { ...row, pending_feedback: row.pending_feedback === 1 };
}
/** Mark pending feedback as submitted for a session. */
export function markClassificationFeedbackSubmitted(sessionId, submittedAt) {
    const ts = submittedAt ?? new Date().toISOString();
    getDb().prepare(`
    UPDATE latest_classification
    SET pending_feedback = 0, feedback_submitted_at = ?
    WHERE session_id = ?
  `).run(ts, sessionId);
}
// ── Session log — persistent history across sessions ──
/** Append a session-end entry. Replaces session-history.log + last-session-commits.txt. */
export function appendSessionLog(entry) {
    getDb().prepare(`
    INSERT INTO session_log
      (session_id, project_id, ended_at, reason, commit_log,
       interaction_id, entity_id, client_type, agent_name, synced_at)
    VALUES
      (@session_id, @project_id, @ended_at, @reason, @commit_log,
       @interaction_id, @entity_id, @client_type, @agent_name, @synced_at)
  `).run(entry);
}
/**
 * Return the most recent session log entry for a project.
 * Used by session-start to find the prior interaction_id for cross-agent resumption.
 */
export function getLastSessionForProject(projectId) {
    const row = getDb()
        .prepare(`
      SELECT session_id, interaction_id, entity_id, client_type, agent_name, ended_at
      FROM session_log
      WHERE project_id = ?
      ORDER BY id DESC
      LIMIT 1
    `)
        .get(projectId);
    return row ?? null;
}
/** Return the commit log from the most recent session that had commits. */
export function getLastSessionCommits() {
    const row = getDb()
        .prepare('SELECT commit_log FROM session_log WHERE commit_log IS NOT NULL ORDER BY id DESC LIMIT 1')
        .get();
    return row?.commit_log ?? null;
}
/**
 * Upsert sessions received from the server during session-start sync (Issue #720).
 * Uses INSERT OR IGNORE to preserve local commit_log if the row already exists.
 * The synced_at column records when the server record arrived locally.
 */
export function upsertSessionsFromServer(sessions) {
    if (sessions.length === 0)
        return;
    const syncedAt = new Date().toISOString();
    const stmt = getDb().prepare(`
    INSERT OR IGNORE INTO session_log
      (session_id, project_id, ended_at, reason, commit_log,
       interaction_id, entity_id, client_type, agent_name, synced_at)
    VALUES
      (@session_id, @project_id, @ended_at, @reason, @commit_log,
       @interaction_id, @entity_id, @client_type, @agent_name, @synced_at)
  `);
    for (const s of sessions) {
        stmt.run({
            session_id: s.client_session_id ?? s.id,
            project_id: null,
            ended_at: s.ended_at ?? null,
            reason: s.reason ?? null,
            commit_log: null,
            interaction_id: s.interaction_id ?? null,
            entity_id: null,
            client_type: s.client_type ?? null,
            agent_name: s.agent_name ?? null,
            synced_at: syncedAt,
        });
    }
}
/**
 * Backfill session_log rows when the server assigns a stable UUID to replace
 * a locally-derived project_id (e.g. 'gramatr/gramatr' → 'a3f9b2c1-...').
 * Called by persistSessionRegistration whenever project_id changes.
 * Returns the number of rows updated.
 */
export function migrateProjectId(oldProjectId, newProjectId) {
    if (oldProjectId === newProjectId)
        return 0;
    const result = getDb()
        .prepare('UPDATE session_log SET project_id = ? WHERE project_id = ?')
        .run(newProjectId, oldProjectId);
    return result.changes;
}
/** Mark a local session as synced to the server after a successful session-end call. */
export function markSessionSynced(sessionId, syncedAt) {
    const ts = syncedAt ?? new Date().toISOString();
    getDb()
        .prepare('UPDATE session_log SET synced_at = ? WHERE session_id = ?')
        .run(ts, sessionId);
}
/** Count total sessions for a project (for "Session #N" display). */
export function getProjectSessionCount(projectId) {
    const row = getDb()
        .prepare('SELECT COUNT(*) as cnt FROM session_log WHERE project_id = ?')
        .get(projectId);
    return row?.cnt ?? 0;
}
//# sourceMappingURL=hook-state.js.map