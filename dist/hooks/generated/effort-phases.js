/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/methodology/effort-phases.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-05-09T14:15:14.227Z
 */
export const PHASES_BY_EFFORT = {
    instant: ["RESPOND"],
    fast: ["OBSERVE", "RESPOND"],
    standard: ["OBSERVE", "PLAN", "BUILD", "VERIFY"],
    extended: ["OBSERVE", "THINK", "PLAN", "BUILD", "EXECUTE", "VERIFY", "LEARN"],
    advanced: ["OBSERVE", "THINK", "PLAN", "BUILD", "EXECUTE", "VERIFY", "LEARN"],
    deep: ["OBSERVE", "THINK", "PLAN", "BUILD", "EXECUTE", "VERIFY", "LEARN"],
    comprehensive: ["OBSERVE", "THINK", "PLAN", "BUILD", "EXECUTE", "VERIFY", "LEARN"],
};
export const FLOORS_BY_EFFORT = {
    instant: { "qg_criteria_floor": 0, "qg_anti_criteria_floor": 0, "thinking_capability_floor": 0, "verification_depth": "none", "learn_required": false },
    fast: { "qg_criteria_floor": 0, "qg_anti_criteria_floor": 0, "thinking_capability_floor": 0, "verification_depth": "none", "learn_required": false },
    standard: { "qg_criteria_floor": 4, "qg_anti_criteria_floor": 1, "thinking_capability_floor": 0, "verification_depth": "recall", "learn_required": false },
    extended: { "qg_criteria_floor": 8, "qg_anti_criteria_floor": 1, "thinking_capability_floor": 2, "verification_depth": "criteria", "learn_required": true },
    advanced: { "qg_criteria_floor": 16, "qg_anti_criteria_floor": 1, "thinking_capability_floor": 4, "verification_depth": "criteria_plus_anti", "learn_required": true },
    deep: { "qg_criteria_floor": 32, "qg_anti_criteria_floor": 2, "thinking_capability_floor": 6, "verification_depth": "cross_vendor_audit", "learn_required": true },
    comprehensive: { "qg_criteria_floor": 64, "qg_anti_criteria_floor": 2, "thinking_capability_floor": 8, "verification_depth": "interview_pass", "learn_required": true },
};
//# sourceMappingURL=effort-phases.js.map