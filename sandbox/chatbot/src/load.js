/* Node loader: pulls every Pip module into one object (the browser uses <script> tags instead). */
"use strict";
const path = require("path"), fs = require("fs");
const FILES = ["src/util.js", "data/words.js", "data/dictionary.js", "src/nlp.js", "src/mathcalc.js", "src/mcdata.js", "src/minecraft.js", "src/memory.js",
  "src/content.js", "src/safety.js", "src/skills.js", "src/wasm.js", "src/neural.js", "src/brain.js"];
const root = path.join(__dirname, "..");
for (const f of FILES) { const p = path.join(root, f); if (fs.existsSync(p)) require(p); }
const Pip = global.Pip;
// neural weights are optional: without them Pip runs on rules + knowledge only
Pip.loadNeural = async function () {
  for (const f of ["data/tokenizer.js", "data/encoder.js", "data/bank.js", "data/bankctx.js", "data/gpt.js"]) { const p = path.join(root, f); if (fs.existsSync(p)) require(p); }
  if (!Pip.Neural || !Pip.data || !Pip.data.tokenizer) return null;
  const n = new Pip.Neural(Pip.data);
  await n.init();
  return n;
};
module.exports = Pip;
