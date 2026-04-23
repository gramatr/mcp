export function resolveHookClientRuntime(args = []) {
    if (args.includes('--codex')) {
        return {
            clientType: 'codex',
            agentName: 'Codex',
            modeFlag: '--codex',
            clearCommand: '/clear',
            supportsHookedClear: true,
        };
    }
    if (args.includes('--gemini')) {
        return {
            clientType: 'gemini_cli',
            agentName: 'Gemini CLI',
            modeFlag: '--gemini',
            clearCommand: null,
            supportsHookedClear: false,
        };
    }
    if (args.includes('--claude-code')) {
        return {
            clientType: 'claude_code',
            agentName: 'Claude Code',
            modeFlag: '--claude-code',
            clearCommand: '/clear',
            supportsHookedClear: true,
        };
    }
    // gramatr-allow: B1 — hook entry point, no @gramatr/core dependency in thin CLI shim
    throw new Error('Missing client runtime flag. Pass --claude-code, --codex, or --gemini to identify the calling agent.');
}
//# sourceMappingURL=client-runtime.js.map