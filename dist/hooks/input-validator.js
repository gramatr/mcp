import { resolve, isAbsolute } from 'node:path';
import { ENTITY_TYPE_SET, TOOL_INPUT_RULES } from './generated/schema-constants.js';
import { HOOK_STDIN_DEFAULT_TIMEOUT_MS } from './generated/hook-timeouts.js';
const CONTRACT_BANNED_PATTERNS = [
    {
        label: 'hardcoded effort-level enum (instant/fast/standard/…)',
        regex: /['"`]instant['"`]\s*,\s*['"`]fast['"`]\s*,\s*['"`]standard['"`]/,
        fix: "Import EFFORT_LEVELS from '@gramatr/mcp/hooks/generated/schema-constants.js' instead of hardcoding.",
    },
    {
        label: 'hardcoded intent-type enum array (search/retrieve/create/update/…)',
        // Only flag when these four appear together as an array literal — not inside
        // switch/case or if/else where partial matches are legitimate.
        regex: /\[\s*['"`]search['"`]\s*,\s*['"`]retrieve['"`]\s*,\s*['"`]create['"`]\s*,\s*['"`]update['"`]/,
        fix: "Import INTENT_TYPES from '@gramatr/mcp/hooks/generated/schema-constants.js' instead of hardcoding.",
    },
    {
        label: "hardcoded memory-tier enum (hot/warm/cold) — concept removed from contracts",
        // Flag any array literal that includes these three tier strings together.
        regex: /['"`]hot['"`]\s*,\s*['"`]warm['"`]\s*,\s*['"`]cold['"`]/,
        fix: "The hot/warm/cold memory-tier concept has been removed. Use MEMORY_SCOPES from schema-constants.js.",
    },
    {
        label: 'inline Zod enum that should import from generated contracts',
        // z.enum([ followed immediately by a string literal — catches inline enum
        // definitions that bypass the generated constants.
        regex: /z\.enum\(\s*\[\s*['"`]/,
        fix: "Use z.enum(EFFORT_LEVELS) / z.enum(INTENT_TYPES) / z.enum(ENTITY_TYPES) — import arrays from '@gramatr/mcp/hooks/generated/schema-constants.js'.",
    },
];
/**
 * Determine whether a file path is subject to contract enforcement.
 *
 * Rules:
 *  - Must be a Write or Edit tool call
 *  - Target path must be a .ts file under packages/{pkg}/src/
 *  - Skip generated/ directories
 *  - Skip test files
 */
function isEnforcedPath(filePath) {
    // Normalise to forward slashes for consistent matching
    const p = filePath.replace(/\\/g, '/');
    if (!p.endsWith('.ts'))
        return false;
    if (!/\/packages\/[^/]+\/src\//.test(p))
        return false;
    if (/\/generated\//.test(p))
        return false;
    if (/\.test\./.test(p))
        return false;
    return true;
}
/**
 * Check file content for banned patterns.
 * Returns a warning string if violations are found, or undefined if clean.
 */
export function checkContractViolations(filePath, content) {
    if (!isEnforcedPath(filePath))
        return undefined;
    const violations = [];
    for (const pattern of CONTRACT_BANNED_PATTERNS) {
        if (pattern.regex.test(content)) {
            violations.push(`  • ${pattern.label}\n    Fix: ${pattern.fix}`);
        }
    }
    if (violations.length === 0)
        return undefined;
    return (`[gramatr contract enforcement] Banned hardcoded enum pattern(s) detected in ${filePath}:\n` +
        violations.join('\n') +
        '\n\nAll classifier enums must be imported from generated/schema-constants.js, not inlined.');
}
/**
 * Extract the file path and new content from a Write or Edit tool input.
 * Returns undefined if the tool is not a Write/Edit or the input is missing fields.
 */
function extractWriteTarget(toolName, input) {
    const shortTool = toolName.split('__').pop() ?? toolName;
    if (shortTool === 'Write') {
        const filePath = typeof input.file_path === 'string' ? input.file_path : undefined;
        const content = typeof input.content === 'string' ? input.content : undefined;
        if (filePath && content !== undefined)
            return { filePath, content };
    }
    if (shortTool === 'Edit') {
        const filePath = typeof input.file_path === 'string' ? input.file_path : undefined;
        // Check both new_string (Edit) — old_string is not the new content
        const newString = typeof input.new_string === 'string' ? input.new_string : undefined;
        if (filePath && newString !== undefined)
            return { filePath, content: newString };
    }
    return undefined;
}
function readStdin(timeoutMs) {
    return new Promise((resolve) => {
        let data = '';
        const timer = setTimeout(() => resolve(data), timeoutMs);
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
        process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
        process.stdin.resume();
    });
}
function extractToolShortName(fullName) {
    const parts = fullName.split('__');
    return parts.length >= 3 ? parts.slice(2).join('__') : fullName;
}
function validate(toolName, input) {
    const shortName = extractToolShortName(toolName);
    const rules = TOOL_INPUT_RULES[shortName];
    if (!rules || rules.length === 0)
        return { allow: true };
    for (const rule of rules) {
        const value = input[rule.field];
        if (value === undefined || value === null || value === '') {
            return { allow: false, reason: `Missing required field "${rule.field}" for ${shortName}. Provide a non-empty value.` };
        }
        if (rule.validValues && typeof value === 'string') {
            const validSet = rule.field === 'entity_type' ? ENTITY_TYPE_SET : new Set(rule.validValues);
            if (!validSet.has(value)) {
                return { allow: false, reason: `Invalid ${rule.field}="${value}" for ${shortName}. Valid values: ${rule.validValues.join(', ')}` };
            }
        }
    }
    if ('entity_type' in input && typeof input.entity_type === 'string' && !ENTITY_TYPE_SET.has(input.entity_type)) {
        return {
            allow: false,
            reason: `Invalid entity_type="${input.entity_type}". Call list_entity_types for the full list.`,
        };
    }
    return { allow: true };
}
/**
 * Validate contract compliance for Write/Edit tool calls targeting .ts source files.
 * Returns a warning-level result (allow: true with reason) when violations are found.
 */
function validateContractCompliance(toolName, input) {
    const target = extractWriteTarget(toolName, input);
    if (!target)
        return { allow: true };
    const warning = checkContractViolations(target.filePath, target.content);
    if (!warning)
        return { allow: true };
    // Return allow:true with a reason — this surfaces as a warning, not a hard block.
    return { allow: true, reason: warning };
}
// Write-capable tools that can modify files on disk
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
/**
 * Enforce orchestration access_scope when this session has an active orch task.
 * Reads scope from SQLite session_context. Returns deny reason or null (allow).
 */
function checkOrchAccessScope(sessionId, toolName, toolInput) {
    if (!sessionId || !WRITE_TOOLS.has(toolName))
        return null;
    try {
        const { getSessionContext } = require('./lib/hook-state.js');
        const ctx = getSessionContext(sessionId);
        if (!ctx?.orch_access_scope || !ctx.orch_dir)
            return null;
        const scope = ctx.orch_access_scope;
        if (scope === 'open')
            return null;
        // Extract target path from tool input
        const targetPath = (toolInput['file_path'] ?? toolInput['path'] ?? toolInput['notebook_path']);
        if (!targetPath)
            return null;
        const absTarget = isAbsolute(targetPath) ? targetPath : resolve(process.cwd(), targetPath);
        const orchDir = ctx.orch_dir;
        const workingDir = ctx.orch_working_dir ?? null;
        // Always allow writes inside the orch scratch/output dir
        if (absTarget.startsWith(orchDir + '/') || absTarget === orchDir)
            return null;
        if (scope === 'read_only') {
            return `Access scope is read_only — writes blocked outside orchestration scratch dir (${orchDir}). Write notes to scratch/ or output/ instead.`;
        }
        if (scope === 'working_dir_only' && workingDir) {
            if (absTarget.startsWith(workingDir + '/') || absTarget === workingDir)
                return null;
            return `Access scope is working_dir_only — write blocked outside ${workingDir} and ${orchDir}.`;
        }
    }
    catch {
        // Non-fatal — never block on scope check errors
    }
    return null;
}
function buildPreToolUseOutput(allow, reason) {
    if (allow) {
        return {
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'allow',
                // Include reason as an informational warning when present (allow + reason = warning)
                ...(reason ? { permissionDecisionReason: reason } : {}),
            },
        };
    }
    return {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason || 'Tool call blocked by gramatr input validation.',
        },
    };
}
export async function runInputValidatorHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_DEFAULT_TIMEOUT_MS);
    if (!raw.trim()) {
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
        return 0;
    }
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || !input.tool_input) {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
            return 0;
        }
        // Step 1: MCP tool input validation (hard block on invalid inputs)
        const result = validate(input.tool_name, input.tool_input);
        if (!result.allow) {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(false, result.reason)));
            return 0;
        }
        // Step 2: Contract enforcement on Write/Edit to packages/*/src/*.ts (warning only)
        const contractResult = validateContractCompliance(input.tool_name, input.tool_input);
        if (!contractResult.allow) {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(false, contractResult.reason)));
            return 0;
        }
        // Step 3: Orchestration access scope enforcement (hard block when active orch task)
        const scopeDeny = checkOrchAccessScope(input.session_id, input.tool_name, input.tool_input);
        if (scopeDeny) {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(false, scopeDeny)));
            return 0;
        }
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(contractResult.allow, contractResult.reason)));
    }
    catch {
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
    }
    return 0;
}
//# sourceMappingURL=input-validator.js.map