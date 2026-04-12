/**
 * Auth token resolution for the local MCP server.
 *
 * Reads the auth token once at startup from ~/.gramatr.json.
 * Injects as Authorization: Bearer on every proxied request.
 * Re-reads on 401 from remote (token may have been refreshed).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// gramatr-allow: C1 — MCP package is standalone config reader, no @gramatr/core
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const CONFIG_PATH = join(HOME, '.gramatr.json');
let cachedToken = null;
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
    try {
        const raw = readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(raw);
        // API key takes priority (env var)
        // gramatr-allow: C1 — MCP package is standalone config reader
        const envKey = process.env.GRAMATR_API_KEY;
        if (envKey) {
            cachedToken = envKey;
            return cachedToken;
        }
        cachedToken = config.token || null;
        return cachedToken;
    }
    catch {
        // Config file doesn't exist or is malformed
        cachedToken = null;
        return null;
    }
}
/**
 * Get the remote server base URL.
 * Reads from env or config file.
 */
export function getServerUrl() {
    // gramatr-allow: C1 — MCP package is standalone config reader
    if (process.env.GRAMATR_URL) {
        // gramatr-allow: C1 — MCP package is standalone config reader
        return process.env.GRAMATR_URL.replace(/\/mcp\/?$/, '');
    }
    try {
        const raw = readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(raw);
        return (config.server_url || 'https://api.gramatr.com').replace(/\/mcp\/?$/, '');
    }
    catch {
        return 'https://api.gramatr.com';
    }
}
//# sourceMappingURL=auth.js.map