export interface ClassificationFeedbackSubmitOptions {
    rootDir: string;
    sessionId: string;
    originalPrompt?: string;
    clientType: string;
    agentName: string;
    downstreamProvider?: string;
}
export declare function submitPendingClassificationFeedback(options: ClassificationFeedbackSubmitOptions): Promise<{
    submitted: boolean;
    reason: string;
}>;
//# sourceMappingURL=feedback.d.ts.map