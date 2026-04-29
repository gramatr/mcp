/**
 * session-registry.ts — Reference-counted session tracking for the gramatr daemon.
 *
 * Sessions are tracked in-memory only (no SQLite in Sprint 1).
 * When the last session is released, a 30-second grace timer fires
 * the onEmpty callback so the daemon can checkpoint WAL and exit.
 */
class SessionRegistry {
    sessions = new Map();
    shutdownTimer = null;
    onEmptyFn = null;
    GRACE_MS = 30_000;
    setOnEmpty(fn) {
        this.onEmptyFn = fn;
    }
    register(sessionId) {
        this.sessions.set(sessionId, {
            sessionId,
            registeredAt: Date.now(),
            lastHeartbeatAt: Date.now(),
        });
        // Cancel any pending shutdown timer — a new session arrived
        if (this.shutdownTimer !== null) {
            clearTimeout(this.shutdownTimer);
            this.shutdownTimer = null;
        }
    }
    release(sessionId) {
        this.sessions.delete(sessionId);
        if (this.sessions.size === 0 && this.onEmptyFn !== null) {
            this.shutdownTimer = setTimeout(this.onEmptyFn, this.GRACE_MS);
        }
    }
    count() {
        return this.sessions.size;
    }
    list() {
        return [...this.sessions.values()];
    }
}
export const sessionRegistry = new SessionRegistry();
//# sourceMappingURL=session-registry.js.map