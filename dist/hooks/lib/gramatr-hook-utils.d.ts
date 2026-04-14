/**
 * gramatr-hook-utils.ts — Shared utilities for all gramatr hooks
 *
 * Provides common functions: stdin reading, git context, config management,
 * MCP transport, auth token resolution, logging.
 *
 * ZERO external CLI dependencies — uses native TypeScript/Bun APIs only.
 */
export interface HookInput {
    session_id: string;
    transcript_path?: string;
    cwd?: string;
    permission_mode?: string;
    hook_event_name?: string;
    message?: string;
    prompt?: string;
    reason?: string;
}
export interface GitContext {
    root: string;
    remote: string;
    branch: string;
    commit: string;
    projectName: string;
}
export interface GmtrConfig {
    version?: string;
    config_version?: string;
    project_entity_id: string | null;
    project_id?: string;
    project_name?: string;
    previously_known_as?: string[];
    git_remote?: string;
    last_compact?: {
        timestamp?: string;
        summary?: string;
        turns?: unknown[];
        metadata?: {
            files_changed?: string[];
            commits?: string[];
        };
    } | null;
    related_entities?: {
        databases?: unknown[];
        people?: unknown[];
        services?: unknown[];
        concepts?: unknown[];
        projects?: unknown[];
    };
    project_ref?: {
        git_remote?: string;
        local_path?: string;
        display_name?: string;
    };
    metadata?: {
        created?: string;
        updated?: string;
        last_session_end_reason?: string;
    };
    migrated_at?: string;
}
/** Write message to stderr (visible to user in terminal) */
export declare function log(msg: string): void;
/** ISO timestamp in UTC */
export declare function now(): string;
/** Read and parse JSON from stdin (hook input) */
export declare function readHookInput(): Promise<HookInput>;
/** Get git context for current directory. Returns null if not in a git repo. */
export declare function getGitContext(): GitContext | null;
/**
 * Derive normalized project_id from git remote URL.
 * Handles: https://github.com/org/repo.git, git@github.com:org/repo.git, etc.
 * Returns org/repo format, or fallback project name.
 */
export declare function deriveProjectId(gitRemote: string, fallbackName?: string): string;
/** Get the path to .gramatr/settings.json for a given root directory */
export declare function getConfigPath(rootDir: string): string;
/** Read .gramatr/settings.json. Returns null if not found or invalid. */
export declare function readGmtrConfig(rootDir: string): GmtrConfig | null;
/** Write .gramatr/settings.json atomically (write .tmp, then rename) */
export declare function writeGmtrConfig(rootDir: string, config: GmtrConfig): void;
/** Migrate config from v2.0 to v2.1 if needed */
export declare function migrateConfig(config: GmtrConfig, projectId: string): GmtrConfig;
/** Create a fresh v2.1 config */
export declare function createDefaultConfig(options: {
    projectId: string;
    projectName: string;
    gitRemote: string;
}): GmtrConfig;
/**
 * Resolve auth token. gramatr credentials NEVER live in CLI-specific config files.
 *
 * Priority:
 *   1. ~/.gramatr.json (canonical, gramatr-owned, vendor-agnostic)
 *   2. GRAMATR_TOKEN env var (CI, headless override)
 *   3. ~/.gramatr/settings.json auth.api_key (legacy, will be migrated)
 *
 * Token is NEVER stored in ~/.claude.json, ~/.codex/, or ~/.gemini/.
 */
export declare function resolveAuthToken(): string | null;
/**
 * Resolve MCP server URL from config files.
 * Priority: ~/.gramatr/settings.json > GRAMATR_URL env > ~/.claude.json > default
 */
export declare function resolveMcpUrl(): string;
/** Check gramatr server health. Returns true if reachable. */
export declare function checkServerHealth(timeoutMs?: number): Promise<{
    healthy: boolean;
    detail: string;
}>;
/** Read a JSON file. Returns null on failure. */
export declare function readJsonFile<T = unknown>(filePath: string): T | null;
/** Write JSON file (non-atomic, for temp files). */
export declare function writeJsonFile(filePath: string, data: unknown): void;
/** Append a line to a file */
export declare function appendLine(filePath: string, line: string): void;
/** Get commit count since a given timestamp */
export declare function getCommitCountSince(since: string): number;
/** Get formatted commit log since a timestamp */
export declare function getCommitLogSince(since: string, maxCount?: number): string[];
/** Get short commit log (hash + subject) since a timestamp */
export declare function getCommitsSince(since: string, maxCount?: number): string[];
/** Get git status --short output */
export declare function getGitStatusShort(maxLines?: number): string[];
/** Get files changed between two refs */
export declare function getFilesChanged(fromRef: string, toRef?: string, maxCount?: number): string[];
/** Get recent commit log (formatted for display) */
export declare function getRecentCommits(count?: number): string[];
//# sourceMappingURL=gramatr-hook-utils.d.ts.map