import type { RouteResponse } from './types.js';
export type RouterFailure = {
    reason: 'auth' | 'timeout' | 'server_down' | 'server_error' | 'parse_error' | 'unknown';
    detail: string;
};
export declare function formatFailureWarning(failure: RouterFailure): string;
export declare function mergeEnrichmentIntoRoute(route: RouteResponse, enrichment: Record<string, unknown> | null): void;
/**
 * Save the full packet to SQLite + a JSON sidecar keyed by interaction_id.
 * Also writes last-packet.json as a convenience alias.
 * Returns the sidecar path so the injection can reference it.
 */
export declare function savePacketFull(packet: Record<string, unknown>, interactionId: string, sessionId: string, projectId: string | null, effort: string | null, intent: string | null): string;
export declare function formatIntelligence(data: RouteResponse, enrichment?: Record<string, unknown> | null): string;
export declare function emitStatus(data: RouteResponse | null, elapsed: number, lastFailure: RouterFailure | null): void;
//# sourceMappingURL=intelligence.d.ts.map