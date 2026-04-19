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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// ---- Error class -----------------------------------------------------------
class AdminCliError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AdminCliError';
    }
}
// ---- CLI env config (loaded once at startup) --------------------------------
// CLI binaries read process.env at init — this is the config boundary.
// gramatr-allow: c1
const HOME_DIR = process.env['HOME'] ||
    // gramatr-allow: c1
    process.env['USERPROFILE'] || '';
// gramatr-allow: c1
const SERVER_URL = process.env['GRAMATR_URL'] || 'https://api.gramatr.com/mcp';
// gramatr-allow: c1
const API_KEY_PRIMARY = process.env['GRAMATR_API_KEY'] || '';
// gramatr-allow: c1
const API_KEY_LEGACY = process.env['GMTR_API_KEY'] || '';
const API_KEY = API_KEY_PRIMARY || API_KEY_LEGACY;
const cliEnv = { home: HOME_DIR, serverUrl: SERVER_URL, apiKey: API_KEY };
// ---- Config helpers --------------------------------------------------------
function getServerBase() {
    return cliEnv.serverUrl.replace(/\/mcp\/?$/, '');
}
function readConfig() {
    const configPath = join(cliEnv.home, '.gramatr.json');
    try {
        return JSON.parse(readFileSync(configPath, 'utf8'));
    }
    catch {
        return {};
    }
}
function getAuthToken() {
    if (cliEnv.apiKey)
        return cliEnv.apiKey;
    const fileConfig = readConfig();
    if (fileConfig.token)
        return fileConfig.token;
    throw new AdminCliError('No auth token found. Run `gramatr-mcp login` or set GRAMATR_API_KEY.');
}
// ---- HTTP helpers ----------------------------------------------------------
async function adminFetch(method, path, body) {
    const token = getAuthToken();
    const url = `${getServerBase()}/api/v1${path}`;
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = payload?.error || `HTTP ${res.status} ${res.statusText}`;
        throw new AdminCliError(msg);
    }
    return payload;
}
// ---- Output helpers --------------------------------------------------------
function write(msg) {
    process.stdout.write(msg + '\n');
}
function writeTable(headers, rows, widths) {
    if (rows.length === 0) {
        write('  (no results)');
        return;
    }
    const colWidths = widths ||
        headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] || '').length)));
    const pad = (s, w) => s.padEnd(w);
    const header = headers.map((h, i) => pad(h, colWidths[i])).join('  ');
    const separator = colWidths.map((w) => '-'.repeat(w)).join('  ');
    write('');
    write(`  ${header}`);
    write(`  ${separator}`);
    for (const row of rows) {
        write(`  ${row.map((c, i) => pad(c || '', colWidths[i])).join('  ')}`);
    }
    write('');
}
function timeAgo(isoDate) {
    if (!isoDate)
        return 'never';
    const diff = Date.now() - new Date(isoDate).getTime();
    if (diff < 60_000)
        return 'just now';
    if (diff < 3_600_000)
        return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000)
        return `${Math.floor(diff / 3_600_000)} hr ago`;
    return `${Math.floor(diff / 86_400_000)} days ago`;
}
// ---- Arg parsing helpers ---------------------------------------------------
function getFlag(args, name) {
    const idx = args.indexOf(name);
    if (idx === -1 || idx + 1 >= args.length)
        return undefined;
    return args[idx + 1];
}
function hasFlag(args, name) {
    return args.includes(name);
}
function getPositional(args, position) {
    const positionals = [];
    let i = 0;
    while (i < args.length) {
        if (args[i].startsWith('--')) {
            i += 2; // skip flag + value
        }
        else {
            positionals.push(args[i]);
            i += 1;
        }
    }
    return positionals[position];
}
// ---- Commands --------------------------------------------------------------
async function listUsers() {
    const data = await adminFetch('GET', '/admin/users');
    const items = data.items || [];
    writeTable(['EMAIL', 'ADMIN', 'STATUS', 'ENTITIES', 'MEMBERSHIPS', 'LAST ACTIVE'], items.map((u) => [
        u.email,
        u.is_admin ? 'yes' : '',
        u.access_status,
        String(u.entity_count),
        String(u.membership_count),
        timeAgo(u.last_active_at),
    ]));
    write(`  Total: ${data.total} users`);
}
async function userDetail(email) {
    const data = await adminFetch('GET', `/admin/users/${encodeURIComponent(email)}`);
    write('');
    write(`  User: ${data.email}${data.is_admin ? ' (admin)' : ''}`);
    if (data.access_grant) {
        write(`  Access: ${data.access_grant.status} (since ${data.access_grant.granted_at || 'unknown'}, granted by ${data.access_grant.granted_by})`);
    }
    else {
        write('  Access: none');
    }
    if (data.memberships?.length > 0) {
        write('  Memberships:');
        for (const m of data.memberships) {
            const team = m.team_name ? ` > ${m.team_name}` : '';
            write(`    ${m.org_name}${team} (${m.role})`);
        }
    }
    else {
        write('  Memberships: none');
    }
    if (data.entity_summary) {
        const types = Object.entries(data.entity_summary.by_type || {})
            .map(([t, c]) => `${c} ${t}`)
            .join(', ');
        write(`  Entities: ${data.entity_summary.total} total${types ? ` (${types})` : ''}`);
        write(`  Last active: ${timeAgo(data.entity_summary.last_active_at)}`);
    }
    write('');
}
async function grantAccess(email, args) {
    const orgSlug = getFlag(args, '--org');
    const teamSlug = getFlag(args, '--team');
    const role = getFlag(args, '--role') || 'member';
    const sendEmail = hasFlag(args, '--send-email');
    const data = await adminFetch('POST', `/admin/users/${encodeURIComponent(email)}/grant`, {
        org_slug: orgSlug,
        team_slug: teamSlug,
        role,
        send_email: sendEmail,
    });
    write('');
    write(`  Access granted: ${email}`);
    write(`  Access grant: ${data.access_grant_id}`);
    if (data.membership_ids?.length > 0) {
        if (orgSlug)
            write(`  Org membership: ${orgSlug} (${role})`);
        if (teamSlug)
            write(`  Team membership: ${teamSlug} (${role})`);
    }
    write(`  Email sent: ${data.email_sent ? 'yes' : 'no'}`);
    write('');
}
async function revokeAccess(email, args) {
    const reason = getFlag(args, '--reason');
    const suspendOnly = hasFlag(args, '--suspend');
    const data = await adminFetch('DELETE', `/admin/users/${encodeURIComponent(email)}/grant`, {
        reason,
        suspend_only: suspendOnly,
    });
    write('');
    write(`  Access ${data.status}: ${email}`);
    write(`  Memberships deactivated: ${data.memberships_deactivated}`);
    write('');
}
async function restoreAccess(email, args) {
    const restoreMemberships = hasFlag(args, '--restore-memberships');
    const data = await adminFetch('POST', `/admin/users/${encodeURIComponent(email)}/restore`, {
        restore_memberships: restoreMemberships,
    });
    write('');
    write(`  Access restored: ${email}`);
    write(`  Status: ${data.status}`);
    write(`  Memberships restored: ${data.memberships_restored}`);
    write('');
}
async function listOrgs() {
    const data = await adminFetch('GET', '/admin/orgs');
    const items = data.items || [];
    writeTable(['NAME', 'SLUG', 'OWNER', 'MEMBERS', 'TEAMS', 'ENTITIES'], items.map((o) => [
        o.display_name || o.name,
        o.slug,
        o.owner,
        String(o.member_count),
        String(o.team_count),
        String(o.entity_count),
    ]));
}
async function listTeams(args) {
    const orgSlug = getFlag(args, '--org');
    const path = orgSlug ? `/admin/teams?org=${encodeURIComponent(orgSlug)}` : '/admin/teams';
    const data = await adminFetch('GET', path);
    const items = data.items || [];
    writeTable(['NAME', 'SLUG', 'ORG', 'MEMBERS'], items.map((t) => [
        t.display_name || t.name,
        t.slug,
        t.org_name,
        String(t.member_count),
    ]));
}
async function assignTeam(email, args) {
    const orgSlug = getFlag(args, '--org');
    const teamSlug = getFlag(args, '--team');
    const role = getFlag(args, '--role') || 'member';
    if (!orgSlug) {
        throw new AdminCliError('--org <slug> is required');
    }
    const data = await adminFetch('POST', '/admin/memberships', {
        email,
        org_slug: orgSlug,
        team_slug: teamSlug || undefined,
        role,
    });
    write('');
    write(`  Membership created: ${email}`);
    write(`  Org: ${orgSlug}${teamSlug ? ` / Team: ${teamSlug}` : ''} (${role})`);
    write(`  Membership ID: ${data.membership_id}`);
    write('');
}
async function createOrg(name, args) {
    const slug = getFlag(args, '--slug');
    if (!slug) {
        throw new AdminCliError('--slug <slug> is required');
    }
    const data = await adminFetch('POST', '/admin/orgs', {
        name,
        slug,
        display_name: name,
    });
    write('');
    write(`  Organization created: ${data.name}`);
    write(`  Slug: ${data.slug}`);
    write(`  ID: ${data.id}`);
    write('');
}
// ---- Dispatch --------------------------------------------------------------
function printAdminHelp() {
    write(`
  gramatr-mcp admin -- User & org management commands

  Usage:
    admin list-users                              List all users with access status
    admin user-detail <email>                     Show user detail
    admin grant-access <email> [options]           Grant access + optional org/team membership
      --org <slug>    Auto-add to org
      --team <slug>   Auto-add to team (requires --org)
      --role <role>   Role (default: member)
      --send-email    Send invite email
    admin revoke-access <email> [options]          Revoke or suspend access
      --reason "..."  Reason for revocation
      --suspend       Suspend instead of revoke
    admin restore-access <email> [options]         Restore revoked/suspended access
      --restore-memberships                       Re-activate previous memberships
    admin list-orgs                               List all organizations
    admin list-teams [--org <slug>]               List teams (optionally by org)
    admin assign-team <email> --org <slug> [options]
      --team <slug>   Team within org (optional)
      --role <role>   Role (default: member)
    admin create-org <name> --slug <slug>         Create a new organization
`);
}
export async function runAdmin(args) {
    const subcommand = args[0];
    const subArgs = args.slice(1);
    try {
        switch (subcommand) {
            case 'list-users':
                await listUsers();
                return 0;
            case 'user-detail': {
                const email = getPositional(subArgs, 0);
                if (!email) {
                    write('  Error: email is required. Usage: admin user-detail <email>');
                    return 1;
                }
                await userDetail(email);
                return 0;
            }
            case 'grant-access': {
                const email = getPositional(subArgs, 0);
                if (!email) {
                    write('  Error: email is required. Usage: admin grant-access <email>');
                    return 1;
                }
                await grantAccess(email, subArgs);
                return 0;
            }
            case 'revoke-access': {
                const email = getPositional(subArgs, 0);
                if (!email) {
                    write('  Error: email is required. Usage: admin revoke-access <email>');
                    return 1;
                }
                await revokeAccess(email, subArgs);
                return 0;
            }
            case 'restore-access': {
                const email = getPositional(subArgs, 0);
                if (!email) {
                    write('  Error: email is required. Usage: admin restore-access <email>');
                    return 1;
                }
                await restoreAccess(email, subArgs);
                return 0;
            }
            case 'list-orgs':
                await listOrgs();
                return 0;
            case 'list-teams':
                await listTeams(subArgs);
                return 0;
            case 'assign-team': {
                const email = getPositional(subArgs, 0);
                if (!email) {
                    write('  Error: email is required. Usage: admin assign-team <email> --org <slug>');
                    return 1;
                }
                await assignTeam(email, subArgs);
                return 0;
            }
            case 'create-org': {
                const name = getPositional(subArgs, 0);
                if (!name) {
                    write('  Error: name is required. Usage: admin create-org <name> --slug <slug>');
                    return 1;
                }
                await createOrg(name, subArgs);
                return 0;
            }
            case '--help':
            case '-h':
            case undefined:
                printAdminHelp();
                return 0;
            default:
                write(`  Error: Unknown admin command: ${subcommand}`);
                printAdminHelp();
                return 1;
        }
    }
    catch (error) {
        write(`  Error: ${error.message}`);
        return 1;
    }
}
//# sourceMappingURL=admin.js.map