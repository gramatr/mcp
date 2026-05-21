/**
 * gramatr OpenCode Plugin — Deployed Implementation
 *
 * This is the deployed plugin written to ~/.config/opencode/plugins/gramatr.ts
 * by `gramatr setup opencode`. It maps OpenCode's plugin lifecycle events to
 * gramatr hook invocations using the canonical `gramatr-hook` shell wrapper at
 * ~/.gramatr/bin/gramatr-hook (resolves gramatr binary → global > local > npx).
 *
 * Do NOT use Bun's $ API or npx directly — always invoke via gramatr-hook.
 */
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
const GRAMATR_DIR = process.env['GRAMATR_DIR'] ?? `${homedir()}/.gramatr`;
const HOOK_BIN = `${GRAMATR_DIR}/bin/gramatr-hook`;
/**
 * Invoke a gramatr hook by name, passing JSON as stdin.
 * Returns the hook's stdout (trimmed) or empty string on error/no output.
 * Errors are caught and logged to stderr — hooks never throw and block OpenCode.
 */
function hook(name, stdinPayload) {
    try {
        const result = execSync(`${HOOK_BIN} ${name} --opencode`, {
            input: JSON.stringify(stdinPayload),
            env: { ...process.env, GRAMATR_DIR },
            timeout: 15_000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.toString().trim();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[gramatr] hook ${name} error: ${msg}\n`);
        return '';
    }
}
/** Parse a hook stdout string as JSON, returning null on failure. */
function parseJson(raw) {
    if (!raw || raw === '{}')
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export const GramatrPlugin = async ({ project, client, directory }) => {
    // Session ID captured once session.created fires; used by all subsequent handlers.
    let sessionId = 'unknown';
    // Track seen message IDs to avoid re-firing user-prompt-submit on edits.
    const seenMessageIds = new Set();
    /** Inject text into the session via client.session.prompt if client supports it. */
    async function injectText(text) {
        if (!text || text === '{}')
            return;
        try {
            await client.session.prompt({
                path: { id: sessionId },
                body: { noReply: true, parts: [{ type: 'text', text }] },
            });
        }
        catch {
            process.stderr.write(`[gramatr] injection failed\n`);
        }
    }
    return {
        /**
         * session.created — Initialize gramatr session context.
         * Equivalent to SessionStart hook in Claude Code / Codex.
         */
        'session.created': async (event) => {
            const evtSessionId = event.sessionId ?? 'unknown';
            sessionId = evtSessionId;
            const stdout = hook('session-start', {
                session_id: sessionId,
                project_dir: project?.dir ?? directory ?? '',
            });
            await injectText(stdout);
        },
        /**
         * message.updated — Route new user messages through gramatr intelligence.
         * Equivalent to UserPromptSubmit hook.
         * Only fires for user-role messages and only once per message ID (dedup).
         */
        'message.updated': async (event) => {
            const evt = event;
            const role = evt.properties?.role;
            if (role !== 'user')
                return;
            const msgId = evt.properties?.id;
            if (msgId) {
                if (seenMessageIds.has(msgId))
                    return;
                seenMessageIds.add(msgId);
            }
            // Extract text content from message parts.
            const parts = evt.properties?.parts ?? [];
            const messageText = parts
                .filter((p) => p.type === 'text')
                .map((p) => p.text ?? '')
                .join('\n')
                .trim();
            if (!messageText)
                return;
            const stdout = hook('user-prompt-submit', {
                prompt: messageText,
                session_id: sessionId,
            });
            await injectText(stdout);
        },
        /**
         * tool.execute.before — Pre-tool validation and gate checks.
         * Equivalent to PreToolUse hooks (agent-gate, input-validator, git-gate, edit-tracker).
         */
        'tool.execute.before': async (input, _output) => {
            const inp = input;
            const toolName = inp.tool ?? '';
            const toolInput = inp.args ?? {};
            const payload = { tool_name: toolName, tool_input: toolInput };
            const dispatch = [];
            if (toolName === 'bash' || toolName === 'shell') {
                dispatch.push('git-gate', 'input-validator');
            }
            else if (toolName === 'edit' || toolName === 'write') {
                dispatch.push('input-validator', 'edit-tracker');
            }
            else if (toolName === 'agent') {
                dispatch.push('agent-gate');
            }
            else if (toolName.includes('gramatr')) {
                dispatch.push('input-validator');
            }
            for (const hookName of dispatch) {
                const stdout = hook(hookName, payload);
                const parsed = parseJson(stdout);
                if (parsed?.['decision'] === 'block') {
                    const reason = typeof parsed['reason'] === 'string' ? parsed['reason'] : `Blocked by ${hookName}`;
                    // gramatr-allow: B1 — deployed plugin file, no @gramatr/core dependency
                    throw new Error(reason);
                }
            }
        },
        /**
         * tool.execute.after — Post-tool telemetry.
         * Equivalent to PostToolUse hook (tool-tracker, agent-verify).
         */
        'tool.execute.after': async (input, output) => {
            const inp = input;
            const toolName = inp.tool ?? '';
            const toolInput = inp.args ?? {};
            const payload = { tool_name: toolName, tool_input: toolInput, tool_output: output };
            if (toolName === 'agent') {
                hook('agent-verify', payload);
            }
            else if (toolName.includes('gramatr')) {
                hook('tool-tracker', payload);
            }
        },
        /**
         * session.idle — Submit classification feedback and end session.
         * Equivalent to Stop + SessionEnd hooks.
         */
        'session.idle': async (_event) => {
            const payload = { session_id: sessionId };
            hook('stop', payload);
            hook('session-end', payload);
        },
        /**
         * session.compacted — Notify gramatr of context compaction.
         */
        'session.compacted': async (_event) => {
            hook('compact', { session_id: sessionId });
        },
        /**
         * experimental.session.compacting — Inject gramatr continuation context.
         * Appends an instruction block to preserve gramatr state across compaction.
         */
        'experimental.session.compacting': async (_input, output) => {
            const out = output;
            const continuationBlock = [
                '',
                '## gramatr session continuity',
                'Preserve the following gramatr state across this compaction:',
                '- Active session ID and project_id (do not reset)',
                '- Open tasks and their statuses (open/in_progress/blocked/review)',
                '- Recent decisions and their rationale',
                '- Classification feedback state for the current session',
                '- Any pending Quality Gate criteria not yet verified',
                'Resume the gramatr intelligence contract (gmtr.intelligence.contract.v2) on the next turn.',
            ].join('\n');
            if (typeof out.context === 'string') {
                out.context += continuationBlock;
            }
            else {
                out.context = continuationBlock;
            }
        },
    };
};
//# sourceMappingURL=gramatr-opencode-plugin.js.map