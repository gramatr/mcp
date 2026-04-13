import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getClaudeModelFromEnv, getGramatrTimeoutFromEnv, getHomeDir, isGramatrEnrichEnabledFromEnv, } from '../config-runtime.js';
import { appendLine, deriveProjectId, getGitContext, readHookInput, } from './lib/gramatr-hook-utils.js';
import { emitStatus, formatFailureWarning, formatIntelligence, mergeEnrichmentIntoRoute, } from './lib/intelligence.js';
import { fetchEnrichment, persistClassificationResult, routePrompt, shouldSkipPromptRouting, } from './lib/routing.js';
import { getCurrentProjectContextPath } from './lib/session.js';
import { existsSync, mkdirSync } from 'node:fs';
let turnCounter = 0;
const STATE_DIR = join(process.env.GRAMATR_DIR || join(getHomeDir(), '.gramatr'), '.state');
const TURNS_JSONL_PATH = join(STATE_DIR, 'turns.jsonl');
const TIMEOUT_MS = getGramatrTimeoutFromEnv(30000);
function ensureStateDir() { if (!existsSync(STATE_DIR))
    mkdirSync(STATE_DIR, { recursive: true }); }
const ENABLED = isGramatrEnrichEnabledFromEnv();
function resolveProjectId() {
    try {
        const contextPath = getCurrentProjectContextPath();
        const context = JSON.parse(readFileSync(contextPath, 'utf8'));
        // Prefer stored project_id (may be server-assigned UUID)
        if (context.project_id)
            return context.project_id;
        // Fallback: derive from git remote for backwards compat
        const remote = context.git_remote;
        if (!remote || remote === 'no-remote')
            return null;
        const match = remote.match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
        if (match)
            return `${match[1]}/${match[2]}`;
        return null;
    }
    catch {
        return null;
    }
}
function persistLastClassification(prompt, sessionId, route, downstreamModel) {
    try {
        const git = getGitContext();
        if (!git)
            return;
        persistClassificationResult({
            rootDir: git.root,
            prompt,
            route,
            downstreamModel,
            clientType: 'claude_code',
            agentName: 'Claude Code',
        });
    }
    catch {
        // Non-critical
    }
}
function mapRoutingFailure(reason, detail) {
    switch (reason) {
        case 'auth':
            return { reason: 'auth', detail };
        case 'timeout':
            return { reason: 'timeout', detail };
        case 'network_error':
            return { reason: 'server_down', detail };
        case 'http_error':
        case 'mcp_error':
            return { reason: 'server_error', detail };
        case 'parse_error':
            return { reason: 'parse_error', detail };
        default:
            return { reason: 'unknown', detail };
    }
}
export async function runUserPromptSubmitHook(_args = []) {
    if (!ENABLED) {
        process.stdout.write(JSON.stringify({}));
        return 0;
    }
    try {
        const input = await readHookInput();
        const prompt = input.prompt || '';
        const sessionId = input.session_id || 'unknown';
        if (!prompt || shouldSkipPromptRouting(prompt)) {
            if (prompt)
                process.stderr.write('[gramatr] enricher: trivial prompt, skipped\n');
            process.stdout.write(JSON.stringify({}));
            return 0;
        }
        const downstreamModel = getClaudeModelFromEnv() ||
            (input.model ?? '') ||
            '';
        const git = getGitContext();
        const projectId = resolveProjectId() || (git ? deriveProjectId(git.remote, git.projectName) : null) || undefined;
        process.stderr.write('[gramatr] classifying...\n');
        const t0 = Date.now();
        const routed = await routePrompt({
            prompt,
            projectId,
            sessionId,
            timeoutMs: TIMEOUT_MS,
        });
        const result = routed.route;
        const elapsed = Date.now() - t0;
        let lastFailure = null;
        if (!result && routed.error) {
            lastFailure = mapRoutingFailure(routed.error.reason, routed.error.detail);
        }
        let enrichment = null;
        if (result && result.packet_2_status === 'pending' && result.enrichment_id) {
            enrichment = await fetchEnrichment(result.enrichment_id, 2000);
            if (enrichment) {
                mergeEnrichmentIntoRoute(result, enrichment);
            }
        }
        emitStatus(result, elapsed, lastFailure);
        try {
            const ts = result?.token_savings || {};
            const es = result?.execution_summary || {};
            const cl = result?.classification || {};
            const savingsEntry = {
                tokens_saved: ts.total_saved || ts.tokens_saved || 0,
                savings_ratio: ts.savings_ratio || 0,
                classifier_model: es.classifier_model || null,
                classifier_time_ms: es.classifier_time_ms || 0,
                effort: cl.effort_level || null,
                intent: cl.intent_type || null,
                confidence: cl.confidence || null,
                memory_delivered: result?.memory_context?.results?.length || 0,
                downstream_model: downstreamModel || null,
                server_version: es.server_version || null,
                stage_timing: es.stage_timing || null,
                timestamp: Date.now(),
            };
            ensureStateDir();
            writeFileSync(join(STATE_DIR, 'classification-savings.json'), JSON.stringify(savingsEntry));
            if (savingsEntry.tokens_saved > 0) {
                appendLine(join(STATE_DIR, 'op-history.jsonl'), JSON.stringify({
                    tool: 'classification',
                    model: savingsEntry.classifier_model,
                    time_ms: savingsEntry.classifier_time_ms,
                    tokens_saved: savingsEntry.tokens_saved,
                    cache_hit: false,
                    timestamp: Date.now(),
                }));
            }
        }
        catch {
            // Non-critical
        }
        persistLastClassification(prompt, sessionId, result, downstreamModel);
        try {
            const cl = result?.classification || {};
            const es = result?.execution_summary || {};
            appendFileSync(TURNS_JSONL_PATH, JSON.stringify({
                turn_number: turnCounter++,
                timestamp: new Date().toISOString(),
                prompt: prompt.substring(0, 500),
                effort_level: cl.effort_level || null,
                intent_type: cl.intent_type || null,
                confidence: cl.confidence || null,
                memory_tier: cl.memory_tier || null,
                memory_scope: cl.memory_scope || result?.routing_signals?.memory_scope || null,
                classifier_model: es.classifier_model || null,
            }) + '\n');
        }
        catch {
            // Non-critical
        }
        if (!result || !result.classification) {
            if (lastFailure) {
                process.stdout.write(JSON.stringify({
                    hookSpecificOutput: {
                        hookEventName: 'UserPromptSubmit',
                        additionalContext: formatFailureWarning(lastFailure),
                    },
                }));
            }
            else {
                process.stdout.write(JSON.stringify({}));
            }
            return 0;
        }
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'UserPromptSubmit',
                additionalContext: formatIntelligence(result, enrichment),
            },
        }));
        return 0;
    }
    catch {
        process.stdout.write(JSON.stringify({}));
        return 0;
    }
}
//# sourceMappingURL=user-prompt-submit.js.map