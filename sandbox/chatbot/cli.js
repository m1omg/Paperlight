#!/usr/bin/env node
/* Pip in the terminal:  node cli.js            (chat)
                         node cli.js --debug    (also show how Pip picked each reply)
                         node cli.js --fresh    (start with an empty memory)
   Memory is saved to ~/.pip_memory.json (or the file in PIP_MEMORY). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), readline = require("readline");
const Pip = require("./src/load.js");

const args = process.argv.slice(2);
const debug = args.includes("--debug");
const memFile = process.env.PIP_MEMORY || path.join(os.homedir(), ".pip_memory.json");
if (args.includes("--fresh")) try { fs.unlinkSync(memFile); } catch (e) { /* none yet */ }

// localStorage-like adapter backed by a JSON file
const storage = {
  getItem: () => (fs.existsSync(memFile) ? fs.readFileSync(memFile, "utf8") : null),
  setItem: (k, v) => fs.writeFileSync(memFile, v),
};

(async () => {
  const neural = await Pip.loadNeural();
  const brain = new Pip.Brain({ storage, neural, debug });
  const color = (c, s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);
  const say = (r) => {
    console.log(color("36", brain.botName + ": ") + r.text);
    if (r.ascii) console.log(color("33", r.ascii.replace(/^/gm, "    ")));
    if (r.chips && r.chips.length) console.log(color("90", "    [" + r.chips.join("] [") + "]"));
    if (debug && r.trace) for (const t of r.trace.slice(0, 8)) console.log(color("90", `    · ${t.source} ${t.score}: ${t.text.slice(0, 90)}`));
    if (debug) console.log(color("90", `    → ${r.source}`));
  };
  console.log(color("90", `(${neural && neural.ready ? "neural models loaded" : "neural models not found, running on rules + knowledge only"}. Type /quit to leave, /forget to wipe memory.)`));
  say(brain.greet());
  const rl = readline.createInterface({ input: process.stdin, output: process.stdin.isTTY ? process.stdout : null, prompt: color("32", "You: "), terminal: !!process.stdin.isTTY });
  if (process.stdin.isTTY) rl.prompt();
  // handle lines strictly one at a time (pasted or piped input arrives all at once)
  const queue = [];
  let busy = false, closed = false;
  const pump = async () => {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const t = queue.shift().trim();
      if (!process.stdin.isTTY) console.log(color("32", "You: ") + t);
      if (t === "/quit" || t === "/exit") { brain.save(); process.exit(0); }
      if (t === "/forget") { brain.reset(true); console.log("(memory wiped)"); continue; }
      say(await brain.reply(t));
    }
    busy = false;
    if (closed) { brain.save(); process.exit(0); }
    if (process.stdin.isTTY) rl.prompt();
  };
  rl.on("line", (line) => { queue.push(line); pump(); });
  rl.on("close", () => { closed = true; if (!busy) { brain.save(); process.exit(0); } });
})();
