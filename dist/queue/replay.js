/**
 * Queue Replay — drains the offline queue by replaying mutations in order.
 *
 * Called on:
 *   1. Server startup (catch up on anything queued from last session)
 *   2. First successful remote call after a network failure
 *
 * Max 3 attempts per entry. Drops entries that keep failing.
 */
import { readQueue, rewriteQueue, isNetworkError } from './offline-queue.js';
import { callRemoteTool } from '../proxy/remote-client.js';
const MAX_ATTEMPTS = 3;
let replayInProgress = false;
/**
 * Replay all queued calls. Idempotent — safe to call multiple times.
 * Returns counts of replayed and dropped entries.
 */
export async function replayQueue() {
    if (replayInProgress)
        return { replayed: 0, dropped: 0, remaining: 0 };
    replayInProgress = true;
    try {
        const entries = readQueue();
        if (entries.length === 0) {
            return { replayed: 0, dropped: 0, remaining: 0 };
        }
        process.stderr.write(`[gramatr-mcp] Replaying ${entries.length} queued call(s)...\n`);
        let replayed = 0;
        let dropped = 0;
        const remaining = [];
        for (const entry of entries) {
            try {
                await callRemoteTool(entry.tool, entry.args);
                replayed++;
            }
            catch (error) {
                if (isNetworkError(error)) {
                    // Network still down — keep this entry and all subsequent
                    remaining.push({ ...entry, attempts: entry.attempts + 1 });
                }
                else if (entry.attempts + 1 >= MAX_ATTEMPTS) {
                    // Permanent failure — drop
                    dropped++;
                    process.stderr.write(`[gramatr-mcp] Dropped ${entry.tool} after ${MAX_ATTEMPTS} attempts\n`);
                }
                else {
                    // Transient failure — keep for retry
                    remaining.push({ ...entry, attempts: entry.attempts + 1 });
                }
            }
        }
        rewriteQueue(remaining);
        process.stderr.write(`[gramatr-mcp] Replay complete: ${replayed} sent, ${dropped} dropped, ${remaining.length} remaining\n`);
        return { replayed, dropped, remaining: remaining.length };
    }
    finally {
        replayInProgress = false;
    }
}
//# sourceMappingURL=replay.js.map