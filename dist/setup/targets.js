import { join } from 'node:path';
import { resolveBinaryPath } from '../bin/setup-shared.js';
export function getClaudeDesktopConfigPath(home, platform = process.platform) {
    if (platform === 'win32') {
        return join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    }
    return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}
export function getChatgptDesktopConfigPath(home, platform = process.platform) {
    if (platform === 'win32') {
        return join(home, 'AppData', 'Roaming', 'ChatGPT', 'mcp.json');
    }
    return join(home, '.chatgpt', 'mcp.json');
}
export function getCursorConfigPath(home) {
    return join(home, '.cursor', 'mcp.json');
}
export function getWindsurfConfigPath(home) {
    return join(home, '.windsurf', 'mcp.json');
}
export function getVscodeConfigPath(home) {
    return join(home, '.vscode', 'mcp.json');
}
export function getOpenCodeConfigPath(home) {
    return join(home, '.config', 'opencode', 'config.json');
}
export function getOpenCodeProjectConfigPath() {
    return 'opencode.json';
}
export function buildOpenCodeMcpServerEntry(home, serverUrl, _platform = process.platform) {
    const { command, args } = resolveBinaryPath();
    return {
        type: 'local',
        command: [command, ...args],
        enabled: true,
        env: {
            GRAMATR_DIR: join(home, '.gramatr'),
            GRAMATR_URL: serverUrl,
        },
    };
}
export function getGeminiExtensionDir(home) {
    return join(home, '.gemini', 'extensions', 'gramatr');
}
export function getGeminiHooksPath(home) {
    return join(getGeminiExtensionDir(home), 'hooks', 'hooks.json');
}
export function getGeminiManifestPath(home) {
    return join(getGeminiExtensionDir(home), 'gemini-extension.json');
}
export function buildLocalMcpServerEntry(home, serverUrl, _platform = process.platform) {
    const { command, args } = resolveBinaryPath();
    return {
        command,
        ...(args.length > 0 && { args }),
        env: {
            GRAMATR_DIR: join(home, '.gramatr'),
            GRAMATR_URL: serverUrl,
        },
    };
}
export function mergeMcpServerConfig(existing, entry) {
    return {
        ...existing,
        mcpServers: {
            ...(existing.mcpServers || {}),
            gramatr: entry,
        },
    };
}
export function mergeOpenCodeMcpConfig(existing, entry) {
    return {
        ...existing,
        mcp: {
            ...(existing.mcp || {}),
            gramatr: entry,
        },
    };
}
export function buildGeminiExtensionManifest(home, serverUrl) {
    return {
        name: 'gramatr',
        version: '1.0.0',
        description: 'gramatr intelligence layer for Gemini CLI via local MCP runtime',
        mcpServers: {
            gramatr: {
                ...buildLocalMcpServerEntry(home, serverUrl),
                timeout: 30000,
            },
        },
    };
}
export function getOpenCodePluginPath(home) {
    return join(home, '.config', 'opencode', 'plugins', 'gramatr.ts');
}
export function buildOpenCodePlugin() {
    return `/**
 * gramatr OpenCode Plugin — Deployed Implementation
 *
 * This is the deployed plugin written to ~/.config/opencode/plugins/gramatr.ts
 * by \`gramatr setup opencode\`. It maps OpenCode's plugin lifecycle events to
 * gramatr hook invocations using the canonical \`gramatr-hook\` shell wrapper at
 * ~/.gramatr/bin/gramatr-hook (resolves gramatr binary → global > local > npx).
 *
 * Do NOT use Bun's $ API or npx directly — always invoke via gramatr-hook.
 */

import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { Plugin } from '@opencode-ai/plugin';

const GRAMATR_DIR = process.env['GRAMATR_DIR'] ?? \`\${homedir()}/.gramatr\`;
const HOOK_BIN = \`\${GRAMATR_DIR}/bin/gramatr-hook\`;

function hook(name: string, stdinPayload: Record<string, unknown>): string {
  try {
    const result = execSync(\`\${HOOK_BIN} \${name} --opencode\`, {
      input: JSON.stringify(stdinPayload),
      env: { ...process.env, GRAMATR_DIR },
      timeout: 15_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.toString().trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(\`[gramatr] hook \${name} error: \${msg}\\n\`);
    return '';
  }
}

function parseJson(raw: string): Record<string, unknown> | null {
  if (!raw || raw === '{}') return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const GramatrPlugin: Plugin = async ({ project, client, directory }) => {
  let sessionId = 'unknown';
  const seenMessageIds = new Set<string>();

  return {
    'session.created': async (event) => {
      const evtSessionId = (event as { sessionId?: string }).sessionId ?? 'unknown';
      sessionId = evtSessionId;
      const stdout = hook('session-start', {
        session_id: sessionId,
        project_dir: (project as { dir?: string } | undefined)?.dir ?? directory ?? '',
      });
      if (stdout && stdout !== '{}') {
        try {
          await (client as {
            session: {
              prompt: (opts: {
                path: { id: string };
                body: { noReply: boolean; parts: Array<{ type: string; text: string }> };
              }) => Promise<unknown>;
            };
          }).session.prompt({
            path: { id: sessionId },
            body: { noReply: true, parts: [{ type: 'text', text: stdout }] },
          });
        } catch {
          process.stderr.write('[gramatr] session.created injection failed\\n');
        }
      }
    },

    'message.updated': async (event) => {
      const evt = event as {
        properties?: { role?: string; id?: string; parts?: Array<{ type: string; text?: string }> };
      };
      if (evt.properties?.role !== 'user') return;
      const msgId = evt.properties?.id;
      if (msgId) {
        if (seenMessageIds.has(msgId)) return;
        seenMessageIds.add(msgId);
      }
      const parts = evt.properties?.parts ?? [];
      const messageText = parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('\\n').trim();
      if (!messageText) return;
      const stdout = hook('user-prompt-submit', { prompt: messageText, session_id: sessionId });
      if (stdout && stdout !== '{}') {
        try {
          await (client as {
            session: {
              prompt: (opts: {
                path: { id: string };
                body: { noReply: boolean; parts: Array<{ type: string; text: string }> };
              }) => Promise<unknown>;
            };
          }).session.prompt({
            path: { id: sessionId },
            body: { noReply: true, parts: [{ type: 'text', text: stdout }] },
          });
        } catch {
          process.stderr.write('[gramatr] message.updated injection failed\\n');
        }
      }
    },

    'tool.execute.before': async (input, _output) => {
      const inp = input as { tool?: string; args?: Record<string, unknown> };
      const toolName = inp.tool ?? '';
      const toolInput = inp.args ?? {};
      const payload = { tool_name: toolName, tool_input: toolInput };
      const dispatch: string[] = [];
      if (toolName === 'bash' || toolName === 'shell') {
        dispatch.push('git-gate', 'input-validator');
      } else if (toolName === 'edit' || toolName === 'write') {
        dispatch.push('input-validator', 'edit-tracker');
      } else if (toolName === 'agent') {
        dispatch.push('agent-gate');
      } else if (toolName.includes('gramatr')) {
        dispatch.push('input-validator');
      }
      for (const hookName of dispatch) {
        const stdout = hook(hookName, payload);
        const parsed = parseJson(stdout);
        if (parsed?.decision === 'block') {
          const reason = typeof parsed.reason === 'string' ? parsed.reason : \`Blocked by \${hookName}\`;
          // gramatr-allow: B1 — deployed plugin file, no @gramatr/core dependency
          throw new Error(reason);
        }
      }
    },

    'tool.execute.after': async (input, output) => {
      const inp = input as { tool?: string; args?: Record<string, unknown> };
      const toolName = inp.tool ?? '';
      const payload = { tool_name: toolName, tool_input: inp.args ?? {}, tool_output: output };
      if (toolName === 'agent') {
        hook('agent-verify', payload);
      } else if (toolName.includes('gramatr')) {
        hook('tool-tracker', payload);
      }
    },

    'session.idle': async (_event) => {
      const payload = { session_id: sessionId };
      hook('stop', payload);
      hook('session-end', payload);
    },

    'session.compacted': async (_event) => {
      hook('compact', { session_id: sessionId });
    },

    'experimental.session.compacting': async (_input, output) => {
      const out = output as { context?: string };
      const continuationBlock = [
        '',
        '## gramatr session continuity',
        'Preserve the following gramatr state across this compaction:',
        '- Active session ID and project_id (do not reset)',
        '- Open tasks and their statuses (open/in_progress/blocked/review)',
        '- Recent decisions and their rationale',
        '- Classification feedback state for the current session',
        '- Any pending Quality Gate criteria not yet verified',
        'Resume the gramatr intelligence contract (gmtr.intelligence.contract.v2) on the next turn.',
      ].join('\\n');
      if (typeof out.context === 'string') {
        out.context += continuationBlock;
      } else {
        out.context = continuationBlock;
      }
    },
  };
};
`;
}
export function buildGeminiHooksFile(_home, _platform = process.platform) {
    const { command, args } = resolveBinaryPath();
    const hookBase = args.length > 0 ? 'npx -y @gramatr/mcp hook' : `${command} hook`;
    return {
        hooks: {
            SessionStart: [
                {
                    hooks: [
                        {
                            type: 'command',
                            command: `${hookBase} session-start --gemini`,
                            name: 'gramatr-session-start',
                            timeout: 15,
                            description: 'Load gramatr session context and handoff',
                        },
                    ],
                },
            ],
            BeforeAgent: [
                {
                    hooks: [
                        {
                            type: 'command',
                            command: `${hookBase} user-prompt-submit --gemini`,
                            name: 'gramatr-prompt-routing',
                            timeout: 15,
                            description: 'Route prompt through gramatr intelligence',
                        },
                    ],
                },
            ],
            SessionEnd: [
                {
                    hooks: [
                        {
                            type: 'command',
                            command: `${hookBase} stop --gemini`,
                            name: 'gramatr-session-end',
                            timeout: 10,
                            description: 'Submit classification feedback to gramatr',
                        },
                    ],
                },
            ],
        },
    };
}
//# sourceMappingURL=targets.js.map