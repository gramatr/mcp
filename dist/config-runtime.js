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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
export function getGramatrTokenFromEnv() {
    const current = process.env.GRAMATR_TOKEN;
    if (current && current.length > 0)
        return current;
    const legacy = process.env.AIOS_MCP_TOKEN;
    if (legacy && legacy.length > 0)
        return legacy;
    return null;
}
/**
 * Override URL for the gramatr remote MCP server.
 *
 * Returns `null` if `GRAMATR_URL` is not set. Caller is responsible for
 * falling back to config file values or a built-in default.
 */
export function getGramatrUrlFromEnv() {
    const url = process.env.GRAMATR_URL;
    return url && url.length > 0 ? url : null;
}
/**
 * Override directory for gramatr config, logs, queue files, etc.
 *
 * Returns `null` if `GRAMATR_DIR` is not set. Caller typically joins this
 * against `getHomeDir()` to build the default `~/.gramatr` path.
 */
export function getGramatrDirFromEnv() {
    const dir = process.env.GRAMATR_DIR;
    return dir && dir.length > 0 ? dir : null;
}
/**
 * Cross-platform user home directory.
 *
 * Prefers POSIX `HOME`, falls back to Windows `USERPROFILE`. Returns an
 * empty string if neither is set — callers should treat empty string as
 * an error condition and handle it explicitly rather than blindly
 * concatenating.
 */
export function getHomeDir() {
    const home = process.env.HOME;
    if (home && home.length > 0)
        return home;
    const userProfile = process.env.USERPROFILE;
    if (userProfile && userProfile.length > 0)
        return userProfile;
    return '';
}
/**
 * Hook/runtime timeout override in milliseconds.
 *
 * Falls back to the provided default when unset or invalid.
 */
export function getGramatrTimeoutFromEnv(defaultMs) {
    const raw = process.env.GRAMATR_TIMEOUT;
    if (!raw || raw.length === 0)
        return defaultMs;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultMs;
}
/**
 * Feature flag for prompt enrichment hooks.
 *
 * Returns false only when explicitly disabled with `GRAMATR_ENRICH=0`.
 */
export function isGramatrEnrichEnabledFromEnv() {
    return process.env.GRAMATR_ENRICH !== '0';
}
/**
 * Full compact config. Priority:
 *   1. ~/.gramatr.json auto_compact.* (canonical)
 *   2. ~/.gramatr/settings.json auto_compact.* (legacy — read until migration deletes it)
 *   3. GRAMATR_COMPACT_TURNS env var (every_turns only)
 *   4. Defaults: every_turns=15, auto=false, remind_every=5
 */
export function getCompactConfig() {
    let every_turns = 15;
    let auto = false;
    let remind_every = 5;
    function applyCompact(ac) {
        if (typeof ac?.every_turns === 'number' && ac.every_turns > 0)
            every_turns = ac.every_turns;
        if (typeof ac?.auto === 'boolean')
            auto = ac.auto;
        if (typeof ac?.remind_every === 'number' && ac.remind_every > 0)
            remind_every = ac.remind_every;
    }
    // 1. ~/.gramatr.json (canonical)
    try {
        const home = getHomeDir();
        const raw = readFileSync(join(home, '.gramatr.json'), 'utf8');
        const cfg = JSON.parse(raw);
        applyCompact(cfg?.auto_compact);
    }
    catch {
        // absent or unparseable — fall through
    }
    // 2. ~/.gramatr/settings.json (legacy)
    try {
        const home = getHomeDir();
        const gmtrDir = getGramatrDirFromEnv() || join(home, '.gramatr');
        const raw = readFileSync(join(gmtrDir, 'settings.json'), 'utf8');
        const cfg = JSON.parse(raw);
        applyCompact(cfg?.auto_compact);
    }
    catch {
        // settings.json absent or unparseable — fall through
    }
    const env = Number.parseInt(process.env.GRAMATR_COMPACT_TURNS ?? '', 10);
    if (Number.isFinite(env) && env > 0)
        every_turns = env;
    return { every_turns, auto, remind_every };
}
/** Back-compat shim — callers that only need the turn threshold. */
export function getCompactTurnThresholdFromEnv() {
    return getCompactConfig().every_turns;
}
/**
 * Override path for the daemon Unix socket.
 * Used in tests to isolate the daemon from ~/.gramatr/daemon.sock.
 * Returns null when the env var is not set.
 */
export function getGramatrDaemonSocketFromEnv() {
    const s = process.env.GRAMATR_DAEMON_SOCKET;
    return s && s.length > 0 ? s : null;
}
/**
 * Override path for the gramatr SQLite state database.
 * Returns ':memory:' when set to that value (used in tests to avoid filesystem).
 * Returns null when not set — callers fall back to ~/.gramatr/state.db.
 */
export function getGramatrStateDatabaseFromEnv() {
    const s = process.env.GRAMATR_STATE_DB;
    return s && s.length > 0 ? s : null;
}
/**
 * Downstream model alias for Claude-family hook runtimes.
 *
 * Priority:
 *   1. `ANTHROPIC_MODEL`
 *   2. `CLAUDE_MODEL`
 */
export function getClaudeModelFromEnv() {
    const anthropic = process.env.ANTHROPIC_MODEL;
    if (anthropic && anthropic.length > 0)
        return anthropic;
    const claude = process.env.CLAUDE_MODEL;
    if (claude && claude.length > 0)
        return claude;
    return null;
}
/**
 * Packet delivery mode for hook enrichment.
 *
 * - `wait` (default): block briefly for Packet 2 and return merged context
 * - `instant`: return Packet 1 immediately and let the model fetch Packet 2
 */
export function getGramatrPacketModeFromEnv() {
    const raw = process.env.GRAMATR_PACKET_MODE?.trim().toLowerCase();
    if (raw === 'instant')
        return 'instant';
    return 'wait';
}
/**
 * Max wait time for Packet 2 readiness in milliseconds.
 *
 * Defaults to 20000ms. Invalid values fall back to default.
 */
export function getGramatrPacket2WaitMsFromEnv(defaultMs = 20000) {
    const raw = process.env.GRAMATR_PACKET2_WAIT_MS;
    if (!raw || raw.length === 0)
        return defaultMs;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultMs;
}
//# sourceMappingURL=config-runtime.js.map