/**
 * project-id-cleanup.ts — Resolve slug-format project_id values in state.db.
 *
 * Issue #1504 — the PostgreSQL entities table is clean (project-id-cleanup.ts
 * in @gramatr/persistence handles that). This module handles the client-side
 * SQLite store (state.db): session_context, session_log, and orchestration
 * tables that were written before or during the UUID migration and may still
 * carry slug-format project_id values.
 *
 * Runs once at daemon startup, fire-and-forget. Safe to interrupt.
 * Idempotent — UUID rows are skipped; only slugs are processed.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isSlug(value) {
    return typeof value === 'string' && value.length > 0 && !UUID_RE.test(value);
}
/**
 * Resolve a project slug to a UUID via the remote gramatr server.
 * Returns the UUID string, or null if resolution fails.
 */
async function resolveSlug(slug, callRemote) {
    try {
        const result = await callRemote('gramatr_resolve_project', { action: 'resolve', slug });
        const uuid = result?.project_id;
        return uuid && UUID_RE.test(uuid) ? uuid : null;
    }
    catch {
        return null;
    }
}
/**
 * Scan state.db tables for slug project_id values and resolve them to UUIDs.
 *
 * Uses the daemon's owned DB connection (passed in) to avoid competing with
 * the hook-state.ts connection.
 */
export async function runProjectIdCleanup(db, callRemote) {
    const result = {
        session_context: { checked: 0, updated: 0 },
        session_log: { checked: 0, updated: 0 },
        orchestration_tasks: { checked: 0, updated: 0 },
        skipped_slugs: [],
    };
    // Build a cache so we only resolve each slug once
    const resolved = new Map();
    async function getUuid(slug) {
        if (resolved.has(slug))
            return resolved.get(slug);
        const uuid = await resolveSlug(slug, callRemote);
        resolved.set(slug, uuid);
        if (!uuid)
            result.skipped_slugs.push(slug);
        return uuid;
    }
    // ── session_context ──────────────────────────────────────────────────────
    try {
        const rows = db
            .prepare('SELECT session_id, project_id FROM session_context WHERE project_id IS NOT NULL')
            .all();
        for (const row of rows) {
            result.session_context.checked++;
            if (!isSlug(row.project_id))
                continue;
            const uuid = await getUuid(row.project_id);
            if (!uuid)
                continue;
            db.prepare('UPDATE session_context SET project_id = ? WHERE session_id = ?')
                .run(uuid, row.session_id);
            result.session_context.updated++;
        }
    }
    catch {
        // Non-fatal — table may not exist on very old installs
    }
    // ── session_log ──────────────────────────────────────────────────────────
    try {
        const rows = db
            .prepare('SELECT id, project_id FROM session_log WHERE project_id IS NOT NULL')
            .all();
        for (const row of rows) {
            result.session_log.checked++;
            if (!isSlug(row.project_id))
                continue;
            const uuid = await getUuid(row.project_id);
            if (!uuid)
                continue;
            db.prepare('UPDATE session_log SET project_id = ? WHERE id = ?')
                .run(uuid, row.id);
            result.session_log.updated++;
        }
    }
    catch { /* non-fatal */ }
    // ── orchestration_tasks ──────────────────────────────────────────────────
    try {
        const rows = db
            .prepare('SELECT id, project_id FROM orchestration_tasks WHERE project_id IS NOT NULL')
            .all();
        for (const row of rows) {
            result.orchestration_tasks.checked++;
            if (!isSlug(row.project_id))
                continue;
            const uuid = await getUuid(row.project_id);
            if (!uuid)
                continue;
            db.prepare('UPDATE orchestration_tasks SET project_id = ? WHERE id = ?')
                .run(uuid, row.id);
            result.orchestration_tasks.updated++;
        }
    }
    catch { /* table may not exist yet */ }
    return result;
}
//# sourceMappingURL=project-id-cleanup.js.map