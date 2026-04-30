/**
 * brain — CLI subcommand for bulk file upload to the grāmatr brain.
 *
 * Reads local files (txt, md, csv, pdf, docx), extracts their text, and
 * pushes the content through the RAG pipeline via `add_observation` +
 * `create_entity` MCP tool calls. No flat files are ever written — all
 * state flows through MCP tool calls to the server/database.
 *
 * Usage:
 *   gramatr brain upload <file>
 *   gramatr brain upload --dir <dir>
 *   gramatr brain upload --dir <dir> --recursive
 *   gramatr brain upload <file> --entity-id <id>
 *   gramatr brain upload <file> --entity-name <name>
 *   gramatr brain --help
 */
export declare const SUPPORTED_EXTENSIONS: Set<string>;
/**
 * Extract plain text from a file buffer based on its extension.
 * Returns null if the extension is unsupported (caller decides whether to warn).
 */
export declare function extractText(filePath: string, buffer: Buffer): Promise<string | null>;
/**
 * Derive an entity name from a file path when no explicit name is given.
 * Strips the extension from the base name.
 */
export declare function deriveEntityName(filePath: string): string;
/**
 * Resolve the entity ID to use for a file upload.
 *
 * Priority:
 *   1. --entity-id <id>   — use the ID directly (no server call)
 *   2. --entity-name <name> — create_entity with that name
 *   3. fallback — create_entity using the filename (without extension)
 *
 * Returns the entity ID as a string, or throws on failure.
 */
export declare function resolveEntityId(filePath: string, entityId: string | undefined, entityName: string | undefined): Promise<string>;
export interface UploadFileOptions {
    entityId?: string;
    entityName?: string;
}
export interface UploadResult {
    file: string;
    entityId?: string;
    error?: string;
    skipped?: boolean;
}
/**
 * Upload a single file to the grāmatr brain.
 */
export declare function uploadFile(filePath: string, options?: UploadFileOptions): Promise<UploadResult>;
/**
 * Collect all supported files in a directory.
 * @param dir        Absolute or relative path to the directory
 * @param recursive  If true, descend into subdirectories
 */
export declare function collectFiles(dir: string, recursive: boolean): string[];
/**
 * runBrain — entry point for `gramatr brain <args>` subcommand.
 * Returns an exit code (0 = success, 1 = one or more errors).
 */
export declare function runBrain(args: string[]): Promise<number>;
//# sourceMappingURL=brain.d.ts.map