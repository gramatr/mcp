#!/usr/bin/env node
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// dist/bin/precompact-block.js
var precompact_block_exports = {};
module.exports = __toCommonJS(precompact_block_exports);
process.stdout.write(JSON.stringify({
  decision: "block",
  reason: [
    "gr\u0101matr: compaction blocked \u2014 your handoff is a better recovery than a lossy summary.",
    "Please run /save-handoff now to save full session state, then ask the user to run /clear.",
    "On /clear, gr\u0101matr will automatically restore your handoff and resume the session."
  ].join(" ")
}) + "\n");
