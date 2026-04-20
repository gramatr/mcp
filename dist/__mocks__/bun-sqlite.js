/**
 * bun-sqlite.ts — Vitest compatibility shim for bun:sqlite.
 *
 * In production, hook-state.ts imports from 'bun:sqlite' and runs inside the
 * compiled Bun binary. In the Node/vitest test environment, 'bun:sqlite' is
 * unavailable. This shim maps the bun:sqlite API surface to node:sqlite
 * (built-in since Node 22.5) so the hook-state tests can run under Node.
 *
 * Key differences handled here:
 * - bun:sqlite named params use @-prefixed keys ({ '@session_id': val });
 *   node:sqlite accepts both prefixed and plain keys — we strip the prefix
 *   to be explicit and avoid ambiguity.
 * - bun:sqlite .query() compiles a statement; node:sqlite uses .prepare().
 * - bun:sqlite positional params are individual args; node:sqlite same.
 */
import { DatabaseSync } from "node:sqlite";
function normaliseParams(params) {
    if (params === undefined || params === null)
        return undefined;
    if (Array.isArray(params))
        return params;
    if (typeof params !== "object")
        return [params]; // scalar → positional array
    // Named param object: strip @, $, : prefix from each key
    return Object.fromEntries(Object.entries(params).map(([k, v]) => [
        k.replace(/^[@$:]/, ""),
        v,
    ]));
}
class Statement {
    stmt;
    constructor(stmt) {
        this.stmt = stmt;
    }
    run(...args) {
        const params = args.length === 0
            ? undefined
            : args.length === 1
                ? normaliseParams(args[0])
                : args;
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
        const params = args.length === 0
            ? undefined
            : args.length === 1
                ? normaliseParams(args[0])
                : args;
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
        const params = args.length === 0
            ? undefined
            : args.length === 1
                ? normaliseParams(args[0])
                : args;
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
        this.db = new DatabaseSync(path);
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