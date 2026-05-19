/**
 * Prompt Registry — fetches prompt definitions from the remote server.
 *
 * Same pattern as tool-registry: fetches prompts/list at startup, caches,
 * and serves them to the local MCP server's prompts/list handler.
 */
import { fetchRemotePromptList } from './remote-client.js';
let cachedPrompts = null;
export async function loadRemotePrompts() {
    if (cachedPrompts)
        return cachedPrompts;
    const result = (await fetchRemotePromptList());
    cachedPrompts = result?.prompts || [];
    return cachedPrompts;
}
export function getPrompts() {
    return cachedPrompts || [];
}
//# sourceMappingURL=prompt-registry.js.map