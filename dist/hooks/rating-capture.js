import { spawn } from "node:child_process";
import { callTool } from "../proxy/local-client.js";
import { RATING_FEEDBACK_TIMEOUT_MS } from "./generated/hook-timeouts.js";
import { resolveHookClientRuntime } from "./lib/client-runtime.js";
import { submitPendingClassificationFeedback } from "./lib/feedback.js";
import { readHookInput } from "./lib/gramatr-hook-utils.js";
import { drainOutbox, enqueueOutboxMutation } from "./lib/hook-state.js";
/** Swallow any rejection from drainOutbox — it is strictly best-effort. */
function swallow(_err) { }
function parseExplicitRating(prompt) {
    const trimmed = prompt.trim();
    const match = trimmed.match(/^(10|[1-9])(?:\s*[-:]\s*|\s+)?(.*)$/);
    if (!match)
        return null;
    const rating = parseInt(match[1], 10);
    const comment = match[2]?.trim() || undefined;
    if (rating < 1 || rating > 10)
        return null;
    if (comment) {
        const sentenceStarters = /^(items?|things?|steps?|files?|lines?|bugs?|issues?|errors?|times?|minutes?|hours?|days?|seconds?|percent|%|th\b|st\b|nd\b|rd\b|of\b|in\b|at\b|to\b|the\b|a\b|an\b)/i;
        if (sentenceStarters.test(comment))
            return null;
    }
    return { rating, comment };
}
export async function runRatingCaptureHook(_args = []) {
    const runtime = resolveHookClientRuntime(_args);
    try {
        const data = await readHookInput();
        const sessionId = data.session_id || "unknown";
        // Submit classification feedback for the PREVIOUS turn before processing this prompt.
        try {
            await Promise.race([
                submitPendingClassificationFeedback({
                    sessionId,
                    clientType: runtime.clientType,
                    agentName: runtime.agentName,
                }),
                new Promise((resolve) => setTimeout(() => resolve(null), RATING_FEEDBACK_TIMEOUT_MS)),
            ]);
        }
        catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[gramatr] rating-capture feedback error: ${detail}\n`);
        }
        const prompt = data.prompt || data.message || "";
        if (!prompt.trim()) {
            process.stdout.write(JSON.stringify({}));
            return 0;
        }
        const result = parseExplicitRating(prompt);
        if (!result) {
            process.stdout.write(JSON.stringify({}));
            return 0;
        }
        const entry = {
            timestamp: new Date().toISOString(),
            rating: result.rating,
            session_id: data.session_id,
            client_type: runtime.clientType,
            agent_name: runtime.agentName,
            ...(result.comment ? { comment: result.comment } : {}),
        };
        // Enqueue the rating via the local SQLite mutation outbox so we survive network blips.
        // The outbox replicates to the server on the next drain (session-start or immediate).
        // ratings.jsonl is no longer written — the outbox is the single source of truth.
        try {
            enqueueOutboxMutation("submit_feedback", {
                feedback_type: "rating",
                rating: entry.rating,
                task_description: entry.comment || `Session rating ${entry.rating}/10`,
                session_id: entry.session_id,
                client_type: entry.client_type,
                agent_name: entry.agent_name,
            });
            drainOutbox(callTool).catch(swallow);
        }
        catch {
            // Outbox unavailable — rating is lost silently; MCP server already received it.
        }
        if (result.rating <= 3) {
            try {
                const msg = result.comment
                    ? `Rating ${result.rating}/10: ${result.comment}`
                    : `Rating ${result.rating}/10 received`;
                const p = process.platform;
                if (p === "darwin") {
                    spawn("osascript", [
                        "-e",
                        `display notification "${msg}" with title "gramatr" subtitle "Low Rating Alert"`,
                    ], { stdio: "ignore", detached: true }).unref();
                }
                else if (p === "linux") {
                    spawn("notify-send", ["gramatr — Low Rating", msg], {
                        stdio: "ignore",
                        detached: true,
                    }).unref();
                }
                else if (p === "win32") {
                    spawn("powershell", ["-Command", `[System.Windows.Forms.MessageBox]::Show('${msg}','gramatr Low Rating')`], { stdio: "ignore", detached: true }).unref();
                }
            }
            catch { }
        }
    }
    catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[gramatr] rating-capture hook error: ${detail}\n`);
    }
    process.stdout.write(JSON.stringify({}));
    return 0;
}
//# sourceMappingURL=rating-capture.js.map