import { ENTITY_TYPE_SET, TOOL_INPUT_RULES } from './generated/schema-constants.js';
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
        return { decision: 'allow' };
    for (const rule of rules) {
        const value = input[rule.field];
        if (value === undefined || value === null || value === '') {
            return { decision: 'block', reason: `Missing required field "${rule.field}" for ${shortName}. Provide a non-empty value.` };
        }
        if (rule.validValues && typeof value === 'string') {
            const validSet = rule.field === 'entity_type' ? ENTITY_TYPE_SET : new Set(rule.validValues);
            if (!validSet.has(value)) {
                return { decision: 'block', reason: `Invalid ${rule.field}="${value}" for ${shortName}. Valid values: ${rule.validValues.join(', ')}` };
            }
        }
    }
    if ('entity_type' in input && typeof input.entity_type === 'string' && !ENTITY_TYPE_SET.has(input.entity_type)) {
        return {
            decision: 'block',
            reason: `Invalid entity_type="${input.entity_type}". Call gramatr_list_entity_types for the full list.`,
        };
    }
    return { decision: 'allow' };
}
export async function runInputValidatorHook(_args = []) {
    const raw = await readStdin(2000);
    if (!raw.trim()) {
        process.stdout.write(JSON.stringify({ decision: 'allow' }));
        return 0;
    }
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || !input.tool_input) {
            process.stdout.write(JSON.stringify({ decision: 'allow' }));
            return 0;
        }
        process.stdout.write(JSON.stringify(validate(input.tool_name, input.tool_input)));
    }
    catch {
        process.stdout.write(JSON.stringify({ decision: 'allow' }));
    }
    return 0;
}
//# sourceMappingURL=input-validator.js.map