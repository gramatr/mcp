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
type ScalarParam = string | number | bigint | boolean | null | undefined;
type Params = Record<string, ScalarParam> | ScalarParam[] | ScalarParam;
declare class Statement<T = unknown> {
    private stmt;
    constructor(stmt: BetterSqlite3.Statement);
    run(...args: Params[]): void;
    get(...args: Params[]): T | null;
    all(...args: Params[]): T[];
}
export declare class Database {
    private db;
    constructor(path: string);
    exec(sql: string): void;
    query<T = unknown>(sql: string): Statement<T>;
    close(): void;
}
export {};
//# sourceMappingURL=bun-sqlite.d.ts.map