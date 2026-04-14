#!/usr/bin/env node
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGramatrUrlFromEnv } from '../config-runtime.js';
const currentFile = fileURLToPath(import.meta.url);
const binDir = dirname(currentFile);
const packageDir = dirname(dirname(binDir));
const repoRoot = dirname(dirname(packageDir));
function readPackageJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}
function readPackageVersion() {
    try {
        const pkgPath = join(packageDir, 'package.json');
        const pkg = readPackageJson(pkgPath);
        return pkg.version || '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
export function buildManifest(version) {
    const mcpUrl = getGramatrUrlFromEnv() || 'https://api.gramatr.com/mcp';
    const baseUrl = mcpUrl.replace(/\/mcp\/?$/, '');
    return {
        manifest_version: '0.3',
        name: 'gramatr',
        display_name: 'gramatr',
        version,
        description: 'gramatr local MCP runtime for Claude Desktop with hosted intelligence proxying.',
        long_description: [
            'gramatr runs locally inside Claude Desktop and proxies authenticated requests to the hosted gramatr intelligence layer.',
            'This keeps tool validation and local runtime isolation in the desktop extension while minimizing prompt overhead.',
        ].join('\n'),
        author: { name: 'gramatr', url: 'https://gramatr.com' },
        homepage: 'https://gramatr.com',
        documentation: `${baseUrl}/.well-known/mcp/server-card.json`,
        repository: { type: 'git', url: 'https://github.com/gramatr/gramatr' },
        license: 'SEE LICENSE IN LICENSE',
        keywords: ['ai', 'mcp', 'routing', 'memory', 'gramatr', 'claude-desktop'],
        icon: 'icon.png',
        server: {
            type: 'binary',
            entry_point: 'bin/gramatr',
            mcp_config: {
                command: '${__dirname}/bin/gramatr',
                args: [],
                env: {
                    GRAMATR_API_KEY: '${user_config.api_key}',
                    GRAMATR_URL: mcpUrl,
                },
            },
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
        compatibility: {
            claude_desktop: '>=1.0.0',
            platforms: ['darwin', 'win32'],
        },
        privacy_policies: ['https://gramatr.com/privacy'],
        tools_generated: true,
        prompts_generated: true,
    };
}
function ensureDir(path) {
    mkdirSync(path, { recursive: true });
}
function writeManifest(bundleDir, manifest) {
    writeFileSync(join(bundleDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
function copyRuntimeFiles(bundleDir) {
    const binDestDir = join(bundleDir, 'bin');
    ensureDir(binDestDir);
    const binaryName = process.platform === 'win32' ? 'gramatr.exe' : 'gramatr';
    const binarySrc = join(packageDir, 'dist', binaryName);
    const binaryDest = join(binDestDir, binaryName);
    copyFileSync(binarySrc, binaryDest);
    if (process.platform !== 'win32') {
        chmodSync(binaryDest, 0o755);
    }
    const licensePath = join(repoRoot, 'LICENSE');
    if (existsSync(licensePath)) {
        copyFileSync(licensePath, join(bundleDir, 'LICENSE'));
    }
    const iconPath = join(repoRoot, 'packages', 'mcp-server', 'assets', 'logo.png');
    if (existsSync(iconPath)) {
        copyFileSync(iconPath, join(bundleDir, 'icon.png'));
    }
}
function buildArchive(bundleDir, archivePath) {
    rmSync(archivePath, { force: true });
    if (process.platform === 'win32') {
        execFileSync('powershell.exe', [
            '-NoProfile',
            '-Command',
            `Compress-Archive -Path * -DestinationPath '${archivePath.replace(/'/g, "''")}' -Force`,
        ], { cwd: bundleDir, stdio: 'inherit' });
        return;
    }
    // Use store mode (-0) to avoid CPU-heavy compression on the bundled binary.
    // This keeps packaging fast and predictable in CI while still producing a valid .zip/.mcpb.
    execFileSync('zip', ['-q', '-0', '-r', archivePath, '.'], { cwd: bundleDir, stdio: 'inherit' });
}
export function buildMcpb(outDir, version) {
    const manifest = buildManifest(version);
    const stagingDir = join(outDir, 'gramatr.mcpb.contents');
    const archivePath = join(outDir, 'gramatr.mcpb');
    rmSync(stagingDir, { recursive: true, force: true });
    ensureDir(stagingDir);
    writeManifest(stagingDir, manifest);
    copyRuntimeFiles(stagingDir);
    buildArchive(stagingDir, archivePath);
    return { bundleDir: stagingDir, archivePath, manifest };
}
function main() {
    const args = process.argv.slice(2);
    const normalized = args[0] === 'build-mcpb' ? args.slice(1) : args;
    const outIndex = normalized.indexOf('--out');
    const outDir = outIndex >= 0 && normalized[outIndex + 1] ? resolve(normalized[outIndex + 1]) : join(repoRoot, 'dist');
    ensureDir(outDir);
    const version = readPackageVersion();
    const result = buildMcpb(outDir, version);
    process.stdout.write('OK Built .mcpb package\n');
    process.stdout.write(`   Archive:  ${result.archivePath}\n`);
    process.stdout.write(`   Staging:  ${result.bundleDir}\n`);
    process.stdout.write(`   Version:  ${version}\n`);
    process.stdout.write(`   Entry:    ${result.manifest.server.entry_point}\n`);
}
const invokedAsScript = process.argv[1] ? resolve(process.argv[1]) === currentFile : false;
if (invokedAsScript) {
    main();
}
//# sourceMappingURL=build-mcpb.js.map