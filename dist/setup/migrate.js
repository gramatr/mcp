/**
 * v0.20.74 CLAUDE.md migration helpers.
 *
 * The behavioural substrate (Quality Gates, sub-agent composition,
 * classification summary, phases, project flows, degraded-mode rules) moved
 * out of `~/.claude/CLAUDE.md` and into the MCP server `instructions` field
 * (contracts/mcp/server-instructions.yaml → claude-code variant). The
 * GRAMATR-START/END fence in CLAUDE.md now carries only the identity pointer
 * and a breadcrumb to the loaded instructions.
 *
 * Existing users get migrated the next time they run `gramatr setup` — the
 * install path already invokes `upsertManagedBlock` (in setup-config-io.ts)
 * which rewrites whatever sits between the sentinels with the current
 * CLAUDE_CODE_GUIDANCE value. This module exposes a small pure helper that
 * mirrors that behaviour so callers/tests can exercise the migration without
 * pulling in the full install pipeline.
 */
import { CLAUDE_BLOCK_END, CLAUDE_BLOCK_START, CLAUDE_CODE_GUIDANCE } from "./instructions.js";
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * Idempotent rewrite of the GRAMATR-START/END fence inside a CLAUDE.md
 * document. The new content replaces the previous in-fence content verbatim.
 * Content outside the fence is preserved untouched.
 *
 * - Existing fenced file → in-fence content is replaced.
 * - No fence in file → fence is appended (preserves prior content).
 * - Empty file → fence is written as the file body.
 * - Running migrateClaudeMd twice yields byte-identical output.
 */
export function migrateClaudeMd(existing, fencedContent = CLAUDE_CODE_GUIDANCE) {
    const block = fencedContent.trim();
    const re = new RegExp(`${escapeRegExp(CLAUDE_BLOCK_START)}[\\s\\S]*?${escapeRegExp(CLAUDE_BLOCK_END)}`, "m");
    if (re.test(existing))
        return existing.replace(re, block);
    const trimmed = existing.trim();
    return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}
//# sourceMappingURL=migrate.js.map