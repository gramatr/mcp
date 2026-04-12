/**
 * Packet 2 Auto-Fetcher — automatically fetches enrichment when route_request
 * returns packet_2_status: "pending".
 *
 * Flow:
 *   1. Agent calls gramatr_route_request
 *   2. Server returns Packet 1 immediately with enrichment_id
 *   3. This module detects pending status, calls gramatr_get_enrichment
 *   4. Merges Packet 2 into the response before returning to agent
 *
 * The agent never has to manually call gramatr_get_enrichment — it just works.
 */
interface ToolCallResult {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Check if a tool result is a route_request response with pending Packet 2.
 */
export declare function hasPendingPacket2(result: ToolCallResult): {
    pending: boolean;
    enrichmentId?: string;
};
/**
 * Fetch Packet 2 enrichment and merge into the original response.
 * Retries up to 3 times with 500ms delay (enrichment may still be generating).
 */
export declare function fetchAndMergePacket2(result: ToolCallResult, enrichmentId: string): Promise<ToolCallResult>;
export {};
//# sourceMappingURL=packet2-fetcher.d.ts.map