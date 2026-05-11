export interface ParsedTranscript {
    lastUserPrompt: string;
    lastAssistantText: string;
    structured?: {
        where_we_are?: string;
        whats_next?: string;
        key_context?: string;
        dont_forget?: string;
    };
}
/**
 * Read the last assistant turn's input_tokens from a JSONL transcript file.
 * The `input_tokens` value is cumulative (total context used so far), not per-turn.
 * Returns null if the file is unreadable, empty, or no usage data is found.
 *
 * Transcript format: each line is JSON with a `type` field.
 * Assistant turns have `message.usage.input_tokens`.
 */
export declare function extractLastInputTokens(transcriptPath: string): number | null;
export declare function parseTranscript(transcriptPath: string): ParsedTranscript | null;
//# sourceMappingURL=transcript-parser.d.ts.map