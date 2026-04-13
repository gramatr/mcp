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
    current_session?: {
        session_id?: string;
        transcript_path?: string;
        last_updated?: string;
        token_limit?: number;
        interaction_id?: string;
        gramatr_entity_id?: string;
        helper_pid?: number | null;
        last_classification?: {
            timestamp?: string;
            original_prompt?: string;
            effort_level?: string | null;
            intent_type?: string | null;
            confidence?: number | null;
            memory_tier?: string | null;
            memory_scope?: string | null;
            classifier_model?: string | null;
            downstream_model?: string | null;
            client_type?: string | null;
            agent_name?: string | null;
            pending_feedback?: boolean;
            feedback_submitted_at?: string | null;
        };
    };
    last_compact?: {
        timestamp?: string;
        summary?: string;
        turns?: unknown[];
        metadata?: {
            files_changed?: string[];
            commits?: string[];
        };
    } | null;
    continuity_stats?: {
        successful_restores?: number;
        failed_restores?: number;
        total_sessions?: number;
        total_compacts?: number;
        total_clears?: number;
        last_restore_quality?: string;
        total_compacts_prevented?: number;
    };
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
    last_session_id?: string;
    metadata?: {
        created?: string;
        updated?: string;
        last_session_end_reason?: string;
    };
    migrated_at?: string;
}
export interface MctToolCallError {
    reason: 'auth' | 'http_error' | 'mcp_error' | 'parse_error' | 'timeout' | 'network_error' | 'unknown';
    detail: string;
    status?: number;
}
export interface MctToolCallResult<T = unknown> {
    data: T | null;
    error: MctToolCallError | null;
    rawText: string | null;
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
export declare function saveLastClassification(rootDir: string, classification: NonNullable<GmtrConfig['current_session']>['last_classification']): void;
export declare function markClassificationFeedbackSubmitted(rootDir: string, submittedAt?: string): void;
/** Migrate config from v2.0 to v2.1 if needed */
export declare function migrateConfig(config: GmtrConfig, projectId: string): GmtrConfig;
/** Create a fresh v2.1 config */
export declare function createDefaultConfig(options: {
    projectId: string;
    projectName: string;
    gitRemote: string;
    sessionId: string;
    transcriptPath: string;
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
/**
 * Call an MCP tool via the gramatr server.
 * Handles SSE response parsing, auth, and timeouts.
 */
export declare function callMcpTool(toolName: string, args: Record<string, unknown>, timeoutMs?: number): Promise<unknown | null>;
export declare function callMcpToolDetailed<T = unknown>(toolName: string, args: Record<string, unknown>, timeoutMs?: number): Promise<MctToolCallResult<T>>;
/**
 * Call MCP tool and return raw SSE inner JSON text (unparsed inner).
 * Useful when you need to grep specific fields from the response.
 */
export declare function callMcpToolRaw(toolName: string, args: Record<string, unknown>, timeoutMs?: number): Promise<string | null>;
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