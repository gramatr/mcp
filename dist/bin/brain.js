/**
 * brain — CLI subcommand for bulk file upload to the grāmatr brain.
 *
 * Reads local files (txt, md, csv, pdf, docx), extracts their text, and
 * pushes the content through the RAG pipeline via `add_observation` +
 * `create_entity` MCP tool calls. No flat files are ever written — all
 * state flows through MCP tool calls to the server/database.
 *
 * Usage:
 *   gramatr-mcp brain upload <file>
 *   gramatr-mcp brain upload --dir <dir>
 *   gramatr-mcp brain upload --dir <dir> --recursive
 *   gramatr-mcp brain upload <file> --entity-id <id>
 *   gramatr-mcp brain upload <file> --entity-name <name>
 *   gramatr-mcp brain --help
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, basename, join, resolve } from 'node:path';
import { callTool } from '../proxy/local-client.js';
// ── Supported extensions ────────────────────────────────────────────────────
export const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.pdf', '.docx']);
// ── Text extraction ─────────────────────────────────────────────────────────
/**
 * Extract plain text from a file buffer based on its extension.
 * Returns null if the extension is unsupported (caller decides whether to warn).
 */
export async function extractText(filePath, buffer) {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.txt' || ext === '.md' || ext === '.csv') {
        return buffer.toString('utf8');
    }
    if (ext === '.pdf') {
        // Dynamic import so the module is only loaded when a PDF is actually processed.
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
// ── Entity resolution ───────────────────────────────────────────────────────
/**
 * Derive an entity name from a file path when no explicit name is given.
 * Strips the extension from the base name.
 */
export function deriveEntityName(filePath) {
    const base = basename(filePath);
    const ext = extname(base);
    return ext ? base.slice(0, -ext.length) : base;
}
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
export async function resolveEntityId(filePath, entityId, entityName) {
    if (entityId)
        return entityId;
    const name = entityName ?? deriveEntityName(filePath);
    const result = await callTool('create_entity', {
        name,
        entity_type: 'reference',
        observations: [],
    });
    if (result.isError) {
        const text = result.content?.[0]?.type === 'text' ? result.content[0].text : 'unknown error';
        // gramatr-allow: B1 — CLI bin command, no @gramatr/core dependency in MCP package
        throw new Error(`create_entity failed: ${text}`);
    }
    // The server returns JSON with an id field
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text : '';
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        // gramatr-allow: B1 — CLI bin command, no @gramatr/core dependency in MCP package
        throw new Error(`could not parse entity id from response: ${text}`);
    }
    const id = parsed.id ?? parsed.entity?.id;
    // gramatr-allow: B1 — CLI bin command, no @gramatr/core dependency in MCP package
    if (!id)
        throw new Error('no id in create_entity response');
    return id;
}
/**
 * Upload a single file to the grāmatr brain.
 */
export async function uploadFile(filePath, options = {}) {
    const ext = extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
        process.stderr.write(`[gramatr] skipping ${filePath} (unsupported type: ${ext})\n`);
        return { file: filePath, skipped: true };
    }
    let buffer;
    try {
        buffer = readFileSync(filePath);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[gramatr] ✗ ${filePath}: ${message}\n`);
        return { file: filePath, error: message };
    }
    let text;
    try {
        text = await extractText(filePath, buffer);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[gramatr] ✗ ${filePath}: failed to extract text — ${message}\n`);
        return { file: filePath, error: message };
    }
    if (text === null) {
        // extractText returns null for unsupported extensions — already guarded above
        process.stderr.write(`[gramatr] skipping ${filePath} (unsupported type: ${ext})\n`);
        return { file: filePath, skipped: true };
    }
    if (text.trim().length === 0) {
        process.stderr.write(`[gramatr] skipping ${filePath} (empty content)\n`);
        return { file: filePath, skipped: true };
    }
    process.stderr.write(`[gramatr] uploading ${basename(filePath)} (${text.length} chars)...\n`);
    let entityId;
    try {
        entityId = await resolveEntityId(filePath, options.entityId, options.entityName);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[gramatr] ✗ ${filePath}: ${message}\n`);
        return { file: filePath, error: message };
    }
    const obsResult = await callTool('add_observation', {
        entity_id: entityId,
        content: text,
    });
    if (obsResult.isError) {
        const errorText = obsResult.content?.[0]?.type === 'text'
            ? obsResult.content[0].text
            : 'unknown error';
        process.stderr.write(`[gramatr] ✗ ${filePath}: add_observation failed — ${errorText}\n`);
        return { file: filePath, entityId, error: errorText };
    }
    process.stderr.write(`[gramatr] ✓ ${basename(filePath)} → entity ${entityId}\n`);
    return { file: filePath, entityId };
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
// ── Arg helpers ─────────────────────────────────────────────────────────────
function getFlag(args, name) {
    const idx = args.indexOf(name);
    if (idx === -1 || idx + 1 >= args.length)
        return undefined;
    return args[idx + 1];
}
function hasFlag(args, name) {
    return args.includes(name);
}
// ── Help text ────────────────────────────────────────────────────────────────
function printBrainHelp() {
    process.stderr.write(`
  gramatr-mcp brain — Upload local files to the grāmatr brain

  Usage:
    brain upload <file>                     Upload a single file
    brain upload --dir <dir>                Upload all supported files in a directory
    brain upload --dir <dir> --recursive    Recurse into subdirectories
    brain --help                            Show this help

  Supported file types:
    .txt  .md  .csv  .pdf  .docx

  Entity options (controls which entity observations are added to):
    --entity-id <id>     Attach to an existing entity by ID
    --entity-name <name> Create (or reuse) an entity with this name
                         Default: use filename without extension

  Examples:
    brain upload project-brief.pdf
    brain upload notes.md --entity-name "Q3 Research"
    brain upload contract.docx --entity-id abc-123
    brain upload --dir ./docs
    brain upload --dir ./research --recursive

`);
}
// ── Main entry point ─────────────────────────────────────────────────────────
/**
 * runBrain — entry point for `gramatr-mcp brain <args>` subcommand.
 * Returns an exit code (0 = success, 1 = one or more errors).
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
        process.stderr.write('  Run: gramatr-mcp brain --help\n');
        return 1;
    }
    // -- upload subcommand --
    const uploadArgs = args.slice(1);
    const entityId = getFlag(uploadArgs, '--entity-id');
    const entityName = getFlag(uploadArgs, '--entity-name');
    const dirArg = getFlag(uploadArgs, '--dir');
    const recursive = hasFlag(uploadArgs, '--recursive');
    // Collect the positional (non-flag) arguments as file paths
    const positionals = [];
    let i = 0;
    while (i < uploadArgs.length) {
        const arg = uploadArgs[i];
        if (arg === '--entity-id' || arg === '--entity-name' || arg === '--dir') {
            i += 2; // skip flag + value
        }
        else if (arg.startsWith('--')) {
            i += 1; // boolean flag
        }
        else {
            positionals.push(arg);
            i += 1;
        }
    }
    // Build the list of files to upload
    const filePaths = [];
    if (dirArg) {
        const absDir = resolve(dirArg);
        let dirFiles;
        try {
            dirFiles = collectFiles(absDir, recursive);
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
    for (const p of positionals) {
        filePaths.push(resolve(p));
    }
    if (filePaths.length === 0) {
        process.stderr.write('[gramatr] No files specified. Provide a file path or --dir <dir>.\n');
        process.stderr.write('  Run: gramatr-mcp brain --help\n');
        return 1;
    }
    const options = { entityId, entityName };
    let hasError = false;
    for (const filePath of filePaths) {
        const result = await uploadFile(filePath, options);
        if (result.error)
            hasError = true;
    }
    return hasError ? 1 : 0;
}
//# sourceMappingURL=brain.js.map