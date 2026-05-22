#!/usr/bin/env node
// packages/mcp/src/bin/statusline.ts
// Claude Code statusLine command for the grāmatr plugin.
// Called by Claude Code on each render cycle. Reads the session_id from
// .gramatr/session.json (written by the UserPromptSubmit hook), calls
// GET /api/v1/statusline/:session_id — no auth required.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// gramatr-allow: c1
const REMOTE_URL = process.env.GRAMATR_URL ?? 'https://api.gramatr.com';
// gramatr-allow: c1
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
function getSessionId() {
    const sessionFile = join(PROJECT_DIR, '.gramatr', 'session.json');
    if (!existsSync(sessionFile))
        return null;
    try {
        const data = JSON.parse(readFileSync(sessionFile, 'utf8'));
        return typeof data.session_id === 'string' && data.session_id ? data.session_id : null;
    }
    catch {
        return null;
    }
}
async function main() {
    const sessionId = getSessionId();
    if (!sessionId)
        return;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${REMOTE_URL}/api/v1/statusline/${encodeURIComponent(sessionId)}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok)
            return;
        const text = await res.text();
        if (text)
            process.stdout.write(text);
    }
    catch { /* timeout or network error — silent */ }
}
main().catch(() => undefined);
// Named export so gramatr-mcp.ts can call `runStatusline()` via the CLI
// dispatch path (`gramatr statusline`).
export async function runStatusline(_args = []) {
    await main();
}
//# sourceMappingURL=statusline.js.map