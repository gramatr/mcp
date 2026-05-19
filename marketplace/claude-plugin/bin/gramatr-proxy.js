#!/usr/bin/env node
"use strict";

// dist/bin/plugin-proxy.js
var import_node_readline = require("node:readline");
var import_node_child_process = require("node:child_process");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var REMOTE_URL = process.env.GRAMATR_URL ?? "https://api.gramatr.com/mcp";
var PLUGIN_DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? "";
var ENV_API_KEY = process.env.GRAMATR_API_KEY ?? "";
var ENV_TOKEN = process.env.GRAMATR_TOKEN ?? "";
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
  return "";
}
async function forwardToRemote(message) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
  };
  if (token)
    headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(REMOTE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(message)
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const lines = text.split("\n");
    let lastData = null;
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload && payload !== "[DONE]")
          lastData = payload;
      }
    }
    if (lastData) {
      try {
        return JSON.parse(lastData);
      } catch {
      }
    }
    return { jsonrpc: "2.0", error: { code: -32603, message: "Empty SSE response from remote" } };
  }
  try {
    return await res.json();
  } catch {
    return { jsonrpc: "2.0", error: { code: -32603, message: `Non-JSON response from remote: ${res.status}` } };
  }
}
function getGitRemote(cwd) {
  try {
    const result = (0, import_node_child_process.spawnSync)("git", ["-C", cwd, "remote", "get-url", "origin"], {
      timeout: 2e3,
      encoding: "utf8"
    });
    if (result.status === 0 && result.stdout) {
      return result.stdout.trim();
    }
  } catch {
  }
  return "";
}
function getProjectId(cwd) {
  try {
    const projectFile = (0, import_node_path.join)(cwd, ".gramatr", "project.json");
    if ((0, import_node_fs.existsSync)(projectFile)) {
      const data = JSON.parse((0, import_node_fs.readFileSync)(projectFile, "utf8"));
      if (typeof data.project_id === "string" && data.project_id) {
        return data.project_id;
      }
    }
  } catch {
  }
  return void 0;
}
async function handleMessage(msg) {
  const method = msg.method;
  if (method === "tools/call" && msg.params !== null && typeof msg.params === "object") {
    const params = msg.params;
    if (params.name === "session_bootstrap") {
      const args = params.arguments ?? {};
      const cwd = typeof args.cwd === "string" ? args.cwd : process.cwd();
      if (!args.git_remote) {
        const gitRemote = getGitRemote(cwd);
        if (gitRemote)
          args.git_remote = gitRemote;
      }
      if (!args.project_id) {
        const projectId = getProjectId(cwd);
        if (projectId)
          args.project_id = projectId;
      }
      const enriched = {
        ...msg,
        params: { ...params, arguments: args }
      };
      return forwardToRemote(enriched);
    }
  }
  if (msg.id === void 0 || msg.id === null) {
    forwardToRemote(msg).catch(() => void 0);
    return null;
  }
  return forwardToRemote(msg);
}
var rl = (0, import_node_readline.createInterface)({ input: process.stdin, terminal: false });
function writeResponse(response) {
  process.stdout.write(JSON.stringify(response) + "\n");
}
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed)
    return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  handleMessage(msg).then((response) => {
    if (response !== null) {
      writeResponse(response);
    }
  }).catch((err) => {
    const id = msg.id ?? null;
    const errMsg = err instanceof Error ? err.message : String(err);
    writeResponse({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: `Proxy error: ${errMsg}` }
    });
  });
});
rl.on("close", () => {
  process.exit(0);
});
