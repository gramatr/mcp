export interface HookClientRuntime {
    clientType: 'claude_code' | 'codex' | 'gemini_cli' | 'opencode';
    agentName: 'Claude Code' | 'Codex' | 'Gemini CLI' | 'OpenCode';
    modeFlag: '--claude-code' | '--codex' | '--gemini' | '--opencode';
    /** Slash command to clear context in this client, or null if unsupported. */
    clearCommand: '/clear' | null;
    /** True when the client supports a hook-driven clear cycle (inject message → user runs clearCommand). */
    supportsHookedClear: boolean;
}
export declare function resolveHookClientRuntime(args?: string[]): HookClientRuntime;
//# sourceMappingURL=client-runtime.d.ts.map