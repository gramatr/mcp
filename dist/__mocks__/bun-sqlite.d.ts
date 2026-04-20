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
import { StatementSync } from "node:sqlite";
type ScalarParam = string | number | bigint | boolean | null | undefined;
type Params = Record<string, ScalarParam> | ScalarParam[] | ScalarParam;
declare class Statement<T = unknown> {
    private stmt;
    constructor(stmt: StatementSync);
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