/**
 * local-client.ts — Hook-side client for gramatr tool calls.
 *
 * Hooks call gramatr tools directly through the remote API via callRemoteTool.
 * The compiled binary owns auth resolution — no port-based local HTTP server needed.
 *
 * Session context (project_id, interaction_id) is managed locally via SQLite
 * in hook-state.ts. pushSessionContextToLocal / pullSessionContextFromLocal
 * are retained as no-ops for call-site compatibility while the port IPC is removed.
 */
/** Always false — port-based local server is no longer used. */
export declare function isLocalHooksServerAvailable(): boolean;
/**
 * Call a gramatr tool via the remote API.
 * Auth is resolved by the compiled binary's auth module.
 */
export declare function callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
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