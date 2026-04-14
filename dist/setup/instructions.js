export const CLAUDE_BLOCK_START = '<!-- GRAMATR-START -->';
export const CLAUDE_BLOCK_END = '<!-- GRAMATR-END -->';
export const CODEX_BLOCK_START = '<!-- GRAMATR-CODEX-START -->';
export const CODEX_BLOCK_END = '<!-- GRAMATR-CODEX-END -->';
export const CLAUDE_CODE_GUIDANCE = `${CLAUDE_BLOCK_START}
# gramatr

You have gramatr installed. Local hooks and the local MCP server inject
intelligence as \`[gramatr intelligence — ...]\` into your context.

Follow the injected JSON contract. Prefer \`unified_packet\` when present.
It is the canonical complete contract. Fall back to \`packet_1\` /\`packet_2\`
only when \`unified_packet\` is absent.

Use gramatr tools and packet data instead of stale local markdown. Prefer
packet memory/search results when present. Use \`search_semantic\` only for
follow-up expansion, not as a replacement for the injected packet.

When the contract includes behavioral rules, directives, phase templates,
ISC/quality-gate data, or formatting constraints, treat those fields as
execution requirements rather than optional suggestions. Do not reconstruct
them from local prose when the structured fields are present.

If the server is unavailable, degrade cleanly and keep working, but do not
pretend intelligence was delivered.
${CLAUDE_BLOCK_END}
`;
export const CODEX_GUIDANCE = `${CODEX_BLOCK_START}
# gramatr codex guidance

## Repo Expectations

- Prefer gramatr memory and project handoff context over ad hoc local summaries.
- Treat Codex hook augmentation as authoritative when a gramatr JSON intelligence block is present.
- If gramatr augmentation is missing, query gramatr memory before relying on stale local notes.
- Prefer TypeScript implementations over shell scripts for client integration code unless the platform requires shell.
- Maintain test coverage for new hook and utility logic.

## Codex Integration

- Repo-local Codex hooks are configured in \`.codex/hooks.json\`.
- \`UserPromptSubmit\` is responsible for prompt enrichment.
- \`SessionStart\` is responsible for session restore and continuity.
- Hook failures must degrade cleanly and never block the user session.
- Prefer \`unified_packet\` as the canonical complete contract. When it is absent, treat \`packet_1\` as mandatory deterministic input and \`packet_2\` as mandatory when required.
- If \`packet_2.required === true\`, call \`gramatr_get_packet_two\` with \`enrichment_id\` before deep execution.
- Consume structured JSON fields as source of truth. Do not replace packet-provided behavioral rules, ISC gates, quality gates, or format constraints with local prose summaries.
- \`gramatr_route_request\` is mandatory when hook injection is missing/stale for the current user prompt.
- \`search_semantic\` remains available for follow-up memory expansion, not as a replacement for packet flow.
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

gramatr is installed locally. Hooks and the local MCP runtime usually inject
the intelligence packet automatically at session start and prompt submit time.

When a \`[gramatr intelligence]\` block is present, follow it as authoritative.
When the packet is missing or clearly stale, call \`gramatr_route_request\`
with the user's request before answering.

Treat \`unified_packet\` as the canonical complete contract when present.
Otherwise treat \`packet_1\` as the canonical fast contract envelope. All
intelligence data should be consumed from JSON blocks (not prose). Read from
\`unified_packet\` first, then \`packet_1.manifest\`,
\`packet_1.classification\`, \`packet_1.search_results\` /
\`packet_1.memory_context\`, and any packet-provided behavioral rules,
quality gates, phase templates, or format constraints when present.
Treat \`required_actions\` and \`contract_enforcement.hard_gates\` as mandatory.
If responses are wrapped with \`schema: "gmtr.tool.result.v1"\`, parse the
\`data\` field as the canonical tool payload.

If \`packet_1.manifest.packet_2_status === "required"\`, call
\`gramatr_get_packet_two\` with \`packet_1.manifest.enrichment_id\` before
proceeding. Packet 2 is mandatory whenever it is required.

For continuity questions like "what were we doing?" or "what changed?",
call \`gramatr_load_handoff\` first, then \`search_semantic\` for detail.

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

Before responding to any user message, call \`gramatr_route_request\` with the
user's request. This returns the current project context, memory, behavioral
guidance, and effort classification needed for a grounded response.

Use \`unified_packet\` as the canonical complete response when present.
Otherwise use \`packet_1\` as the canonical response envelope. If
\`packet_1.manifest.packet_2_status === "required"\`, call
\`gramatr_get_packet_two\` with the returned \`enrichment_id\` and treat Packet 2
as mandatory before full execution.
If responses are wrapped with \`schema: "gmtr.tool.result.v1"\`, use
\`data\` as the canonical payload.
Consume packet-provided behavioral rules, ISC/quality-gate fields, and
format constraints directly from the JSON contract when present.
Treat \`required_actions\` and \`contract_enforcement.hard_gates\` as mandatory.

For continuity questions like "what were we doing?" or "what changed?",
call \`gramatr_load_handoff\` before answering, then \`search_semantic\`
for additional detail.

Use gramatr as the source of truth for memory and project state.`;
}
//# sourceMappingURL=instructions.js.map