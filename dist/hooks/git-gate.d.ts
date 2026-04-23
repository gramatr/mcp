/**
 * git-gate.ts — PreToolUse hook for the Bash tool.
 *
 * Enforces behavioral gates on dangerous git operations:
 *   1. git push to main/master — denied (use a PR)
 *   2. git tag — denied unless binaries are built for current version
 *   3. git push --force / git reset --hard — denied (requires explicit user approval)
 *
 * All other Bash commands are allowed unconditionally.
 */
/**
 * Check whether a Bash command triggers any git behavioral gate.
 * Exported for direct unit testing.
 */
export declare function checkGitCommand(command: string, cwd?: string): {
    allow: boolean;
    reason?: string;
};
export declare function runGitGateHook(_args?: string[]): Promise<number>;
//# sourceMappingURL=git-gate.d.ts.map