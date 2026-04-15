import { CLAUDE_CODE_HOOKS as CLAUDE_CODE_PLATFORM, CODEX_HOOKS as CODEX_PLATFORM, } from './generated/platform-hooks.js';
export const MCP_HOOK_BIN_RELATIVE = 'bin/gramatr';
const TS_RUNNER = 'npx tsx';
/**
 * Converts a generated PlatformConfig into the HookSpec[] format used by buildHooksFile.
 * The client_flag from the platform config becomes the hookArgs (e.g. "--claude-code").
 */
function platformToHookSpecs(platform) {
    const specs = [];
    const clientFlag = platform.client_flag !== 'none' ? platform.client_flag : undefined;
    for (const [event, entries] of Object.entries(platform.hooks)) {
        for (const entry of entries) {
            const spec = {
                event,
                mcpHookName: entry.hook,
                hookArgs: clientFlag ? [clientFlag] : undefined,
            };
            if (entry.matcher)
                spec.matcher = entry.matcher;
            if (entry.statusMessage)
                spec.statusMessage = entry.statusMessage;
            if (entry.timeout)
                spec.timeout = entry.timeout;
            specs.push(spec);
        }
    }
    return specs;
}
const CLAUDE_HOOKS = platformToHookSpecs(CLAUDE_CODE_PLATFORM);
const CODEX_HOOKS = platformToHookSpecs(CODEX_PLATFORM);
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
// OpenCode uses a plugin-based architecture instead of hooks.json files.
// The gramatr plugin scaffold lives at setup/examples/gramatr-opencode-plugin.ts.
// No OPENCODE_HOOKS array is needed here — lifecycle events are handled by the plugin.
export function buildClaudeMcpServerEntry() {
    return {
        command: '~/.gramatr/bin/gramatr',
    };
}
//# sourceMappingURL=integrations.js.map