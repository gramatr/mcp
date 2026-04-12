export interface FlushTurnsOptions {
    sessionId: string;
    projectId: string;
    turns: unknown[];
}
export interface EndRemoteSessionOptions {
    entityId: string;
    sessionId: string;
    interactionId: string;
    projectId: string;
    summary: string;
    toolCallCount: number;
}
export interface SessionEndResult {
    ok: boolean;
    hadError: boolean;
}
export declare function flushTurns(options: FlushTurnsOptions): Promise<SessionEndResult>;
export declare function endRemoteSession(options: EndRemoteSessionOptions): Promise<SessionEndResult>;
//# sourceMappingURL=session-end.d.ts.map