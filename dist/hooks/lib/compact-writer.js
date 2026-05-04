/**
 * compact-writer.ts — Build and persist a compact context snapshot.
 *
 * Called by UserPromptSubmit when the session turn count crosses the threshold,
 * or manually via /gramatr-compact. Writes to two places:
 *   1. state.db compacts table (indexed by ID, for /gmtr-restore <id>)
 *   2. .gramatr/settings.json last_compact (pointer for auto-restore on session-start)
 */
import { randomBytes } from 'node:crypto';
import { getGitContext, getRecentCommits, getGitStatusShort, } from './gramatr-hook-utils.js';
import { getSessionTurnCount, getRecentTurns, saveCompact, } from './hook-state.js';
function generateCompactId(projectSlug) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(2).toString('hex');
    const slug = projectSlug.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 16);
    return `cmp_${slug}_${date}_${rand}`;
}
export function writeCompact(opts) {
    const git = getGitContext();
    const turnCount = getSessionTurnCount(opts.sessionId);
    const recentTurns = getRecentTurns(opts.sessionId, 5);
    const recentCommits = getRecentCommits(5);
    const changedFiles = getGitStatusShort(20);
    const recentPromptLines = recentTurns
        .filter((t) => t.prompt)
        .reverse()
        .slice(0, 3)
        .map((t) => `- ${(t.prompt ?? '').slice(0, 120)}`);
    const summaryParts = [
        `${opts.projectSlug} | ${git?.branch ?? 'unknown'} | ${turnCount} turns`,
        recentCommits.length ? `Last commit: ${recentCommits[0]}` : null,
        recentPromptLines.length ? `Recent work:\n${recentPromptLines.join('\n')}` : null,
    ];
    const summary = summaryParts.filter(Boolean).join('\n');
    const record = {
        id: generateCompactId(opts.projectSlug),
        project_id: opts.projectId,
        session_id: opts.sessionId,
        created_at: new Date().toISOString(),
        summary,
        turns: recentTurns,
        metadata: {
            branch: git?.branch ?? null,
            files_changed: changedFiles,
            commits: recentCommits,
        },
    };
    saveCompact(record);
    return { id: record.id, summary, turnCount };
}
/** Build the injection message for the agent based on client capabilities. */
export function buildCompactInjection(opts) {
    const header = `[gramatr auto-compact — turn ${opts.turnCount}/${opts.turnThreshold}]`;
    return (`${header}\n` +
        `Context snapshot saved as \`${opts.compactId}\`. ` +
        `Mention this briefly to the user ("gramatr has saved your context. Run \`/gramatr-compact\` before exiting — your next session will restore automatically.") ` +
        `then continue with their request normally.`);
}
//# sourceMappingURL=compact-writer.js.map