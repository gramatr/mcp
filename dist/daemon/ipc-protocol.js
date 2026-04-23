/**
 * ipc-protocol.ts — Types for the gramatr daemon IPC protocol.
 *
 * Newline-delimited JSON-RPC 2.0 over a Unix domain socket.
 * One JSON object per line; no framing beyond the newline terminator.
 *
 * This file is types-only — no runtime code.
 */
export const DAEMON_UNAVAILABLE = Symbol('DAEMON_UNAVAILABLE');
//# sourceMappingURL=ipc-protocol.js.map