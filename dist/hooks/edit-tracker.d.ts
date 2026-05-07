/**
 * edit-tracker.ts — PreToolUse hook for Write and Edit tools.
 *
 * Tracks modified files by appending to a JSONL log at
 * ~/.gramatr/debug/modified-files.jsonl. Always allows — this is a
 * tracking-only hook that never denies operations.
 */
export declare function trackModifiedFile(toolName: string, filePath: string): void;
export declare function runEditTrackerHook(_args?: string[]): Promise<number>;
//# sourceMappingURL=edit-tracker.d.ts.map