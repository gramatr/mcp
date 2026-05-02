/**
 * packet-debug-log.ts — Rolling debug log of raw gramatr packets.
 *
 * Writes one JSONL entry per UserPromptSubmit hook invocation to
 * ~/.gramatr/debug/packets.jsonl, keeping the last MAX_ENTRIES lines.
 * Also overwrites ~/.gramatr/debug/last-packet.json for quick inspection.
 *
 * Each entry captures: timestamp, project_id, session_id, client_type,
 * agent_name, downstream_model, status, elapsed_ms, and the full raw
 * packet (or error) from the backend.
 *
 * All I/O is synchronous and wrapped — a failure here must never surface
 * to the hook caller.
 */
export interface PacketDebugEntry {
    ts: string;
    project_id: string | null;
    session_id: string;
    client_type: string;
    agent_name: string;
    downstream_model: string;
    status: 'ok' | 'error' | 'timeout' | 'skipped';
    elapsed_ms: number;
    packet: unknown;
    error: {
        reason: string;
        detail: string;
    } | null;
}
export declare function appendPacketDebugLog(entry: PacketDebugEntry): void;
//# sourceMappingURL=packet-debug-log.d.ts.map