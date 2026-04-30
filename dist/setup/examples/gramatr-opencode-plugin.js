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
const gramatrPlugin = {
    name: 'gramatr',
    version: '0.1.0',
    description: 'gramatr intelligence layer for OpenCode — session, routing, and tool lifecycle',
    /**
     * session.created — Initialize gramatr session context.
     *
     * Equivalent to the SessionStart hook in Claude Code / Codex / Gemini.
     * Calls session_start to restore session context and load handoff.
     */
    'session.created': async (ctx) => {
        // TODO: Call gramatr session-start hook logic
        // - Load or create a gramatr session for ctx.sessionId
        // - Restore handoff state from previous sessions
        // - Inject the v2 intelligence packet into the session context
        //
        // Example using the gramatr binary:
        //   execSync(`npx -y @gramatr/mcp hook session-start --opencode`, {
        //     env: { ...process.env, GRAMATR_SESSION_ID: ctx.sessionId },
        //   });
        void ctx;
    },
    /**
     * tool.execute.before — Pre-tool validation gate.
     *
     * Equivalent to PreToolUse hooks (agent-gate, input-validator) in Claude Code.
     * Validates tool inputs and enforces safety constraints before execution.
     */
    'tool.execute.before': async (ctx, tool) => {
        // TODO: Call gramatr agent-gate logic
        // - Check if the tool call is allowed by hard_gates
        // - Validate tool inputs against schema constraints
        //
        // TODO: Call gramatr input-validator logic
        // - Sanitize inputs (strip secrets, validate paths)
        // - Enforce user isolation rules
        //
        // Example:
        //   const result = execSync(
        //     `npx -y @gramatr/mcp hook input-validator --opencode`,
        //     { input: JSON.stringify({ tool_name: tool.name, tool_input: tool.input }) },
        //   );
        //   const validated = JSON.parse(result.toString());
        //   if (validated.blocked) throw new Error(validated.reason);
        void ctx;
        return tool;
    },
    /**
     * tool.execute.after — Post-tool telemetry tracking.
     *
     * Equivalent to PostToolUse (tool-tracker) in Claude Code.
     * Records tool execution metadata for the intelligence flywheel.
     */
    'tool.execute.after': async (ctx, tool) => {
        // TODO: Call gramatr tool-tracker logic
        // - Record tool name, execution time, result summary
        // - Feed execution data into the pattern learner
        // - Update session state with tool usage
        //
        // Example:
        //   execSync(`npx -y @gramatr/mcp hook tool-tracker --opencode`, {
        //     input: JSON.stringify({
        //       tool_name: tool.name,
        //       tool_input: tool.input,
        //       tool_output: tool.output,
        //     }),
        //   });
        void ctx;
        void tool;
    },
    /**
     * session.idle — Submit classification feedback on idle.
     *
     * Equivalent to the Stop hook in Claude Code / Codex.
     * Submits classification feedback to train the classifier flywheel.
     */
    'session.idle': async (ctx) => {
        // TODO: Call gramatr stop hook logic
        // - Submit classification_feedback for the current session
        // - Evaluate if effort, intent, and skills were classified correctly
        //
        // Example:
        //   execSync(`npx -y @gramatr/mcp hook stop --opencode`, {
        //     env: { ...process.env, GRAMATR_SESSION_ID: ctx.sessionId },
        //   });
        void ctx;
    },
    /**
     * session.updated — Persist session state on update.
     *
     * Equivalent to SessionEnd hook in Claude Code.
     * Saves session state and handoff for continuity across sessions.
     */
    'session.updated': async (ctx) => {
        // TODO: Call gramatr session-end hook logic
        // - Persist current session state
        // - Save handoff summary for next session resumption
        //
        // Example:
        //   execSync(`npx -y @gramatr/mcp hook session-end --opencode`, {
        //     env: { ...process.env, GRAMATR_SESSION_ID: ctx.sessionId },
        //   });
        void ctx;
    },
};
export default gramatrPlugin;
//# sourceMappingURL=gramatr-opencode-plugin.js.map