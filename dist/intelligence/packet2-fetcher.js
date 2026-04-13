/**
 * Packet 2 Auto-Fetcher — automatically fetches enrichment when route_request
 * returns packet_2_status: "required".
 *
 * Flow:
 *   1. Agent calls gramatr_route_request
 *   2. Server returns Packet 1 immediately with enrichment_id
 *   3. This module detects required status, calls gramatr_get_enrichment
 *   4. Merges Packet 2 into the response before returning to agent
 *
 * The agent never has to manually call gramatr_get_enrichment — it just works.
 */
import { callRemoteTool } from '../proxy/remote-client.js';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;
/**
 * Check if a tool result is a route_request response with required Packet 2.
 */
export function hasPendingPacket2(result) {
    if (!result.content?.[0]?.text)
        return { pending: false };
    try {
        const data = JSON.parse(result.content[0].text);
        if (data.packet_2_status === 'required' && data.enrichment_id) {
            return { pending: true, enrichmentId: data.enrichment_id };
        }
    }
    catch {
        // Not JSON or not the expected shape
    }
    return { pending: false };
}
/**
 * Fetch Packet 2 enrichment and merge into the original response.
 * Retries up to 3 times with 500ms delay (enrichment may still be generating).
 */
export async function fetchAndMergePacket2(result, enrichmentId) {
    let enrichment = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            enrichment = await callRemoteTool('gramatr_get_enrichment', {
                enrichment_id: enrichmentId,
            });
            // Check if enrichment is ready
            const enrichResult = enrichment;
            if (enrichResult?.content?.[0]?.text) {
                const enrichData = JSON.parse(enrichResult.content[0].text);
                if (enrichData.status !== 'pending') {
                    // Enrichment is ready — merge it
                    return mergePackets(result, enrichResult);
                }
            }
        }
        catch {
            // Enrichment call failed — continue with retries
        }
        // Wait before retrying
        if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
    // Enrichment not ready after retries — return original Packet 1 as-is and
    // leave the required status intact so the caller can keep polling.
    process.stderr.write(`[gramatr-mcp] Packet 2 still required after ${MAX_RETRIES} retries; returning Packet 1 and preserving required status\n`);
    return result;
}
/**
 * Merge Packet 2 enrichment into the Packet 1 response.
 * Adds enrichment data under a `packet_2` key in the response.
 */
function mergePackets(packet1, packet2) {
    try {
        const p1Data = JSON.parse(packet1.content[0].text);
        const p2Data = JSON.parse(packet2.content[0].text);
        // Merge Packet 2 into Packet 1
        p1Data.packet_2 = p2Data.packet_2 || p2Data;
        p1Data.packet_2_status = 'merged';
        return {
            content: [{ type: 'text', text: JSON.stringify(p1Data) }],
        };
    }
    catch {
        // If merge fails, return Packet 1 unchanged
        return packet1;
    }
}
//# sourceMappingURL=packet2-fetcher.js.map