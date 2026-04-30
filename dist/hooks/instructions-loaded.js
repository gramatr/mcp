/**
 * instructions-loaded.ts — InstructionsLoaded hook.
 *
 * Fires when CLAUDE.md (or another instructions file) is loaded. When the
 * loaded file is gramatr's CLAUDE.md — path contains `.claude/CLAUDE.md`, or
 * content contains the `GRAMATR-START` marker — the hook:
 *
 *   1. Calls `resolve_project` with `action: "auto"` (git-derived).
 *   2. Calls `session_start` with the resolved project_id.
 *   3. Calls `load_handoff` for the project + session.
 *   4. Injects the handoff content as `additionalContext` on stdout so Claude
 *      receives it as part of the session context.
 *   5. Writes a concise success line to stderr.
 *
 * For any non-gramatr CLAUDE.md (or on any error), the hook outputs
 * `{ continue: true }` and returns — graceful degradation is required.
 */
import { existsSync, readFileSync } from 'node:fs';
import { callTool } from '../proxy/local-client.js';
import { deriveProjectId, getGitContext, log, now, readHookInput, } from './lib/gramatr-hook-utils.js';
import { loadProjectHandoff, startRemoteSession, resolveLocalProjectUuid, normalizeSessionStartResponse, } from './lib/session.js';
import { setSessionContext } from './lib/hook-state.js';
import { extractToolPayload } from './lib/tool-envelope.js';
import { resolveHookClientRuntime } from './lib/client-runtime.js';
// ── Detection ──
const GRAMATR_MARKER = 'GRAMATR-START';
export function isGramatrInstructions(input) {
    const filePath = input.file_path || input.path || '';
    if (filePath.includes('.claude/CLAUDE.md'))
        return true;
    // Check inline content if provided
    if (typeof input.content === 'string' && input.content.includes(GRAMATR_MARKER)) {
        return true;
    }
    // Fallback: read the file itself and look for the marker
    if (filePath && existsSync(filePath)) {
        try {
            const raw = readFileSync(filePath, 'utf8');
            if (raw.includes(GRAMATR_MARKER))
                return true;
        }
        catch {
            // Unreadable — treat as non-gramatr
        }
    }
    return false;
}
// ── Output helpers ──
function emitAllow() {
    process.stdout.write(JSON.stringify({ continue: true }));
}
function emitWithContext(additionalContext) {
    const out = {
        continue: true,
        hookSpecificOutput: {
            hookEventName: 'InstructionsLoaded',
            additionalContext,
        },
    };
    process.stdout.write(JSON.stringify(out));
}
// ── Handoff formatting ──
export function formatHandoff(handoff, projectName, openTasks) {
    const lines = [];
    lines.push('grāmatr Project Context (Auto-loaded from InstructionsLoaded hook)');
    lines.push('');
    if (projectName)
        lines.push(`Project: ${projectName}`);
    if (typeof openTasks === 'number' && openTasks >= 0) {
        lines.push(`Open tasks: ${openTasks}`);
    }
    lines.push('');
    if (handoff) {
        lines.push('## Previous Session Handoff');
        lines.push('');
        if (handoff.where_we_are) {
            lines.push('**Where we are:**');
            lines.push(handoff.where_we_are);
            lines.push('');
        }
        if (handoff.what_shipped) {
            lines.push('**What shipped:**');
            lines.push(handoff.what_shipped);
            lines.push('');
        }
        if (handoff.whats_next) {
            lines.push("**What's next:**");
            lines.push(handoff.whats_next);
            lines.push('');
        }
        if (handoff.key_context) {
            lines.push('**Key context:**');
            lines.push(handoff.key_context);
            lines.push('');
        }
        if (handoff.dont_forget) {
            lines.push("**Don't forget:**");
            lines.push(handoff.dont_forget);
            lines.push('');
        }
    }
    else {
        lines.push('No prior handoff available for this project.');
    }
    return lines.join('\n');
}
// ── Hook runner ──
export async function runInstructionsLoadedHook(_args = []) {
    const runtime = resolveHookClientRuntime(_args);
    let input;
    try {
        input = (await readHookInput());
    }
    catch {
        emitAllow();
        return 0;
    }
    // If we can't tell this is gramatr's CLAUDE.md, pass through silently.
    if (!isGramatrInstructions(input)) {
        emitAllow();
        return 0;
    }
    try {
        // Derive project identity from git.
        const git = getGitContext();
        if (!git) {
            log('[gramatr] InstructionsLoaded: no git context, skipping project resolution');
            emitAllow();
            return 0;
        }
        const fallbackProjectId = deriveProjectId(git.remote, git.projectName);
        // Step 1: resolve the project via server (auto mode — git-derived).
        let resolved = null;
        try {
            const raw = (await callTool('resolve_project', {
                action: 'auto',
                git_remote: git.remote,
                project_name: git.projectName,
                directory: git.root,
            }));
            resolved = extractToolPayload(raw);
        }
        catch (err) {
            log(`[gramatr] InstructionsLoaded: resolve_project failed: ${String(err)}`);
            // Continue with the fallback project id — the hook is best-effort.
        }
        const projectId = resolved?.project_id || fallbackProjectId;
        const projectName = resolved?.project_name || git.projectName;
        // Step 2: start (or resume) a session.
        const localUuid = resolveLocalProjectUuid({
            directory: git.root,
            projectName: git.projectName,
        });
        const sessionStart = await startRemoteSession({
            clientType: runtime.clientType,
            projectId,
            projectName,
            gitRemote: git.remote,
            gitBranch: git.branch,
            directory: git.root,
            projectUuid: localUuid ?? undefined,
        });
        const sessionResult = normalizeSessionStartResponse(sessionStart);
        const sessionId = sessionStart?.project_id ? (input.session_id || 'unknown') : (input.session_id || 'unknown');
        // Step 3: load handoff.
        const handoff = await loadProjectHandoff(projectId);
        // Persist session context locally so downstream hooks can see it.
        try {
            setSessionContext({
                session_id: sessionId,
                project_id: projectId,
                interaction_id: sessionResult.interactionId ?? null,
                entity_id: sessionResult.entityId ?? null,
                project_name: projectName,
                git_root: git.root,
                git_branch: git.branch,
                git_remote: git.remote,
                working_directory: git.root,
                session_start: now(),
                updated_at: now(),
                client_type: runtime.clientType,
                agent_name: runtime.agentName,
                platform: process.platform,
                arch: process.arch,
            });
        }
        catch {
            // Non-critical — continue.
        }
        // Step 4: emit additionalContext.
        const context = formatHandoff(handoff, projectName, null);
        emitWithContext(context);
        // Step 5: user-visible success line.
        const resumedFragment = sessionResult.resumed ? ' (resumed)' : '';
        log(`[gramatr] Project context loaded: ${projectName}${resumedFragment}`);
        return 0;
    }
    catch (err) {
        // Never block — fail gracefully.
        log(`[gramatr] InstructionsLoaded error: ${String(err)}`);
        emitAllow();
        return 0;
    }
}
//# sourceMappingURL=instructions-loaded.js.map