export interface McpCommandServerEntry {
    command: string;
    args?: string[];
    env: Record<string, string>;
}
export interface McpJsonConfig {
    mcpServers?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface GeminiExtensionManifest {
    name: string;
    version: string;
    description: string;
    mcpServers?: Record<string, {
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        timeout?: number;
    }>;
}
export interface GeminiHooksFileHook {
    type: 'command';
    command: string;
    name?: string;
    timeout?: number;
    description?: string;
}
export interface GeminiHooksFileEntry {
    matcher?: string;
    sequential?: boolean;
    hooks: GeminiHooksFileHook[];
}
export interface GeminiHooksFile {
    hooks: Record<string, GeminiHooksFileEntry[]>;
}
export declare function getClaudeDesktopConfigPath(home: string, platform?: string): string;
export declare function getChatgptDesktopConfigPath(home: string, platform?: string): string;
export declare function getCursorConfigPath(home: string): string;
export declare function getWindsurfConfigPath(home: string): string;
export declare function getVscodeConfigPath(home: string): string;
export declare function getGeminiExtensionDir(home: string): string;
export declare function getGeminiHooksPath(home: string): string;
export declare function getGeminiManifestPath(home: string): string;
export declare function buildLocalMcpServerEntry(home: string, serverUrl: string): McpCommandServerEntry;
export declare function mergeMcpServerConfig(existing: McpJsonConfig, entry: McpCommandServerEntry): McpJsonConfig;
export declare function buildGeminiExtensionManifest(home: string, serverUrl: string): GeminiExtensionManifest;
export declare function buildGeminiHooksFile(home: string): GeminiHooksFile;
//# sourceMappingURL=targets.d.ts.map