export const HOOK_MANIFEST = [
    {
        name: 'agent-gate',
        description: 'Deny Agent launches without a fresh gramatr_route_request classification.',
    },
    {
        name: 'agent-verify',
        description: 'Emit Quality Gate verification reminder after sub-agent completion.',
    },
    {
        name: 'edit-tracker',
        description: 'Track modified files for lint awareness.',
    },
    {
        name: 'git-gate',
        description: 'Enforce behavioral gates on dangerous git operations.',
    },
    {
        name: 'input-validator',
        description: 'Validate MCP tool inputs before they are sent.',
    },
    {
        name: 'rating-capture',
        description: 'Capture explicit user ratings from prompt input.',
    },
    {
        name: 'session-start',
        description: 'Restore session continuity and inject startup context.',
    },
    {
        name: 'session-end',
        description: 'Flush session state and record remote session end.',
    },
    {
        name: 'stop',
        description: 'Submit pending classification feedback at stop time.',
    },
    {
        name: 'tool-tracker',
        description: 'Summarize tool execution metrics after tool calls.',
    },
    {
        name: 'user-prompt-submit',
        description: 'Route the user prompt and inject the intelligence packet.',
    },
];
export const HOOK_NAMES = HOOK_MANIFEST.map((hook) => hook.name);
//# sourceMappingURL=manifest.js.map