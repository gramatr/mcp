/**
 * local-client.ts — Hook-side client for the local MCP hooks listener.
 *
 * Phase IV: Hook subprocesses call this module instead of remote-client.ts.
 * Routes all tool calls and session-context reads/writes through the local
 * MCP server when it is running, falling back to direct remote calls otherwise.
 *
 * Priority:
 *   1. Local hooks server (localhost:PORT from ~/.gramatr/.hooks-port)
 *      → auth already loaded in server process, no token resolution needed
 *      → data shape validated before any remote call
 *   2. Direct remote (callRemoteTool from remote-client.ts)
 *      → hooks resolve their own auth token as before
 *
 * The local server's port file is read once per hook process lifetime and
 * cached. Stale port files (server crashed without cleanup) are caught by a
 * connection error on first use, which clears the cache and falls through to
 * direct remote.
 */
/** True when the local hooks server port file exists and contains a valid port. */
export declare function isLocalHooksServerAvailable(): boolean;
/**
 * Call a gramatr tool, routing through the local hooks server when available.
 *
 * The local server injects auth and enforces data shapes before forwarding to
 * the remote API. If the local server is unavailable or returns an error,
 * falls back to a direct remote call via callRemoteTool.
 */
export declare function callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
/**
 * Push session context to the local server's in-memory store.
 *
 * Called by the session-start hook after setSessionContext() so later hook
 * processes (user-prompt-submit, session-end) can read the context without
 * hitting the SQLite file or the remote REST API.
 *
 * Returns true if the write was acknowledged. A false return is non-fatal —
 * later hooks fall back to SQLite → remote REST.
 */
export declare function pushSessionContextToLocal(ctx: unknown): Promise<boolean>;
/**
 * Pull session context from the local server's in-memory store.
 *
 * Returns the stored context for the given session_id, or the most recently
 * written context as a fallback. Returns null if the local server is
 * unavailable or has no context for this session.
 */
export declare function pullSessionContextFromLocal(sessionId: string): Promise<Record<string, unknown> | null>;
//# sourceMappingURL=local-client.d.ts.map