import { type GitContext, type GmtrConfig } from './gramatr-hook-utils.js';
import type { HandoffResponse, SessionStartResponse } from './types.js';
export interface PreparedProjectSession {
    projectId: string;
    config: GmtrConfig;
    projectEntityId: string | null;
    restoreNeeded: boolean;
    hasRestoreContext: boolean;
    created: boolean;
}
export interface CurrentProjectContextPayload {
    type: 'git_project' | 'non_git';
    session_id: string;
    project_name: string;
    working_directory: string;
    session_start: string;
    gramatr_config_path: string;
    project_entity_id: string | null;
    action_required: string;
    project_id?: string;
    git_root?: string;
    git_branch?: string;
    git_commit?: string;
    git_remote?: string;
    restore_needed?: boolean;
}
export declare function normalizeSessionStartResponse(response: SessionStartResponse | null | undefined): {
    interactionId: string | null;
    entityId: string | null;
    resumed: boolean;
    handoffContext: string | null;
};
export declare function prepareProjectSessionState(options: {
    git: GitContext;
    sessionId: string;
    transcriptPath: string;
}): PreparedProjectSession;
export declare function startRemoteSession(options: {
    clientType: string;
    sessionId?: string;
    projectId: string;
    projectName?: string;
    gitRemote: string;
    directory: string;
}): Promise<SessionStartResponse | null>;
export declare function loadProjectHandoff(projectId: string): Promise<HandoffResponse | null>;
export declare function persistSessionRegistration(rootDir: string, response: SessionStartResponse | null): GmtrConfig | null;
export declare function writeCurrentProjectContextFile(payload: CurrentProjectContextPayload): void;
export declare function buildGitProjectContextPayload(options: {
    git: GitContext;
    sessionId: string;
    workingDirectory: string;
    sessionStart: string;
    projectId: string;
    projectEntityId: string | null;
    restoreNeeded: boolean;
}): CurrentProjectContextPayload;
export declare function buildNonGitProjectContextPayload(options: {
    cwd: string;
    sessionId: string;
    sessionStart: string;
    projectEntityId: string | null;
}): CurrentProjectContextPayload;
//# sourceMappingURL=session.d.ts.map