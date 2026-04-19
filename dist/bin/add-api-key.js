#!/usr/bin/env node
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { getHomeDir, getGramatrUrlFromEnv } from '../config-runtime.js';
export function gmtrJsonPath() {
    return join(getHomeDir(), '.gramatr.json');
}
const SERVER_BASE = (getGramatrUrlFromEnv() || 'https://api.gramatr.com').replace(/\/mcp\/?$/, '');
const KEY_FORMAT = /^(gramatr|gmtr|aios)_(sk|pk)_[A-Za-z0-9_-]+$/;
const LEGACY_OPAQUE = /^[A-Za-z0-9_.-]{32,}$/;
export function log(msg = '') {
    process.stdout.write(`${msg}\n`);
}
export function err(msg) {
    process.stderr.write(`${msg}\n`);
}
export function parseArgs(argv) {
    let fromEnv;
    let force = false;
    let help = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--from-env')
            fromEnv = argv[++i];
        else if (a === '--force')
            force = true;
        else if (a === '--help' || a === '-h')
            help = true;
    }
    return { fromEnv, force, help };
}
export function showHelp() {
    log(`gramatr-mcp add-api-key — Add a gramatr API key to ~/.gramatr.json

Usage:
  gramatr-mcp add-api-key
  echo "gramatr_sk_..." | gramatr-mcp add-api-key
  gramatr-mcp add-api-key --from-env VAR
  gramatr-mcp add-api-key --force

Server: ${SERVER_BASE}`);
}
export function validateFormat(key) {
    return KEY_FORMAT.test(key) || (LEGACY_OPAQUE.test(key) && !key.includes(' '));
}
export async function readPipedStdin() {
    if (process.stdin.isTTY)
        return null;
    return new Promise((resolve) => {
        const chunks = [];
        process.stdin.on('data', (c) => chunks.push(Buffer.from(c)));
        process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim() || null));
        process.stdin.on('error', () => resolve(null));
    });
}
export async function readInteractive() {
    log('');
    log('Paste your gramatr API key below.');
    log('(keys usually start with gramatr_sk_)');
    log('');
    process.stdout.write('  Key: ');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.on('line', (line) => {
            rl.close();
            resolve(line.trim());
        });
    });
}
export async function validateAgainstServer(key) {
    try {
        const res = await fetch(`${SERVER_BASE}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: { name: 'aggregate_stats', arguments: {} },
            }),
            signal: AbortSignal.timeout(10000),
        });
        const text = await res.text();
        if (res.status === 401 || res.status === 403)
            return false;
        if (text.includes('JWT token is required') ||
            text.includes('signature validation failed') ||
            text.includes('Unauthorized')) {
            return false;
        }
        return res.ok;
    }
    catch {
        return false;
    }
}
export function writeKey(key) {
    let existing = {};
    if (existsSync(gmtrJsonPath())) {
        try {
            existing = JSON.parse(readFileSync(gmtrJsonPath(), 'utf8'));
        }
        catch { }
    }
    existing.token = key;
    existing.token_type = /^[a-z]+_(?:sk|pk)_/i.test(key) ? 'api_key' : 'oauth';
    existing.authenticated_at = new Date().toISOString();
    writeFileSync(gmtrJsonPath(), `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
    try {
        chmodSync(gmtrJsonPath(), 0o600);
    }
    catch { }
}
export async function main(argv = process.argv.slice(2)) {
    const raw = argv[0] === 'add-api-key' ? argv.slice(1) : argv;
    const opts = parseArgs(raw);
    if (opts.help) {
        showHelp();
        return 0;
    }
    let key = null;
    if (opts.fromEnv) {
        const v = process.env[opts.fromEnv];
        if (!v || !v.trim()) {
            err(`ERROR: env var ${opts.fromEnv} is unset or empty`);
            return 1;
        }
        key = v.trim();
    }
    if (!key)
        key = await readPipedStdin();
    if (!key && process.stdin.isTTY)
        key = (await readInteractive()).trim();
    if (!key) {
        err('ERROR: no API key provided. See `gramatr-mcp add-api-key --help`.');
        return 1;
    }
    if (!validateFormat(key)) {
        err('ERROR: key format is invalid.');
        return 1;
    }
    if (!opts.force) {
        const valid = await validateAgainstServer(key);
        if (!valid) {
            err(`ERROR: server rejected key. Re-run with --force only if you're offline.`);
            return 1;
        }
    }
    writeKey(key);
    log(`Saved API key to ${gmtrJsonPath()}`);
    return 0;
}
const invokedAs = process.argv[1] || '';
const isMain = import.meta.url === `file://${invokedAs}` ||
    invokedAs.endsWith('add-api-key.ts') ||
    invokedAs.endsWith('add-api-key.js');
if (isMain) {
    main().then((code) => process.exit(code)).catch((e) => {
        err(e instanceof Error ? e.message : String(e));
        process.exit(1);
    });
}
//# sourceMappingURL=add-api-key.js.map