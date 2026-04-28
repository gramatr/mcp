/**
 * Offline Queue — persists failed mutation calls to disk and replays them
 * when the network is back.
 *
 * Only mutations are queued (reads are idempotent and can be retried live).
 * Queue survives process restarts.
 *
 * Storage: ~/.gramatr/mcp-queue.jsonl (append-only JSONL)
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
// gramatr-allow: C1 — MCP package is standalone config reader
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const QUEUE_PATH = join(HOME, '.gramatr', 'mcp-queue.jsonl');
/** Ensure the queue directory exists. */
function ensureQueueDir() {
    const dir = dirname(QUEUE_PATH);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
/**
 * Append a failed mutation call to the offline queue.
 */
export function enqueue(tool, args) {
    ensureQueueDir();
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        tool,
        args,
        timestamp: Date.now(),
        attempts: 0,
    };
    appendFileSync(QUEUE_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}
/**
 * Read all queued calls from disk.
 */
export function readQueue() {
    if (!existsSync(QUEUE_PATH))
        return [];
    try {
        const raw = readFileSync(QUEUE_PATH, 'utf8');
        return raw
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line));
    }
    catch {
        return [];
    }
}
/**
 * Replace the queue with a new set of entries (used after replay).
 */
export function rewriteQueue(entries) {
    ensureQueueDir();
    if (entries.length === 0) {
        if (existsSync(QUEUE_PATH)) {
            unlinkSync(QUEUE_PATH);
        }
        return;
    }
    const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    writeFileSync(QUEUE_PATH, content, 'utf8');
}
/**
 * Clear the entire queue.
 */
export function clearQueue() {
    if (existsSync(QUEUE_PATH)) {
        unlinkSync(QUEUE_PATH);
    }
}
/**
 * Get queue size (for status reporting).
 */
export function queueSize() {
    return readQueue().length;
}
/**
 * Check if an error is a network/transport error (retry-worthy).
 */
export function isNetworkError(error) {
    if (!(error instanceof Error))
        return false;
    const msg = error.message.toLowerCase();
    return (msg.includes('econnrefused') ||
        msg.includes('enotfound') ||
        msg.includes('timeout') ||
        msg.includes('network') ||
        msg.includes('fetch failed') ||
        msg.includes('getaddrinfo'));
}
//# sourceMappingURL=offline-queue.js.map