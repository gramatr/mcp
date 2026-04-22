/**
 * statusline.ts — Smart local statusline renderer for Claude Code.
 *
 * Called by the Claude Code statusLine config field on each render cycle.
 * Reads the hooks-listener port from ~/.gramatr/.hooks-port. If the file
 * doesn't exist the hook environment isn't active — exits silently (empty).
 *
 * Data path: local SQLite (token savings) + daemon session context (call count).
 * No remote HTTP calls — works entirely within the local hook environment.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
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
        const port = parseInt(readFileSync(portFile, 'utf8').trim(), 10);
        const secret = readFileSync(secretFile, 'utf8').trim();
        if (!port || !secret)
            return null;
        return { port, secret };
    }
    catch {
        return null;
    }
}
function getGitState() {
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
            encoding: 'utf8', timeout: 1000,
        }).trim() || 'HEAD';
        const statusLines = execSync('git status --porcelain=v1 2>/dev/null', {
            encoding: 'utf8', timeout: 1000,
        }).split('\n').filter(Boolean);
        const modified = statusLines.filter(l => l[1] === 'M' || l[0] === 'M').length;
        const untracked = statusLines.filter(l => l.startsWith('??')).length;
        let ahead = 0;
        let behind = 0;
        try {
            const ab = execSync('git rev-list --left-right --count HEAD...@{u} 2>/dev/null', {
                encoding: 'utf8', timeout: 1000,
            }).trim();
            const parts = ab.split(/\s+/);
            ahead = parseInt(parts[0] ?? '0', 10) || 0;
            behind = parseInt(parts[1] ?? '0', 10) || 0;
        }
        catch { /* no upstream — fine */ }
        return { branch, ahead, behind, modified, untracked };
    }
    catch {
        return { branch: 'HEAD', ahead: 0, behind: 0, modified: 0, untracked: 0 };
    }
}
export async function runStatusline(args) {
    const conn = readPortAndSecret();
    if (!conn) {
        // Hooks-listener not running — not in a Claude Code hook environment. Silent exit.
        return;
    }
    const size = (args.find(a => ['small', 'medium', 'large'].includes(a)) ?? 'medium');
    const gitState = getGitState();
    const sessionId = process.env['CLAUDE_SESSION_ID'] ?? undefined;
    const projectId = process.env['CLAUDE_PROJECT_ID'] ?? undefined;
    const body = JSON.stringify({
        project_id: projectId,
        session_id: sessionId,
        size,
        git_state: gitState,
    });
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