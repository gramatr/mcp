import { CLAUDE_CODE_HOOKS as CLAUDE_CODE_PLATFORM, CLAUDE_ADDON_HOOKS as CLAUDE_ADDON_PLATFORM, CODEX_HOOKS as CODEX_PLATFORM, } from './generated/platform-hooks.js';
import { resolveBinaryPath } from '../bin/setup-shared.js';
export const MCP_HOOK_BIN_RELATIVE = 'bin/gramatr'; // Legacy — used by tests. Runtime uses npx.
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
const CLAUDE_ADDON_HOOKS = platformToHookSpecs(CLAUDE_ADDON_PLATFORM);
const CODEX_HOOKS = platformToHookSpecs(CODEX_PLATFORM);
function buildHookCommand(clientDir, spec) {
    if (spec.mcpHookName) {
        const args = spec.hookArgs?.length ? ` ${spec.hookArgs.join(' ')}` : '';
        // gramatr-hook is a thin OS wrapper in $GRAMATR_DIR/bin/ that calls
        // `node $GRAMATR_DIR/mcp/dist/bin/gramatr-mcp.js hook ...`
        // No npx — routes through the running daemon without spawning fresh processes.
        return `gramatr-hook ${spec.mcpHookName}${args}`;
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
export function buildPluginHooksJson() {
    const file = buildClaudeHooksFile('');
    return {
        description: 'gramatr intelligence hooks — inject v2 contract on every prompt, track tool use, save session state',
        hooks: file.hooks,
    };
}
/**
 * Build the hooks declaration section for the Anthropic partner program manifest.
 * These hooks run on Anthropic's infrastructure (not locally) when the add-on is
 * active in Claude.ai. Include this in the partner manifest submission so Anthropic
 * configures UserPromptSubmit, SessionStart, SessionEnd, and Stop automatically.
 *
 * Called by the claude-addon install flow to generate the manifest payload.
 */
export function buildClaudeAddonHooksManifest() {
    const file = buildHooksFile('', CLAUDE_ADDON_HOOKS);
    return {
        description: 'gramatr intelligence hooks — pre-classify every prompt, load session context, save state, submit feedback',
        hooks: file.hooks,
    };
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
    const { command, args } = resolveBinaryPath();
    return { command, ...(args.length > 0 && { args }) };
}
//# sourceMappingURL=integrations.js.map