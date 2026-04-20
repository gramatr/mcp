/**
 * local-client.ts — Hook-side MCP client.
 *
 * Spawns `npx -y @gramatr/mcp` via the MCP stdio transport so hooks call
 * gramatr tools through the same server that Claude Code uses. Auth and
 * session state are handled by that server process (reads from
 * ~/.gramatr/settings.json). No direct HTTP calls or in-process proxy.
 *
 * Connection is lazy-initialized on first callTool and reused for the
 * lifetime of the hook process. Falls back to an error result (never
 * throws) so hooks always degrade gracefully when the server is unavailable.
 *
 * pushSessionContextToLocal / pullSessionContextFromLocal are retained as
 * no-ops for call-site compatibility.
 */
import type { ToolCallResult } from './tool-proxy.js';
export type { ToolCallResult };
/** Reset singleton for testing. Not for production use. */
export declare function _resetClientForTest(): void;
/** Always true — the stdio server is available on demand via npx. */
export declare function isLocalHooksServerAvailable(): boolean;
/**
 * Call a gramatr tool via the local MCP stdio server.
 * Never throws — returns an isError result on failure so hooks degrade gracefully.
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