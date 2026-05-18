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
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync, } from 'node:fs';
import { join } from 'node:path';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROTATED = 2; // keep daemon.log.1 and daemon.log.2
// ── Path helpers ──────────────────────────────────────────────────────────────
function getGramatrDir() {
    return getGramatrDirFromEnv() ?? join(getHomeDir(), '.gramatr');
}
function getDebugDir() {
    return join(getGramatrDir(), 'debug');
}
export function getDaemonLogPath() {
    return join(getDebugDir(), 'daemon.log');
}
export function getDaemonCrashPath() {
    return join(getDebugDir(), 'daemon-crash.json');
}
// ── Directory init ────────────────────────────────────────────────────────────
function ensureDebugDir() {
    const dir = getDebugDir();
    if (!existsSync(dir)) {
        try {
            mkdirSync(dir, { recursive: true, mode: 0o700 });
        }
        catch {
            // Non-fatal — log writes will simply fail silently below.
        }
    }
}
// ── Log rotation ──────────────────────────────────────────────────────────────
function rotateLogs() {
    const logPath = getDaemonLogPath();
    try {
        const st = statSync(logPath);
        if (st.size < MAX_LOG_BYTES)
            return;
    }
    catch {
        return; // file doesn't exist yet — nothing to rotate
    }
    // Shift existing rotated files: .2 → drop, .1 → .2, current → .1
    try {
        const slot2 = `${getDaemonLogPath()}.2`;
        const slot1 = `${getDaemonLogPath()}.1`;
        if (existsSync(slot2)) {
            try {
                unlinkSync(slot2);
            }
            catch { /* best-effort */ }
        }
        if (existsSync(slot1)) {
            try {
                renameSync(slot1, slot2);
            }
            catch { /* best-effort */ }
        }
        renameSync(logPath, slot1);
    }
    catch {
        // If rotation fails (e.g. permissions), keep writing to the existing file.
    }
}
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Append a log line to ~/.gramatr/debug/daemon.log.
 * Rotates the file first if it has grown past 5 MB.
 * Silently no-ops on any filesystem error.
 */
export function logDaemon(level, message, extra) {
    try {
        ensureDebugDir();
        rotateLogs();
        const timestamp = new Date().toISOString();
        const line = JSON.stringify({
            timestamp,
            level,
            pid: process.pid,
            message,
            ...(extra ? { extra } : {}),
        }) + '\n';
        appendFileSync(getDaemonLogPath(), line, { encoding: 'utf8' });
    }
    catch {
        // Never let logging errors surface to callers.
    }
}
/**
 * Write a crash record to ~/.gramatr/debug/daemon-crash.json.
 * Overwrites on each crash — only the latest crash is kept.
 */
export function writeCrashRecord(record) {
    try {
        ensureDebugDir();
        writeFileSync(getDaemonCrashPath(), JSON.stringify(record, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    }
    catch {
        // Best-effort — don't let crash-record writes re-throw.
    }
}
/**
 * Redirect process.stderr so every byte written to it is also appended to the
 * daemon log file. Call once at daemon startup.
 *
 * Implementation: monkey-patches process.stderr.write().  The original write
 * is always called first so stderr still works normally.
 */
export function redirectStderrToLog() {
    const originalWrite = process.stderr.write.bind(process.stderr);
    // process.stderr.write has two overloads; we need to handle both.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    process.stderr.write = function patchedWrite(chunk, encodingOrCb, cb) {
        // Call original first
        let result;
        if (typeof encodingOrCb === 'function') {
            result = originalWrite(chunk, encodingOrCb);
        }
        else if (cb) {
            result = originalWrite(chunk, encodingOrCb, cb);
        }
        else {
            result = originalWrite(chunk, encodingOrCb);
        }
        // Mirror to log file (best-effort, synchronous)
        try {
            const text = chunk instanceof Uint8Array ? Buffer.from(chunk).toString('utf8') : chunk;
            ensureDebugDir();
            rotateLogs();
            appendFileSync(getDaemonLogPath(), text, { encoding: 'utf8' });
        }
        catch {
            // Never let log mirroring break stderr
        }
        return result;
    };
}
/**
 * Register process-level crash handlers.
 * Should be called once, as early as possible in the daemon entry point.
 *
 * Captures:
 *   - process.on('uncaughtException')
 *   - process.on('unhandledRejection')
 *   - process.on('exit') when exit code != 0
 */
export function registerCrashHandlers() {
    process.on('uncaughtException', (err, origin) => {
        const record = {
            timestamp: new Date().toISOString(),
            exit_code: null,
            signal: null,
            last_known_state: `uncaughtException origin=${origin}`,
            error_message: `${err.name}: ${err.message}${err.stack ? '\n' + err.stack : ''}`,
        };
        logDaemon('ERROR', 'uncaughtException — daemon will exit', { origin, error: record.error_message });
        writeCrashRecord(record);
        // Give the log write a moment then exit 1 (Node.js default behaviour)
        process.exit(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
        const message = reason instanceof Error
            ? `${reason.name}: ${reason.message}${reason.stack ? '\n' + reason.stack : ''}`
            : String(reason);
        logDaemon('ERROR', 'unhandledRejection', { message, promise: String(promise) });
        // Not fatal by default — log and continue. If it becomes fatal, the
        // uncaughtException handler above will catch the ensuing exception.
    });
    process.on('exit', (code) => {
        if (code !== 0) {
            const record = {
                timestamp: new Date().toISOString(),
                exit_code: code,
                signal: null,
                last_known_state: 'process.exit with non-zero code',
                error_message: `Exited with code ${code}`,
            };
            writeCrashRecord(record);
        }
    });
    // SIGTERM / SIGKILL arrive as signals; capture the signal name in the crash
    // record when the process is killed unexpectedly (not via gracefulShutdown).
    // We use a flag so that gracefulShutdown can suppress the crash record.
    let handledGracefully = false;
    globalThis['__gramatrDaemonGracefulExit'] = () => { handledGracefully = true; };
    process.on('SIGKILL', () => {
        // SIGKILL cannot be caught — this handler is for documentation only.
    });
    // Wrap the exit handler to detect signal-induced exits
    const origExit = process.exit.bind(process);
    process.exit = (code) => {
        const exitCode = typeof code === 'number' ? code : (code != null ? parseInt(String(code), 10) || 0 : 0);
        if (!handledGracefully && exitCode !== 0) {
            const record = {
                timestamp: new Date().toISOString(),
                exit_code: exitCode,
                signal: null,
                last_known_state: 'process.exit called',
                error_message: `Exited with code ${exitCode}`,
            };
            writeCrashRecord(record);
        }
        return origExit(exitCode);
    };
}
//# sourceMappingURL=daemon-logger.js.map