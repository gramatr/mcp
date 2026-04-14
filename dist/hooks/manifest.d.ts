export declare const HOOK_MANIFEST: readonly [{
    readonly name: "agent-gate";
    readonly description: "Deny Agent launches without a fresh gramatr_route_request classification.";
}, {
    readonly name: "agent-verify";
    readonly description: "Emit ISC verification reminder after sub-agent completion.";
}, {
    readonly name: "edit-tracker";
    readonly description: "Track modified files for lint awareness.";
}, {
    readonly name: "git-gate";
    readonly description: "Enforce behavioral gates on dangerous git operations.";
}, {
    readonly name: "input-validator";
    readonly description: "Validate MCP tool inputs before they are sent.";
}, {
    readonly name: "rating-capture";
    readonly description: "Capture explicit user ratings from prompt input.";
}, {
    readonly name: "session-start";
    readonly description: "Restore session continuity and inject startup context.";
}, {
    readonly name: "session-end";
    readonly description: "Flush session state and record remote session end.";
}, {
    readonly name: "stop";
    readonly description: "Submit pending classification feedback at stop time.";
}, {
    readonly name: "tool-tracker";
    readonly description: "Summarize tool execution metrics after tool calls.";
}, {
    readonly name: "user-prompt-submit";
    readonly description: "Route the user prompt and inject the intelligence packet.";
}];
export declare const HOOK_NAMES: readonly string[];
export type HookName = (typeof HOOK_MANIFEST)[number]['name'];
//# sourceMappingURL=manifest.d.ts.map