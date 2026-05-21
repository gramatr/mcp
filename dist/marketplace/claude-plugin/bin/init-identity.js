#!/usr/bin/env node
"use strict";

// dist/bin/init-identity.js
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");

// dist/user-config.js
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// dist/config-runtime.js
function getHomeDir() {
  const home = process.env.HOME;
  if (home && home.length > 0)
    return home;
  const userProfile = process.env.USERPROFILE;
  if (userProfile && userProfile.length > 0)
    return userProfile;
  return "";
}

// dist/user-config.js
var DEFAULT_TTL_SECONDS = 3600;
function configPath() {
  return (0, import_node_path.join)(getHomeDir(), ".gramatr.json");
}
function readGramatrJson() {
  try {
    const raw = (0, import_node_fs.readFileSync)(configPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}
function readCachedUserIdentity() {
  const cfg = readGramatrJson();
  if (!cfg.user || typeof cfg.user !== "object")
    return null;
  return cfg.user;
}
function writeCachedUserIdentity(patch, options) {
  try {
    const cfg = readGramatrJson();
    const existing = cfg.user && typeof cfg.user === "object" ? cfg.user : {};
    const merged = {
      ...existing,
      ...patch,
      cached_at: (/* @__PURE__ */ new Date()).toISOString(),
      cache_ttl_seconds: patch.cache_ttl_seconds ?? options?.ttlSeconds ?? existing.cache_ttl_seconds ?? DEFAULT_TTL_SECONDS
    };
    const next = { ...cfg, user: merged };
    (0, import_node_fs.writeFileSync)(configPath(), JSON.stringify(next, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}
function isUserIdentityStale(identity) {
  if (!identity || !identity.cached_at)
    return true;
  const cachedMs = Date.parse(identity.cached_at);
  if (!Number.isFinite(cachedMs))
    return true;
  const ttl = (identity.cache_ttl_seconds ?? DEFAULT_TTL_SECONDS) * 1e3;
  return Date.now() - cachedMs > ttl;
}

// dist/bin/init-identity.js
var REMOTE_URL = process.env.GRAMATR_URL ?? "https://api.gramatr.com/mcp";
var PLUGIN_DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? "";
var ENV_API_KEY = process.env.GRAMATR_API_KEY ?? "";
var ENV_TOKEN = process.env.GRAMATR_TOKEN ?? "";
var HOME_DIR = process.env.HOME ?? "";
var PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var NETWORK_TIMEOUT_MS = 5e3;
function getToken() {
  const envToken = ENV_API_KEY || ENV_TOKEN;
  if (envToken)
    return envToken;
  if (PLUGIN_DATA_DIR) {
    try {
      const cfg = JSON.parse((0, import_node_fs2.readFileSync)((0, import_node_path2.join)(PLUGIN_DATA_DIR, "token.json"), "utf8"));
      if (typeof cfg.token === "string" && cfg.token)
        return cfg.token;
    } catch {
    }
  }
  try {
    const credFile = (0, import_node_path2.resolve)(HOME_DIR, ".claude", ".credentials.json");
    const creds = JSON.parse((0, import_node_fs2.readFileSync)(credFile, "utf8"));
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
async function fetchUserViaBootstrap(token) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "session_bootstrap",
      arguments: {
        // Intentionally omit `hook_response: true` — that flag shapes the
        // response into a Claude-Code-hook-compatible envelope that drops
        // the top-level `user` block we need to cache here.
        cwd: PROJECT_DIR,
        client_type: "claude-code"
      }
    }
  };
  let res;
  try {
    res = await fetch(REMOTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS)
    });
  } catch {
    return null;
  }
  if (!res.ok)
    return null;
  const contentType = res.headers.get("content-type") ?? "";
  let payload = null;
  try {
    if (contentType.includes("text/event-stream")) {
      const text2 = await res.text();
      const lines = text2.split("\n");
      let lastData = null;
      for (const line of lines) {
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data && data !== "[DONE]")
            lastData = data;
        }
      }
      if (!lastData)
        return null;
      payload = JSON.parse(lastData);
    } else {
      payload = await res.json();
    }
  } catch {
    return null;
  }
  if (!payload)
    return null;
  const result = payload.result;
  if (!result)
    return null;
  const content = result.content;
  const text = typeof content?.[0]?.text === "string" ? content[0].text : "";
  if (!text)
    return null;
  try {
    const parsed = JSON.parse(text);
    const user = parsed.user;
    if (user && (user.id || user.email))
      return user;
  } catch {
    return null;
  }
  return null;
}
async function main() {
  const cached = readCachedUserIdentity();
  if (cached && !isUserIdentityStale(cached)) {
    process.stderr.write("gr\u0101matr: identity cache fresh \u2014 skipping bootstrap\n");
    return;
  }
  const token = getToken();
  if (!token) {
    process.stderr.write("gr\u0101matr: no auth token \u2014 identity cache will refresh on a later session\n");
    return;
  }
  const user = await fetchUserViaBootstrap(token);
  if (!user) {
    process.stderr.write("gr\u0101matr: session_bootstrap did not return a user block \u2014 skipping identity cache write\n");
    return;
  }
  writeCachedUserIdentity({
    id: user.id ?? null,
    email: user.email ?? null,
    display_name: user.display_name ?? null,
    system_roles: user.system_roles ?? [],
    org_memberships: user.org_memberships ?? [],
    team_memberships: user.team_memberships ?? []
  });
  process.stderr.write(`gr\u0101matr: identity cache refreshed (${user.email ?? user.id ?? "unknown"})
`);
}
main().catch(() => {
  process.exit(0);
});
