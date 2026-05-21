/**
 * setup-config-io — Config file reading/writing, path resolution, managed block helpers.
 *
 * Extracted from setup.ts for SRP: pure I/O utilities with no setup orchestration.
 */
declare const HOME: string;
export declare function getClaudeConfigPath(): string;
export declare function getClaudeSettingsPath(): string;
export declare function getCodexHooksPath(): string;
export declare function getCodexConfigPath(): string;
export declare function getClaudeMarkdownPath(): string;
export declare function getCodexAgentsPath(): string;
export declare function getGramatrSettingsPath(): string;
/**
 * #2453 — Detect and clear a stale `Bearer` token from the user's Claude Code
 * MCP-server config (`~/.claude.json`).
 *
 * Some users have a legacy `mcpServers.gramatr` entry of `type: "http"` that
 * stores the auth token in `headers.Authorization`. When Redis evicts the
 * token, the server rejects the request with 401 AUTH_REQUIRED. Claude Code
 * then runs its built-in MCP OAuth handler, but the stale header is still
 * mounted on the connection and (as of Claude Code v?.?) the new token from
 * the OAuth callback is NOT written back to disk. This leaves the user in a
 * dead loop: stale token → 401 → OAuth dance → no token write → 401 → …
 *
 * The fix from @gramatr/mcp's side: strip the stale header out of
 * `~/.claude.json` proactively (during `gramatr login` and friends) so the
 * next connection attempt either succeeds anonymously (if the server allows
 * it, triggering Claude Code's OAuth from a clean state) or fails fast with
 * a clear "no token" error rather than the misleading "auth loop".
 *
 * This function ONLY clears the `Authorization` (and `authorization`) entries
 * from `mcpServers.gramatr.headers`. It preserves every other key in the
 * file, including non-gramatr mcpServers entries and unrelated headers.
 *
 * Returns true when a stale header was found and removed, false otherwise.
 */
export declare function clearStaleClaudeJsonAuthHeader(configPath?: string): boolean;
/**
 * #2455 — Write the gramatr access token into `~/.claude.json` as the
 * `mcpServers.gramatr.headers.Authorization` Bearer header so Claude Code's
 * built-in MCP client can authenticate against the gramatr HTTP transport.
 *
 * Claude Code reads bearer tokens from `~/.claude.json` (not `~/.gramatr.json`),
 * so the canonical gramatr CLI config file (`~/.gramatr.json`) is invisible to
 * it. This helper bridges that gap: every successful login path also writes
 * the new token here so headless SSH users (and anyone whose Claude Code MCP
 * OAuth dance silently fails) have a working bearer header immediately.
 *
 * Behaviour:
 *   - Missing file → creates skeleton `{ mcpServers: { gramatr: {...} } }`
 *   - Existing file with no `mcpServers` → adds the `gramatr` entry only
 *   - Existing `mcpServers.gramatr` → preserves every non-conflicting key
 *     (e.g. custom `env`, `type`, extra headers) and only updates
 *     `headers.Authorization`, `url` (if changed), and `type`
 *   - Existing `mcpServers.other-thing` → left untouched
 *   - Malformed JSON → throws (fail loud — never silently overwrite)
 *   - Atomic write via temp file + rename to avoid partial writes
 *   - Restrictive 0o600 mode preserved (or applied if file is new)
 *
 * Returns true on successful write, false when the file is owned by another
 * user / unwritable (warn-don't-crash).
 */
export declare function writeClaudeJsonAuthHeader(token: string, opts?: {
    url?: string;
    configPath?: string;
}): boolean;
/**
 * Compare the token in `~/.gramatr.json` against the Bearer header in
 * `~/.claude.json`. Returns:
 *   - `synced` — both contain the same token (or both have no token)
 *   - `diverged` — both exist but differ (manual edit, or write-bridge skipped)
 *   - `missing-claude` — `~/.gramatr.json` has a token but `~/.claude.json` does not
 *   - `missing-gramatr` — `~/.claude.json` has a token but `~/.gramatr.json` does not
 *   - `neither` — no token in either file
 *   - `unreadable` — one of the files is malformed / unreadable
 */
export declare function getClaudeJsonSyncState(opts?: {
    gramatrJsonPath?: string;
    claudeJsonPath?: string;
}): "synced" | "diverged" | "missing-claude" | "missing-gramatr" | "neither" | "unreadable";
export declare function readJsonFile<T>(path: string, fallback: T): T;
/**
 * Read existing Claude config or return empty.
 */
export declare function readClaudeConfig(configPath: string): Record<string, unknown>;
export declare function escapeRegExp(text: string): string;
export declare function upsertManagedBlock(existing: string, content: string, startMarker: string, endMarker: string): string;
export declare function parseJson(path: string): Record<string, unknown> | null;
export declare function readManagedBlock(path: string, startMarker: string, endMarker: string): string | null;
export declare function ensureLocalSettings(): void;
export declare function hasHookCommand(config: Record<string, unknown> | null, eventName: string, needle: string): boolean;
export declare function getGramatrPluginDir(): string;
export declare function writeMarketplaceManifest(gramatrDir: string): void;
export declare function writePluginFiles(pluginDir: string, pluginJson: Record<string, unknown>, hooksJson: Record<string, unknown>, mcpJson: Record<string, unknown>): void;
export declare function removeGramatrHooks(settings: Record<string, unknown>): Record<string, unknown>;
/**
 * Add or update the gramatr plugin registration in Claude Code settings.
 *
 * @param settings      - Existing Claude Code settings object.
 * @param gramatrDir    - Local gramatr directory (used as fallback when remoteUrl is absent).
 * @param remoteUrl     - Hosted marketplace URL (e.g. 'https://api.gramatr.com/marketplace').
 *                        When provided, this takes precedence over the local file:// URL so
 *                        Claude Code fetches plugin assets from the hosted server rather than
 *                        requiring a local @gramatr/mcp installation.
 *                        Defaults to 'https://api.gramatr.com/marketplace'.
 */
export declare function addPluginRegistration(settings: Record<string, unknown>, gramatrDir: string, remoteUrl?: string): Record<string, unknown>;
export { HOME };
//# sourceMappingURL=setup-config-io.d.ts.map