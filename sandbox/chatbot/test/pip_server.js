#!/usr/bin/env node
/* A local test server: loads the networks once and keeps one Pip per session name, so long test
   conversations (or several testers at once) don't reload the models for every message.
     node test/pip_server.js [port]            (default 7788, listens on 127.0.0.1 only)
   Talk to it with test/say.js. Special messages:
     /start        open the chat (Pip's greeting)
     /away <h>     close the app, let <h> hours pass, open it again (tests follow-ups)
     /memory       show what Pip has stored about this user */
"use strict";
const http = require("http");
const Pip = require("../src/load.js");

const port = +process.argv[2] || 7788;
const TIME_KEYS = new Set(["at", "due", "lastSeen", "ageAt", "firstSeen"]);

function shiftTime(o, ms) {
  if (Array.isArray(o)) { o.forEach((x) => shiftTime(x, ms)); return; }
  if (!o || typeof o !== "object") return;
  for (const k of Object.keys(o)) {
    if (TIME_KEYS.has(k) && typeof o[k] === "number") o[k] -= ms;
    else shiftTime(o[k], ms);
  }
}

function pack(r) {
  return { text: r.text, source: r.source, ascii: r.ascii || null, chips: r.chips || [],
    trace: (r.trace || []).slice(0, 8).map((t) => `${t.source} ${t.score}: ${t.text.slice(0, 100)}${t.detail || ""}`) };
}

(async () => {
  const neural = await Pip.loadNeural();
  const sessions = new Map();
  const open = (s) => { s.brain = new Pip.Brain({ storage: s.storage, neural, debug: true }); return pack(s.brain.greet()); };
  http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", async () => {
      const out = [];
      try {
        const { session, text } = JSON.parse(body || "{}");
        let s = sessions.get(session);
        if (!s) {
          const store = {};
          s = { storage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } } };
          sessions.set(session, s);
          out.push(open(s));
          if (text === "/start") return res.end(JSON.stringify(out));
        }
        let r;
        if (text === "/start") out.push(open(s));
        else if ((r = /^\/away\s+(\d+(?:\.\d+)?)/.exec(text))) {
          s.brain.save();
          const mem = JSON.parse(s.storage.getItem("pip.memory.v1"));
          shiftTime(mem, +r[1] * 3600e3);
          s.storage.setItem("pip.memory.v1", JSON.stringify(mem));
          out.push(open(s));
        } else if (text === "/memory") out.push({ text: JSON.stringify(s.brain.mem, null, 1), source: "memory dump" });
        else out.push(pack(await s.brain.reply(String(text))));
      } catch (e) { out.push({ text: "SERVER ERROR: " + (e && e.stack || e), source: "error" }); }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(out));
    });
  }).listen(port, "127.0.0.1", () => console.log(`Pip test server on http://127.0.0.1:${port} (neural: ${neural && neural.ready ? "yes" : "no"})`));
})();
