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
 */
/**
 * Read the auth token from ~/.gramatr.json.
 * Caches in memory — call refreshToken() to force re-read.
 */
export declare function getToken(): string | null;
/**
 * Force re-read of the auth token from disk.
 * Called on startup and on 401 from remote.
 */
export declare function refreshToken(): string | null;
/**
 * Get the remote server base URL.
 * Reads from env or config file.
 */
export declare function getServerUrl(): string;
//# sourceMappingURL=auth.d.ts.map