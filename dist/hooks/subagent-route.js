/**
 * subagent-route.ts — SubagentStart hook.
 *
 * Fires immediately before a sub-agent is launched. Checks that a fresh
 * route_request classification exists in local SQLite state (same
 * freshness rule as agent-gate), and — when fresh — writes a reminder to
 * stderr that the calling agent must pass the Quality Gate scaffold from
 * `enrichment.data.reasoning.isc_scaffold` to the sub-agent.
 *
 * Output contract for SubagentStart:
 *   { "continue": true }                            — allow launch
 *   { "continue": false, "stopReason": "message" }  — block launch
 *
 * Graceful degradation: any internal error produces `{ continue: true }`
 * so a hook failure never blocks the sub-agent from launching.
 */
import { getLatestClassification, getSessionContextByProject } from './lib/hook-state.js';
import { deriveProjectId, getGitContext } from './lib/gramatr-hook-utils.js';
import { AGENT_GATE_FRESHNESS_THRESHOLD_MS, HOOK_STDIN_DEFAULT_TIMEOUT_MS, } from './generated/hook-timeouts.js';
// ── Stdin ──
function readStdin(timeoutMs) {
    return new Promise((resolve) => {
        let data = '';
        const timer = setTimeout(() => resolve(data), timeoutMs);
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.on('error', () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.resume();
    });
}
// ── Decision helpers ──
const FRESHNESS_THRESHOLD_MS = AGENT_GATE_FRESHNESS_THRESHOLD_MS;
const DENY_REASON = 'Sub-agent launch blocked: no fresh route_request classification found. ' +
    'Call route_request with the sub-task prompt first, then pass the ' +
    'Quality Gate scaffold from enrichment.data.reasoning.isc_scaffold as the ' +
    "sub-agent's acceptance criteria, and orchestration.agents.agent_defs[0] as the " +
    "sub-agent's system prompt.";
const ALLOW_REMINDER = '[gramatr] Sub-agent routing allowed. Remember to pass the Quality Gate scaffold ' +
    "from enrichment.data.reasoning.isc_scaffold as the sub-agent's acceptance " +
    'criteria and orchestration.agents.agent_defs[0] as its system prompt.\n';
function buildOutput(allow, reason) {
    if (allow)
        return { continue: true };
    return { continue: false, stopReason: reason || 'Sub-agent launch blocked by gramatr gate.' };
}
export function checkSubagentClassificationFreshness(sessionId, nowMs = Date.now()) {
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
export async function runSubagentRouteHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_DEFAULT_TIMEOUT_MS);
    // Empty stdin: allow — not enough information to block.
    if (!raw.trim()) {
        process.stdout.write(JSON.stringify(buildOutput(true)));
        return 0;
    }
    try {
        // Parse but do not require tool_name — SubagentStart input shape can vary.
        JSON.parse(raw);
        // Look up active session via git context, same as agent-gate.
        const git = getGitContext();
        const projectId = git ? deriveProjectId(git.remote, git.projectName) : null;
        const ctx = projectId ? getSessionContextByProject(projectId) : null;
        const interactionId = ctx?.interaction_id || ctx?.session_id || 'unknown';
        const result = checkSubagentClassificationFreshness(interactionId);
        if (result.allow) {
            // Emit reminder on stderr so the calling agent sees it in its transcript.
            process.stderr.write(ALLOW_REMINDER);
        }
        process.stdout.write(JSON.stringify(buildOutput(result.allow, result.reason)));
    }
    catch {
        // Never block on hook failures.
        process.stdout.write(JSON.stringify(buildOutput(true)));
    }
    return 0;
}
//# sourceMappingURL=subagent-route.js.map