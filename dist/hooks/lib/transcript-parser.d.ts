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
export declare function parseTranscript(transcriptPath: string): ParsedTranscript | null;
//# sourceMappingURL=transcript-parser.d.ts.map