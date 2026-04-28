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
export declare function normalizeSessionStartResponse(response: SessionStartResponse | null | undefined): {
    interactionId: string | null;
    entityId: string | null;
    resumed: boolean;
    handoffContext: string | null;
    recentSessions: import('./types.js').RemoteSessionRecord[];
};
export declare function prepareProjectSessionState(options: {
    git: GitContext;
}): PreparedProjectSession;
/**
 * Attempt to resolve the project UUID from local caches before calling the server.
 * Checks: (1) .gramatr/project.json, (2) SQLite by slug, (3) SQLite by directory.
 * Returns the UUID if found, or null if the server must resolve it.
 */
export declare function resolveLocalProjectUuid(options: {
    directory: string;
    projectName?: string;
}): string | null;
export declare function startRemoteSession(options: {
    clientType: string;
    sessionId?: string;
    projectId: string;
    projectName?: string;
    gitRemote: string;
    gitBranch?: string;
    directory: string;
    /** Pre-resolved UUID from local cache — lets the server skip resolution. */
    projectUuid?: string;
}): Promise<SessionStartResponse | null>;
export declare function loadProjectHandoff(projectId: string): Promise<HandoffResponse | null>;
/**
 * Persist the server-resolved project_id back to settings.json.
 * The server may assign a stable UUID the first time a project is registered;
 * storing it locally ensures all subsequent sessions use the same ID.
 *
 * Also persists to local SQLite projects table and `.gramatr/project.json`
 * so subsequent sessions can resolve the project identity without the server (#947).
 */
export declare function persistSessionRegistration(rootDir: string, response: SessionStartResponse | null, options?: {
    gitRemote?: string;
}): GmtrConfig | null;
//# sourceMappingURL=session.d.ts.map