/**
 * agent-gate.ts — PreToolUse hook for the Agent tool.
 *
 * Denies Agent launches when no fresh gramatr_route_request classification
 * exists in the local SQLite state DB. "Fresh" means recorded within the
 * last 60 seconds. This ensures the calling agent has routed its task
 * through gramatr intelligence before spawning sub-agents.
 */
export declare function checkClassificationFreshness(sessionId: string, nowMs?: number): {
    allow: boolean;
    reason?: string;
};
export declare function runAgentGateHook(_args?: string[]): Promise<number>;
//# sourceMappingURL=agent-gate.d.ts.map