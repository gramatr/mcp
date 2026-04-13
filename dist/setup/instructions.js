export const CLAUDE_BLOCK_START = '<!-- GRAMATR-START -->';
export const CLAUDE_BLOCK_END = '<!-- GRAMATR-END -->';
export const CODEX_BLOCK_START = '<!-- GRAMATR-CODEX-START -->';
export const CODEX_BLOCK_END = '<!-- GRAMATR-CODEX-END -->';
export const CLAUDE_CODE_GUIDANCE = `${CLAUDE_BLOCK_START}
# gramatr

You have gramatr installed. Local hooks and the local MCP server inject
intelligence as \`[gramatr intelligence — ...]\` into your context.

Follow the intelligence packet. It contains routing, behavioral directives,
memory/search preload, ISC scaffolds, and quality gates.

Use gramatr tools and packet data instead of stale local markdown. Prefer
Packet 1 search results when present. Use \`search_semantic\` for follow-up
queries, not as a replacement for the injected packet.

If the server is unavailable, degrade cleanly and keep working, but do not
pretend intelligence was delivered.
${CLAUDE_BLOCK_END}
`;
export const CODEX_GUIDANCE = `${CODEX_BLOCK_START}
# gramatr codex guidance

## Repo Expectations

- Prefer gramatr memory and project handoff context over ad hoc local summaries.
- Treat Codex hook augmentation as authoritative when a \`[gramatr intelligence]\` block is present.
- If gramatr augmentation is missing, query gramatr memory before relying on stale local notes.
- Prefer TypeScript implementations over shell scripts for client integration code unless the platform requires shell.
- Maintain test coverage for new hook and utility logic.

## Codex Integration

- Repo-local Codex hooks are configured in \`.codex/hooks.json\`.
- \`UserPromptSubmit\` is responsible for prompt enrichment.
- \`SessionStart\` is responsible for session restore and continuity.
- Hook failures must degrade cleanly and never block the user session.
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

Treat \`packet_1\` as the canonical fast contract envelope. Read from
\`packet_1.manifest\`, \`packet_1.classification\`, and
\`packet_1.search_results\` / \`packet_1.memory_context\` when present.

If \`packet_1.manifest.packet_2_status === "required"\`, call
\`gramatr_get_enrichment\` with \`packet_1.manifest.enrichment_id\` before
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

Use \`packet_1\` as the canonical response envelope. If
\`packet_1.manifest.packet_2_status === "required"\`, call
\`gramatr_get_enrichment\` with the returned \`enrichment_id\` and treat Packet 2
as mandatory before full execution.

For continuity questions like "what were we doing?" or "what changed?",
call \`gramatr_load_handoff\` before answering, then \`search_semantic\`
for additional detail.

Use gramatr as the source of truth for memory and project state.`;
}
//# sourceMappingURL=instructions.js.map