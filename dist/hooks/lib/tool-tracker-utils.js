export function extractToolShortName(fullName) {
    const parts = fullName.split('__');
    return parts[parts.length - 1] || fullName;
}
export function formatTokens(n) {
    if (n >= 1000)
        return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return n.toString();
}
export function formatMs(ms) {
    if (ms >= 1000)
        return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
}
export function extractExecutionSummary(toolResponse) {
    try {
        for (const item of toolResponse) {
            if (item.type !== 'text' || !item.text)
                continue;
            try {
                const inner = JSON.parse(item.text);
                if (inner.execution_summary)
                    return inner.execution_summary;
                if (inner.execution_time_ms !== undefined)
                    return inner;
            }
            catch {
                // skip non-JSON text
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
export function buildStatusLine(toolShortName, summary) {
    const parts = [`[gramatr] ${toolShortName}`];
    if (summary) {
        if (summary.execution_time_ms)
            parts.push(formatMs(summary.execution_time_ms));
        if (summary.classifier_calls && summary.classifier_calls > 0) {
            const model = summary.classifier_model || 'classifier';
            const time = summary.classifier_time_ms ? ` ${formatMs(summary.classifier_time_ms)}` : '';
            parts.push(`${model}${time}`);
        }
        if (summary.tokens_saved && summary.tokens_saved > 0) {
            const pct = summary.savings_ratio ? ` (${Math.round(summary.savings_ratio * 100)}%)` : '';
            parts.push(`saved ${formatTokens(summary.tokens_saved)} tokens${pct}`);
        }
        if (summary.cache_hit !== undefined)
            parts.push(`cache:${summary.cache_hit ? 'HIT' : 'MISS'}`);
        if (summary.visual_query_detected)
            parts.push(`visual:${summary.visual_results_count || 0}`);
        if (summary.results_count !== undefined)
            parts.push(`${summary.results_count} results`);
    }
    else {
        parts.push('OK');
    }
    return parts.join(' | ');
}
//# sourceMappingURL=tool-tracker-utils.js.map