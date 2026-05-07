/**
 * git-remote-parser.ts — Canonical project slug parser (inlined from @gramatr/core)
 *
 * Eliminates the @gramatr/core dependency from the MCP client package (#971).
 * This is a self-contained copy of the git remote parsing functions.
 *
 * Two canonical slug forms:
 *   1. Git remote slug: "owner/repo" (e.g., "gramatr/gramatr")
 *   2. Directory hash slug: "dir-{8 hex chars}" (e.g., "dir-a1b2c3d4")
 *
 * No external dependencies. Uses Node.js crypto for hashing.
 */
import { createHash } from 'crypto';
class SlugValidationError extends Error {
    constructor(message) { super(message); this.name = 'SlugValidationError'; }
}
// ── Regex Constants ─────────────────────────────────────────────────────────
/**
 * Matches a canonical git remote slug: owner/repo
 * - Owner: lowercase alphanumeric, may contain hyphens (must start with alnum)
 * - Repo: lowercase alphanumeric, may contain hyphens, underscores, dots (must start with alnum)
 */
export const GIT_REMOTE_SLUG_RE = /^[a-z0-9][-a-z0-9]*\/[a-z0-9][-a-z0-9_.]*$/;
/**
 * Matches a canonical directory hash slug: dir-{8 hex chars}
 */
export const DIR_HASH_SLUG_RE = /^dir-[a-f0-9]{8}$/;
// ── parseGitRemote ──────────────────────────────────────────────────────────
/**
 * Parse any git remote URL into a canonical "owner/repo" slug.
 *
 * Handles:
 *   - SSH:          git@github.com:gramatr/gramatr.git
 *   - SSH protocol: ssh://git@github.com:22/gramatr/gramatr.git
 *   - SSH no user:  ssh://github.com/gramatr/gramatr.git
 *   - HTTPS:        https://github.com/gramatr/gramatr.git
 *   - HTTPS no .git: https://github.com/gramatr/gramatr
 *   - HTTPS with auth: https://token@github.com/gramatr/gramatr.git
 *   - GitLab/Bitbucket: same patterns, any hostname
 *
 * Returns null for empty, missing, or unparseable URLs.
 */
export function parseGitRemote(url) {
    if (!url || typeof url !== 'string')
        return null;
    const trimmed = url.trim();
    if (!trimmed)
        return null;
    // SSH SCP-style: git@host:owner/repo.git (no protocol prefix)
    // Must NOT start with a protocol scheme (ssh://, git://, http://, https://)
    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
    const scpMatch = !hasProtocol && trimmed.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?\s*$/);
    if (scpMatch) {
        const path = scpMatch[1];
        return extractOwnerRepo(path);
    }
    // Protocol-based URLs: https://, http://, ssh://, git://
    const protoMatch = trimmed.match(/^(?:https?|ssh|git):\/\//);
    if (protoMatch) {
        try {
            // ssh:// URLs with port (ssh://git@host:22/owner/repo) break new URL()
            // because it treats the path after port as starting from root.
            // Normalize: strip port from ssh:// URLs before parsing.
            let normalized = trimmed;
            const sshPortMatch = normalized.match(/^ssh:\/\/([^/]+):(\d+)\/(.+)$/);
            if (sshPortMatch) {
                normalized = `ssh://${sshPortMatch[1]}/${sshPortMatch[3]}`;
            }
            const parsed = new URL(normalized);
            let pathname = parsed.pathname;
            // Strip leading slash
            if (pathname.startsWith('/')) {
                pathname = pathname.slice(1);
            }
            // Strip .git suffix
            if (pathname.endsWith('.git')) {
                pathname = pathname.slice(0, -4);
            }
            // Strip trailing slash
            if (pathname.endsWith('/')) {
                pathname = pathname.slice(0, -1);
            }
            return extractOwnerRepo(pathname);
        }
        catch {
            return null;
        }
    }
    return null;
}
/**
 * Extract "owner/repo" from a path string. Handles nested groups
 * (e.g., GitLab subgroups: "group/subgroup/repo" returns "group/subgroup/repo").
 * Returns null if the path doesn't contain at least owner/repo.
 */
function extractOwnerRepo(path) {
    if (!path)
        return null;
    // Must have at least one slash (owner/repo)
    const slashIndex = path.indexOf('/');
    if (slashIndex < 1)
        return null;
    // Validate no empty segments
    const segments = path.split('/');
    if (segments.some((s) => !s))
        return null;
    return path;
}
// ── slugifyPath ─────────────────────────────────────────────────────────────
/**
 * Convert a filesystem path to a "dir-{hash}" slug.
 * Hash: first 8 hex chars of SHA-256 of the absolute path.
 *
 * Example: /home/user/projects/my-app -> dir-a1b2c3d4
 */
export function slugifyPath(absolutePath) {
    const hash = createHash('sha256')
        .update(absolutePath)
        .digest('hex')
        .substring(0, 8);
    return `dir-${hash}`;
}
// ── canonicalizeSlug ────────────────────────────────────────────────────────
/**
 * Normalize any raw slug string to canonical form.
 *
 * Rules:
 *   - Lowercase everything
 *   - Strip .git suffix
 *   - Strip leading/trailing slashes and whitespace
 *   - Reject empty segments (consecutive slashes become invalid)
 *   - Preserve underscores in owner/repo (git allows them)
 *   - Preserve dots in owner/repo (git allows them)
 *
 * Returns the normalized slug, or throws if the result has empty segments.
 */
export function canonicalizeSlug(raw) {
    if (!raw || typeof raw !== 'string') {
        throw new SlugValidationError('Slug cannot be empty');
    }
    let slug = raw.trim().toLowerCase();
    // Strip .git suffix
    if (slug.endsWith('.git')) {
        slug = slug.slice(0, -4);
    }
    // Strip leading/trailing slashes
    slug = slug.replace(/^\/+|\/+$/g, '');
    if (!slug) {
        throw new SlugValidationError('Slug cannot be empty after normalization');
    }
    // Reject empty segments (e.g., "owner//repo")
    const segments = slug.split('/');
    if (segments.some((s) => !s)) {
        throw new SlugValidationError(`Slug contains empty segments: "${raw}"`);
    }
    return slug;
}
// ── isValidSlug ─────────────────────────────────────────────────────────────
/**
 * Validate a slug matches one of the two canonical forms:
 *   1. Git remote slug: owner/repo (matches GIT_REMOTE_SLUG_RE)
 *   2. Directory hash slug: dir-{8 hex} (matches DIR_HASH_SLUG_RE)
 */
export function isValidSlug(slug) {
    if (!slug || typeof slug !== 'string')
        return false;
    // Reject .git suffix — canonical slugs never end with .git
    if (slug.endsWith('.git'))
        return false;
    return GIT_REMOTE_SLUG_RE.test(slug) || DIR_HASH_SLUG_RE.test(slug);
}
//# sourceMappingURL=git-remote-parser.js.map