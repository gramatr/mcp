export function resolveHookClientRuntime(args = []) {
    if (args.includes('--codex')) {
        return {
            clientType: 'codex',
            agentName: 'Codex',
            modeFlag: '--codex',
        };
    }
    if (args.includes('--gemini')) {
        return {
            clientType: 'gemini_cli',
            agentName: 'Gemini CLI',
            modeFlag: '--gemini',
        };
    }
    return {
        clientType: 'claude_code',
        agentName: 'Claude Code',
        modeFlag: '--claude',
    };
}
//# sourceMappingURL=client-runtime.js.map