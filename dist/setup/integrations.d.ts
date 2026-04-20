export interface InstallHookCommand {
    type: 'command';
    command: string;
    statusMessage?: string;
    timeout?: number;
}
export interface InstallHookMatcherEntry {
    matcher?: string;
    hooks: InstallHookCommand[];
}
export interface InstallHooksFile {
    hooks: Record<string, InstallHookMatcherEntry[]>;
}
export declare const MCP_HOOK_BIN_RELATIVE = "bin/gramatr";
export declare function buildClaudeHooksFile(clientDir: string): InstallHooksFile;
export declare function buildPluginHooksJson(): Record<string, unknown>;
export declare function buildCodexHooksFile(clientDir: string): InstallHooksFile;
export declare function mergeManagedHooks(existing: InstallHooksFile | Record<string, unknown>, managed: InstallHooksFile): InstallHooksFile;
export declare function ensureCodexHooksFeature(configToml: string): string;
export declare function buildClaudeMcpServerEntry(): {
    command: string;
    args?: string[];
};
//# sourceMappingURL=integrations.d.ts.map