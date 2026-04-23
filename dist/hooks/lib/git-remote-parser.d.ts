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
/**
 * Matches a canonical git remote slug: owner/repo
 * - Owner: lowercase alphanumeric, may contain hyphens (must start with alnum)
 * - Repo: lowercase alphanumeric, may contain hyphens, underscores, dots (must start with alnum)
 */
export declare const GIT_REMOTE_SLUG_RE: RegExp;
/**
 * Matches a canonical directory hash slug: dir-{8 hex chars}
 */
export declare const DIR_HASH_SLUG_RE: RegExp;
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
export declare function parseGitRemote(url: string): string | null;
/**
 * Convert a filesystem path to a "dir-{hash}" slug.
 * Hash: first 8 hex chars of SHA-256 of the absolute path.
 *
 * Example: /home/user/projects/my-app -> dir-a1b2c3d4
 */
export declare function slugifyPath(absolutePath: string): string;
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
export declare function canonicalizeSlug(raw: string): string;
/**
 * Validate a slug matches one of the two canonical forms:
 *   1. Git remote slug: owner/repo (matches GIT_REMOTE_SLUG_RE)
 *   2. Directory hash slug: dir-{8 hex} (matches DIR_HASH_SLUG_RE)
 */
export declare function isValidSlug(slug: string): boolean;
//# sourceMappingURL=git-remote-parser.d.ts.map