export const CLAUDE_BLOCK_START = '<!-- GRAMATR-START -->';
export const CLAUDE_BLOCK_END = '<!-- GRAMATR-END -->';
export const CODEX_BLOCK_START = '<!-- GRAMATR-CODEX-START -->';
export const CODEX_BLOCK_END = '<!-- GRAMATR-CODEX-END -->';
export const CLAUDE_CODE_GUIDANCE = `${CLAUDE_BLOCK_START}
# gramatr

You have gramatr installed. Hooks inject a \`gmtr.intelligence.contract.v2\`
packet into your context on every prompt.

**Follow the packet.** It contains classification, behavioral directives,
phase templates, capability audit, quality gates, memory/search results,
agent suggestions, and enrichment (RE + ISC scaffold).

**Mandatory fields:**
- \`directives.hard_gates\` — non-negotiable behavioral constraints
- \`directives.behavioral_rules\` — algorithm phases, code rules, safety rules
- \`process.phase_template\` — effort-gated phase sequence
- \`process.quality_gate_config\` — ISC verification rules
- \`enrichment.data.reasoning\` — RE + ISC when present

**Memory:** Use gramatr MCP tools (\`search_semantic\`, \`create_entity\`,
\`add_observation\`), not local markdown files.

**Sub-agent composition:** Before launching any sub-agent for non-trivial work,
call \`gramatr_route_request\` with the task prompt first. Use the returned
packet to compose the brief: RE → task description, ISC scaffold → acceptance
criteria, orchestration.agents.composed → agent system prompt, hard_gates →
constraints.

**Effort-gated phases:**
- instant: RESPOND only
- fast: OBSERVE → RESPOND
- standard: OBSERVE → PLAN → BUILD → VERIFY
- extended+: OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN

**Identity:** Read from \`~/.gramatr/settings.json\` — \`daidentity\` for your
name, \`principal\` for the user's name.

**If the server is unavailable:** Degrade cleanly and keep working. Use the
7-phase structure. Create ISC before work. Never combine phases.
${CLAUDE_BLOCK_END}
`;
export const CODEX_GUIDANCE = `${CODEX_BLOCK_START}
# gramatr codex guidance

## Repo Expectations

- Prefer gramatr memory and project handoff context over ad hoc local summaries.
- Treat Codex hook augmentation as authoritative when a gramatr intelligence block is present.
- If gramatr augmentation is missing, query gramatr memory before relying on stale local notes.
- Prefer TypeScript implementations over shell scripts for client integration code unless the platform requires shell.
- Maintain test coverage for new hook and utility logic.

## Codex Integration

- Repo-local Codex hooks are configured in \`.codex/hooks.json\`.
- \`UserPromptSubmit\` is responsible for prompt enrichment.
- \`SessionStart\` is responsible for session restore and continuity.
- Hook failures must degrade cleanly and never block the user session.
- The contract is always \`gmtr.intelligence.contract.v2\`. There is no
  \`unified_packet\`, \`packet_1\`, or \`packet_2\` — the v2 packet is the only format.
- Treat \`directives.hard_gates\` and \`directives.behavioral_rules\` as mandatory.
- Follow \`process.phase_template\` for effort-gated phase sequencing.
- Use \`process.quality_gate_config\` for ISC verification.
- Consume \`enrichment.data.reasoning\` for RE and ISC when present.
- \`gramatr_route_request\` is mandatory when hook injection is missing/stale.
- \`search_semantic\` remains available for follow-up memory expansion.
${CODEX_BLOCK_END}
`;
export function buildInstallPromptSuggestion(target) {
    switch (target) {
        case 'claude-code':
        case 'codex':
        case 'gemini-cli':
            return buildHookedPromptSuggestion(target);
        case 'claude-desktop':
        case 'chatgpt-desktop':
        case 'cursor':
        case 'windsurf':
        case 'vscode':
            return buildHooklessLocalPromptSuggestion(target);
        default:
            return buildHookedPromptSuggestion('codex');
    }
}
function buildHookedPromptSuggestion(target) {
    const platform = target === 'claude-code'
        ? 'Claude Code'
        : target === 'gemini-cli'
            ? 'Gemini CLI'
            : 'Codex';
    return `# gramatr (${platform})

gramatr is installed locally. Hooks inject a \`gmtr.intelligence.contract.v2\`
packet into your context at session start and on every user prompt.

When a gramatr intelligence block is present, follow it as authoritative.
When the packet is missing or clearly stale, call \`gramatr_route_request\`
with the user's request before answering.

The packet contains classification (effort, intent, confidence), behavioral
directives, phase templates, capability audit, quality gates, memory/search
results, agent suggestions, and enrichment (reverse engineering + ISC scaffold).

Treat \`directives.hard_gates\` and \`directives.behavioral_rules\` as mandatory.
Follow \`process.phase_template\` for effort-gated phase sequencing.
Use \`process.quality_gate_config\` for ISC verification.
Consume \`enrichment.data.reasoning\` for RE and ISC when present.

If responses are wrapped with \`schema: "gmtr.tool.result.v1"\`, parse the
\`data\` field as the canonical tool payload.

For continuity questions like "what were we doing?" or "what changed?",
call \`gramatr_load_handoff\` first, then \`search_semantic\` for detail.

**Feedback loop (MANDATORY):** After completing non-trivial work, you MUST:
1. Call \`gramatr_classification_feedback\` — trains the classifier.
2. Call \`gramatr_save_reflection\` — feeds the learning pipeline.

Use gramatr tools for memory and project state. Do not maintain separate
notes when gramatr state is available.`;
}
function buildHooklessLocalPromptSuggestion(target) {
    const platformMap = {
        'claude-desktop': 'Claude Desktop',
        'chatgpt-desktop': 'ChatGPT Desktop',
        cursor: 'Cursor',
        windsurf: 'Windsurf',
        vscode: 'VS Code',
    };
    return `# gramatr (${platformMap[target]})

You have gramatr connected as an MCP server.

**Before responding to any user message,** call \`gramatr_route_request\` with
the user's prompt. This returns a \`gmtr.intelligence.contract.v2\` packet.

**Follow the packet.** It contains classification, behavioral directives,
phase templates, capability audit, quality gates, memory/search results,
agent suggestions, and enrichment (RE + ISC scaffold).

**Mandatory fields:**
- \`directives.hard_gates\` — non-negotiable behavioral constraints
- \`directives.behavioral_rules\` — algorithm phases, code rules, safety rules
- \`process.phase_template\` — effort-gated phase sequence
- \`process.quality_gate_config\` — ISC verification rules
- \`enrichment.data.reasoning\` — RE + ISC when present

**Memory:** Use gramatr MCP tools (\`search_semantic\`, \`create_entity\`,
\`add_observation\`) as the source of truth — not local notes.

**Effort-gated phases:**
- instant: RESPOND only
- fast: OBSERVE → RESPOND
- standard: OBSERVE → PLAN → BUILD → VERIFY
- extended+: OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN

If responses are wrapped with \`schema: "gmtr.tool.result.v1"\`, use
\`data\` as the canonical payload.

**Feedback loop (MANDATORY):** After completing non-trivial work, you MUST:
1. Call \`gramatr_classification_feedback\` with the original prompt — evaluates if effort, intent, and skills were classified correctly. This trains the classifier.
2. Call \`gramatr_save_reflection\` — captures what worked, what didn't, what a smarter AI would do differently. This feeds the learning pipeline.
Skipping these breaks the training flywheel. Without feedback, the classifier never improves.

For continuity questions ("what were we doing?", "what changed?"),
call \`gramatr_load_handoff\` before answering, then \`search_semantic\`.`;
}
//# sourceMappingURL=instructions.js.map