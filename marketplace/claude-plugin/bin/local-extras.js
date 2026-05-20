#!/usr/bin/env node
"use strict";

// dist/bin/local-extras.js
var import_node_child_process = require("node:child_process");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var remote = (0, import_node_child_process.spawnSync)("git", ["remote", "-v"], { cwd: PROJECT_DIR, encoding: "utf8" }).stdout?.trim() ?? "";
var branch = (0, import_node_child_process.spawnSync)("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: PROJECT_DIR, encoding: "utf8" }).stdout?.trim() ?? "";
var outDir = (0, import_node_path.join)(PROJECT_DIR, ".gramatr");
(0, import_node_fs.mkdirSync)(outDir, { recursive: true });
(0, import_node_fs.writeFileSync)((0, import_node_path.join)(outDir, "git-context.json"), JSON.stringify({ remote, branch, cwd: PROJECT_DIR, updated_at: (/* @__PURE__ */ new Date()).toISOString() }, null, 2) + "\n", "utf8");
process.stderr.write(`gr\u0101matr-local: git context written (branch: ${branch})
`);
