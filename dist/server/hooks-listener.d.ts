/**
 * hooks-listener.ts — Local HTTP IPC server for hook subprocesses.
 *
 * The local MCP proxy server opens a lightweight HTTP listener on a random
 * localhost port at startup. Callers (statusline, any separate-process tool)
 * discover the port via ~/.gramatr/.hooks-port.
 *
 * Security: every request must present X-Hooks-Secret matching the value in
 * ~/.gramatr/.hooks-secret (written at startup, mode 0o600). This prevents
 * other processes on the same machine from hijacking the channel. The secret
 * is regenerated on each server start.
 *
 * Auth policy: callers never carry a JWT. The local server holds the token
 * and manages all outbound calls to the central server. No fallback to direct
 * remote calls — if the local server is unavailable, callers show offline.
 */
/** Return the current IPC secret. Null until startHooksListener() has run. */
export declare function getHooksSecret(): string | null;
/**
 * Start the hooks IPC listener on a random localhost port.
 * Writes the port to ~/.gramatr/.hooks-port so hook subprocesses can find it.
 * Returns the assigned port number.
 */
export declare function startHooksListener(): Promise<number>;
/**
 * Stop the hooks listener and remove the port + secret files.
 */
export declare function stopHooksListener(): void;
//# sourceMappingURL=hooks-listener.d.ts.map