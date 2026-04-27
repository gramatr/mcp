/**
 * grāmatr Local MCP Server
 *
 * A stdio-based MCP server that proxies all remote gramatr tools, prompts,
 * and resources with local auth injection, input validation, and LRU caching.
 *
 * Features:
 *   - Proxy all remote gramatr tools with auth injection
 *   - Proxy remote prompts (server-defined prompt templates)
 *   - Proxy remote resources
 *   - JSON Schema input validation (fail-fast on bad args)
 *   - LRU cache (100 entries, 60s TTL, mutation invalidation)
 *   - Auto session manager (session_start on first call, session_end on exit)
 *   - Packet 2 auto-fetch for gramatr_route_request
 *   - Offline queue with replay (mutations persist across restarts)
 *   - Local-only tools: status, config, clear_cache, metrics, web_fetch, web_search
 *   - In-process metrics: call counts, latency percentiles, cache hit rate
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { loadRemoteTools, getTools } from '../proxy/tool-registry.js';
import { loadRemotePrompts, getPrompts } from '../proxy/prompt-registry.js';
import { loadRemoteResources, getResources } from '../proxy/resource-registry.js';
import { proxyToolCall } from '../proxy/tool-proxy.js';
import { fetchRemotePrompt, fetchRemoteResource } from '../proxy/remote-client.js';
import { getToken } from './auth.js';
import { startHooksListener, stopHooksListener } from './hooks-listener.js';
import { getLocalToolDefinitions } from '../tools/local-tools.js';
import { replayQueue } from '../queue/replay.js';
import { queueSize } from '../queue/offline-queue.js';
import { VERSION } from '../hooks/lib/version.js';
const SERVER_NAME = 'gramatr-mcp';
/**
 * Create and configure the MCP server.
 */
export function createServer() {
    const server = new Server({ name: SERVER_NAME, version: VERSION }, { capabilities: { tools: {}, prompts: {}, resources: {} } });
    // ── tools/list handler — remote + local tools ──
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const remoteTools = getTools();
        const localTools = getLocalToolDefinitions();
        const allTools = [...remoteTools, ...localTools];
        return {
            tools: allTools.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
                annotations: t.annotations,
            })),
        };
    });
    // ── tools/call handler ──
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const result = await proxyToolCall(name, args || {});
        return result;
    });
    // ── prompts/list handler — proxied from remote ──
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        const prompts = getPrompts();
        return { prompts };
    });
    // ── prompts/get handler — proxied from remote ──
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name, arguments: promptArgs } = request.params;
        const result = await fetchRemotePrompt(name, promptArgs);
        return result;
    });
    // ── resources/list handler — proxied from remote ──
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        const resources = getResources();
        return { resources };
    });
    // ── resources/read handler — proxied from remote ──
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        const result = await fetchRemoteResource(uri);
        return result;
    });
    return server;
}
/**
 * Start the server: load tools, prompts, resources from remote, then listen on stdio.
 */
export async function startServer() {
    // Verify auth before starting
    const token = getToken();
    if (!token) {
        process.stderr.write('[gramatr-mcp] No auth token found. Run: gramatr-mcp login\n');
    }
    // Load remote tool definitions (hard gate).
    // If we cannot load the authoritative remote registry, do not start.
    // This prevents silent contract drift between remote-owned tools and local proxy exposure.
    const tools = await loadRemoteTools();
    if (tools.length === 0) {
        throw new TypeError('Remote MCP tools registry is empty. Refusing to start local proxy without authoritative tool list.');
    }
    const localCount = getLocalToolDefinitions().length;
    process.stderr.write(`[gramatr-mcp] Loaded ${tools.length} remote + ${localCount} local tools\n`);
    // Load remote prompts
    try {
        const prompts = await loadRemotePrompts();
        if (prompts.length > 0) {
            process.stderr.write(`[gramatr-mcp] Loaded ${prompts.length} remote prompts\n`);
        }
    }
    catch {
        // Non-critical — prompts are optional
    }
    // Load remote resources
    try {
        const resources = await loadRemoteResources();
        if (resources.length > 0) {
            process.stderr.write(`[gramatr-mcp] Loaded ${resources.length} remote resources\n`);
        }
    }
    catch {
        // Non-critical — resources are optional
    }
    // Replay any queued mutations from previous session
    const pending = queueSize();
    if (pending > 0) {
        process.stderr.write(`[gramatr-mcp] Found ${pending} queued call(s), replaying...\n`);
        void replayQueue();
    }
    // Create and start the MCP stdio server
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`[gramatr-mcp] Server started (stdio transport)\n`);
    // Start hooks IPC listener so hook subprocesses can route through this
    // process for auth, schema enforcement, and session context storage.
    try {
        const hooksPort = await startHooksListener();
        process.stderr.write(`[gramatr-mcp] Hooks listener on port ${hooksPort}\n`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[gramatr-mcp] Warning: hooks listener failed to start (${msg})\n`);
    }
    // Clean up port file on exit so stale hooks fall back to direct remote.
    process.on('exit', () => stopHooksListener());
    process.on('SIGTERM', () => { stopHooksListener(); process.exit(0); });
    process.on('SIGINT', () => { stopHooksListener(); process.exit(0); });
    // Exit when the parent process disconnects (stdin EOF). Claude Code closes
    // the pipe on disconnect without sending SIGTERM, which leaves orphaned MCP
    // processes accumulating across sessions. Listening for 'end' catches this.
    process.stdin.on('end', () => {
        process.stderr.write('[gramatr-mcp] stdin closed — parent disconnected, exiting\n');
        stopHooksListener();
        process.exit(0);
    });
    // Belt-and-suspenders: exit after 2 hours of inactivity regardless. Resets
    // on each incoming request via the idle timer below.
    const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
    let idleTimer = setTimeout(() => {
        process.stderr.write('[gramatr-mcp] idle timeout (2h) — exiting\n');
        stopHooksListener();
        process.exit(0);
    }, IDLE_TIMEOUT_MS);
    idleTimer.unref();
    process.stdin.on('data', () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            process.stderr.write('[gramatr-mcp] idle timeout (2h) — exiting\n');
            stopHooksListener();
            process.exit(0);
        }, IDLE_TIMEOUT_MS);
        idleTimer.unref();
    });
}
//# sourceMappingURL=server.js.map