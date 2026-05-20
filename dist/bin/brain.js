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
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, basename, join, resolve } from 'node:path';
import { callTool } from '../proxy/local-client.js';
import { MANIFEST_SCHEMA, MANIFEST_SCHEMA_V1, decideResume, fileExists, indexManifestByPath, readManifest, sha256Hex, writeManifestAtomic, } from './upload-manifest.js';
// CLI version stamped into manifests. Synced with @gramatr/mcp package.json.
const CLI_VERSION = '0.13.76';
// ── Supported extensions ────────────────────────────────────────────────────
export const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.pdf', '.docx']);
// ── Text extraction (kept for backwards-compatibility tests) ────────────────
/**
 * Extract plain text from a file buffer based on its extension.
 * Returns null if the extension is unsupported.
 *
 * NOTE: as of PR 3, the bulk_upload pipeline ships the raw bytes to the server
 * (which performs its own validation + storage). This helper is preserved for
 * existing callers and unit-test scaffolding only.
 */
export async function extractText(filePath, buffer) {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.txt' || ext === '.md' || ext === '.csv') {
        return buffer.toString('utf8');
    }
    if (ext === '.pdf') {
        const pdfParse = (await import('pdf-parse')).default;
        const result = await pdfParse(buffer);
        return result.text;
    }
    if (ext === '.docx') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }
    return null;
}
// ── Entity-name derivation ──────────────────────────────────────────────────
/**
 * Derive an entity name from a file path when no explicit name is given.
 * Strips the extension from the base name.
 */
export function deriveEntityName(filePath) {
    const base = basename(filePath);
    const ext = extname(base);
    return ext ? base.slice(0, -ext.length) : base;
}
// ── Validation-error → user-message mapping ─────────────────────────────────
/**
 * Map a server-side `UploadValidationError.reason` to the documented
 * user-friendly CLI message. Reasons not in the table are passed through
 * verbatim so unexpected server errors are still visible.
 */
export const VALIDATION_REASON_MESSAGES = {
    av_unconfigured: 'Server has no antivirus scanner configured. Upload rejected. Contact your admin to deploy ClamAV.',
    av_unavailable: 'Antivirus scanner is unreachable from the server. Upload rejected (fail-closed). Try again shortly.',
    av_infected: 'File rejected: malware detected. Upload denied.',
    oversize: 'File exceeds the upload size limit (25 MB by default). Reduce the file or contact your admin.',
    magic_mismatch: 'File content type does not match the declared extension. Possible polyglot. Upload denied.',
    docx_macro: 'DOCX contains macros (vbaProject.bin). Macros are not allowed. Upload denied.',
    pdf_javascript: 'PDF contains embedded JavaScript. Not allowed. Upload denied.',
    pdf_launch: 'PDF contains a /Launch action. Not allowed. Upload denied.',
};
const VALIDATION_REASONS = new Set(Object.keys(VALIDATION_REASON_MESSAGES));
/**
 * Render the user-friendly message for a validation reason. For `av_infected`
 * the signature is appended when supplied.
 */
export function formatValidationMessage(reason, opts) {
    const base = VALIDATION_REASON_MESSAGES[reason];
    if (!base)
        return `Upload rejected — ${reason}`;
    if (reason === 'av_infected' && opts?.signature) {
        return `File rejected: malware detected (signature: ${opts.signature}). Upload denied.`;
    }
    return base;
}
// ── Flag parsing ────────────────────────────────────────────────────────────
const ALLOWED_SCOPES = new Set(['user', 'team', 'org', 'public']);
const ALLOWED_ON_DUPLICATE = new Set(['skip', 'reuse', 'new-version']);
// Flags that take a value (consume the next arg).
const VALUE_FLAGS = new Set([
    '--entity-id',
    '--entity-name',
    '--dir',
    '--scope',
    '--project-id',
    '--team-id',
    '--org-id',
    '--entity-type',
    '--metadata',
    '--tags',
    '--on-duplicate',
    '--manifest',
    '--resume',
]);
// Repeatable flags — collect every occurrence into an array.
const REPEATABLE_FLAGS = new Set(['--metadata']);
export function parseUploadArgs(args) {
    const out = {
        positionals: [],
        recursive: false,
        dryRun: false,
        publicShorthand: false,
        metadata: [],
    };
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (REPEATABLE_FLAGS.has(arg)) {
            const v = args[i + 1];
            if (v === undefined) {
                // Treat missing value as empty so downstream validation reports it.
                out.metadata.push('');
            }
            else {
                out.metadata.push(v);
            }
            i += 2;
            continue;
        }
        if (VALUE_FLAGS.has(arg)) {
            const v = args[i + 1];
            switch (arg) {
                case '--entity-id':
                    out.entityId = v;
                    break;
                case '--entity-name':
                    out.entityName = v;
                    break;
                case '--dir':
                    out.dir = v;
                    break;
                case '--scope':
                    out.scope = v;
                    break;
                case '--project-id':
                    out.projectId = v;
                    break;
                case '--team-id':
                    out.teamId = v;
                    break;
                case '--org-id':
                    out.orgId = v;
                    break;
                case '--entity-type':
                    out.entityType = v;
                    break;
                case '--tags':
                    out.tags = v;
                    break;
                case '--on-duplicate':
                    out.onDuplicate = v;
                    break;
                case '--manifest':
                    out.manifest = v;
                    break;
                case '--resume':
                    out.resume = v;
                    break;
            }
            i += 2;
            continue;
        }
        if (arg === '--recursive') {
            out.recursive = true;
            i += 1;
            continue;
        }
        if (arg === '--dry-run') {
            out.dryRun = true;
            i += 1;
            continue;
        }
        if (arg === '--public') {
            out.publicShorthand = true;
            i += 1;
            continue;
        }
        if (arg.startsWith('--')) {
            i += 1;
            continue;
        } // unknown boolean flag — ignore
        out.positionals.push(arg);
        i += 1;
    }
    return out;
}
/**
 * Validate the parsed flag combination. Returns either a normalized config or
 * a structured error message. Pure — does not write to stderr or exit.
 */
export function validateUploadConfig(parsed) {
    if (parsed.entityId && parsed.entityName) {
        return { ok: false, message: '--entity-id and --entity-name are mutually exclusive' };
    }
    // Resolve scope — handle --public shorthand.
    let scope;
    if (parsed.publicShorthand) {
        if (parsed.scope && parsed.scope !== 'public') {
            return {
                ok: false,
                message: `--public conflicts with --scope=${parsed.scope}`,
            };
        }
        scope = 'public';
    }
    else if (parsed.scope === undefined) {
        scope = 'user';
    }
    else if (ALLOWED_SCOPES.has(parsed.scope)) {
        scope = parsed.scope;
    }
    else {
        return {
            ok: false,
            message: `--scope must be one of: user | team | org | public (got "${parsed.scope}")`,
        };
    }
    if (scope === 'team' && !parsed.teamId) {
        return { ok: false, message: '--scope=team requires --team-id <uuid>' };
    }
    if (scope === 'org' && !parsed.orgId) {
        return { ok: false, message: '--scope=org requires --org-id <uuid>' };
    }
    // on-duplicate
    let onDuplicate;
    if (parsed.onDuplicate === undefined) {
        onDuplicate = 'reuse';
    }
    else if (ALLOWED_ON_DUPLICATE.has(parsed.onDuplicate)) {
        onDuplicate = parsed.onDuplicate;
    }
    else {
        return {
            ok: false,
            message: `--on-duplicate must be one of: skip | reuse | new-version (got "${parsed.onDuplicate}")`,
        };
    }
    // metadata k=v
    const metadata = {};
    for (const raw of parsed.metadata) {
        const eq = raw.indexOf('=');
        if (eq <= 0) {
            return { ok: false, message: `--metadata "${raw}" must be in key=value form with non-empty key` };
        }
        const key = raw.slice(0, eq).trim();
        const value = raw.slice(eq + 1);
        if (key.length === 0) {
            return { ok: false, message: `--metadata "${raw}" has empty key` };
        }
        metadata[key] = value;
    }
    // tags
    const tags = [];
    if (parsed.tags) {
        for (const t of parsed.tags.split(',')) {
            const trimmed = t.trim();
            if (trimmed.length > 0)
                tags.push(trimmed);
        }
    }
    return {
        ok: true,
        config: {
            scope,
            projectId: parsed.projectId,
            teamId: parsed.teamId,
            orgId: parsed.orgId,
            isPublic: scope === 'public',
            entityType: parsed.entityType ?? 'reference',
            metadata,
            tags,
            onDuplicate,
        },
    };
}
/**
 * Build the bulk_upload tool input for a given file. Exported so tests can
 * assert the exact shape forwarded to the server.
 */
export function buildBulkUploadInput(filePath, buffer, options) {
    const filename = basename(filePath);
    const input = {
        content_base64: buffer.toString('base64'),
        filename,
        entity_type: options.config.entityType,
        scope: options.config.scope,
        on_duplicate: options.config.onDuplicate,
        is_public: options.config.isPublic,
    };
    if (options.entityId)
        input.entity_id = options.entityId;
    else if (options.entityName)
        input.entity_name = options.entityName;
    else
        input.entity_name = deriveEntityName(filePath);
    if (options.config.projectId)
        input.project_id = options.config.projectId;
    if (options.config.teamId)
        input.team_id = options.config.teamId;
    if (options.config.orgId)
        input.org_id = options.config.orgId;
    if (Object.keys(options.config.metadata).length > 0)
        input.metadata = options.config.metadata;
    if (options.config.tags.length > 0)
        input.tags = options.config.tags;
    if (options.batchId)
        input.batch_id = options.batchId;
    return input;
}
function parseToolBody(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
/**
 * Upload a single file via the `bulk_upload` MCP tool.
 */
export async function uploadFile(filePath, options) {
    const ext = extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
        process.stderr.write(`[gramatr] skipping ${filePath} (unsupported type: ${ext})\n`);
        return { file: filePath, skipped: true };
    }
    let buffer;
    if (options.prereadBuffer) {
        buffer = options.prereadBuffer;
    }
    else {
        try {
            buffer = readFileSync(filePath);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[gramatr] ✗ ${filePath}: ${message}\n`);
            return { file: filePath, error: message };
        }
    }
    if (buffer.length === 0) {
        process.stderr.write(`[gramatr] skipping ${filePath} (empty content)\n`);
        return { file: filePath, skipped: true };
    }
    process.stderr.write(`[gramatr] uploading ${basename(filePath)} (${buffer.length} bytes)...\n`);
    const input = buildBulkUploadInput(filePath, buffer, options);
    const result = await callTool('bulk_upload', input);
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text : '';
    const parsed = parseToolBody(text);
    if (result.isError) {
        if (parsed?.type === 'UploadValidationError' && parsed.reason) {
            const userMsg = formatValidationMessage(parsed.reason, { signature: parsed.signature });
            process.stderr.write(`[gramatr] ✗ ${basename(filePath)}: ${userMsg}\n`);
            return { file: filePath, error: userMsg, validationReason: parsed.reason };
        }
        const errMsg = parsed?.error ?? text ?? 'unknown error';
        process.stderr.write(`[gramatr] ✗ ${basename(filePath)}: bulk_upload failed — ${errMsg}\n`);
        return { file: filePath, error: errMsg };
    }
    if (!parsed?.entity_id) {
        const errMsg = `bulk_upload returned no entity_id: ${text}`;
        process.stderr.write(`[gramatr] ✗ ${basename(filePath)}: ${errMsg}\n`);
        return { file: filePath, error: errMsg };
    }
    const dupSuffix = parsed.was_duplicate ? ' (duplicate)' : '';
    process.stderr.write(`[gramatr] ✓ ${basename(filePath)} → entity ${parsed.entity_id}${dupSuffix}\n`);
    return {
        file: filePath,
        entityId: parsed.entity_id,
        observationId: parsed.observation_id,
        wasDuplicate: parsed.was_duplicate === true,
    };
}
// ── Directory collection ────────────────────────────────────────────────────
/**
 * Collect all supported files in a directory.
 * @param dir        Absolute or relative path to the directory
 * @param recursive  If true, descend into subdirectories
 */
export function collectFiles(dir, recursive) {
    const files = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            if (recursive) {
                files.push(...collectFiles(fullPath, true));
            }
        }
        else if (stat.isFile()) {
            const ext = extname(entry).toLowerCase();
            if (SUPPORTED_EXTENSIONS.has(ext)) {
                files.push(fullPath);
            }
        }
    }
    return files;
}
// ── Help text ────────────────────────────────────────────────────────────────
function printBrainHelp() {
    process.stderr.write(`
  gramatr brain — Upload local files to the grāmatr brain (via bulk_upload)

  Usage:
    brain upload <file>                     Upload a single file
    brain upload --dir <dir>                Upload all supported files in a directory
    brain upload --dir <dir> --recursive    Recurse into subdirectories
    brain --help                            Show this help

  Supported file types:
    .txt  .md  .csv  .pdf  .docx

  Entity options:
    --entity-id <id>          Attach to an existing entity by ID
    --entity-name <name>      Use this entity name (server creates if missing)
                              Default: filename without extension
    --entity-type <type>      Entity type (default: reference)

  Sharing / scope:
    --scope <user|team|org|public>   Default: user
    --project-id <uuid>              Optional project association
    --team-id <uuid>                 Required when --scope=team
    --org-id <uuid>                  Required when --scope=org
    --public                         Shorthand for --scope=public

  Metadata:
    --metadata key=value      Repeatable. Adds entries to entity metadata
    --tags t1,t2,t3           Comma-separated topic tags

  Dedup policy:
    --on-duplicate <skip|reuse|new-version>
                              Server-side dedup behaviour (default: reuse)
                                skip        — leave existing entity untouched
                                reuse       — append observation to existing entity
                                new-version — create "<name> v2" / v3 / ...

  Resume / manifest:
    --manifest <path>         Write a JSON manifest of upload outcomes to <path>,
                              atomically updated after each file. Schema:
                              gmtr.upload-manifest.v1 (see docs).
    --resume <path>           Read a prior manifest and skip files that completed
                              last run (per content hash). Files with status=error
                              are retried; files whose content has changed are
                              re-uploaded. Files no longer on disk are recorded
                              as skipped (file_missing).

  Other flags:
    --dry-run                 Preflight only — show what would be uploaded
    --recursive               With --dir, walk subdirectories

  Exit codes:
    0   all files uploaded (or skipped via on-duplicate=skip)
    1   at least one non-validation error (network / 5xx)
    2   config error (bad flag combination)
    3   at least one file rejected by a server-side validator

  Examples:
    brain upload project-brief.pdf
    brain upload notes.md --entity-name "Q3 Research" --tags strategy,2026
    brain upload contract.docx --entity-id abc-123 --on-duplicate new-version
    brain upload --dir ./docs --scope team --team-id <team-uuid>
    brain upload --dir ./research --recursive --metadata source=arxiv --metadata year=2026
    brain upload report.pdf --public
    brain upload --dir ./docs --manifest /tmp/upload.json
    brain upload --dir ./docs --manifest /tmp/upload.json --resume /tmp/upload.json

  NOTE: bulk_upload requires ClamAV to be deployed on the server. Until then,
        every upload returns av_unconfigured (fail-closed by design).

`);
}
// ── Main entry point ─────────────────────────────────────────────────────────
/**
 * runBrain — entry point for `gramatr brain <args>` subcommand.
 * Returns an exit code (0/1/2/3 — see top of file).
 */
export async function runBrain(args) {
    const subcommand = args[0];
    if (!subcommand || subcommand === '--help' || subcommand === '-h') {
        printBrainHelp();
        return 0;
    }
    if (subcommand !== 'upload') {
        process.stderr.write(`[gramatr] Unknown brain subcommand: ${subcommand}\n`);
        process.stderr.write('  Supported: upload\n');
        process.stderr.write('  Run: gramatr brain --help\n');
        return 1;
    }
    // -- upload subcommand --
    const parsed = parseUploadArgs(args.slice(1));
    const validation = validateUploadConfig(parsed);
    if (!validation.ok) {
        process.stderr.write(`[gramatr] ✗ ${validation.message}\n`);
        process.stderr.write('  Run: gramatr brain --help\n');
        return 2;
    }
    const { config } = validation;
    // Build the list of files to upload
    const filePaths = [];
    if (parsed.dir) {
        const absDir = resolve(parsed.dir);
        let dirFiles;
        try {
            dirFiles = collectFiles(absDir, parsed.recursive);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[gramatr] ✗ Cannot read directory ${absDir}: ${message}\n`);
            return 1;
        }
        if (dirFiles.length === 0) {
            process.stderr.write(`[gramatr] No supported files found in ${absDir}\n`);
            return 0;
        }
        filePaths.push(...dirFiles);
    }
    for (const p of parsed.positionals) {
        filePaths.push(resolve(p));
    }
    if (filePaths.length === 0) {
        process.stderr.write('[gramatr] No files specified. Provide a file path or --dir <dir>.\n');
        process.stderr.write('  Run: gramatr brain --help\n');
        return 1;
    }
    if (parsed.dryRun) {
        process.stderr.write(`[gramatr] dry-run — would upload ${filePaths.length} file(s):\n`);
        process.stderr.write(`  scope=${config.scope}  entity_type=${config.entityType}  on_duplicate=${config.onDuplicate}\n`);
        for (const filePath of filePaths) {
            const ext = extname(filePath).toLowerCase();
            const supported = SUPPORTED_EXTENSIONS.has(ext);
            const target = parsed.entityId
                ? `(reuse entity ${parsed.entityId})`
                : `entity_name=${parsed.entityName ?? deriveEntityName(filePath)}`;
            const status = supported ? 'OK' : `SKIP (unsupported: ${ext})`;
            process.stderr.write(`  [${status}] ${filePath}  →  ${target}\n`);
        }
        process.stderr.write('[gramatr] dry-run complete — no changes written\n');
        return 0;
    }
    // ── Manifest + resume setup ────────────────────────────────────────────────
    // The manifest is the durable record of this run's outcomes. `--resume`
    // loads a prior manifest so unchanged files can be skipped without a
    // network call (the O(changed) win); `--manifest` writes after each file
    // so a crash mid-batch leaves a recoverable partial.
    //
    // PR 6 (epic #1904) — batch correlation:
    //   • A v2 resume manifest already carries a `batch_id`; we reuse it so
    //     the resumed batch has the same identity as the original.
    //   • A v1 resume manifest has none; `readManifest` mints one + WARNs.
    //   • No --resume: mint a fresh UUID for this run.
    let priorIndex;
    let priorManifest;
    if (parsed.resume) {
        try {
            priorManifest = readManifest(parsed.resume);
            priorIndex = indexManifestByPath(priorManifest);
            process.stderr.write(`[gramatr] resume — loaded ${priorManifest.files.length} prior entr${priorManifest.files.length === 1 ? 'y' : 'ies'} from ${parsed.resume}\n`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[gramatr] ✗ Cannot read --resume manifest ${parsed.resume}: ${msg}\n`);
            return 1;
        }
    }
    const batchId = priorManifest?.batch_id ?? randomUUID();
    if (priorManifest && !priorManifest.batch_id) {
        // Defensive — readManifest always backfills v1, but if a future caller
        // builds a v2 object without batch_id, surface it here too.
        process.stderr.write(`[gramatr] ⚠ resumed manifest had no batch_id — assigned ${batchId}\n`);
    }
    process.stderr.write(`[gramatr] batch_id ${batchId}\n`);
    const options = {
        entityId: parsed.entityId,
        entityName: parsed.entityName,
        config,
        batchId,
    };
    // Seed the in-memory manifest with prior entries — we re-emit them so the
    // output manifest is a complete record of the union of runs. Always written
    // as v2 (batch_id required) regardless of the prior manifest's schema.
    void MANIFEST_SCHEMA_V1; // referenced by tests + read path; keep import live.
    const manifest = {
        schema: MANIFEST_SCHEMA,
        version: CLI_VERSION,
        started_at: new Date().toISOString(),
        finished_at: null,
        scope: {
            scope: config.scope,
            ...(config.teamId ? { team_id: config.teamId } : {}),
            ...(config.orgId ? { org_id: config.orgId } : {}),
            ...(config.projectId ? { project_id: config.projectId } : {}),
        },
        files: [],
        batch_id: batchId,
    };
    // Maintain a path → index map so we can upsert entries in O(1).
    const fileIndex = new Map();
    if (priorIndex) {
        for (const [p, entry] of priorIndex) {
            fileIndex.set(p, manifest.files.length);
            manifest.files.push(entry);
        }
    }
    const upsertEntry = (entry) => {
        const idx = fileIndex.get(entry.path);
        if (idx === undefined) {
            fileIndex.set(entry.path, manifest.files.length);
            manifest.files.push(entry);
        }
        else {
            manifest.files[idx] = entry;
        }
    };
    const flushManifest = () => {
        if (!parsed.manifest)
            return;
        try {
            writeManifestAtomic(parsed.manifest, manifest);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[gramatr] ⚠ failed to write manifest ${parsed.manifest}: ${msg}\n`);
        }
    };
    let hasError = false;
    let hasValidationReject = false;
    for (const filePath of filePaths) {
        // Hash the file (or detect missing) before deciding to upload — this is
        // the O(changed) check that makes resume cheap.
        let buffer = null;
        let currentSha = null;
        let size = 0;
        let readError = null;
        if (fileExists(filePath)) {
            try {
                buffer = readFileSync(filePath);
                currentSha = sha256Hex(buffer);
                size = buffer.length;
            }
            catch (err) {
                // Capture so we can record an error entry without invoking the server.
                readError = err instanceof Error ? err.message : String(err);
            }
        }
        if (readError !== null) {
            process.stderr.write(`[gramatr] ✗ ${filePath}: ${readError}\n`);
            upsertEntry({
                path: filePath,
                sha256: '',
                size: 0,
                status: 'error',
                entity_id: null,
                scan_result: null,
                reason: readError,
                completed_at: new Date().toISOString(),
                batch_id: batchId,
            });
            flushManifest();
            hasError = true;
            continue;
        }
        const decision = decideResume(filePath, currentSha, priorIndex?.get(filePath));
        if (decision.kind === 'skip-missing') {
            process.stderr.write(`[gramatr] ↷ ${basename(filePath)}: ${decision.note}\n`);
            upsertEntry({
                path: filePath,
                sha256: '',
                size: 0,
                status: 'skipped',
                entity_id: null,
                scan_result: null,
                reason: 'file_missing',
                completed_at: new Date().toISOString(),
                batch_id: batchId,
            });
            flushManifest();
            continue;
        }
        if (decision.kind === 'skip-previous') {
            process.stderr.write(`[gramatr] ↷ ${basename(filePath)}: ${decision.note}\n`);
            // Refresh completed_at so the manifest reflects this run's pass.
            // Skipped via prior manifest — preserve the prior batch_id if it had
            // one (so the original group identity survives), otherwise stamp with
            // the current run's batchId so all entries in the v2 manifest carry one.
            upsertEntry({
                ...decision.entry,
                completed_at: new Date().toISOString(),
                batch_id: decision.entry.batch_id ?? batchId,
            });
            flushManifest();
            // Previously-rejected files do NOT bump this run's exit code — we are
            // not re-attempting them, so they are not "this run's" failures.
            continue;
        }
        // ── Actually upload ────────────────────────────────────────────────────
        const result = await uploadFile(filePath, buffer ? { ...options, prereadBuffer: buffer } : options);
        let status;
        let entityId = result.entityId ?? null;
        let scanResult = null;
        let reason = null;
        if (result.validationReason) {
            status = 'rejected';
            reason = result.validationReason;
            hasValidationReject = true;
        }
        else if (result.error) {
            status = 'error';
            reason = result.error;
            hasError = true;
        }
        else if (result.skipped) {
            // Empty file or unsupported extension — recorded as skipped without a
            // server entity_id.
            status = 'skipped';
            reason = 'unsupported_or_empty';
        }
        else if (result.wasDuplicate) {
            // on_duplicate=reuse path — server attached observation to existing entity.
            // For on_duplicate=skip the server returns was_duplicate=true with no new
            // observation, which is captured here as 'skipped'.
            status = config.onDuplicate === 'skip' ? 'skipped' : 'reused';
            scanResult = 'clean';
        }
        else {
            status = 'uploaded';
            scanResult = 'clean';
        }
        upsertEntry({
            path: filePath,
            sha256: currentSha || '',
            size,
            status,
            entity_id: entityId,
            scan_result: scanResult,
            reason,
            completed_at: new Date().toISOString(),
            batch_id: batchId,
        });
        flushManifest();
    }
    manifest.finished_at = new Date().toISOString();
    flushManifest();
    // Validator rejection takes precedence — distinct exit code so scripts can
    // differentiate "server said no" from "transport blew up".
    if (hasValidationReject)
        return 3;
    if (hasError)
        return 1;
    return 0;
}
//# sourceMappingURL=brain.js.map