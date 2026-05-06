/**
 * Generated: 2026-04-20T19:38:13.009Z
 * Source: contracts/hooks/hook-registry.yaml
 *
 * Authoritative hook registry. Do NOT edit manually.
 * Run `pnpm generate:contracts` after changing hook-registry.yaml.
 *
 * execution: local  — requires shell; Claude Code / Codex / Gemini CLI only
 * execution: remote — safe for Anthropic/OpenAI sandbox (claude-addon, etc.)
 */
export interface HookRegistryEntry {
    name: string;
    description: string;
    event: string;
    execution: 'local' | 'remote';
    status: 'active' | 'internal' | 'deprecated';
}
export declare const HOOK_MANIFEST: readonly HookRegistryEntry[];
export declare const HOOK_NAMES: readonly string[];
export declare const LOCAL_HOOKS: ReadonlySet<string>;
export declare const REMOTE_HOOKS: ReadonlySet<string>;
export type HookName = 'agent-gate' | 'agent-verify' | 'edit-tracker' | 'git-gate' | 'input-validator' | 'instructions-loaded' | 'rating-capture' | 'session-end' | 'session-start' | 'stop' | 'subagent-route' | 'task-quality-gate' | 'tool-tracker' | 'user-prompt-submit';
//# sourceMappingURL=hook-registry.d.ts.map