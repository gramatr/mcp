/**
 * http-server.ts — Localhost HTTP fallback for the gramatr daemon (Tier 2 IPC).
 *
 * Binds to 127.0.0.1 only. Requires a shared secret token on every request.
 * Provides the same JSON-RPC 2.0 interface as the Unix socket server so hooks
 * can fall back to it when the socket is unavailable (e.g. Windows).
 *
 * Security model:
 *   - Localhost-only bind: no external access possible
 *   - Shared secret token (32 random bytes) written to ~/.gramatr/daemon.token
 *   - Token validated on every request — rejects anything without it
 *   - No TLS needed: loopback traffic can't be intercepted without root
 */
import { type Server } from 'node:http';
import type { DaemonRequest } from './ipc-protocol.js';
export type RpcDispatch = (req: DaemonRequest) => Promise<unknown>;
/**
 * Start the localhost HTTP fallback server on a random loopback port.
 * Returns the port, auth token, and server handle.
 *
 * The caller is responsible for writing the credentials to disk via
 * writeHttpCredentials() from startup.ts and closing the server on shutdown.
 */
export declare function startHttpFallback(dispatch: RpcDispatch): Promise<{
    port: number;
    token: string;
    server: Server;
}>;
//# sourceMappingURL=http-server.d.ts.map