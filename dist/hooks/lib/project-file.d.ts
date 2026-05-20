/**
 * project-file.ts — Read/write `.gramatr/project.json` for local project identity (#947).
 *
 * This file persists the server-resolved project UUID and slug to the project
 * directory so subsequent sessions can resolve the project locally without
 * asking the server.
 */
export interface ProjectFileData {
    project_id: string;
    slug: string;
}
/**
 * Write `{projectDir}/.gramatr/project.json` with the resolved project identity.
 * Creates the `.gramatr/` directory if it does not exist.
 */
export declare function writeProjectFile(projectDir: string, data: ProjectFileData): void;
/**
 * Read `{projectDir}/.gramatr/project.json`.
 * Returns null if the file does not exist or contains invalid JSON.
 */
export declare function readProjectFile(projectDir: string): ProjectFileData | null;
//# sourceMappingURL=project-file.d.ts.map