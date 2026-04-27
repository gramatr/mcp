import type { HandoffResponse, HookFailure, RouteResponse, SessionStartResponse } from './types.js';
export declare function buildUserPromptAdditionalContext(route: RouteResponse): string;
export declare function buildSessionStartAdditionalContext(projectId: string, sessionStart: SessionStartResponse | null, handoff: HandoffResponse | null): string;
export declare function buildHookFailureAdditionalContext(failure: HookFailure): string;
//# sourceMappingURL=formatting-compat.d.ts.map