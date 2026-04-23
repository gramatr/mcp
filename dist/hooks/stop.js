import { resolveHookClientRuntime } from './lib/client-runtime.js';
export async function runStopHook(_args = []) {
    resolveHookClientRuntime(_args);
    process.stdout.write(JSON.stringify({}));
    return 0;
}
//# sourceMappingURL=stop.js.map