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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOOK_STDIN_DEFAULT_TIMEOUT_MS } from "./generated/hook-timeouts.js";
// ── Stdin ──
function readStdin(timeoutMs) {
    return new Promise((resolve) => {
        let data = "";
        const timer = setTimeout(() => resolve(data), timeoutMs);
        process.stdin.setEncoding("utf-8");
        process.stdin.on("data", (chunk) => {
            data += chunk;
        });
        process.stdin.on("end", () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.on("error", () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.resume();
    });
}
// ── Decision helpers ──
function buildPreToolUseOutput(allow, reason) {
    if (allow) {
        return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" } };
    }
    return {
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: reason || "Bash command blocked by gramatr git gate.",
        },
    };
}
/**
 * Check whether a Bash command triggers any git behavioral gate.
 * Exported for direct unit testing.
 */
export function checkGitCommand(command, cwd) {
    const trimmed = command.trim();
    // Only gate actual git commands — not gh, npm, or other tools whose
    // arguments may contain git-related strings.
    if (!trimmed.startsWith("git ") && !trimmed.startsWith("git\t")) {
        return { allow: true };
    }
    // Gate 1: git reset --hard — requires explicit user confirmation
    if (/^git\s+reset\s+--hard/.test(trimmed)) {
        return {
            allow: false,
            reason: "Destructive git command blocked by the gramatr git gate. " +
                "Ask the user to confirm they want this operation. " +
                "If they confirm, they can run the command directly by typing `! " + trimmed + "` in the prompt.",
        };
    }
    // Gate 2: push to main/master (with or without force/flags)
    if (/^git\s+push\b/.test(trimmed)) {
        const pushesToProtected = /^git\s+push\b.*\b(main|master)\b/.test(trimmed) ||
            /^git\s+push\b.*\S+:(main|master)\b/.test(trimmed);
        if (pushesToProtected) {
            return {
                allow: false,
                reason: "Use a PR to push to main. Direct pushes to main/master are not allowed.",
            };
        }
        // Force push to non-protected branches is allowed (standard after rebase)
    }
    // Gate 3: git tag — require binaries built for current version (Node/pnpm only)
    // Rust projects build on CI via tag push — no local artifact check needed.
    if (/git\s+tag\b/.test(trimmed)) {
        const workDir = cwd || process.cwd();
        if (!existsSync(join(workDir, "Cargo.toml"))) {
            try {
                const pkg = JSON.parse(readFileSync(join(workDir, "package.json"), "utf8"));
                const version = pkg.version;
                if (!version) {
                    return {
                        allow: false,
                        reason: "Cannot read version from package.json. Run pnpm build before tagging.",
                    };
                }
                if (!existsSync(join(workDir, "dist"))) {
                    return {
                        allow: false,
                        reason: `Run pnpm build and build-all-targets before tagging v${version}. No dist/ directory found.`,
                    };
                }
            }
            catch {
                return {
                    allow: false,
                    reason: "Run pnpm build and build-all-targets before tagging. Could not verify build artifacts.",
                };
            }
        }
    }
    return { allow: true };
}
// ── Hook runner ──
export async function runGitGateHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_DEFAULT_TIMEOUT_MS);
    if (!raw.trim()) {
        process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
        return 0;
    }
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || input.tool_name !== "Bash") {
            process.stdout.write(JSON.stringify(buildPreToolUseOutput(true)));
            return 0;
        }
        const command = input.tool_input?.command || "";
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