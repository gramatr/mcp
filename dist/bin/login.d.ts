#!/usr/bin/env node
/**
 * gramatr-mcp login — Authenticate with the gramatr server
 *
 * Opens the grāmatr dashboard login flow, captures a Firebase ID token
 * on localhost, and stores it in ~/.gramatr.json.
 *
 * Usage:
 *   gramatr-mcp login                    # Interactive browser login via dashboard
 *   gramatr-mcp login --token <token>    # Paste a token directly (API key or OAuth token)
 *   gramatr-mcp login --status           # Check current auth status
 *   gramatr-mcp login --logout           # Remove stored credentials
 *
 * Token is stored in ~/.gramatr.json under the "token" key.
 * The local gramatr MCP runtime reads this on every proxied request.
 */
export declare function main(): Promise<void>;
//# sourceMappingURL=login.d.ts.map