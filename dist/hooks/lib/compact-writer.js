/**
 * compact-writer.ts — Build and persist a compact context snapshot.
 *
 * Called by UserPromptSubmit when the session turn count crosses the threshold,
 * or manually via /gramatr-compact. Writes to two places:
 *   1. state.db compacts table (indexed by ID, for /gmtr-restore <id>)
 *   2. .gramatr/settings.json last_compact (pointer for auto-restore on session-start)
 */
import { randomBytes } from 'node:crypto';
import { getGitContext, getRecentCommits, getGitStatusShort, readGmtrConfig, writeGmtrConfig, } from './gramatr-hook-utils.js';
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
    const recentPrompts = recentTurns
        .map((t) => t.prompt)
        .filter(Boolean)
        .reverse()
        .join(' → ');
    const summary = [
        `${opts.projectSlug} | ${git?.branch ?? 'unknown'} | ${turnCount} turns`,
        recentPrompts ? `Recent work: ${recentPrompts.slice(0, 400)}` : null,
        recentCommits.length ? `Last commit: ${recentCommits[0]}` : null,
    ]
        .filter(Boolean)
        .join('\n');
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
    if (opts.gitRoot) {
        try {
            const config = readGmtrConfig(opts.gitRoot);
            if (config) {
                config.last_compact = {
                    compact_id: record.id,
                    timestamp: record.created_at,
                    summary: record.summary ?? undefined,
                    turns: record.turns,
                    metadata: record.metadata,
                };
                writeGmtrConfig(opts.gitRoot, config);
            }
        }
        catch {
            // Non-critical — DB has the compact even if settings.json update fails
        }
    }
    return { id: record.id, summary, turnCount };
}
/** Build the injection message for the agent based on client capabilities. */
export function buildCompactInjection(opts) {
    const header = `[gramatr auto-compact — turn ${opts.turnCount}/${opts.turnThreshold}]`;
    if (opts.supportsHookedClear && opts.clearCommand) {
        return (`${header}\n` +
            `Context snapshot saved as \`${opts.compactId}\`. ` +
            `You MUST respond only with:\n` +
            `"gramatr has saved your context (${opts.compactId}). Run \`${opts.clearCommand}\` to reset — your session will restore automatically."`);
    }
    return (`${header}\n` +
        `Context snapshot saved as \`${opts.compactId}\`. ` +
        `You MUST respond only with:\n` +
        `"Context limit approaching. Start a new session and run \`/gmtr-restore ${opts.compactId}\` to continue exactly where we left off."`);
}
//# sourceMappingURL=compact-writer.js.map