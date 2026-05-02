/**
 * gramatr OpenCode Plugin Scaffold
 *
 * Maps OpenCode's plugin lifecycle events to gramatr hook logic.
 * OpenCode uses a plugin-based architecture instead of hooks.json files.
 *
 * Install: Place this file in your OpenCode plugins directory or reference
 * it in your opencode.json config.
 *
 * This is a scaffold with TODO comments — not a full implementation.
 * Each event handler shows which gramatr hook logic to invoke.
 */
interface OpenCodePluginContext {
    sessionId: string;
    projectDir: string;
    config: Record<string, unknown>;
}
interface OpenCodeToolCall {
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
}
interface OpenCodePlugin {
    name: string;
    version: string;
    description: string;
    'session.created'?: (ctx: OpenCodePluginContext) => Promise<void>;
    'session.updated'?: (ctx: OpenCodePluginContext) => Promise<void>;
    'session.idle'?: (ctx: OpenCodePluginContext) => Promise<void>;
    'tool.execute.before'?: (ctx: OpenCodePluginContext, tool: OpenCodeToolCall) => Promise<OpenCodeToolCall>;
    'tool.execute.after'?: (ctx: OpenCodePluginContext, tool: OpenCodeToolCall) => Promise<void>;
}
/**
 * gramatr plugin for OpenCode.
 *
 * Event mapping:
 *   session.created      -> gramatr session-start (restore session context + handoff)
 *   tool.execute.before  -> gramatr agent-gate + input-validator (pre-tool checks)
 *   tool.execute.after   -> gramatr tool-tracker (post-tool telemetry)
 *   session.idle          -> gramatr stop (classification feedback on idle)
 *   session.updated      -> gramatr session-end (persist session state)
 */
declare const gramatrPlugin: OpenCodePlugin;
export default gramatrPlugin;
//# sourceMappingURL=gramatr-opencode-plugin.d.ts.map