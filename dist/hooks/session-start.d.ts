/**
 * session-start.ts — gramatr SessionStart hook (migrated to @gramatr/mcp).
 *
 * Phase 1 migration of #652: identical behavior to packages/client/hooks/
 * session-start.hook.ts, but packaged as a library function the hook
 * dispatcher can invoke. stdin/stdout contract matches Claude Code's hook
 * protocol exactly — no behavioral changes.
 *
 * TRIGGER: SessionStart
 * OUTPUT: stderr (user display), stdout (Claude context injection)
 */
/**
 * runSessionStartHook — entry point invoked by the hook dispatcher.
 *
 * Never throws. Any error is logged to stderr and the function returns 0
 * so Claude Code does not block the session on a hook failure.
 */
export declare function runSessionStartHook(_args?: string[]): Promise<number>;
//# sourceMappingURL=session-start.d.ts.map