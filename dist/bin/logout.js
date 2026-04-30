#!/usr/bin/env node
import { existsSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getHomeDir } from '../config-runtime.js';
function gmtrJsonPath() {
    return join(getHomeDir(), '.gramatr.json');
}
function log(msg = '') {
    process.stdout.write(`${msg}\n`);
}
function parseArgs(argv) {
    let keepBackup = false;
    let help = false;
    for (const a of argv) {
        if (a === '--keep-backup')
            keepBackup = true;
        else if (a === '--help' || a === '-h')
            help = true;
    }
    return { keepBackup, help };
}
function showHelp() {
    log(`gramatr logout — Clear stored gramatr credentials

Usage:
  gramatr logout
  gramatr logout --keep-backup`);
}
export function main(argv = process.argv.slice(2)) {
    const raw = argv[0] === 'logout' ? argv.slice(1) : argv;
    const opts = parseArgs(raw);
    if (opts.help) {
        showHelp();
        return 0;
    }
    if (!existsSync(gmtrJsonPath())) {
        log('Not logged in.');
        return 0;
    }
    if (opts.keepBackup) {
        const backup = `${gmtrJsonPath()}.bak.${Date.now()}`;
        renameSync(gmtrJsonPath(), backup);
        log(`Logged out. Token moved to ${backup}.`);
        return 0;
    }
    unlinkSync(gmtrJsonPath());
    log(`Logged out. Token removed from ${gmtrJsonPath()}.`);
    return 0;
}
const invokedAs = process.argv[1] || '';
const isMain = import.meta.url === `file://${invokedAs}` ||
    invokedAs.endsWith('logout.ts') ||
    invokedAs.endsWith('logout.js');
if (isMain) {
    process.exit(main());
}
//# sourceMappingURL=logout.js.map