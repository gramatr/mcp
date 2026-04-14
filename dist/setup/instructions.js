export const CLAUDE_BLOCK_START = '<!-- GRAMATR-START -->';
export const CLAUDE_BLOCK_END = '<!-- GRAMATR-END -->';
export const CODEX_BLOCK_START = '<!-- GRAMATR-CODEX-START -->';
export const CODEX_BLOCK_END = '<!-- GRAMATR-CODEX-END -->';
// ── Shared contract base ──
// Single source of truth for all platform templates. Platform-specific
// wrappers add only how the packet arrives (hooks vs explicit call).
const CONTRACT_RULES = `**Mandatory contract fields — treat as execution requirements:**
- \`directives.hard_gates\` — non-negotiable behavioral constraints
- \`directives.behavioral_rules\` — algorithm phases, code rules, safety rules
- \`directives.behavioral_directives\` — per-turn instructions from the classifier
- \`process.phase_template\` — effort-gated phase sequence (MUST follow)
- \`process.quality_gate_config\` — ISC verification rules (MUST pass before done)
- \`enrichment.data.reasoning\` — RE + ISC scaffold when present (MUST consume)`;
const MEMORY_RULES = `**Memory:** Use gramatr MCP tools (\`search_semantic\`, \`create_entity\`,
\`add_observation\`), not local markdown files. Never write to MEMORY.md.`;
const ENTITY_TYPES = `**Entity types (38-type taxonomy):** \`create_entity\` requires \`entity_type\`
from: profile, voice, craft, work_style, memory, relationship, preference,
team_identity, org_identity, task, milestone, prd, decision, steering_rule,
skill, agent_definition, playbook, standard, reference, blog_idea,
agent_diary, session, conversation, turn, classification_record,
agent_execution, intelligence_packet, learning_signal, learning_reflection,
learning_pattern, learning_correction, attachment, execution_record,
model_evaluation, benchmark, external_connection, infrastructure, audit_log.
Invalid types are blocked by the PreToolUse hook.`;
const REQUIRED_FIELDS = `**Required fields:** task/milestone: status (open|in_progress|blocked|review|done).
Decision: status + project_id. Session: status + project_id.`;
const FEEDBACK_RULES = `**Feedback loop (MANDATORY — trains the classifier flywheel):**
1. Call \`gramatr_classification_feedback\` after non-trivial work — evaluates
   if effort, intent, and skills were classified correctly.
2. Call \`gramatr_save_reflection\` in LEARN phase — captures what worked, what
   didn't, what a smarter AI would do differently.
Skipping these breaks the training flywheel.`;
const SUBAGENT_RULES = `**Sub-agent composition (MANDATORY for non-trivial sub-agents):**
Before launching any sub-agent, call \`gramatr_route_request\` with the task
prompt. Use the returned packet: RE → task description, ISC scaffold →
acceptance criteria, orchestration.agents.composed → agent system prompt,
hard_gates → constraints. Use \`isolation: "worktree"\` for code-modifying agents.

**Sub-agent audit briefs must include:**
1. Static check — is the config/code correct?
2. Runtime check — does it actually execute successfully?
3. State check — did expected side effects happen (DB writes, API calls)?
4. Error check — capture stderr, don't trust silent success`;
const EFFORT_PHASES = `**Effort-gated phases:**
- instant: RESPOND only
- fast: OBSERVE → RESPOND
- standard: OBSERVE → PLAN → BUILD → VERIFY
- extended+: OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN`;
const IDENTITY = `**Identity:** Read from \`~/.gramatr/settings.json\` — \`daidentity\` for your
name, \`principal\` for the user's name.`;
const DEGRADED_MODE = `**If the server is unavailable:** Degrade cleanly and keep working. Use the
7-phase structure. Create ISC before work. Never combine phases.`;
// ── Platform templates ──
// Each composes from the shared blocks above. Only the intro differs.
export const CLAUDE_CODE_GUIDANCE = `${CLAUDE_BLOCK_START}
# gramatr

You have gramatr installed. Hooks inject a \`gmtr.intelligence.contract.v2\`
packet into your context on every prompt.

**Follow the packet.** It contains classification, behavioral directives,
phase templates, capability audit, quality gates, memory/search results,
agent suggestions, and enrichment (RE + ISC scaffold).

${CONTRACT_RULES}

${MEMORY_RULES}

${ENTITY_TYPES}

${REQUIRED_FIELDS}

${FEEDBACK_RULES}

${SUBAGENT_RULES}

${EFFORT_PHASES}

${IDENTITY}

${DEGRADED_MODE}
${CLAUDE_BLOCK_END}
`;
export const CODEX_GUIDANCE = `${CODEX_BLOCK_START}
# gramatr codex guidance

Hooks inject a \`gmtr.intelligence.contract.v2\` packet on every prompt.
Follow it as authoritative. Call \`gramatr_route_request\` when missing.

${CONTRACT_RULES}

${MEMORY_RULES}

${ENTITY_TYPES}

${REQUIRED_FIELDS}

${FEEDBACK_RULES}

${SUBAGENT_RULES}

${EFFORT_PHASES}

${DEGRADED_MODE}
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

${CONTRACT_RULES}

${MEMORY_RULES}

${ENTITY_TYPES}

${REQUIRED_FIELDS}

${EFFORT_PHASES}

${FEEDBACK_RULES}

${SUBAGENT_RULES}

For continuity questions, call \`gramatr_load_handoff\` then \`search_semantic\`.`;
}
//# sourceMappingURL=instructions.js.map