/**
 * daemon-logger.ts — Rotating file logger for the gramatr daemon.
 *
 * Writes structured log lines to ~/.gramatr/debug/daemon.log.
 * Rotates when the file exceeds 5 MB: renames to daemon.log.1, keeps at
 * most 2 rotated files (daemon.log.1, daemon.log.2), then starts fresh.
 *
 * On unexpected exit (non-zero code or uncaught exception), writes a crash
 * record to ~/.gramatr/debug/daemon-crash.json.
 *
 * Design constraints:
 *   - No external dependencies — plain Node.js fs calls only.
 *   - All operations are synchronous and best-effort: log failures never
 *     propagate to callers.
 *   - Safe to call before the daemon is fully initialised.
 */
export declare function getDaemonLogPath(): string;
export declare function getDaemonCrashPath(): string;
/**
 * Append a log line to ~/.gramatr/debug/daemon.log.
 * Rotates the file first if it has grown past 5 MB.
 * Silently no-ops on any filesystem error.
 */
export declare function logDaemon(level: 'INFO' | 'WARN' | 'ERROR', message: string, extra?: Record<string, unknown>): void;
export interface CrashRecord {
    timestamp: string;
    exit_code: number | null;
    signal: string | null;
    last_known_state: string;
    error_message: string | null;
}
/**
 * Write a crash record to ~/.gramatr/debug/daemon-crash.json.
 * Overwrites on each crash — only the latest crash is kept.
 */
export declare function writeCrashRecord(record: CrashRecord): void;
/**
 * Redirect process.stderr so every byte written to it is also appended to the
 * daemon log file. Call once at daemon startup.
 *
 * Implementation: monkey-patches process.stderr.write().  The original write
 * is always called first so stderr still works normally.
 */
export declare function redirectStderrToLog(): void;
/**
 * Register process-level crash handlers.
 * Should be called once, as early as possible in the daemon entry point.
 *
 * Captures:
 *   - process.on('uncaughtException')
 *   - process.on('unhandledRejection')
 *   - process.on('exit') when exit code != 0
 */
export declare function registerCrashHandlers(): void;
//# sourceMappingURL=daemon-logger.d.ts.map