import type { RouteResponse } from "./types.js";
export type RouterFailure = {
    reason: "auth" | "auth_expired" | "timeout" | "server_down" | "server_error" | "parse_error" | "unknown";
    detail: string;
};
export declare function formatFailureWarning(failure: RouterFailure): string;
export declare function mergeEnrichmentIntoRoute(route: RouteResponse, enrichment: Record<string, unknown> | null): void;
/**
 * Lean v2 packet shape returned to the agent (#2658). The server emits the
 * full unified packet; the hook reduces it to the agent-actionable subset:
 * required_actions near the top, suggested_agents inline (top 3), and NO
 * inline reverse_engineering / quality_gate_criteria / composed_agent
 * payloads. Those are fetched on demand via dedicated tools.
 */
interface LeanRequiredAction {
    phase?: string | null;
    call?: string | null;
    args?: Record<string, unknown> | null;
    optional?: boolean;
}
interface LeanSuggestedAgent {
    agent_id?: string | null;
    name?: string | null;
    short_description?: string | null;
    match_score?: number | null;
}
interface LeanInjection {
    schema: string;
    manifest: {
        ref_id: string | null;
        session_id: string | null;
        enrichment_status: string | null;
    };
    classification: {
        effort_level: string | null;
        intent_type: string | null;
        confidence: number | null;
        memory_tier: string | null;
    };
    phase_template: string[];
    required_actions: LeanRequiredAction[];
    suggested_agents: LeanSuggestedAgent[];
    hard_gates: string[];
    behavioral_rules: string[];
    memory_context: Record<string, unknown> | null;
}
/**
 * Build the lean injection payload from a v2 packet. Returns null if the
 * packet has no classification section (degraded mode handled elsewhere).
 */
export declare function buildLeanInjection(data: RouteResponse): LeanInjection | null;
/**
 * Render the lean injection as a `<gramatr-classification>` block. Returns
 * the wrapped string plus the byte size for telemetry.
 */
export declare function renderLeanInjection(injection: LeanInjection): {
    text: string;
    bytes: number;
};
export declare function formatIntelligence(data: RouteResponse, enrichment?: Record<string, unknown> | null, turnId?: string | null): string;
export declare function emitStatus(data: RouteResponse | null, elapsed: number, lastFailure: RouterFailure | null): void;
export {};
//# sourceMappingURL=intelligence.d.ts.map