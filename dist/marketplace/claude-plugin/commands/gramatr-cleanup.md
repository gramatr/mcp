---
description: Clean up legacy grāmatr install artifacts (stale state.db, old npm-install side effects, deprecated hook binaries)
---

# /gramatr-cleanup

The grāmatr Claude Code plugin (v0.20.15+) is hermetic — it ships hooks, statusLine,
and the MCP server URL all from `~/.claude/plugins/...`. Earlier install paths
(pre-v0.20.15 npm-based `@gramatr/mcp` installs, plus the legacy `~/.gramatr/`
state tree) can leave behind artifacts that break or confuse the new plugin
install. Run the steps below to clear them.

## Step 1 — Remove the legacy state database and dev tree

```bash
rm -rf ~/.gramatr/state.db ~/.gramatr/state.db-shm ~/.gramatr/state.db-wal ~/.gramatr/debug
```

The plugin no longer maintains a local SQLite state database — all session
state lives server-side now. Old `state.db*` files are stale.

## Step 2 — Remove stale legacy caches

```bash
rm -rf ~/.gramatr/.cache ~/.gramatr/.state
```

## Step 3 — Remove deprecated hook binaries

```bash
rm -f ~/.gramatr/bin/gramatr-hook ~/.gramatr/bin/gramatr-hook-stop
```

The plugin replaces these with `type: "mcp_tool"` hook handlers configured
in `hooks/hooks.json` — no shell binaries needed.

## Step 4 — (Optional) Remove the entire legacy ~/.gramatr/ tree

```bash
rm -rf ~/.gramatr/
```

Only do this if you've fully migrated to the plugin install path and have
no remaining customizations or scripts that read from `~/.gramatr/`. The
plugin does not write to this location.

## Step 5 — Verify ~/.claude/settings.json is clean

Open `~/.claude/settings.json` and check:

- The `hooks` block contains no entries that reference `gramatr-hook`,
  `gramatr-hook-stop`, or any `~/.gramatr/bin/...` paths. The plugin's
  hooks live in its own `hooks/hooks.json` — they should NOT also appear
  in the user-level settings file.
- The top-level `statusLine` key is present and points to the grāmatr
  statusline command. Claude Code does not merge plugin-level `settings.json`
  into user settings automatically, so `statusLine` must live here:
  ```json
  "statusLine": {
    "type": "command",
    "command": "cat \"${CLAUDE_PROJECT_DIR:-$PWD}/.gramatr/statusline.txt\" 2>/dev/null"
  }
  ```
  If it is absent, run `/gramatr-statusline` to install it.

If you find legacy hook entries, remove them manually — settings.json is
user-owned and the plugin will not touch it.

## Step 6 — Restart Claude Code

```bash
exit
claude
```

This reinitializes the plugin so any newly-cleared state is picked up cleanly.
After restart, `/plugin` should list `gramatr` as installed and the SessionStart
hook should fire normally.

## Troubleshooting

If `gramatr://session/context` or `gramatr://session/statusline/<id>` still
returns stale data after cleanup, you may need to also clear server-side
state — open an issue at https://github.com/gramatr/gramatr/issues so we
can triage the lingering mapping.
