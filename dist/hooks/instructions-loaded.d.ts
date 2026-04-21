/**
 * instructions-loaded.ts — InstructionsLoaded hook.
 *
 * Fires when CLAUDE.md (or another instructions file) is loaded. When the
 * loaded file is gramatr's CLAUDE.md — path contains `.claude/CLAUDE.md`, or
 * content contains the `GRAMATR-START` marker — the hook:
 *
 *   1. Calls `gramatr_resolve_project` with `action: "auto"` (git-derived).
 *   2. Calls `gramatr_session_start` with the resolved project_id.
 *   3. Calls `gramatr_load_handoff` for the project + session.
 *   4. Injects the handoff content as `additionalContext` on stdout so Claude
 *      receives it as part of the session context.
 *   5. Writes a concise success line to stderr.
 *
 * For any non-gramatr CLAUDE.md (or on any error), the hook outputs
 * `{ continue: true }` and returns — graceful degradation is required.
 */
import { type HookInput } from './lib/gramatr-hook-utils.js';
import { loadProjectHandoff } from './lib/session.js';
interface InstructionsLoadedInput extends HookInput {
    file_path?: string;
    path?: string;
    content?: string;
    matcher?: string;
}
export declare function isGramatrInstructions(input: InstructionsLoadedInput): boolean;
export declare function formatHandoff(handoff: Awaited<ReturnType<typeof loadProjectHandoff>>, projectName: string | null, openTasks: number | null): string;
export declare function runInstructionsLoadedHook(_args?: string[]): Promise<number>;
export {};
//# sourceMappingURL=instructions-loaded.d.ts.map