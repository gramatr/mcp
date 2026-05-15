/**
 * Auth token resolution for the local MCP server.
 *
 * Reads the auth token from the same canonical sources used by the rest of the
 * client stack:
 *   1. GRAMATR_API_KEY
 *   2. GRAMATR_TOKEN / AIOS_MCP_TOKEN
 *   3. ~/.gramatr.json (or $GRAMATR_DIR/../.gramatr.json)
 *
 * Injects as Authorization: Bearer on every proxied request.
 * Re-reads on 401 from remote (token may have been refreshed).
 * Auto-renews when token is within RENEWAL_WINDOW_MS of expiry (#526).
 */
/**
 * Read the auth token. Returns null if token is expired.
 * Triggers background renewal when token is near expiry.
 */
export declare function getToken(): string | null;
/**
 * Force re-read of the auth token from disk.
 * Called on 401 from remote and by getToken() on first call or expiry.
 */
export declare function refreshToken(): string | null;
/**
 * Explicitly renew the access token via POST /auth/token/renew.
 * Writes the new token to disk and updates in-memory cache on success.
 * Returns the new token, or null if renewal failed.
 * Used by remote-client.ts on 401 when disk refresh also yields null.
 */
export declare function renewToken(): Promise<string | null>;
/**
 * Get the remote server base URL.
 */
export declare function getServerUrl(): string;
/** Exposed for testing only. */
export declare function _resetCacheForTest(): void;
//# sourceMappingURL=auth.d.ts.map