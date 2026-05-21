#!/usr/bin/env node
"use strict";

// dist/bin/project-init.js
var import_node_child_process = require("node:child_process");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var savedProject = {};
try {
  const projectFile = (0, import_node_path.join)(PROJECT_DIR, ".gramatr", "project.json");
  if ((0, import_node_fs.existsSync)(projectFile)) {
    savedProject = JSON.parse((0, import_node_fs.readFileSync)(projectFile, "utf8"));
  }
} catch {
}
var remote_url = (0, import_node_child_process.spawnSync)("git", ["remote", "get-url", "origin"], { cwd: PROJECT_DIR, encoding: "utf8" }).stdout?.trim() ?? "";
var branch = (0, import_node_child_process.spawnSync)("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: PROJECT_DIR, encoding: "utf8" }).stdout?.trim() ?? "";
var outDir = (0, import_node_path.join)(PROJECT_DIR, ".gramatr");
(0, import_node_fs.mkdirSync)(outDir, { recursive: true });
(0, import_node_fs.writeFileSync)((0, import_node_path.join)(outDir, "git-context.json"), JSON.stringify({
  ...savedProject.project_id ? { project_id: savedProject.project_id } : {},
  ...savedProject.slug ? { slug: savedProject.slug } : {},
  remote_url: remote_url || savedProject.git_remote || "",
  branch,
  cwd: PROJECT_DIR,
  updated_at: (/* @__PURE__ */ new Date()).toISOString()
}, null, 2) + "\n", "utf8");
process.stderr.write(`gr\u0101matr: project context written (branch: ${branch}, project_id: ${savedProject.project_id ?? "unresolved"})
`);
