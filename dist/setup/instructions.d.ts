export declare const CLAUDE_BLOCK_START: "<!-- GRAMATR-START -->";
export declare const CLAUDE_BLOCK_END: "<!-- GRAMATR-END -->";
export declare const CODEX_BLOCK_START: "<!-- GRAMATR-CODEX-START -->";
export declare const CODEX_BLOCK_END: "<!-- GRAMATR-CODEX-END -->";
export type InstallPromptTarget = 'claude-code' | 'codex' | 'gemini-cli' | 'opencode' | 'claude-web' | 'claude-desktop' | 'chatgpt-web' | 'chatgpt-desktop' | 'cursor' | 'windsurf' | 'vscode';
export declare const CLAUDE_CODE_GUIDANCE: string;
export declare const CODEX_GUIDANCE: string;
export declare function buildInstallPromptSuggestion(target: InstallPromptTarget): string;
//# sourceMappingURL=instructions.d.ts.map