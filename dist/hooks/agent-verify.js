/**
 * agent-verify.ts — PostToolUse hook for the Agent tool.
 *
 * After a sub-agent completes, reads the latest classification from SQLite
 * and emits a Quality Gate verification reminder to stderr. This is advisory only —
 * PostToolUse hooks cannot deny operations.
 */
import { getLatestClassification, getSessionContext } from './lib/hook-state.js';
import { HOOK_STDIN_EXTENDED_TIMEOUT_MS } from './generated/hook-timeouts.js';
// ── Stdin ──
function readStdin(timeoutMs) {
    return new Promise((resolve) => {
        let data = '';
        const timer = setTimeout(() => resolve(data), timeoutMs);
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
        process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
        process.stdin.resume();
    });
}
// ── Hook runner ──
export async function runAgentVerifyHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_EXTENDED_TIMEOUT_MS);
    // PostToolUse always emits continue: true
    process.stdout.write(JSON.stringify({ continue: true }));
    if (!raw.trim())
        return 0;
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || input.tool_name !== 'Agent')
            return 0;
        const ctx = getSessionContext();
        const sessionId = ctx?.session_id || 'unknown';
        const record = getLatestClassification(sessionId);
        if (record) {
            const parts = [];
            if (record.effort)
                parts.push(`effort=${record.effort}`);
            if (record.intent)
                parts.push(`intent=${record.intent}`);
            const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
            process.stderr.write(`[gramatr] Sub-agent completed${detail}. Verify Quality Gate acceptance criteria before proceeding.\n`);
        }
        else {
            process.stderr.write('[gramatr] Sub-agent completed. No Quality Gate scaffold found — verify results manually.\n');
        }
    }
    catch {
        // Best effort — never crash on PostToolUse
    }
    return 0;
}
//# sourceMappingURL=agent-verify.js.map