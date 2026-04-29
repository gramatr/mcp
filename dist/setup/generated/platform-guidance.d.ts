/**
 * Generated: 2026-04-23T02:45:28.090Z
 * Source: contracts/platforms/*.yaml (claude_md block)
 *
 * Platform-specific CLAUDE.md guidance markers and intro text.
 * Assembled with instruction blocks in setup/instructions.ts.
 * Do NOT edit manually. Run `pnpm generate:contracts` after editing platform YAMLs.
 */
export declare const CLAUDECODE_CLAUDE_MD: {
    readonly blockStart: "<!-- GRAMATR-START -->";
    readonly blockEnd: "<!-- GRAMATR-END -->";
    readonly title: "grāmatr";
    readonly intro: "You have grāmatr installed. Hooks inject a `gmtr.intelligence.contract.v2`\npacket into your context on every prompt.\n\n**Follow the packet.** It contains classification, behavioral directives,\nphase templates, capability audit, quality gates, memory/search results,\nagent suggestions, and enrichment (RE + Quality Gate scaffold).";
    readonly instructionBlocks: readonly ["CONTRACT_RULES", "MEMORY_RULES", "ENTITY_TYPES", "REQUIRED_FIELDS", "FEEDBACK_RULES", "SUBAGENT_RULES", "EFFORT_PHASES", "QUALITY_GATE_REQUIREMENT", "CLASSIFICATION_SUMMARY", "IDENTITY", "DEGRADED_MODE"];
};
export declare const CODEX_CLAUDE_MD: {
    readonly blockStart: "<!-- GRAMATR-CODEX-START -->";
    readonly blockEnd: "<!-- GRAMATR-CODEX-END -->";
    readonly title: "grāmatr codex guidance";
    readonly intro: "Hooks inject a `gmtr.intelligence.contract.v2` packet on every prompt.\nFollow it as authoritative. Call `route_request` when missing.";
    readonly instructionBlocks: readonly ["CONTRACT_RULES", "MEMORY_RULES", "ENTITY_TYPES", "REQUIRED_FIELDS", "FEEDBACK_RULES", "SUBAGENT_RULES", "EFFORT_PHASES", "QUALITY_GATE_REQUIREMENT", "CLASSIFICATION_SUMMARY", "IDENTITY", "PROJECT_UNRESOLVED", "PROJECT_NEW", "PROJECT_RESUMED", "DEGRADED_MODE"];
};
export declare const PLATFORM_CLAUDE_MD_MAP: {
    readonly 'claude-code': {
        readonly blockStart: "<!-- GRAMATR-START -->";
        readonly blockEnd: "<!-- GRAMATR-END -->";
        readonly title: "grāmatr";
        readonly intro: "You have grāmatr installed. Hooks inject a `gmtr.intelligence.contract.v2`\npacket into your context on every prompt.\n\n**Follow the packet.** It contains classification, behavioral directives,\nphase templates, capability audit, quality gates, memory/search results,\nagent suggestions, and enrichment (RE + Quality Gate scaffold).";
        readonly instructionBlocks: readonly ["CONTRACT_RULES", "MEMORY_RULES", "ENTITY_TYPES", "REQUIRED_FIELDS", "FEEDBACK_RULES", "SUBAGENT_RULES", "EFFORT_PHASES", "QUALITY_GATE_REQUIREMENT", "CLASSIFICATION_SUMMARY", "IDENTITY", "DEGRADED_MODE"];
    };
    readonly codex: {
        readonly blockStart: "<!-- GRAMATR-CODEX-START -->";
        readonly blockEnd: "<!-- GRAMATR-CODEX-END -->";
        readonly title: "grāmatr codex guidance";
        readonly intro: "Hooks inject a `gmtr.intelligence.contract.v2` packet on every prompt.\nFollow it as authoritative. Call `route_request` when missing.";
        readonly instructionBlocks: readonly ["CONTRACT_RULES", "MEMORY_RULES", "ENTITY_TYPES", "REQUIRED_FIELDS", "FEEDBACK_RULES", "SUBAGENT_RULES", "EFFORT_PHASES", "QUALITY_GATE_REQUIREMENT", "CLASSIFICATION_SUMMARY", "IDENTITY", "PROJECT_UNRESOLVED", "PROJECT_NEW", "PROJECT_RESUMED", "DEGRADED_MODE"];
    };
};
//# sourceMappingURL=platform-guidance.d.ts.map