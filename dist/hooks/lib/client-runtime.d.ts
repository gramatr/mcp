export interface HookClientRuntime {
    clientType: 'claude_code' | 'codex' | 'gemini_cli';
    agentName: 'Claude Code' | 'Codex' | 'Gemini CLI';
    modeFlag: '--claude' | '--codex' | '--gemini';
}
export declare function resolveHookClientRuntime(args?: string[]): HookClientRuntime;
//# sourceMappingURL=client-runtime.d.ts.map