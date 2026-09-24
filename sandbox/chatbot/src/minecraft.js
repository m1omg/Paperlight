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
    "axolotl armadillo polar bear llama ocelot rabbit bunny horse donkey mule " +
    "concrete button lever target hopper rail minecart cart item frame frame flower pot pot note block jukebox bell " +
    "snowman snow block hay bale melon pumpkin pie mushroom stew rabbit stew beetroot soup rocket fireworks firework " +
    "rope window pail scissors lighter watch telescope binoculars oven workbench dynamite hat cap shoes pants boots " +
    "helmet sword axe shovel hoe spade blade pick hatchet tree trees paper door potion healing strength speed poison").split(" "));
  const MC_WORDS = /\b(minecraft|mc|craft|crafting|crafted|recipe|recipes|survival|creative|nether|the end|ender|overworld|redstone|creeper|enchant\w*|mob|mobs|biome|biomes|smelt\w*|furnace|obsidian|netherite|pickaxe|pickax|y level|y=|stronghold|village|villager|villagers|spawner|diamonds?|block|blocks|mining|mine|brew\w*|xp|hearts|steve|alex|herobrine|notch|mojang|server|seed|world|chunk|skin|mod|mods|modded|java|bedrock|pe)\b/;

  // guides whose questions use game-only words can answer anytime; the rest ("how to sleep") need Minecraft context
  const MC_SPECIFIC = /\b(minecraft|nether|the end|ender|stronghold|village|villager|creeper|redstone|enchant\w*|potion|brew\w*|obsidian|netherite|elytra|beacon|wither|mending|diamonds?|bastion|trial|spawner|axolotls?|sniffer|biomes?|gamemode|creative|pillager|raid|ruined portal|shipwreck|mobs?|xp|slime chunk|ancient city|deep dark|woodland mansion|ocean monument|lush cave|azalea|cherry grove|iron farm|dragon|portal|zombie villager|librarian)\b/;
  const guideIsMC = (g) => g.q.some((q) => MC_SPECIFIC.test(q));

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
    for (const p of D.potions) { const ref = { name: p[0], ing: p[1], info: p[2], mods: p[4] }; addName("potion of " + p[0], "potion", ref); addName(p[0] + " potion", "potion", ref); for (const a of (p[3] || "").split("|")) if (a) { addName(a + " potion", "potion", ref); addName("potion of " + a, "potion", ref); } }
    for (const o of D.ores) { const ref = { name: o[0], y: o[1], tool: o[2], tip: o[3] }; addName(o[0] + " ore", "ore", ref); addName(o[0], "ore", ref); addName(o[0] + "s", "ore", ref); }
    // teach the spell checker the proper names only (aliases include typos like "pikaxe" on purpose)
    if (P.nlp && P.nlp.addWords) {
      const ws = new Set();
      const proper = D.items.map((i) => i.name).concat(D.mobs.map((x) => x[0]), D.enchants.map((x) => x[0]), D.potions.map((x) => x[0]), D.ores.map((x) => x[0]));
      const plur = (w) => (/(s|x|sh|ch)$/.test(w) ? w + "es" : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : /f$/.test(w) ? w.slice(0, -1) + "ves" : w + "s");
      for (const nm of proper) for (const w of normPhrase(nm).split(" ")) if (w.length > 2) { ws.add(w); ws.add(plur(w)); }
      // game words the conversation corpus rarely uses (without them "slimes spawn" was "corrected" to "slides spain")
      for (const w of ("craft crafts crafting crafted recipe recipes smelt smelts smelting smelted enchant enchants enchanting enchanted enchantment enchantments nether overworld stronghold " +
        "strongholds potion potions brewing brew tame taming breed breeding obsidian redstone minecraft pickaxe pickaxes netherite creeper creepers enderman endermen spawn spawns spawning " +
        "spawned respawn respawning despawn despawns spawner spawners biome biomes mob mobs hostile passive xp lapis deepslate cobble cobblestone planks ingot ingots nugget nuggets " +
        "slime slimes slimeball slimeballs ghast ghasts blaze blazes piglin piglins hoglin hoglins warden wardens villager villagers pillager pillagers raid raids elytra trident " +
        "axolotl axolotls sniffer sniffers armadillo armadillos scute scutes allay allays breeze mace shulker shulkers totem totems portal portals bastion bastions fortress fortresses " +
        "mooshroom mooshrooms strider striders phantom phantoms drowned wither withers ender dragon dragons enchanter anvil anvils beacon beacons jukebox glowstone netherrack " +
        "gamemode survival creative hardcore spectator seed seeds modded mods shader shaders texture multiplayer server servers realms bedrock java herobrine notch mojang steve alex").split(" ")) ws.add(w);
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
    if (/^(sheep|fish|cod|salmon|axolotl|deer|squid|glow squid|bee|panda|fox)$/i.test(name)) return /^(sheep|fish|cod|salmon|deer|squid|glow squid)$/i.test(name) ? name : /fox$/i.test(name) ? name + "es" : name + "s";
    if (/sh$|ch$|x$/.test(name)) return name + "es";
    if (/y$/.test(name) && !/[aeiou]y$/.test(name)) return name.slice(0, -1) + "ies";
    if (/Leaf$/.test(name)) return name.replace(/Leaf$/, "Leaves");
    if (/shelf$/.test(name)) return name.replace(/shelf$/, "shelves");
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
      const words = nm.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter((w) => /^[a-z]/i.test(w));
      let a = words.map((w) => w[0]).join("").toUpperCase().slice(0, 2);
      if (a.length < 2) a = (words[0] || nm).replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
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
    if (/^(TNT|Wool|Paper|Sugar|Bread|Glass|Concrete|Clay|Sandstone|Glowstone|Purpur|Coarse|Mossy|Snow Block|Honey Block|Chain|Scaffolding|Obsidian|Leather|String|Gunpowder|Iron Bars)/.test(name) || /Armor$/.test(name)) return name;
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

  // what the real animals eat (for "what do axolotls eat?" outside a Minecraft chat)
  const REAL_DIET = { Axolotl: "worms, insects and small fish 🦎", Cat: "meat: cat food made for cats (never chocolate, onions or grapes) 🐱", Wolf: "meat, like deer and rabbits 🐺", Horse: "hay, grass and oats, plus the occasional apple or carrot as a treat 🐴",
    Cow: "grass and hay 🐄", Pig: "almost anything, but farm pigs mostly eat grains and vegetables 🐷", Chicken: "seeds, grains and bugs 🐔", Rabbit: "mostly hay and leafy greens (carrots are only an occasional treat!) 🐰", Sheep: "grass and hay 🐑",
    Goat: "grass, leaves and hay 🐐", Panda: "bamboo, up to 12-38 kg a day! 🐼", Fox: "small animals, bugs, berries and fruit 🦊", Bee: "nectar and pollen from flowers 🐝", Frog: "insects like flies and crickets 🐸",
    Turtle: "it depends on the kind: sea turtles eat seagrass, jellyfish or crabs 🐢", Parrot: "seeds, fruit, nuts and veggies (never chocolate or avocado!) 🦜", Dolphin: "fish and squid 🐬", "Polar Bear": "mostly seals 🐻‍❄️", Camel: "desert plants, even thorny ones 🐪", Llama: "grass and hay 🦙", Armadillo: "insects like ants and beetles" };

  function mobAnswer(mob, want) {
    if (want === "drops") {
      const subj = mob.type === "boss" ? "The " + mob.name : U.capitalizeFirst(an(mob.name)) + " " + mob.name;
      const sent = mob.info.split(/(?<=[.!])\s+/).filter((x) => /drop/i.test(x)).map((x) => x.replace(/^(It )?drops\b/i, subj + " drops").replace(/^(It|They) (also )?(sometimes )?drops?\b/i, subj + " $2$3drops"));
      if (sent.length) return { text: sent.map((x) => (/drops/.test(x) && !x.startsWith(subj) ? `${subj}: ${x}` : x)).join(" "), kind: "mob" };
    }
    const hearts = typeof mob.hp === "number" ? mob.hp / 2 : null;
    const h = hearts === null ? `${mob.hp} HP (it varies)` : `${mob.hp} HP (${hearts} heart${hearts === 1 ? "" : "s"})`;
    if (want === "health") return { text: `${mob.type === "boss" ? "The " + mob.name : article(mob.name)} has ${h}.`, kind: "mob" };
    const kind = { boss: "a boss", hostile: "a hostile mob", passive: "a friendly (passive) mob", neutral: "a neutral mob (it only attacks if you provoke it)" }[mob.type] || "a " + mob.type + " mob";
    return { text: `${mob.type === "boss" ? "The " + mob.name : mob.name}: ${kind} with ${h}. ${mob.info}`, kind: "mob" };
  }

  function enchAnswer(e) {
    const roman = ["", "I", "II", "III", "IV", "V"][e.max] || e.max;
    return { text: `${e.name} (max level ${roman}) goes on: ${e.on}. ${e.info}`, kind: "ench" };
  }
  function potionAnswer(p) {
    const base = /^none/.test(p.ing) ? `Brew it like this: ${p.ing.replace(/^none: /, "")}.` : `Water Bottle + Nether Wart makes an Awkward Potion, then add ${p.ing}.`;
    const mod = p.mods === "rg" ? "Redstone makes it last longer, glowstone makes it stronger (but shorter), gunpowder makes it splash."
      : p.mods === "r" ? "Redstone makes it last longer (glowstone does nothing for this one), gunpowder makes it splash."
      : p.mods === "g" ? "Glowstone makes it stronger (it's instant, so redstone does nothing), gunpowder makes it splash."
      : "Gunpowder makes it splash; redstone and glowstone don't change this one.";
    return { text: `Potion of ${p.name}: ${base} ${p.info} (${mod})`, kind: "potion" };
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

    let want =
      /\b(y level|y-level|y lvl|what level|which level|what lvl|which lvl|what height|best level|best lvl|how deep|what layer)\b/.test(text) ? "ylevel" :
      /\b(brew|brewing|potion|potions)\b/.test(text) ? "brew" :
      /\benchant(ment|ments|ing)?s?\b/.test(text) && !/\benchant(ing|ment)? table\b/.test(text) ? "enchant" :
      /\bwhat (do|does|did|can|should) (i )?(a |an |the )?\w+( \w+)? (eat|like to eat)\b|\bwhat (to|should i|do i) feed\b|\b(favorite|favourite) food\b|\bfeed (a |an |the |my )?\w+\b/.test(text) ? "feed" :
      /\b(breed|breeding)\b/.test(text) ? "breed" :
      /\b(tame|taming|ride|riding)\b/.test(text) ? "tame" :
      /\bwhat (does|do|did|will|would) .{1,30}\b(drop|drops)\b/.test(text) ? "drops" :
      /\b(kill|beat|defeat|fight|fighting|survive|deal with|avoid)\b/.test(text) ? "kill" :
      /\b(health|hp|how many hearts|how strong)\b/.test(text) ? "health" :
      /\b(drop|drops|loot)\b/.test(text) ? "drops" :
      /\b(smelt|smelting|cook|cooking)\b/.test(text) ? "smelt" :
      /\b(craft|crafting|recipe|recipes|make|made|build|create|construct)\b/.test(text) ? "recipe" :
      /\b(get|find|obtain|collect|farm|found|locate|mine|where|spawn|spawns)\b/.test(text) ? "obtain" :
      /\b(what is|what are|what does|tell me about|explain|use for|used for|good for|info|use (it|them|this|that|one) for|what is it for|what s it for|what does (it|that|this) do|what do (they|those) do)\b/.test(text) ? "info" : null;

    if (/\b(stop|quit|enough|no more|don'?t|do not) (talking|talk|telling|going on|asking) (about|me about)\b|\b(real|actual) (recipe|life|world)\b|\bnot (a |the )?game\b/.test(text)) return null;
    if (/\bwhy (do|did|are) (you|u) (keep |always )?(talking|talk|saying|say|bringing|mention\w*|going on)\b|\b(keep|kept) (talking|saying|going on|bringing up) (about )?\b|\b(that'?s|thats|that is|that was|this is) not (where|what|how|it|right|the answer)\b|^\s*(no+|nope|wrong)[.!,]? (thats|that'?s|that is) not\b/.test(text)) return null;
    if (/\b(real|actual|irl|wild) (\w+ )?(axolotls?|pandas?|cats?|dogs?|hamsters?|animals?|ones|bees?|foxes|fox|wolves|wolf|horses?|pigs?|cows?|chickens?|sheep|parrots?|turtles?|frogs?|bats?|rabbits?|bunnies|dolphins?|goats?|llamas?|camels?|armadillos?|polar bears?)\b|\bin (the )?(wild|real life)\b|\bin real\b/.test(text) && !/\b(minecraft|mc|in the game|in game)\b/.test(text.replace(/\b(like|as) (in )?(minecraft|mc|the game)\b/g, ""))) return null;
    if (/\b(grams?|millilit\w*|ml|cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|oven|bake|baking|baked|scones?|flour|butter|sugar|dough|batter|cake tin|recipe serves|serves \d|degrees|celsius|fahrenheit|gas mark)\b/.test(text) && !/\b(minecraft|mc|craft|crafting|crafted)\b/.test(text)) return null;
    // "how many bones are in the human body?", "forget it. when did ww2 end?": real-world questions, not the game
    if (/\b(human|humans|real life|irl|in real life|human body|world war|ww1|ww2|wwii|history|biology|chemistry|physics|in science|in math|president|country|countries|planet|solar system|in the ocean)\b/.test(text) && !/\b(minecraft|mc|in the game|in game)\b/.test(text)) return null;
    // "what's your favorite mob?" / "do you like creepers?" are about Pip, and "I know what a creeper is" isn't a question
    if (/\bpiston door|redstone door|2x2 door\b/.test(text)) return null;
    if (/\b(safe|parental controls?|family settings|strangers|turn off (the )?chat|chat off)\b/.test(text) && /\b(minecraft|servers?|online|multiplayer|realms?)\b/.test(text)) { const g = D.guides.find((x) => x.q.includes(/parental|chat|block/.test(text) ? "minecraft parental controls" : "is minecraft safe for kids")); if (g) return done(state, { text: g.a, kind: "guide" }, null); }
    if (/^(why|how come)\b/.test(text) && /\b(dogs?|puppies|puppy|cats?|kittens?|beagles?|hamsters?|birds?|horses?)\b/.test(text) && !/\b(minecraft|mc|in the game|in game|tame|wolf|wolves)\b/.test(text)) return null;
    if (/\b(your|yours|urs) (favou?rite|fav|fave)\b|\bwhat(?: is| s|s)? (yours|urs)\b|\bdo (you|u) (like|love|hate|enjoy|play|even play)\b|\b(what do|do) you think (of|about)\b/.test(text)) return null;
    if (/\bi (already |do )?know (what|how|where|who|that)\b/.test(text) && !/\b(but|so) (what|how|where|why|can|do|does|is)\b/.test(text)) return null;

    if (/\bwhat (is|does|are) (hp|health points|hearts)( mean| in minecraft)?\b|\bwhat does hp stand for\b/.test(text)) { const g = D.guides.find((x) => x.q.includes("what is hp")); if (g) return done(state, { text: g.a, kind: "guide" }, null); }
    let mentions = findMentions(toks);
    if (!mentions.length && mc.last && mc.last.kind === "mob" && turn - mc.turn <= 3 && /\b(a|the|an|get|pink|blue|red|white|black|brown|baby|golden|purple|orange|green|yellow|gray|grey)\s+(one|ones)\b/.test(text)) {
      const mob = mc.last.ref.name.toLowerCase();
      const t2 = text.replace(/\b(one|ones)\b/g, mob);
      const guide2 = guideIndex && guideIndex.query(P.nlp.analyze(t2).stems, 1)[0];
      if (guide2 && guide2.score > 0.5 && D.guides[guide2.payload].q.some((q) => q.includes(mob))) return done(state, { text: D.guides[guide2.payload].a, kind: "guide" }, mc.last);
    }
    // "a PINK SHEEP 😍 can i breed sheep to get pink ones": colours need the colour answer, not plain breeding
    if (/\bsheep\b/.test(text) && /\b(pink|colou?r\w*|dye\w*|purple|blue|red|white|black|brown|green|yellow|orange|magenta|cyan|lime|gray|grey)\b/.test(text) && /\b(breed\w*|baby|babies|lamb|lambs|get|make)\b/.test(text)) {
      const g = D.guides.find((x) => x.q.includes("sheep colors"));
      if (g) return done(state, { text: g.a, kind: "guide" }, null);
    }
    // drop things the user says they DON'T mean
    const negd = mentions.filter((x) => new RegExp("\\bnot (the |a |an )?" + x.phrase + "\\b").test(text));
    if (negd.length && negd.length < mentions.length) mentions = mentions.filter((x) => !negd.includes(x));
    const followLike = /^(what about|how about|and|what of)\b/.test(text) && toks.length <= 6;
    if (!want && followLike && mc.lastWant && turn - mc.turn <= 2 && /^(ylevel|obtain|drops|brew|tame|kill|health|smelt)$/.test(mc.lastWant)) want = mc.lastWant;
    mc.pendingWant = want;
    state.mcYes = /^(is it true|is it possible|can (you|u|i|we) (really |actually )?(make|craft|get|build))\b/.test(text);
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
      const notGame = /\b(what time|what day|what date|what year|how are you|how is it going|how's it going|what is it like|forget it|never mind|nevermind|nvm|is it (true|real|going|ok|okay|raining|cold|hot)|do you like it|i like it|i love it|i hate it|love it|hate it|get it|got it|i know|that's it|thats it|that is it|this is it|it's ok|its ok|it is ok|was it fun|who is it|what is it about|is that you|was that)\b/.test(text);
      if (!notGame && (!mentions.length || want === "info") && /\b(it|that|this|them|those|one|ones)\b/.test(text) && (want || /\?$/.test(m.clean)) && !mentions.some((x) => x.len > 1)) {
        mentions = [{ at: 0, len: 1, phrase: last.ref.name.toLowerCase(), hits: [{ kind: last.kind, ref: last.ref }] }];
      }
    }

    // "what can I craft with diamonds / iron / sticks?"
    const uses = /\bwhat (?:can|could|should) (?:i|you|we) (?:make|craft|build|do|create) (?:with|from|using|out of) (?:a |an |some |my |the )?([a-z ]{2,30}?)\??$/.exec(text) ||
      /\bwhat (?:is|are) (?:a |an |the )?([a-z ]{2,30}?) (?:used for|good for|for)\??$/.exec(text) || /\buses (?:of|for) (?:a |an |the )?([a-z ]{2,30}?)\??$/.exec(text);
    if (uses) {
      const q = uses[1].trim().split(" ").map(sing).join(" ");
      const hits = D.items.filter((it) => {
        const ings = it.grid ? Object.values(it.key) : it.shapeless || it.smithing || [];
        return ings.some((nm) => { const n = normPhrase(nm).split(" ").map(sing).join(" "); return n === q || n.startsWith(q + " ") || n.endsWith(" " + q) || n.includes(" " + q + " ") || (q.length > 4 && U.levenshtein(n, q, 1) <= 1); });
      }).map((it) => it.name);
      if (hits.length && (mcWords || recentMC || hits.length >= 2)) {
        const shown = hits.slice(0, 14);
        const list = hits.length > shown.length ? shown.join(", ") + ` and ${hits.length - shown.length} more` : U.listJoin(shown);
        return done(state, { text: `With ${uses[1].trim()} you can craft: ${list}. Ask me for any recipe!`, kind: "uses" }, null);
      }
    }

    // potion modifiers: "how do I make it last longer / stronger / splash?"
    const lastIsPotion = mc.last && mc.last.kind === "potion" && turn - mc.turn <= 3;
    if ((lastIsPotion || /\bpotions?\b/.test(text)) && /\b(last longer|longer|stronger|level (2|ii|two)|splash|throw|throwable|lingering|cloud)\b/.test(text)) {
      const pn = lastIsPotion ? "the " + mc.last.ref.name + " potion" : "a potion";
      const tip = /\blingering|cloud\b/.test(text) ? `Brew dragon's breath into a splash version of ${pn} to make it lingering: it leaves a cloud that affects everyone inside.`
        : /\bsplash|throw/.test(text) ? `Add gunpowder to ${pn} in the brewing stand and it becomes a splash potion you can throw.`
        : /\bstronger|level/.test(text) ? `Add glowstone dust to ${pn} for the stronger level II version (it usually lasts shorter).`
        : `Add redstone dust to ${pn} in the brewing stand: most potions go from 3 minutes to 8. (Instant ones like Healing can't be extended.)`;
      return done(state, { text: tip, kind: "potion" }, null);
    }
    // enchantment face-offs: "sharpness or smite?"
    const COMP = {
      "sharpness|smite": "Sharpness is better for everyday fighting because it boosts damage against every mob. Smite does much more damage, but only to undead mobs (zombies, skeletons, phantoms, the Wither). You can't have both on one sword.",
      "fortune|silk touch": "Fortune gives more drops from ores (more diamonds!), Silk Touch mines the block itself (like ore blocks, glass or grass). Most players keep one pickaxe of each.",
      "infinity|mending": "On a bow: Infinity means one arrow lasts forever, Mending keeps the bow repaired. They can't go together. Early on Infinity is great; later most players pick Mending.",
      "loyalty|riptide": "Loyalty makes the trident fly back to you; Riptide launches YOU when you throw it in water or rain. Can't have both.",
      "multishot|piercing": "Multishot fires three arrows at once (great for crowds), Piercing shoots through several mobs in a line. Pick one.",
      "blast protection|protection": "Protection reduces all kinds of damage a bit, Blast Protection reduces explosions a lot. Protection IV is the best all-rounder.",
      "depth strider|frost walker": "Depth Strider makes you fast underwater; Frost Walker freezes water so you can walk on it. They can't be combined.",
      "bane of arthropods|sharpness": "Sharpness wins almost always: Bane of Arthropods only helps against spiders, bees and silverfish.",
    };
    const enchMentioned = D.enchants.map((e) => e[0].toLowerCase()).filter((n) => text.includes(n));
    if (enchMentioned.length >= 2 && /\b(or|vs|versus|better|best|which|same|together|both|combine|combined|with|and)\b/.test(text)) {
      const key = enchMentioned.slice(0, 2).sort().join("|");
      const hit = COMP[key] || Object.entries(COMP).find(([k]) => k.split("|").every((x) => enchMentioned.includes(x)));
      if (hit) return done(state, { text: typeof hit === "string" ? hit : hit[1], kind: "ench" }, null);
    }
    // variants: "how 'bout a sticky one?", "the golden one"
    const variant = /\b(?:a|an|the)? ?(\w+) (?:one|ones|version|kind)\b/.exec(text);
    if (variant && mc.last && mc.last.kind === "item" && turn - mc.turn <= 3 && !MATERIAL_WORDS[variant[1]]) {
      const cand = variant[1] + " " + mc.last.ref.name.toLowerCase();
      const hits = index.get(cand) || index.get(sing(variant[1]) + " " + mc.last.ref.name.toLowerCase());
      if (hits && hits[0].kind === "item") {
        const res = recipeAnswer(hits[0].ref) || obtainAnswer(hits[0].ref);
        if (res) return done(state, res, { kind: "item", ref: hits[0].ref });
      }
    }

    // "how many books do I need for 15 bookshelves?", "how many scraps for 1 netherite ingot?"
    const cnt = /\bhow (?:many|much) ([a-z]+(?: [a-z]+)?) (?:do i need |do you need |does it take |are needed |is needed |would i need |will i need )?(?:for|to (?:make|craft)|in) (?:a |an |one |all |the |all the |my )?(\d+|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)? ?([a-z][a-z ]{2,30}?)\??$/.exec(text);
    if (cnt) {
      const n = cnt[2] ? (+cnt[2] || { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20 }[cnt[2]]) : 1;
      const target = findMentions(cnt[3].split(" ").filter(Boolean)).map((x) => x.hits.find((h) => h.kind === "item" && (h.ref.grid || h.ref.shapeless))).find(Boolean);
      const lastItem = mc.last && mc.last.kind === "item" && (mc.last.ref.grid || mc.last.ref.shapeless) ? mc.last.ref : null;
      const it = target ? target.ref : /^(them|it|that|those|all|one)$/.test(cnt[3].trim()) ? lastItem : null;
      if (it) {
        const want1 = sing(cnt[1].split(" ").pop());
        for (const [nm, c] of ingredientCounts(it)) {
          if (nm.toLowerCase().split(/\s+/).map(sing).includes(want1) || sing(nm.toLowerCase()) === sing(cnt[1])) {
            const total = c * n;
            return done(state, { text: n > 1 ? `You need ${total} ${plural(nm, total)} for ${n} ${plural(it.name, n)} (${c} each${it.makes > 1 ? `, and each craft makes ${it.makes}` : ""}).` : `You need ${c} ${plural(nm, c)} for ${article(it.name)}.`, kind: "count" }, { kind: "item", ref: it });
          }
        }
      }
    }
    // "bruh so how many sticks is that" right after a recipe
    const cnt2 = /\bhow many ([a-z]+(?: [a-z]+)?) (?:is that|do i need|does it need|does that need|in total|total|is it|are there)\b/.exec(text);
    if (cnt2 && mc.last && mc.last.kind === "item" && turn - mc.turn <= 3 && (mc.last.ref.grid || mc.last.ref.shapeless)) {
      const want1 = sing(cnt2[1].split(" ").pop());
      const nn = /\bfor (?:all |all the |the )?(\d+)\b/.exec(text);
      const n = nn ? +nn[1] : 1, it = mc.last.ref;
      for (const [nm, c] of ingredientCounts(it)) if (nm.toLowerCase().split(/\s+/).map(sing).includes(want1))
        return done(state, { text: n > 1 ? `That's ${c * n} ${plural(nm, c * n)} for ${n} ${plural(it.name, n)} (${c} each).` : `${article(it.name)} takes ${c} ${plural(nm, c)}.`, kind: "count" }, null);
    }
    // "how do I put mending on my sword?" -> anvil
    if (/\b(put|add|apply|get|combine)\b.{0,30}\b(it|this|that|mending|enchant\w*|book|books|sharpness|protection|efficiency|fortune|unbreaking|looting|silk touch|infinity|power)\b.{0,20}\bon(to)? (my |a |the |your )?[a-z]+/.test(text) || /\bhow (do|can) i (use|apply) (an |the |this |my )?enchanted book\b/.test(text)) {
      return done(state, { text: "Use an anvil! 🔨 Put your item (like the sword) in the first slot and the enchanted book in the second slot, then take the result. It costs some XP levels. (Combining two of the same enchantment can level it up, like Sharpness III + III = IV.)", kind: "guide" }, null);
    }

    // "how many iron ingots do I need for it?" right after a recipe
    const hmIt = /\bhow many (\w+(?: \w+)?)\b.*\b(for it|for that|for one|for this|for them|to make it|to craft it|to make one|to craft one)\b/.exec(text);
    if (hmIt && mc.last && mc.last.kind === "item" && turn - mc.turn <= 3 && (mc.last.ref.grid || mc.last.ref.shapeless)) {
      const want1 = sing(hmIt[1].split(" ")[0]);
      for (const [nm, cnt] of ingredientCounts(mc.last.ref)) {
        if (nm.toLowerCase().split(/\s+/).map(sing).includes(want1)) return done(state, { text: `You need ${cnt} ${plural(nm, cnt)} for ${article(mc.last.ref.name)}.`, kind: "count" }, null);
      }
      return done(state, { text: `${article(mc.last.ref.name)} doesn't need any ${hmIt[1]}. It takes ${ingredientText(mc.last.ref)}.`, kind: "count" }, null);
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
      // among the best keyword matches, prefer the guide whose distinctive words are all in the question,
      // and the more of them the better ("repair my elytra" beats plain "elytra")
      let best = null;
      for (const g of guideIndex.query(m.stems, 6)) {
        const key = g.doc.stems.filter((w) => !P.nlp.STOP.has(w) && w.length > 2 && !/^(make|made|get|find|how|best|use|work|build)$/.test(w));
        if (g.score < (key.length >= 2 ? 0.2 : 0.4)) continue;
        const ok = key.length && key.every((w) => m.stems.includes(w) || m.stems.some((x) => x.length > 3 && U.levenshtein(x, w, 1) <= 1));
        if (!ok) continue;
        const rank = key.length * 0.3 + g.score;
        if (!best || rank > best.rank) best = { rank, g, cover: key.length };
      }
      if (best && (best.g.score > 0.55 || best.cover >= 2)) { guide = D.guides[best.g.payload]; guideScore = best.cover >= 2 ? Math.max(best.g.score, 0.8) : best.g.score; }
    }
    if (guide && !guideIsMC(guide) && !mcWords && !recentMC) guide = null;
    // a game-only answer to a question that didn't mention the game gets a "Minecraft" label
    const label = (a) => (mcWords || recentMC ? a : "If you mean in Minecraft: " + a);
    const craftable = want === "recipe" && mentions.some((x) => x.hits.some((h) => h.kind === "item" && (h.ref.grid || h.ref.shapeless || h.ref.smithing)));
    if (guide && guideScore > 0.75 && !craftable && !(/^(drops|feed|breed)$/.test(want || "") && mentions.some((x) => x.hits.some((h) => h.kind === "mob"))) && !(want === "recipe" && mentions.length && !guide.q.some((q) => mentions.some((x) => q.includes(x.phrase))))) {
      const top1 = mentions.find((x) => guide.q.some((q) => q.includes(x.phrase)));
      return done(state, { text: label(guide.a), kind: "guide" }, top1 ? { kind: top1.hits[0].kind, ref: top1.hits[0].ref } : null);
    }
    if (!mentions.length) {
      if (guide && (mcWords || recentMC || guideIsMC(guide))) {
        return done(state, { text: label(guide.a), kind: "guide" }, null);
      }
      return null;
    }

    // pick the best mention: prefer longer, exact, and the kind that fits the question
    let qAt = -1;
    toks.forEach((t, i) => { if (i > 0 && /^(what|how|where|why|which|who|can|do|does|is|are)$/.test(t) && !/^(i|you|u|it|that|and|to|like|know|of|about)$/.test(toks[i - 1] || "")) qAt = i; });
    const scored = [];
    for (const mt of mentions) for (const h of mt.hits) {
      let s = mt.len * 2 + (mt.fuzzy ? -1 : 0);
      if (want === "ylevel" && h.kind === "ore") s += 4;
      if (want === "obtain" && h.kind === "ore") s += 2;
      if ((want === "kill" || want === "tame" || want === "health" || want === "drops" || want === "feed" || want === "breed") && h.kind === "mob") s += 4;
      if (want === "brew" && h.kind === "potion") s += 4;
      if (want === "enchant" && h.kind === "ench") s += 4;
      if ((want === "recipe" || want === "smelt") && h.kind === "item") s += 3;
      if (h.kind === "item" && (h.ref.grid || h.ref.shapeless || h.ref.smithing)) s += 0.5;
      if (h.kind === "mob" && (!want || want === "info")) s += 1;
      if (h.kind === "mob" && /\bspawns?\b|\bwhere (do|does|can) (i find )?\w+ (live|spawn)/.test(text)) s += 3;
      s -= mt.at * 0.05;
      if (qAt > 0 && mt.at >= qAt) s += 2.5;
      scored.push({ s, mt, h });
    }
    scored.sort((a, b) => b.s - a.s);
    const { mt, h } = scored[0];
    const generic = GENERIC.has(mt.phrase) || GENERIC.has(sing(mt.phrase));
    const inContext = mcWords || recentMC;
    if (generic && !inContext) {
      // "how do I make a cake?" could be real life. Answer the Minecraft way only for recipe-ish questions, flagged,
      // or for verbs that only make sense in the game ("tame an axolotl", "brew", "enchant", "y level").
      const gameVerb = /^(tame|brew|enchant|ylevel|drops|health|feed|breed)$/.test(want || "");
      if (!(want === "recipe" && h.kind === "item") && !gameVerb) return null;
      if (guide) return null;
    }
    if (guide && want !== "recipe" && (h.kind !== "item" || want === "obtain" || want === "info") && guide.q.some((q) => q.includes(mt.phrase)) && !(want === "drops" && h.kind === "mob")) {
      return done(state, { text: guide.a, kind: "guide" }, { kind: h.kind, ref: h.ref });
    }

    let res = null;
    const ref = h.ref;
    switch (h.kind) {
      case "item":
        if (want === "obtain" || want === "ylevel") {
          const ore = D.ores.find((o) => ref.name.toLowerCase().startsWith(o[0].toLowerCase()));
          res = ore && !ref.grid && !ref.shapeless && want === "ylevel" ? obtainAnswer(ref, { name: ore[0], y: ore[1], tool: ore[2], tip: ore[3] }) : obtainAnswer(ref);
        } else if (want === "info" && ref.info) res = { text: `${ref.name}: ${ref.info}` + (ref.grid || ref.shapeless ? ` Want the recipe?` : ref.how ? " " + ref.how : ""), kind: "info", item: ref, offerRecipe: !!(ref.grid || ref.shapeless) };
        else if (want === "info" && ref.how) res = { text: `${ref.name}: ${ref.how}`, kind: "info", item: ref };
        else if (want === "kill" || want === "tame") {
          const mob = D.mobs.find((x) => x[0].toLowerCase() === ref.name.toLowerCase());
          res = mob ? mobAnswer({ name: mob[0], hp: mob[1], type: mob[2], info: mob[3] }) : recipeAnswer(ref, generic && !inContext);
        } else res = recipeAnswer(ref, generic && !inContext);
        break;
      case "mob":
        if (want === "feed" || want === "breed") {
          const food = D.feed[ref.name];
          const real = REAL_DIET[ref.name];
          const plural = /^(sheep|cod|salmon|squid|glow squid|tropical fish|pufferfish)$/i.test(ref.name) ? ref.name.toLowerCase() : ref.name.toLowerCase().replace(/(sh|ch|x)$/, "$1e").replace(/y$/, "ie").replace(/wolf$/, "wolve") + "s";
          const noBreed = /^(Parrot|Dolphin|Polar Bear)$/.test(ref.name);
          const emo = (real || "").match(/\s*(\p{Extended_Pictographic}[\u200d\ufe0f\p{Extended_Pictographic}]*)\s*$/u);
          const realText = real ? real.replace(/\s*\p{Extended_Pictographic}[\u200d\ufe0f\p{Extended_Pictographic}]*\s*$/u, "") : null;
          if (want === "breed") res = { text: noBreed ? `${U.capitalizeFirst(plural)} can't be bred in Minecraft.${food && ref.name === "Parrot" ? " You can tame them with seeds, though!" : ""}` : food ? `To breed ${plural}, feed two of them ${food}. Hearts appear and a baby pops out! 💕 Then wait 5 minutes before breeding them again.` : `Hmm, I don't think ${plural} can be bred in Minecraft.`, kind: "mob" };
          else if (!inContext && real) res = { text: `Real ${plural} eat ${realText}.${food ? ` (In Minecraft, you feed them ${food}.)` : ""}${emo ? " " + emo[1] : ""}`, kind: "mob" };
          else if (food) res = { text: `In Minecraft, ${plural} eat ${food}.${noBreed ? "" : " Feeding two of them makes a baby! 💕"}`, kind: "mob" };
          if (res) break;
        }
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
    mc.lastWant = mc.pendingWant;
    if (state.mcYes && res.kind === "recipe" && !/^yes/i.test(res.text)) res.text = "Yes! " + res.text;
    state.mcYes = false;
    res.text = U.capitalizeFirst(res.text);
    mc.turn = state.turn || 0;
    mc.topicTurn = mc.turn;
    if (last) mc.last = last;
    return res;
  }

  function isMinecrafty(text) { return MC_WORDS.test(text); }

  P.minecraft = { answer, findMentions, recipeCard, asciiCard, isMinecrafty, build };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
