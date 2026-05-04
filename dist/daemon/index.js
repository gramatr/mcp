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
import { chmodSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDaemonServer, dispatchRpcRequest } from './server.js';
import { startHttpFallback } from './http-server.js';
import { writePidFile, writeDaemonToken, removePidFile, removeSocketFile, terminateOrphanDaemon, getDaemonSocketPath, getDaemonLockPath, writeHttpCredentials, removeHttpCredentials, } from './startup.js';
import { sessionRegistry } from './session-registry.js';
import { sqliteOwner } from './sqlite-owner.js';
import { closeDb } from '../hooks/lib/hook-state.js';
import { getGramatrDirFromEnv, getGramatrStateDatabaseFromEnv, getHomeDir } from '../config-runtime.js';
import { getStateDatabasePath } from './db-path.js';
import { projectCache, getProjectCachePath } from './project-cache.js';
import { runProjectIdCleanup } from './project-id-cleanup.js';
import { callRemoteTool } from '../proxy/remote-client.js';
function getGramatrDir() {
    return getGramatrDirFromEnv() ?? join(getHomeDir(), '.gramatr');
}
function getSentinelPath() {
    return join(getGramatrDir(), 'daemon.active');
}
function writeSentinel() {
    // Skip when running in-memory (tests).
    if (getStateDatabasePath() === ':memory:')
        return;
    try {
        writeFileSync(getSentinelPath(), String(process.pid), 'utf8');
    }
    catch {
        // Non-fatal — sentinel is a best-effort signal.
    }
}
function removeSentinel() {
    try {
        unlinkSync(getSentinelPath());
    }
    catch {
        // Already gone or never written.
    }
}
let _httpServer = null;
export async function startDaemon() {
    const sockPath = getDaemonSocketPath();
    // Ensure ~/.gramatr/ is 0700 — world-traversable dir exposes the socket path (#1453).
    const gramatrDir = join(sockPath, '..');
    if (!existsSync(gramatrDir))
        mkdirSync(gramatrDir, { recursive: true, mode: 0o700 });
    try {
        chmodSync(gramatrDir, 0o700);
    }
    catch { /* non-fatal on read-only fs */ }
    // Kill any orphan daemon from a previous version before taking the socket.
    terminateOrphanDaemon();
    removeSocketFile();
    // Generate shared auth token once — used by both the Unix socket and HTTP fallback.
    // Write to disk immediately so it's available to hook processes as soon as the
    // lock file is removed (before the HTTP fallback has started).
    const { randomBytes } = await import('node:crypto');
    const authToken = randomBytes(32).toString('hex');
    writeDaemonToken(authToken);
    const server = createDaemonServer(authToken);
    // Start listening on the Unix socket
    await new Promise((resolve, reject) => {
        server.listen(sockPath, () => {
            try {
                chmodSync(sockPath, 0o600);
            }
            catch { /* non-fatal */ }
            resolve();
        });
        server.once('error', reject);
    });
    writePidFile();
    // Open the daemon's owned SQLite connection and start the checkpoint cycle.
    sqliteOwner.open();
    // Restore project identity cache from disk (skip in :memory: test mode)
    if (getGramatrStateDatabaseFromEnv() !== ':memory:') {
        projectCache.load(getProjectCachePath());
    }
    // Remove the lock file now that the socket is ready.
    // Token is already on disk — hook processes can auth immediately.
    try {
        unlinkSync(getDaemonLockPath());
    }
    catch {
        // Already gone — another racer may have cleaned it up
    }
    // Start localhost HTTP fallback (Tier 2 IPC — works on all platforms including Windows)
    try {
        const { port, server: hs } = await startHttpFallback(authToken, dispatchRpcRequest);
        _httpServer = hs;
        writeHttpCredentials(port, authToken);
        process.stderr.write(`[gramatr-daemon] HTTP fallback on 127.0.0.1:${port}\n`);
    }
    catch (err) {
        // Non-fatal — hooks fall back to remote HTTP if localhost HTTP unavailable
        process.stderr.write(`[gramatr-daemon] HTTP fallback unavailable: ${err.message}\n`);
    }
    // Write daemon.active sentinel so hook processes know the daemon owns the DB.
    writeSentinel();
    // Fire-and-forget: resolve slug project_id values in state.db tables.
    // Non-blocking — cleanup runs in background, failures are logged not thrown.
    if (getGramatrStateDatabaseFromEnv() !== ':memory:') {
        const db = sqliteOwner.getDb();
        if (db) {
            runProjectIdCleanup(db, callRemoteTool).then((r) => {
                const total = r.session_context.updated + r.session_log.updated + r.orchestration_tasks.updated;
                if (total > 0) {
                    process.stderr.write(`[gramatr-daemon] project_id cleanup: ${total} slugs resolved to UUIDs` +
                        ` (session_context=${r.session_context.updated}` +
                        `, session_log=${r.session_log.updated}` +
                        `, orchestration_tasks=${r.orchestration_tasks.updated})\n`);
                }
                if (r.skipped_slugs.length > 0) {
                    process.stderr.write(`[gramatr-daemon] project_id cleanup: ${r.skipped_slugs.length} slugs unresolvable — ` +
                        `${r.skipped_slugs.slice(0, 5).join(', ')}${r.skipped_slugs.length > 5 ? '…' : ''}\n`);
                }
            }).catch(() => { });
        }
    }
    // Graceful shutdown when the last session releases (+ 30s grace)
    sessionRegistry.setOnEmpty(() => {
        gracefulShutdown(server, 'idle');
    });
    // Handle the internal daemon/shutdown method (emitted via setImmediate)
    server.on('daemon-shutdown', () => {
        gracefulShutdown(server, 'requested');
    });
    process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));
    process.stderr.write(`[gramatr-daemon] listening on ${sockPath} (pid ${process.pid})\n`);
}
async function gracefulShutdown(server, reason) {
    process.stderr.write(`[gramatr-daemon] shutting down (${reason})\n`);
    server.close();
    _httpServer?.close();
    removeHttpCredentials();
    // Persist project identity cache to disk (skip in :memory: test mode)
    if (getGramatrStateDatabaseFromEnv() !== ':memory:') {
        projectCache.save(getProjectCachePath());
    }
    // TRUNCATE checkpoint via daemon's owned connection — must run before closeDb().
    try {
        sqliteOwner.close();
    }
    catch {
        // Non-fatal
    }
    // closeDb() handles any hook-state.ts DB connection that may be open in
    // this process (e.g. from tools invoked directly in the daemon process).
    try {
        closeDb();
    }
    catch {
        // Non-fatal
    }
    removeSentinel();
    removePidFile();
    removeSocketFile();
    process.exit(0);
}
//# sourceMappingURL=index.js.map