#!/usr/bin/env node
"use strict";

// dist/bin/plugin-statusline.js
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_child_process = require("node:child_process");
var REMOTE_URL = process.env.GRAMATR_URL ?? "https://api.gramatr.com";
var PLUGIN_DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? "";
var ENV_API_KEY = process.env.GRAMATR_API_KEY ?? "";
var ENV_TOKEN = process.env.GRAMATR_TOKEN ?? "";
var HOME_DIR = process.env.HOME ?? "";
function getToken() {
  const envToken = ENV_API_KEY || ENV_TOKEN;
  if (envToken)
    return envToken;
  if (PLUGIN_DATA_DIR) {
    try {
      const cfg = JSON.parse((0, import_node_fs.readFileSync)((0, import_node_path.join)(PLUGIN_DATA_DIR, "token.json"), "utf8"));
      if (typeof cfg.token === "string" && cfg.token)
        return cfg.token;
    } catch {
    }
  }
  try {
    const credFile = (0, import_node_path.resolve)(HOME_DIR, ".claude", ".credentials.json");
    const creds = JSON.parse((0, import_node_fs.readFileSync)(credFile, "utf8"));
    const mcpOAuth = creds.mcpOAuth;
    if (mcpOAuth) {
      for (const entry of Object.values(mcpOAuth)) {
        if (entry.serverUrl === `${REMOTE_URL}/mcp` && entry.accessToken && (!entry.expiresAt || Date.now() < Number(entry.expiresAt))) {
          return entry.accessToken;
        }
      }
    }
  } catch {
  }
  return "";
}
function getSession() {
  if (!PLUGIN_DATA_DIR)
    return null;
  try {
    const data = JSON.parse((0, import_node_fs.readFileSync)((0, import_node_path.join)(PLUGIN_DATA_DIR, "session.json"), "utf8"));
    const session_id = typeof data.session_id === "string" ? data.session_id : "";
    const project_id = typeof data.project_id === "string" ? data.project_id : "";
    if (session_id && project_id)
      return { session_id, project_id };
  } catch {
  }
  return null;
}
function git(args) {
  try {
    const r = (0, import_node_child_process.spawnSync)("git", args, { timeout: 1e3, encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : "";
  } catch {
    return "";
  }
}
function getGitState() {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "HEAD";
  let ahead = 0;
  let behind = 0;
  try {
    const a = git(["rev-list", "--count", "@{u}..HEAD"]);
    const b = git(["rev-list", "--count", "HEAD..@{u}"]);
    ahead = parseInt(a, 10) || 0;
    behind = parseInt(b, 10) || 0;
  } catch {
  }
  const status = git(["status", "--porcelain"]);
  const lines = status ? status.split("\n").filter(Boolean) : [];
  const modified = lines.filter((l) => l[0] === "M" || l[1] === "M").length;
  const untracked = lines.filter((l) => l.startsWith("??")).length;
  const stashList = git(["stash", "list"]);
  const stash = stashList ? stashList.split("\n").filter(Boolean).length : 0;
  const last_commit_age = git(["log", "-1", "--format=%cr"]) || "unknown";
  return { branch, ahead, behind, modified, untracked, stash, last_commit_age };
}
async function main() {
  const token = getToken();
  if (!token)
    return;
  const session = getSession();
  if (!session)
    return;
  const size = process.argv.find((a) => ["small", "medium", "large"].includes(a)) ?? "medium";
  const body = JSON.stringify({
    session_id: session.session_id,
    project_id: session.project_id,
    size,
    render_as: "native",
    git_state: getGitState()
  });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2e3);
    const res = await fetch(`${REMOTE_URL}/api/v1/statusline/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.status === 401 || res.status === 403) {
      process.stdout.write("\u26A0 gr\u0101matr: session expired \u2014 run gramatr login");
      return;
    }
    if (!res.ok)
      return;
    const data = await res.json();
    if (typeof data.rendered === "string") {
      process.stdout.write(data.rendered);
    }
  } catch {
  }
}
main().catch(() => void 0);
