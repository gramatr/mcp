/**
 * statusline.ts — grāmatr intelligence statusline for Claude Code.
 *
 * Called by the Claude Code statusLine config field on each render cycle.
 * Reads the hooks-listener port from ~/.gramatr/.hooks-port (PORT:PID format).
 * Validates the PID is still alive before connecting — avoids 2s timeout
 * burns on stale port files left behind by SIGKILL or unhandled exits.
 *
 * No git info. No remote HTTP calls. Pure grāmatr intelligence signal.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function getGramatrDir() {
    return process.env['GRAMATR_DIR'] || join(process.env['HOME'] || '~', '.gramatr');
}
function readPortAndSecret() {
    const dir = getGramatrDir();
    const portFile = join(dir, '.hooks-port');
    const secretFile = join(dir, '.hooks-secret');
    if (!existsSync(portFile) || !existsSync(secretFile))
        return null;
    try {
        const raw = readFileSync(portFile, 'utf8').trim();
        const secret = readFileSync(secretFile, 'utf8').trim();
        if (!secret)
            return null;
        // Support both legacy "PORT" and current "PORT:PID" formats.
        const [portStr, pidStr] = raw.split(':');
        const port = parseInt(portStr ?? '', 10);
        if (!port)
            return null;
        // Validate PID is still alive — fast-fail before burning a 2s fetch timeout.
        if (pidStr) {
            const pid = parseInt(pidStr, 10);
            if (Number.isFinite(pid) && pid > 0) {
                try {
                    process.kill(pid, 0); // throws ESRCH if dead
                }
                catch {
                    return null; // stale port file — hooks-listener process is gone
                }
            }
        }
        return { port, secret };
    }
    catch {
        return null;
    }
}
export async function runStatusline(args) {
    const conn = readPortAndSecret();
    if (!conn) {
        // Hooks-listener not running or stale — silent exit.
        return;
    }
    const size = (args.find(a => ['small', 'medium', 'large'].includes(a)) ?? 'medium');
    const sessionId = process.env['CLAUDE_SESSION_ID'] ?? undefined;
    const projectId = process.env['CLAUDE_PROJECT_ID'] ?? undefined;
    const body = JSON.stringify({ project_id: projectId, session_id: sessionId, size });
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://127.0.0.1:${conn.port}/hooks/statusline`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hooks-secret': conn.secret,
            },
            body,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok)
            return;
        const data = await res.json();
        if (typeof data.rendered === 'string') {
            process.stdout.write(data.rendered);
        }
    }
    catch {
        // Hooks-listener not responding — silent exit. Prevents terminal flicker.
    }
}
//# sourceMappingURL=statusline.js.map