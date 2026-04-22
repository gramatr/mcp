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
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getGramatrDirFromEnv, getGramatrTokenFromEnv, getGramatrUrlFromEnv, getHomeDir, } from '../config-runtime.js';
/** Emit renewal warnings once per process to avoid log spam. */
const WARNED_EXPIRY = new Set();
/** Start renewing 7 days before expiry. */
const RENEWAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
let cachedToken = null;
let cachedExpiresAt = null;
let renewalInProgress = false;
function getConfigPath() {
    const gramatrDir = getGramatrDirFromEnv();
    if (gramatrDir) {
        return join(dirname(gramatrDir), '.gramatr.json');
    }
    return join(getHomeDir(), '.gramatr.json');
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
function writeConfig(config) {
    try {
        writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
    }
    catch {
        // Non-fatal — token renewal succeeds even if we can't persist
    }
}
function isExpired(expiresAt) {
    if (expiresAt === null)
        return false;
    return Date.now() >= expiresAt;
}
function isNearExpiry(expiresAt) {
    if (expiresAt === null)
        return false;
    return Date.now() >= expiresAt - RENEWAL_WINDOW_MS;
}
/**
 * Read the auth token. Returns null if token is expired.
 * Triggers background renewal when token is near expiry.
 */
export function getToken() {
    // Env vars take priority and never expire
    const envKey = process.env.GRAMATR_API_KEY;
    if (envKey)
        return envKey;
    const envToken = getGramatrTokenFromEnv();
    if (envToken)
        return envToken;
    // If cached token is expired, force re-read
    if (cachedToken && isExpired(cachedExpiresAt)) {
        cachedToken = null;
        cachedExpiresAt = null;
    }
    if (!cachedToken) {
        refreshToken();
    }
    // Trigger background renewal if near expiry (non-blocking)
    if (cachedToken && isNearExpiry(cachedExpiresAt) && !renewalInProgress) {
        const tokenSnap = cachedToken;
        if (!WARNED_EXPIRY.has(tokenSnap.slice(-8))) {
            WARNED_EXPIRY.add(tokenSnap.slice(-8));
            process.stderr.write('[gramatr] Token nearing expiry — renewing in background\n');
        }
        void renewTokenBackground();
    }
    return cachedToken;
}
/**
 * Force re-read of the auth token from disk.
 * Called on 401 from remote and by getToken() on first call or expiry.
 */
export function refreshToken() {
    const config = readConfig();
    if (!config?.token) {
        cachedToken = null;
        cachedExpiresAt = null;
        return null;
    }
    const expiresAt = config.token_expires_at ? Date.parse(config.token_expires_at) : null;
    // Don't cache an expired disk token
    if (isExpired(expiresAt)) {
        cachedToken = null;
        cachedExpiresAt = null;
        process.stderr.write('[gramatr] Stored token is expired — run `npx @gramatr/mcp login` to re-authenticate\n');
        return null;
    }
    cachedToken = config.token;
    cachedExpiresAt = expiresAt;
    return cachedToken;
}
/**
 * Explicitly renew the access token via POST /auth/token/renew.
 * Writes the new token to disk and updates in-memory cache on success.
 * Returns the new token, or null if renewal failed.
 * Used by remote-client.ts on 401 when disk refresh also yields null.
 */
export async function renewToken() {
    const currentToken = cachedToken ?? readConfig()?.token;
    if (!currentToken)
        return null;
    try {
        const serverUrl = getServerUrl();
        const response = await fetch(`${serverUrl}/auth/token/renew`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentToken}` },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
            return null;
        const body = await response.json();
        if (!body.access_token)
            return null;
        const expiresIn = body.expires_in ?? 31536000;
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        const config = readConfig() ?? {};
        config.token = body.access_token;
        config.token_expires_at = newExpiresAt;
        writeConfig(config);
        cachedToken = body.access_token;
        cachedExpiresAt = Date.parse(newExpiresAt);
        renewalInProgress = false;
        return cachedToken;
    }
    catch {
        return null;
    }
}
/**
 * Attempt to renew the access token via POST /auth/token/renew.
 * Writes the new token to disk on success. Non-throwing.
 */
async function renewTokenBackground() {
    if (renewalInProgress || !cachedToken)
        return;
    renewalInProgress = true;
    try {
        const serverUrl = getServerUrl();
        const response = await fetch(`${serverUrl}/auth/token/renew`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cachedToken}` },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
            process.stderr.write(`[gramatr] Token renewal failed (HTTP ${response.status}) — re-login may be required\n`);
            return;
        }
        const body = await response.json();
        if (!body.access_token)
            return;
        const expiresIn = body.expires_in ?? 31536000;
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        // Update disk config with new token
        const config = readConfig() ?? {};
        config.token = body.access_token;
        config.token_expires_at = newExpiresAt;
        writeConfig(config);
        // Update in-memory cache
        cachedToken = body.access_token;
        cachedExpiresAt = Date.parse(newExpiresAt);
        process.stderr.write('[gramatr] Token renewed successfully\n');
    }
    catch {
        // Non-fatal — will retry on next call
    }
    finally {
        renewalInProgress = false;
    }
}
/**
 * Get the remote server base URL.
 */
export function getServerUrl() {
    const envUrl = getGramatrUrlFromEnv();
    if (envUrl) {
        return envUrl.replace(/\/mcp\/?$/, '');
    }
    const config = readConfig();
    return (config?.server_url || 'https://api.gramatr.com').replace(/\/mcp\/?$/, '');
}
/** Exposed for testing only. */
export function _resetCacheForTest() {
    cachedToken = null;
    cachedExpiresAt = null;
    renewalInProgress = false;
    WARNED_EXPIRY.clear();
}
//# sourceMappingURL=auth.js.map