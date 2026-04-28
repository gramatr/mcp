/**
 * admin — CLI admin subcommands for gramatr user/org/team management.
 *
 * Calls the server REST API admin endpoints with local auth credentials.
 * All commands require super admin privileges.
 *
 * Usage:
 *   gramatr-mcp admin list-users
 *   gramatr-mcp admin user-detail <email>
 *   gramatr-mcp admin grant-access <email> [--org slug] [--team slug] [--role member]
 *   gramatr-mcp admin revoke-access <email> [--reason "..."]
 *   gramatr-mcp admin restore-access <email> [--restore-memberships]
 *   gramatr-mcp admin list-orgs
 *   gramatr-mcp admin list-teams [--org slug]
 *   gramatr-mcp admin assign-team <email> --org <slug> --team <slug> [--role member]
 *   gramatr-mcp admin create-org <name> --slug <slug>
 */
export declare function runAdmin(args: string[]): Promise<number>;
//# sourceMappingURL=admin.d.ts.map