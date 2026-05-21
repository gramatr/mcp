import type { MctToolCallError } from './types.js';
import type { RouteResponse } from './types.js';
export declare const MIN_PROMPT_LENGTH = 10;
export declare const TRIVIAL_PATTERNS: RegExp;
export declare function shouldSkipPromptRouting(prompt: string): boolean;
export declare function routePrompt(options: {
    prompt: string;
    projectId?: string;
    sessionId?: string;
    interactionId?: string;
    timeoutMs?: number;
    includeStatusline?: boolean;
    statuslineSize?: 'small' | 'medium' | 'large';
    /** Override retry delay for tests (default: ROUTE_RETRY_DELAY_MS). */
    _retryDelayMs?: number;
}): Promise<{
    route: RouteResponse | null;
    error: MctToolCallError | null;
}>;
export declare function describeRoutingFailure(error: MctToolCallError): {
    title: string;
    detail: string;
    action: string;
};
export declare function persistClassificationResult(options: {
    sessionId: string;
    prompt: string;
    route: RouteResponse | null;
    downstreamModel: string | null;
    clientType: string;
    agentName: string;
}): void;
//# sourceMappingURL=routing.d.ts.map