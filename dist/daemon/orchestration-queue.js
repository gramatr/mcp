/**
 * orchestration-queue.ts — SQLite operations for the orchestration brain.
 *
 * All writes go through the daemon's owned connection (sqliteOwner.getDb()).
 * Never imported by hook processes — called only from server.ts dispatch.
 */
import { randomUUID } from 'node:crypto';
import { sqliteOwner } from './sqlite-owner.js';
function bind(vals) {
    return vals;
}
function db() {
    const d = sqliteOwner.getDb();
    if (!d)
        throw Object.assign(new Error('SQLite unavailable'), { code: -32603 });
    return d;
}
function now() {
    return new Date().toISOString();
}
// ── Runs ──────────────────────────────────────────────────────────────────────
export function createRun(params) {
    const id = randomUUID();
    const ts = now();
    const mode = params.execution_mode ?? 'open';
    const scope = params.access_scope ?? 'working_dir_only';
    db().prepare(`
    INSERT INTO orchestration_runs
      (id, user_id, project_id, goal, status, execution_mode, tags, base_branch,
       working_directory, access_scope, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'prd_writing', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.user_id, params.project_id, params.goal, mode, params.tags ?? null, params.base_branch ?? null, params.working_directory ?? null, scope, ts, ts);
    return getRun(id);
}
export function getRun(id) {
    return db().prepare('SELECT * FROM orchestration_runs WHERE id = ?').get(id) ?? null;
}
export function listRuns(params) {
    const conditions = [];
    const bindings = [];
    if (params.user_id) {
        conditions.push('user_id = ?');
        bindings.push(params.user_id);
    }
    if (params.project_id) {
        conditions.push('project_id = ?');
        bindings.push(params.project_id);
    }
    if (!params.include_completed) {
        conditions.push("status NOT IN ('complete', 'failed', 'cancelled')");
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return db().prepare(`SELECT * FROM orchestration_runs ${where} ORDER BY created_at DESC`).all(...bind(bindings));
}
export function updateRun(id, fields) {
    const sets = ['updated_at = ?'];
    const vals = [now()];
    if (fields.status !== undefined) {
        sets.push('status = ?');
        vals.push(fields.status);
    }
    if (fields.prd_entity_id !== undefined) {
        sets.push('prd_entity_id = ?');
        vals.push(fields.prd_entity_id);
    }
    if (fields.prd_content !== undefined) {
        sets.push('prd_content = ?');
        vals.push(fields.prd_content);
    }
    if (fields.breakdown_json !== undefined) {
        sets.push('breakdown_json = ?');
        vals.push(fields.breakdown_json);
    }
    if (fields.access_scope !== undefined) {
        sets.push('access_scope = ?');
        vals.push(fields.access_scope);
    }
    vals.push(id);
    db().prepare(`UPDATE orchestration_runs SET ${sets.join(', ')} WHERE id = ?`).run(...bind(vals));
    return getRun(id);
}
// ── Tasks ─────────────────────────────────────────────────────────────────────
export function enqueueTasks(tasks) {
    const d = db();
    const ts = now();
    const ids = [];
    for (const t of tasks) {
        const id = randomUUID();
        ids.push(id);
        d.prepare(`
      INSERT INTO orchestration_tasks
        (id, run_id, project_id, user_id, sequence_number, title, description,
         task_branch, assigned_agent_uuid, assigned_agent_ref, agent_system_prompt_ref,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, t.run_id, t.project_id, t.user_id ?? null, t.sequence_number, t.title, t.description, t.task_branch ?? null, t.assigned_agent_uuid ?? null, t.assigned_agent_ref ?? null, t.agent_system_prompt_ref ?? null, ts, ts);
    }
    return ids.map(id => getTask(id));
}
export function getTask(id) {
    return db().prepare('SELECT * FROM orchestration_tasks WHERE id = ?').get(id) ?? null;
}
export function listTasks(params) {
    const conditions = [];
    const bindings = [];
    if (params.run_id) {
        conditions.push('run_id = ?');
        bindings.push(params.run_id);
    }
    if (params.project_id) {
        conditions.push('project_id = ?');
        bindings.push(params.project_id);
    }
    if (params.status) {
        const statuses = Array.isArray(params.status) ? params.status : [params.status];
        conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
        bindings.push(...statuses);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return db().prepare(`SELECT * FROM orchestration_tasks ${where} ORDER BY sequence_number ASC`).all(...bind(bindings));
}
/**
 * Atomic task pickup — claims the next queued task for a session.
 * Uses a single UPDATE with RETURNING to avoid the SELECT+UPDATE race condition.
 * SQLite serializes all writes through the daemon process, so this is safe.
 */
export function pickupTask(params) {
    const d = db();
    const ts = now();
    // Single statement: find the lowest sequence_number queued task and claim it atomically.
    // The subquery + WHERE status='queued' prevents double-pickup even under concurrent calls.
    const claimed = d.prepare(`
    UPDATE orchestration_tasks
    SET status = 'in_progress', assigned_session_id = ?, picked_up_at = ?, updated_at = ?
    WHERE id = (
      SELECT id FROM orchestration_tasks
      WHERE project_id = ? AND status = 'queued'
      ORDER BY sequence_number ASC
      LIMIT 1
    )
    RETURNING id
  `).get(params.session_id, ts, ts, params.project_id);
    if (!claimed)
        return null;
    return getTask(claimed.id);
}
export function completeTask(params) {
    const ts = now();
    const d = db();
    // node:sqlite has no transaction() helper — use explicit BEGIN IMMEDIATE / COMMIT.
    // IMMEDIATE prevents readers from upgrading to writers mid-transaction.
    d.exec('BEGIN IMMEDIATE');
    try {
        d.prepare(`
      UPDATE orchestration_tasks
      SET status = 'done', completed_at = ?, result_summary = ?,
          pr_url = ?, pr_number = ?, updated_at = ?
      WHERE id = ?
    `).run(ts, params.result_summary ?? null, params.pr_url ?? null, params.pr_number ?? null, ts, params.task_id);
        const task = getTask(params.task_id);
        if (!task) {
            d.exec('ROLLBACK');
            return { task: null, run_complete: false };
        }
        const pending = d.prepare(`
      SELECT COUNT(*) as n FROM orchestration_tasks
      WHERE run_id = ? AND status NOT IN ('done', 'failed')
    `).get(task.run_id);
        const run_complete = pending.n === 0;
        if (run_complete)
            updateRun(task.run_id, { status: 'complete' });
        d.exec('COMMIT');
        return { task, run_complete };
    }
    catch (err) {
        d.exec('ROLLBACK');
        throw err;
    }
}
// ── Approvals ─────────────────────────────────────────────────────────────────
export function createApproval(params) {
    const id = randomUUID();
    const ts = now();
    db().prepare(`
    INSERT OR REPLACE INTO orchestration_approvals (id, run_id, stage, status, created_at)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(id, params.run_id, params.stage, ts);
    return getApproval(params.run_id, params.stage);
}
export function getApproval(run_id, stage) {
    return db().prepare('SELECT * FROM orchestration_approvals WHERE run_id = ? AND stage = ? ORDER BY created_at DESC LIMIT 1').get(run_id, stage) ?? null;
}
export function resolveApproval(params) {
    const ts = now();
    db().prepare(`
    UPDATE orchestration_approvals
    SET status = ?, feedback = ?, resolved_at = ?
    WHERE run_id = ? AND stage = ?
  `).run(params.status, params.feedback ?? null, ts, params.run_id, params.stage);
    return getApproval(params.run_id, params.stage);
}
// ── Dashboard ─────────────────────────────────────────────────────────────────
export function statusDashboard(params) {
    const conditions = ["r.status NOT IN ('complete', 'failed', 'cancelled')"];
    const bindings = [];
    if (params.user_id) {
        conditions.push('r.user_id = ?');
        bindings.push(params.user_id);
    }
    if (params.project_ids?.length) {
        conditions.push(`r.project_id IN (${params.project_ids.map(() => '?').join(',')})`);
        bindings.push(...params.project_ids);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const rows = db().prepare(`
    SELECT
      r.project_id,
      r.id as run_id,
      r.goal,
      r.status,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_tasks,
      SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as active_tasks,
      a.stage as pending_approval
    FROM orchestration_runs r
    LEFT JOIN orchestration_tasks t ON t.run_id = r.id
    LEFT JOIN orchestration_approvals a ON a.run_id = r.id AND a.status = 'pending'
    ${where}
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).all(...bind(bindings));
    return rows;
}
//# sourceMappingURL=orchestration-queue.js.map