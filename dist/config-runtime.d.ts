/**
 * @gramatr/mcp — config-runtime.ts
 *
 * Canonical env-access surface for `@gramatr/mcp`. All `process.env.*` reads
 * in this package funnel through this module so hook code and bin entry
 * points never touch `process.env` directly.
 *
 * This matches the per-package canonical-config-home convention encoded in
 * `scripts/lint/check-process-env.ts` (rubric dimension C1). Each package
 * owns its own `config*.ts` file as its canonical env-access home — this
 * file is the mcp package's home.
 *
 * Design notes:
 *   - Deliberately standalone. `@gramatr/mcp` ships as a lightweight
 *     universal adapter, so it does NOT depend on `@gramatr/core/config`
 *     (which pulls JWT, OIDC, Firebase, DB, Redis — way too heavy for a
 *     hook subprocess that must cold-start in <250ms).
 *   - Reads env vars on every call (no caching). Env is static for the
 *     life of a process, but hook subprocesses are short-lived so caching
 *     would be pointless complexity.
 *   - Home directory resolution prefers POSIX `HOME` then Windows
 *     `USERPROFILE`, matching the cross-platform contract the legacy
 *     client hooks assumed.
 */
/**
 * Gramatr auth token resolved from environment variables.
 *
 * Priority (first non-empty wins):
 *   1. `GRAMATR_TOKEN` — canonical, current
 *   2. `AIOS_MCP_TOKEN` — legacy alias from the pre-rebrand era, retained
 *      for backwards compatibility with users who haven't rotated env vars
 *
 * Returns `null` if neither is set. Caller is responsible for falling back
 * to config files (`~/.gramatr/settings.json`, `~/.gramatr.json`, etc).
 */
export declare function getGramatrTokenFromEnv(): string | null;
/**
 * Override URL for the gramatr remote MCP server.
 *
 * Returns `null` if `GRAMATR_URL` is not set. Caller is responsible for
 * falling back to config file values or a built-in default.
 */
export declare function getGramatrUrlFromEnv(): string | null;
/**
 * Override directory for gramatr config, logs, queue files, etc.
 *
 * Returns `null` if `GRAMATR_DIR` is not set. Caller typically joins this
 * against `getHomeDir()` to build the default `~/.gramatr` path.
 */
export declare function getGramatrDirFromEnv(): string | null;
/**
 * Cross-platform user home directory.
 *
 * Prefers POSIX `HOME`, falls back to Windows `USERPROFILE`. Returns an
 * empty string if neither is set — callers should treat empty string as
 * an error condition and handle it explicitly rather than blindly
 * concatenating.
 */
export declare function getHomeDir(): string;
/**
 * Hook/runtime timeout override in milliseconds.
 *
 * Falls back to the provided default when unset or invalid.
 */
export declare function getGramatrTimeoutFromEnv(defaultMs: number): number;
/**
 * Feature flag for prompt enrichment hooks.
 *
 * Returns false only when explicitly disabled with `GRAMATR_ENRICH=0`.
 */
export declare function isGramatrEnrichEnabledFromEnv(): boolean;
/**
 * Turn threshold for auto-compact. When a session reaches this many turns,
 * UserPromptSubmit saves a compact snapshot and injects a clear/restore directive.
 * Override with GRAMATR_COMPACT_TURNS env var. Default: 15.
 */
export declare function getCompactTurnThresholdFromEnv(): number;
/**
 * Override path for the daemon Unix socket.
 * Used in tests to isolate the daemon from ~/.gramatr/daemon.sock.
 * Returns null when the env var is not set.
 */
export declare function getGramatrDaemonSocketFromEnv(): string | null;
/**
 * Override path for the gramatr SQLite state database.
 * Returns ':memory:' when set to that value (used in tests to avoid filesystem).
 * Returns null when not set — callers fall back to ~/.gramatr/state.db.
 */
export declare function getGramatrStateDatabaseFromEnv(): string | null;
/**
 * Downstream model alias for Claude-family hook runtimes.
 *
 * Priority:
 *   1. `ANTHROPIC_MODEL`
 *   2. `CLAUDE_MODEL`
 */
export declare function getClaudeModelFromEnv(): string | null;
/**
 * Packet delivery mode for hook enrichment.
 *
 * - `wait` (default): block briefly for Packet 2 and return merged context
 * - `instant`: return Packet 1 immediately and let the model fetch Packet 2
 */
export declare function getGramatrPacketModeFromEnv(): 'wait' | 'instant';
/**
 * Max wait time for Packet 2 readiness in milliseconds.
 *
 * Defaults to 20000ms. Invalid values fall back to default.
 */
export declare function getGramatrPacket2WaitMsFromEnv(defaultMs?: number): number;
//# sourceMappingURL=config-runtime.d.ts.map