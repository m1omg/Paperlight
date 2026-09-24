/* Measures how well each signal picks the real reply among look-alikes:
   node test/rank_eval.js [n]   (needs training/data/dialogs.jsonl and the exported models) */
"use strict";
const fs = require("fs"), path = require("path"), readline = require("readline");
const Pip = require("../src/load.js");
(async () => {
  Pip.util.setSeed(3);
  const N = parseInt(process.argv[2] || "120", 10);
  const neural = await Pip.loadNeural();
  // take human (non-SODA) dialogues from the tail of the corpus
  const pairs = [];
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(__dirname, "../training/data/dialogs.jsonl")) });
  let i = 0;
  for await (const line of rl) {
    if (i++ % 97) continue;
    const d = JSON.parse(line);
    if (d.src === "soda") continue;
    const t = d.turns, k = 1 + Math.floor(Pip.util.rand() * (t.length - 1));
    const resp = t[k].replace(/<\|(me|you)\|>/g, "").trim();
    if (resp.split(" ").length < 3 || resp.split(" ").length > 22) continue;
    pairs.push({ ctx: t[k - 1].replace(/<\|(me|you)\|>/g, "").trim(), resp });
    if (pairs.length >= N) break;
  }
  const tok = neural.tok, sp = tok.special, names = { user: "", bot: "Pip" };
  const res = { sim: 0, ll: 0, pmi: 0, combo: 0, comboPmi: 0 };
  let done = 0;
  for (const p of pairs) {
    const q = neural.contextEmbedding([], p.ctx, names);
    const hard = process.argv.includes("--hard");
    const neg = hard ? neural.retrieve(q, 12).map((h) => h.text).filter((x) => x !== p.resp).slice(0, 9)
      : Array.from({ length: 9 }, () => { let o; do { o = pairs[Math.floor(Pip.util.rand() * pairs.length)]; } while (o === p); return o.resp; });
    const cands = [p.resp, ...neg];
    const sims = cands.map((c) => neural.respSim(q, c));
    const prompt = tok.encode("<|a|>" + neural._fmt(p.ctx, "user", names) + "<|b|>");
    const conts = cands.map((c) => tok.encode(" " + c.toLowerCase()).slice(0, 40));
    const ll = await neural.gpt.scoreContinuations(prompt, conts, sp["<|a|>"]);
    const llg = await neural.gpt.scoreContinuations(tok.encode("<|a|> ok<|b|>"), conts, sp["<|a|>"]);
    const best = (arr) => arr.indexOf(Math.max(...arr)) === 0 ? 1 : 0;
    res.sim += best(sims);
    res.ll += best(ll);
    res.pmi += best(ll.map((x, j) => x - 0.5 * llg[j]));
    res.combo += best(sims.map((s, j) => 0.55 * s + 0.05 * ll[j]));
    res.comboPmi += best(sims.map((s, j) => 0.55 * s + 0.05 * (ll[j] - 0.5 * llg[j])));
    res.comboPmi2 = (res.comboPmi2 || 0) + best(sims.map((s, j) => 0.55 * s + 0.1 * (ll[j] - 0.8 * llg[j])));
    res.pmi8 = (res.pmi8 || 0) + best(ll.map((x, j) => x - 0.8 * llg[j]));
    done++;
  }
  for (const k in res) console.log(k.padEnd(10), (100 * res[k] / done).toFixed(1) + "% picked the real reply out of 10");
})();
