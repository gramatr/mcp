/**
 * local-client.ts — Hook-side daemon IPC client.
 *
 * Sprint 1: replaces the previous "spawn npx @gramatr/mcp via StdioClientTransport"
 * model. Tool calls now go through the persistent daemon over a Unix socket (~1ms)
 * instead of spawning a new process (~200-700ms).
 *
 * Call path:
 *   callTool(name, args)
 *     → callViaDaemon()    [try first, 8ms connect timeout]
 *     → callRemoteTool()   [fallback if daemon unavailable]
 *
 * Connection-per-call pattern is correct here — hooks are short-lived processes
 * and don't benefit from connection pooling.
 */
import { type DaemonUnavailable } from '../daemon/ipc-protocol.js';
import type { ToolCallResult } from './tool-proxy.js';
export type { ToolCallResult };
/**
 * Send a JSON-RPC request to the daemon over the Unix socket.
 * Returns DAEMON_UNAVAILABLE if the socket is unreachable or the call fails.
 */
export declare function callViaDaemon(method: string, params: Record<string, unknown>): Promise<unknown | DaemonUnavailable>;
/**
 * Returns true if the daemon socket file exists.
 * Does NOT guarantee the daemon process is alive — use isDaemonRunning() for that.
 */
export declare function isLocalHooksServerAvailable(): boolean;
/**
 * Call a gramatr tool via the daemon (Tier 1 socket → Tier 2 HTTP → Tier 3 remote).
 * Never throws — returns an isError result on failure so hooks degrade gracefully.
 *
 * Pass hookSessionId (from readHookInput().session_id) so the daemon can look up
 * the gramatr interaction_id and project_id for the Mcp-Session-Id header.
 */
export declare function callTool(name: string, args: Record<string, unknown>, hookSessionId?: string): Promise<ToolCallResult>;
/**
 * Push session context to the daemon's in-memory store so other hooks in the
 * same session can retrieve it without hitting the DB.
 * Returns false if the daemon is unavailable (non-fatal).
 */
export declare function pushSessionContextToLocal(ctx: unknown): Promise<boolean>;
/**
 * Pull session context from the daemon's in-memory store.
 * Returns null if the daemon is unavailable or has no context for this session.
 */
export declare function pullSessionContextFromLocal(sessionId: string): Promise<Record<string, unknown> | null>;
/**
 * Store a composed agent definition in the daemon's RAM-only TEMP TABLE.
 * Falls back to a remote REST call when the daemon is unavailable.
 * Returns the uuid on success, null on failure.
 */
export declare function storeComposedAgent(uuid: string, ownerId: string, name: string, definition: Record<string, unknown>, expiresAt?: string): Promise<string | null>;
/**
 * Retrieve a composed agent definition.
 * Tier 1: daemon TEMP TABLE (RAM, sub-ms).
 * Tier 3: remote REST GET /api/v1/agents/composed/{uuid} (Redis, ~15ms).
 * Returns null if not found or expired.
 */
export declare function getComposedAgent(uuid: string): Promise<Record<string, unknown> | null>;
/**
 * List composed agents for a user from the daemon's TEMP TABLE.
 * Returns an empty array if the daemon is unavailable.
 */
export declare function listComposedAgents(ownerId: string): Promise<Array<Record<string, unknown>>>;
/**
 * Sweep expired composed-agent entries from the daemon's TEMP TABLE.
 * Best-effort — silently no-ops when the daemon is unavailable.
 */
export declare function sweepExpiredAgents(): Promise<void>;
/** Reset module-level request ID counter for testing. Not for production use. */
export declare function _resetClientForTest(): void;
//# sourceMappingURL=local-client.d.ts.map