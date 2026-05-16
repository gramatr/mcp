export function extractToolPayload(raw) {
    const text = raw?.content?.[0]?.text;
    if (!text)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') {
        return null;
    }
    const envelope = parsed;
    if (envelope.schema === 'gmtr.tool.result.v1') {
        if (envelope.data && typeof envelope.data === 'object') {
            return envelope.data;
        }
        return null;
    }
    return parsed;
}
//# sourceMappingURL=tool-envelope.js.map