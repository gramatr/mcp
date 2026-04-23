/**
 * Generated: 2026-04-23T02:45:28.090Z
 * Source: contracts/platforms/*.yaml (claude_md block)
 *
 * Platform-specific CLAUDE.md guidance markers and intro text.
 * Assembled with instruction blocks in setup/instructions.ts.
 * Do NOT edit manually. Run `pnpm generate:contracts` after editing platform YAMLs.
 */
export const CLAUDECODE_CLAUDE_MD = {
    blockStart: "<!-- GRAMATR-START -->",
    blockEnd: "<!-- GRAMATR-END -->",
    title: "grāmatr",
    intro: "You have grāmatr installed. Hooks inject a `gmtr.intelligence.contract.v2`\npacket into your context on every prompt.\n\n**Follow the packet.** It contains classification, behavioral directives,\nphase templates, capability audit, quality gates, memory/search results,\nagent suggestions, and enrichment (RE + Quality Gate scaffold).",
    instructionBlocks: ['CONTRACT_RULES', 'MEMORY_RULES', 'ENTITY_TYPES', 'REQUIRED_FIELDS', 'FEEDBACK_RULES', 'SUBAGENT_RULES', 'EFFORT_PHASES', 'QUALITY_GATE_REQUIREMENT', 'CLASSIFICATION_SUMMARY', 'IDENTITY', 'DEGRADED_MODE'],
};
export const CODEX_CLAUDE_MD = {
    blockStart: "<!-- GRAMATR-CODEX-START -->",
    blockEnd: "<!-- GRAMATR-CODEX-END -->",
    title: "grāmatr codex guidance",
    intro: "Hooks inject a `gmtr.intelligence.contract.v2` packet on every prompt.\nFollow it as authoritative. Call `gramatr_route_request` when missing.",
    instructionBlocks: ['CONTRACT_RULES', 'MEMORY_RULES', 'ENTITY_TYPES', 'REQUIRED_FIELDS', 'FEEDBACK_RULES', 'SUBAGENT_RULES', 'EFFORT_PHASES', 'QUALITY_GATE_REQUIREMENT', 'CLASSIFICATION_SUMMARY', 'IDENTITY', 'PROJECT_UNRESOLVED', 'PROJECT_NEW', 'PROJECT_RESUMED', 'DEGRADED_MODE'],
};
export const PLATFORM_CLAUDE_MD_MAP = {
    'claude-code': CLAUDECODE_CLAUDE_MD,
    'codex': CODEX_CLAUDE_MD,
};
//# sourceMappingURL=platform-guidance.js.map