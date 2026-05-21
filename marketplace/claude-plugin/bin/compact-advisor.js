#!/usr/bin/env node
"use strict";

// dist/bin/compact-advisor.js
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
var PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var HOME = (0, import_node_os.homedir)();
function getModelLimit(model) {
  if (model.includes("opus-4-7"))
    return 1e6;
  return 2e5;
}
function readConfig() {
  try {
    return JSON.parse((0, import_node_fs.readFileSync)((0, import_node_path.join)(HOME, ".gramatr.json"), "utf8"));
  } catch {
    return {};
  }
}
async function main() {
  const chunks = [];
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 500);
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => {
      clearTimeout(t);
      resolve();
    });
    process.stdin.on("error", () => {
      clearTimeout(t);
      resolve();
    });
    process.stdin.resume();
  });
  const cfg = readConfig();
  const warnPct = cfg.context_window?.warn_pct ?? 70;
  const compactPct = cfg.context_window?.compact_pct ?? 80;
  const auto = cfg.auto_compact?.auto ?? false;
  const model = process.env.ANTHROPIC_MODEL ?? process.env.CLAUDE_MODEL ?? "";
  const limit = getModelLimit(model);
  const ctxFile = (0, import_node_path.join)(PROJECT_DIR, ".gramatr", "ctx-tokens.json");
  let advisory = "";
  if ((0, import_node_fs.existsSync)(ctxFile)) {
    let ctxTokensUsed = 0;
    try {
      const data = JSON.parse((0, import_node_fs.readFileSync)(ctxFile, "utf8"));
      ctxTokensUsed = data.ctx_tokens_used ?? 0;
    } catch {
    }
    if (ctxTokensUsed > 0) {
      const pct = Math.round(ctxTokensUsed / limit * 100);
      const usedK = Math.round(ctxTokensUsed / 1e3);
      const limitK = Math.round(limit / 1e3);
      if (pct >= compactPct) {
        if (auto) {
          advisory = `[gr\u0101matr: context ${pct}% full (${usedK}K/${limitK}K) \u2014 auto-compact triggered]
MANDATORY: Your context window is critically full. You MUST: 1) Call save_handoff immediately to preserve session state, 2) Tell the user to run /clear. gr\u0101matr will automatically restore your full context on the next prompt.`;
        } else {
          advisory = `[gr\u0101matr: context ${pct}% full (${usedK}K/${limitK}K)]
MANDATORY: Tell the user their context window is ${pct}% full. They should run /save-handoff then /clear now to preserve full session state.`;
        }
      } else if (pct >= warnPct) {
        advisory = `[gr\u0101matr: context ~${pct}% full (${usedK}K/${limitK}K) \u2014 consider /save-handoff + /clear soon]`;
      }
    }
  }
  const reflectionFile = (0, import_node_path.join)(PROJECT_DIR, ".gramatr", "reflection-due.json");
  if ((0, import_node_fs.existsSync)(reflectionFile)) {
    let stale = false;
    try {
      const flag = JSON.parse((0, import_node_fs.readFileSync)(reflectionFile, "utf8"));
      const age = flag.written_at ? Date.now() - new Date(flag.written_at).getTime() : Infinity;
      stale = age > 5 * 60 * 1e3;
    } catch {
      stale = true;
    }
    if (!stale) {
      try {
        (0, import_node_fs.unlinkSync)(reflectionFile);
      } catch {
      }
      const reflectionAdvisory = `[gr\u0101matr: MANDATORY END-OF-TURN \u2014 Before completing your response, call mcp__plugin_gramatr_gramatr__classification_feedback and mcp__plugin_gramatr_gramatr__save_reflection. These feed the classifier flywheel. The directives.required_actions in this packet specify the exact arguments needed.]`;
      if (advisory) {
        advisory = advisory + "\n" + reflectionAdvisory;
      } else {
        advisory = reflectionAdvisory;
      }
    } else {
      try {
        (0, import_node_fs.unlinkSync)(reflectionFile);
      } catch {
      }
    }
  }
  if (!advisory) {
    process.stdout.write("{}");
    return;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: advisory
    }
  }));
}
main().catch(() => process.stdout.write("{}"));
