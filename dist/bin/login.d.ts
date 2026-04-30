#!/usr/bin/env node
/**
 * gramatr login — Authenticate with the gramatr server
 *
 * Opens the grāmatr dashboard login flow, captures a Firebase ID token
 * on localhost, and stores it in ~/.gramatr.json.
 *
 * Usage:
 *   gramatr login                    # Interactive browser login via dashboard
 *   gramatr login --token <token>    # Paste a token directly (API key or OAuth token)
 *   gramatr login --status           # Check current auth status
 *   gramatr login --logout           # Remove stored credentials
 *
 * Token is stored in ~/.gramatr.json under the "token" key.
 * The local gramatr MCP runtime reads this on every proxied request.
 */
export declare function isHeadless(forceFlag?: boolean): boolean;
export declare function readConfig(): Record<string, any>;
export declare function writeConfig(config: Record<string, any>): void;
/**
 * Kill any running gramatr stdio server processes so they respawn with
 * the fresh credentials just written to ~/.gramatr.json. The stdio server
 * inherits env at spawn time and cannot hot-reload credentials — killing it
 * forces the MCP client (Claude Code, Cursor, etc.) to respawn it cleanly.
 *
 * Uses an end-of-string anchor so we only hit the bare server process, not
 * `gramatr login` or `gramatr setup` subcommands still in flight.
 * Always excludes the current process.
 */
export declare function killStaleMcpServers(): void;
export declare function readJsonRecord(response: Response): Promise<Record<string, any>>;
export declare function checkServerHealth(): Promise<{
    ok: boolean;
    version?: string;
    error?: string;
}>;
export declare function testToken(token: string): Promise<{
    valid: boolean;
    user?: string;
    error?: string;
}>;
export declare function startDeviceAuthorization(): Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval: number;
}>;
export declare function pollDeviceAuthorization(deviceCode: string): Promise<string>;
export declare function showStatus(): Promise<void>;
export declare function logout(): Promise<void>;
export declare function loginWithToken(token: string): Promise<void>;
export declare function loginBrowser(opts?: {
    forceHeadless?: boolean;
}): Promise<void>;
export declare function main(rawArgs?: string[]): Promise<void>;
//# sourceMappingURL=login.d.ts.map