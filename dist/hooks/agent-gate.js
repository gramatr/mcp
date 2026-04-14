/**
 * agent-gate.ts — PreToolUse hook for the Agent tool.
 *
 * Denies Agent launches when no fresh gramatr_route_request classification
 * exists in the local SQLite state DB. "Fresh" means recorded within the
 * last 60 seconds. This ensures the calling agent has routed its task
 * through gramatr intelligence before spawning sub-agents.
 */
import { getLatestClassification, getSessionContext } from './lib/hook-state.js';
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
// ── Decision helpers ──
const FRESHNESS_THRESHOLD_MS = 60_000;
const DENY_REASON = 'Call gramatr_route_request before launching sub-agents. ' +
    'Use the returned RE for task description, ISC scaffold for acceptance criteria, ' +
    'and orchestration.agents.composed for the agent system prompt.';
function buildPreToolUseOutput(allow, reason) {
    if (allow) {
        return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
    }
    return {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason || 'Agent launch blocked by gramatr gate.',
        },
    };
}
export function checkClassificationFreshness(sessionId, nowMs = Date.now()) {
    const record = getLatestClassification(sessionId);
    if (!record || !record.recorded_at) {
        return { allow: false, reason: DENY_REASON };
    }
    const ageMs = nowMs - record.recorded_at;
    if (ageMs > FRESHNESS_THRESHOLD_MS) {
        return { allow: false, reason: DENY_REASON };
    }
    return { allow: true };
}
// ── Hook runner ──
export async function runAgentGateHook(_args = []) {
    const raw = await readStdin(2000);
    if (!raw.trim()) {
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
        return 0;
    }
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || input.tool_name !== 'Agent') {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
            return 0;
        }
        // Resolve session id from SQLite context
        const ctx = getSessionContext();
        const sessionId = ctx?.session_id || 'unknown';
        const result = checkClassificationFreshness(sessionId);
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(result.allow, result.reason)));
    }
    catch {
        // On error, allow — don't block on hook failures
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
    }
    return 0;
}
//# sourceMappingURL=agent-gate.js.map