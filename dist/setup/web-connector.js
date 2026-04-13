/**
 * Web Connector — setup utilities for hookless web clients.
 *
 * Web-based clients (claude.ai, ChatGPT web, Gemini web) cannot run a local
 * MCP server or hooks. Instead they connect directly to the hosted gramatr
 * MCP endpoint. This module generates:
 *
 *   1. Structured connector setup instructions (steps to add the MCP server)
 *   2. A copyable prompt suggestion block (paste into custom instructions)
 *   3. Server reachability validation
 */
const DEFAULT_SERVER_URL = 'https://api.gramatr.com/mcp';
const HEALTH_CHECK_TIMEOUT_MS = 8_000;
// ---------------------------------------------------------------------------
// Connector instructions
// ---------------------------------------------------------------------------
export function buildConnectorInstructions(options = {}) {
    const serverUrl = options.serverUrl ?? DEFAULT_SERVER_URL;
    const authMethod = options.authMethod ?? 'bearer';
    const target = options.target ?? 'claude-web';
    const setupGuideUrl = buildSetupGuideUrl(serverUrl, target);
    const steps = buildStepsForTarget(target, serverUrl, authMethod, setupGuideUrl);
    return {
        serverUrl,
        authMethod,
        target,
        steps,
        serverCardUrl: buildServerCardUrl(serverUrl),
        setupGuideUrl,
    };
}
function buildStepsForTarget(target, serverUrl, authMethod, setupGuideUrl) {
    const authSteps = authMethod === 'oauth'
        ? ['Complete the OAuth sign-in flow when prompted.']
        : [
            'Generate an API key at gramatr.com under your account settings.',
            'When prompted for authentication, enter your API key as a Bearer token.',
        ];
    switch (target) {
        case 'chatgpt-web':
            return [
                'Sign up or sign in at gramatr.com.',
                ...authSteps,
                'In ChatGPT, go to Settings > Connections > Add MCP server.',
                `Enter the server URL: ${serverUrl}`,
                `Full setup guide: ${setupGuideUrl}`,
            ];
        case 'gemini-web':
            return [
                'Sign up or sign in at gramatr.com.',
                ...authSteps,
                'In Gemini, go to Settings > Extensions > Add custom extension.',
                `Enter the server URL: ${serverUrl}`,
                `Full setup guide: ${setupGuideUrl}`,
            ];
        case 'claude-web':
        default:
            return [
                'Sign up or sign in at gramatr.com.',
                ...authSteps,
                'Open Settings > Connectors > Add custom connector.',
                `Enter the server URL: ${serverUrl}`,
                `Full setup guide: ${setupGuideUrl}`,
            ];
    }
}
// ---------------------------------------------------------------------------
// Prompt suggestion (copyable block for web clients without hooks)
// ---------------------------------------------------------------------------
export function buildPromptSuggestion(target = 'claude-web') {
    const platformNote = target === 'chatgpt-web'
        ? 'ChatGPT'
        : target === 'gemini-web'
            ? 'Gemini'
            : 'Claude';
    return `# gramatr (${platformNote} web)

You have gramatr connected as an MCP server.

Before responding to any user message, call the gramatr_route_request tool with
the user's prompt. This returns essential context:

- User preferences and active project state
- Relevant memories from past sessions
- Behavioral guidelines calibrated to this user and request type
- Effort level classification
- Matched capabilities and phase templates

Treat packet_1 as the canonical response envelope. If
packet_1.manifest.packet_2_status is "required", call gramatr_get_enrichment
with packet_1.manifest.enrichment_id before proceeding.

Without calling gramatr_route_request, your response will be generic and miss
critical context. With it, you deliver targeted, personalized answers.

For continuity questions ("what were we doing?", "what changed?"), call
gramatr_load_handoff before answering, then search_semantic for detail.

Use gramatr tools for memory — do not maintain your own notes.`;
}
// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------
export function buildServerCardUrl(mcpUrl) {
    const parsed = new URL(mcpUrl);
    return `${parsed.protocol}//${parsed.host}/.well-known/mcp/server-card.json`;
}
export function buildSetupGuideUrl(mcpUrl, target) {
    const parsed = new URL(mcpUrl);
    return `${parsed.protocol}//${parsed.host}/setup/${target}.md`;
}
// ---------------------------------------------------------------------------
// Reachability check
// ---------------------------------------------------------------------------
export async function validateServerReachability(serverUrl = DEFAULT_SERVER_URL) {
    const healthUrl = deriveHealthUrl(serverUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    try {
        const response = await fetch(healthUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (response.ok) {
            return { reachable: true, serverUrl, statusCode: response.status };
        }
        return {
            reachable: false,
            serverUrl,
            statusCode: response.status,
            error: `Server responded with HTTP ${response.status}`,
        };
    }
    catch (err) {
        clearTimeout(timeout);
        const message = err instanceof Error ? err.message : String(err);
        return { reachable: false, serverUrl, error: message };
    }
}
function deriveHealthUrl(mcpUrl) {
    const parsed = new URL(mcpUrl);
    return `${parsed.protocol}//${parsed.host}/health`;
}
//# sourceMappingURL=web-connector.js.map