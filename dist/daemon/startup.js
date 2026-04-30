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
import { existsSync, writeFileSync, unlinkSync, readFileSync, realpathSync, openSync, closeSync, constants, } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getGramatrDaemonSocketFromEnv, getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
function getGramatrDir() {
    return getGramatrDirFromEnv() ?? join(getHomeDir(), '.gramatr');
}
export function getDaemonSocketPath() {
    const envOverride = getGramatrDaemonSocketFromEnv();
    if (envOverride)
        return envOverride;
    // Windows uses named pipes; Unix uses filesystem sockets
    if (process.platform === 'win32')
        return '\\\\.\\pipe\\gramatr-daemon';
    return join(getGramatrDir(), 'daemon.sock');
}
export function getDaemonPidPath() {
    return join(getGramatrDir(), 'daemon.pid');
}
export function getDaemonLockPath() {
    return join(getGramatrDir(), 'daemon.lock');
}
export function getDaemonHttpPortPath() {
    return join(getGramatrDir(), 'daemon.port');
}
export function getDaemonTokenPath() {
    return join(getGramatrDir(), 'daemon.token');
}
/**
 * Write the shared daemon auth token to disk at 0600 perms.
 * Called early in startDaemon() — before the lock file is removed — so
 * socket clients can read it as soon as they're allowed to connect.
 */
export function writeDaemonToken(token) {
    try {
        writeFileSync(getDaemonTokenPath(), token, { mode: 0o600 });
    }
    catch {
        // Non-fatal — socket clients will fall back to remote HTTP
    }
}
/** Read the shared daemon auth token. Returns null if the file is missing. */
export function readDaemonToken() {
    try {
        const token = readFileSync(getDaemonTokenPath(), 'utf8').trim();
        return token || null;
    }
    catch {
        return null;
    }
}
/** Write HTTP fallback port to disk (token is written separately by writeDaemonToken). */
export function writeHttpCredentials(port, token) {
    try {
        writeFileSync(getDaemonHttpPortPath(), String(port), { mode: 0o600 });
        writeFileSync(getDaemonTokenPath(), token, { mode: 0o600 });
    }
    catch {
        // Non-fatal — hooks fall back to remote HTTP if creds are missing
    }
}
/** Remove HTTP fallback credential files on daemon shutdown. */
export function removeHttpCredentials() {
    try {
        unlinkSync(getDaemonHttpPortPath());
    }
    catch { /* already gone */ }
    try {
        unlinkSync(getDaemonTokenPath());
    }
    catch { /* already gone */ }
}
/** Read HTTP fallback credentials. Returns null if either file is missing or malformed. */
export function readHttpCredentials() {
    try {
        const port = parseInt(readFileSync(getDaemonHttpPortPath(), 'utf8').trim(), 10);
        const token = readFileSync(getDaemonTokenPath(), 'utf8').trim();
        if (!Number.isFinite(port) || port <= 0 || !token)
            return null;
        return { port, token };
    }
    catch {
        return null;
    }
}
/**
 * If an old daemon PID exists and the process is alive, send SIGTERM and wait
 * up to 1 second before continuing. Prevents ghost processes accumulating on
 * version upgrades where the new daemon overwrites daemon.pid and orphans the old one.
 */
export function terminateOrphanDaemon() {
    const pidPath = getDaemonPidPath();
    if (!existsSync(pidPath))
        return;
    try {
        const pid = parseInt(readFileSync(pidPath, 'utf8').trim(), 10);
        if (Number.isNaN(pid) || pid === process.pid)
            return;
        try {
            process.kill(pid, 0); // throws ESRCH if dead
        }
        catch {
            return; // already dead
        }
        process.kill(pid, 'SIGTERM');
        // Busy-wait up to 1s for the old process to exit
        const deadline = Date.now() + 1000;
        while (Date.now() < deadline) {
            try {
                process.kill(pid, 0);
                // Still alive — spin
                const start = Date.now();
                while (Date.now() - start < 50) { /* spin */ }
            }
            catch {
                break; // exited
            }
        }
        // If still alive after grace period, force-kill
        try {
            process.kill(pid, 'SIGKILL');
        }
        catch {
            // already exited — fine
        }
    }
    catch {
        // PID file unreadable or stale — ignore
    }
}
export function writePidFile() {
    writeFileSync(getDaemonPidPath(), String(process.pid), 'utf8');
    writeGramatrBinary();
}
/**
 * Record this process's binary path in ~/.gramatr.json so hooks can
 * restart the daemon if it dies mid-session (#1723).
 */
export function writeGramatrBinary() {
    try {
        const binaryPath = realpathSync(process.argv[1] ?? '');
        if (!binaryPath)
            return;
        const configPath = join(getHomeDir(), '.gramatr.json');
        let existing = {};
        try {
            existing = JSON.parse(readFileSync(configPath, 'utf8'));
        }
        catch { /* file missing or malformed — start fresh */ }
        existing['gramatr_binary'] = binaryPath;
        writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n', { mode: 0o600 });
    }
    catch {
        // Non-critical — never let this break daemon startup
    }
}
export function removePidFile() {
    try {
        unlinkSync(getDaemonPidPath());
    }
    catch {
        // Already gone — no-op
    }
}
export function removeSocketFile() {
    try {
        unlinkSync(getDaemonSocketPath());
    }
    catch {
        // Already gone — no-op
    }
}
/**
 * Returns true if the daemon process is alive AND the socket file exists.
 * Uses `process.kill(pid, 0)` as a lightweight liveness probe.
 */
export function isDaemonRunning() {
    const sockPath = getDaemonSocketPath();
    if (!existsSync(sockPath))
        return false;
    const pidPath = getDaemonPidPath();
    if (!existsSync(pidPath))
        return false;
    try {
        const raw = readFileSync(pidPath, 'utf8').trim();
        const pid = parseInt(raw, 10);
        if (Number.isNaN(pid))
            return false;
        process.kill(pid, 0); // throws ESRCH if dead, EPERM if alive but no permission
        return true;
    }
    catch (err) {
        const code = err.code;
        if (code === 'ESRCH')
            return false;
        return true; // EPERM → process exists, we just lack permission to signal it
    }
}
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
export function launchDaemon() {
    if (isDaemonRunning())
        return 'already-running';
    const lockPath = getDaemonLockPath();
    let lockFd;
    try {
        // O_CREAT|O_EXCL ensures only one winner in a race
        lockFd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600);
    }
    catch {
        return 'already-launching';
    }
    try {
        // Remove stale socket/pid from a previous crash
        removeSocketFile();
        removePidFile();
        const entryPoint = fileURLToPath(new URL('../bin/gramatr-mcp.js', import.meta.url));
        const child = spawn(process.execPath, [entryPoint, 'daemon', 'start'], {
            detached: true,
            stdio: 'ignore',
            env: { ...process.env, GRAMATR_DAEMON_MODE: '1' },
        });
        child.unref();
        return 'launched';
    }
    finally {
        closeSync(lockFd);
        // The daemon removes the lock once the socket is ready.
        // If we errored out before spawning, clean up the lock ourselves.
        try {
            unlinkSync(lockPath);
        }
        catch {
            // Daemon may have already removed it — no-op
        }
    }
}
/**
 * Poll for the daemon socket to appear, up to maxWaitMs milliseconds.
 * Used by session-start after launchDaemon() to wait for the socket to be ready.
 */
export async function waitForSocket(maxWaitMs = 3000) {
    const sockPath = getDaemonSocketPath();
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if (existsSync(sockPath))
            return true;
        await new Promise((r) => setTimeout(r, 50));
    }
    return false;
}
//# sourceMappingURL=startup.js.map