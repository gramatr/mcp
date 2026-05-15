import { getServerUrl, getToken } from '../../server/auth.js';
const POST_TIMEOUT_MS = 3000;
export function postAutoFeedback(options) {
    if (!options.interactionId)
        return;
    let token;
    let serverUrl;
    try {
        token = getToken();
        serverUrl = getServerUrl();
    }
    catch {
        return;
    }
    if (!token)
        return;
    const body = {
        session_id: options.sessionId,
        interaction_id: options.interactionId,
        client_type: options.clientType ?? 'claude-code',
        source: 'stop_hook',
        timestamp: new Date().toISOString(),
    };
    const apiBase = serverUrl.replace(/\/mcp\/?$/, '');
    const url = `${apiBase}/api/v1/classification/feedback/auto`;
    // fire-and-forget — Stop hook must not block on auto-feedback
    void fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    }).catch(() => { });
}
//# sourceMappingURL=auto-feedback.js.map