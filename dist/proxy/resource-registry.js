/**
 * Resource Registry — fetches resource definitions from the remote server.
 *
 * Same pattern as tool-registry: fetches resources/list at startup, caches,
 * and serves them to the local MCP server's resources/list handler.
 */
import { fetchRemoteResourceList } from './remote-client.js';
let cachedResources = null;
export async function loadRemoteResources() {
    if (cachedResources)
        return cachedResources;
    const result = (await fetchRemoteResourceList());
    cachedResources = result?.resources || [];
    return cachedResources;
}
export function getResources() {
    return cachedResources || [];
}
//# sourceMappingURL=resource-registry.js.map