/* v8 ignore file -- barrel re-export only */
/**
 * hooks/index.ts — hook registry for @gramatr/mcp hook dispatcher.
 *
 * Every hook migrated from packages/client/hooks/ exports a runner with the
 * signature `(args: string[]) => Promise<number>`. The dispatcher looks them
 * up by name.
 *
 * Phase 1 (#652): only session-start is migrated. Remaining 7 hooks migrate
 * in Phase 2.
 */
export { runAgentGateHook } from './agent-gate.js';
export { runAgentVerifyHook } from './agent-verify.js';
export { runEditTrackerHook } from './edit-tracker.js';
export { runGitGateHook } from './git-gate.js';
export { runSessionStartHook } from './session-start.js';
export { runSessionEndHook } from './session-end.js';
export { runStopHook } from './stop.js';
export { runInputValidatorHook } from './input-validator.js';
export { runToolTrackerHook } from './tool-tracker.js';
export { runRatingCaptureHook } from './rating-capture.js';
export { runUserPromptSubmitHook } from './user-prompt-submit.js';
export { HOOK_MANIFEST, HOOK_NAMES } from './manifest.js';
//# sourceMappingURL=index.js.map