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
var HOME_DIR = process.env.HOME ?? "";
var REMOTE_BASE = REMOTE_URL.replace(/\/mcp\/?$/, "");
var ProxyAuthError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ProxyAuthError";
  }
};
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
        if (entry.serverUrl === REMOTE_URL && entry.accessToken && (!entry.expiresAt || Date.now() < Number(entry.expiresAt))) {
          return entry.accessToken;
        }
      }
    }
  } catch {
  }
  return "";
}
async function runDeviceFlow() {
  const startRes = await fetch(`${REMOTE_BASE}/device/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "gramatr-local-extras" }),
    signal: AbortSignal.timeout(1e4)
  });
  if (!startRes.ok) {
    const text = await startRes.text().catch(() => "");
    throw new ProxyAuthError(`Device flow start failed: HTTP ${startRes.status} ${text}`);
  }
  const startPayload = await startRes.json();
  const deviceCode = startPayload.device_code;
  const userCode = startPayload.user_code;
  const verificationUriComplete = startPayload.verification_uri_complete;
  const interval = typeof startPayload.interval === "number" ? startPayload.interval : 5;
  process.stderr.write("gr\u0101matr: Authentication required\n");
  if (verificationUriComplete) {
    process.stderr.write(`Open this URL to authorize: ${verificationUriComplete}
`);
  }
  process.stderr.write(`Or visit https://app.gramatr.com/device and enter code: ${userCode}
`);
  process.stderr.write("Waiting for authorization...\n");
  let accessToken;
  while (!accessToken) {
    await new Promise((res) => setTimeout(res, interval * 1e3));
    const pollRes = await fetch(`${REMOTE_BASE}/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
      signal: AbortSignal.timeout(1e4)
    });
    let pollPayload = {};
    try {
      pollPayload = await pollRes.json();
    } catch {
    }
    if (pollRes.ok && typeof pollPayload.access_token === "string") {
      accessToken = pollPayload.access_token;
      break;
    }
    if (pollRes.status === 428 || pollPayload.error === "authorization_pending") {
      continue;
    }
    const errMsg = pollPayload.error_description ?? pollPayload.error ?? `HTTP ${pollRes.status}`;
    throw new ProxyAuthError(`Device flow polling failed: ${errMsg}`);
  }
  if (PLUGIN_DATA_DIR) {
    (0, import_node_fs.mkdirSync)(PLUGIN_DATA_DIR, { recursive: true });
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(PLUGIN_DATA_DIR, "token.json"), JSON.stringify({ token: accessToken }, null, 2) + "\n", "utf8");
  }
  process.stderr.write("gr\u0101matr: Authenticated successfully.\n");
  return accessToken;
}
var SYNTHETIC_AUTH_TOOL = {
  name: "gramatr_authenticate",
  description: "Authenticate the gr\u0101matr local proxy via device flow. Call this once if gr\u0101matr tools are returning auth errors.",
  inputSchema: { type: "object", properties: {}, required: [] }
};
function writeSessionFile(responseText) {
  if (!PLUGIN_DATA_DIR)
    return;
  try {
    const parsed = JSON.parse(responseText);
    const sessionId = parsed.session_id ?? parsed.gramatr_session_id;
    const projectId = parsed.project_id;
    if (sessionId || projectId) {
      (0, import_node_fs.mkdirSync)(PLUGIN_DATA_DIR, { recursive: true });
      (0, import_node_fs.writeFileSync)((0, import_node_path.join)(PLUGIN_DATA_DIR, "session.json"), JSON.stringify({ session_id: sessionId, project_id: projectId }, null, 2) + "\n", "utf8");
    }
  } catch {
  }
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
  const httpStatus = res.status;
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
        return { response: JSON.parse(lastData), httpStatus };
      } catch {
      }
    }
    return { response: { jsonrpc: "2.0", error: { code: -32603, message: "Empty SSE response from remote" } }, httpStatus };
  }
  try {
    return { response: await res.json(), httpStatus };
  } catch {
    return { response: { jsonrpc: "2.0", error: { code: -32603, message: `Non-JSON response from remote: ${res.status}` } }, httpStatus };
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
  const msgId = msg.id ?? null;
  if (method === "tools/call" && msg.params !== null && typeof msg.params === "object") {
    const params = msg.params;
    if (params.name === "gramatr_authenticate") {
      try {
        await runDeviceFlow();
        return {
          jsonrpc: "2.0",
          id: msgId,
          result: {
            content: [{ type: "text", text: "Authenticated successfully. gr\u0101matr proxy is now connected." }]
          }
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          jsonrpc: "2.0",
          id: msgId,
          error: { code: -32001, message: `gr\u0101matr: authentication failed \u2014 ${errMsg}` }
        };
      }
    }
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
      const { response: response2, httpStatus: httpStatus2 } = await forwardToRemote(enriched);
      process.stderr.write(`gr\u0101matr-proxy: tools/call session_bootstrap \u2192 HTTP ${httpStatus2}
`);
      if (httpStatus2 === 401) {
        return {
          jsonrpc: "2.0",
          id: msgId,
          error: { code: -32001, message: "gr\u0101matr: not authenticated \u2014 call gramatr_authenticate to connect" }
        };
      }
      try {
        const r = response2;
        const contentArr = r.result?.content;
        const text = typeof contentArr?.[0]?.text === "string" ? contentArr[0].text : "";
        if (text)
          writeSessionFile(text);
      } catch {
      }
      return response2;
    }
  }
  if (method === "tools/list") {
    if (msgId === void 0 || msgId === null) {
      forwardToRemote(msg).catch(() => void 0);
      return null;
    }
    const { response: response2, httpStatus: httpStatus2 } = await forwardToRemote(msg);
    process.stderr.write(`gr\u0101matr-proxy: tools/list \u2192 HTTP ${httpStatus2}
`);
    if (httpStatus2 === 401) {
      return {
        jsonrpc: "2.0",
        id: msgId,
        result: { tools: [SYNTHETIC_AUTH_TOOL] }
      };
    }
    try {
      const r = response2;
      const result = r.result;
      if (result && Array.isArray(result.tools)) {
        result.tools = [...result.tools, SYNTHETIC_AUTH_TOOL];
      }
    } catch {
    }
    return response2;
  }
  if (msgId === void 0 || msgId === null) {
    forwardToRemote(msg).catch(() => void 0);
    return null;
  }
  const { response, httpStatus } = await forwardToRemote(msg);
  process.stderr.write(`gr\u0101matr-proxy: ${method ?? "(unknown)"} \u2192 HTTP ${httpStatus}
`);
  if (httpStatus === 401) {
    return {
      jsonrpc: "2.0",
      id: msgId,
      error: { code: -32001, message: "gr\u0101matr: not authenticated \u2014 call gramatr_authenticate to connect" }
    };
  }
  return response;
}
function writeResponse(response) {
  process.stdout.write(JSON.stringify(response) + "\n");
}
async function main() {
  const rl = (0, import_node_readline.createInterface)({ input: process.stdin, terminal: false });
  process.stderr.write(`gr\u0101matr-proxy: starting \u2014 token ${getToken() ? "found" : "not found (call gramatr_authenticate)"}
`);
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
}
main().catch((err) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`gr\u0101matr: Fatal proxy error: ${errMsg}
`);
  process.exit(1);
});
