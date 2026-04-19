/**
 * hook-dispatcher.ts — runHook() entry point for the `gramatr-mcp hook`
 * subcommand family.
 *
 * Phase 1 (#652): dispatches to hook runners in ../hooks/. Kept intentionally
 * small — this module is on the cold-start path for every SessionStart
 * invocation, and we pay ~30–60ms per unused import on a warm disk.
 *
 * Exit codes:
 *   0 — hook ran successfully (or degraded gracefully)
 *   1 — invalid args (missing hook name)
 *   2 — unknown hook name
 */
import { HOOK_NAMES } from '../hooks/index.js';
function isKnownHook(name) {
    return HOOK_NAMES.includes(name);
}
/**
 * Look up and execute a hook by name.
 *
 * The hook module is imported dynamically so the dispatcher pays zero import
 * cost for hooks the user did not ask for.
 */
export async function runHook(name, args) {
    if (!name) {
        process.stderr.write('[gramatr-mcp] hook: missing hook name\n');
        process.stderr.write('  Usage: gramatr-mcp hook <name> [args...]\n');
        process.stderr.write('         gramatr-mcp hook --list\n');
        return 1;
    }
    if (name === '--list' || name === '-l' || name === 'list') {
        for (const hookName of HOOK_NAMES) {
            process.stdout.write(`${hookName}\n`);
        }
        return 0;
    }
    if (!isKnownHook(name)) {
        process.stderr.write(`[gramatr-mcp] hook: unknown hook: ${name}\n`);
        process.stderr.write(`  Known hooks: ${HOOK_NAMES.join(', ')}\n`);
        return 2;
    }
    let runner;
    switch (name) {
        case 'agent-gate': {
            const mod = await import('../hooks/agent-gate.js');
            runner = mod.runAgentGateHook;
            break;
        }
        case 'agent-verify': {
            const mod = await import('../hooks/agent-verify.js');
            runner = mod.runAgentVerifyHook;
            break;
        }
        case 'edit-tracker': {
            const mod = await import('../hooks/edit-tracker.js');
            runner = mod.runEditTrackerHook;
            break;
        }
        case 'git-gate': {
            const mod = await import('../hooks/git-gate.js');
            runner = mod.runGitGateHook;
            break;
        }
        case 'input-validator': {
            const mod = await import('../hooks/input-validator.js');
            runner = mod.runInputValidatorHook;
            break;
        }
        case 'rating-capture': {
            const mod = await import('../hooks/rating-capture.js');
            runner = mod.runRatingCaptureHook;
            break;
        }
        case 'session-end': {
            const mod = await import('../hooks/session-end.js');
            runner = mod.runSessionEndHook;
            break;
        }
        case 'session-start': {
            const mod = await import('../hooks/session-start.js');
            runner = mod.runSessionStartHook;
            break;
        }
        case 'stop': {
            const mod = await import('../hooks/stop.js');
            runner = mod.runStopHook;
            break;
        }
        case 'tool-tracker': {
            const mod = await import('../hooks/tool-tracker.js');
            runner = mod.runToolTrackerHook;
            break;
        }
        case 'user-prompt-submit': {
            const mod = await import('../hooks/user-prompt-submit.js');
            runner = mod.runUserPromptSubmitHook;
            break;
        }
        default: {
            // Unreachable: isKnownHook would have caught anything else.
            process.stderr.write(`[gramatr-mcp] hook: no runner registered for ${name}\n`);
            return 2;
        }
    }
    return runner(args);
}
//# sourceMappingURL=hook-dispatcher.js.map