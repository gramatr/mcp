import { join } from 'node:path';
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
export function getGeminiExtensionDir(home) {
    return join(home, '.gemini', 'extensions', 'gramatr');
}
export function getGeminiHooksPath(home) {
    return join(getGeminiExtensionDir(home), 'hooks', 'hooks.json');
}
export function getGeminiManifestPath(home) {
    return join(getGeminiExtensionDir(home), 'gemini-extension.json');
}
export function buildLocalMcpServerEntry(home, serverUrl, platform = process.platform) {
    const binaryName = platform === 'win32' ? 'gramatr.exe' : 'gramatr';
    return {
        command: join(home, '.gramatr', 'bin', binaryName),
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
export function buildGeminiHooksFile(home, platform = process.platform) {
    const binaryName = platform === 'win32' ? 'gramatr.exe' : 'gramatr';
    const hookBase = `"${join(home, '.gramatr', 'bin', binaryName)}" hook`;
    return {
        hooks: {
            SessionStart: [
                {
                    hooks: [
                        {
                            type: 'command',
                            command: `${hookBase} session-start`,
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
                            command: `${hookBase} user-prompt-submit`,
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
                            command: `${hookBase} stop`,
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