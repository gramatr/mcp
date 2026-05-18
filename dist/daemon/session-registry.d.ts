/**
 * session-registry.ts — Reference-counted session tracking for the gramatr daemon.
 *
 * Sessions are tracked in-memory only (no SQLite in Sprint 1).
 * When the last session is released, a 30-second grace timer fires
 * the onEmpty callback so the daemon can checkpoint WAL and exit.
 */
interface SessionRegistration {
    sessionId: string;
    registeredAt: number;
    lastHeartbeatAt: number;
}
declare class SessionRegistry {
    private sessions;
    private shutdownTimer;
    private onEmptyFn;
    private readonly GRACE_MS;
    setOnEmpty(fn: () => void): void;
    register(sessionId: string): void;
    release(sessionId: string): void;
    count(): number;
    list(): SessionRegistration[];
}
export declare const sessionRegistry: SessionRegistry;
export {};
//# sourceMappingURL=session-registry.d.ts.map