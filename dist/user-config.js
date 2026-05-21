/**
 * @gramatr/mcp — user-config.ts
 *
 * Read/write helpers for the canonical-user-identity cache stored in
 * `~/.gramatr.json` under the `user` key.
 *
 * Context (Issue #2907)
 * ─────────────────────
 * Client platforms (Claude Code, Cursor, ChatGPT, etc.) inject their own
 * subscription/OS identity into the agent's prompt environment
 * (`bdh@handrigan.net` for Brian's Claude subscription, for example). That
 * is NOT the grāmatr user identity, which is bound to the authenticated
 * grāmatr session (`brian@n90.co`).
 *
 * To stop agents from conflating the two, `session_bootstrap` /
 * `session_start` return a canonical `user` block, which the SessionStart
 * hook writes here and the UserPromptSubmit hook reads to inject an
 * Identity block into the Tier 1 packet on every turn. The file is a
 * cache, not a source of truth — the server is authoritative.
 *
 * Forward-looking shape
 * ─────────────────────
 * Brian explicitly called out a follow-on use of this same pattern to
 * cache personal directives / preferences / patterns so hot-path hook
 * code can skip a DB roundtrip. We reserve a top-level `cache` namespace
 * here so that future expansion (e.g. `cache.directives`,
 * `cache.preferences`) doesn't break the user block. Only `user` is
 * populated in this MVP.
 *
 * Existing `~/.gramatr.json` keys are PRESERVED — every writer reads the
 * full file first, merges, and writes back.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getHomeDir } from "./config-runtime.js";
const DEFAULT_TTL_SECONDS = 3600;
function configPath() {
    return join(getHomeDir(), ".gramatr.json");
}
/**
 * Read `~/.gramatr.json` and return the parsed object. Returns `{}` when
 * the file is missing or unreadable so callers can treat absence as an
 * empty config (rather than crashing).
 */
export function readGramatrJson() {
    try {
        const raw = readFileSync(configPath(), "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }
        return {};
    }
    catch {
        return {};
    }
}
/**
 * Read the cached user identity from `~/.gramatr.json`. Returns `null` when
 * no user block has been written yet.
 */
export function readCachedUserIdentity() {
    const cfg = readGramatrJson();
    if (!cfg.user || typeof cfg.user !== "object")
        return null;
    return cfg.user;
}
/**
 * Merge a partial user-identity update into `~/.gramatr.json`. The merge is
 * shallow on `user` (server fields replace cached fields one-for-one) but
 * preserves any existing keys outside `user` (token, server_url, etc.)
 * and any sibling `user.*` fields the server did not return (e.g. `name`
 * set during install).
 *
 * Always stamps `cached_at` to now and `cache_ttl_seconds` when omitted.
 * Best-effort: write failures are caught and returned as `false` so hook
 * subprocesses can degrade silently rather than crash on a read-only
 * `$HOME`.
 */
export function writeCachedUserIdentity(patch, options) {
    try {
        const cfg = readGramatrJson();
        const existing = cfg.user && typeof cfg.user === "object" ? cfg.user : {};
        const merged = {
            ...existing,
            ...patch,
            cached_at: new Date().toISOString(),
            cache_ttl_seconds: patch.cache_ttl_seconds ?? options?.ttlSeconds ?? existing.cache_ttl_seconds ?? DEFAULT_TTL_SECONDS,
        };
        const next = { ...cfg, user: merged };
        writeFileSync(configPath(), JSON.stringify(next, null, 2) + "\n");
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Returns true when the cached entry has `cached_at` older than its TTL.
 * Missing `cached_at` is treated as stale so callers refresh on first read.
 *
 * Note: staleness is advisory. The hook still injects the cached identity
 * because a stale grāmatr email is still vastly better than letting the
 * agent fall back on the client-platform email.
 */
export function isUserIdentityStale(identity) {
    if (!identity || !identity.cached_at)
        return true;
    const cachedMs = Date.parse(identity.cached_at);
    if (!Number.isFinite(cachedMs))
        return true;
    const ttl = (identity.cache_ttl_seconds ?? DEFAULT_TTL_SECONDS) * 1000;
    return Date.now() - cachedMs > ttl;
}
/**
 * Render the Identity block injected into the Tier 1 packet by the
 * UserPromptSubmit hook. The "USE THIS" / "do NOT use" framing is
 * deliberate — current steering rules ("never-conflate-external-login-
 * with-gramatr-identity") are not enough; the canonical identity must
 * be visually louder than the client-platform context the host injects
 * into CLAUDE.md.
 *
 * Returns an empty string when no useful identity fields are available
 * (cache miss + no client context) so callers can drop the block instead
 * of injecting an empty header.
 */
export function renderIdentityBlock(identity, clientContext) {
    const lines = [];
    if (identity && (identity.email || identity.id)) {
        const idPart = identity.id ? ` (id: ${identity.id})` : "";
        const emailPart = identity.email ?? "(unknown email)";
        lines.push(`gramatr_user: ${emailPart}${idPart} — USE THIS for all grāmatr operations`);
        if (identity.display_name) {
            lines.push(`gramatr_display_name: ${identity.display_name}`);
        }
        if (identity.system_roles && identity.system_roles.length > 0) {
            lines.push(`gramatr_system_roles: ${identity.system_roles.join(", ")}`);
        }
        if (identity.org_memberships && identity.org_memberships.length > 0) {
            const orgs = identity.org_memberships
                .map((m) => (m.org_slug ? `${m.org_slug}${m.role ? `:${m.role}` : ""}` : m.org_id))
                .join(", ");
            lines.push(`gramatr_orgs: ${orgs}`);
        }
    }
    if (clientContext?.platform_user_email) {
        const platform = clientContext.platform ?? "client";
        lines.push(`client_user: ${clientContext.platform_user_email} (${platform} subscription) — do NOT use as grāmatr identity`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=user-config.js.map