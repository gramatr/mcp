/**
 * statusline.ts — grāmatr intelligence statusline for Claude Code.
 *
 * Called by the Claude Code statusLine config field on each render cycle.
 * Reads the hooks-listener port from ~/.gramatr/.hooks-port (PORT:PID format).
 * Validates the PID is still alive before connecting — avoids 2s timeout
 * burns on stale port files left behind by SIGKILL or unhandled exits.
 *
 * No git info. No remote HTTP calls. Pure grāmatr intelligence signal.
 */
export declare function runStatusline(args: string[]): Promise<void>;
//# sourceMappingURL=statusline.d.ts.map