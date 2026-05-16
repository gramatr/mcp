/**
 * setup-shared — Small shared utilities used across setup modules.
 */
/**
 * Returns the best available invocation for the gramatr server.
 * Prefers the globally installed binary (no network, no cache miss) over npx.
 * Falls back to npx only when the binary is not in PATH.
 */
export declare function resolveBinaryPath(): {
    command: string;
    args: string[];
};
export declare function deployPlatformBinary(_dryRun?: boolean): boolean;
/**
 * Write stable local wrappers for hook dispatch.
 *
 * Client configs should invoke `gramatr-hook ...` and rely on PATH resolution
 * to reach these wrappers under ~/.gramatr/bin.
 */
export declare function writeHookWrappers(gramatrDir: string): void;
//# sourceMappingURL=setup-shared.d.ts.map