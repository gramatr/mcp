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
export const PRIVILEGE_MODES = ['user', 'team', 'org', 'admin'];
/**
 * Numeric rank for each mode — higher number means broader access.
 */
const MODE_RANK = {
    user: 0,
    team: 1,
    org: 2,
    admin: 3,
};
// ── Session-scoped mode singleton ──────────────────────────────────────────
// Default: 'user'. CLI --mode flag or set_mode tool can elevate within the session.
// Never written to disk — restarts always begin at 'user' (or CLI-specified level).
let _currentMode = 'user';
export function getCurrentMode() {
    return _currentMode;
}
export function setCurrentMode(mode) {
    _currentMode = mode;
}
/**
 * Reset mode to default (user). Called in tests to prevent cross-test pollution.
 */
export function resetMode() {
    _currentMode = 'user';
}
// ── Static privilege map ───────────────────────────────────────────────────
// Conservative default: anything that touches audit trails, API keys, org-level
// administration, or billing lands in admin/org tier. Everything else is user.
//
// Pattern-based classification (checked in order):
//   - Name contains: audit, api_key, revoke → admin
//   - Name contains: aggregate_stats, export_entity_bundle, change_embedding_model,
//                    onboard_user → admin
//   - Name contains: org, billing, member → org
//   - Name contains: team → team
//   - All others → user
const ADMIN_PATTERNS = [
    /audit/i,
    /api_key/i,
    /revoke/i,
    /aggregate_stats/i,
    /export_entity_bundle/i,
    /change_embedding_model/i,
    /onboard_user/i,
];
const ORG_PATTERNS = [
    /org/i,
    /billing/i,
    /member/i,
];
const TEAM_PATTERNS = [
    /team/i,
];
/**
 * Classify a remote tool name into its minimum required privilege tier.
 * Local tools (local_*) are not classified here — they bypass the filter.
 */
export function classifyToolPrivilege(toolName) {
    for (const pattern of ADMIN_PATTERNS) {
        if (pattern.test(toolName))
            return 'admin';
    }
    for (const pattern of ORG_PATTERNS) {
        if (pattern.test(toolName))
            return 'org';
    }
    for (const pattern of TEAM_PATTERNS) {
        if (pattern.test(toolName))
            return 'team';
    }
    return 'user';
}
/**
 * Determine whether a tool should be exposed under the given mode.
 *
 * Rules:
 *  - Local tools (local_* prefix) are always exposed.
 *  - A remote tool is exposed when its privilege tier rank ≤ current mode rank.
 */
export function isToolAllowedInMode(toolName, mode) {
    // Local tools bypass privilege filtering — always visible.
    if (toolName.startsWith('local_'))
        return true;
    const required = classifyToolPrivilege(toolName);
    return MODE_RANK[required] <= MODE_RANK[mode];
}
/**
 * Filter a list of tool definitions to those allowed under the given mode.
 * Local tools (as determined by their names) are always kept.
 */
export function filterToolsByMode(tools, mode) {
    return tools.filter((t) => isToolAllowedInMode(t.name, mode));
}
/**
 * Validate a string value as a PrivilegeMode.
 */
export function isValidMode(value) {
    return typeof value === 'string' && PRIVILEGE_MODES.includes(value);
}
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
export function privilegeModeFromEntitlement(actorRole, entitlementLevel) {
    if (actorRole === 'high_admin')
        return 'org';
    if (actorRole === 'org_admin' || entitlementLevel === 'enterprise')
        return 'org';
    if (actorRole === 'team_admin' || entitlementLevel === 'team')
        return 'team';
    return 'user';
}
//# sourceMappingURL=tool-privilege.js.map