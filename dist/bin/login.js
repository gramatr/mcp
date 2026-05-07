#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noConsole: CLI output
/**
 * gramatr login — Authenticate with the gramatr server
 *
 * Opens the grāmatr dashboard login flow, captures a Firebase ID token
 * on localhost, and stores it in ~/.gramatr.json.
 *
 * Usage:
 *   gramatr login                    # Interactive browser login via dashboard
 *   gramatr login --token <token>    # Paste a token directly (API key or OAuth token)
 *   gramatr login --status           # Check current auth status
 *   gramatr login --logout           # Remove stored credentials
 *
 * Token is stored in ~/.gramatr.json under the "token" key.
 * The local gramatr MCP runtime reads this on every proxied request.
 */
import { createHash, randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { createServer } from "http";
import { join } from "path";
// ── Config ──
const HOME = process.env.HOME || process.env.USERPROFILE || "";
const CONFIG_PATH = join(HOME, ".gramatr.json");
const _GRAMATR_DIR = process.env.GRAMATR_DIR || join(HOME, ".gramatr");
const DEFAULT_SERVER = process.env.GRAMATR_URL || "https://api.gramatr.com/mcp";
// Strip /mcp suffix to get base URL
const SERVER_BASE = DEFAULT_SERVER.replace(/\/mcp\/?$/, "");
const DASHBOARD_BASE = process.env.GMTR_DASHBOARD_URL ||
    (() => {
        try {
            const url = new URL(SERVER_BASE);
            if (url.hostname.startsWith("api.")) {
                url.hostname = `app.${url.hostname.slice(4)}`;
            }
            url.pathname = "";
            url.search = "";
            url.hash = "";
            return url.toString().replace(/\/$/, "");
        }
        catch {
            return "https://app.gramatr.com";
        }
    })();
// CALLBACK_PORT is now dynamically allocated per login (random localhost port).
// The server's DCR endpoint accepts arbitrary localhost redirect_uris for
// public CLIs (token_endpoint_auth_method=none). See loginBrowser() below.
// ── HTML Templates ──
// Brand tokens lifted directly from staging.gramatr.com BaseLayout.css.
// DO NOT introduce gradients, glassmorphism, or cyan accents — the real
// brand is flat near-black surfaces, #3B82F6 blue, Inter + Outfit.
const BRAND_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600&family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --gmtr-bg: #0E0E0E;
    --gmtr-surface: #1A1A1A;
    --gmtr-border: #333333;
    --gmtr-text: #ECECEC;
    --gmtr-text-secondary: #A0A0A0;
    --gmtr-text-muted: #707070;
    --gmtr-text-faint: #4A4A4A;
    --gmtr-primary: #3B82F6;
    --gmtr-accent: #60A5FA;
    --gmtr-success: #4ADE80;
    --gmtr-error: #F87171;
    --font-wordmark: 'Outfit', -apple-system, sans-serif;
    --font-heading: 'Inter', -apple-system, sans-serif;
    --font-body: 'Inter', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;
  }
  html, body { height: 100%; }
  body {
    background: var(--gmtr-bg);
    color: var(--gmtr-text);
    font-family: var(--font-body);
    font-weight: 400;
    line-height: 1.7;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .card {
    background: var(--gmtr-surface);
    border: 1px solid var(--gmtr-border);
    border-radius: 12px;
    padding: 2.5rem;
    max-width: 480px;
    width: 100%;
    text-align: center;
  }
  .wordmark {
    font-family: var(--font-wordmark);
    font-weight: 600;
    font-size: 1.5rem;
    color: var(--gmtr-text);
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }
  .tagline {
    color: var(--gmtr-text-muted);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 2rem;
  }
  .status-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .status-icon svg { width: 56px; height: 56px; }
  h2 {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--gmtr-text);
    margin: 0 0 0.5rem;
  }
  p {
    color: var(--gmtr-text-secondary);
    font-size: 0.9375rem;
    line-height: 1.6;
    margin: 0;
  }
  .hint {
    margin-top: 1.75rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--gmtr-border);
    font-size: 0.8125rem;
    color: var(--gmtr-text-muted);
  }
  .hint code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    background: var(--gmtr-bg);
    border: 1px solid var(--gmtr-border);
    color: var(--gmtr-accent);
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }
`;
// Flat, no pulse, no glow — matches the rest of gramatr.com.
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#4ADE80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="16 10 11 15 8 12"></polyline></svg>`;
const X_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#F87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
function htmlPage(title, body) {
    return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — grāmatr</title>
  <style>${BRAND_CSS}</style>
</head><body>
  <div class="card">
    <div class="wordmark">grāmatr</div>
    <div class="tagline">Your AI gets smarter</div>
    ${body}
  </div>
</body></html>`;
}
function successPage() {
    return htmlPage("Authenticated", `
    <div class="status-icon">${CHECK_SVG}</div>
    <h2>You're signed in</h2>
    <p>Your token is saved on this machine. You can close this tab and return to your terminal.</p>
    <div class="hint">grāmatr intelligence is now active across every AI tool you use.</div>
  `);
}
function errorPage(title, detail) {
    return htmlPage("Error", `
    <div class="status-icon">${X_SVG}</div>
    <h2>${title}</h2>
    <p>${detail}</p>
    <div class="hint">Return to your terminal and try again, or run <code>gramatr login --token</code> to paste a token directly.</div>
  `);
}
// ── Headless Detection ──
export function isHeadless(forceFlag = false) {
    // Explicit override — user passed --headless, OR env GRAMATR_LOGIN_HEADLESS=1
    if (forceFlag)
        return true;
    if (process.env.GRAMATR_LOGIN_HEADLESS === "1")
        return true;
    // SSH session — always go headless. Even on macOS (which has a local
    // display), `open` would launch Safari on the Mac's *physical* screen,
    // not on the remote terminal where the user actually is. Device flow
    // lets them paste the code on whichever machine they're sitting at.
    if (process.env.SSH_CONNECTION || process.env.SSH_TTY)
        return true;
    // Docker / CI / no TTY
    if (process.env.CI || process.env.DOCKER)
        return true;
    // Linux without display
    if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)
        return true;
    return false;
}
// ── Helpers ──
export function readConfig() {
    try {
        return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    }
    catch {
        return {};
    }
}
export function writeConfig(config) {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}
/**
 * Kill any running gramatr stdio server processes so they respawn with
 * the fresh credentials just written to ~/.gramatr.json. The stdio server
 * inherits env at spawn time and cannot hot-reload credentials — killing it
 * forces the MCP client (Claude Code, Cursor, etc.) to respawn it cleanly.
 *
 * Uses an end-of-string anchor so we only hit the bare server process, not
 * `gramatr login` or `gramatr setup` subcommands still in flight.
 * Always excludes the current process.
 */
export function killStaleMcpServers() {
    try {
        const { execSync } = require("child_process");
        if (process.platform === "win32") {
            execSync("taskkill /F /IM gramatr.exe /T 2>nul", { stdio: "ignore" });
        }
        else {
            // pkill -TERM -f matches against the full command line; the $ anchor ensures
            // we only kill processes whose argv[1] ends in 'gramatr' (the stdio server),
            // not subcommands like 'gramatr login' which have trailing arguments.
            execSync(`pkill -TERM -f 'gramatr$' 2>/dev/null; true`, { stdio: "ignore" });
        }
    }
    catch {
        // No running process or kill failed — not an error
    }
}
export async function readJsonRecord(response) {
    const payload = await response.json().catch(() => ({}));
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return {};
    return payload;
}
export async function checkServerHealth() {
    try {
        const res = await fetch(`${SERVER_BASE}/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = (await res.json());
            return { ok: true, version: data.version };
        }
        return { ok: false, error: `HTTP ${res.status}` };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
}
export async function testToken(token) {
    try {
        const res = await fetch(`${SERVER_BASE}/mcp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name: "aggregate_stats", arguments: {} },
            }),
            signal: AbortSignal.timeout(10000),
        });
        const text = await res.text();
        // Check for auth errors
        if (text.includes("JWT token is required") ||
            text.includes("signature validation failed") ||
            text.includes("Unauthorized")) {
            return { valid: false, error: "Token rejected by server" };
        }
        // Check for successful response
        for (const line of text.split("\n")) {
            if (line.startsWith("data: ")) {
                try {
                    const d = JSON.parse(line.slice(6));
                    if (d?.result?.isError) {
                        return { valid: false, error: d.result.content?.[0]?.text || "Unknown error" };
                    }
                    if (d?.result?.content?.[0]?.text) {
                        return { valid: true, user: "authenticated" };
                    }
                }
                catch {
                    continue;
                }
            }
        }
        return { valid: false, error: "Unexpected response" };
    }
    catch (e) {
        return { valid: false, error: e.message };
    }
}
export async function startDeviceAuthorization() {
    const res = await fetch(`${SERVER_BASE}/device/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "gramatr-mcp-login" }),
        signal: AbortSignal.timeout(10000),
    });
    const payload = await readJsonRecord(res);
    if (!res.ok) {
        throw new Error(payload.error_description || payload.error || `HTTP ${res.status}`);
    }
    if (typeof payload.device_code !== "string" ||
        typeof payload.user_code !== "string" ||
        typeof payload.verification_uri !== "string" ||
        typeof payload.expires_in !== "number") {
        throw new Error("Device authorization response missing required fields");
    }
    return {
        device_code: payload.device_code,
        user_code: payload.user_code,
        verification_uri: payload.verification_uri,
        verification_uri_complete: typeof payload.verification_uri_complete === "string"
            ? payload.verification_uri_complete
            : undefined,
        expires_in: payload.expires_in,
        interval: typeof payload.interval === "number" ? payload.interval : 5,
    };
}
export async function pollDeviceAuthorization(deviceCode) {
    while (true) {
        const res = await fetch(`${SERVER_BASE}/device/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device_code: deviceCode }),
            signal: AbortSignal.timeout(10000),
        });
        const payload = await readJsonRecord(res);
        if (res.ok && payload.access_token) {
            return payload.access_token;
        }
        if ((res.status === 428 || res.status === 400) && payload.error === "authorization_pending") {
            const waitSeconds = Math.max(1, Number(payload.interval) || 5);
            await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
            continue;
        }
        throw new Error(payload.error_description || payload.error || `HTTP ${res.status}`);
    }
}
// ── Commands ──
export async function showStatus() {
    console.log("\n  gramatr authentication status\n");
    const config = readConfig();
    const token = config.token;
    console.log(`  Server:  ${SERVER_BASE}`);
    const health = await checkServerHealth();
    if (health.ok) {
        console.log(`  Health:  ✓ healthy (v${health.version || "unknown"})`);
    }
    else {
        console.log(`  Health:  ✗ ${health.error}`);
    }
    if (!token) {
        console.log("  Token:   ✗ not configured");
        console.log("\n  Run: gramatr login to authenticate\n");
        return;
    }
    const prefix = token.substring(0, 15);
    console.log(`  Token:   ${prefix}...`);
    const result = await testToken(token);
    if (result.valid) {
        console.log("  Auth:    ✓ token is valid");
    }
    else {
        console.log(`  Auth:    ✗ ${result.error}`);
        console.log("\n  Run: gramatr login to re-authenticate\n");
    }
    console.log("");
}
export async function logout() {
    const config = readConfig();
    delete config.token;
    delete config.token_type;
    delete config.token_expires;
    delete config.authenticated_at;
    writeConfig(config);
    console.log("\n  ✓ Logged out. Token removed from ~/.gramatr.json\n");
}
async function fetchUserIdentity(token) {
    try {
        const res = await fetch(`${SERVER_BASE}/api/v1/access/status`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok)
            return {};
        const data = (await res.json());
        const user_id = typeof data.user_id === "string" ? data.user_id : undefined;
        const email = typeof data.email === "string" ? data.email : undefined;
        // Attempt to fetch display name from profile API (404 expected for new users)
        let name;
        if (user_id) {
            try {
                const profileRes = await fetch(`${SERVER_BASE}/api/v1/profile/${user_id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: AbortSignal.timeout(5000),
                });
                if (profileRes.ok) {
                    const profile = (await profileRes.json());
                    if (typeof profile.name === "string" && profile.name.trim()) {
                        name = profile.name.trim();
                    }
                }
            }
            catch {
                // non-fatal — profile fetch failure does not block login
            }
        }
        return { user_id, email, name };
    }
    catch {
        return {};
    }
}
async function clearReauthFlag(token) {
    try {
        await fetch(`${SERVER_BASE}/api/v1/auth/reauth-flag`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5000),
        });
    }
    catch {
        // non-fatal — server will re-prompt at next session start if needed
    }
}
/**
 * Prompt the user for their display name if not already set in ~/.gramatr.json.
 * Only runs when stdin and stderr are TTYs (interactive terminal).
 */
async function promptUserNameIfAbsent() {
    if (!process.stdin.isTTY || !process.stderr.isTTY)
        return;
    const config = readConfig();
    if (config.user?.name)
        return;
    const { createInterface } = await import("readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
        const answer = await rl.question("  What should grāmatr call you? [Enter to skip] ");
        const name = answer.trim();
        if (name) {
            const updated = readConfig();
            writeConfig({ ...updated, user: { ...(updated.user ?? {}), name } });
        }
    }
    finally {
        rl.close();
    }
}
/**
 * Prompt the user to enable auto-compact if not already configured.
 * Only runs when stdin and stderr are TTYs (interactive terminal).
 */
async function promptAutoCompactIfAbsent() {
    if (!process.stdin.isTTY || !process.stderr.isTTY)
        return;
    const config = readConfig();
    if (config.auto_compact !== undefined)
        return;
    process.stderr.write("  grāmatr session continuity: saves full context every 15 turns — tasks, git state,\n");
    process.stderr.write("  recent work. Restores automatically after /clear so nothing is lost.\n");
    const { createInterface } = await import("readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
        const answer = await rl.question("  Enable auto-compact? Automatically condenses context when it gets long. [Y/n] ");
        const normalized = answer.trim().toLowerCase();
        const enable = normalized !== "n" && normalized !== "no";
        const updated = readConfig();
        writeConfig({ ...updated, auto_compact: { auto: enable } });
    }
    finally {
        rl.close();
    }
}
/**
 * Run all post-login onboarding prompts in order.
 * Called at every login path that completes successfully.
 */
async function runPostLoginOnboarding() {
    await promptUserNameIfAbsent();
    await promptAutoCompactIfAbsent();
}
export async function loginWithToken(token) {
    console.log("\n  Testing token...");
    const result = await testToken(token);
    if (result.valid) {
        const config = readConfig();
        config.token = token;
        config.token_type = /^[a-z]+_(?:sk|pk)_/i.test(token) ? "api_key" : "oauth";
        config.authenticated_at = new Date().toISOString();
        const [identity] = await Promise.all([fetchUserIdentity(token), clearReauthFlag(token)]);
        if (identity.user_id)
            config.user_id = identity.user_id;
        if (identity.email)
            config.email = identity.email;
        if (identity.name && !config.user?.name) {
            config.user = { ...(config.user ?? {}), name: identity.name };
        }
        writeConfig(config);
        killStaleMcpServers();
        await runPostLoginOnboarding();
        console.log("  ✓ Token valid. Saved to ~/.gramatr.json");
        console.log("  gramatr intelligence is now active.\n");
    }
    else {
        console.log(`  ✗ Token rejected: ${result.error}`);
        console.log("  Token was NOT saved.\n");
        process.exit(1);
    }
}
export async function loginBrowser(opts = {}) {
    console.log("\n  gramatr login\n");
    console.log(`  Server: ${SERVER_BASE}`);
    console.log(`  Dashboard: ${DASHBOARD_BASE}`);
    // Check server health first
    const health = await checkServerHealth();
    if (!health.ok) {
        console.log(`  ✗ Server unreachable: ${health.error}`);
        console.log("  Cannot authenticate. Is the server running?\n");
        process.exit(1);
        return;
    }
    console.log(`  Health: ✓ v${health.version || "unknown"}`);
    console.log("");
    // Headless environments use device auth (no local server needed).
    // --headless flag or GRAMATR_LOGIN_HEADLESS=1 forces this path even on
    // desktop — escape hatch when the browser flow is broken or the user
    // prefers the device flow's out-of-band UX.
    if (isHeadless(opts.forceHeadless)) {
        console.log("  Headless environment detected. Starting device login...\n");
        try {
            const device = await startDeviceAuthorization();
            console.log(`  Code: ${device.user_code}`);
            console.log(`  Open: ${device.verification_uri_complete || device.verification_uri}`);
            console.log("  Sign in with Google or GitHub, approve the device, then return here.\n");
            console.log("  Waiting for authorization...");
            // v0.3.63 hotfix: must clear the timeout after the race resolves,
            // otherwise the orphan setTimeout keeps the Node event loop alive
            // until expires_in elapses (typically 600s). Symptom: success path
            // prints "Authenticated successfully" and then hangs until Ctrl+C.
            let timeoutHandle;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error("Device login timed out")), device.expires_in * 1000);
            });
            let accessToken;
            try {
                accessToken = await Promise.race([
                    pollDeviceAuthorization(device.device_code),
                    timeoutPromise,
                ]);
            }
            finally {
                if (timeoutHandle)
                    clearTimeout(timeoutHandle);
            }
            const config = readConfig();
            config.token = accessToken;
            config.token_type = "oauth";
            config.authenticated_at = new Date().toISOString();
            config.server_url = SERVER_BASE;
            config.dashboard_url = DASHBOARD_BASE;
            config.token_expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            const [deviceIdentity] = await Promise.all([
                fetchUserIdentity(accessToken),
                clearReauthFlag(accessToken),
            ]);
            if (deviceIdentity.user_id)
                config.user_id = deviceIdentity.user_id;
            if (deviceIdentity.email)
                config.email = deviceIdentity.email;
            if (deviceIdentity.name && !config.user?.name) {
                config.user = { ...(config.user ?? {}), name: deviceIdentity.name };
            }
            writeConfig(config);
            killStaleMcpServers();
            await runPostLoginOnboarding();
            console.log("");
            console.log("  ✓ Authenticated successfully");
            console.log("  Token saved to ~/.gramatr.json");
            console.log("  gramatr intelligence is now active.\n");
            return;
        }
        catch (e) {
            console.log(`  ✗ Device login failed: ${e.message}`);
            console.log("  Run `gramatr login` when you're ready to authenticate.\n");
            process.exit(1);
            return;
        }
    }
    // ── Browser environments use OAuth 2.0 authorization-code grant + PKCE ──
    //
    // v0.6.5: This now mirrors the headless device flow's auth model — both
    // paths produce an opaque `mcp-access-token-<uuid>` token (1-year TTL,
    // Redis-backed) instead of the short-lived raw Firebase ID token the old
    // dashboard-redirect flow stored. Per RFC 7591 (Dynamic Client Registration)
    // we register the CLI as an OAuth client on first run, then per RFC 7636
    // (PKCE) we exchange a code for the opaque token.
    //
    // Bug history: pre-v0.6.5 the browser flow stored a raw Firebase ID token
    // (token_type: 'firebase'), which had a 1-hour TTL. After 1 hour every
    // MCP call returned "JWT signature validation failed" because the token
    // genuinely expired. See #519 + #524 + this PR.
    // 1. Bind a localhost callback server (random port — server's DCR allows it)
    const callbackServer = createServer();
    await new Promise((resolve, reject) => {
        callbackServer.once("error", reject);
        callbackServer.listen(0, "127.0.0.1", () => resolve());
    });
    const port = callbackServer.address().port;
    const redirectUri = `http://localhost:${port}/callback`;
    // 2. Dynamic client registration (RFC 7591). We always re-register because
    //    the redirect_uri changes every run (random localhost port). Server
    //    allows DCR with token_endpoint_auth_method=none for public CLIs.
    const config = readConfig();
    let clientId;
    try {
        const regRes = await fetch(`${SERVER_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_name: "gramatr-mcp-login",
                redirect_uris: [redirectUri],
                grant_types: ["authorization_code"],
                response_types: ["code"],
                token_endpoint_auth_method: "none",
            }),
            signal: AbortSignal.timeout(10000),
        });
        const reg = await readJsonRecord(regRes);
        if (!regRes.ok || !reg.client_id) {
            throw new Error(reg.error_description || reg.error || `HTTP ${regRes.status}`);
        }
        clientId = reg.client_id;
        config.oauth_client_id = clientId;
        writeConfig(config);
    }
    catch (e) {
        callbackServer.close();
        console.log(`  ✗ Dynamic client registration failed: ${e.message}\n`);
        process.exit(1);
        return;
    }
    // 3. PKCE: generate verifier + S256 challenge
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const state = randomBytes(16).toString("base64url");
    // 4. Run the callback server, waiting for /callback?code=...&state=...
    //
    // v0.6.5: capture the timeout handle and clearTimeout() in finally — same
    // orphan-timer bug that v0.3.63 fixed for the device flow. Without the
    // clear, Promise.race against a setTimeout keeps the Node event loop
    // alive past success and the process hangs until Ctrl+C.
    let codeTimeoutHandle;
    const codePromise = new Promise((resolve, reject) => {
        callbackServer.on("request", (req, res) => {
            const url = new URL(req.url || "/", redirectUri);
            if (url.pathname !== "/callback") {
                res.writeHead(404);
                res.end("Not found");
                return;
            }
            const code = url.searchParams.get("code");
            const returnedState = url.searchParams.get("state");
            const error = url.searchParams.get("error");
            // v0.6.6: `server.close()` alone does not terminate keep-alive
            // sockets — the browser holds the connection open and the Node
            // event loop never exits, so the CLI prints "Authenticated" and
            // then hangs until Ctrl+C. Send `Connection: close` on the
            // response and call `closeAllConnections()` to forcibly drop
            // lingering sockets after we respond.
            const shutdown = () => {
                callbackServer.close();
                if (typeof callbackServer.closeAllConnections === "function") {
                    callbackServer.closeAllConnections();
                }
            };
            if (error) {
                res.writeHead(200, { "Content-Type": "text/html", Connection: "close" });
                res.end(errorPage("Authentication Failed", error));
                shutdown();
                reject(new Error(`OAuth error: ${error}`));
                return;
            }
            if (!code || returnedState !== state) {
                res.writeHead(400, { "Content-Type": "text/html", Connection: "close" });
                res.end(errorPage("Invalid Callback", "Missing code or state mismatch. Please try again."));
                shutdown();
                reject(new Error("Invalid callback"));
                return;
            }
            res.writeHead(200, { "Content-Type": "text/html", Connection: "close" });
            res.end(successPage());
            shutdown();
            resolve(code);
        });
        codeTimeoutHandle = setTimeout(() => {
            callbackServer.close();
            reject(new Error("Login timed out after 5 minutes"));
        }, 5 * 60 * 1000);
    });
    // 5. Open the browser to the server's /authorize endpoint with PKCE params
    const authorizeUrl = new URL("/authorize", SERVER_BASE);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", state);
    console.log("  Opening browser for authentication...");
    console.log(`  If it doesn't open, visit:`);
    console.log(`  ${authorizeUrl.toString()}`);
    console.log("");
    const { exec } = await import("child_process");
    const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${openCmd} "${authorizeUrl.toString()}"`);
    console.log("  Waiting for authorization...");
    let authCode;
    try {
        authCode = await codePromise;
    }
    catch (e) {
        if (codeTimeoutHandle)
            clearTimeout(codeTimeoutHandle);
        console.log(`\n  ✗ Authentication failed: ${e.message}\n`);
        process.exit(1);
        return;
    }
    if (codeTimeoutHandle)
        clearTimeout(codeTimeoutHandle);
    // 6. Exchange the code for an opaque MCP access token at /token
    let accessToken;
    let expiresIn = 31536000; // server default = 1 year
    try {
        const tokenRes = await fetch(`${SERVER_BASE}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: authCode,
                code_verifier: codeVerifier,
                client_id: clientId,
                redirect_uri: redirectUri,
            }),
            signal: AbortSignal.timeout(10000),
        });
        const payload = await readJsonRecord(tokenRes);
        if (!tokenRes.ok || !payload.access_token) {
            throw new Error(payload.error_description || payload.error || `HTTP ${tokenRes.status}`);
        }
        accessToken = payload.access_token;
        if (typeof payload.expires_in === "number")
            expiresIn = payload.expires_in;
    }
    catch (e) {
        console.log(`\n  ✗ Token exchange failed: ${e.message}\n`);
        process.exit(1);
        return;
    }
    // 7. Save the opaque token — same shape as the device flow
    const updated = readConfig();
    updated.token = accessToken;
    updated.token_type = "oauth";
    updated.authenticated_at = new Date().toISOString();
    updated.server_url = SERVER_BASE;
    updated.dashboard_url = DASHBOARD_BASE;
    updated.token_expires_at = new Date(Date.now() + expiresIn * 1000).toISOString();
    if (clientId)
        updated.oauth_client_id = clientId;
    const [browserIdentity] = await Promise.all([
        fetchUserIdentity(accessToken),
        clearReauthFlag(accessToken),
    ]);
    if (browserIdentity.user_id)
        updated.user_id = browserIdentity.user_id;
    if (browserIdentity.email)
        updated.email = browserIdentity.email;
    if (browserIdentity.name && !updated.user?.name) {
        updated.user = { ...(updated.user ?? {}), name: browserIdentity.name };
    }
    writeConfig(updated);
    killStaleMcpServers();
    await runPostLoginOnboarding();
    console.log("");
    console.log("  ✓ Authenticated successfully");
    console.log("  Token saved to ~/.gramatr.json");
    console.log("  gramatr intelligence is now active.\n");
}
// ── CLI ──
//
// Defense in depth (Fix A' for Windows top-level await crash):
// All CLI code is wrapped in an async `main()` and invoked via a
// module-run guard. This keeps the module importable without firing
// side effects and avoids top-level await entirely, so the file stays
// safe even if the package ever loses `"type": "module"` or tsx
// changes its default target to CJS.
export async function main(rawArgs = process.argv.slice(2)) {
    const args = rawArgs[0] === "login" ? rawArgs.slice(1) : rawArgs;
    if (args.includes("--status") || args.includes("status")) {
        await showStatus();
        return;
    }
    if (args.includes("--logout") || args.includes("logout")) {
        await logout();
        return;
    }
    if (args.includes("--token") || args.includes("-t")) {
        const tokenIdx = args.indexOf("--token") !== -1 ? args.indexOf("--token") : args.indexOf("-t");
        const token = args[tokenIdx + 1];
        if (!token) {
            // Interactive paste mode — like Claude's login
            console.log("\n  Paste your gramatr token below.");
            console.log("  (API keys start with sk_)\n");
            process.stdout.write("  Token: ");
            const { createInterface } = await import("readline");
            const rl = createInterface({ input: process.stdin, output: process.stdout });
            const pastedToken = await new Promise((resolve) => {
                rl.on("line", (line) => {
                    rl.close();
                    resolve(line.trim());
                });
            });
            if (!pastedToken) {
                console.log("  No token provided.\n");
                process.exit(1);
            }
            await loginWithToken(pastedToken);
        }
        else {
            await loginWithToken(token);
        }
        return;
    }
    if (args.includes("--help") || args.includes("-h")) {
        console.log(`
  gramatr login — Authenticate with the gramatr server

  Usage:
    gramatr login              Interactive login (browser PKCE when display available,
                                   device flow otherwise — auto-detected)
    gramatr login --headless   Force the device flow even on desktops
    gramatr login --token      Paste a token (API key or OAuth token)
    gramatr login --token <t>  Provide token directly
    gramatr login --status     Check authentication status
    gramatr login --logout     Remove stored credentials
    gramatr login --help       Show this help

  Environment:
    GRAMATR_LOGIN_HEADLESS=1  Same as --headless (forces device flow)

  Token storage: ~/.gramatr.json
  Server: ${SERVER_BASE}
  Dashboard: ${DASHBOARD_BASE}
`);
        return;
    }
    // Default: browser login flow (falls back to device flow if headless
    // detected, OR if --headless / GRAMATR_LOGIN_HEADLESS=1 is set).
    const forceHeadless = args.includes("--headless");
    await loginBrowser({ forceHeadless });
}
// Module-run guard. Works both when invoked directly via
// `tsx bin/login.ts` and when imported from another module
// (tests, programmatic use). Under ESM, import.meta.url is the
// canonical check; we also accept a path-suffix match as a belt.
const invokedAs = process.argv[1] || "";
const isMain = import.meta.url === `file://${invokedAs}` ||
    invokedAs.endsWith("login.ts") ||
    invokedAs.endsWith("login.js");
if (isMain) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
}
//# sourceMappingURL=login.js.map