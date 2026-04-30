#!/usr/bin/env node
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getGramatrDirFromEnv, getHomeDir } from '../config-runtime.js';
function gmtrJsonPath() {
    return join(getHomeDir(), '.gramatr.json');
}
function legacySettingsPath() {
    const gmtrDir = getGramatrDirFromEnv() || join(getHomeDir(), '.gramatr');
    return join(gmtrDir, 'settings.json');
}
function log(msg = '') {
    process.stdout.write(`${msg}\n`);
}
function showHelp() {
    log(`gramatr clear-creds — Remove every stored gramatr credential

Usage:
  gramatr clear-creds`);
}
export function clearAll() {
    const result = {
        removedGmtrJson: false,
        removedSettingsJson: false,
        envVarsSet: [],
    };
    if (existsSync(gmtrJsonPath())) {
        unlinkSync(gmtrJsonPath());
        result.removedGmtrJson = true;
    }
    if (existsSync(legacySettingsPath())) {
        try {
            unlinkSync(legacySettingsPath());
            result.removedSettingsJson = true;
        }
        catch { }
    }
    for (const v of ['GRAMATR_API_KEY', 'GRAMATR_TOKEN']) {
        if (process.env[v])
            result.envVarsSet.push(v);
    }
    return result;
}
export function main(argv = process.argv.slice(2)) {
    const raw = argv[0] === 'clear-creds' ? argv.slice(1) : argv;
    if (raw.includes('--help') || raw.includes('-h')) {
        showHelp();
        return 0;
    }
    const r = clearAll();
    if (!r.removedGmtrJson && !r.removedSettingsJson && r.envVarsSet.length === 0) {
        log('No stored credentials found. Already fully cleared.');
        return 0;
    }
    if (r.removedGmtrJson)
        log(`Removed ${gmtrJsonPath()}`);
    if (r.removedSettingsJson)
        log(`Removed ${legacySettingsPath()}`);
    if (r.envVarsSet.length > 0) {
        log('');
        log('WARNING: env vars are still set in your shell:');
        for (const v of r.envVarsSet)
            log(`  ${v}`);
        return 0;
    }
    log('');
    log("All credentials cleared. Next 'gramatr login' will re-authenticate.");
    return 0;
}
const invokedAs = process.argv[1] || '';
const isMain = import.meta.url === `file://${invokedAs}` ||
    invokedAs.endsWith('clear-creds.ts') ||
    invokedAs.endsWith('clear-creds.js');
if (isMain) {
    process.exit(main());
}
//# sourceMappingURL=clear-creds.js.map