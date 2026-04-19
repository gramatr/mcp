#!/usr/bin/env node
export declare function gmtrJsonPath(): string;
export declare function log(msg?: string): void;
export declare function err(msg: string): void;
export declare function parseArgs(argv: string[]): {
    fromEnv?: string;
    force: boolean;
    help: boolean;
};
export declare function showHelp(): void;
export declare function validateFormat(key: string): boolean;
export declare function readPipedStdin(): Promise<string | null>;
export declare function readInteractive(): Promise<string>;
export declare function validateAgainstServer(key: string): Promise<boolean>;
export declare function writeKey(key: string): void;
export declare function main(argv?: string[]): Promise<number>;
//# sourceMappingURL=add-api-key.d.ts.map