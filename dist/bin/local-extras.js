#!/usr/bin/env node
// packages/mcp/src/bin/local-extras.ts
// Zero-auth, zero-network SessionStart helper. Writes git context to
// .gramatr/git-context.json so the HTTP gramatr server can read it.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// gramatr-allow: c1
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const remote = spawnSync('git', ['remote', '-v'], { cwd: PROJECT_DIR, encoding: 'utf8' }).stdout?.trim() ?? '';
const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: PROJECT_DIR, encoding: 'utf8' }).stdout?.trim() ?? '';
const outDir = join(PROJECT_DIR, '.gramatr');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'git-context.json'), JSON.stringify({ remote, branch, cwd: PROJECT_DIR, updated_at: new Date().toISOString() }, null, 2) + '\n', 'utf8');
process.stderr.write(`grāmatr-local: git context written (branch: ${branch})\n`);
//# sourceMappingURL=local-extras.js.map