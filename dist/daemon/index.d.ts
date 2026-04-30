/**
 * daemon/index.ts — Entry point for `gramatr daemon start`.
 *
 * Starts the Unix socket IPC server, writes the PID file, removes the lock
 * file (unblocking hook processes waiting on waitForSocket), registers
 * graceful shutdown handlers, and emits a ready message to stderr.
 *
 * Sprint 2: sqliteOwner.open() / .close() for WAL checkpoint lifecycle,
 *           daemon.active sentinel for cross-process signaling.
 * Sprint 3: projectCache.load() / .save() for in-process project identity.
 */
export declare function startDaemon(): Promise<void>;
//# sourceMappingURL=index.d.ts.map