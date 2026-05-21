#!/usr/bin/env node
// Zero-network Stop hook helper. Reads the session transcript to extract the
// last input token count and writes it to .gramatr/ctx-tokens.json so the
// compact-advisor can check context fill % on the next UserPromptSubmit.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// gramatr-allow: c1
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
async function main() {
    const chunks = [];
    await new Promise((resolve) => {
        process.stdin.on('data', (c) => chunks.push(c));
        process.stdin.on('end', resolve);
        process.stdin.on('error', resolve);
        process.stdin.resume();
    });
    let transcriptPath = null;
    try {
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        transcriptPath = input.transcript_path ?? null;
    }
    catch {
        process.stdout.write('{}');
        return;
    }
    if (!transcriptPath) {
        process.stdout.write('{}');
        return;
    }
    try {
        const content = readFileSync(transcriptPath, 'utf8');
        const lines = content.trim().split('\n');
        let lastInputTokens = null;
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const entry = JSON.parse(line);
                if (entry.type === 'assistant') {
                    const tokens = entry.message?.usage?.input_tokens;
                    if (typeof tokens === 'number' && tokens > 0)
                        lastInputTokens = tokens;
                }
            }
            catch { /* skip malformed */ }
        }
        if (lastInputTokens !== null) {
            const outDir = join(PROJECT_DIR, '.gramatr');
            mkdirSync(outDir, { recursive: true });
            writeFileSync(join(outDir, 'ctx-tokens.json'), JSON.stringify({ ctx_tokens_used: lastInputTokens, updated_at: new Date().toISOString() }) + '\n', 'utf8');
            // Write reflection-due flag so the next UserPromptSubmit nudges the agent
            // to call classification_feedback and save_reflection.
            writeFileSync(join(outDir, 'reflection-due.json'), JSON.stringify({ written_at: new Date().toISOString() }) + '\n', 'utf8');
        }
    }
    catch { /* non-critical */ }
    process.stdout.write('{}');
}
main().catch(() => process.stdout.write('{}'));
//# sourceMappingURL=track-tokens.js.map