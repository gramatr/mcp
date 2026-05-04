/**
 * subagent-route.ts — SubagentStart hook.
 *
 * Fires immediately before a sub-agent is launched. Checks that a fresh
 * route_request classification exists in local SQLite state (same
 * freshness rule as agent-gate), and — when fresh — writes a reminder to
 * stderr that the calling agent must pass the Quality Gate scaffold from
 * `enrichment.data.reasoning.isc_scaffold` to the sub-agent.
 *
 * Output contract for SubagentStart:
 *   { "continue": true }                            — allow launch
 *   { "continue": false, "stopReason": "message" }  — block launch
 *
 * Graceful degradation: any internal error produces `{ continue: true }`
 * so a hook failure never blocks the sub-agent from launching.
 */
export declare function checkSubagentClassificationFreshness(sessionId: string, nowMs?: number): {
    allow: boolean;
    reason?: string;
};
export declare function runSubagentRouteHook(_args?: string[]): Promise<number>;
//# sourceMappingURL=subagent-route.d.ts.map