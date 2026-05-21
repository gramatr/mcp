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
/** Canonical grāmatr user identity returned by session_bootstrap/session_start. */
export interface CachedOrgMembership {
    org_id: string;
    org_slug?: string | null;
    role?: string | null;
}
export interface CachedTeamMembership {
    team_id: string;
    team_slug?: string | null;
    role?: string | null;
}
export interface CachedUserIdentity {
    /** Display name set during onboarding ("What should grāmatr call you?"). */
    name?: string | null;
    /** Authoritative grāmatr users.id (UUID). */
    id?: string | null;
    /** Authoritative grāmatr email address. */
    email?: string | null;
    /** Full display name from the users row. */
    display_name?: string | null;
    /** Active system roles (e.g. ["super_admin"]). */
    system_roles?: string[];
    /** Active org memberships. */
    org_memberships?: CachedOrgMembership[];
    /** Active team memberships. */
    team_memberships?: CachedTeamMembership[];
    /** ISO-8601 timestamp when this cache entry was last refreshed. */
    cached_at?: string;
    /** Cache lifetime in seconds — readers should treat older entries as stale. */
    cache_ttl_seconds?: number;
}
/**
 * Generic `~/.gramatr.json` shape — kept open-ended on purpose. Many
 * unrelated subsystems (token, server_url, auto_compact, context_window,
 * gramatr_binary, etc.) write to this file; we only touch the keys we own.
 */
export interface GramatrJsonShape {
    user?: CachedUserIdentity;
    cache?: {
        directives?: unknown;
        preferences?: unknown;
        [k: string]: unknown;
    };
    [k: string]: unknown;
}
/**
 * Read `~/.gramatr.json` and return the parsed object. Returns `{}` when
 * the file is missing or unreadable so callers can treat absence as an
 * empty config (rather than crashing).
 */
export declare function readGramatrJson(): GramatrJsonShape;
/**
 * Read the cached user identity from `~/.gramatr.json`. Returns `null` when
 * no user block has been written yet.
 */
export declare function readCachedUserIdentity(): CachedUserIdentity | null;
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
export declare function writeCachedUserIdentity(patch: Partial<CachedUserIdentity>, options?: {
    ttlSeconds?: number;
}): boolean;
/**
 * Returns true when the cached entry has `cached_at` older than its TTL.
 * Missing `cached_at` is treated as stale so callers refresh on first read.
 *
 * Note: staleness is advisory. The hook still injects the cached identity
 * because a stale grāmatr email is still vastly better than letting the
 * agent fall back on the client-platform email.
 */
export declare function isUserIdentityStale(identity: CachedUserIdentity | null): boolean;
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
export declare function renderIdentityBlock(identity: CachedUserIdentity | null, clientContext?: {
    platform?: string | null;
    platform_user_email?: string | null;
} | null): string;
//# sourceMappingURL=user-config.d.ts.map