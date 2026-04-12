/**
 * Session Manager — automatic session lifecycle for the local MCP server.
 *
 * - Auto session_start on first proxied tool call
 * - Auto session_end on process exit (SIGTERM, SIGINT)
 * - Tracks session ID for correlation
 * - Tracks tool call count for session metrics
 */
import { callRemoteTool } from '../proxy/remote-client.js';
let sessionId = null;
let sessionStarted = false;
let toolCallCount = 0;
let exitHandlerRegistered = false;
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
        const result = (await callRemoteTool('gramatr_session_start', {}));
        // Extract session ID from response
        if (result?.content?.[0]?.text) {
            try {
                const data = JSON.parse(result.content[0].text);
                sessionId = data.session_id || data.interaction_id || null;
            }
            catch {
                // Response not JSON — that's OK
            }
        }
        process.stderr.write(`[gramatr-mcp] Session started${sessionId ? ` (${sessionId.substring(0, 8)}...)` : ''}\n`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[gramatr-mcp] Warning: session_start failed (${message})\n`);
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
        await callRemoteTool('gramatr_session_end', {
            tool_calls: toolCallCount,
        });
        process.stderr.write(`[gramatr-mcp] Session ended (${toolCallCount} tool calls)\n`);
    }
    catch {
        // Best-effort — process is exiting, don't block
    }
}
/**
 * Get the current session ID (for correlation).
 */
export function getSessionId() {
    return sessionId;
}
/**
 * Get the tool call count for the current session.
 */
export function getToolCallCount() {
    return toolCallCount;
}
//# sourceMappingURL=session-manager.js.map