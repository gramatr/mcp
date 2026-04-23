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
import { createServer } from 'node:http';
/**
 * Start the localhost HTTP fallback server on a random loopback port.
 * Returns the port, auth token, and server handle.
 *
 * The caller is responsible for writing the credentials to disk via
 * writeHttpCredentials() from startup.ts and closing the server on shutdown.
 */
export async function startHttpFallback(dispatch) {
    const { randomBytes } = await import('node:crypto');
    const token = randomBytes(32).toString('hex');
    const server = createServer((req, res) => {
        // Only POST is supported
        if (req.method !== 'POST') {
            res.writeHead(405).end();
            return;
        }
        // Validate auth token
        const auth = req.headers['authorization'];
        if (auth !== `Bearer ${token}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ error: 'unauthorized' }));
            return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            void (async () => {
                let rpcReq = null;
                try {
                    rpcReq = JSON.parse(body);
                    const result = await dispatch(rpcReq);
                    const resp = { jsonrpc: '2.0', id: rpcReq.id, result };
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify(resp));
                }
                catch (err) {
                    const resp = {
                        jsonrpc: '2.0',
                        id: rpcReq?.id ?? 0,
                        error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
                    };
                    res.writeHead(500, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify(resp));
                }
            })();
        });
        req.on('error', () => { res.writeHead(400).end(); });
    });
    await new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve());
        server.once('error', reject);
    });
    const port = server.address().port;
    return { port, token, server };
}
//# sourceMappingURL=http-server.js.map