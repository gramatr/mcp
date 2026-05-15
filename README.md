# @gramatr/mcp

Intelligence middleware for AI agents by [gramatr](https://gramatr.com).

Pre-classifies every request, injects relevant memory and behavioral context,
enforces data quality, and maintains session continuity across Claude, ChatGPT,
Codex, Cursor, Gemini, and any MCP-compatible client.

## Quick Install (Claude Code)

```bash
npx @gramatr/mcp install
```

Idempotent. Safe to re-run for upgrades. Configures everything in one shot:

1. **Auth check** — runs device-flow login if `~/.gramatr.json` has no token.
2. **Hook script** — drops `~/.gramatr/scripts/hook-userpromptsubmit.sh` (chmod 0755).
3. **Settings merge** — adds the `UserPromptSubmit` entry to `~/.claude/settings.json`,
   preserving every other key. Backs up to `~/.claude/settings.json.bak-<ts>` first.
4. **CLAUDE.md merge** — upserts the gramatr agent contract between
   `<!-- GRAMATR-START -->` / `<!-- GRAMATR-END -->` sentinels in
   `~/.claude/CLAUDE.md`. Preserves everything outside the block.
5. **Legacy cleanup** — with `--clean-legacy` (or `--non-interactive`), removes
   the legacy 14-handler scaffold (`~/.gramatr/bin/gramatr-hook*`),
   daemon `state.db*`, `~/.gramatr/debug/`, stale auth-cache backups, and
   legacy gramatr-flavored slash commands under `~/.claude/commands/`
   (e.g. `save-handoff.md` that still references the retired
   `~/.gramatr/.state/last-packet.json` path).

Restart Claude Code after install to activate the hook.

### Flags

| Flag | Effect |
|------|--------|
| `--client=<claude-code\|claude-desktop\|claude-web>` | Target a specific client. Default: auto-detect. |
| `--clean-legacy` | Scrub legacy gramatr-* hook entries + filesystem cruft + slash commands without prompting. |
| `--non-interactive` | CI-friendly; implies `--clean-legacy`. |
| `--dry-run` | Print actions without writing. |

### Multi-client install (#2472)

| Client | Behavior |
|--------|----------|
| `claude-code` | Full path: hook scripts + `~/.claude/settings.json` + `~/.claude/CLAUDE.md`. Auto-detected when `~/.claude/settings.json` exists or `~/.claude.json` has `mcpServers`. |
| `claude-desktop` | Writes a `gramatr` entry into `claude_desktop_config.json` (HTTP transport + Bearer header from `~/.gramatr.json`). No shell hooks. Auto-detected when the Desktop config exists at the platform path (macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`, Linux `~/.config/Claude/`). Restart Claude Desktop after install. |
| `claude-web` | No filesystem changes. Prints copy-paste connector setup steps (URL, OAuth/API key flow) and the canonical prompt suggestion to paste into claude.ai → Settings → Profile → Custom Instructions. |

### Uninstall

```bash
npx @gramatr/mcp uninstall          # remove hook + CLAUDE.md section, keep token
npx @gramatr/mcp uninstall --purge  # also remove ~/.gramatr.json
```

Every file is backed up before mutation.

## Setup Targets (other clients)

```bash
gramatr setup claude           # Claude Code (hooks + MCP + guidance)
gramatr setup codex            # OpenAI Codex (hooks + guidance)
gramatr setup claude-desktop   # Claude Desktop app (MCP config)
gramatr setup chatgpt-desktop  # ChatGPT Desktop app (MCP config)
gramatr setup gemini           # Gemini CLI (extension + hooks)
gramatr setup web              # Claude.ai web (instructions + prompt)
gramatr setup web chatgpt      # ChatGPT web connector
gramatr setup web gemini       # Gemini web connector
```

## Authentication

```bash
gramatr login          # Browser-based OAuth login
gramatr add-api-key    # Store an API key directly
gramatr logout         # Remove stored credentials
```

Credentials are stored in `~/.gramatr.json`. The MCP server reads the token
on startup and injects it into every remote call.

## How It Works

```
Your AI client (Claude, Cursor, Codex, ...)
    |
    stdio
    |
@gramatr/mcp (local, runs on your machine)
    |
    HTTPS (authenticated)
    |
api.gramatr.com (hosted intelligence layer)
```

The local server:

- **Proxies all remote tools** -- fetches the tool list dynamically at startup,
  no hardcoded tool names
- **Proxies prompts and resources** -- server-defined prompt templates available
  locally
- **Validates input** -- JSON Schema validation + entity type enforcement before
  calls leave your machine
- **Caches reads** -- LRU cache (100 entries, 60s TTL) for read-only tools
- **Queues mutations offline** -- network drops don't lose writes; replayed on
  reconnect
- **Runs hooks** -- session-start, prompt routing, input validation, tool
  tracking, rating capture, classification feedback, session-end
- **Local tools** -- web fetch, web search, status, metrics, cache management

## Local Tools

| Tool | Purpose |
|------|---------|
| `gramatr_local_status` | Server health, uptime, tool counts, cache stats |
| `gramatr_local_metrics` | Per-tool latency (p50/p95/p99), cache hit rate |
| `gramatr_local_config` | Auth source, server URL, cache settings |
| `gramatr_local_clear_cache` | Flush LRU cache |
| `gramatr_local_fetch` | Fetch any URL, strip HTML, return text |
| `gramatr_local_search` | DuckDuckGo web search (no API key needed) |

## Debug Mode

```bash
GRAMATR_DEBUG=1 claude
```

Logs every JSON-RPC request/response and routing decision to stderr.
Auth tokens are redacted.

## MCP Client Configuration

For clients that support MCP natively, add this to your MCP config:

```json
{
  "mcpServers": {
    "gramatr": {
      "command": "node",
      "args": ["~/.gramatr/mcp/dist/bin/gramatr-mcp.js"]
    }
  }
}
```

Or via npx (slower, checks npm on every start):

```json
{
  "mcpServers": {
    "gramatr": {
      "command": "npx",
      "args": ["-y", "@gramatr/mcp"]
    }
  }
}
```

## State Files

| Path | Purpose |
|------|---------|
| `~/.gramatr.json` | Auth token + server URL |
| `~/.gramatr/settings.json` | Identity, principal config |
| `<project>/.gramatr/settings.json` | Per-project config (project UUID, session state) |
| `~/.gramatr/.state/` | Session runtime (turns, metrics, op history) |

## Requirements

- Node.js >= 20
- A gramatr account (sign up at [gramatr.com](https://gramatr.com))

## License

See [LICENSE](LICENSE) in this package.
