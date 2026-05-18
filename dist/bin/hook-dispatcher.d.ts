/**
 * hook-dispatcher.ts — runHook() entry point for the `gramatr hook`
 * subcommand family.
 *
 * Phase 1 (#652): dispatches to hook runners in ../hooks/. Kept intentionally
 * small — this module is on the cold-start path for every SessionStart
 * invocation, and we pay ~30–60ms per unused import on a warm disk.
 *
 * Exit codes:
 *   0 — hook ran successfully (or degraded gracefully)
 *   1 — invalid args (missing hook name)
 *   2 — unknown hook name
 */
/**
 * Look up and execute a hook by name.
 *
 * The hook module is imported dynamically so the dispatcher pays zero import
 * cost for hooks the user did not ask for.
 */
export declare function runHook(name: string | undefined, args: string[]): Promise<number>;
//# sourceMappingURL=hook-dispatcher.d.ts.map