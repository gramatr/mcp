/**
 * Prompt Registry — fetches prompt definitions from the remote server.
 *
 * Same pattern as tool-registry: fetches prompts/list at startup, caches,
 * and serves them to the local MCP server's prompts/list handler.
 */
export interface PromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}
export interface PromptDefinition {
    name: string;
    description?: string;
    arguments?: PromptArgument[];
}
export declare function loadRemotePrompts(): Promise<PromptDefinition[]>;
export declare function getPrompts(): PromptDefinition[];
//# sourceMappingURL=prompt-registry.d.ts.map