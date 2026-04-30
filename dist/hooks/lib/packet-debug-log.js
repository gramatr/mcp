/**
 * packet-debug-log.ts — Rolling debug log of raw gramatr packets.
 *
 * Writes one JSONL entry per UserPromptSubmit hook invocation to
 * ~/.gramatr/debug/packets.jsonl, keeping the last MAX_ENTRIES lines.
 * Also overwrites ~/.gramatr/debug/last-packet.json for quick inspection.
 *
 * Each entry captures: timestamp, project_id, session_id, client_type,
 * agent_name, downstream_model, status, elapsed_ms, and the full raw
 * packet (or error) from the backend.
 *
 * All I/O is synchronous and wrapped — a failure here must never surface
 * to the hook caller.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getHomeDir } from '../../config-runtime.js';
const MAX_ENTRIES = 100;
function debugDir() {
    const home = getHomeDir() || '/tmp';
    return join(home, '.gramatr', 'debug');
}
export function appendPacketDebugLog(entry) {
    try {
        const dir = debugDir();
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        const jsonlPath = join(dir, 'packets.jsonl');
        const lastPath = join(dir, 'last-packet.json');
        // Append to rolling JSONL, keep last MAX_ENTRIES lines
        const line = JSON.stringify(entry);
        let existing = [];
        if (existsSync(jsonlPath)) {
            existing = readFileSync(jsonlPath, 'utf8')
                .split('\n')
                .filter(l => l.trim().length > 0);
        }
        existing.push(line);
        if (existing.length > MAX_ENTRIES) {
            existing = existing.slice(existing.length - MAX_ENTRIES);
        }
        writeFileSync(jsonlPath, existing.join('\n') + '\n', 'utf8');
        // Always overwrite last-packet.json for quick access
        writeFileSync(lastPath, JSON.stringify(entry, null, 2), 'utf8');
    }
    catch {
        // Never surface debug I/O failures to the hook
    }
}
//# sourceMappingURL=packet-debug-log.js.map