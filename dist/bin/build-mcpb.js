#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { getGramatrUrlFromEnv } from '../config-runtime.js';
const currentFile = fileURLToPath(import.meta.url);
const binDir = dirname(currentFile);
const packageDir = dirname(dirname(binDir));
const repoRoot = dirname(dirname(packageDir));
const require = createRequire(import.meta.url);
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
            type: 'node',
            entry_point: 'dist/bin/gramatr-mcp.js',
            mcp_config: {
                command: 'node',
                args: ['${__dirname}/dist/bin/gramatr-mcp.js'],
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
            runtimes: { node: '>=20.0.0' },
        },
        privacy_policies: ['https://gramatr.com/privacy'],
        tools_generated: true,
        prompts_generated: true,
    };
}
function ensureDir(path) {
    mkdirSync(path, { recursive: true });
}
function resolvePackageRoot(packageName) {
    return realpathSync(join(repoRoot, 'node_modules', ...packageName.split('/')));
}
function copyPackageRecursive(packageName, nodeModulesDir, seen = new Set()) {
    if (seen.has(packageName))
        return;
    seen.add(packageName);
    const packageRoot = resolvePackageRoot(packageName);
    const packageJson = readPackageJson(join(packageRoot, 'package.json'));
    const destination = join(nodeModulesDir, ...packageName.split('/'));
    ensureDir(dirname(destination));
    cpSync(packageRoot, destination, { recursive: true });
    const dependencies = Object.keys(packageJson.dependencies || {});
    const peerDependencies = Object.entries(packageJson.peerDependencies || {})
        .filter(([name]) => !packageJson.peerDependenciesMeta?.[name]?.optional)
        .map(([name]) => name);
    for (const dependency of [...dependencies, ...peerDependencies]) {
        copyPackageRecursive(dependency, nodeModulesDir, seen);
    }
}
function writeRuntimePackageJson(bundleDir, version) {
    const runtimePackage = {
        name: 'gramatr-mcpb-runtime',
        version,
        private: true,
        type: 'module',
    };
    writeFileSync(join(bundleDir, 'package.json'), `${JSON.stringify(runtimePackage, null, 2)}\n`, 'utf8');
}
function writeManifest(bundleDir, manifest) {
    writeFileSync(join(bundleDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
function copyRuntimeFiles(bundleDir, version) {
    cpSync(join(packageDir, 'dist'), join(bundleDir, 'dist'), { recursive: true });
    copyPackageRecursive('@modelcontextprotocol/sdk', join(bundleDir, 'node_modules'));
    writeRuntimePackageJson(bundleDir, version);
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
    execFileSync('zip', ['-qr', archivePath, '.'], { cwd: bundleDir, stdio: 'inherit' });
}
export function buildMcpb(outDir, version) {
    const manifest = buildManifest(version);
    const stagingDir = join(outDir, 'gramatr.mcpb.contents');
    const archivePath = join(outDir, 'gramatr.mcpb');
    rmSync(stagingDir, { recursive: true, force: true });
    ensureDir(stagingDir);
    writeManifest(stagingDir, manifest);
    copyRuntimeFiles(stagingDir, version);
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
main();
//# sourceMappingURL=build-mcpb.js.map