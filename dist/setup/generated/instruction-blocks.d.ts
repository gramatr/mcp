/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/methodology/instruction-blocks.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-04-15T21:07:20.885Z
 */
/** Mandatory contract fields from the v2 intelligence packet */
export declare const CONTRACT_RULES = "**Mandatory contract fields \u2014 treat as execution requirements:**\n- `directives.hard_gates` \u2014 non-negotiable behavioral constraints\n- `directives.behavioral_rules` \u2014 algorithm phases, code rules, safety rules\n- `directives.behavioral_directives` \u2014 per-turn instructions from the classifier\n- `process.phase_template` \u2014 effort-gated phase sequence (MUST follow)\n- `process.quality_gate_config` \u2014 ISC verification rules (MUST pass before done)\n- `enrichment.data.reasoning` \u2014 RE + ISC scaffold when present (MUST consume)";
/** Memory tool usage rules */
export declare const MEMORY_RULES = "**Memory:** Use gramatr MCP tools (`search_semantic`, `create_entity`,\n`add_observation`), not local markdown files. Never write to MEMORY.md.";
/** Required metadata fields for key entity types */
export declare const REQUIRED_FIELDS = "**Required fields:** task/milestone: status (open|in_progress|blocked|review|done).\nDecision: status + project_id. Session: status + project_id.";
/** Mandatory ISC creation before any non-instant work — NO EXCEPTIONS */
export declare const ISC_REQUIREMENT = "**ISC REQUIREMENT \u2014 NO EXCEPTIONS:**\nBefore ANY non-instant work, you MUST call TaskCreate with Ideal State\nCriteria. This is not optional. You do not get to decide \"this is too\nsmall\" or \"this would slow things down.\" Every task gets ISC criteria\n(minimum 4, 8-12 words each, state not action) plus at least 1\nanti-criterion (ISC-A). After work, TaskUpdate each criterion with\nPASS/FAIL and specific evidence. Skipping this violates a hard gate.";
/** Mandatory feedback loop for classifier training */
export declare const FEEDBACK_RULES = "**Feedback loop (MANDATORY \u2014 trains the classifier flywheel):**\n1. Call `gramatr_classification_feedback` after non-trivial work \u2014 evaluates\n   if effort, intent, and skills were classified correctly.\n2. Call `gramatr_save_reflection` in LEARN phase \u2014 captures what worked, what\n   didn't, what a smarter AI would do differently.\nSkipping these breaks the training flywheel.";
/** Sub-agent composition and audit requirements */
export declare const SUBAGENT_RULES = "**Sub-agent composition (MANDATORY for non-trivial sub-agents):**\nBefore launching any sub-agent, call `gramatr_route_request` with the task\nprompt. Pass the returned packet VERBATIM to the agent \u2014 do not rewrite or\nparaphrase: `orchestration.agents.composed` \u2192 agent system prompt,\n`enrichment.data.reasoning.isc_scaffold` \u2192 acceptance criteria,\n`enrichment.data.reasoning.reverse_engineering` \u2192 task context,\n`directives.hard_gates` \u2192 constraints. If you disagree with the packet's\nframing, state the disagreement before overriding \u2014 never silently replace.\nUse `isolation: \"worktree\"` for code-modifying agents.\n\n**Sub-agent audit briefs must include:**\n1. Static check \u2014 is the config/code correct?\n2. Runtime check \u2014 does it actually execute successfully?\n3. State check \u2014 did expected side effects happen (DB writes, API calls)?\n4. Error check \u2014 capture stderr, don't trust silent success";
/** Effort-gated phase sequences */
export declare const EFFORT_PHASES = "**Effort-gated phases:**\n- instant: RESPOND only\n- fast: OBSERVE \u2192 RESPOND (ISC still required for non-trivial fast work)\n- standard: OBSERVE \u2192 PLAN \u2192 BUILD \u2192 VERIFY\n- extended+: OBSERVE \u2192 THINK \u2192 PLAN \u2192 BUILD \u2192 EXECUTE \u2192 VERIFY \u2192 LEARN";
/** Identity resolution from settings */
export declare const IDENTITY = "**Identity:** Read from `~/.gramatr/settings.json` \u2014 `daidentity` for your\nname, `principal` for the user's name.";
/** Behavior when server is unavailable */
export declare const DEGRADED_MODE = "**If the server is unavailable:** Degrade cleanly and keep working. Use the\n7-phase structure. Create ISC before work. Never combine phases.";
/** Show classification details to user on non-instant responses */
export declare const CLASSIFICATION_SUMMARY = "**Classification summary (MANDATORY for non-instant effort):**\nStart each response with a one-line gramatr classification summary.\nFormat: `gramatr | {effort}/{intent} | {confidence}% | {memory_count} memories | {tokens_saved} saved`\nRead values from the v2 packet. Skip for instant effort only.";
//# sourceMappingURL=instruction-blocks.d.ts.map