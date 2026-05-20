/**
 * Session Manager — automatic session lifecycle for the local MCP server.
 *
 * - Auto session_start on first proxied tool call
 * - Auto session_end on process exit (SIGTERM, SIGINT)
 * - Tracks session ID for correlation
 * - Tracks tool call count for session metrics
 */
import { callRemoteTool } from '../proxy/remote-client.js';
import { getGitContext, deriveProjectId } from '../hooks/lib/gramatr-hook-utils.js';
let sessionId = null;
let projectId = null;
let clientSessionId = null;
let sessionStarted = false;
let toolCallCount = 0;
let exitHandlerRegistered = false;
/**
 * Read the host client's session id from the environment. Claude Code exposes
 * `CLAUDE_SESSION_ID` to spawned MCP server processes; other hookful clients
 * may set their own equivalent. Returns null when no recognized env var is
 * set (the server will degrade to the user-keyed fallback for resource reads).
 */
function readClientSessionIdFromEnv() {
    const candidates = [
        process.env['CLAUDE_SESSION_ID'],
        process.env['CLAUDECODE_SESSION_ID'],
        process.env['GRAMATR_CLIENT_SESSION_ID'],
    ];
    for (const v of candidates) {
        if (typeof v === 'string' && v.length > 0)
            return v;
    }
    return null;
}
/**
 * Resolve session_start arguments from git context.
 * Provides a stable project_id derived from git remote so the server
 * can associate sessions with the correct project across restarts.
 */
function resolveSessionArgs() {
    const args = {
        client_type: 'claude_code',
        directory: process.cwd(),
    };
    // Cache the host-client session id so subsequent tool calls and resource
    // reads can send it as `X-Gramatr-Client-Session` for precise per-window
    // resolution (v0.20.25 PR #2775).
    clientSessionId = readClientSessionIdFromEnv();
    if (clientSessionId) {
        // Pass to session_start as `session_id`, which the server's
        // gramatr-session-lifecycle treats as the client_session_id and writes
        // into the `gramatr:session:client:<id>` index.
        args.session_id = clientSessionId;
    }
    const git = getGitContext();
    if (git) {
        const projectId = deriveProjectId(git.remote, git.projectName);
        args.project_id = projectId;
        if (git.remote && git.remote !== 'no-remote') {
            args.git_remote = git.remote;
        }
        args.project_name = git.projectName;
        args.directory = git.root;
    }
    return args;
}
/**
 * Ensure a session is started. Called before the first proxied tool call.
 * Idempotent — only starts once per process lifetime.
 */
export async function ensureSession() {
    if (sessionStarted) {
        toolCallCount++;
        return;
    }
    sessionStarted = true;
    toolCallCount = 1;
    // Register exit handler once
    if (!exitHandlerRegistered) {
        exitHandlerRegistered = true;
        const cleanup = () => {
            endSession().catch(() => { });
        };
        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);
        process.on('beforeExit', cleanup);
    }
    try {
        const sessionArgs = resolveSessionArgs();
        const result = (await callRemoteTool('session_start', sessionArgs));
        // Extract session ID and project ID from response
        if (result?.content?.[0]?.text) {
            try {
                const data = JSON.parse(result.content[0].text);
                sessionId = data.session_id || data.interaction_id || null;
                projectId = data.project_id || null;
            }
            catch {
                // Response not JSON — that's OK
            }
        }
        process.stderr.write(`[gramatr] Session started${sessionId ? ` (${sessionId.substring(0, 8)}...)` : ''}\n`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[gramatr] Warning: session_start failed (${message})\n`);
        // Don't block — continue serving tools without session tracking
    }
}
let sessionEnded = false;
/**
 * End the current session. Called on process exit.
 */
async function endSession() {
    if (!sessionStarted || !sessionId || sessionEnded)
        return;
    sessionEnded = true;
    try {
        await callRemoteTool('session_end', {
            tool_calls: toolCallCount,
        });
        process.stderr.write(`[gramatr] Session ended (${toolCallCount} tool calls)\n`);
    }
    catch {
        // Best-effort — process is exiting, don't block
    }
}
/**
 * Get the current gramatr session/interaction ID (for Mcp-Session-Id header).
 */
export function getSessionId() {
    return sessionId;
}
/**
 * Get the current project ID (for X-Gramatr-Project-Id header).
 */
export function getProjectId() {
    return projectId;
}
/**
 * Get the host client's session id (for X-Gramatr-Client-Session header).
 * Returns null when the env var was unavailable at session_start time —
 * callers should omit the header in that case.
 */
export function getClientSessionId() {
    return clientSessionId;
}
/**
 * Get the tool call count for the current session.
 */
export function getToolCallCount() {
    return toolCallCount;
}
//# sourceMappingURL=session-manager.js.map