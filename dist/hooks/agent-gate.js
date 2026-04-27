/**
 * agent-gate.ts — PreToolUse hook for the Agent tool.
 *
 * Emits a strong suggestion when no fresh gramatr_route_request classification
 * exists in the local SQLite state DB. "Fresh" means recorded within the last
 * 30 minutes. This ensures the calling agent has considered routing its task
 * through gramatr intelligence before spawning sub-agents.
 *
 * Behaviour:
 * - Fresh SQLite record        → allow silently
 * - No SQLite record + fresh last-packet.json → allow silently
 *   (UserPromptSubmit hook already delivered intelligence context this turn)
 * - No record / stale record   → allow with strong warning (NOT a hard block)
 */
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
const WARN_REASON = '[gramatr] No fresh route_request found — sub-agent launching with context from last injected packet. ' +
    'For best results, call gramatr_route_request first to get a fresh RE, Quality Gate scaffold for ' +
    'acceptance criteria, and orchestration.agents.agent_defs[0] for the agent system prompt.';
function buildPreToolUseOutput(allow, reason) {
    if (allow) {
        return {
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'allow',
                ...(reason ? { permissionDecisionReason: reason } : {}),
            },
        };
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
const SPECIFICATION_EFFORTS = new Set(['standard', 'extended', 'advanced', 'deep', 'comprehensive']);
/** Returns age of ~/.gramatr/.state/last-packet.json in ms, or undefined if unreadable. */
function getPacketFileAgeMs(nowMs) {
    try {
        const packetPath = join(homedir(), '.gramatr', '.state', 'last-packet.json');
        const stat = statSync(packetPath);
        return nowMs - stat.mtimeMs;
    }
    catch {
        return undefined;
    }
}
/**
 * @param sessionId     - interaction/session ID to look up in SQLite
 * @param nowMs         - current time (injectable for tests)
 * @param packetAgeMs   - age of last-packet.json in ms (injectable for tests; omit to read from fs)
 */
export function checkClassificationFreshness(sessionId, nowMs = Date.now(), packetAgeMs) {
    // Sessions executing an orchestration task are pre-scoped at dispatch time.
    const sessionCtx = getSessionContext(sessionId);
    if (sessionCtx?.orchestration_task_id) {
        return { allow: true };
    }
    const record = getLatestClassification(sessionId);
    if (!record || !record.recorded_at) {
        // Fallback: UserPromptSubmit already wrote last-packet.json this turn.
        // If the file is fresh, the agent has full intelligence context — allow silently.
        const age = packetAgeMs ?? getPacketFileAgeMs(nowMs);
        if (age !== undefined && age <= FRESHNESS_THRESHOLD_MS) {
            return { allow: true };
        }
        // No SQLite record and no fresh packet — allow with strong suggestion, not a hard block.
        return { allow: true, reason: WARN_REASON };
    }
    const ageMs = nowMs - record.recorded_at;
    if (ageMs > FRESHNESS_THRESHOLD_MS) {
        // Stale record — allow with warning rather than blocking the agent entirely.
        return { allow: true, reason: WARN_REASON };
    }
    // Degraded mode — allow through with a warning.
    if (record.effort === 'degraded') {
        return {
            allow: true,
            reason: 'gramatr routing degraded — sub-agent launching without pre-classification. Pass task context manually.',
        };
    }
    // Standard+ effort means a full specification was done upfront (TaskCreate + QG).
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
        const git = getGitContext();
        const projectId = git ? deriveProjectId(git.remote, git.projectName) : null;
        const ctx = (projectId ? getSessionContextByProject(projectId) : null) ?? getSessionContext();
        const interactionId = ctx?.interaction_id || ctx?.session_id || 'unknown';
        const nowMs = Date.now();
        const packetAgeMs = getPacketFileAgeMs(nowMs);
        const result = checkClassificationFreshness(interactionId, nowMs, packetAgeMs);
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(result.allow, result.reason)));
    }
    catch {
        // On error, allow — don't block on hook failures
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
    }
    return 0;
}
//# sourceMappingURL=agent-gate.js.map