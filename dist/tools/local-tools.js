/**
 * Local tools — handled by the local MCP server.
 *
 * Most tools here are fully local (zero latency, zero network). Some, like
 * `resolve_project` and `objectives`, have special handling: they use local
 * state first and fall back (or pass through) to the remote server. These
 * tools must remain reachable via the local proxy even when GRAMATR_LOCAL_ONLY=1
 * (cloud addon active), because client hooks route through the local proxy.
 */
import { cache } from "../cache/lru-cache.js";
import { getLocalProjectByDirectory, getLocalProjectBySlug, getPacket, listLocalProjects, } from "../hooks/lib/hook-state.js";
import { VERSION } from "../hooks/lib/version.js";
import { getSessionId, getToolCallCount } from "../intelligence/session-manager.js";
import { getMetrics, resetMetrics } from "../metrics/collector.js";
import { callRemoteTool, fetchCurrentUser } from "../proxy/remote-client.js";
import { getTools } from "../proxy/tool-registry.js";
import { queueSize } from "../queue/offline-queue.js";
import { getServerUrl, getToken } from "../server/auth.js";
import { getWebToolDefinitions, handleWebTool, isWebTool } from "./web-tools.js";
import { getCurrentMode, setCurrentMode, PRIVILEGE_MODES, isValidMode, } from "../proxy/tool-privilege.js";
/**
 * Local tool definitions — these get merged into tools/list alongside remote tools.
 */
export function getLocalToolDefinitions() {
    return [
        {
            name: "local_status",
            description: "Show local MCP server status: cache stats, auth state, remote tool count, uptime, metrics summary.",
            inputSchema: { type: "object", properties: {} },
            annotations: { readOnlyHint: true },
        },
        {
            name: "local_clear_cache",
            description: "Clear the local LRU cache. Use after bulk mutations or when stale data is suspected.",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "local_config",
            description: "Show current local MCP server configuration: auth source, server URL, cache settings.",
            inputSchema: { type: "object", properties: {} },
            annotations: { readOnlyHint: true },
        },
        {
            name: "local_metrics",
            description: "Show per-tool call counts, latency distributions (p50/p95/p99), cache hit rate, errors.",
            inputSchema: {
                type: "object",
                properties: {
                    reset: {
                        type: "boolean",
                        description: "Reset metrics to zero after reading (default false).",
                    },
                },
            },
            annotations: { readOnlyHint: true },
        },
        {
            name: "resolve_project",
            description: "Resolve or list projects. Reads from local SQLite cache first; falls back to server for misses or search. Actions: list (recent projects), resolve (by slug or directory), search (text search — always remote).",
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["list", "resolve", "search"],
                        description: "list | resolve | search",
                    },
                    slug: { type: "string", description: "Project slug for resolve action." },
                    directory: { type: "string", description: "Absolute directory path for resolve action." },
                    query: { type: "string", description: "Search string for search action." },
                    limit: { type: "number", description: "Max results for list (default 20)." },
                },
                required: ["action"],
            },
        },
        {
            name: "local_fetch_packet",
            description: "Retrieve a cached intelligence packet by turn ID. Reads from local SQLite first; falls back to remote intelligence_packet entity on cache miss. Call this when the hook injects a turn_id instead of the full packet.",
            inputSchema: {
                type: "object",
                properties: {
                    id: { type: "string", description: "The turn_id injected by the UserPromptSubmit hook." },
                },
                required: ["id"],
            },
            annotations: { readOnlyHint: true },
        },
        // objectives is registered here so it is reachable via the local proxy even
        // when GRAMATR_LOCAL_ONLY=1 (cloud addon active). The call is always forwarded
        // to the remote server — there is no local implementation.
        {
            name: "objectives",
            description: "Manage long-range goals and life context — stored as vector-searchable observations across categories like mission, beliefs, strategies, and challenges. Use to set direction, track priorities, and give the AI persistent awareness of what matters most to you.",
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["update", "get", "list", "context", "delete"],
                        description: "Action: update (add entry), get (retrieve entries), list (categories with counts), context (compact summary for router), delete (remove an entry by observation_id)",
                    },
                    category: {
                        type: "string",
                        description: "Goal category — required for update, optional filter for get",
                    },
                    content: { type: "string", description: "Content text — required for update action." },
                    scope: {
                        type: "string",
                        enum: ["user", "project", "team", "org"],
                        description: "Scope for objectives — defaults to user.",
                    },
                    scope_id: { type: "string", description: "ID of the project, team, or org when scope is project/team/org." },
                    observation_id: { type: "string", description: "Observation ID — required for delete action." },
                },
                required: ["action"],
            },
        },
        {
            name: "local_set_mode",
            description: "Elevate or change the session's privilege mode, which controls which tools are exposed. " +
                "Modes (additive): user (default) → team → org → admin. " +
                "Session-scoped only — resets to default on server restart. " +
                "Provide a reason for audit observability.",
            inputSchema: {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        enum: PRIVILEGE_MODES,
                        description: "Target privilege mode: user | team | org | admin",
                    },
                    reason: {
                        type: "string",
                        description: "Reason for elevation (logged to stderr for observability).",
                    },
                },
                required: ["mode"],
            },
        },
        ...getWebToolDefinitions(),
    ];
}
const startTime = Date.now();
const LOCAL_TOOL_NAMES = new Set([
    "local_status",
    "local_clear_cache",
    "local_config",
    "local_metrics",
    "local_fetch_packet",
    "local_set_mode",
    "resolve_project",
    "objectives",
]);
/**
 * Check if a tool name is handled locally (fully or local-first).
 */
export function isLocalTool(name) {
    return name.startsWith("local_") || LOCAL_TOOL_NAMES.has(name);
}
/**
 * Handle a local tool call.
 */
export async function handleLocalTool(toolName, args) {
    // Web tools are async (network calls)
    if (isWebTool(toolName)) {
        return handleWebTool(toolName, args);
    }
    switch (toolName) {
        case "local_status":
            return handleStatus();
        case "local_clear_cache":
            return handleClearCache();
        case "local_config":
            return handleConfig();
        case "local_metrics":
            return handleMetrics(args);
        case "local_fetch_packet":
            return handleLocalFetchPacket(args);
        case "local_set_mode":
            return await handleSetMode(args);
        case "resolve_project":
            return handleResolveProject(args);
        case "objectives":
            return handleRemotePassthrough("objectives", args);
        default:
            return {
                content: [
                    { type: "text", text: JSON.stringify({ error: `Unknown local tool: ${toolName}` }) },
                ],
                isError: true,
            };
    }
}
function handleStatus() {
    const uptimeMs = Date.now() - startTime;
    const uptimeMin = Math.floor(uptimeMs / 60_000);
    const cacheStats = cache.stats();
    const remoteToolCount = getTools().length;
    const hasAuth = !!getToken();
    const sid = getSessionId();
    const metrics = getMetrics();
    const status = {
        server: {
            name: "gramatr-mcp",
            version: VERSION,
            uptime: uptimeMin < 60 ? `${uptimeMin}m` : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`,
            transport: "stdio",
        },
        session: {
            id: sid ? `${sid.substring(0, 8)}...` : null,
            tool_calls: getToolCallCount(),
        },
        auth: {
            authenticated: hasAuth,
            server_url: getServerUrl(),
        },
        tools: {
            remote: remoteToolCount,
            local: getLocalToolDefinitions().length,
            total: remoteToolCount + getLocalToolDefinitions().length,
        },
        cache: cacheStats,
        offline_queue: {
            pending: queueSize(),
        },
        metrics: {
            total_calls: metrics.total_calls,
            total_errors: metrics.total_errors,
            cache_hit_rate: metrics.cache.hit_rate,
        },
    };
    return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
    };
}
function handleClearCache() {
    const before = cache.stats().size;
    cache.clear();
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({ cleared: before, message: `Cleared ${before} cached entries.` }),
            },
        ],
    };
}
function handleConfig() {
    const hasToken = !!getToken();
    const config = {
        auth: {
            source: hasToken ? "~/.gramatr.json" : "none",
            has_token: hasToken,
        },
        remote: {
            server_url: getServerUrl(),
            endpoint: `${getServerUrl()}/mcp`,
        },
        cache: {
            max_size: cache.stats().maxSize,
            ttl_ms: cache.stats().ttlMs,
            current_size: cache.stats().size,
        },
        transport: "stdio",
    };
    return {
        content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
    };
}
function handleMetrics(args) {
    const snapshot = getMetrics();
    if (args.reset === true) {
        resetMetrics();
    }
    return {
        content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
    };
}
async function handleSetMode(args) {
    const requested = args.mode;
    if (!isValidMode(requested)) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        error: `Invalid mode: "${String(requested)}". Must be one of: ${PRIVILEGE_MODES.join(", ")}`,
                    }),
                },
            ],
            isError: true,
        };
    }
    // Gate elevation on high_admin role. (#1705)
    // fetchCurrentUser() returns null if the server is unreachable — reject in that case
    // too, to prevent blind elevation without a confirmed identity.
    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        error: "Cannot verify identity: server unreachable. Mode elevation requires a confirmed high_admin role.",
                    }),
                },
            ],
            isError: true,
        };
    }
    if (currentUser.actor_role !== "high_admin") {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        error: `Mode elevation requires system admin privileges. Your current role: ${currentUser.actor_role}.`,
                    }),
                },
            ],
            isError: true,
        };
    }
    const previous = getCurrentMode();
    setCurrentMode(requested);
    const reason = typeof args.reason === "string" && args.reason.trim()
        ? args.reason.trim()
        : "(no reason provided)";
    // Log to stderr for audit observability — session-scoped, not persisted.
    process.stderr.write(`[gramatr-mcp] privilege mode elevated: ${previous} → ${requested} — ${reason}\n`);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    previous_mode: previous,
                    current_mode: requested,
                    reason,
                    note: "Mode is session-scoped. It resets to default on server restart.",
                }),
            },
        ],
    };
}
async function handleResolveProject(args) {
    const action = args.action;
    // list — return all local projects, sorted by updated_at desc
    if (action === "list") {
        const limit = typeof args.limit === "number" ? args.limit : 20;
        try {
            const rows = listLocalProjects(limit);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ action: "list", projects: rows, source: "local", total: rows.length }, null, 2),
                    },
                ],
            };
        }
        catch {
            // DB unavailable — fall through to remote
        }
    }
    // resolve — try local first (slug, then directory), then remote on miss
    if (action === "resolve") {
        const slug = typeof args.slug === "string" ? args.slug : null;
        const directory = typeof args.directory === "string" ? args.directory : null;
        let local = slug ? getLocalProjectBySlug(slug) : null;
        if (!local && directory)
            local = getLocalProjectByDirectory(directory);
        if (local) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ action: "resolve", project: local, source: "local" }, null, 2),
                    },
                ],
            };
        }
        // Miss — fall through to remote below
    }
    // search always goes remote; resolve on local miss falls through here
    try {
        const result = await callRemoteTool("resolve_project", args);
        return result;
    }
    catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
                },
            ],
            isError: true,
        };
    }
}
async function handleLocalFetchPacket(args) {
    const id = typeof args.id === "string" ? args.id.trim() : null;
    if (!id) {
        return {
            content: [{ type: "text", text: JSON.stringify({ error: "id is required", found: false }) }],
            isError: true,
        };
    }
    // Local SQLite — primary path
    try {
        const record = getPacket(id);
        if (record) {
            let packet;
            try {
                packet = JSON.parse(record.payload);
            }
            catch {
                packet = record.payload;
            }
            return {
                content: [
                    { type: "text", text: JSON.stringify({ found: true, source: "local", packet }, null, 2) },
                ],
            };
        }
    }
    catch {
        // SQLite unavailable — fall through to remote
    }
    // Remote fallback — look up the intelligence_packet entity by ID
    try {
        const result = await callRemoteTool("get_entities", { ids: [id] });
        const raw = result;
        const text = raw.content?.[0]?.type === "text" ? raw.content[0].text : null;
        if (text) {
            let parsed;
            try {
                parsed = JSON.parse(text);
            }
            catch {
                parsed = text;
            }
            const entities = parsed?.entities;
            if (Array.isArray(entities) && entities.length > 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ found: true, source: "remote", packet: entities[0] }, null, 2),
                        },
                    ],
                };
            }
        }
    }
    catch {
        // Remote also unavailable
    }
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    found: false,
                    id,
                    message: "Packet not found in local SQLite or remote store. The turn may have expired or the ID is incorrect.",
                }),
            },
        ],
    };
}
/**
 * Forward a tool call directly to the remote server.
 *
 * Used for tools that must be reachable via the local proxy even when
 * GRAMATR_LOCAL_ONLY=1 is set (e.g. `objectives`). There is no local
 * implementation — every call is proxied to the remote MCP endpoint.
 */
async function handleRemotePassthrough(toolName, args) {
    try {
        const result = await callRemoteTool(toolName, args);
        return result;
    }
    catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=local-tools.js.map