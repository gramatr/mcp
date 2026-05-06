/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/config/*.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-04-21T15:46:48.857Z
 */
/** Default timeout for route_request calls from hooks (ms) */
export declare const HOOK_ROUTE_TIMEOUT_DEFAULT_MS = 60000;
/** Hard cap on route_request timeout (overrides env var if larger) (ms) */
export declare const HOOK_ROUTE_TIMEOUT_CAP_MS = 60000;
/** Maximum age of a classification before agent-gate denies launch (30 min) (ms) */
export declare const AGENT_GATE_FRESHNESS_THRESHOLD_MS = 1800000;
/** Default timeout for routePrompt when no explicit timeout is provided (ms) */
export declare const ROUTING_DEFAULT_TIMEOUT_MS = 15000;
/** Default readStdin timeout for PreToolUse hooks (git-gate, edit-tracker, agent-gate, input-validator) (ms) */
export declare const HOOK_STDIN_DEFAULT_TIMEOUT_MS = 2000;
/** Extended readStdin timeout for hooks processing larger payloads (tool-tracker, agent-verify) (ms) */
export declare const HOOK_STDIN_EXTENDED_TIMEOUT_MS = 3000;
/** Timeout for readHookInput stdin read (used by session-start, session-end, stop, rating-capture) (ms) */
export declare const HOOK_INPUT_READ_TIMEOUT_MS = 500;
/** Timeout for submitting classification feedback in the Stop hook (ms) */
export declare const STOP_FEEDBACK_TIMEOUT_MS = 3000;
/** Timeout for submitting classification feedback in the rating-capture hook (ms) */
export declare const RATING_FEEDBACK_TIMEOUT_MS = 5000;
/** Timeout for fetching latest version from npm registry (ms) */
export declare const VERSION_FETCH_TIMEOUT_MS = 3000;
/** Cache TTL for version check results (1 hour) (ms) */
export declare const VERSION_CACHE_TTL_MS = 3600000;
/** Timeout for rating submission API call in rating-capture hook (ms) */
export declare const RATING_API_TIMEOUT_MS = 5000;
/** Maximum time to wait for enrichment readiness when polling in wait mode (ms) */
export declare const ENRICHMENT_WAIT_TIMEOUT_MS = 20000;
/** Default timeout for a single enrichment fetch attempt (ms) */
export declare const ENRICHMENT_FETCH_TIMEOUT_MS = 5000;
/** Default polling interval between enrichment readiness checks (ms) */
export declare const ENRICHMENT_POLL_INTERVAL_MS = 500;
/** Buffer added to enrichment fetch timeout for the outer abort guard (ms) */
export declare const ENRICHMENT_TIMEOUT_BUFFER_MS = 1000;
/** AbortSignal timeout for REST API calls in hook-state session hydration (ms) */
export declare const HOOK_STATE_ABORT_TIMEOUT_MS = 5000;
/** Default timeout for server health check in gramatr-hook-utils (ms) */
export declare const HEALTH_CHECK_TIMEOUT_MS = 5000;
/** Timeout for remote MCP tool calls via HTTP in remote-client (ms) */
export declare const REMOTE_TOOL_CALL_TIMEOUT_MS = 30000;
/** Hard cap on startRemoteSession — prevents session-start hook from blocking Claude startup indefinitely (ms) */
export declare const SESSION_START_REMOTE_TIMEOUT_MS = 2000;
/** Max time to wait for agent composition before returning without it (gmtr-route-request.ts) (ms) */
export declare const COMPOSITION_TIMEOUT_MS = 8000;
/** Timeout for predictive suggestion LLM calls (predictive-suggestions.ts) (ms) */
export declare const SUGGESTION_TIMEOUT_MS = 10000;
/** Timeout for Llama diary synthesis calls (diary-synthesizer.ts) (ms) */
export declare const LLAMA_TIMEOUT_MS = 5000;
/** Timeout for reasoning service LLM calls — overridable via AI_REASONING_TIMEOUT env var (reasoning-service.ts, reasoning-tools.ts) (ms) */
export declare const REASONING_TIMEOUT_MS = 30000;
//# sourceMappingURL=hook-timeouts.d.ts.map