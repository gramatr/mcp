/**
 * setup-shared — Small shared utilities used across setup modules.
 */
export function resolveBinaryPath() {
    return { command: 'npx', args: ['-y', '@gramatr/mcp'] };
}
export function deployPlatformBinary(_dryRun = false) {
    // No-op: hooks use `npx -y --prefer-offline @gramatr/mcp hook` so there is
    // nothing to deploy. The globally installed package is always current.
    return true;
}
//# sourceMappingURL=setup-shared.js.map