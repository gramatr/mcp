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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// ── Stdin ──
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
// ── Decision helpers ──
function buildPreToolUseOutput(allow, reason) {
    if (allow) {
        return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
    }
    return {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason || 'Bash command blocked by gramatr git gate.',
        },
    };
}
/**
 * Check whether a Bash command triggers any git behavioral gate.
 * Exported for direct unit testing.
 */
export function checkGitCommand(command, cwd) {
    const trimmed = command.trim();
    // Gate 1: destructive git commands
    if (/git\s+push\s+.*--force/.test(trimmed) || /git\s+push\s+-f\b/.test(trimmed)) {
        return { allow: false, reason: 'Destructive git command requires explicit user approval. Do not use --force push.' };
    }
    if (/git\s+reset\s+--hard/.test(trimmed)) {
        return { allow: false, reason: 'Destructive git command requires explicit user approval. Do not use git reset --hard.' };
    }
    // Gate 2: push to main/master
    if (/git\s+push\b/.test(trimmed)) {
        // Check if pushing to main or master — look for explicit branch ref
        if (/git\s+push\s+\S+\s+(main|master)\b/.test(trimmed)) {
            return { allow: false, reason: 'Use a PR to push to main. Direct pushes to main/master are not allowed.' };
        }
        // Also catch `git push origin HEAD:main` or `git push origin HEAD:master`
        if (/git\s+push\s+\S+\s+\S+:(main|master)\b/.test(trimmed)) {
            return { allow: false, reason: 'Use a PR to push to main. Direct pushes to main/master are not allowed.' };
        }
    }
    // Gate 3: git tag — require binaries built for current version
    if (/git\s+tag\b/.test(trimmed)) {
        const workDir = cwd || process.cwd();
        try {
            const pkgPath = join(workDir, 'package.json');
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
            const version = pkg.version;
            if (!version) {
                return { allow: false, reason: 'Cannot read version from package.json. Run pnpm build before tagging.' };
            }
            const distDir = join(workDir, 'dist');
            if (!existsSync(distDir)) {
                return { allow: false, reason: `Run pnpm build and build-all-targets before tagging v${version}. No dist/ directory found.` };
            }
        }
        catch {
            return { allow: false, reason: 'Run pnpm build and build-all-targets before tagging. Could not verify build artifacts.' };
        }
    }
    return { allow: true };
}
// ── Hook runner ──
export async function runGitGateHook(_args = []) {
    const raw = await readStdin(2000);
    if (!raw.trim()) {
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
        return 0;
    }
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || input.tool_name !== 'Bash') {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
            return 0;
        }
        const command = input.tool_input?.command || '';
        if (!command) {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
            return 0;
        }
        const result = checkGitCommand(command);
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(result.allow, result.reason)));
    }
    catch {
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
    }
    return 0;
}
//# sourceMappingURL=git-gate.js.map