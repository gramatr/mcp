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
export {};
//# sourceMappingURL=init-identity.d.ts.map