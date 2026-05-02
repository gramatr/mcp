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
import { getSessionId, getProjectId } from '../intelligence/session-manager.js';
const DEBUG = !!process.env.GRAMATR_DEBUG;
import { isRemoteTool, getToolSchema } from './tool-registry.js';
import { cache } from '../cache/lru-cache.js';
import { isLocalTool, handleLocalTool } from '../tools/local-tools.js';
import { ensureSession } from '../intelligence/session-manager.js';
import { enqueue, isNetworkError } from '../queue/offline-queue.js';
import { replayQueue } from '../queue/replay.js';
import { recordCall, recordCacheHit, recordCacheMiss, } from '../metrics/collector.js';
const ajv = new Ajv({ allErrors: true, strict: false });
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
function unwrapExistingEnvelope(payload) {
    if (!payload || typeof payload !== 'object')
        return undefined;
    const obj = payload;
    if (obj.schema === 'gmtr.tool.result.v1')
        return obj;
    return undefined;
}
function extractPrimaryPayload(result) {
    const first = result.content?.find((item) => item?.type === 'text' && typeof item.text === 'string');
    if (!first)
        return {};
    const parsed = parseJson(first.text);
    return { parsed, rawText: first.text };
}
function wrapToolResult(toolName, result, source, args) {
    const extracted = extractPrimaryPayload(result);
    const existing = extracted.parsed ? unwrapExistingEnvelope(extracted.parsed) : undefined;
    if (existing)
        return result;
    const envelope = {
        schema: 'gmtr.tool.result.v1',
        tool: toolName,
        ok: !result.isError,
        source,
        data: extracted.parsed ?? null,
        text: extracted.parsed === undefined ? extracted.rawText ?? null : null,
        error: result.isError ? (extracted.parsed ?? extracted.rawText ?? 'unknown tool error') : null,
        meta: {
            content_items: result.content?.length || 0,
            args,
        },
    };
    return {
        content: [{ type: 'text', text: JSON.stringify(envelope) }],
        isError: result.isError,
    };
}
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
        return wrapToolResult(toolName, result, 'local', args);
    }
    if (!isRemoteTool(toolName)) {
        recordCall(toolName, Date.now() - callStart, true);
        return wrapToolResult(toolName, {
            content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
            isError: true,
        }, 'proxy', args);
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
            return wrapToolResult(toolName, {
                content: [{ type: 'text', text: JSON.stringify({ error: `Invalid input: ${errors}` }) }],
                isError: true,
            }, 'validation', args);
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
            return wrapToolResult(toolName, cached, 'cache', args);
        }
        if (DEBUG)
            process.stderr.write(`[gramatr-debug] → cache MISS, proxying to remote\n`);
        recordCacheMiss();
    }
    else if (DEBUG) {
        process.stderr.write(`[gramatr-debug] → not cacheable (mutation?), proxying to remote\n`);
    }
    try {
        const result = (await callRemoteTool(toolName, args, {
            sessionId: getSessionId(),
            projectId: getProjectId(),
        }));
        if (DEBUG)
            process.stderr.write(`[gramatr-debug] ← remote responded in ${Date.now() - callStart}ms\n`);
        // Network recovered — drain any queued mutations in the background
        void replayQueue();
        // Normalize result to MCP format
        let normalized = result && Array.isArray(result.content)
            ? result
            : { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        // ── Cache store for successful read-only calls ──
        if (!normalized.isError && cache.isCacheable(toolName)) {
            cache.set(toolName, args, normalized);
        }
        // ── Invalidate cache on mutations ──
        if (cache.isMutation(toolName)) {
            cache.clear();
        }
        recordCall(toolName, Date.now() - callStart, normalized.isError);
        return wrapToolResult(toolName, normalized, 'remote', args);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // ── Offline queue: persist mutation calls on network failure ──
        if (isNetworkError(error) && cache.isMutation(toolName)) {
            enqueue(toolName, args);
            recordCall(toolName, Date.now() - callStart, false);
            return wrapToolResult(toolName, {
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
            }, 'queue', args);
        }
        recordCall(toolName, Date.now() - callStart, true);
        return wrapToolResult(toolName, {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
        }, 'proxy', args);
    }
}
//# sourceMappingURL=tool-proxy.js.map