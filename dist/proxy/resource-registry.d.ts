/**
 * Resource Registry — fetches resource definitions from the remote server.
 *
 * Same pattern as tool-registry: fetches resources/list at startup, caches,
 * and serves them to the local MCP server's resources/list handler.
 */
export interface ResourceDefinition {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}
export declare function loadRemoteResources(): Promise<ResourceDefinition[]>;
export declare function getResources(): ResourceDefinition[];
//# sourceMappingURL=resource-registry.d.ts.map