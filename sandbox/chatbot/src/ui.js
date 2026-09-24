/* Pip: the chat page. Renders messages, crafting grids and quick replies, shows Pip's "brain"
   (which part of the pipeline answered and how every candidate scored), and loads the neural
   networks in the background so the page is usable right away.
   All timing uses setTimeout / CSS durations in milliseconds, so it is independent of the
   display's refresh rate. */
(function (P) {
  "use strict";
  const U = P.util;
  const $ = (id) => document.getElementById(id);

  // storage that never throws (private windows, blocked site data...)
  const store = {
    getItem(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    removeItem(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const CHAT_KEY = "pip.chat.v1", OPT_KEY = "pip.options.v1";
  let opts = { generate: true, pace: true };
  try { opts = Object.assign(opts, JSON.parse(store.getItem(OPT_KEY) || "{}")); } catch (e) { /* defaults */ }

  const brain = new P.Brain({ storage: store, debug: true });
  let chat = [];
  try { chat = JSON.parse(store.getItem(CHAT_KEY) || "[]"); } catch (e) { chat = []; }
  let busy = false;
  let lastOut = null;

  // ---------- item colors for crafting grids ----------
  const COLORS = [
    [/planks|wooden slab|block \(planks/i, "#b8945f"], [/stripped log/i, "#c9a26b"], [/log/i, "#6f5230"], [/stick|bowl|fishing rod|bow$/i, "#9a7443"],
    [/cobblestone|furnace/i, "#8a8a8a"], [/smooth stone|stone slab|stone brick/i, "#aeaeae"], [/stone/i, "#9a9a9a"],
    [/iron nugget/i, "#c9c9c9"], [/block of iron/i, "#e8e8e8"], [/iron/i, "#dcdcdc"], [/gold nugget/i, "#f6dc6a"], [/gold/i, "#f2cf3d"],
    [/diamond/i, "#5fe3dc"], [/emerald/i, "#2fc46a"], [/redstone torch/i, "#e0533d"], [/redstone/i, "#c8322c"], [/coal/i, "#3a3a3a"],
    [/string/i, "#efefef"], [/wool/i, "#f3f3f3"], [/leather/i, "#9b5a2e"], [/paper/i, "#f1ecdc"], [/book/i, "#7a4b2a"], [/glass bottle/i, "#d6ecf4"],
    [/glass/i, "#cde9f2"], [/crying obsidian/i, "#4a2785"], [/obsidian/i, "#2e1f43"], [/sand/i, "#e5d59b"], [/gunpowder/i, "#707070"],
    [/slime/i, "#7ccf5a"], [/blaze/i, "#f2a922"], [/ender pearl/i, "#1f6b5f"], [/eye of ender/i, "#2f8f6a"], [/nether star/i, "#fafafa"],
    [/netherrack/i, "#7b2e2e"], [/netherite/i, "#4a3f45"], [/quartz/i, "#ece6de"], [/glowstone/i, "#f4d27a"], [/sugar cane|bamboo/i, "#8fd16a"],
    [/sugar/i, "#fafafa"], [/wheat|hay bale/i, "#d9b54a"], [/milk/i, "#f4f4f4"], [/egg/i, "#f3e8d0"], [/apple/i, "#d53a2f"], [/carrot/i, "#f08a24"],
    [/melon/i, "#d44b4b"], [/pumpkin/i, "#e28b25"], [/honey/i, "#f0b02a"], [/copper/i, "#d9804d"], [/amethyst/i, "#a57fe0"], [/feather/i, "#f5f5f5"],
    [/flint/i, "#4a4a4a"], [/bone/i, "#eeeeea"], [/dye/i, "#c46adb"], [/clay/i, "#a8b0c0"], [/brick/i, "#b35a3c"], [/chest/i, "#a7773c"],
    [/crafting table/i, "#a47b45"], [/arrow/i, "#bdbdbd"], [/chain/i, "#7a7a7a"], [/torch/i, "#f2c14e"], [/hopper/i, "#555555"], [/dropper/i, "#7a7a7a"],
    [/piston/i, "#b0a27a"], [/nautilus/i, "#e8cfb0"], [/heart of the sea/i, "#2d6fb3"], [/heavy core/i, "#555555"], [/breeze/i, "#9fd0e8"],
    [/echo shard/i, "#0f4d5a"], [/compass/i, "#c0c0c0"], [/tripwire/i, "#9a8a70"], [/snowball/i, "#ffffff"], [/ghast tear/i, "#e8f4f8"],
    [/spider eye/i, "#9e2a3a"], [/mushroom/i, "#b56a4a"], [/soul/i, "#5e4a3a"], [/chorus/i, "#c7a2d8"], [/shulker/i, "#9b6fb0"], [/potion/i, "#d27ad6"],
    [/scute/i, "#6fa35a"], [/bucket/i, "#d0d0d0"], [/minecart/i, "#8f8f8f"], [/tnt/i, "#d23c2c"], [/ink sac/i, "#1c1c2e"], [/cocoa/i, "#6b3f22"],
    [/beetroot/i, "#9e2340"], [/rabbit|potato/i, "#c98f4a"], [/vine|moss/i, "#4f8f3a"], [/gravel/i, "#8e8580"], [/dirt/i, "#7a5634"],
  ];
  function itemColor(name) {
    for (const [re, c] of COLORS) if (re.test(name)) return c;
    let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${h} 45% 70%)`;
  }
  function inkFor(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return "#111";
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b < 110 ? "#f4f4f4" : "#161616";
  }
  function abbr(name) {
    const w = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
    return w.length === 1 ? w[0].slice(0, 2) : (w[0][0] + w[1][0]).toUpperCase();
  }
  function itemEl(name, big) {
    const el = document.createElement("span");
    el.className = "item";
    const c = itemColor(name);
    el.style.background = c; el.style.color = inkFor(c);
    if (big) { el.style.width = "40px"; el.style.height = "40px"; }
    el.textContent = abbr(name);
    el.title = name;
    return el;
  }
  function recipeCard(card) {
    const box = document.createElement("div");
    box.className = "card";
    const h = document.createElement("h3");
    h.textContent = card.title + (card.shapeless ? " · any arrangement" : "");
    box.appendChild(h);
    const row = document.createElement("div");
    row.className = "craft";
    const grid = document.createElement("div");
    grid.className = "grid3";
    grid.setAttribute("role", "img");
    grid.setAttribute("aria-label", "Crafting grid for " + card.title + ": " + card.grid.map((r) => r.map((x) => x || "empty").join(", ")).join("; "));
    for (const r of card.grid) for (const nm of r) {
      const s = document.createElement("span");
      s.className = "slot";
      if (nm) s.appendChild(itemEl(nm));
      grid.appendChild(s);
    }
    row.appendChild(grid);
    const arrow = document.createElement("span");
    arrow.className = "arrow"; arrow.textContent = "→"; arrow.setAttribute("aria-hidden", "true");
    row.appendChild(arrow);
    const res = document.createElement("div");
    res.className = "result";
    const rs = document.createElement("span");
    rs.className = "slot";
    rs.appendChild(itemEl(card.title, true));
    res.appendChild(rs);
    const lab = document.createElement("span");
    lab.textContent = (card.makes > 1 ? card.makes + " × " : "") + card.title;
    res.appendChild(lab);
    row.appendChild(res);
    box.appendChild(row);
    const leg = document.createElement("div");
    leg.className = "legend";
    for (const l of card.legend) {
      const s = document.createElement("span");
      const b = document.createElement("b");
      const c = itemColor(l.name);
      b.style.background = c; b.style.color = inkFor(c); b.textContent = abbr(l.name);
      s.appendChild(b); s.appendChild(document.createTextNode(l.name));
      leg.appendChild(s);
    }
    box.appendChild(leg);
    return box;
  }

  // ---------- messages ----------
  const log = $("log");
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  function addMessage(msg, save) {
    const row = document.createElement("div");
    row.className = "row " + (msg.who === "user" ? "user" : "bot");
    if (msg.who !== "user") {
      const f = document.createElement("div");
      f.className = "pebble small"; f.setAttribute("aria-hidden", "true");
      f.innerHTML = "<i></i><i></i>";
      row.appendChild(f);
    }
    const stack = document.createElement("div");
    stack.className = "stack";
    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = msg.text;
    stack.appendChild(b);
    if (msg.card) stack.appendChild(recipeCard(msg.card));
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = fmtTime(msg.t || Date.now()) + (msg.source && msg.who !== "user" ? " · " + prettySource(msg.source) : "");
    stack.appendChild(meta);
    row.appendChild(stack);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    if (save) {
      chat.push(msg);
      if (chat.length > 80) chat = chat.slice(-80);
      store.setItem(CHAT_KEY, JSON.stringify(chat));
    }
  }
  function prettySource(s) {
    const map = { "neural:retrieval": "retrieval net", "neural:gpt": "PipGPT", eliza: "reflection rule", fallback: "fallback", greeting: "greeting" };
    if (map[s]) return map[s];
    if (s.startsWith("skill:")) return s.slice(6) + " skill";
    if (s.startsWith("intent:")) return "intent: " + s.slice(7).replace(/_/g, " ");
    if (s.startsWith("memory")) return "memory";
    if (s.startsWith("game")) return "game";
    if (s.startsWith("event:") || s.startsWith("feelings:")) return "empathy rule";
    if (s.startsWith("opinion")) return "personality";
    return s.replace(/:/g, " ");
  }
  function setChips(chips) {
    const box = $("chips");
    box.textContent = "";
    for (const c of chips || []) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = c;
      b.addEventListener("click", () => send(c));
      box.appendChild(b);
    }
  }
  let typingRow = null;
  function showTyping(on) {
    $("face").classList.toggle("think", on);
    $("status").classList.toggle("busy", on);
    $("statusText").textContent = on ? "typing…" : statusIdle();
    if (on && !typingRow) {
      typingRow = document.createElement("div");
      typingRow.className = "row bot typing";
      typingRow.innerHTML = '<div class="pebble small" aria-hidden="true"><i></i><i></i></div><div class="bubble" aria-label="Pip is typing"><span></span><span></span><span></span></div>';
      log.appendChild(typingRow);
      log.scrollTop = log.scrollHeight;
    } else if (!on && typingRow) { typingRow.remove(); typingRow = null; }
  }
  let neuralState = "loading";
  function statusIdle() {
    return neuralState === "loading" ? "online · waking up the neural nets…" : neuralState === "ready" ? "online · all systems cozy" : "online · rules + knowledge mode";
  }

  // ---------- sending ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function send(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    busy = true;
    setChips([]);
    addMessage({ who: "user", text, t: Date.now() }, true);
    showTyping(true);
    const t0 = Date.now();
    await sleep(30); // let the typing dots appear before heavy work
    let out;
    try {
      if (brain.neural) brain.neural.opts = { generate: opts.generate };
      out = await brain.reply(text);
    } catch (e) {
      console.error(e);
      out = { text: "Oops, something glitched in my circuits. 😵 Can you say that again?", source: "error" };
    }
    const want = opts.pace ? U.clamp(420 + out.text.length * 14, 500, 1700) : 0;
    const left = want - (Date.now() - t0);
    if (left > 0) await sleep(left);
    showTyping(false);
    addMessage({ who: "bot", text: out.text, card: out.card || null, source: out.source, t: Date.now() }, true);
    setChips(out.chips);
    if (out.rename) updateName();
    lastOut = out;
    renderBrain();
    renderMemory();
    busy = false;
    $("msg").focus();
  }
  $("form").addEventListener("submit", (e) => { e.preventDefault(); const v = $("msg").value; $("msg").value = ""; send(v); });

  // ---------- side panel ----------
  const app = $("app"), panel = $("panel");
  function openPanel(on) {
    panel.hidden = !on;
    app.classList.toggle("with-panel", on);
    $("brainBtn").setAttribute("aria-pressed", String(on));
    if (on) { renderBrain(); renderMemory(); }
  }
  $("brainBtn").addEventListener("click", () => openPanel(panel.hidden));
  $("closePanel").addEventListener("click", () => openPanel(false));
  for (const t of document.querySelectorAll(".tab")) {
    t.addEventListener("click", () => {
      for (const x of document.querySelectorAll(".tab")) x.setAttribute("aria-selected", String(x === t));
      for (const p of ["brain", "memory", "settings"]) $("pane-" + p).hidden = p !== t.dataset.pane;
    });
  }
  function renderBrain() {
    const box = $("brainNow");
    if (!lastOut) return;
    box.textContent = "";
    const a = document.createElement("div");
    a.className = "answered";
    a.textContent = "Answered by: " + prettySource(lastOut.source || "?") + (lastOut.source && lastOut.source !== prettySource(lastOut.source) ? "  (" + lastOut.source + ")" : "");
    box.appendChild(a);
    const tr = (lastOut.trace || []).slice().sort((x, y) => y.score - x.score).slice(0, 10);
    if (!tr.length) {
      const p = document.createElement("p");
      p.textContent = "An exact stage answered this one (memory, a skill or a game), so no scoring round was needed.";
      box.appendChild(p);
      return;
    }
    let winMarked = false;
    for (const c of tr) {
      const d = document.createElement("div");
      const win = !winMarked && c.text && lastOut.text && brain._post(c.text) === lastOut.text.slice(0, brain._post(c.text).length);
      if (win) winMarked = true;
      d.className = "cand" + (win ? " win" : "");
      const lab = document.createElement("div");
      lab.className = "lab";
      const b = document.createElement("b"); b.textContent = prettySource(c.source);
      const s = document.createElement("span"); s.textContent = c.score.toFixed(3);
      lab.appendChild(b); lab.appendChild(s);
      const bar = document.createElement("div"); bar.className = "bar";
      const fill = document.createElement("span"); fill.style.width = Math.round(U.clamp(c.score, 0, 1) * 100) + "%";
      bar.appendChild(fill);
      const txt = document.createElement("div"); txt.className = "txt"; txt.textContent = brain._post(c.text);
      d.appendChild(lab); d.appendChild(bar); d.appendChild(txt);
      if (c.detail) { const dt = document.createElement("div"); dt.className = "why"; dt.textContent = c.detail.trim().replace(/^\(|\)$/g, "").replace(/sim/, "similarity").replace(/kw/, "keywords").replace(/pmi/, "fit").replace(/ ll [-0-9.]+/, "").replace(/lex/, "adjust"); d.appendChild(dt); }
      box.appendChild(d);
    }
  }
  function renderStats() {
    const dl = $("modelStats");
    dl.textContent = "";
    const n = brain.neural;
    const rows = [
      ["Scripted intents", String(P.content.intents.length)],
      ["Minecraft entries", String(P.mcdata.items.length + P.mcdata.mobs.length + P.mcdata.enchants.length + P.mcdata.potions.length)],
      ["Reply bank", n && n.bankText ? n.bankText.length.toLocaleString() + " lines" : neuralState === "loading" ? "loading…" : "not loaded"],
      ["Retrieval network", n && n.enc ? "2-layer transformer" : neuralState === "loading" ? "loading…" : "not loaded"],
      ["PipGPT", n && n.gpt ? (n.gptParams / 1e6).toFixed(2) + "M parameters" : neuralState === "loading" ? "loading…" : "not loaded"],
    ];
    for (const [k, v] of rows) { const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; dl.appendChild(dt); dl.appendChild(dd); }
  }
  function renderMemory() {
    const ul = $("facts"), mem = brain.mem;
    ul.textContent = "";
    const add = (k, v) => { const li = document.createElement("li"); const s = document.createElement("span"); s.textContent = k; li.appendChild(s); li.appendChild(document.createTextNode(v)); ul.appendChild(li); };
    if (mem.name) add("Name", mem.name);
    if (mem.age) add("Age", String(P.memory.currentAge(mem)));
    if (mem.location) add("Lives in", mem.location);
    if (mem.birthday) add("Birthday", mem.birthday);
    if (mem.job) add("Job", mem.job);
    if (mem.school) add("School", mem.school);
    for (const [k, v] of Object.entries(mem.favorites)) add("Favorite " + k, v);
    for (const p of mem.pets) add("Pet", p.name ? `${p.kind} named ${p.name}` : p.kind);
    for (const [k, v] of Object.entries(mem.people)) add("Their " + k, v);
    if (mem.likes.length) add("Likes", U.listJoin(mem.likes.slice(-8)));
    if (mem.dislikes.length) add("Dislikes", U.listJoin(mem.dislikes.slice(-6)));
    for (const e of mem.events.slice(-3)) add("Coming up", e.what + (e.when && e.when !== "soon" ? " (" + e.when + ")" : ""));
    for (const nt of mem.notes.slice(-5)) add("Note", nt);
    if (!ul.children.length) { const li = document.createElement("li"); li.textContent = "Nothing yet. Tell Pip about yourself!"; ul.appendChild(li); }
  }
  // two-step confirm inside the page (dialogs are not available everywhere)
  let armTimer = null;
  $("forgetBtn").addEventListener("click", () => {
    const b = $("forgetBtn");
    if (!b.classList.contains("armed")) {
      b.classList.add("armed"); b.textContent = "Tap again to forget everything";
      armTimer = setTimeout(() => { b.classList.remove("armed"); b.textContent = "Forget everything"; }, 4000);
      return;
    }
    clearTimeout(armTimer);
    b.classList.remove("armed"); b.textContent = "Forget everything";
    brain.reset(true);
    chat = []; store.removeItem(CHAT_KEY); log.textContent = "";
    renderMemory(); updateName();
    const g = brain.greet();
    addMessage({ who: "bot", text: g.text, source: "greeting", t: Date.now() }, true);
  });
  $("renameBtn").addEventListener("click", () => {
    const v = $("renameInput").value.trim().replace(/[^\p{L}\p{N} '-]/gu, "").slice(0, 20);
    if (!v) return;
    brain.mem.botName = v; brain.save(); updateName();
    addMessage({ who: "bot", text: `${v}? I love it! From now on I'm ${v}. 😊`, source: "command:rename", t: Date.now() }, true);
  });
  $("clearChat").addEventListener("click", () => { chat = []; store.removeItem(CHAT_KEY); log.textContent = ""; brain.reset(false); setChips([]); });
  $("optGen").checked = opts.generate; $("optPace").checked = opts.pace;
  $("optGen").addEventListener("change", (e) => { opts.generate = e.target.checked; store.setItem(OPT_KEY, JSON.stringify(opts)); });
  $("optPace").addEventListener("change", (e) => { opts.pace = e.target.checked; store.setItem(OPT_KEY, JSON.stringify(opts)); });
  function updateName() {
    const n = brain.botName;
    $("botName").textContent = n; $("renameInput").value = n;
    $("msg").placeholder = "Message " + n + "…";
    document.title = n;
  }

  // ---------- neural networks load in the background ----------
  function loadScript(src) {
    return new Promise((res) => {
      const s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = () => res(true); s.onerror = () => res(false);
      document.body.appendChild(s);
    });
  }
  async function loadNeural() {
    const files = ["data/dictionary.js", "data/tokenizer.js", "data/encoder.js", "data/bank.js", "data/bankctx.js", "data/gpt.js"];
    let ok = true;
    for (const f of files) ok = (await loadScript(f)) && ok;
    try {
      if (P.data && P.data.tokenizer && P.data.encoder) {
        const n = new P.Neural(P.data);
        await n.init();
        const respond = n.respond.bind(n);
        n.respond = (h, t, o) => respond(h, t, Object.assign({}, o, { generate: opts.generate }));
        brain.neural = n;
        neuralState = "ready";
      } else neuralState = "off";
    } catch (e) { console.error(e); neuralState = "off"; }
    if (!busy) $("statusText").textContent = statusIdle();
    renderStats();
    void ok;
  }

  // ---------- start ----------
  updateName();
  renderStats();
  if (chat.length) {
    const d = document.createElement("div"); d.className = "day"; d.textContent = "Earlier"; log.appendChild(d);
    for (const m of chat.slice(-40)) addMessage(m, false);
    const d2 = document.createElement("div"); d2.className = "day"; d2.textContent = "Today"; log.appendChild(d2);
  }
  const g = brain.greet();
  addMessage({ who: "bot", text: g.text, source: "greeting", t: Date.now() }, true);
  if (!brain.mem.name) setChips([]); else setChips(["Tell me a joke", "How do I craft a beacon?", "Let's play a game"]);
  $("statusText").textContent = statusIdle();
  setTimeout(loadNeural, 60);
})(window.Pip);
