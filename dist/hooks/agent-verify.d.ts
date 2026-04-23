/**
 * agent-verify.ts — PostToolUse hook for the Agent tool.
 *
 * After a sub-agent completes, reads the latest classification from SQLite
 * and emits a Quality Gate verification reminder to stderr. This is advisory only —
 * PostToolUse hooks cannot deny operations.
 */
export declare function runAgentVerifyHook(_args?: string[]): Promise<number>;
//# sourceMappingURL=agent-verify.d.ts.map