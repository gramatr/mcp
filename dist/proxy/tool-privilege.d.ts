/**
 * Tool Privilege Modes — session-scoped role-based tool filtering.
 *
 * Privilege tiers (additive — each higher tier includes the tier below):
 *   user  — core memory, search, entity CRUD, session tools
 *   team  — user + team-scoped entity tools, shared playbooks
 *   org   — team + org admin tools (standards, benchmarks, member management)
 *   admin — full set — all tools including audit, API key admin, billing-adjacent ops
 *
 * Local tools (local_* prefix) are always exposed regardless of mode.
 * Mode is session-scoped in-memory state — never persisted to disk.
 */
export type PrivilegeMode = 'user' | 'team' | 'org' | 'admin';
export declare const PRIVILEGE_MODES: PrivilegeMode[];
export declare function getCurrentMode(): PrivilegeMode;
export declare function setCurrentMode(mode: PrivilegeMode): void;
/**
 * Reset mode to default (user). Called in tests to prevent cross-test pollution.
 */
export declare function resetMode(): void;
/**
 * Classify a remote tool name into its minimum required privilege tier.
 * Local tools (local_*) are not classified here — they bypass the filter.
 */
export declare function classifyToolPrivilege(toolName: string): PrivilegeMode;
/**
 * Determine whether a tool should be exposed under the given mode.
 *
 * Rules:
 *  - Local tools (local_* prefix) are always exposed.
 *  - A remote tool is exposed when its privilege tier rank ≤ current mode rank.
 */
export declare function isToolAllowedInMode(toolName: string, mode: PrivilegeMode): boolean;
/**
 * Filter a list of tool definitions to those allowed under the given mode.
 * Local tools (as determined by their names) are always kept.
 */
export declare function filterToolsByMode<T extends {
    name: string;
}>(tools: T[], mode: PrivilegeMode): T[];
/**
 * Validate a string value as a PrivilegeMode.
 */
export declare function isValidMode(value: unknown): value is PrivilegeMode;
/**
 * Derive the default privilege mode from the user's entitlement.
 *
 * Mapping (from #1705 spec):
 *   high_admin                              → org  (can elevate to admin via set_mode)
 *   org_admin | enterprise entitlement      → org
 *   team_admin | team entitlement           → team
 *   everything else                         → user
 *
 * Note: high_admin defaults to 'org' (not 'admin') — elevation to admin requires an
 * explicit local_set_mode call that is itself guarded by the high_admin check.
 */
export declare function privilegeModeFromEntitlement(actorRole: string, entitlementLevel: string): PrivilegeMode;
//# sourceMappingURL=tool-privilege.d.ts.map