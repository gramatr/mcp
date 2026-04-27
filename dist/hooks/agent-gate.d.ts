/**
 * agent-gate.ts — PreToolUse hook for the Agent tool.
 *
 * Emits a strong suggestion when no fresh gramatr_route_request classification
 * exists in the local SQLite state DB. "Fresh" means recorded within the last
 * 30 minutes. This ensures the calling agent has considered routing its task
 * through gramatr intelligence before spawning sub-agents.
 *
 * Behaviour:
 * - Fresh SQLite record        → allow silently
 * - No SQLite record + fresh last-packet.json → allow silently
 *   (UserPromptSubmit hook already delivered intelligence context this turn)
 * - No record / stale record   → allow with strong warning (NOT a hard block)
 */
/**
 * @param sessionId     - interaction/session ID to look up in SQLite
 * @param nowMs         - current time (injectable for tests)
 * @param packetAgeMs   - age of last-packet.json in ms (injectable for tests; omit to read from fs)
 */
export declare function checkClassificationFreshness(sessionId: string, nowMs?: number, packetAgeMs?: number): {
    allow: boolean;
    reason?: string;
};
export declare function runAgentGateHook(_args?: string[]): Promise<number>;
//# sourceMappingURL=agent-gate.d.ts.map