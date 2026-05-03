import { createDefaultConfig, deriveProjectId, migrateConfig, now, readGmtrConfig, writeGmtrConfig, } from './gramatr-hook-utils.js';
import { callTool } from '../../proxy/local-client.js';
import { getLatestCompactForProject, getLocalProjectByDirectory, getLocalProjectBySlug, migrateProjectId, upsertLocalProject } from './hook-state.js';
import { extractToolPayload } from './tool-envelope.js';
import { readProjectFile, writeProjectFile } from './project-file.js';
export function normalizeSessionStartResponse(response) {
    return {
        interactionId: response?.interaction_id || response?.interactionId || null,
        entityId: response?.entity_id || response?.entityId || null,
        resumed: response?.interaction_resumed === true || response?.interactionResumed === true,
        handoffContext: response?.handoff_context || response?.handoffContext || null,
        recentSessions: response?.recent_sessions ?? [],
    };
}
export function prepareProjectSessionState(options) {
    const { git } = options;
    const timestamp = now();
    let config = readGmtrConfig(git.root);
    let created = false;
    // Prefer existing project_id from config (may be a server-assigned UUID).
    // Only derive from git remote as a fallback for first-time initialization.
    const existingProjectId = config?.project_id;
    const projectId = existingProjectId || deriveProjectId(git.remote, git.projectName);
    if (config) {
        config = migrateConfig(config, projectId);
        config.project_id = projectId;
        // Store reference metadata alongside the project_id so we can
        // reconnect to the right project even if the UUID is opaque.
        config.project_ref = {
            git_remote: git.remote,
            local_path: git.root,
            display_name: git.projectName,
        };
    }
    else {
        config = createDefaultConfig({
            projectId,
            projectName: git.projectName,
            gitRemote: git.remote,
        });
        created = true;
    }
    writeGmtrConfig(git.root, config);
    const latestCompact = getLatestCompactForProject(projectId);
    return {
        projectId,
        config,
        projectEntityId: config.project_entity_id || null,
        restoreNeeded: latestCompact?.id != null,
        hasRestoreContext: latestCompact?.summary != null,
        created,
        latestCompact,
    };
}
/**
 * Attempt to resolve the project UUID from local caches before calling the server.
 * Checks: (1) .gramatr/project.json, (2) SQLite by slug, (3) SQLite by directory.
 * Returns the UUID if found, or null if the server must resolve it.
 */
export function resolveLocalProjectUuid(options) {
    // 1. Try project.json (fastest — no SQLite needed)
    try {
        const projectFile = readProjectFile(options.directory);
        if (projectFile?.project_id) {
            return projectFile.project_id;
        }
    }
    catch {
        // Non-critical — fall through
    }
    // 2. Try SQLite by slug (derived from project name)
    if (options.projectName) {
        try {
            const localProject = getLocalProjectBySlug(options.projectName);
            if (localProject?.id) {
                return localProject.id;
            }
        }
        catch {
            // Non-critical — fall through
        }
    }
    // 3. Try SQLite by directory
    try {
        const localProject = getLocalProjectByDirectory(options.directory);
        if (localProject?.id) {
            return localProject.id;
        }
    }
    catch {
        // Non-critical — fall through
    }
    return null;
}
export async function startRemoteSession(options) {
    try {
        const raw = await callTool('session_start', {
            client_type: options.clientType,
            project_id: options.projectId,
            ...(options.projectName ? { project_name: options.projectName } : {}),
            git_remote: options.gitRemote,
            ...(options.gitBranch ? { git_branch: options.gitBranch } : {}),
            directory: options.directory,
            ...(options.sessionId ? { session_id: options.sessionId } : {}),
            ...(options.projectUuid ? { project_uuid: options.projectUuid } : {}),
        });
        return extractToolPayload(raw);
    }
    catch {
        return null;
    }
}
export async function loadProjectHandoff(projectId) {
    try {
        const raw = await callTool('load_handoff', { project_id: projectId });
        return extractToolPayload(raw);
    }
    catch {
        return null;
    }
}
/**
 * Persist the server-resolved project_id back to settings.json.
 * The server may assign a stable UUID the first time a project is registered;
 * storing it locally ensures all subsequent sessions use the same ID.
 *
 * Also persists to local SQLite projects table and `.gramatr/project.json`
 * so subsequent sessions can resolve the project identity without the server (#947).
 */
export function persistSessionRegistration(rootDir, response, options) {
    const config = readGmtrConfig(rootDir);
    if (!config)
        return null;
    if (response?.project_id && response.project_id !== config.project_id) {
        const oldProjectId = config.project_id;
        config.project_id = response.project_id;
        writeGmtrConfig(rootDir, config);
        // Backfill local session_log rows so count/lookup queries use the stable UUID
        if (oldProjectId) {
            try {
                migrateProjectId(oldProjectId, response.project_id);
            }
            catch { /* non-critical */ }
        }
    }
    // Persist project identity to SQLite + project.json when we have a UUID and slug (#947)
    const projectId = response?.project_id || config.project_id;
    const slug = response?.project_slug;
    if (projectId && slug) {
        try {
            upsertLocalProject({
                id: projectId,
                slug,
                git_remote: options?.gitRemote ?? null,
                directory: rootDir,
            });
        }
        catch { /* non-critical — SQLite may not have projects table on older installs */ }
        try {
            writeProjectFile(rootDir, { project_id: projectId, slug });
        }
        catch { /* non-critical — directory may not be writable */ }
    }
    return config;
}
//# sourceMappingURL=session.js.map