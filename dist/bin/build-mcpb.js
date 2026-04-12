#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getGramatrUrlFromEnv } from '../config-runtime.js';
const currentFile = fileURLToPath(import.meta.url);
const binDir = dirname(currentFile);
const packageDir = dirname(dirname(binDir));
const repoRoot = dirname(dirname(packageDir));
function readPackageVersion() {
    try {
        const pkgPath = join(packageDir, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        return pkg.version || '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
function buildManifest(version) {
    const mcpUrl = getGramatrUrlFromEnv() || 'https://api.gramatr.com/mcp';
    const baseUrl = mcpUrl.replace(/\/mcp\/?$/, '');
    return {
        manifest_version: '0.3',
        name: 'gramatr',
        display_name: 'gramatr',
        version,
        description: 'gramatr local MCP runtime and hosted intelligence integration for Claude Desktop.',
        long_description: [
            'gramatr provides decision routing, memory, and learning signals across supported AI tools.',
            'Claude Desktop connects through the gramatr MCP integration surface.',
        ].join('\n'),
        author: { name: 'gramatr', url: 'https://gramatr.com' },
        homepage: 'https://gramatr.com',
        documentation: `${baseUrl}/.well-known/mcp/server-card.json`,
        repository: { type: 'git', url: 'https://github.com/gramatr/gramatr' },
        license: 'SEE LICENSE IN LICENSE',
        keywords: ['ai', 'mcp', 'routing', 'memory', 'gramatr'],
        server: {
            type: 'remote',
            transport: 'streamable-http',
            url: mcpUrl,
        },
        user_config: {
            api_key: {
                type: 'string',
                title: 'API Key',
                description: 'Your gramatr API key. Get one at https://gramatr.com/settings',
                sensitive: true,
                required: true,
            },
        },
        compatibility: { claude_desktop: '>=1.0.0', platforms: ['darwin', 'win32'] },
        privacy_policies: ['https://gramatr.com/privacy'],
        tools_generated: true,
        prompts_generated: true,
    };
}
function main() {
    const args = process.argv.slice(2);
    const normalized = args[0] === 'build-mcpb' ? args.slice(1) : args;
    const outIndex = normalized.indexOf('--out');
    const outDir = outIndex >= 0 && normalized[outIndex + 1] ? normalized[outIndex + 1] : join(repoRoot, 'dist');
    const version = readPackageVersion();
    const manifest = buildManifest(version);
    const mcpbDir = join(outDir, 'gramatr.mcpb');
    if (!existsSync(mcpbDir))
        mkdirSync(mcpbDir, { recursive: true });
    const manifestPath = join(mcpbDir, 'manifest.json');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    process.stdout.write(`OK Built .mcpb package\n`);
    process.stdout.write(`   Manifest: ${manifestPath}\n`);
    process.stdout.write(`   Version:  ${version}\n`);
    process.stdout.write(`   Server:   ${manifest.server.url}\n`);
}
main();
//# sourceMappingURL=build-mcpb.js.map