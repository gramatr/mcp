import { createDefaultConfig, deriveProjectId, migrateConfig, now, readGmtrConfig, writeGmtrConfig, } from './gramatr-hook-utils.js';
import { callTool } from '../../proxy/local-client.js';
import { migrateProjectId } from './hook-state.js';
import { extractToolPayload } from './tool-envelope.js';
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
        config.metadata = config.metadata || {};
        config.metadata.updated = timestamp;
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
    return {
        projectId,
        config,
        projectEntityId: config.project_entity_id || null,
        restoreNeeded: config.last_compact?.timestamp != null,
        hasRestoreContext: config.last_compact?.summary != null,
        created,
    };
}
export async function startRemoteSession(options) {
    try {
        const raw = await callTool('gramatr_session_start', {
            client_type: options.clientType,
            project_id: options.projectId,
            ...(options.projectName ? { project_name: options.projectName } : {}),
            git_remote: options.gitRemote,
            ...(options.gitBranch ? { git_branch: options.gitBranch } : {}),
            directory: options.directory,
            ...(options.sessionId ? { session_id: options.sessionId } : {}),
        });
        return extractToolPayload(raw);
    }
    catch {
        return null;
    }
}
export async function loadProjectHandoff(projectId) {
    try {
        const raw = await callTool('gramatr_load_handoff', { project_id: projectId });
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
 */
export function persistSessionRegistration(rootDir, response) {
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
    return config;
}
//# sourceMappingURL=session.js.map