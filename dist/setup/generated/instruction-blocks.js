/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/methodology/instruction-blocks.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-04-17T06:07:34.640Z
 */
/** Mandatory contract fields from the v2 intelligence packet */
export const CONTRACT_RULES = "**Mandatory contract fields — treat as execution requirements:**\n- `directives.hard_gates` — non-negotiable behavioral constraints\n- `directives.behavioral_rules` — algorithm phases, code rules, safety rules\n- `directives.behavioral_directives` — per-turn instructions from the classifier\n- `process.phase_template` — effort-gated phase sequence (MUST follow)\n- `process.quality_gate_config` — ISC verification rules (MUST pass before done)\n- `enrichment.data.reasoning` — RE + ISC scaffold when present (MUST consume)";
/** Memory tool usage rules */
export const MEMORY_RULES = "**Memory:** Use gramatr MCP tools (`search_semantic`, `create_entity`,\n`add_observation`), not local markdown files. Never write to MEMORY.md.";
/** Required metadata fields for key entity types */
export const REQUIRED_FIELDS = "**Required fields:** task/milestone: status (open|in_progress|blocked|review|done).\nDecision: status + project_id. Session: status + project_id.";
/** Mandatory ISC creation before any non-instant work — NO EXCEPTIONS */
export const ISC_REQUIREMENT = "**ISC REQUIREMENT — NO EXCEPTIONS:**\nBefore ANY non-instant work, you MUST call TaskCreate with Ideal State\nCriteria. This is not optional. You do not get to decide \"this is too\nsmall\" or \"this would slow things down.\" Every task gets ISC criteria\n(minimum 4, 8-12 words each, state not action) plus at least 1\nanti-criterion (ISC-A). After work, TaskUpdate each criterion with\nPASS/FAIL and specific evidence. Skipping this violates a hard gate.";
/** Mandatory feedback loop for classifier training */
export const FEEDBACK_RULES = "**Feedback loop (MANDATORY — trains the classifier flywheel):**\n1. Call `gramatr_classification_feedback` after non-trivial work — evaluates\n   if effort, intent, and skills were classified correctly.\n2. Call `gramatr_save_reflection` in LEARN phase — captures what worked, what\n   didn't, what a smarter AI would do differently.\nSkipping these breaks the training flywheel.";
/** Sub-agent composition and audit requirements */
export const SUBAGENT_RULES = "**Sub-agent composition (MANDATORY for non-trivial sub-agents):**\nBefore launching any sub-agent, call `gramatr_route_request` with the task\nprompt. Pass the returned packet VERBATIM to the agent — do not rewrite or\nparaphrase: `orchestration.agents.composed` → agent system prompt,\n`enrichment.data.reasoning.isc_scaffold` → acceptance criteria,\n`enrichment.data.reasoning.reverse_engineering` → task context,\n`directives.hard_gates` → constraints. If you disagree with the packet's\nframing, state the disagreement before overriding — never silently replace.\nUse `isolation: \"worktree\"` for code-modifying agents.\n\n**Sub-agent audit briefs must include:**\n1. Static check — is the config/code correct?\n2. Runtime check — does it actually execute successfully?\n3. State check — did expected side effects happen (DB writes, API calls)?\n4. Error check — capture stderr, don't trust silent success";
/** Effort-gated phase sequences */
export const EFFORT_PHASES = "**Effort-gated phases:**\n- instant: RESPOND only\n- fast: OBSERVE → RESPOND (ISC still required for non-trivial fast work)\n- standard: OBSERVE → PLAN → BUILD → VERIFY\n- extended+: OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN";
/** Identity resolution from settings */
export const IDENTITY = "**Identity:** Read from `~/.gramatr/settings.json` — `daidentity` for your\nname, `principal` for the user's name.";
/** Behavior when server is unavailable */
export const DEGRADED_MODE = "**If the server is unavailable:** Degrade cleanly and keep working. Use the\n7-phase structure. Create ISC before work. Never combine phases.";
/** Show classification details to user on non-instant responses */
export const CLASSIFICATION_SUMMARY = "**Classification summary (MANDATORY for non-instant effort):**\nStart each response with a one-line gramatr classification summary.\nFormat: `gramatr | {effort}/{intent} | {confidence}% | {memory_count} memories | {tokens_saved} saved`\nRead values from the v2 packet. Skip for instant effort only.";
/** Project resolution guidance when the v2 packet signals ambiguity */
export const PROJECT_RESOLUTION = "**Project resolution:** When `project_resolution_needed: true` appears in\nthe v2 intelligence packet, the server could not resolve the project\nidentity automatically. You MUST ask the user which project they are\nworking on before proceeding with non-trivial work.\n- If `recent_projects` is provided in the packet, present it as a numbered\n  list and let the user pick.\n- Once resolved, include `project_id` in all subsequent gramatr tool calls\n  for the rest of the session.\n- Do NOT guess the project — always ask when the flag is set.";
//# sourceMappingURL=instruction-blocks.js.map