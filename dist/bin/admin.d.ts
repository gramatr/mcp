/**
 * admin — CLI admin subcommands for gramatr user/org/team management.
 *
 * Calls the server REST API admin endpoints with local auth credentials.
 * All commands require super admin privileges.
 *
 * Usage:
 *   gramatr admin list-users
 *   gramatr admin user-detail <email>
 *   gramatr admin grant-access <email> [--org slug] [--team slug] [--role member]
 *   gramatr admin revoke-access <email> [--reason "..."]
 *   gramatr admin restore-access <email> [--restore-memberships]
 *   gramatr admin list-orgs
 *   gramatr admin list-teams [--org slug]
 *   gramatr admin assign-team <email> --org <slug> --team <slug> [--role member]
 *   gramatr admin create-org <name> --slug <slug>
 */
export declare function runAdmin(args: string[]): Promise<number>;
//# sourceMappingURL=admin.d.ts.map