/**
 * local-client.ts — Hook-side client for gramatr tool calls.
 *
 * Hooks call gramatr tools through the proxyToolCall pipeline, which provides
 * validation, session management, caching, offline queue, and the
 * gmtr.tool.result.v1 envelope. The compiled binary IS the local MCP server —
 * all tools look local to the consumer.
 *
 * Session context (project_id, interaction_id) is managed locally via SQLite
 * in hook-state.ts. pushSessionContextToLocal / pullSessionContextFromLocal
 * are retained as no-ops for call-site compatibility while the port IPC is removed.
 */
import { type ToolCallResult } from './tool-proxy.js';
/** Always true — the proxy pipeline is available in-process. */
export declare function isLocalHooksServerAvailable(): boolean;
/**
 * Call a gramatr tool through the proxy pipeline.
 *
 * Lazy-loads the tool registry on first call. If the registry fails to load
 * (offline/unavailable) and proxyToolCall returns an "Unknown tool" error,
 * falls back to callRemoteTool directly to preserve current behavior.
 */
export declare function callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
/**
 * No-op — session context is persisted to SQLite via setSessionContext in hook-state.ts.
 * Retained for call-site compatibility.
 */
export declare function pushSessionContextToLocal(_ctx: unknown): Promise<boolean>;
/**
 * No-op — callers fall through to remote REST hydration via hydrateSessionContextFromServer.
 * Retained for call-site compatibility.
 */
export declare function pullSessionContextFromLocal(_sessionId: string): Promise<Record<string, unknown> | null>;
//# sourceMappingURL=local-client.d.ts.map