import { ENTITY_TYPES as ENTITY_TYPE_LIST } from '../hooks/generated/schema-constants.js';
import { CONTRACT_RULES, MEMORY_RULES, REQUIRED_FIELDS, QUALITY_GATE_REQUIREMENT, FEEDBACK_RULES, SUBAGENT_RULES, EFFORT_PHASES, IDENTITY, DEGRADED_MODE, CLASSIFICATION_SUMMARY, PROJECT_UNRESOLVED, PROJECT_NEW, PROJECT_RESUMED, } from './generated/instruction-blocks.js';
// Block markers and CLAUDE.md intro text sourced from contracts/platforms/*.yaml
// via generated/platform-guidance.ts. The assembled CLAUDE_CODE_GUIDANCE and
// CODEX_GUIDANCE strings below compose those generated values with instruction blocks.
import { CLAUDECODE_CLAUDE_MD, CODEX_CLAUDE_MD, } from './generated/platform-guidance.js';
export const CLAUDE_BLOCK_START = CLAUDECODE_CLAUDE_MD.blockStart;
export const CLAUDE_BLOCK_END = CLAUDECODE_CLAUDE_MD.blockEnd;
export const CODEX_BLOCK_START = CODEX_CLAUDE_MD.blockStart;
export const CODEX_BLOCK_END = CODEX_CLAUDE_MD.blockEnd;
// ENTITY_TYPES is composed dynamically from the generated enum list — stays in sync automatically.
const ENTITY_TYPES = `**Entity types (${ENTITY_TYPE_LIST.length}-type taxonomy):** \`create_entity\` requires \`entity_type\`
from: ${ENTITY_TYPE_LIST.join(', ')}.
Invalid types are blocked by the PreToolUse hook.`;
// All other instruction blocks imported from generated/instruction-blocks.ts
// Source of truth: contracts/methodology/instruction-blocks.yaml
// ── Platform templates ──
// Each composes from the generated blocks above. Only the intro differs.
export const CLAUDE_CODE_GUIDANCE = `${CLAUDE_BLOCK_START}
# ${CLAUDECODE_CLAUDE_MD.title}

${CLAUDECODE_CLAUDE_MD.intro}

${CONTRACT_RULES}

${MEMORY_RULES}

${ENTITY_TYPES}

${REQUIRED_FIELDS}

${QUALITY_GATE_REQUIREMENT}

${CLASSIFICATION_SUMMARY}

${FEEDBACK_RULES}

${SUBAGENT_RULES}

${EFFORT_PHASES}

${IDENTITY}

${PROJECT_UNRESOLVED}

${PROJECT_NEW}

${PROJECT_RESUMED}

${DEGRADED_MODE}
${CLAUDE_BLOCK_END}
`;
export const CODEX_GUIDANCE = `${CODEX_BLOCK_START}
# ${CODEX_CLAUDE_MD.title}

${CODEX_CLAUDE_MD.intro}

${CONTRACT_RULES}

${MEMORY_RULES}

${ENTITY_TYPES}

${REQUIRED_FIELDS}

${FEEDBACK_RULES}

${SUBAGENT_RULES}

${EFFORT_PHASES}

${PROJECT_UNRESOLVED}

${PROJECT_NEW}

${PROJECT_RESUMED}

${DEGRADED_MODE}
${CODEX_BLOCK_END}
`;
export function buildInstallPromptSuggestion(target) {
    switch (target) {
        case 'claude-code':
        case 'codex':
        case 'gemini-cli':
        case 'opencode':
            return buildHookedPromptSuggestion(target);
        case 'chatgpt-web':
            return buildCompactPromptSuggestion('ChatGPT Web');
        case 'claude-web':
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
    const platformMap = {
        'claude-code': 'Claude Code',
        codex: 'Codex',
        'gemini-cli': 'Gemini CLI',
        opencode: 'OpenCode',
    };
    const platform = platformMap[target];
    return `# gramatr (${platform})

gramatr is installed locally. Hooks inject a \`gmtr.intelligence.contract.v2\`
packet into your context at session start and on every user prompt.

When a gramatr intelligence block is present, follow it as authoritative.
When the packet is missing or clearly stale, call \`route_request\`
with the user's request before answering.

${CONTRACT_RULES}

${ENTITY_TYPES}

${REQUIRED_FIELDS}

${FEEDBACK_RULES}

${SUBAGENT_RULES}

${EFFORT_PHASES}

Use gramatr tools for memory and project state. Never maintain local notes.`;
}
function buildHooklessLocalPromptSuggestion(target) {
    const platformMap = {
        'claude-web': 'Claude Web',
        'claude-desktop': 'Claude Desktop',
        'chatgpt-web': 'ChatGPT Web',
        'chatgpt-desktop': 'ChatGPT Desktop',
        cursor: 'Cursor',
        windsurf: 'Windsurf',
        vscode: 'VS Code',
    };
    return `# gramatr (${platformMap[target]})

You have gramatr connected as an MCP server.

**Before responding to any user message,** call \`route_request\` with
the user's prompt. This returns a \`gmtr.intelligence.contract.v2\` packet.

**Follow the packet.** It contains classification, behavioral directives,
phase templates, capability audit, quality gates, memory/search results,
agent suggestions, and enrichment (RE + Quality Gate scaffold).

${CONTRACT_RULES}

${MEMORY_RULES}

${ENTITY_TYPES}

${REQUIRED_FIELDS}

${EFFORT_PHASES}

${FEEDBACK_RULES}

${SUBAGENT_RULES}

For continuity questions, call \`load_handoff\` then \`search_semantic\`.`;
}
// ── Compact variant (<1500 chars) for platforms with character limits ──
function buildCompactPromptSuggestion(displayName) {
    return `# gramatr (${displayName})

You have gramatr connected as an MCP server.

Before responding to any message, call route_request with the user's prompt. This returns a gmtr.intelligence.contract.v2 packet with classification, directives, memory, and phase templates.

Follow the packet as authoritative. Key fields:
- directives.hard_gates — non-negotiable constraints
- directives.behavioral_directives — per-turn instructions
- process.phase_template — phase sequence to follow (instant→RESPOND, fast→OBSERVE/RESPOND, standard→OBSERVE/PLAN/BUILD/VERIFY, extended+→full 7-phase)
- enrichment.data.reasoning — RE + Quality Gate scaffold when present
- classification.effort_level — determines depth of response
- memory.search_results — pre-loaded context from knowledge graph

Use gramatr MCP tools for memory (search_semantic, create_entity, add_observation). Never maintain local notes or files.

After non-trivial work, call classification_feedback to train the classifier. In LEARN phase, call save_reflection to capture what worked and what didn't.

Entity types are validated server-side. Call list_entity_types for valid types. Required fields: task/milestone need status, decision needs status + project_id.

For continuity questions ("what were we doing?"), call load_handoff then search_semantic for detail.

For common retrieval, prefer execute_intent over chaining low-level tools.`;
}
//# sourceMappingURL=instructions.js.map