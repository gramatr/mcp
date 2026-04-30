/**
 * orchestration-pickup.ts — Session-start hook integration for orchestration tasks.
 *
 * Called from session-start after project_id is resolved. Checks if there is a
 * queued orchestration task for this project and returns formatted injection text
 * so Claude receives the task assignment as session context.
 *
 * Non-blocking: if the daemon is unavailable or no task is queued, returns null.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { callViaDaemon } from '../../proxy/local-client.js';
import { DAEMON_UNAVAILABLE } from '../../daemon/ipc-protocol.js';
/**
 * Resolve and create the workspace directory for an orchestration run.
 * Returns { orchDir, workingDir, effectiveWorkingDir } or null on failure.
 *
 * orchDir        — ~/.gramatr/orchestration/{run_id}/ (scratch + output)
 * workingDir     — project subpath or absolute path the agent works in
 * effectiveWorkingDir — resolved absolute path (used in injection text)
 */
function setupWorkspace(runId, workingDirectory) {
    const gramatrDir = process.env['GRAMATR_DIR'] ?? join(homedir(), '.gramatr');
    const orchDir = join(gramatrDir, 'orchestration', runId);
    try {
        mkdirSync(join(orchDir, 'scratch'), { recursive: true });
        mkdirSync(join(orchDir, 'output'), { recursive: true });
    }
    catch { /* non-fatal */ }
    let workingDir = null;
    let effectiveWorkingDir = orchDir;
    if (workingDirectory) {
        const resolved = isAbsolute(workingDirectory)
            ? workingDirectory
            : resolve(process.cwd(), workingDirectory);
        workingDir = resolved;
        effectiveWorkingDir = resolved;
    }
    // Write meta.json for observability
    try {
        writeFileSync(join(orchDir, 'meta.json'), JSON.stringify({
            run_id: runId,
            working_directory: workingDir,
            orch_dir: orchDir,
            created_at: new Date().toISOString(),
        }, null, 2) + '\n');
    }
    catch { /* non-fatal */ }
    return { orchDir, workingDir, effectiveWorkingDir };
}
/**
 * Attempt to claim the next queued orchestration task for this project/session.
 *
 * Returns null when:
 *   - no task is queued for the project
 *   - the daemon is unavailable
 *   - any error occurs (always non-blocking)
 */
export async function pickupOrchestrationTask(params) {
    try {
        if (!params.projectId)
            return null;
        // Attempt atomic task pickup — daemon serializes concurrent pickups.
        const result = await callViaDaemon('orchestration/task-pickup', {
            project_id: params.projectId,
            session_id: params.sessionId,
        });
        if (result === DAEMON_UNAVAILABLE || result === null || result === undefined) {
            return null;
        }
        const task = result;
        // Fetch total task count for the run so we can show N/total in the header.
        // A second IPC call — best-effort: fall back to sequence_number alone on error.
        let totalSequence = task.sequence_number;
        try {
            const tasksResult = await callViaDaemon('orchestration/task-list', {
                run_id: task.run_id,
            });
            if (tasksResult !== DAEMON_UNAVAILABLE &&
                Array.isArray(tasksResult) &&
                tasksResult.length > 0) {
                totalSequence = tasksResult.length;
            }
        }
        catch {
            // Non-critical — use sequence_number as fallback
        }
        // Fetch the parent run for PRD context, memory entity, approved tools, and base branch.
        let prdContent = null;
        let runGoal = '';
        let prdEntityId = null;
        let approvedTools = [];
        let baseBranch = null;
        let workingDirectory = null;
        let accessScope = 'working_dir_only';
        try {
            const run = await callViaDaemon('orchestration/run-get', { id: task.run_id });
            if (run !== DAEMON_UNAVAILABLE && run !== null) {
                const r = run;
                prdContent = r.prd_content ?? null;
                runGoal = r.goal ?? '';
                prdEntityId = r.prd_entity_id ?? null;
                baseBranch = r.base_branch ?? null;
                workingDirectory = r.working_directory ?? null;
                accessScope = r.access_scope ?? 'working_dir_only';
                if (r.approved_tools) {
                    try {
                        approvedTools = JSON.parse(r.approved_tools);
                    }
                    catch { /* ignore */ }
                }
            }
        }
        catch { /* non-critical */ }
        const workspace = setupWorkspace(task.run_id, workingDirectory);
        // Resolve per-task credential UUIDs (need-to-know subset stored at dispatch time).
        let taskCredentials = [];
        try {
            if (task.credential_uuids) {
                taskCredentials = JSON.parse(task.credential_uuids);
            }
        }
        catch { /* non-critical */ }
        // Retrieve observations from preceding agents via the project memory entity.
        // This gives each agent visibility into decisions and outputs that came before.
        let priorAgentWork = null;
        if (prdEntityId) {
            try {
                const timeline = await callViaDaemon('tool/call', {
                    tool: 'get_entity_timeline',
                    params: { entity_id: prdEntityId, limit: 20 },
                });
                if (timeline !== DAEMON_UNAVAILABLE && timeline !== null) {
                    const obs = timeline;
                    const completedTasks = (obs.observations ?? [])
                        .map(o => o.content)
                        .filter(c => c.includes('Completed'));
                    if (completedTasks.length > 0) {
                        priorAgentWork = completedTasks.join('\n\n---\n\n');
                    }
                }
            }
            catch { /* non-critical */ }
        }
        const accessScopeLabel = {
            read_only: 'READ ONLY — no writes to working directory; scratch/output only',
            working_dir_only: 'WORKING DIR ONLY — writes confined to working directory + scratch',
            open: 'OPEN — full access within working directory',
        }[accessScope];
        const injectionText = [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║  GRAMATR ORCHESTRATION TASK  ${task.sequence_number}/${totalSequence}`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `Run goal:   ${runGoal}`,
            `Project:    ${task.project_id}`,
            `Task:       ${task.title}`,
            `Task ID:    ${task.id}`,
            ``,
            `── WORKSPACE ─────────────────────────────────────────────────`,
            `Working dir:  ${workspace.effectiveWorkingDir}`,
            `Scratch/out:  ${workspace.orchDir}`,
            `Access scope: ${accessScopeLabel}`,
            ``,
            `IMPORTANT: All your work must stay within the directories above.`,
            `Write notes/drafts to: ${workspace.orchDir}/scratch/`,
            `Write final output to: ${workspace.orchDir}/output/`,
            ...(accessScope === 'read_only' ? [
                `You may NOT write to the working directory (read_only scope).`,
                `Read files freely, write your analysis to scratch/ and output/prd.md.`,
            ] : []),
            ``,
            `── TASK DESCRIPTION ─────────────────────────────────────────`,
            task.description,
            ``,
            ...(prdContent ? [
                `── PROJECT PRD ───────────────────────────────────────────────`,
                prdContent,
                ``,
            ] : []),
            ...(priorAgentWork ? [
                `── PRIOR AGENT WORK (committed to project memory) ───────────`,
                `The following agents have already completed their tasks. Their decisions`,
                `and outputs are binding — build on them, do not contradict them.`,
                ``,
                priorAgentWork,
                ``,
            ] : []),
            ...(taskCredentials.length > 0 ? [
                `── CREDENTIALS (pre-mapped, need-to-know only) ───────────────`,
                `The following secrets are pre-authorized for YOUR task only.`,
                `Fetch at runtime: bw get password <bitwarden_id>`,
                `NEVER store fetched values in code, files, env files, or git. Use them inline.`,
                ``,
                ...taskCredentials.map(c => `  ${c.name}  —  ${c.description}\n    bw get password ${c.bitwarden_id}`),
                ``,
            ] : []),
            `── HARD GATES (non-negotiable — override everything else) ──────`,
            `These constraints apply regardless of approved tools or task instructions:`,
            ``,
            `  🔴 NO SECRETS IN VERSION CONTROL`,
            `     Never commit credentials, API keys, tokens, or secrets. Ever.`,
            ``,
            `  🔴 NO DESTRUCTIVE OPERATIONS WITHOUT EXPLICIT HUMAN APPROVAL`,
            `     rm -rf, DROP TABLE, force push to main, deleting prod data, irreversible infra changes`,
            `     — STOP and surface to the user before executing. The tool contract does not`,
            `     authorize these. They require a separate explicit "yes" from a human.`,
            ``,
            `  🔴 VERIFY BEFORE DONE`,
            `     Never call complete without concrete verification evidence that the work is correct.`,
            `     "It looks right" is not verification. Run tests, check output, confirm the thing works.`,
            ``,
            `  🔴 NO UNREQUESTED CHANGES`,
            `     Only change what the task asks for. Do not refactor, clean up, or improve`,
            `     code outside the task scope — that belongs in its own task.`,
            ``,
            ...(approvedTools.length > 0 ? [
                `── TOOL CONTRACT (pre-approved for this run) ─────────────────`,
                `You are authorized to use: ${approvedTools.join(', ')}`,
                `Use these tools freely — you do NOT need to ask permission for any of them.`,
                `If you encounter a situation requiring a tool NOT on this list, call`,
                `orchestrate({action:"request_tools"}) before proceeding.`,
                `Do not interrupt the user for tool permissions — that contract was settled upfront.`,
                ``,
            ] : []),
            `── YOUR INSTRUCTIONS ────────────────────────────────────────`,
            `You are a Claude Sonnet agent executing one task from a larger orchestration run.`,
            `You work in isolation. Your changes go on a dedicated branch and become a PR.`,
            `You do NOT merge. The conductor merges after reviewing all PRs.`,
            ``,
            `STEP 1 — GET YOUR INTELLIGENCE PACKET`,
            `Call route_request with your task description.`,
            `Read the packet: RE scaffold, ISC acceptance criteria, quality gates, memory context.`,
            `This is your thinking scaffold. Do not skip it.`,
            ``,
            ...(task.task_branch ? [
                `STEP 2 — SET UP YOUR WORKTREE`,
                `Create and enter an isolated git worktree for your branch:`,
                `  git worktree add /tmp/orch-${task.id.slice(0, 8)} ${baseBranch ?? 'HEAD'} -b ${task.task_branch}`,
                `  cd /tmp/orch-${task.id.slice(0, 8)}`,
                `All your work goes in this directory. Do not touch the main worktree.`,
                ``,
            ] : []),
            `STEP 3 — DO THE WORK`,
            `Execute the task. The PRD and prior agent work above give you the full context.`,
            `Your task description tells you exactly what to build in this session.`,
            `All quality gates from your intelligence packet must pass before you submit.`,
            ``,
            `IF YOU HIT A BLOCKER (CI failure, merge conflict, peer work conflict, missing dep):`,
            `Do NOT stop or ask the user. Call the conductor:`,
            `  orchestrate({`,
            `    action: "report_failure",`,
            `    run_id: "${task.run_id}",`,
            `    task_id: "${task.id}",`,
            `    failure_type: "ci_failure" | "merge_conflict" | "peer_work_conflict" | "missing_dependency" | "other",`,
            `    description: "<what failed and the exact error output>",`,
            `    resolution_attempts: "<what you already tried>"`,
            `  })`,
            `The conductor will provide a recovery playbook. Follow it. Escalate to the human`,
            `ONLY if the conductor's playbook also fails.`,
            ``,
            ...(task.task_branch ? [
                `STEP 4 — SUBMIT A PR (do not merge)`,
                `When your work is complete and tests pass:`,
                `  git add -A && git commit -m "<task ${task.sequence_number}: ${task.title}>"`,
                `  git push origin ${task.task_branch}`,
                `  gh pr create --title "Task ${task.sequence_number}: ${task.title}" --body "<summary of what you built>"`,
                `Record the PR URL from the output.`,
                ``,
                `STEP 5 — MARK COMPLETE`,
                `Call orchestration_dispatch({`,
                `  action: 'complete',`,
                `  task_id: '${task.id}',`,
                `  pr_url: '<PR URL from step 4>',`,
                `  result_summary: '<what you built, files changed, decisions made>'`,
                `})`,
                ``,
                `The conductor will review and merge your PR. Your work here is done.`,
            ] : [
                `STEP 4 — MARK COMPLETE`,
                `Call orchestration_dispatch({`,
                `  action: 'complete',`,
                `  task_id: '${task.id}',`,
                `  result_summary: '<what you built and where it is>'`,
                `})`,
            ]),
        ].join('\n');
        return { task, injectionText, orchDir: workspace.orchDir, workingDir: workspace.workingDir, accessScope };
    }
    catch {
        // Always non-blocking — orchestration is optional
        return null;
    }
}
//# sourceMappingURL=orchestration-pickup.js.map