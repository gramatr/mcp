/**
 * project-file.ts — Read/write `.gramatr/project.json` for local project identity (#947).
 *
 * This file persists the server-resolved project UUID and slug to the project
 * directory so subsequent sessions can resolve the project locally without
 * asking the server.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const PROJECT_FILE_NAME = 'project.json';
const GRAMATR_DIR = '.gramatr';
/**
 * Write `{projectDir}/.gramatr/project.json` with the resolved project identity.
 * Creates the `.gramatr/` directory if it does not exist.
 */
export function writeProjectFile(projectDir, data) {
    const dir = join(projectDir, GRAMATR_DIR);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    const filePath = join(dir, PROJECT_FILE_NAME);
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
/**
 * Read `{projectDir}/.gramatr/project.json`.
 * Returns null if the file does not exist or contains invalid JSON.
 */
export function readProjectFile(projectDir) {
    const filePath = join(projectDir, GRAMATR_DIR, PROJECT_FILE_NAME);
    try {
        if (!existsSync(filePath))
            return null;
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.project_id !== 'string' || typeof parsed.slug !== 'string') {
            return null;
        }
        return { project_id: parsed.project_id, slug: parsed.slug };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=project-file.js.map