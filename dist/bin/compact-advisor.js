#!/usr/bin/env node
// Zero-network UserPromptSubmit hook helper. Checks context window fill % and
// injects an advisory when approaching the limit, so the model saves the
// grāmatr handoff and tells the user to run /clear before context is lost.
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
// gramatr-allow: c1
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const HOME = homedir();
function getModelLimit(model) {
    if (model.includes('opus-4-7'))
        return 1_000_000;
    return 200_000;
}
function readConfig() {
    try {
        return JSON.parse(readFileSync(join(HOME, '.gramatr.json'), 'utf8'));
    }
    catch {
        return {};
    }
}
async function main() {
    // Read but don't block on stdin — we only need env for model
    const chunks = [];
    await new Promise((resolve) => {
        const t = setTimeout(resolve, 500);
        process.stdin.on('data', (c) => chunks.push(c));
        process.stdin.on('end', () => { clearTimeout(t); resolve(); });
        process.stdin.on('error', () => { clearTimeout(t); resolve(); });
        process.stdin.resume();
    });
    const cfg = readConfig();
    const warnPct = cfg.context_window?.warn_pct ?? 70;
    const compactPct = cfg.context_window?.compact_pct ?? 80;
    const auto = cfg.auto_compact?.auto ?? false;
    // gramatr-allow: c1
    const model = process.env.ANTHROPIC_MODEL ?? process.env.CLAUDE_MODEL ?? '';
    const limit = getModelLimit(model);
    const ctxFile = join(PROJECT_DIR, '.gramatr', 'ctx-tokens.json');
    let advisory = '';
    // Compact threshold check — sets advisory when context window is filling up.
    if (existsSync(ctxFile)) {
        let ctxTokensUsed = 0;
        try {
            const data = JSON.parse(readFileSync(ctxFile, 'utf8'));
            ctxTokensUsed = data.ctx_tokens_used ?? 0;
        }
        catch { /* non-critical — leave ctxTokensUsed at 0 */ }
        if (ctxTokensUsed > 0) {
            const pct = Math.round((ctxTokensUsed / limit) * 100);
            const usedK = Math.round(ctxTokensUsed / 1000);
            const limitK = Math.round(limit / 1000);
            if (pct >= compactPct) {
                if (auto) {
                    advisory = `[grāmatr: context ${pct}% full (${usedK}K/${limitK}K) — auto-compact triggered]\nMANDATORY: Your context window is critically full. You MUST: 1) Call save_handoff immediately to preserve session state, 2) Tell the user to run /clear. grāmatr will automatically restore your full context on the next prompt.`;
                }
                else {
                    advisory = `[grāmatr: context ${pct}% full (${usedK}K/${limitK}K)]\nMANDATORY: Tell the user their context window is ${pct}% full. They should run /save-handoff then /clear now to preserve full session state.`;
                }
            }
            else if (pct >= warnPct) {
                advisory = `[grāmatr: context ~${pct}% full (${usedK}K/${limitK}K) — consider /save-handoff + /clear soon]`;
            }
        }
    }
    // Reflection nudge — fires once per turn, clears the flag after injecting.
    const reflectionFile = join(PROJECT_DIR, '.gramatr', 'reflection-due.json');
    if (existsSync(reflectionFile)) {
        let stale = false;
        try {
            const flag = JSON.parse(readFileSync(reflectionFile, 'utf8'));
            const age = flag.written_at ? Date.now() - new Date(flag.written_at).getTime() : Infinity;
            stale = age > 5 * 60 * 1000; // ignore flags older than 5 minutes
        }
        catch {
            stale = true;
        }
        if (!stale) {
            try {
                unlinkSync(reflectionFile);
            }
            catch { /* non-critical */ }
            const reflectionAdvisory = `[grāmatr: MANDATORY END-OF-TURN — Before completing your response, call mcp__plugin_gramatr_gramatr__classification_feedback and mcp__plugin_gramatr_gramatr__save_reflection. These feed the classifier flywheel. The directives.required_actions in this packet specify the exact arguments needed.]`;
            // If there's already a compact advisory, append; otherwise emit standalone.
            if (advisory) {
                advisory = advisory + '\n' + reflectionAdvisory;
            }
            else {
                advisory = reflectionAdvisory;
            }
        }
        else {
            try {
                unlinkSync(reflectionFile);
            }
            catch { /* clean up stale flag */ }
        }
    }
    if (!advisory) {
        process.stdout.write('{}');
        return;
    }
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: advisory,
        },
    }));
}
main().catch(() => process.stdout.write('{}'));
//# sourceMappingURL=compact-advisor.js.map