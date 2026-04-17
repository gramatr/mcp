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
import { proxyToolCall } from './tool-proxy.js';
import { loadRemoteTools } from './tool-registry.js';
import { callRemoteTool } from './remote-client.js';
let registryLoaded = false;
/** Always true — the proxy pipeline is available in-process. */
export function isLocalHooksServerAvailable() {
    return true;
}
/**
 * Call a gramatr tool through the proxy pipeline.
 *
 * Lazy-loads the tool registry on first call. If the registry fails to load
 * (offline/unavailable) and proxyToolCall returns an "Unknown tool" error,
 * falls back to callRemoteTool directly to preserve current behavior.
 */
export async function callTool(name, args) {
    // Lazy-init: load tool registry on first call
    if (!registryLoaded) {
        try {
            await loadRemoteTools();
            registryLoaded = true;
        }
        catch {
            // Registry unavailable (offline?) — fall through to proxyToolCall
            // which will handle unknown tools gracefully
        }
    }
    const result = await proxyToolCall(name, args);
    // Safety net: if registry never loaded and proxy rejected as unknown tool,
    // fall back to direct remote call to preserve current behavior
    if (!registryLoaded && result.isError) {
        const text = result.content?.[0]?.text ?? '';
        if (text.includes('Unknown tool')) {
            return (await callRemoteTool(name, args));
        }
    }
    return result;
}
/**
 * No-op — session context is persisted to SQLite via setSessionContext in hook-state.ts.
 * Retained for call-site compatibility.
 */
export async function pushSessionContextToLocal(_ctx) {
    return false;
}
/**
 * No-op — callers fall through to remote REST hydration via hydrateSessionContextFromServer.
 * Retained for call-site compatibility.
 */
export async function pullSessionContextFromLocal(_sessionId) {
    return null;
}
//# sourceMappingURL=local-client.js.map