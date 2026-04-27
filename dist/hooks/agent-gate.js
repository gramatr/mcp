/**
 * agent-gate.ts — PreToolUse hook for the Agent tool.
 *
 * Denies Agent launches when no fresh gramatr_route_request classification
 * exists in the local SQLite state DB. "Fresh" means recorded within the
 * last 60 seconds. This ensures the calling agent has routed its task
 * through gramatr intelligence before spawning sub-agents.
 */
import { getLatestClassification, getSessionContext, getSessionContextByProject } from './lib/hook-state.js';
import { deriveProjectId, getGitContext } from './lib/gramatr-hook-utils.js';
import { AGENT_GATE_FRESHNESS_THRESHOLD_MS, HOOK_STDIN_DEFAULT_TIMEOUT_MS } from './generated/hook-timeouts.js';
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
const FRESHNESS_THRESHOLD_MS = AGENT_GATE_FRESHNESS_THRESHOLD_MS;
const DENY_REASON = 'Call gramatr_route_request before launching sub-agents. ' +
    'Use the returned RE for task description, Quality Gate scaffold for acceptance criteria, ' +
    'and orchestration.agents.agent_defs[0] for the agent system prompt.';
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
// Effort levels that indicate a full specification was done upfront.
// Standard+ means TaskCreate + QG criteria were required before this turn,
// so the sub-agent is pre-authorized by the specification.
const SPECIFICATION_EFFORTS = new Set(['standard', 'extended', 'advanced', 'deep', 'comprehensive']);
export function checkClassificationFreshness(sessionId, nowMs = Date.now()) {
    // Sessions executing an orchestration task are pre-scoped at dispatch time.
    const sessionCtx = getSessionContext(sessionId);
    if (sessionCtx?.orchestration_task_id) {
        return { allow: true };
    }
    const record = getLatestClassification(sessionId);
    if (!record || !record.recorded_at) {
        return { allow: false, reason: DENY_REASON };
    }
    const ageMs = nowMs - record.recorded_at;
    if (ageMs > FRESHNESS_THRESHOLD_MS) {
        return { allow: false, reason: DENY_REASON };
    }
    // Degraded mode — allow through with a warning.
    if (record.effort === 'degraded') {
        return {
            allow: true,
            reason: 'gramatr routing degraded — sub-agent launching without pre-classification. Pass task context manually.',
        };
    }
    // Standard+ effort means a full specification was done upfront (TaskCreate + QG).
    // Pre-authorized — no need to re-route before spawning.
    if (record.effort && SPECIFICATION_EFFORTS.has(record.effort)) {
        return { allow: true };
    }
    return { allow: true };
}
// ── Hook runner ──
export async function runAgentGateHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_DEFAULT_TIMEOUT_MS);
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
        // Derive project_id from git context, then look up active session.
        // user-prompt-submit resolves project_id as a UUID (via localUuid) but
        // deriveProjectId returns a slug — getSessionContextByProject does an exact
        // match, so it misses when a UUID was stored. Fall back to the most-recent
        // session context in the DB (safe: only one Claude Code session per terminal).
        const git = getGitContext();
        const projectId = git ? deriveProjectId(git.remote, git.projectName) : null;
        const ctx = (projectId ? getSessionContextByProject(projectId) : null) ?? getSessionContext();
        const interactionId = ctx?.interaction_id || ctx?.session_id || 'unknown';
        const result = checkClassificationFreshness(interactionId);
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(result.allow, result.reason)));
    }
    catch {
        // On error, allow — don't block on hook failures
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
    }
    return 0;
}
//# sourceMappingURL=agent-gate.js.map