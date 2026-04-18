/**
 * hooks-listener.ts — Local HTTP IPC server for hook subprocesses.
 *
 * Phase IV: The local MCP proxy server opens a lightweight HTTP listener on a
 * random localhost port at startup and writes the port to ~/.gramatr/.hooks-port.
 * Hook subprocesses (session-start, user-prompt-submit, session-end) discover
 * this port and route calls through the local server instead of calling the
 * remote server directly.
 *
 * Benefits:
 *   - Auth managed in one place: the local server has the token; hooks never
 *     need to resolve or refresh it themselves.
 *   - Single enforcement point for data shapes and schema validation before
 *     any call reaches the remote API.
 *   - Cross-hook session context via in-process memory (no SQLite file needed).
 *   - Faster: localhost vs. internet round-trip for session context reads.
 *
 * Fallback: if the port file is absent (local server not running), hooks fall
 * back to direct remote calls with their own auth resolution.
 */
/**
 * Start the hooks IPC listener on a random localhost port.
 * Writes the port to ~/.gramatr/.hooks-port so hook subprocesses can find it.
 * Returns the assigned port number.
 */
export declare function startHooksListener(): Promise<number>;
/**
 * Stop the hooks listener and remove the port file.
 * Called on server shutdown so stale hooks know to fall back to direct remote.
 */
export declare function stopHooksListener(): void;
//# sourceMappingURL=hooks-listener.d.ts.map