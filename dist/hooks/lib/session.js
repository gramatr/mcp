import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { callMcpTool, createDefaultConfig, deriveProjectId, migrateConfig, now, readGmtrConfig, writeGmtrConfig, } from './gramatr-hook-utils.js';
import { getHomeDir } from '../../config-runtime.js';
export function normalizeSessionStartResponse(response) {
    return {
        interactionId: response?.interaction_id || response?.interactionId || null,
        entityId: response?.entity_id || response?.entityId || null,
        resumed: response?.interaction_resumed === true || response?.interactionResumed === true,
        handoffContext: response?.handoff_context || response?.handoffContext || null,
    };
}
export function prepareProjectSessionState(options) {
    const { git, sessionId, transcriptPath } = options;
    const timestamp = now();
    let config = readGmtrConfig(git.root);
    let created = false;
    // Prefer existing project_id from config (may be a server-assigned UUID).
    // Only derive from git remote as a fallback for first-time initialization.
    const existingProjectId = config?.project_id;
    const projectId = existingProjectId || deriveProjectId(git.remote, git.projectName);
    if (config) {
        config = migrateConfig(config, projectId);
        config.last_session_id = sessionId;
        config.project_id = projectId;
        // Store reference metadata alongside the project_id so we can
        // reconnect to the right project even if the UUID is opaque.
        config.project_ref = {
            git_remote: git.remote,
            local_path: git.root,
            display_name: git.projectName,
        };
        config.current_session = {
            ...config.current_session,
            session_id: sessionId,
            transcript_path: transcriptPath,
            last_updated: timestamp,
            token_limit: 200000,
        };
        config.continuity_stats = config.continuity_stats || {};
        config.continuity_stats.total_sessions = (config.continuity_stats.total_sessions || 0) + 1;
        config.metadata = config.metadata || {};
        config.metadata.updated = timestamp;
    }
    else {
        config = createDefaultConfig({
            projectId,
            projectName: git.projectName,
            gitRemote: git.remote,
            sessionId,
            transcriptPath,
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
    return (await callMcpTool('gramatr_session_start', {
        client_type: options.clientType,
        project_id: options.projectId,
        ...(options.projectName ? { project_name: options.projectName } : {}),
        git_remote: options.gitRemote,
        directory: options.directory,
        ...(options.sessionId ? { session_id: options.sessionId } : {}),
    }, 15000));
}
export async function loadProjectHandoff(projectId) {
    return (await callMcpTool('gramatr_load_handoff', { project_id: projectId }, 15000));
}
export function persistSessionRegistration(rootDir, response) {
    const normalized = normalizeSessionStartResponse(response);
    if (!normalized.interactionId && !normalized.entityId)
        return readGmtrConfig(rootDir);
    const config = readGmtrConfig(rootDir);
    if (!config)
        return null;
    config.current_session = config.current_session || {};
    if (normalized.interactionId)
        config.current_session.interaction_id = normalized.interactionId;
    if (normalized.entityId)
        config.current_session.gramatr_entity_id = normalized.entityId;
    // Persist server-resolved project_id (may be a UUID assigned by the server).
    // This is the key migration point: once the server returns a UUID, we store
    // it locally so all subsequent sessions use the stable ID.
    if (response?.project_id && response.project_id !== config.project_id) {
        config.project_id = response.project_id;
    }
    writeGmtrConfig(rootDir, config);
    return config;
}
export function writeCurrentProjectContextFile(payload) {
    const home = getHomeDir();
    const claudeDir = join(home, '.claude');
    if (!existsSync(claudeDir))
        mkdirSync(claudeDir, { recursive: true });
    const contextFile = join(claudeDir, 'current-project-context.json');
    writeFileSync(contextFile, JSON.stringify(payload, null, 2) + '\n');
}
export function buildGitProjectContextPayload(options) {
    return {
        type: 'git_project',
        session_id: options.sessionId,
        project_name: options.git.projectName,
        project_id: options.projectId,
        git_root: options.git.root,
        git_branch: options.git.branch,
        git_commit: options.git.commit,
        git_remote: options.git.remote,
        working_directory: options.workingDirectory,
        session_start: options.sessionStart,
        gramatr_config_path: join(options.git.root, '.gramatr', 'settings.json'),
        project_entity_id: options.projectEntityId,
        restore_needed: options.restoreNeeded,
        action_required: 'check_or_create_project_entity',
    };
}
export function buildNonGitProjectContextPayload(options) {
    return {
        type: 'non_git',
        session_id: options.sessionId,
        project_name: basename(options.cwd),
        working_directory: options.cwd,
        session_start: options.sessionStart,
        gramatr_config_path: join(options.cwd, '.gramatr', 'settings.json'),
        project_entity_id: options.projectEntityId,
        action_required: 'gramatr_init_needed',
    };
}
//# sourceMappingURL=session.js.map