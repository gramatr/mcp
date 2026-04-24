/**
 * server.ts — Unix socket IPC server for the gramatr daemon.
 *
 * Accepts newline-delimited JSON-RPC 2.0 connections. Each connection
 * can send one request and receives one response. Connections are
 * short-lived (hook processes are short-lived); no multiplexing needed.
 *
 * Error codes:
 *   -32600  Invalid request
 *   -32601  Method not found
 *   -32603  Internal error
 */
import { type Server, type Socket } from 'node:net';
import type { DaemonRequest } from './ipc-protocol.js';
/**
 * Route a JSON-RPC 2.0 request to the appropriate handler.
 * Exported so the HTTP fallback server can share the same dispatch logic.
 */
export declare function dispatchRpcRequest(req: DaemonRequest): Promise<unknown>;
export declare function createDaemonServer(authToken: string): Server;
export declare function getActiveSockets(): Set<Socket>;
//# sourceMappingURL=server.d.ts.map