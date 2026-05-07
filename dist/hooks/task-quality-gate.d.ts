/**
 * task-quality-gate.ts — TaskCreated hook.
 *
 * Fires before a TaskCreate tool call is accepted. Reads the `tool_input`
 * from stdin, extracts the Quality Gate criteria fields, and validates:
 *   1. At least 4 criteria are present.
 *   2. Each criterion is 8-12 words long.
 *   3. At least 1 anti-criterion is present — identified by the criterion
 *      text containing "NOT" / "must not" / "anti-criterion", or an ID
 *      matching /^QG-A/ or /^ISC-A/.
 *
 * Output contract mirrors PreToolUse:
 *   { hookSpecificOutput: { hookEventName: 'TaskCreated', permissionDecision: 'allow' } }
 *   { hookSpecificOutput: { hookEventName: 'TaskCreated', permissionDecision: 'deny', permissionDecisionReason: ... } }
 *
 * To maximise compatibility with different Claude Code versions, the hook
 * also emits `{ continue: true|false, stopReason }` alongside the structured
 * permission block — unrecognised fields are ignored by clients that use
 * one contract and not the other.
 *
 * Graceful degradation: any internal parse error outputs `continue: true`
 * so a hook failure never blocks task creation.
 */
interface RawCriterion {
    id?: string;
    text?: string;
    description?: string;
    criterion?: string;
    is_anti?: boolean;
    type?: string;
}
interface QualityGateDecision {
    allow: boolean;
    reason?: string;
}
export declare function isAntiCriterion(c: RawCriterion): boolean;
export declare function criterionText(c: RawCriterion): string;
export declare function wordCount(text: string): number;
/**
 * Extract criteria from the TaskCreate tool_input. Accepts multiple shapes so
 * the hook is tolerant of evolving TaskCreate schemas:
 *   - `quality_gate_criteria`: array of strings or objects
 *   - `criteria`: array of strings or objects
 *   - `acceptance_criteria`: array of strings or objects
 */
export declare function extractCriteria(toolInput: Record<string, unknown> | undefined): RawCriterion[];
export declare function validateQualityGate(toolInput: Record<string, unknown> | undefined): QualityGateDecision;
export declare function runTaskQualityGateHook(_args?: string[]): Promise<number>;
export {};
//# sourceMappingURL=task-quality-gate.d.ts.map