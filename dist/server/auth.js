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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getGramatrDirFromEnv, getGramatrTokenFromEnv, getGramatrUrlFromEnv, getHomeDir, } from '../config-runtime.js';
let cachedToken = null;
function getConfigPath() {
    const gramatrDir = getGramatrDirFromEnv();
    if (gramatrDir) {
        return join(dirname(gramatrDir), '.gramatr.json');
    }
    const home = getHomeDir();
    return join(home, '.gramatr.json');
}
function readConfig() {
    try {
        const raw = readFileSync(getConfigPath(), 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/**
 * Read the auth token from ~/.gramatr.json.
 * Caches in memory — call refreshToken() to force re-read.
 */
export function getToken() {
    if (cachedToken)
        return cachedToken;
    return refreshToken();
}
/**
 * Force re-read of the auth token from disk.
 * Called on startup and on 401 from remote.
 */
export function refreshToken() {
    const envKey = process.env.GRAMATR_API_KEY;
    if (envKey) {
        cachedToken = envKey;
        return cachedToken;
    }
    const envToken = getGramatrTokenFromEnv();
    if (envToken) {
        cachedToken = envToken;
        return cachedToken;
    }
    const config = readConfig();
    cachedToken = config?.token || null;
    return cachedToken;
}
/**
 * Get the remote server base URL.
 * Reads from env or config file.
 */
export function getServerUrl() {
    const envUrl = getGramatrUrlFromEnv();
    if (envUrl) {
        return envUrl.replace(/\/mcp\/?$/, '');
    }
    const config = readConfig();
    return (config?.server_url || 'https://api.gramatr.com').replace(/\/mcp\/?$/, '');
}
//# sourceMappingURL=auth.js.map