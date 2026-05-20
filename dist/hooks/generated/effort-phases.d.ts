/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/methodology/effort-phases.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-05-09T14:15:14.227Z
 */
export declare const PHASES_BY_EFFORT: Record<string, readonly string[]>;
/** #2244 — per-tier floor declarations from Algorithm Doctrine v1.0. */
export interface TierFloor {
    qg_criteria_floor: number;
    qg_anti_criteria_floor: number;
    thinking_capability_floor: number;
    verification_depth: string;
    learn_required: boolean;
}
export declare const FLOORS_BY_EFFORT: Record<string, TierFloor>;
//# sourceMappingURL=effort-phases.d.ts.map