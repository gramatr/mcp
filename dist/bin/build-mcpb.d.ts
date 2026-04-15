#!/usr/bin/env node
interface McpbManifest {
    manifest_version: string;
    name: string;
    display_name: string;
    version: string;
    description: string;
    long_description: string;
    author: {
        name: string;
        url: string;
    };
    homepage: string;
    documentation: string;
    repository: {
        type: string;
        url: string;
    };
    license: string;
    keywords: string[];
    icon?: string;
    server: {
        type: 'binary';
        entry_point: string;
        mcp_config: {
            command: string;
            args: string[];
            env: Record<string, string>;
        };
    };
    user_config: Record<string, {
        type: string;
        title: string;
        description: string;
        sensitive?: boolean;
        required: boolean;
    }>;
    compatibility: {
        claude_desktop: string;
        platforms: string[];
    };
    privacy_policies: string[];
    tools_generated: boolean;
    prompts_generated: boolean;
}
export declare function buildManifest(version: string): McpbManifest;
export declare function buildMcpb(outDir: string, version: string): {
    bundleDir: string;
    archivePath: string;
    manifest: McpbManifest;
};
export {};
//# sourceMappingURL=build-mcpb.d.ts.map