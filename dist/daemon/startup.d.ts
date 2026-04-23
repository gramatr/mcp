/**
 * startup.ts — Daemon lifecycle helpers.
 *
 * Two halves:
 *   Daemon side  — writePidFile, removePidFile, removeSocketFile, path helpers
 *   Hook side    — isDaemonRunning, launchDaemon, waitForSocket
 *
 * The lock file (O_CREAT|O_EXCL) prevents races when multiple hooks fire
 * simultaneously at session start. Only one process wins the lock and
 * launches the daemon; the rest see 'already-launching'.
 */
export declare function getDaemonSocketPath(): string;
export declare function getDaemonPidPath(): string;
export declare function getDaemonLockPath(): string;
export declare function getDaemonHttpPortPath(): string;
export declare function getDaemonTokenPath(): string;
/** Write HTTP fallback credentials (port + auth token) to disk at 0600 perms. */
export declare function writeHttpCredentials(port: number, token: string): void;
/** Remove HTTP fallback credential files on daemon shutdown. */
export declare function removeHttpCredentials(): void;
/** Read HTTP fallback credentials. Returns null if either file is missing or malformed. */
export declare function readHttpCredentials(): {
    port: number;
    token: string;
} | null;
export declare function writePidFile(): void;
export declare function removePidFile(): void;
export declare function removeSocketFile(): void;
/**
 * Returns true if the daemon process is alive AND the socket file exists.
 * Uses `process.kill(pid, 0)` as a lightweight liveness probe.
 */
export declare function isDaemonRunning(): boolean;
/**
 * Launch the daemon as a detached background process.
 *
 * Uses a lock file (O_CREAT|O_EXCL) to prevent simultaneous launches when
 * multiple hooks fire at the same time.
 *
 * Returns:
 *   'launched'          — daemon successfully spawned
 *   'already-launching' — another process holds the lock
 *   'already-running'   — daemon is already alive
 */
export declare function launchDaemon(): 'launched' | 'already-launching' | 'already-running';
/**
 * Poll for the daemon socket to appear, up to maxWaitMs milliseconds.
 * Used by session-start after launchDaemon() to wait for the socket to be ready.
 */
export declare function waitForSocket(maxWaitMs?: number): Promise<boolean>;
//# sourceMappingURL=startup.d.ts.map