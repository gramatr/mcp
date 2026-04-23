/**
 * compact-writer.ts — Build and persist a compact context snapshot.
 *
 * Called by UserPromptSubmit when the session turn count crosses the threshold,
 * or manually via /gramatr-compact. Writes to two places:
 *   1. state.db compacts table (indexed by ID, for /gmtr-restore <id>)
 *   2. .gramatr/settings.json last_compact (pointer for auto-restore on session-start)
 */
export interface CompactResult {
    id: string;
    summary: string;
    turnCount: number;
}
export declare function writeCompact(opts: {
    sessionId: string;
    projectId: string | null;
    projectSlug: string;
    gitRoot: string | null;
}): CompactResult;
/** Build the injection message for the agent based on client capabilities. */
export declare function buildCompactInjection(opts: {
    compactId: string;
    turnCount: number;
    turnThreshold: number;
    supportsHookedClear: boolean;
    clearCommand: string | null;
}): string;
//# sourceMappingURL=compact-writer.d.ts.map