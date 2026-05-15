import { readFileSync } from 'node:fs';
/** Extract text blocks from a JSONL assistant message content array. */
function extractAssistantText(content) {
    if (typeof content === 'string')
        return content.trim();
    if (!Array.isArray(content))
        return '';
    return content
        .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
        .map((block) => block.text.trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}
/**
 * Scan an assistant message content array for a save_handoff tool_use block.
 * Returns the structured input if found, otherwise null.
 */
function extractHandoffFromToolUse(content) {
    if (!Array.isArray(content))
        return null;
    for (const block of content) {
        if (block?.type === 'tool_use' &&
            (block?.name === 'save_handoff' || block?.name === 'saveHandoff') &&
            block?.input != null) {
            const input = block.input;
            const result = {};
            if (typeof input.where_we_are === 'string' && input.where_we_are.trim())
                result.where_we_are = input.where_we_are.trim();
            if (typeof input.whats_next === 'string' && input.whats_next.trim())
                result.whats_next = input.whats_next.trim();
            if (typeof input.key_context === 'string' && input.key_context.trim())
                result.key_context = input.key_context.trim();
            if (typeof input.dont_forget === 'string' && input.dont_forget.trim())
                result.dont_forget = input.dont_forget.trim();
            // Only return if at least one field was extracted
            if (Object.keys(result).length > 0)
                return result;
        }
    }
    return null;
}
/**
 * Scan a text string for markdown section headers matching the handoff fields.
 * Captures text between headers.
 */
function extractHandoffFromMarkdown(text) {
    const fieldMap = {
        where_we_are: 'where_we_are',
        whats_next: 'whats_next',
        "what's_next": 'whats_next',
        key_context: 'key_context',
        dont_forget: 'dont_forget',
    };
    // Build a regex that matches any of the header names (case-insensitive)
    const headerPattern = /^##\s+(where_we_are|whats_next|what's_next|key_context|dont_forget)\s*$/im;
    if (!headerPattern.test(text))
        return null;
    const result = {};
    // Split on any ## header
    const sections = text.split(/^##\s+/m);
    for (const section of sections) {
        const newline = section.indexOf('\n');
        if (newline === -1)
            continue;
        const headerRaw = section.slice(0, newline).trim().toLowerCase();
        const body = section.slice(newline + 1).trim();
        if (!body)
            continue;
        const field = fieldMap[headerRaw];
        if (field) {
            result[field] = body;
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}
/**
 * Read the last assistant turn's input_tokens from a JSONL transcript file.
 * The `input_tokens` value is cumulative (total context used so far), not per-turn.
 * Returns null if the file is unreadable, empty, or no usage data is found.
 *
 * Transcript format: each line is JSON with a `type` field.
 * Assistant turns have `message.usage.input_tokens`.
 */
export function extractLastInputTokens(transcriptPath) {
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
                    const usage = entry.message?.usage;
                    if (typeof usage?.input_tokens === 'number' && usage.input_tokens > 0) {
                        lastInputTokens = usage.input_tokens;
                    }
                }
            }
            catch {
                // ignore malformed lines
            }
        }
        return lastInputTokens;
    }
    catch {
        return null;
    }
}
/**
 * Extract the set of tool names invoked by the assistant in the most recent
 * turn (since the most recent user message). Tools are reported by their
 * `name` field on `tool_use` content blocks. Returns an empty set when the
 * transcript is unreadable or has no tool_use entries.
 *
 * Used by the Stop hook (#2658) to compare actual tool calls against the
 * `required_actions[]` declared by the v2 packet's directives.
 */
export function extractLastTurnToolCalls(transcriptPath) {
    const out = new Set();
    try {
        const content = readFileSync(transcriptPath, 'utf8');
        const lines = content.trim().split('\n');
        // Walk backwards from the last line; collect tool_use names until we hit
        // the most recent user/human entry, which marks the start of the turn.
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (!line || !line.trim())
                continue;
            try {
                const entry = JSON.parse(line);
                if (entry.type === 'user' || entry.type === 'human')
                    break;
                if (entry.type !== 'assistant')
                    continue;
                const blocks = entry.message?.content;
                if (!Array.isArray(blocks))
                    continue;
                for (const block of blocks) {
                    if (block?.type === 'tool_use' && typeof block?.name === 'string') {
                        out.add(block.name);
                    }
                }
            }
            catch {
                // ignore malformed lines
            }
        }
    }
    catch {
        // ignore
    }
    return out;
}
export function parseTranscript(transcriptPath) {
    try {
        const transcriptContent = readFileSync(transcriptPath, 'utf8');
        const lines = transcriptContent.trim().split('\n');
        let lastUserPrompt = '';
        let lastAssistantText = '';
        let structured;
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const entry = JSON.parse(line);
                if (entry.type === 'human' || entry.type === 'user') {
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
                    continue;
                }
                if (entry.type === 'assistant') {
                    const content = entry.message?.content;
                    // Primary path: look for save_handoff tool_use block
                    const toolUseResult = extractHandoffFromToolUse(content);
                    if (toolUseResult) {
                        structured = toolUseResult;
                    }
                    // Track last assistant text for markdown fallback
                    const assistantText = extractAssistantText(content);
                    if (assistantText)
                        lastAssistantText = assistantText;
                }
            }
            catch {
                // ignore malformed lines
            }
        }
        // Fallback path: scan last assistant text for markdown section headers
        if (!structured && lastAssistantText) {
            const markdownResult = extractHandoffFromMarkdown(lastAssistantText);
            if (markdownResult)
                structured = markdownResult;
        }
        return { lastUserPrompt, lastAssistantText, structured };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=transcript-parser.js.map