/**
 * Session Manager — automatic session lifecycle for the local MCP server.
 *
 * - Auto session_start on first proxied tool call
 * - Auto session_end on process exit (SIGTERM, SIGINT)
 * - Tracks session ID for correlation
 * - Tracks tool call count for session metrics
 */
/**
 * Ensure a session is started. Called before the first proxied tool call.
 * Idempotent — only starts once per process lifetime.
 */
export declare function ensureSession(): Promise<void>;
/**
 * Get the current session ID (for correlation).
 */
export declare function getSessionId(): string | null;
/**
 * Get the tool call count for the current session.
 */
export declare function getToolCallCount(): number;
//# sourceMappingURL=session-manager.d.ts.map