import { readFileSync } from 'node:fs';
export function parseTranscript(transcriptPath) {
    try {
        const transcriptContent = readFileSync(transcriptPath, 'utf8');
        const lines = transcriptContent.trim().split('\n');
        let lastUserPrompt = '';
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const entry = JSON.parse(line);
                if (entry.type !== 'human' && entry.type !== 'user')
                    continue;
                const content = entry.message?.content;
                if (typeof content === 'string' && content.trim()) {
                    lastUserPrompt = content.trim();
                    continue;
                }
                if (Array.isArray(content)) {
                    const text = content
                        .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
                        .map((block) => block.text.trim())
                        .filter(Boolean)
                        .join('\n')
                        .trim();
                    if (text)
                        lastUserPrompt = text;
                }
            }
            catch {
                // ignore malformed lines
            }
        }
        return { lastUserPrompt };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=transcript-parser.js.map