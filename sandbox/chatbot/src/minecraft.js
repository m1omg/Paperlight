/* Pip: Minecraft skill. Finds Minecraft things in a message (fuzzy, so typos are fine), works out what
   the user wants to know (recipe, where to find it, how to beat it...) and answers from mcdata.js.
   Remembers the last thing discussed, so "what about iron?" or "and a sword?" work as follow-ups. */
(function (P) {
  "use strict";
  const U = P.util, D = P.mcdata;

  // everyday words: only answer as Minecraft when the conversation is clearly about Minecraft
  const GENERIC = new Set(("bed door cake bread cookie book paper map clock bucket bow arrow boat bowl painting candle glass " +
    "stairs fence ladder sign chest barrel compass shield lead torch lantern sugar bricks wall slab fishing rod shears wool " +
    "beehive honey bottle apple egg milk wheat sand stone log stick chain wood planks string leather feather flint coal " +
    "clay brick iron gold diamond emerald copper cow pig sheep chicken horse cat wolf dog fox parrot bee panda goat frog " +
    "squid dolphin turtle camel villager witch zombie skeleton spider slime phantom bat golden apple gold apple " +
    "concrete button lever target hopper rail minecart cart item frame frame flower pot pot note block jukebox bell " +
    "snowman snow block hay bale melon pumpkin pie mushroom stew rabbit stew beetroot soup rocket fireworks firework " +
    "rope window pail scissors lighter watch telescope binoculars oven workbench dynamite hat cap shoes pants boots " +
    "helmet sword axe shovel hoe spade blade pick hatchet tree trees paper door potion healing strength speed poison").split(" "));
  const MC_WORDS = /\b(minecraft|mc|craft|crafting|crafted|recipe|recipes|survival|creative|nether|the end|ender|overworld|redstone|creeper|enchant\w*|mob|mobs|biome|biomes|smelt\w*|furnace|obsidian|netherite|pickaxe|pickax|y level|y=|stronghold|village|villager|villagers|spawner|diamonds?|block|blocks|mining|mine|brew\w*|xp|hearts|steve|alex|herobrine|notch|mojang|server|seed|world|chunk|skin|mod|mods|modded|java|bedrock|pe)\b/;

  // ---------- index of names ----------
  const index = new Map();   // phrase -> [{kind, ref}]
  let built = false;
  const sing = (w) => (w.length > 3 && /[^s]s$/.test(w) && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w.replace(/ies$/, "y"));
  const normPhrase = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  function addName(name, kind, ref) {
    const n = normPhrase(name);
    if (!n) return;
    for (const v of new Set([n, n.split(" ").map(sing).join(" ")])) {
      let arr = index.get(v);
      if (!arr) index.set(v, (arr = []));
      if (!arr.some((e) => e.ref === ref)) arr.push({ kind, ref });
    }
  }
  function build() {
    if (built) return;
    built = true;
    for (const it of D.items) { addName(it.name, "item", it); for (const a of (it.aliases || "").split("|")) if (a) addName(a, "item", it); }
    for (const m of D.mobs) { const ref = { name: m[0], hp: m[1], type: m[2], info: m[3] }; addName(m[0], "mob", ref); for (const a of (m[4] || "").split("|")) if (a) addName(a, "mob", ref); }
    for (const e of D.enchants) { const ref = { name: e[0], max: e[1], on: e[2], info: e[3] }; addName(e[0], "ench", ref); }
    for (const p of D.potions) { const ref = { name: p[0], ing: p[1], info: p[2] }; addName("potion of " + p[0], "potion", ref); addName(p[0] + " potion", "potion", ref); for (const a of (p[3] || "").split("|")) if (a) { addName(a + " potion", "potion", ref); addName("potion of " + a, "potion", ref); } }
    for (const o of D.ores) { const ref = { name: o[0], y: o[1], tool: o[2], tip: o[3] }; addName(o[0] + " ore", "ore", ref); addName(o[0], "ore", ref); addName(o[0] + "s", "ore", ref); }
    // teach the spell checker the proper names only (aliases include typos like "pikaxe" on purpose)
    if (P.nlp && P.nlp.addWords) {
      const ws = new Set();
      const proper = D.items.map((i) => i.name).concat(D.mobs.map((x) => x[0]), D.enchants.map((x) => x[0]), D.potions.map((x) => x[0]), D.ores.map((x) => x[0]));
      for (const nm of proper) for (const w of normPhrase(nm).split(" ")) if (w.length > 2) ws.add(w);
      for (const w of "craft crafting crafted recipe smelt smelting enchant enchanting enchantment enchantments nether overworld stronghold potion potions brewing brew tame breed obsidian redstone minecraft pickaxe netherite creeper enderman".split(" ")) ws.add(w);
      P.nlp.addWords([...ws], 0.12);
    }
    guideIndex = new P.nlp.TfIdf();
    D.guides.forEach((g, i) => g.q.forEach((q) => guideIndex.add(q, i)));
  }
  let guideIndex = null;

  // find mentions: longest exact n-gram first, then fuzzy single/multi-word names
  function findMentions(tokens) {
    build();
    const used = new Array(tokens.length).fill(false);
    const found = [];
    for (let n = 5; n >= 1; n--) {
      for (let i = 0; i + n <= tokens.length; i++) {
        if (used.slice(i, i + n).some(Boolean)) continue;
        const ph = tokens.slice(i, i + n).join(" ");
        const hits = index.get(ph) || index.get(tokens.slice(i, i + n).map(sing).join(" "));
        if (hits) { found.push({ at: i, len: n, phrase: ph, hits }); for (let k = i; k < i + n; k++) used[k] = true; }
      }
    }
    // fuzzy pass for leftovers (typos like "enchantmant tabel", "creper")
    for (let n = 3; n >= 1; n--) {
      for (let i = 0; i + n <= tokens.length; i++) {
        if (used.slice(i, i + n).some(Boolean)) continue;
        const words = tokens.slice(i, i + n);
        const ph = words.join(" ");
        // only words the spell checker doesn't know can be typos ("level" must not become "lever")
        if (ph.length < 5 || P.nlp.STOP.has(ph) || words.every((w) => P.nlp.knownWord(w))) continue;
        let best = null, bestD = 99;
        for (const [k, hits] of index) {
          if (Math.abs(k.length - ph.length) > 2) continue;
          const kw = k.split(" ");
          if (kw.length !== n) continue;
          let d = 0;
          for (let j = 0; j < n && d < 99; j++) {
            const dj = U.levenshtein(words[j], kw[j], 2);
            d = dj > (words[j].length >= 8 ? 2 : 1) || (dj > 0 && P.nlp.knownWord(words[j])) ? 99 : d + dj;
          }
          if (d < 99 && d > 0 && d < bestD) { bestD = d; best = { at: i, len: n, phrase: k, hits, fuzzy: true }; }
        }
        if (best) { found.push(best); for (let k = i; k < i + n; k++) used[k] = true; }
      }
    }
    found.sort((a, b) => a.at - b.at);
    return found;
  }

  // ---------- rendering ----------
  function ingredientCounts(it) {
    const counts = new Map();
    if (it.grid) for (const row of it.grid) for (const ch of row) if (ch !== " ") { const nm = it.key[ch]; counts.set(nm, (counts.get(nm) || 0) + 1); }
    if (it.shapeless) for (const nm of it.shapeless) counts.set(nm, (counts.get(nm) || 0) + 1);
    return counts;
  }
  function plural(name, n) {
    if (n === 1) return name;
    if (/(Dust|Glass|Wool|Sand|Gravel|Leather|Wheat|String|Bamboo|Coal or Charcoal|Sugar|Stone|Obsidian|Cobblestone|Paper|Redstone Dust|Glowstone|Netherrack|Honeycomb|Gunpowder|Clay|Honey|Kelp|Coal|Lapis Lazuli|Nether Quartz|Netherite Scrap)$/.test(name) || /\(/.test(name) || / or /.test(name)) return name;
    if (/(Planks|Bricks|Beans)$/.test(name)) return name;
    if (/sh$|ch$|x$/.test(name)) return name + "es";
    if (/y$/.test(name) && !/[aeiou]y$/.test(name)) return name.slice(0, -1) + "ies";
    if (/Leaf$/.test(name)) return name.replace(/Leaf$/, "Leaves");
    return name + "s";
  }
  function ingredientText(it) {
    const parts = [];
    for (const [nm, c] of ingredientCounts(it)) parts.push(c + " " + plural(nm, c));
    return U.listJoin(parts);
  }
  function recipeCard(it) {
    if (!it.grid && !it.shapeless) return null;
    let grid = [["", "", ""], ["", "", ""], ["", "", ""]];
    const legend = [];
    if (it.grid) {
      const h = it.grid.length, w = Math.max(...it.grid.map((r) => r.length));
      const top = h < 3 ? 0 : 0, left = w < 3 ? (w === 1 ? 1 : 0) : 0;
      const top2 = h === 1 ? 1 : top;
      it.grid.forEach((row, r) => row.split("").forEach((ch, c) => { if (ch !== " ") grid[r + top2][c + left] = it.key[ch]; }));
      for (const [ch, nm] of Object.entries(it.key)) legend.push({ ch, name: nm });
    } else {
      it.shapeless.forEach((nm, i) => { grid[Math.floor(i / 3)][i % 3] = nm; });
      for (const nm of new Set(it.shapeless)) legend.push({ ch: "", name: nm });
    }
    return { type: "recipe", title: it.name, grid, legend, makes: it.makes || 1, shapeless: !!it.shapeless };
  }
  function asciiCard(card) {
    const abbr = new Map();
    const used = new Set();
    for (const row of card.grid) for (const nm of row) if (nm && !abbr.has(nm)) {
      let a = nm.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
      if (a.length < 2) a = nm.slice(0, 2).toUpperCase();
      let k = 2; while (used.has(a)) a = a[0] + String(k++);
      used.add(a); abbr.set(nm, a);
    }
    const lines = card.grid.map((row) => row.map((nm) => "[" + (nm ? abbr.get(nm).padEnd(2) : "  ") + "]").join(""));
    const legend = [...abbr].map(([nm, a]) => a + " = " + nm).join(", ");
    return lines.join("\n") + "\n" + legend + (card.makes > 1 ? `  →  makes ${card.makes}` : "");
  }

  // ---------- answers ----------
  const an = (w) => U.aOrAn(w);
  function article(name) {
    if (/s$/.test(name) && !/(Glass|Compass|Grass|Boss)$/.test(name)) return name;
    if (/^(TNT|Wool|Paper|Sugar|Bread|Glass|Concrete|Clay|Sandstone|Glowstone|Purpur|Coarse|Mossy|Snow Block|Honey Block|Chain|Scaffolding|Obsidian|Leather|String|Gunpowder|Iron Bars)/.test(name)) return name;
    return an(name) + " " + name;
  }

  function recipeAnswer(it, generic) {
    const card = recipeCard(it);
    const pre = generic ? "In Minecraft: " : "";
    if (it.smithing) {
      const [tpl, base, add] = it.smithing;
      return { text: `${pre}${article(it.name)} is made at a smithing table: put in ${an(tpl)} ${tpl}, your ${base} and ${an(add)} ${add}. The upgrade keeps all enchantments!`, kind: "recipe", item: it };
    }
    if (card) {
      const makes = it.makes > 1 ? ` That makes ${it.makes}.` : "";
      const how = it.shapeless ? "Put these anywhere in the crafting grid: " : "You need ";
      let text = `${pre}${it.shapeless ? "To craft " + article(it.name) + ", put these anywhere in the grid: " : "To craft " + article(it.name) + " you need "}${ingredientText(it)}.${makes}`;
      if (it.note) text += " " + it.note;
      if (it.info && U.chance(0.8)) text += " " + it.info;
      void how;
      return { text, card, ascii: asciiCard(card), kind: "recipe", item: it };
    }
    if (it.smelt) return { text: `${pre}${it.name} comes from smelting: put ${it.smelt} in a furnace with some fuel.` + (it.how && !/^smelt/i.test(it.how) ? " " + it.how : ""), kind: "smelt", item: it };
    if (it.how) return { text: `${pre}${article(it.name)} can't be crafted. ${it.how}`, kind: "how", item: it };
    return null;
  }

  function obtainAnswer(it, ore) {
    if (ore) return { text: `${ore.name}${/s$/.test(ore.name) ? "" : ""}: best at ${ore.y}. You need ${an(ore.tool)} ${ore.tool}. ${ore.tip}`, kind: "ore" };
    if (it.how) return { text: it.how + (it.smelt ? ` (It's a smelting result too: smelt ${it.smelt}.)` : ""), kind: "how", item: it };
    if (it.smelt) return { text: `Smelt ${it.smelt} in a furnace to get ${it.name}.`, kind: "smelt", item: it };
    return recipeAnswer(it);
  }

  function mobAnswer(mob, want) {
    const hearts = mob.hp / 2;
    const h = `${mob.hp} HP (${hearts % 1 ? hearts : hearts} heart${hearts === 1 ? "" : "s"})`;
    if (want === "health") return { text: `${mob.type === "boss" ? "The " + mob.name : article(mob.name)} has ${h}.`, kind: "mob" };
    return { text: `${mob.name} (${mob.type}, ${h}): ${mob.info}`, kind: "mob" };
  }

  function enchAnswer(e) {
    const roman = ["", "I", "II", "III", "IV", "V"][e.max] || e.max;
    return { text: `${e.name} (max level ${roman}) goes on: ${e.on}. ${e.info}`, kind: "ench" };
  }
  function potionAnswer(p) {
    const base = /^none/.test(p.ing) ? `Brew it like this: ${p.ing.replace(/^none: /, "")}.` : `Water Bottle + Nether Wart makes an Awkward Potion, then add ${p.ing}.`;
    return { text: `Potion of ${p.name}: ${base} ${p.info} (Redstone makes it last longer, glowstone makes it stronger, gunpowder makes it splash.)`, kind: "potion" };
  }

  // tool/armor "full set" cost
  function setCost(material) {
    const m = { diamond: "Diamonds", iron: "Iron Ingots", gold: "Gold Ingots", golden: "Gold Ingots", leather: "Leather" }[material];
    return m ? `A full set of ${material} armor takes 24 ${m} (helmet 5, chestplate 8, leggings 7, boots 4).` : null;
  }

  const MATERIAL_WORDS = { wood: "Wooden", wooden: "Wooden", stone: "Stone", cobblestone: "Stone", cobble: "Stone", iron: "Iron", gold: "Golden",
    golden: "Golden", diamond: "Diamond", diamonds: "Diamond", netherite: "Netherite", leather: "Leather", chainmail: "Chainmail", chain: "Chainmail" };
  const FAMILY_WORDS = { pickaxe: "Pickaxe", pick: "Pickaxe", pickax: "Pickaxe", axe: "Axe", shovel: "Shovel", spade: "Shovel", hoe: "Hoe", sword: "Sword",
    helmet: "Helmet", chestplate: "Chestplate", leggings: "Leggings", pants: "Leggings", boots: "Boots" };
  function byName(name) { build(); return D.items.find((i) => i.name === name); }

  // ---------- main entry ----------
  function answer(m, state) {
    build();
    const mc = state.mc || (state.mc = { last: null, turn: -99, topicTurn: -99 });
    const text = m.norm;
    const toks = m.tokens;
    const turn = state.turn || 0;
    const recentMC = turn - mc.topicTurn <= 4;
    const mcWords = MC_WORDS.test(text);

    const want =
      /\b(y level|y-level|what level|which level|what height|best level|how deep|what layer)\b/.test(text) ? "ylevel" :
      /\b(brew|brewing|potion|potions)\b/.test(text) ? "brew" :
      /\benchant(ment|ments|ing)?s?\b/.test(text) && !/\benchant(ing|ment)? table\b/.test(text) ? "enchant" :
      /\b(tame|taming|breed|breeding|ride|riding)\b/.test(text) ? "tame" :
      /\b(kill|beat|defeat|fight|fighting|survive|deal with|avoid)\b/.test(text) ? "kill" :
      /\b(health|hp|how many hearts|how strong)\b/.test(text) ? "health" :
      /\b(drop|drops|loot)\b/.test(text) ? "drops" :
      /\b(smelt|smelting|cook|cooking)\b/.test(text) ? "smelt" :
      /\b(craft|crafting|recipe|recipes|make|made|build|create|construct)\b/.test(text) ? "recipe" :
      /\b(get|find|obtain|collect|farm|found|locate|mine|where|spawn|spawns)\b/.test(text) ? "obtain" :
      /\b(what is|what are|what does|tell me about|explain|use for|used for|good for|info)\b/.test(text) ? "info" : null;

    let mentions = findMentions(toks);
    const shortFollow = mc.last && turn - mc.turn <= 2 && toks.length <= 4 &&
      (/^(what about|how about|and|or|what|how|which|where)\b/.test(text) || /\?$/.test(m.clean) || toks.some((t) => MATERIAL_WORDS[t] || FAMILY_WORDS[t]));
    if (!want && !m.isQuestion && !/\b(recipe|how to|tell me|show me)\b/.test(text) && !shortFollow) return null;

    // follow-ups: "what about iron?", "and a sword?", "how about gold boots", "how do i get it"
    const followUp = /^(what about|how about|and|or|now|ok|okay|also|same for|what if|then)\b/.test(text) || toks.length <= 3;
    if (mc.last && turn - mc.turn <= 3) {
      const last = mc.last;
      const matW = toks.find((t) => MATERIAL_WORDS[t]);
      const famW = toks.find((t) => FAMILY_WORDS[t]);
      if (last.kind === "item" && last.ref.family && (matW || famW) && (followUp || !mentions.some((x) => x.len > 1))) {
        const fam = famW ? FAMILY_WORDS[famW] : last.ref.family;
        const mat = matW ? MATERIAL_WORDS[matW] : last.ref.material;
        const guess = byName(mat + " " + fam) || byName((mat === "Golden" ? "Golden " : mat + " ") + fam);
        if (guess && guess !== last.ref) mentions = [{ at: 0, len: 1, phrase: guess.name.toLowerCase(), hits: [{ kind: "item", ref: guess }] }];
      }
      if (!mentions.length && /\b(it|that|this|them|those|one|ones)\b/.test(text) && (want || /\?$/.test(m.clean))) {
        mentions = [{ at: 0, len: 1, phrase: last.ref.name.toLowerCase(), hits: [{ kind: last.kind, ref: last.ref }] }];
      }
    }

    // full armor set question
    const setQ = /\b(full set|full armor|whole set|all the armor|full suit)\b/.test(text) || (/\bset of\b/.test(text) && /\barmor\b/.test(text));
    if (setQ) {
      const mat = toks.map((t) => MATERIAL_WORDS[t]).find(Boolean);
      const c = setCost((mat || "diamond").toLowerCase().replace("wooden", "wood"));
      if (c && (mcWords || recentMC || mat)) return done(state, { text: c, kind: "set" }, null);
    }

    // "best enchantments for X"
    if (/\b(best|good|top|which|what) enchant/.test(text) || (/\benchant/.test(text) && /\b(for|on)\b/.test(text) && !mentions.some((x) => x.hits[0].kind === "ench"))) {
      const keys = Object.keys(D.bestEnchants);
      const k = keys.find((key) => text.includes(key)) || keys.find((key) => toks.some((t) => sing(t) === key || FAMILY_WORDS[t] && FAMILY_WORDS[t].toLowerCase() === key));
      if (k) return done(state, { text: `Best enchantments for ${an(k)} ${k}: ${D.bestEnchants[k]}`, kind: "ench" }, null);
    }

    // guides (portal, dragon, diamonds...), unless a specific item recipe is asked
    let guide = null, guideScore = 0;
    if (guideIndex) {
      const g = guideIndex.query(m.stems, 1)[0];
      // the distinctive words of the matched guide question must appear ("who made you" is not "who made minecraft")
      const key = g ? g.doc.stems.filter((w) => !P.nlp.STOP.has(w) && w.length > 2 && !/^(make|made|get|find|how|best|use|work|build)$/.test(w)) : [];
      if (g && g.score > 0.55 && key.every((w) => m.stems.includes(w) || m.stems.some((x) => x.length > 3 && U.levenshtein(x, w, 1) <= 1))) { guide = D.guides[g.payload]; guideScore = g.score; }
    }

    if (guide && guideScore > 0.75 && !(want === "recipe" && mentions.length && !guide.q.some((q) => mentions.some((x) => q.includes(x.phrase))))) {
      return done(state, { text: guide.a, kind: "guide" }, null);
    }
    if (!mentions.length) {
      if (guide && (mcWords || recentMC || guide.q.some((q) => /nether|ender|minecraft|redstone|villager|stronghold|elytra|netherite|beacon|wither|mending|obsidian|potion|enchant|diamond|creeper/.test(q)))) {
        return done(state, { text: guide.a, kind: "guide" }, null);
      }
      return null;
    }

    // pick the best mention: prefer longer, exact, and the kind that fits the question
    const scored = [];
    for (const mt of mentions) for (const h of mt.hits) {
      let s = mt.len * 2 + (mt.fuzzy ? -1 : 0);
      if (want === "ylevel" && h.kind === "ore") s += 4;
      if (want === "obtain" && h.kind === "ore") s += 2;
      if ((want === "kill" || want === "tame" || want === "health" || want === "drops") && h.kind === "mob") s += 4;
      if (want === "brew" && h.kind === "potion") s += 4;
      if (want === "enchant" && h.kind === "ench") s += 4;
      if ((want === "recipe" || want === "smelt") && h.kind === "item") s += 3;
      if (h.kind === "item" && (h.ref.grid || h.ref.shapeless || h.ref.smithing)) s += 0.5;
      if (h.kind === "mob" && !want) s += 1;
      scored.push({ s, mt, h });
    }
    scored.sort((a, b) => b.s - a.s);
    const { mt, h } = scored[0];
    const generic = GENERIC.has(mt.phrase) || GENERIC.has(sing(mt.phrase));
    const inContext = mcWords || recentMC;
    if (generic && !inContext) {
      // "how do I make a cake?" could be real life. Answer the Minecraft way only for recipe-ish questions, flagged.
      if (!(want === "recipe" && h.kind === "item")) return null;
      if (guide) return null;
    }
    if (guide && want !== "recipe" && (h.kind !== "item" || want === "obtain" || want === "info") && guide.q.some((q) => q.includes(mt.phrase))) {
      return done(state, { text: guide.a, kind: "guide" }, { kind: h.kind, ref: h.ref });
    }

    let res = null;
    const ref = h.ref;
    switch (h.kind) {
      case "item":
        if (want === "obtain" || want === "ylevel") {
          const ore = D.ores.find((o) => ref.name.toLowerCase().startsWith(o[0].toLowerCase()));
          res = ore && !ref.grid && !ref.shapeless && want === "ylevel" ? obtainAnswer(ref, { name: ore[0], y: ore[1], tool: ore[2], tip: ore[3] }) : obtainAnswer(ref);
        } else if (want === "info" && ref.info) res = { text: `${ref.name}: ${ref.info}` + (ref.grid || ref.shapeless ? ` Want the recipe?` : ""), kind: "info", item: ref, offerRecipe: !!(ref.grid || ref.shapeless) };
        else if (want === "kill" || want === "tame") {
          const mob = D.mobs.find((x) => x[0].toLowerCase() === ref.name.toLowerCase());
          res = mob ? mobAnswer({ name: mob[0], hp: mob[1], type: mob[2], info: mob[3] }) : recipeAnswer(ref, generic && !inContext);
        } else res = recipeAnswer(ref, generic && !inContext);
        break;
      case "mob":
        if (want === "recipe" || want === "obtain") {
          const it = D.items.find((x) => x.name === ref.name);
          if (it) { res = recipeAnswer(it); break; }
        }
        res = mobAnswer(ref, want);
        break;
      case "ench": res = enchAnswer(ref); break;
      case "potion": res = potionAnswer(ref); break;
      case "ore": {
        const it = D.items.find((x) => x.name.toLowerCase() === ref.name.toLowerCase() || x.name.toLowerCase().startsWith(ref.name.toLowerCase() + " ingot"));
        if ((want === "recipe" || want === "smelt") && it) res = recipeAnswer(it) || obtainAnswer(it, ref);
        else res = obtainAnswer(null, ref);
        break;
      }
    }
    if (!res) return null;
    // "how many X for Y?"
    const hm = /\bhow many (\w+(?: \w+)?)\b/.exec(text);
    if (hm && res.item && (res.item.grid || res.item.shapeless)) {
      for (const [nm, c] of ingredientCounts(res.item)) if (nm.toLowerCase().includes(sing(hm[1].split(" ")[0]))) { res.text = `You need ${c} ${plural(nm, c)} for ${article(res.item.name)}. ` + res.text; break; }
    }
    return done(state, res, { kind: h.kind, ref });
  }

  function done(state, res, last) {
    const mc = state.mc;
    res.text = U.capitalizeFirst(res.text);
    mc.turn = state.turn || 0;
    mc.topicTurn = mc.turn;
    if (last) mc.last = last;
    return res;
  }

  function isMinecrafty(text) { return MC_WORDS.test(text); }

  P.minecraft = { answer, findMentions, recipeCard, asciiCard, isMinecrafty, build };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
