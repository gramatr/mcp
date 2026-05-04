/**
 * brain — CLI subcommand for bulk file upload to the grāmatr brain.
 *
 * Reads local files (txt, md, csv, pdf, docx) and uploads them to the server
 * via the `bulk_upload` MCP tool. The server is the single source of truth
 * for validation, idempotency (sha256-based dedup), virus scanning (ClamAV),
 * and entity/observation creation. The CLI is a thin wrapper.
 *
 * Migrated in epic #1904 PR 3 from the legacy `create_entity` + `add_observation`
 * chain. The orphan-fix that PR 1 added to `resolveEntityId` is now obsolete:
 * idempotency is enforced server-side via `on_duplicate`.
 *
 * Usage:
 *   gramatr brain upload <file> [flags]
 *   gramatr brain upload --dir <dir> [--recursive] [flags]
 *   gramatr brain --help
 *
 * New flags (PR 3):
 *   --scope <user|team|org|public>   Sharing scope (default: user)
 *   --project-id <id>                Optional project association
 *   --team-id <id>                   Required when --scope=team
 *   --org-id <id>                    Required when --scope=org
 *   --public                         Shorthand for --scope=public
 *   --entity-type <type>             Entity type (default: reference)
 *   --metadata <k=v>                 Repeatable. Adds to entity metadata
 *   --tags <t1,t2,...>               Comma-separated topic tags
 *   --on-duplicate <skip|reuse|new-version>
 *                                    Dedup policy (default: reuse)
 *
 * Exit codes:
 *   0 — all files uploaded (or skipped via on-duplicate=skip)
 *   1 — at least one non-validation error (network/server 5xx)
 *   2 — config error (bad flag combination, missing required value)
 *   3 — at least one file rejected by a validator (oversize, av_*, etc.)
 *
 * NOTE: Until ClamAV is deployed in production (n90-co/prod-argocd-v2#409),
 * every CLI upload returns `av_unconfigured` from the server. This is
 * intentional fail-closed behaviour. There is no client-side bypass.
 */
export declare const SUPPORTED_EXTENSIONS: Set<string>;
/**
 * Extract plain text from a file buffer based on its extension.
 * Returns null if the extension is unsupported.
 *
 * NOTE: as of PR 3, the bulk_upload pipeline ships the raw bytes to the server
 * (which performs its own validation + storage). This helper is preserved for
 * existing callers and unit-test scaffolding only.
 */
export declare function extractText(filePath: string, buffer: Buffer): Promise<string | null>;
/**
 * Derive an entity name from a file path when no explicit name is given.
 * Strips the extension from the base name.
 */
export declare function deriveEntityName(filePath: string): string;
/**
 * Map a server-side `UploadValidationError.reason` to the documented
 * user-friendly CLI message. Reasons not in the table are passed through
 * verbatim so unexpected server errors are still visible.
 */
export declare const VALIDATION_REASON_MESSAGES: Record<string, string>;
/**
 * Render the user-friendly message for a validation reason. For `av_infected`
 * the signature is appended when supplied.
 */
export declare function formatValidationMessage(reason: string, opts?: {
    signature?: string;
}): string;
export interface ParsedArgs {
    positionals: string[];
    entityId?: string;
    entityName?: string;
    dir?: string;
    recursive: boolean;
    dryRun: boolean;
    scope?: string;
    projectId?: string;
    teamId?: string;
    orgId?: string;
    publicShorthand: boolean;
    entityType?: string;
    metadata: string[];
    tags?: string;
    onDuplicate?: string;
    manifest?: string;
    resume?: string;
}
export declare function parseUploadArgs(args: string[]): ParsedArgs;
export interface ValidatedConfig {
    scope: 'user' | 'team' | 'org' | 'public';
    projectId?: string;
    teamId?: string;
    orgId?: string;
    isPublic: boolean;
    entityType: string;
    metadata: Record<string, string>;
    tags: string[];
    onDuplicate: 'skip' | 'reuse' | 'new-version';
}
export interface ValidationFailure {
    ok: false;
    message: string;
}
export interface ValidationSuccess {
    ok: true;
    config: ValidatedConfig;
}
/**
 * Validate the parsed flag combination. Returns either a normalized config or
 * a structured error message. Pure — does not write to stderr or exit.
 */
export declare function validateUploadConfig(parsed: ParsedArgs): ValidationFailure | ValidationSuccess;
export interface UploadFileOptions {
    entityId?: string;
    entityName?: string;
    config: ValidatedConfig;
    /**
     * Pre-read file bytes. When provided, `uploadFile` will not re-read the file
     * from disk — the caller (e.g. the resume/manifest loop) has already loaded
     * and hashed it. Saves one filesystem round-trip per file in batch mode.
     */
    prereadBuffer?: Buffer;
    /**
     * Batch correlation id (epic #1904 PR 6). The runBrain entry point mints
     * one UUID per invocation and passes it on every per-file `bulk_upload`
     * call so audit rows correlate. When omitted, the server mints one per
     * call (which would prevent correlation across files in the same batch).
     */
    batchId?: string;
}
export interface UploadResult {
    file: string;
    entityId?: string;
    observationId?: string;
    wasDuplicate?: boolean;
    error?: string;
    /** True iff the failure was a server-side validation rejection. */
    validationReason?: string;
    skipped?: boolean;
}
/**
 * Build the bulk_upload tool input for a given file. Exported so tests can
 * assert the exact shape forwarded to the server.
 */
export declare function buildBulkUploadInput(filePath: string, buffer: Buffer, options: UploadFileOptions): Record<string, unknown>;
/**
 * Upload a single file via the `bulk_upload` MCP tool.
 */
export declare function uploadFile(filePath: string, options: UploadFileOptions): Promise<UploadResult>;
/**
 * Collect all supported files in a directory.
 * @param dir        Absolute or relative path to the directory
 * @param recursive  If true, descend into subdirectories
 */
export declare function collectFiles(dir: string, recursive: boolean): string[];
/**
 * runBrain — entry point for `gramatr brain <args>` subcommand.
 * Returns an exit code (0/1/2/3 — see top of file).
 */
export declare function runBrain(args: string[]): Promise<number>;
//# sourceMappingURL=brain.d.ts.map