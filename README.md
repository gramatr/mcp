# @gramatr/mcp

Intelligence middleware for AI agents by [gramatr](https://gramatr.com).

Pre-classifies every request, injects relevant memory and behavioral context,
enforces data quality, and maintains session continuity across Claude, ChatGPT,
Codex, Cursor, Gemini, and any MCP-compatible client.

## Quick Install

```bash
npx @gramatr/mcp setup claude
```

This configures Claude Code with the gramatr MCP server, hooks, and guidance.
Restart Claude Code after running.

## Setup Targets

```bash
gramatr-mcp setup claude           # Claude Code (hooks + MCP + guidance)
gramatr-mcp setup codex            # OpenAI Codex (hooks + guidance)
gramatr-mcp setup claude-desktop   # Claude Desktop app (MCP config)
gramatr-mcp setup chatgpt-desktop  # ChatGPT Desktop app (MCP config)
gramatr-mcp setup gemini           # Gemini CLI (extension + hooks)
gramatr-mcp setup web              # Claude.ai web (instructions + prompt)
gramatr-mcp setup web chatgpt      # ChatGPT web connector
gramatr-mcp setup web gemini       # Gemini web connector
```

## Authentication

```bash
gramatr-mcp login          # Browser-based OAuth login
gramatr-mcp add-api-key    # Store an API key directly
gramatr-mcp logout         # Remove stored credentials
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
