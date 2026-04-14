import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildStatusLine, extractExecutionSummary, extractToolShortName } from './lib/tool-tracker-utils.js';
const STATE_DIR = join(process.env.GRAMATR_DIR || join(process.env.HOME || '', '.gramatr'), '.state');
function ensureStateDir() { if (!existsSync(STATE_DIR))
    mkdirSync(STATE_DIR, { recursive: true }); }
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
    const raw = await readStdin(3000);
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
        const metrics = {
            tool: shortName,
            model: summary?.classifier_model || null,
            time_ms: summary?.execution_time_ms || null,
            tokens_saved: summary?.tokens_saved || null,
            cache_hit: summary?.cache_hit ?? null,
            result_count: summary?.results_count || null,
            timestamp: Date.now(),
        };
        ensureStateDir();
        writeFileSync(join(STATE_DIR, 'last-op.json'), JSON.stringify(metrics));
        appendFileSync(join(STATE_DIR, 'op-history.jsonl'), JSON.stringify({
            tool: shortName,
            model: summary?.classifier_model || null,
            time_ms: summary?.execution_time_ms || 0,
            tokens_saved: summary?.tokens_saved || 0,
            cache_hit: summary?.cache_hit ?? false,
            timestamp: Date.now(),
        }) + '\n');
        const textItem = input.tool_response.find((item) => item.type === 'text' && item.text);
        let resultData = null;
        if (textItem?.text) {
            try {
                resultData = JSON.parse(textItem.text);
            }
            catch { }
        }
        if (resultData) {
            let stats = {};
            try {
                stats = JSON.parse(readFileSync(join(STATE_DIR, 'stats.json'), 'utf8'));
            }
            catch { }
            if (shortName.includes('search') || shortName === 'gramatr_execute_intent') {
                stats.search_count = (stats.search_count || 0) + 1;
            }
            if (resultData.total_entities !== undefined)
                stats.entity_count = resultData.total_entities;
            if (resultData.total_observations !== undefined)
                stats.observation_count = resultData.total_observations;
            if (resultData.entity_count !== undefined)
                stats.entity_count = resultData.entity_count;
            if (summary) {
                if (summary.classifier_level !== undefined)
                    stats.classifier_level = summary.classifier_level;
                if (summary.classifier_model !== undefined)
                    stats.classifier_model = summary.classifier_model;
                if (summary.total_classifications !== undefined)
                    stats.total_classifications = summary.total_classifications;
                if (summary.total_feedback !== undefined)
                    stats.total_feedback = summary.total_feedback;
                if (summary.feedback_rate !== undefined)
                    stats.feedback_rate = summary.feedback_rate;
                if (summary.accuracy !== undefined)
                    stats.accuracy = summary.accuracy;
            }
            stats.local_call_count = (stats.local_call_count || 0) + 1;
            stats.status = 'connected';
            stats.last_seen = Date.now();
            writeFileSync(join(STATE_DIR, 'stats.json'), JSON.stringify(stats));
        }
    }
    catch {
        // best effort
    }
    return 0;
}
//# sourceMappingURL=tool-tracker.js.map