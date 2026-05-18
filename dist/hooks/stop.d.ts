export declare function runStopHook(_args?: string[]): Promise<number>;
interface ComplianceMissContext {
    packet: {
        payload: string;
        effort: string | null;
        intent: string | null;
    };
    transcriptPath: string;
    sessionId: string;
    projectId?: string;
}
/**
 * Compare packet `required_actions[]` against the tool_use entries in the
 * last turn of the transcript. Writes one `learning_signal{kind:
 * 'agent_compliance_miss'}` per non-optional missed call.
 */
export declare function recordComplianceMisses(ctx: ComplianceMissContext): void;
export {};
//# sourceMappingURL=stop.d.ts.map