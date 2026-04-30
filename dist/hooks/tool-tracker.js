import { buildStatusLine, extractExecutionSummary, extractToolShortName } from './lib/tool-tracker-utils.js';
import { HOOK_STDIN_EXTENDED_TIMEOUT_MS } from './generated/hook-timeouts.js';
import { appendOpHistory } from './lib/hook-state.js';
function readStdin(timeoutMs) {
    return new Promise((resolve) => {
        let data = '';
        const timer = setTimeout(() => resolve(data), timeoutMs);
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
        process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
        process.stdin.resume();
    });
}
export async function runToolTrackerHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_EXTENDED_TIMEOUT_MS);
    process.stdout.write(JSON.stringify({ continue: true }));
    if (!raw.trim())
        return 0;
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || !input.tool_response)
            return 0;
        const shortName = extractToolShortName(input.tool_name);
        const summary = extractExecutionSummary(input.tool_response);
        process.stderr.write(`${buildStatusLine(shortName, summary)}\n`);
        // Persist op record to SQLite — replaces last-op.json, op-history.jsonl, and stats.json.
        // All downstream readers (statusline, local_metrics) pull from SQLite op_history.
        try {
            appendOpHistory({
                session_id: 'tool-tracker',
                tool: shortName,
                time_ms: summary?.execution_time_ms || 0,
                tokens_saved: summary?.tokens_saved || 0,
                timestamp: Date.now(),
            });
        }
        catch {
            // Non-critical — SQLite unavailable; op dropped silently.
        }
    }
    catch {
        // best effort
    }
    return 0;
}
//# sourceMappingURL=tool-tracker.js.map