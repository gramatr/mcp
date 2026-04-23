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
    reason?: string;
    gitBranch?: string;
    gitRemote?: string;
    clientType?: string;
    agentName?: string;
    startedAt?: string;
    commitLog?: string | null;
}
export interface SaveHandoffOptions {
    projectId: string;
    sessionId: string;
    /** project@branch — what state we're in */
    whereWeAre: string;
    /** commits + files changed this session */
    whatShipped: string;
    /** open threads / in-progress items derived from recent prompts */
    whatsNext: string;
    /** key context: tool call count, branch, reason for end */
    keyContext: string;
    /** anything that must survive to the next session */
    dontForget: string;
    platform?: string;
}
export interface SessionEndResult {
    ok: boolean;
    hadError: boolean;
}
export declare function flushTurns(options: FlushTurnsOptions): Promise<SessionEndResult>;
export declare function saveHandoff(options: SaveHandoffOptions): Promise<SessionEndResult>;
export declare function endRemoteSession(options: EndRemoteSessionOptions): Promise<SessionEndResult>;
//# sourceMappingURL=session-end.d.ts.map