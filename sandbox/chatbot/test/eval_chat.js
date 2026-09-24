/* Runs test/sample_chat.txt through Pip and prints each reply with the top neural candidates and their scores. */
"use strict";
const fs = require("fs"), path = require("path");
const Pip = require("../src/load.js");
(async () => {
  Pip.util.setSeed(7);
  const neural = await Pip.loadNeural();
  const store = { d: null, getItem() { return this.d; }, setItem(k, v) { this.d = v; } };
  const brain = new Pip.Brain({ storage: store, neural, debug: true });
  brain.greet();
  const lines = fs.readFileSync(path.join(__dirname, process.argv[2] || "sample_chat.txt"), "utf8").split("\n").filter(Boolean);
  for (const l of lines) {
    const t = Date.now();
    const out = await brain.reply(l);
    console.log(`\nYou: ${l}\nPip: ${out.text}   [${out.source}, ${Date.now() - t}ms]`);
    const neu = (out.trace || []).filter((x) => x.source.startsWith("neural")).slice(0, 3);
    for (const x of neu) console.log(`   ${x.score.toFixed(3)}${x.detail || ""} ${x.text.slice(0, 80)}`);
  }
})();
