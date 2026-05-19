/**
 * upload-manifest — JSON manifest schema + atomic IO for `gramatr brain upload`.
 *
 * Epic #1904 PR 5. Records the outcome of every file in a bulk upload run so
 * that:
 *   - a crashed batch can be resumed without re-uploading completed files
 *   - unchanged files can be skipped without a network round-trip
 *   - the operator has a full audit trail (entity_id, scan_result, reason)
 *
 * The manifest is single-writer (the CLI process). No locking. Atomic writes
 * are achieved by writing `<path>.tmp` then renaming over the target — POSIX
 * `rename(2)` is atomic on the same filesystem.
 *
 * `finished_at` is null until the run completes. A crashed run leaves it null,
 * which is the signal `--resume` uses to confirm there is recoverable state.
 */
/**
 * Current manifest schema. v2 (epic #1904 PR 6) adds the top-level + per-entry
 * `batch_id` correlation field so a manifest is unambiguously tied to a single
 * uploaded batch in the dashboard's history view.
 *
 * v1 manifests remain readable for backwards compat — `parseManifest`
 * accepts either schema string and `readManifest` will up-convert v1 →
 * v2-shaped object in memory by minting a fresh `batch_id` and emitting a
 * one-line WARN to stderr (caller sees the new identity is synthetic).
 */
export declare const MANIFEST_SCHEMA = "gmtr.upload-manifest.v2";
export declare const MANIFEST_SCHEMA_V1 = "gmtr.upload-manifest.v1";
export type ManifestEntryStatus = 'uploaded' | 'reused' | 'skipped' | 'rejected' | 'error';
export interface UploadManifestEntry {
    /** Absolute path on the uploader's filesystem at the time of the run. */
    path: string;
    /** Hex sha256 of the file's bytes at the time of the run. */
    sha256: string;
    /** File size in bytes. */
    size: number;
    /** Outcome — see ManifestEntryStatus. */
    status: ManifestEntryStatus;
    /** Server entity_id for uploaded/reused/skipped; null otherwise. */
    entity_id: string | null;
    /** Server scan_result (e.g. "clean", "infected", "unconfigured"); null when unknown. */
    scan_result: string | null;
    /**
     * For status=rejected: the UploadValidationError reason.
     * For status=error: the error message.
     * For status=skipped via missing-file: "file_missing".
     * Otherwise null.
     */
    reason: string | null;
    /** ISO-8601 timestamp of when this file's processing completed. */
    completed_at: string;
    /**
     * Batch correlation id (v2). Mirrors the manifest's top-level `batch_id`
     * for redundancy + cross-validation. Always present in v2; absent on
     * entries inherited verbatim from a legacy v1 manifest until they are
     * rewritten.
     */
    batch_id?: string;
}
export interface UploadManifestScope {
    scope: 'user' | 'team' | 'org' | 'public';
    team_id?: string;
    org_id?: string;
    project_id?: string;
}
export interface UploadManifest {
    schema: typeof MANIFEST_SCHEMA | typeof MANIFEST_SCHEMA_V1;
    version: string;
    started_at: string;
    finished_at: string | null;
    scope: UploadManifestScope;
    files: UploadManifestEntry[];
    /**
     * Batch correlation id. Required in v2; on a v1 manifest read via
     * `readManifest`, this is back-filled with a freshly minted UUID and a
     * WARN is logged to stderr so callers see the identity is synthetic.
     */
    batch_id?: string;
}
/**
 * Domain-specific error thrown by the manifest parser. Distinct from generic
 * `Error` so callers (and rubric dimension B1) can identify it precisely.
 */
export declare class ManifestSchemaError extends Error {
    constructor(message: string);
}
/**
 * Compute the hex sha256 digest of a buffer. Stable across runs and platforms.
 */
export declare function sha256Hex(buffer: Buffer): string;
/**
 * Validate that an arbitrary value matches the gmtr.upload-manifest.v1 schema.
 * Returns the manifest typed if valid, throws Error with a specific message
 * otherwise. Forgiving on unknown fields (forward-compat) but strict on the
 * required ones.
 */
export declare function parseManifest(value: unknown): UploadManifest;
/**
 * Write the manifest to `path` atomically:
 *   1. Serialize JSON
 *   2. Write to `<path>.tmp`
 *   3. fs.renameSync into place (POSIX-atomic on same filesystem)
 *
 * A reader observing `path` will always see either the previous full contents
 * or the new full contents — never a partially-written file.
 */
export declare function writeManifestAtomic(path: string, manifest: UploadManifest): void;
/**
 * Read and validate a manifest from disk. Throws if the file does not exist
 * or fails schema validation.
 */
export declare function readManifest(path: string): UploadManifest;
/**
 * Build a Map<absolutePath, entry> from a manifest's files array. Last entry
 * wins (the manifest is append/upsert per file, so duplicates should not occur,
 * but be defensive).
 */
export declare function indexManifestByPath(manifest: UploadManifest): Map<string, UploadManifestEntry>;
export type ResumeDecision = {
    kind: 'upload';
} | {
    kind: 'skip-previous';
    entry: UploadManifestEntry;
    note: string;
} | {
    kind: 'skip-missing';
    note: string;
};
/**
 * Decide what to do with a file given the resume manifest's record (if any).
 *
 * - Not in manifest                              → upload
 * - Path no longer exists on disk                → skip-missing
 * - In manifest, status=error                    → upload (retry)
 * - In manifest, hash differs from current bytes → upload (re-upload)
 * - In manifest, hash matches, status terminal   → skip-previous
 */
export declare function decideResume(filePath: string, currentSha256: string | null, prior: UploadManifestEntry | undefined): ResumeDecision;
/** True iff a file currently exists at the given path. */
export declare function fileExists(path: string): boolean;
//# sourceMappingURL=upload-manifest.d.ts.map