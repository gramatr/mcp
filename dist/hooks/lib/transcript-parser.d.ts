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
/**
 * Extract the set of tool names invoked by the assistant in the most recent
 * turn (since the most recent user message). Tools are reported by their
 * `name` field on `tool_use` content blocks. Returns an empty set when the
 * transcript is unreadable or has no tool_use entries.
 *
 * Used by the Stop hook (#2658) to compare actual tool calls against the
 * `required_actions[]` declared by the v2 packet's directives.
 */
export declare function extractLastTurnToolCalls(transcriptPath: string): Set<string>;
export declare function parseTranscript(transcriptPath: string): ParsedTranscript | null;
//# sourceMappingURL=transcript-parser.d.ts.map