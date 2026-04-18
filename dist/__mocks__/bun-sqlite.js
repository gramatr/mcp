/**
 * bun-sqlite.ts — Vitest compatibility shim for bun:sqlite.
 *
 * In production, hook-state.ts imports from 'bun:sqlite' and runs inside the
 * compiled Bun binary. In the Node/vitest test environment, 'bun:sqlite' is
 * unavailable. This shim maps the bun:sqlite API surface to better-sqlite3
 * so the 54 test files can keep running under Node without changes.
 *
 * Key differences handled here:
 * - bun:sqlite named params require @-prefixed keys ({ '@session_id': val });
 *   better-sqlite3 requires plain keys ({ session_id: val }). Shim strips the prefix.
 * - bun:sqlite positional params are passed as individual args or an array.
 *   better-sqlite3 accepts the same. Scalars pass through unchanged.
 * - bun:sqlite .run() returns void; changes() must be queried via SELECT changes().
 *   better-sqlite3 returns a RunResult with .changes — handled transparently.
 */
import BetterSqlite3 from 'better-sqlite3';
function normaliseParams(params) {
    if (params === undefined || params === null)
        return undefined;
    if (Array.isArray(params))
        return params;
    if (typeof params !== 'object')
        return [params]; // scalar → positional array
    // Named param object: strip @, $, : prefix from each key
    return Object.fromEntries(Object.entries(params).map(([k, v]) => [k.replace(/^[@$:]/, ''), v]));
}
class Statement {
    stmt;
    constructor(stmt) {
        this.stmt = stmt;
    }
    run(...args) {
        const params = args.length === 0 ? undefined : args.length === 1 ? normaliseParams(args[0]) : args;
        if (params === undefined) {
            this.stmt.run();
        }
        else if (Array.isArray(params)) {
            this.stmt.run(...params);
        }
        else {
            this.stmt.run(params);
        }
    }
    get(...args) {
        const params = args.length === 0 ? undefined : args.length === 1 ? normaliseParams(args[0]) : args;
        let result;
        if (params === undefined) {
            result = this.stmt.get();
        }
        else if (Array.isArray(params)) {
            result = this.stmt.get(...params);
        }
        else {
            result = this.stmt.get(params);
        }
        return (result ?? null);
    }
    all(...args) {
        const params = args.length === 0 ? undefined : args.length === 1 ? normaliseParams(args[0]) : args;
        let result;
        if (params === undefined) {
            result = this.stmt.all();
        }
        else if (Array.isArray(params)) {
            result = this.stmt.all(...params);
        }
        else {
            result = this.stmt.all(params);
        }
        return result;
    }
}
export class Database {
    db;
    constructor(path) {
        this.db = new BetterSqlite3(path);
    }
    exec(sql) {
        this.db.exec(sql);
    }
    query(sql) {
        return new Statement(this.db.prepare(sql));
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=bun-sqlite.js.map