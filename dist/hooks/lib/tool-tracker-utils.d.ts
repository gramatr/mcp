export interface ExecutionSummary {
    execution_time_ms?: number;
    classifier_calls?: number;
    classifier_time_ms?: number;
    classifier_model?: string;
    tokens_saved?: number;
    savings_ratio?: number;
    cache_hit?: boolean;
    action?: string;
    results_count?: number;
    visual_query_detected?: boolean;
    visual_results_count?: number;
    classifier_level?: number;
    total_classifications?: number;
    total_feedback?: number;
    feedback_rate?: number;
    accuracy?: number;
}
export declare function extractToolShortName(fullName: string): string;
export declare function formatTokens(n: number): string;
export declare function formatMs(ms: number): string;
export declare function extractExecutionSummary(toolResponse: Array<{
    type: string;
    text?: string;
}>): ExecutionSummary | null;
export declare function buildStatusLine(toolShortName: string, summary: ExecutionSummary | null): string;
//# sourceMappingURL=tool-tracker-utils.d.ts.map