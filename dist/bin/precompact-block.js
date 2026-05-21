#!/usr/bin/env node
// Blocks Claude Code auto-compaction and replaces it with the grāmatr handoff flow.
// Output is read by Claude Code as a hook decision.
process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: [
        'grāmatr: compaction blocked — your handoff is a better recovery than a lossy summary.',
        'Please run /save-handoff now to save full session state, then ask the user to run /clear.',
        'On /clear, grāmatr will automatically restore your handoff and resume the session.',
    ].join(' '),
}) + '\n');
export {};
//# sourceMappingURL=precompact-block.js.map