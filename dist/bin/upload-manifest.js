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
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
export const MANIFEST_SCHEMA = 'gmtr.upload-manifest.v1';
// ── Errors ──────────────────────────────────────────────────────────────────
/**
 * Domain-specific error thrown by the manifest parser. Distinct from generic
 * `Error` so callers (and rubric dimension B1) can identify it precisely.
 */
export class ManifestSchemaError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ManifestSchemaError';
    }
}
// ── sha256 ──────────────────────────────────────────────────────────────────
/**
 * Compute the hex sha256 digest of a buffer. Stable across runs and platforms.
 */
export function sha256Hex(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}
// ── Schema validation ───────────────────────────────────────────────────────
const VALID_STATUSES = new Set([
    'uploaded',
    'reused',
    'skipped',
    'rejected',
    'error',
]);
const VALID_SCOPES = new Set(['user', 'team', 'org', 'public']);
/**
 * Validate that an arbitrary value matches the gmtr.upload-manifest.v1 schema.
 * Returns the manifest typed if valid, throws Error with a specific message
 * otherwise. Forgiving on unknown fields (forward-compat) but strict on the
 * required ones.
 */
export function parseManifest(value) {
    if (typeof value !== 'object' || value === null) {
        throw new ManifestSchemaError('manifest must be a JSON object');
    }
    const obj = value;
    if (obj.schema !== MANIFEST_SCHEMA) {
        throw new ManifestSchemaError(`manifest.schema must be "${MANIFEST_SCHEMA}", got ${JSON.stringify(obj.schema)}`);
    }
    if (typeof obj.version !== 'string') {
        throw new ManifestSchemaError('manifest.version must be a string');
    }
    if (typeof obj.started_at !== 'string') {
        throw new ManifestSchemaError('manifest.started_at must be a string');
    }
    if (obj.finished_at !== null && typeof obj.finished_at !== 'string') {
        throw new ManifestSchemaError('manifest.finished_at must be a string or null');
    }
    if (typeof obj.scope !== 'object' || obj.scope === null) {
        throw new ManifestSchemaError('manifest.scope must be an object');
    }
    const scope = obj.scope;
    if (typeof scope.scope !== 'string' || !VALID_SCOPES.has(scope.scope)) {
        throw new ManifestSchemaError(`manifest.scope.scope must be one of user|team|org|public`);
    }
    if (!Array.isArray(obj.files)) {
        throw new ManifestSchemaError('manifest.files must be an array');
    }
    for (let i = 0; i < obj.files.length; i++) {
        const e = obj.files[i];
        if (typeof e !== 'object' || e === null) {
            throw new ManifestSchemaError(`manifest.files[${i}] must be an object`);
        }
        for (const k of ['path', 'sha256', 'completed_at']) {
            if (typeof e[k] !== 'string') {
                throw new ManifestSchemaError(`manifest.files[${i}].${k} must be a string`);
            }
        }
        if (typeof e.size !== 'number') {
            throw new ManifestSchemaError(`manifest.files[${i}].size must be a number`);
        }
        if (typeof e.status !== 'string' || !VALID_STATUSES.has(e.status)) {
            throw new ManifestSchemaError(`manifest.files[${i}].status must be one of ${[...VALID_STATUSES].join('|')}`);
        }
        if (e.entity_id !== null && typeof e.entity_id !== 'string') {
            throw new ManifestSchemaError(`manifest.files[${i}].entity_id must be a string or null`);
        }
        if (e.scan_result !== null && typeof e.scan_result !== 'string') {
            throw new ManifestSchemaError(`manifest.files[${i}].scan_result must be a string or null`);
        }
        if (e.reason !== null && typeof e.reason !== 'string') {
            throw new ManifestSchemaError(`manifest.files[${i}].reason must be a string or null`);
        }
    }
    return value;
}
// ── Atomic IO ───────────────────────────────────────────────────────────────
/**
 * Write the manifest to `path` atomically:
 *   1. Serialize JSON
 *   2. Write to `<path>.tmp`
 *   3. fs.renameSync into place (POSIX-atomic on same filesystem)
 *
 * A reader observing `path` will always see either the previous full contents
 * or the new full contents — never a partially-written file.
 */
export function writeManifestAtomic(path, manifest) {
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(manifest, null, 2), 'utf8');
    renameSync(tmp, path);
}
/**
 * Read and validate a manifest from disk. Throws if the file does not exist
 * or fails schema validation.
 */
export function readManifest(path) {
    const raw = readFileSync(path, 'utf8');
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new ManifestSchemaError(`manifest at ${path} is not valid JSON: ${msg}`);
    }
    return parseManifest(parsed);
}
// ── Resume index ────────────────────────────────────────────────────────────
/**
 * Build a Map<absolutePath, entry> from a manifest's files array. Last entry
 * wins (the manifest is append/upsert per file, so duplicates should not occur,
 * but be defensive).
 */
export function indexManifestByPath(manifest) {
    const map = new Map();
    for (const e of manifest.files)
        map.set(e.path, e);
    return map;
}
/**
 * Decide what to do with a file given the resume manifest's record (if any).
 *
 * - Not in manifest                              → upload
 * - Path no longer exists on disk                → skip-missing
 * - In manifest, status=error                    → upload (retry)
 * - In manifest, hash differs from current bytes → upload (re-upload)
 * - In manifest, hash matches, status terminal   → skip-previous
 */
export function decideResume(filePath, currentSha256, prior) {
    if (currentSha256 === null) {
        return {
            kind: 'skip-missing',
            note: 'file removed since last run',
        };
    }
    if (!prior)
        return { kind: 'upload' };
    if (prior.status === 'error')
        return { kind: 'upload' };
    if (prior.sha256 !== currentSha256)
        return { kind: 'upload' };
    // Terminal statuses with matching hash — safe to skip.
    let note;
    switch (prior.status) {
        case 'uploaded':
            note = `previously uploaded as entity ${prior.entity_id ?? 'unknown'}`;
            break;
        case 'reused':
            note = `previously reused entity ${prior.entity_id ?? 'unknown'}`;
            break;
        case 'skipped':
            note = `previously skipped (entity ${prior.entity_id ?? 'unknown'})`;
            break;
        case 'rejected':
            note = `previously rejected: ${prior.reason ?? 'unknown'}`;
            break;
        default:
            note = `previously ${prior.status}`;
    }
    return { kind: 'skip-previous', entry: prior, note };
}
// ── Helpers ─────────────────────────────────────────────────────────────────
/** True iff a file currently exists at the given path. */
export function fileExists(path) {
    return existsSync(path);
}
//# sourceMappingURL=upload-manifest.js.map