/**
 * Offline Queue — persists failed mutation calls to disk and replays them
 * when the network is back.
 *
 * Only mutations are queued (reads are idempotent and can be retried live).
 * Queue survives process restarts.
 *
 * Storage: ~/.gramatr/mcp-queue.jsonl (append-only JSONL)
 */
export interface QueuedCall {
    id: string;
    tool: string;
    args: Record<string, unknown>;
    timestamp: number;
    attempts: number;
}
/**
 * Append a failed mutation call to the offline queue.
 */
export declare function enqueue(tool: string, args: Record<string, unknown>): void;
/**
 * Read all queued calls from disk.
 */
export declare function readQueue(): QueuedCall[];
/**
 * Replace the queue with a new set of entries (used after replay).
 */
export declare function rewriteQueue(entries: QueuedCall[]): void;
/**
 * Clear the entire queue.
 */
export declare function clearQueue(): void;
/**
 * Get queue size (for status reporting).
 */
export declare function queueSize(): number;
/**
 * Check if an error is a network/transport error (retry-worthy).
 */
export declare function isNetworkError(error: unknown): boolean;
//# sourceMappingURL=offline-queue.d.ts.map