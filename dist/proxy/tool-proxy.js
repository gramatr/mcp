/**
 * Tool Proxy — routes tool calls to local handlers, cache, or remote.
 *
 * Flow:
 *   1. Local tool? → handle locally (zero latency)
 *   2. Validate input against JSON Schema
 *   3. Ensure session is started (auto session_start)
 *   4. Cached? → return cached result
 *   5. Proxy to remote → post-process → cache result → return
 *   6. Mutation? → invalidate cache after success
 *   7. route_request? → auto-fetch Packet 2 if pending
 */
import Ajv from 'ajv';
import { callRemoteTool } from './remote-client.js';
const DEBUG = !!process.env.GRAMATR_DEBUG;
import { isRemoteTool, getToolSchema } from './tool-registry.js';
import { cache } from '../cache/lru-cache.js';
import { isLocalTool, handleLocalTool } from '../tools/local-tools.js';
import { ensureSession } from '../intelligence/session-manager.js';
import { hasPendingPacket2, fetchAndMergePacket2 } from '../intelligence/packet2-fetcher.js';
import { enqueue, isNetworkError } from '../queue/offline-queue.js';
import { replayQueue } from '../queue/replay.js';
import { recordCall, recordCacheHit, recordCacheMiss, } from '../metrics/collector.js';
const ajv = new Ajv({ allErrors: true, strict: false });
/**
 * Route a tool call: local → cache → remote.
 * Validates input, manages sessions, auto-fetches Packet 2.
 * Returns the MCP tool response format.
 */
export async function proxyToolCall(toolName, args) {
    const callStart = Date.now();
    if (DEBUG) {
        process.stderr.write(`[gramatr-debug] proxyToolCall: ${toolName} args=${JSON.stringify(args).slice(0, 300)}\n`);
    }
    // ── Local tools: handle in-process ──
    if (isLocalTool(toolName)) {
        if (DEBUG)
            process.stderr.write(`[gramatr-debug] → local handler\n`);
        const result = await handleLocalTool(toolName, args);
        recordCall(toolName, Date.now() - callStart, result.isError);
        return result;
    }
    if (!isRemoteTool(toolName)) {
        recordCall(toolName, Date.now() - callStart, true);
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
            isError: true,
        };
    }
    // ── Validate input against the tool's JSON Schema ──
    const schema = getToolSchema(toolName);
    if (schema) {
        const validate = ajv.compile(schema);
        if (!validate(args)) {
            const errors = validate.errors
                ?.map((e) => `${e.instancePath || '/'}: ${e.message}`)
                .join('; ');
            recordCall(toolName, Date.now() - callStart, true);
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: `Invalid input: ${errors}` }) }],
                isError: true,
            };
        }
    }
    // ── Auto session start on first remote call ──
    await ensureSession();
    // ── Cache check for read-only tools ──
    if (cache.isCacheable(toolName)) {
        const cached = cache.get(toolName, args);
        if (cached) {
            if (DEBUG)
                process.stderr.write(`[gramatr-debug] → cache HIT\n`);
            recordCacheHit();
            recordCall(toolName, Date.now() - callStart, false);
            return cached;
        }
        if (DEBUG)
            process.stderr.write(`[gramatr-debug] → cache MISS, proxying to remote\n`);
        recordCacheMiss();
    }
    else if (DEBUG) {
        process.stderr.write(`[gramatr-debug] → not cacheable (mutation?), proxying to remote\n`);
    }
    try {
        const result = (await callRemoteTool(toolName, args));
        if (DEBUG)
            process.stderr.write(`[gramatr-debug] ← remote responded in ${Date.now() - callStart}ms\n`);
        // Network recovered — drain any queued mutations in the background
        void replayQueue();
        // Normalize result to MCP format
        let normalized = result && Array.isArray(result.content)
            ? result
            : { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        // ── Packet 2 auto-fetch for route_request ──
        if (toolName === 'gramatr_route_request' && !normalized.isError) {
            const { pending, enrichmentId } = hasPendingPacket2(normalized);
            if (pending && enrichmentId) {
                normalized = await fetchAndMergePacket2(normalized, enrichmentId);
            }
        }
        // ── Cache store for successful read-only calls ──
        if (!normalized.isError && cache.isCacheable(toolName)) {
            cache.set(toolName, args, normalized);
        }
        // ── Invalidate cache on mutations ──
        if (cache.isMutation(toolName)) {
            cache.clear();
        }
        recordCall(toolName, Date.now() - callStart, normalized.isError);
        return normalized;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // ── Offline queue: persist mutation calls on network failure ──
        if (isNetworkError(error) && cache.isMutation(toolName)) {
            enqueue(toolName, args);
            recordCall(toolName, Date.now() - callStart, false);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            queued: true,
                            tool: toolName,
                            message: `Network unavailable — queued for retry. Error: ${message}`,
                        }),
                    },
                ],
            };
        }
        recordCall(toolName, Date.now() - callStart, true);
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
        };
    }
}
//# sourceMappingURL=tool-proxy.js.map