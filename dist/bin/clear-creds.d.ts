#!/usr/bin/env node
interface ClearResult {
    removedGmtrJson: boolean;
    strippedLegacyKey: boolean;
    envVarsSet: string[];
}
export declare function clearAll(): ClearResult;
export declare function main(argv?: string[]): number;
export {};
//# sourceMappingURL=clear-creds.d.ts.map