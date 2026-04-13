import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
import { readHookInput } from './lib/gramatr-hook-utils.js';
function parseExplicitRating(prompt) {
    const trimmed = prompt.trim();
    const match = trimmed.match(/^(10|[1-9])(?:\s*[-:]\s*|\s+)?(.*)$/);
    if (!match)
        return null;
    const rating = parseInt(match[1], 10);
    const comment = match[2]?.trim() || undefined;
    if (rating < 1 || rating > 10)
        return null;
    if (comment) {
        const sentenceStarters = /^(items?|things?|steps?|files?|lines?|bugs?|issues?|errors?|times?|minutes?|hours?|days?|seconds?|percent|%|th\b|st\b|nd\b|rd\b|of\b|in\b|at\b|to\b|the\b|a\b|an\b)/i;
        if (sentenceStarters.test(comment))
            return null;
    }
    return { rating, comment };
}
export async function runRatingCaptureHook(_args = []) {
    try {
        const data = await readHookInput();
        const prompt = data.prompt || data.message || '';
        if (!prompt.trim())
            return 0;
        const result = parseExplicitRating(prompt);
        if (!result)
            return 0;
        const baseDir = getGramatrDirFromEnv() || join(getHomeDir(), '.gramatr');
        const stateDir = join(baseDir, '.state');
        const ratingsFile = join(stateDir, 'ratings.jsonl');
        if (!existsSync(stateDir))
            mkdirSync(stateDir, { recursive: true });
        const entry = {
            timestamp: new Date().toISOString(),
            rating: result.rating,
            session_id: data.session_id,
            client_type: 'claude_code',
            agent_name: 'Claude Code',
            ...(result.comment ? { comment: result.comment } : {}),
        };
        appendFileSync(ratingsFile, JSON.stringify(entry) + '\n', 'utf8');
        const gmtrUrl = process.env.GRAMATR_URL || 'https://api.gramatr.com/mcp';
        const apiBase = gmtrUrl.replace(/\/mcp$/, '/api/v1');
        fetch(`${apiBase}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedback_type: 'rating',
                rating: entry.rating,
                task_description: entry.comment || `Session rating ${entry.rating}/10`,
                session_id: entry.session_id,
                client_type: entry.client_type,
                agent_name: entry.agent_name,
            }),
            signal: AbortSignal.timeout(5000),
        }).catch(() => { });
        if (result.rating <= 3) {
            try {
                const msg = result.comment ? `Rating ${result.rating}/10: ${result.comment}` : `Rating ${result.rating}/10 received`;
                spawn('osascript', ['-e', `display notification "${msg}" with title "gramatr" subtitle "Low Rating Alert"`], {
                    stdio: 'ignore',
                    detached: true,
                }).unref();
            }
            catch { }
        }
    }
    catch {
        // best effort
    }
    return 0;
}
//# sourceMappingURL=rating-capture.js.map