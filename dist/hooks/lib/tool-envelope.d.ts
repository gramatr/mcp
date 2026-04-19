type ToolCallOutput = {
    content?: Array<{
        type: string;
        text: string;
    }>;
};
export declare function extractToolPayload<T>(raw: ToolCallOutput | null | undefined): T | null;
export {};
//# sourceMappingURL=tool-envelope.d.ts.map