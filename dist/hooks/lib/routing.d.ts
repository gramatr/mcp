import { type MctToolCallError } from './gramatr-hook-utils.js';
import type { RouteResponse } from './types.js';
export declare const MIN_PROMPT_LENGTH = 10;
export declare const TRIVIAL_PATTERNS: RegExp;
export declare function shouldSkipPromptRouting(prompt: string): boolean;
export declare function routePrompt(options: {
    prompt: string;
    projectId?: string;
    sessionId?: string;
    timeoutMs?: number;
    includeStatusline?: boolean;
    statuslineSize?: 'small' | 'medium' | 'large';
}): Promise<{
    route: RouteResponse | null;
    error: MctToolCallError | null;
}>;
export declare function fetchEnrichment(enrichmentId: string, timeoutMs?: number): Promise<Record<string, unknown> | null>;
export declare function describeRoutingFailure(error: MctToolCallError): {
    title: string;
    detail: string;
    action: string;
};
export declare function persistClassificationResult(options: {
    rootDir: string;
    prompt: string;
    route: RouteResponse | null;
    downstreamModel: string | null;
    clientType: string;
    agentName: string;
}): void;
//# sourceMappingURL=routing.d.ts.map