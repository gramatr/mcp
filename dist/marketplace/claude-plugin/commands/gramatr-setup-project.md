---
description: Pin this repository to a grāmatr project for reliable session resolution
---

# /gramatr-setup-project

Links the current git repository to a grāmatr project by writing
`.gramatr/project.json`. Once this file is committed, every machine that
clones the repo will resolve to the same grāmatr project — no dir-hash
ambiguity, no cross-machine drift.

## What this does

1. Reads the git remote (`origin`) to derive a stable project slug.
2. Calls `mcp__plugin_gramatr_gramatr__resolve_project` to resolve or
   create the project in grāmatr.
3. Writes `.gramatr/project.json` with `project_id`, `slug`, and
   `git_remote`.
4. Tells you to commit the file so all machines share the same mapping.

## Steps

Run these in order:

### Step 1 — Get the git remote

```bash
git remote get-url origin
```

Copy the output. If this is not a git repo or there is no `origin` remote,
you can still proceed by choosing a slug manually in Step 2.

### Step 2 — Resolve the project

Call `mcp__plugin_gramatr_gramatr__resolve_project` with:

```json
{
  "action": "resolve",
  "git_remote": "<output from Step 1>",
  "create_if_missing": true
}
```

The response will include `project_id` and `slug`. If `is_new: true`,
a fresh project was created. If `is_new: false`, you are now linked to
the existing project (and its full history).

### Step 3 — Write .gramatr/project.json

```bash
mkdir -p .gramatr
```

Then ask me to write `.gramatr/project.json` with:

```json
{
  "project_id": "<project_id from Step 2>",
  "slug": "<slug from Step 2>",
  "git_remote": "<git remote from Step 1>"
}
```

### Step 4 — Commit the file

```bash
git add .gramatr/project.json
git commit -m "chore: add .gramatr/project.json for unambiguous grāmatr project resolution"
```

Committing this file means every developer who clones this repo — and
every machine you work from — will resolve to the same grāmatr project
without any manual configuration.

### Step 5 — Verify

Restart Claude Code (or start a new session in this directory). The
SessionStart hook will now read `.gramatr/project.json` and pass
`project_id` directly to `session_bootstrap`, bypassing the dir-hash
fallback entirely.

## Notes

- `.gramatr/project.json` is safe to commit — it contains only a UUID,
  a slug, and a git remote URL. No tokens or secrets.
- If your repo is private and you do not want the remote URL in source
  control, omit `git_remote` from the file; the hook will fall back to
  reading it from git at session start.
- To change which project this repo maps to, update `project_id` in the
  file and restart Claude Code.
