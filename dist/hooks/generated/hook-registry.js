/**
 * Generated: 2026-04-20T19:38:13.009Z
 * Source: contracts/hooks/hook-registry.yaml
 *
 * Authoritative hook registry. Do NOT edit manually.
 * Run `pnpm generate:contracts` after changing hook-registry.yaml.
 *
 * execution: local  — requires shell; Claude Code / Codex / Gemini CLI only
 * execution: remote — safe for Anthropic/OpenAI sandbox (claude-addon, etc.)
 */
export const HOOK_MANIFEST = [
    { name: 'user-prompt-submit', description: "Route the user prompt through grāmatr intelligence and inject the v2 packet. Maps to BeforeAgent event on Gemini CLI, UserPromptSubmit on all other platforms.", event: 'UserPromptSubmit', execution: 'remote', status: 'active' },
    { name: 'session-start', description: "Restore session continuity — load handoff, inject startup context.", event: 'SessionStart', execution: 'remote', status: 'active' },
    { name: 'session-end', description: "Flush session state and record remote session end.", event: 'SessionEnd', execution: 'remote', status: 'active' },
    { name: 'stop', description: "Submit pending classification feedback when generation stops.", event: 'Stop', execution: 'remote', status: 'active' },
    { name: 'rating-capture', description: "Capture explicit user ratings from prompt input (e.g. '!5' prefix).", event: 'UserPromptSubmit', execution: 'local', status: 'active' },
    { name: 'git-gate', description: "Enforce behavioral gates on dangerous git operations (push --force, etc.).", event: 'PreToolUse', execution: 'local', status: 'active' },
    { name: 'input-validator', description: "Validate MCP tool inputs and Bash/Edit/Write commands before execution.", event: 'PreToolUse', execution: 'local', status: 'active' },
    { name: 'edit-tracker', description: "Track modified files for lint awareness and change attribution.", event: 'PreToolUse', execution: 'local', status: 'active' },
    { name: 'tool-tracker', description: "Summarize tool execution metrics after MCP tool calls.", event: 'PostToolUse', execution: 'local', status: 'active' },
    { name: 'agent-verify', description: "Emit Quality Gate verification reminder after sub-agent completion.", event: 'PostToolUse', execution: 'local', status: 'active' },
    { name: 'agent-gate', description: "Deny Agent launches that lack a fresh route_request classification.", event: 'PreToolUse', execution: 'local', status: 'active' },
    { name: 'subagent-route', description: "Before a sub-agent launches: call route_request for the sub-task prompt, verify a fresh classification exists, and inject the Quality Gate scaffold as context for the sub-agent.", event: 'SubagentStart', execution: 'local', status: 'active' },
    { name: 'task-quality-gate', description: "Before a task is created via TaskCreate: validate that Quality Gate criteria are present (minimum 4 criteria, 8-12 words each in state form, at least 1 anti-criterion). Blocks task creation if criteria are missing.", event: 'TaskCreated', execution: 'local', status: 'active' },
    { name: 'instructions-loaded', description: "When CLAUDE.md is loaded: call resolve_project to identify or create the project, call session_start to resume or create a session, and call load_handoff to restore the last session state. Injects handoff context into the conversation automatically.", event: 'InstructionsLoaded', execution: 'local', status: 'active' },
];
export const HOOK_NAMES = [
    'agent-gate',
    'agent-verify',
    'edit-tracker',
    'git-gate',
    'input-validator',
    'instructions-loaded',
    'rating-capture',
    'session-end',
    'session-start',
    'stop',
    'subagent-route',
    'task-quality-gate',
    'tool-tracker',
    'user-prompt-submit',
];
export const LOCAL_HOOKS = new Set([
    'agent-gate',
    'agent-verify',
    'edit-tracker',
    'git-gate',
    'input-validator',
    'instructions-loaded',
    'rating-capture',
    'subagent-route',
    'task-quality-gate',
    'tool-tracker',
]);
export const REMOTE_HOOKS = new Set([
    'session-end',
    'session-start',
    'stop',
    'user-prompt-submit',
]);
//# sourceMappingURL=hook-registry.js.map