/**
 * statusline.ts — Smart local statusline renderer for Claude Code.
 *
 * Called by the Claude Code statusLine config field on each render cycle.
 * Reads the hooks-listener port from ~/.gramatr/.hooks-port. If the file
 * doesn't exist the hook environment isn't active — exits silently (empty).
 *
 * Data path: local SQLite (token savings) + daemon session context (call count).
 * No remote HTTP calls — works entirely within the local hook environment.
 */
export declare function runStatusline(args: string[]): Promise<void>;
//# sourceMappingURL=statusline.d.ts.map