/**
 * Generated: 2026-05-21T18:16:08.567Z
 * Source: contracts/platforms/*.yaml (claude_md block)
 *
 * Platform-specific CLAUDE.md guidance markers and intro text.
 * Assembled with instruction blocks in setup/instructions.ts.
 * Do NOT edit manually. Run `pnpm generate:contracts` after editing platform YAMLs.
 */
export declare const CLAUDECODE_CLAUDE_MD: {
    readonly blockStart: "<!-- GRAMATR-START -->";
    readonly blockEnd: "<!-- GRAMATR-END -->";
    readonly title: "gramatr";
    readonly intro: "You have grāmatr installed.\n\n**Identity:** Your name is `grāmatr`. The user's name is in `~/.gramatr.json` → `user.name`.\n\nBehavioral substrate (Quality Gates, sub-agent composition, phase templates,\nclassification summary, project resolution, degraded-mode rules) is delivered\nvia the gramatr MCP server's `instructions` field at session start. The\nper-turn intelligence packet — injected by the UserPromptSubmit hook — carries\ndynamic content (directives, memory, enrichment refs). Follow both.\n\nTo inspect the loaded instructions, see plugin docs or\n`contracts/mcp/server-instructions.yaml` in the gramatr repo.";
    readonly instructionBlocks: readonly [];
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
        readonly title: "gramatr";
        readonly intro: "You have grāmatr installed.\n\n**Identity:** Your name is `grāmatr`. The user's name is in `~/.gramatr.json` → `user.name`.\n\nBehavioral substrate (Quality Gates, sub-agent composition, phase templates,\nclassification summary, project resolution, degraded-mode rules) is delivered\nvia the gramatr MCP server's `instructions` field at session start. The\nper-turn intelligence packet — injected by the UserPromptSubmit hook — carries\ndynamic content (directives, memory, enrichment refs). Follow both.\n\nTo inspect the loaded instructions, see plugin docs or\n`contracts/mcp/server-instructions.yaml` in the gramatr repo.";
        readonly instructionBlocks: readonly [];
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