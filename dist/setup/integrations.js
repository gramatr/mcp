export const MCP_HOOK_BIN_RELATIVE = 'bin/gramatr';
const TS_RUNNER = 'npx tsx';
const CLAUDE_HOOKS = [
    { event: 'PreToolUse', matcher: 'Bash', mcpHookName: 'input-validator', hookArgs: ['--claude-code'] },
    { event: 'PreToolUse', matcher: 'Edit', mcpHookName: 'input-validator', hookArgs: ['--claude-code'] },
    { event: 'PreToolUse', matcher: 'Write', mcpHookName: 'input-validator', hookArgs: ['--claude-code'] },
    { event: 'PreToolUse', matcher: 'Read', mcpHookName: 'input-validator', hookArgs: ['--claude-code'] },
    { event: 'PreToolUse', matcher: 'mcp__.*gramatr.*__', mcpHookName: 'input-validator', hookArgs: ['--claude-code'] },
    { event: 'PostToolUse', matcher: 'mcp__.*gramatr.*__', mcpHookName: 'tool-tracker', hookArgs: ['--claude-code'] },
    { event: 'UserPromptSubmit', mcpHookName: 'rating-capture', hookArgs: ['--claude-code'] },
    { event: 'UserPromptSubmit', mcpHookName: 'user-prompt-submit', hookArgs: ['--claude-code'] },
    { event: 'SessionStart', mcpHookName: 'session-start', hookArgs: ['--claude-code'], statusMessage: 'Loading grāmatr session context' },
    { event: 'SessionEnd', mcpHookName: 'session-end', hookArgs: ['--claude-code'], statusMessage: 'Saving grāmatr session' },
    { event: 'Stop', mcpHookName: 'stop', hookArgs: ['--claude-code'], statusMessage: 'Submitting grāmatr classification feedback' },
];
const CODEX_HOOKS = [
    {
        event: 'SessionStart',
        matcher: 'startup|resume',
        mcpHookName: 'session-start',
        hookArgs: ['--codex'],
        statusMessage: 'Loading gramatr session context',
        timeout: 15,
    },
    {
        event: 'UserPromptSubmit',
        mcpHookName: 'user-prompt-submit',
        hookArgs: ['--codex'],
        statusMessage: 'Routing request through gramatr',
        timeout: 15,
    },
    {
        event: 'Stop',
        mcpHookName: 'stop',
        hookArgs: ['--codex'],
        statusMessage: 'Submitting gramatr classification feedback',
        timeout: 10,
    },
];
function buildHookCommand(clientDir, spec) {
    if (spec.mcpHookName) {
        const args = spec.hookArgs?.length ? ` ${spec.hookArgs.join(' ')}` : '';
        return `"${clientDir}/${MCP_HOOK_BIN_RELATIVE}" hook ${spec.mcpHookName}${args}`;
    }
    if (!spec.relativeCommand) {
        throw new Error(`[setup] missing hook command for ${spec.event}`);
    }
    return `${TS_RUNNER} "${clientDir}/${spec.relativeCommand}"`;
}
function buildHooksFile(clientDir, specs) {
    const hooks = {};
    for (const spec of specs) {
        const entry = {
            hooks: [{
                    type: 'command',
                    command: buildHookCommand(clientDir, spec),
                    statusMessage: spec.statusMessage,
                    timeout: spec.timeout,
                }],
        };
        if (spec.matcher)
            entry.matcher = spec.matcher;
        hooks[spec.event] ||= [];
        hooks[spec.event].push(entry);
    }
    return { hooks };
}
export function buildClaudeHooksFile(clientDir) {
    return buildHooksFile(clientDir, CLAUDE_HOOKS);
}
export function buildCodexHooksFile(clientDir) {
    return buildHooksFile(clientDir, CODEX_HOOKS);
}
export function mergeManagedHooks(existing, managed) {
    const existingHooks = existing.hooks || {};
    const merged = {};
    const managedEvents = new Set(Object.keys(managed.hooks));
    // For managed events, replace entirely (we own all entries)
    for (const event of managedEvents) {
        merged[event] = managed.hooks[event];
    }
    // For non-managed events, keep existing but filter out stale gramatr hooks
    for (const [event, entries] of Object.entries(existingHooks)) {
        if (managedEvents.has(event))
            continue;
        merged[event] = entries.filter((entry) => {
            const cmds = entry.hooks ?? [];
            return !cmds.some((h) => /gramatr/i.test(h.command));
        });
        // Drop the event key entirely if filtering removed all entries
        if (merged[event].length === 0) {
            delete merged[event];
        }
    }
    return { hooks: merged };
}
export function ensureCodexHooksFeature(configToml) {
    const text = configToml.trimEnd();
    if (/^\s*codex_hooks\s*=\s*true\s*$/m.test(text) && /^\s*\[features\]\s*$/m.test(text)) {
        return `${text}\n`;
    }
    if (/^\s*\[features\]\s*$/m.test(text)) {
        if (/^\s*codex_hooks\s*=.*$/m.test(text)) {
            return `${text.replace(/^\s*codex_hooks\s*=.*$/m, 'codex_hooks = true')}\n`;
        }
        return `${text.replace(/^\s*\[features\]\s*$/m, '[features]\ncodex_hooks = true')}\n`;
    }
    const prefix = text ? `${text}\n\n` : '';
    return `${prefix}[features]\ncodex_hooks = true\n`;
}
export function buildClaudeMcpServerEntry() {
    return {
        command: '~/.gramatr/bin/gramatr',
    };
}
//# sourceMappingURL=integrations.js.map