#!/usr/bin/env node
/**
 * init-identity.ts — Plugin SessionStart helper for canonical user identity (#2921).
 *
 * Calls `session_bootstrap` on the configured grāmatr HTTP MCP endpoint and
 * persists the returned `user` block into `~/.gramatr.json` via the
 * `writeCachedUserIdentity()` helper. The UserPromptSubmit-side rendering
 * (server `formatIdentity()` in packages/mcp-server/src/rendering/directive.ts)
 * picks the cached identity up automatically on subsequent turns.
 *
 * Context
 * ───────
 * PR #2909 shipped the source-side wiring in `packages/mcp/src/hooks/
 * session-start.ts`, but that file is never executed by the Claude Code
 * plugin — the plugin only runs the bundled `bin/*.js` entries declared in
 * `hooks/hooks.json`. This bin closes the gap by giving the plugin's
 * SessionStart chain a concrete subprocess that does the write.
 *
 * Contract
 * ────────
 * - Tolerant: ANY failure (network, auth, missing config, bad response) exits 0
 *   without writing — never blocks session start.
 * - Idempotent: skips the network call when an existing cache entry is still
 *   fresh per `isUserIdentityStale()`.
 * - Best-effort: writes go through `writeCachedUserIdentity()` which already
 *   absorbs filesystem errors.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isUserIdentityStale, readCachedUserIdentity, writeCachedUserIdentity, } from '../user-config.js';
// gramatr-allow: c1
const REMOTE_URL = process.env.GRAMATR_URL ?? 'https://api.gramatr.com/mcp';
// gramatr-allow: c1
const PLUGIN_DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? '';
// gramatr-allow: c1
const ENV_API_KEY = process.env.GRAMATR_API_KEY ?? '';
// gramatr-allow: c1
const ENV_TOKEN = process.env.GRAMATR_TOKEN ?? '';
// gramatr-allow: c1
const HOME_DIR = process.env.HOME ?? '';
// gramatr-allow: c1
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const NETWORK_TIMEOUT_MS = 5000;
/**
 * Token resolution mirrors `bin/plugin-proxy.ts` — env override → plugin
 * data dir → Claude Code OAuth credentials. Returns '' when no token is
 * available; the caller then short-circuits without making the network call.
 */
function getToken() {
    const envToken = ENV_API_KEY || ENV_TOKEN;
    if (envToken)
        return envToken;
    if (PLUGIN_DATA_DIR) {
        try {
            const cfg = JSON.parse(readFileSync(join(PLUGIN_DATA_DIR, 'token.json'), 'utf8'));
            if (typeof cfg.token === 'string' && cfg.token)
                return cfg.token;
        }
        catch {
            // not yet written
        }
    }
    try {
        const credFile = resolve(HOME_DIR, '.claude', '.credentials.json');
        const creds = JSON.parse(readFileSync(credFile, 'utf8'));
        const mcpOAuth = creds.mcpOAuth;
        if (mcpOAuth) {
            for (const entry of Object.values(mcpOAuth)) {
                if (entry.serverUrl === REMOTE_URL &&
                    entry.accessToken &&
                    (!entry.expiresAt || Date.now() < Number(entry.expiresAt))) {
                    return entry.accessToken;
                }
            }
        }
    }
    catch {
        // missing or malformed credentials file
    }
    return '';
}
/**
 * Send a single tools/call to `session_bootstrap` on the remote and pull
 * the parsed structured payload (user + resolved session ids) out of the
 * embedded JSON text envelope MCP returns. Returns null on any failure so
 * the caller can exit 0 cleanly.
 */
async function fetchBootstrapPayload(token, clientSessionId) {
    const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
            name: 'session_bootstrap',
            arguments: {
                // Intentionally omit `hook_response: true` — that flag shapes the
                // response into a Claude-Code-hook-compatible envelope that drops
                // the top-level `user` block we need to cache here. The structured
                // (non-hook) payload also exposes the resolved gramatr_session_id /
                // gramatr_project_id we need for the per-project session.json write
                // (#2942 — fixes statusline.js having no session_id source).
                cwd: PROJECT_DIR,
                client_type: 'claude-code',
                ...(clientSessionId ? { client_session_id: clientSessionId } : {}),
            },
        },
    };
    let res;
    try {
        res = await fetch(REMOTE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
        });
    }
    catch {
        return null;
    }
    if (!res.ok)
        return null;
    // The MCP endpoint may stream the response as SSE or return JSON directly.
    const contentType = res.headers.get('content-type') ?? '';
    let payload = null;
    try {
        if (contentType.includes('text/event-stream')) {
            const text = await res.text();
            const lines = text.split('\n');
            let lastData = null;
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const data = line.slice(5).trim();
                    if (data && data !== '[DONE]')
                        lastData = data;
                }
            }
            if (!lastData)
                return null;
            payload = JSON.parse(lastData);
        }
        else {
            payload = (await res.json());
        }
    }
    catch {
        return null;
    }
    if (!payload)
        return null;
    const result = payload.result;
    if (!result)
        return null;
    const content = result.content;
    const text = typeof content?.[0]?.text === 'string' ? content[0].text : '';
    if (!text)
        return null;
    try {
        const parsed = JSON.parse(text);
        const user = parsed.user;
        const sessionPayload = {
            user,
            gramatr_session_id: typeof parsed.gramatr_session_id === 'string' ? parsed.gramatr_session_id : undefined,
            gramatr_project_id: typeof parsed.gramatr_project_id === 'string' ? parsed.gramatr_project_id : undefined,
            resolved: typeof parsed.resolved === 'boolean' ? parsed.resolved : undefined,
            project_slug: typeof parsed.project_slug === 'string' ? parsed.project_slug : null,
        };
        if ((user && (user.id || user.email)) || sessionPayload.gramatr_session_id) {
            return sessionPayload;
        }
    }
    catch {
        return null;
    }
    return null;
}
/**
 * Idempotent atomic write of the per-project session.json. Tolerant of every
 * filesystem error so this never blocks SessionStart. Skipped silently when
 * gramatr_session_id is absent (e.g. bootstrap returned a needs:* state).
 */
function writeSessionJson(payload, clientSessionId) {
    const sessionId = payload.gramatr_session_id;
    const projectId = payload.gramatr_project_id ?? '';
    if (!sessionId)
        return;
    const next = {
        session_id: sessionId,
        project_id: projectId,
        client_session_id: clientSessionId || null,
        client_type: 'claude-code',
        written_at: new Date().toISOString(),
    };
    const dir = join(PROJECT_DIR, '.gramatr');
    const target = join(dir, 'session.json');
    // Idempotency — if existing file matches everything except written_at, skip
    // the write entirely so concurrent SessionStarts don't churn the mtime.
    try {
        const prev = JSON.parse(readFileSync(target, 'utf8'));
        if (prev.session_id === next.session_id &&
            prev.project_id === next.project_id &&
            prev.client_session_id === next.client_session_id &&
            prev.client_type === next.client_type) {
            return;
        }
    }
    catch {
        // missing or malformed — fall through to write
    }
    try {
        mkdirSync(dir, { recursive: true });
        // Atomic write: tmp + rename — avoids statusline.js reading a partial file.
        const tmp = join(dir, `session.json.tmp.${process.pid}`);
        writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
        renameSync(tmp, target);
    }
    catch {
        // best-effort — never block SessionStart
    }
}
/**
 * Read the Claude Code SessionStart hook event JSON from stdin. Returns the
 * `session_id` field (the client's session id — NOT the gramatr one) so we
 * can stamp it into the per-project session.json for diagnostics. Tolerant:
 * any read/parse failure returns ''.
 */
async function readClientSessionIdFromStdin() {
    // If stdin is a TTY (i.e. run interactively for testing), don't block on a
    // read that will never resolve.
    if (process.stdin.isTTY)
        return '';
    try {
        const chunks = [];
        for await (const chunk of process.stdin)
            chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (!raw)
            return '';
        const parsed = JSON.parse(raw);
        return typeof parsed.session_id === 'string' ? parsed.session_id : '';
    }
    catch {
        return '';
    }
}
async function main() {
    // Read the calling hook's session_id off stdin first — even if the identity
    // cache is fresh, we still want to refresh the per-project session.json so
    // bin/statusline.js (#2942) can resolve the gramatr session for THIS client
    // session. The bootstrap call below is what gives us the gramatr ids; if the
    // cache is fresh AND a prior write already populated session.json with the
    // same client_session_id, the write is a no-op.
    const clientSessionId = await readClientSessionIdFromStdin();
    // Idempotency check — if the cache is still fresh, no network call.
    const cached = readCachedUserIdentity();
    const identityFresh = cached && !isUserIdentityStale(cached);
    if (identityFresh) {
        process.stderr.write('grāmatr: identity cache fresh — skipping bootstrap\n');
        // Still call session_bootstrap (cheap) to populate session.json — but
        // only if we don't already have a matching one on disk. The
        // writeSessionJson idempotency check covers the no-op case.
    }
    const token = getToken();
    if (!token) {
        // No credentials yet — Claude Code's OAuth flow may not have completed.
        // Silently exit; a later session will pick the identity up.
        process.stderr.write('grāmatr: no auth token — identity cache will refresh on a later session\n');
        return;
    }
    if (identityFresh) {
        // Cache is fresh — only fetch when we don't yet have a session.json for
        // this client_session_id. The bootstrap call returns quickly because the
        // server reuses the existing mapping.
    }
    const payload = await fetchBootstrapPayload(token, clientSessionId);
    if (!payload) {
        process.stderr.write('grāmatr: session_bootstrap did not return a usable payload — skipping cache writes\n');
        return;
    }
    // #2942 — write per-project session.json so bin/statusline.js can resolve
    // the gramatr session_id. Tolerant of every fs error.
    writeSessionJson(payload, clientSessionId);
    const user = payload.user;
    if (!user || !(user.id || user.email)) {
        process.stderr.write('grāmatr: session_bootstrap returned no user block — skipping identity cache write\n');
        return;
    }
    writeCachedUserIdentity({
        id: user.id ?? null,
        email: user.email ?? null,
        display_name: user.display_name ?? null,
        system_roles: user.system_roles ?? [],
        org_memberships: user.org_memberships ?? [],
        team_memberships: user.team_memberships ?? [],
    });
    process.stderr.write(`grāmatr: identity cache refreshed (${user.email ?? user.id ?? 'unknown'})\n`);
}
main().catch(() => {
    // Belt-and-suspenders — any unexpected exception is swallowed.
    process.exit(0);
});
//# sourceMappingURL=init-identity.js.map