/**
 * setup-config-io — Config file reading/writing, path resolution, managed block helpers.
 *
 * Extracted from setup.ts for SRP: pure I/O utilities with no setup orchestration.
 */
declare const HOME: string;
export declare function getClaudeConfigPath(): string;
export declare function getClaudeSettingsPath(): string;
export declare function getCodexHooksPath(): string;
export declare function getCodexConfigPath(): string;
export declare function getClaudeMarkdownPath(): string;
export declare function getCodexAgentsPath(): string;
export declare function getGramatrSettingsPath(): string;
export declare function readJsonFile<T>(path: string, fallback: T): T;
/**
 * Read existing Claude config or return empty.
 */
export declare function readClaudeConfig(configPath: string): Record<string, unknown>;
export declare function escapeRegExp(text: string): string;
export declare function upsertManagedBlock(existing: string, content: string, startMarker: string, endMarker: string): string;
export declare function parseJson(path: string): Record<string, unknown> | null;
export declare function readManagedBlock(path: string, startMarker: string, endMarker: string): string | null;
export declare function ensureLocalSettings(): void;
export declare function hasHookCommand(config: Record<string, unknown> | null, eventName: string, needle: string): boolean;
export declare function getGramatrPluginDir(): string;
export declare function writeMarketplaceManifest(gramatrDir: string): void;
export declare function writePluginFiles(pluginDir: string, pluginJson: Record<string, unknown>, hooksJson: Record<string, unknown>, mcpJson: Record<string, unknown>): void;
export declare function removeGramatrHooks(settings: Record<string, unknown>): Record<string, unknown>;
export declare function addPluginRegistration(settings: Record<string, unknown>, gramatrDir: string): Record<string, unknown>;
export { HOME };
//# sourceMappingURL=setup-config-io.d.ts.map