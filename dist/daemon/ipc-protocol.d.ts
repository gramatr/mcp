/**
 * ipc-protocol.ts — Types for the gramatr daemon IPC protocol.
 *
 * Newline-delimited JSON-RPC 2.0 over a Unix domain socket.
 * One JSON object per line; no framing beyond the newline terminator.
 *
 * This file is types-only — no runtime code.
 */
export interface DaemonRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: DaemonMethod;
    params: Record<string, unknown>;
}
export interface DaemonResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export type DaemonMethod = 'tool/call' | 'session/register' | 'session/release' | 'session/context/get' | 'session/context/set' | 'project/resolve' | 'project/cache-set' | 'db/query' | 'agent/store' | 'agent/get' | 'agent/list' | 'agent/expire' | 'daemon/ping' | 'daemon/shutdown';
/**
 * Parameters for the db/query IPC method.
 *
 * Forwards the three most-called read operations to the daemon's owned
 * SQLite connection. Hook processes check for the daemon.active sentinel
 * file before routing through IPC (Sprint 3 will wire the async call path).
 */
export interface DbQueryParams {
    operation: 'getSessionContext' | 'getLastSessionForProject' | 'getLocalProjectByDirectory';
    args: Record<string, unknown>;
}
export declare const DAEMON_UNAVAILABLE: unique symbol;
export type DaemonUnavailable = typeof DAEMON_UNAVAILABLE;
/** Parameters for the `project/resolve` IPC method. */
export interface ProjectResolveParams {
    git_remote?: string;
    directory?: string;
    slug?: string;
}
/** Response shape for a successful `project/resolve` hit. */
export interface ProjectResolveHit {
    found: true;
    project_id: string;
    slug: string;
}
/** Response shape for a `project/resolve` miss. */
export interface ProjectResolveMiss {
    found: false;
}
export type ProjectResolveResult = ProjectResolveHit | ProjectResolveMiss;
//# sourceMappingURL=ipc-protocol.d.ts.map