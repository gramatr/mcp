/**
 * git-gate.ts — PreToolUse hook for the Bash tool.
 *
 * Enforces behavioral gates on dangerous git operations:
 *   1. git push to main/master — denied (use a PR)
 *   2. git tag — denied unless binaries are built for current version.
 *      Supports both single-package npm libs and Turborepo / pnpm-workspace
 *      monorepos. Each workspace package that declares a `dist/`-targeted
 *      entry (`main`, `module`, `exports`, `bin`, `types` referencing
 *      `dist/...`) is verified independently. App packages that build to
 *      `.next/`, `out/`, etc. declare no `dist/` entry and are skipped.
 *      Stale builds — any `src/**\/*.ts` newer than the most recent file in
 *      `dist/` — are also rejected so a `git pull && git tag` without a
 *      rebuild is caught.
 *   3. git push --force / git reset --hard — denied (requires explicit
 *      user approval)
 *
 * All other Bash commands are allowed unconditionally.
 *
 * No external deps: pure Node built-ins (fs, path).
 */
export interface BuildCheckResult {
    ok: boolean;
    reason?: string;
}
/**
 * True iff workDir is a monorepo (pnpm-workspace.yaml present, or
 * package.json declares a non-empty `workspaces` array).
 */
export declare function isMonorepo(workDir: string): boolean;
/**
 * Returns absolute paths to each workspace package directory.
 * Source priority: pnpm-workspace.yaml, then package.json `workspaces`.
 */
export declare function listWorkspacePackages(workDir: string): string[];
/**
 * True iff the package.json declares any `dist/`-targeted entry.
 */
export declare function packageDeclaresDistEntry(pkgJson: Record<string, unknown>): boolean;
/**
 * Verify a single package: dist/ exists, has .js files, and no src/**\/*.ts
 * is newer than the newest dist/ file. Packages that don't declare a
 * dist/ entry are skipped (ok:true).
 */
export declare function verifyPackageBuilt(pkgPath: string): BuildCheckResult;
/**
 * Top-level entry — verify build artifacts for the working tree before a
 * tag is allowed. Single-package and monorepo aware.
 */
export declare function verifyBuildBeforeTag(workDir: string, version: string): BuildCheckResult;
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