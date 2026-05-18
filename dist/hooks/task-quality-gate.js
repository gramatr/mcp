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
import { HOOK_STDIN_DEFAULT_TIMEOUT_MS } from './generated/hook-timeouts.js';
import { FLOORS_BY_EFFORT } from './generated/effort-phases.js';
const VALID_FLOOR_MODES = new Set(['off', 'warn', 'enforce']);
function resolveTierFloorMode() {
    // Hook runs standalone without @gramatr/core config bootstrap (#2244).
    // gramatr-allow: c1
    const raw = (process.env.GRAMATR_TIER_FLOORS_ENFORCE || '').trim().toLowerCase();
    if (VALID_FLOOR_MODES.has(raw))
        return raw;
    return 'warn';
}
// ── Constants ──
const MIN_CRITERIA = 4;
const MIN_WORDS = 8;
const MAX_WORDS = 12;
const DENY_MESSAGE = [
    'Quality Gate criteria required before creating a task.',
    'Format:',
    `  - Minimum ${MIN_CRITERIA} criteria, ${MIN_WORDS}-${MAX_WORDS} words each, describing the ideal end STATE (not actions)`,
    '  - At least 1 anti-criterion: what must NOT happen',
    '',
    'Example:',
    '  QG-C1: "Rate limiter enforces 100 requests per minute per user"',
    '  QG-A1: "No request is silently dropped without a logged error"',
    '',
    'Call TaskCreate again with criteria in the description or quality_gate_criteria field.',
].join('\n');
// ── Stdin ──
function readStdin(timeoutMs) {
    return new Promise((resolve) => {
        let data = '';
        const timer = setTimeout(() => resolve(data), timeoutMs);
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.on('error', () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.resume();
    });
}
// ── Criterion extraction ──
const ANTI_ID_PATTERN = /^(QG-A|ISC-A)/i;
const ANTI_TEXT_PATTERNS = [
    /\bNOT\b/,
    /must not\b/i,
    /anti-criterion/i,
    /never\b/i,
];
export function isAntiCriterion(c) {
    if (c.is_anti === true)
        return true;
    if (typeof c.type === 'string' && c.type.toLowerCase().includes('anti'))
        return true;
    if (typeof c.id === 'string' && ANTI_ID_PATTERN.test(c.id))
        return true;
    const text = c.text || c.description || c.criterion || '';
    return ANTI_TEXT_PATTERNS.some((r) => r.test(text));
}
export function criterionText(c) {
    return (c.text || c.description || c.criterion || '').trim();
}
export function wordCount(text) {
    if (!text)
        return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
}
/**
 * Extract criteria from the TaskCreate tool_input. Accepts multiple shapes so
 * the hook is tolerant of evolving TaskCreate schemas:
 *   - `quality_gate_criteria`: array of strings or objects
 *   - `criteria`: array of strings or objects
 *   - `acceptance_criteria`: array of strings or objects
 */
export function extractCriteria(toolInput) {
    if (!toolInput || typeof toolInput !== 'object')
        return [];
    const keys = ['quality_gate_criteria', 'criteria', 'acceptance_criteria'];
    for (const key of keys) {
        const value = toolInput[key];
        if (Array.isArray(value) && value.length > 0) {
            return value.map((v) => {
                if (typeof v === 'string')
                    return { text: v };
                if (v && typeof v === 'object')
                    return v;
                return { text: String(v) };
            });
        }
    }
    return [];
}
// ── Validation ──
export function validateQualityGate(toolInput) {
    const criteria = extractCriteria(toolInput);
    if (criteria.length < MIN_CRITERIA) {
        return { allow: false, reason: DENY_MESSAGE };
    }
    // Every criterion must be 8-12 words.
    for (const c of criteria) {
        const words = wordCount(criterionText(c));
        if (words < MIN_WORDS || words > MAX_WORDS) {
            return { allow: false, reason: DENY_MESSAGE };
        }
    }
    // At least one anti-criterion must be present.
    if (!criteria.some(isAntiCriterion)) {
        return { allow: false, reason: DENY_MESSAGE };
    }
    return { allow: true };
}
// ── #2244 — Tier floor secondary check (qg only at TaskCreate boundary) ────
// Runs AFTER the bulletproof base validation. Wrapped in try/catch upstream
// so a tier-floor bug can never block TaskCreate.
//
// Mode semantics (D4):
//   - off:     skip entirely
//   - warn:    log + telemetry only, ALLOW
//   - enforce: hard breach? BLOCK. soft breach? log + ALLOW.
// At TaskCreate the only possible severity is SOFT (qg_criteria + qg_anti_criteria
// are always soft per D2), so enforce mode also lets soft floor breaches through.
function extractEffortLevel(toolInput) {
    if (!toolInput || typeof toolInput !== 'object')
        return 'standard';
    const candidates = ['effort_level', 'effort', 'tier'];
    for (const key of candidates) {
        const v = toolInput[key];
        if (typeof v === 'string' && v.length > 0)
            return v;
    }
    return 'standard';
}
export function checkQGFloorsForTaskInput(toolInput) {
    const mode = resolveTierFloorMode();
    const effortLevel = extractEffortLevel(toolInput);
    const floor = FLOORS_BY_EFFORT[effortLevel] ?? null;
    if (mode === 'off' || !floor)
        return { mode, floor, breaches: [], effortLevel };
    const criteriaArr = extractCriteria(toolInput);
    const total = criteriaArr.length;
    const antiCount = criteriaArr.filter(isAntiCriterion).length;
    const criteriaCount = total - antiCount;
    const breaches = [];
    if (criteriaCount < floor.qg_criteria_floor) {
        breaches.push({ breach_type: 'qg_criteria', expected: floor.qg_criteria_floor, actual: criteriaCount });
    }
    if (antiCount < floor.qg_anti_criteria_floor) {
        breaches.push({ breach_type: 'qg_anti_criteria', expected: floor.qg_anti_criteria_floor, actual: antiCount });
    }
    return { mode, floor, breaches, effortLevel };
}
function logTierFloorBreaches(result) {
    for (const b of result.breaches) {
        // Object-first structured log line (NDJSON) so the breach is grep-able
        // by ops without reading code.
        const payload = {
            operation: 'tier_floor_breach',
            tier: result.effortLevel,
            breach_type: b.breach_type,
            expected: b.expected,
            actual: b.actual,
            mode: result.mode,
            severity: 'soft',
            source: 'task-quality-gate-hook',
            timestamp: new Date().toISOString(),
        };
        try {
            process.stderr.write(JSON.stringify(payload) + '\n');
        }
        catch {
            // never throw from a hook
        }
    }
}
function buildOutput(allow, reason) {
    if (allow) {
        return {
            continue: true,
            hookSpecificOutput: { hookEventName: 'TaskCreated', permissionDecision: 'allow' },
        };
    }
    return {
        continue: false,
        stopReason: reason || 'Quality Gate validation failed.',
        hookSpecificOutput: {
            hookEventName: 'TaskCreated',
            permissionDecision: 'deny',
            permissionDecisionReason: reason || 'Quality Gate validation failed.',
        },
    };
}
// ── Hook runner ──
export async function runTaskQualityGateHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_DEFAULT_TIMEOUT_MS);
    if (!raw.trim()) {
        process.stdout.write(JSON.stringify(buildOutput(true)));
        return 0;
    }
    try {
        const input = JSON.parse(raw);
        // Only gate TaskCreate — any other tool is allowed through unchanged.
        if (!input.tool_name || input.tool_name !== 'TaskCreate') {
            process.stdout.write(JSON.stringify(buildOutput(true)));
            return 0;
        }
        const decision = validateQualityGate(input.tool_input);
        if (!decision.allow && decision.reason) {
            // Write the guidance to stderr too so the user sees it in the terminal.
            process.stderr.write(decision.reason + '\n');
        }
        // #2244 — secondary tier-floor check (qg_criteria + qg_anti_criteria only).
        // Bulletproof: wrapped in try/catch so a validator bug never breaks
        // TaskCreate. soft breaches NEVER block — they only emit telemetry.
        try {
            const floorCheck = checkQGFloorsForTaskInput(input.tool_input);
            if (floorCheck.breaches.length > 0) {
                logTierFloorBreaches(floorCheck);
            }
            // Note: at TaskCreate boundary all breaches are SOFT (per D2).
            // Even in 'enforce' mode we ALLOW through — the gate only blocks on
            // base validation failures (criteria count/word count/anti presence).
        }
        catch {
            // Never let a tier-floor failure break the gate.
        }
        process.stdout.write(JSON.stringify(buildOutput(decision.allow, decision.reason)));
    }
    catch {
        // Never block on hook failures.
        process.stdout.write(JSON.stringify(buildOutput(true)));
    }
    return 0;
}
//# sourceMappingURL=task-quality-gate.js.map