#!/usr/bin/env node
// packages/mcp/src/bin/project-init.ts
// Zero-auth, zero-network SessionStart helper. Writes project identity and git
// context to .gramatr/git-context.json so session_bootstrap can resolve the
// grāmatr project without a network call or dir-hash fallback.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// gramatr-allow: c1
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
let savedProject = {};
try {
    const projectFile = join(PROJECT_DIR, '.gramatr', 'project.json');
    if (existsSync(projectFile)) {
        savedProject = JSON.parse(readFileSync(projectFile, 'utf8'));
    }
}
catch { /* non-critical */ }
const remote_url = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: PROJECT_DIR, encoding: 'utf8' }).stdout?.trim() ?? '';
const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: PROJECT_DIR, encoding: 'utf8' }).stdout?.trim() ?? '';
const outDir = join(PROJECT_DIR, '.gramatr');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'git-context.json'), JSON.stringify({
    ...(savedProject.project_id ? { project_id: savedProject.project_id } : {}),
    ...(savedProject.slug ? { slug: savedProject.slug } : {}),
    remote_url: remote_url || savedProject.git_remote || '',
    branch,
    cwd: PROJECT_DIR,
    updated_at: new Date().toISOString(),
}, null, 2) + '\n', 'utf8');
process.stderr.write(`grāmatr: project context written (branch: ${branch}, project_id: ${savedProject.project_id ?? 'unresolved'})\n`);
//# sourceMappingURL=project-init.js.map