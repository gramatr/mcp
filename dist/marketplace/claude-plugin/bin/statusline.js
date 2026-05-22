#!/usr/bin/env node
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// dist/bin/statusline.js
var statusline_exports = {};
__export(statusline_exports, {
  runStatusline: () => runStatusline
});
module.exports = __toCommonJS(statusline_exports);
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var REMOTE_URL = process.env.GRAMATR_URL ?? "https://api.gramatr.com";
var PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
function getSessionId() {
  const sessionFile = (0, import_node_path.join)(PROJECT_DIR, ".gramatr", "session.json");
  if (!(0, import_node_fs.existsSync)(sessionFile))
    return null;
  try {
    const data = JSON.parse((0, import_node_fs.readFileSync)(sessionFile, "utf8"));
    return typeof data.session_id === "string" && data.session_id ? data.session_id : null;
  } catch {
    return null;
  }
}
async function main() {
  const sessionId = getSessionId();
  if (!sessionId)
    return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2e3);
    const res = await fetch(`${REMOTE_URL}/api/v1/statusline/${encodeURIComponent(sessionId)}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok)
      return;
    const text = await res.text();
    if (text)
      process.stdout.write(text);
  } catch {
  }
}
main().catch(() => void 0);
async function runStatusline(_args = []) {
  await main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runStatusline
});
