/**
 * edit-tracker.ts — PreToolUse hook for Write and Edit tools.
 *
 * Tracks modified files by appending to a JSONL log at
 * ~/.gramatr/debug/modified-files.jsonl. Always allows — this is a
 * tracking-only hook that never denies operations.
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
import { HOOK_STDIN_DEFAULT_TIMEOUT_MS } from './generated/hook-timeouts.js';
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
// ── Helpers ──
const ALLOW_OUTPUT = {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
};
function getModifiedFilesLogPath() {
    const dir = getGramatrDirFromEnv() || join(getHomeDir(), '.gramatr');
    return join(dir, 'debug', 'modified-files.jsonl');
}
export function trackModifiedFile(toolName, filePath) {
    const logPath = getModifiedFilesLogPath();
    const logDir = dirname(logPath);
    if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
    }
    const entry = {
        tool: toolName,
        file: filePath,
        timestamp: Date.now(),
    };
    appendFileSync(logPath, JSON.stringify(entry) + '\n');
}
// ── Hook runner ──
export async function runEditTrackerHook(_args = []) {
    const raw = await readStdin(HOOK_STDIN_DEFAULT_TIMEOUT_MS);
    process.stdout.write(JSON.stringify(ALLOW_OUTPUT));
    if (!raw.trim())
        return 0;
    try {
        const input = JSON.parse(raw);
        if (!input.tool_name || (input.tool_name !== 'Write' && input.tool_name !== 'Edit')) {
            return 0;
        }
        const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
        if (filePath) {
            trackModifiedFile(input.tool_name, filePath);
        }
    }
    catch {
        // Best effort — never block on tracking failures
    }
    return 0;
}
//# sourceMappingURL=edit-tracker.js.map