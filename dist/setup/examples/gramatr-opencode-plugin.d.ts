/**
 * gramatr OpenCode Plugin — Deployed Implementation
 *
 * This is the deployed plugin written to ~/.config/opencode/plugins/gramatr.ts
 * by `gramatr setup opencode`. It maps OpenCode's plugin lifecycle events to
 * gramatr hook invocations using the canonical `gramatr-hook` shell wrapper at
 * ~/.gramatr/bin/gramatr-hook (resolves gramatr binary → global > local > npx).
 *
 * Do NOT use Bun's $ API or npx directly — always invoke via gramatr-hook.
 */
/**
 * Minimal Plugin type shape from @opencode-ai/plugin.
 * Defined locally so this file compiles without the external package installed.
 * When deployed to ~/.config/opencode/plugins/gramatr.ts, OpenCode resolves the
 * real type from its own runtime.
 */
type PluginContext = {
    project?: unknown;
    client?: unknown;
    directory?: string;
    worktree?: unknown;
    $?: unknown;
};
type Plugin = (ctx: PluginContext) => Promise<Record<string, ((...args: unknown[]) => Promise<unknown>) | undefined>>;
export declare const GramatrPlugin: Plugin;
export {};
//# sourceMappingURL=gramatr-opencode-plugin.d.ts.map