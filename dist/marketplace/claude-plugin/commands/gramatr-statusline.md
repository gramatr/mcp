---
description: Activate or deactivate the grāmatr statusLine in Claude Code
---

# /gramatr-statusline

Installs or removes the grāmatr statusLine entry in `~/.claude/settings.json`.

The Claude Code plugin system does not automatically merge `statusLine` from
plugin-owned settings files into user settings — this command does it explicitly.

## Activate (install statusLine)

Run the following, then restart Claude Code:

```bash
node -e "
const fs = require('fs');
const path = require('os').homedir() + '/.claude/settings.json';
const s = JSON.parse(fs.readFileSync(path, 'utf8'));
s.statusLine = { type: 'command', command: 'cat \"\${CLAUDE_PROJECT_DIR:-\$PWD}/.gramatr/statusline.txt\" 2>/dev/null' };
fs.writeFileSync(path, JSON.stringify(s, null, 2) + '\n');
console.log('statusLine activated');
"
```

## Deactivate (remove statusLine)

Run the following, then restart Claude Code:

```bash
node -e "
const fs = require('fs');
const path = require('os').homedir() + '/.claude/settings.json';
const s = JSON.parse(fs.readFileSync(path, 'utf8'));
delete s.statusLine;
fs.writeFileSync(path, JSON.stringify(s, null, 2) + '\n');
console.log('statusLine removed');
"
```

## Verify

After restarting Claude Code, the grāmatr status bar should appear at the
bottom of the UI showing project context, version, and session info.

If the bar is blank, the current project may not have a `.gramatr/statusline.txt`
yet — it is written after the first prompt completes in that project directory.
