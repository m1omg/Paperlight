#!/usr/bin/env node
/* Send one message to the test server (test/pip_server.js) and print Pip's reply.
     node test/say.js <session> <message...>          e.g.  node test/say.js sam "hi, I'm Sam"
     node test/say.js --debug <session> <message...>  also show which part of the brain answered
   Environment: PIP_PORT (default 7788), PIP_LOG (append the exchange to this file). */
"use strict";
const http = require("http"), fs = require("fs");

const args = process.argv.slice(2);
const debug = args[0] === "--debug" ? !!args.shift() : false;
const [session, ...words] = args;
if (!session || !words.length) { console.error("usage: node test/say.js [--debug] <session> <message>"); process.exit(1); }
const body = JSON.stringify({ session, text: words.join(" ") });
const req = http.request({ host: "127.0.0.1", port: +process.env.PIP_PORT || 7788, method: "POST", path: "/", headers: { "content-type": "application/json" } }, (res) => {
  let data = "";
  res.on("data", (d) => (data += d));
  res.on("end", () => {
    const log = [];
    for (const r of JSON.parse(data)) {
      log.push("Pip: " + r.text + (r.ascii ? "\n" + r.ascii : "") + "   [" + r.source + "]");
      console.log("Pip: " + r.text);
      if (r.ascii) console.log(r.ascii.replace(/^/gm, "     "));
      if (r.chips && r.chips.length) console.log("     [" + r.chips.join("] [") + "]");
      if (debug) { console.log("     → " + r.source); for (const t of r.trace || []) console.log("       · " + t); }
    }
    if (process.env.PIP_LOG) fs.appendFileSync(process.env.PIP_LOG, "You: " + words.join(" ") + "\n" + log.join("\n") + "\n");
  });
});
req.on("error", (e) => { console.error("Is the server running?  node test/pip_server.js   (" + e.message + ")"); process.exit(1); });
req.end(body);
