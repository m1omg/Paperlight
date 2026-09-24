/* Pip: language front end. Cleans up what the user typed so the rest of the brain can match it:
   slang and contractions are expanded, typos are fixed against a word-frequency list learned from the
   dialogue corpus, and a small lexicon estimates the emotion of the message. */
(function (P) {
  "use strict";
  const U = P.util;

  // chat slang -> plain words (applied to whole tokens only)
  const SLANG = {
    u: "you", ya: "you", yu: "you", ur: "your", urs: "yours", r: "are", y: "why", n: "and", k: "ok", kk: "ok",
    okay: "ok", okey: "ok", okk: "ok", oki: "ok", okie: "ok", thx: "thanks", thnx: "thanks", thanx: "thanks",
    ty: "thank you", tysm: "thank you so much", tyvm: "thank you very much", pls: "please", plz: "please",
    plez: "please", idk: "i do not know", idc: "i do not care", dunno: "do not know", imo: "in my opinion",
    imho: "in my opinion", tbh: "to be honest", rn: "right now", atm: "at the moment", wbu: "what about you",
    hbu: "how about you", wyd: "what are you doing", hru: "how are you", wru: "where are you", wanna: "want to",
    gonna: "going to", gotta: "got to", lemme: "let me", gimme: "give me", kinda: "kind of", sorta: "sort of",
    cuz: "because", coz: "because", cos: "because", bc: "because", becuz: "because", bcuz: "because",
    sup: "what is up", wassup: "what is up", wazzup: "what is up", whatsup: "what is up", gn: "good night",
    gm: "good morning", nite: "night", tho: "though", thru: "through", pic: "picture", pics: "pictures",
    ppl: "people", bday: "birthday", b4: "before", gr8: "great", l8r: "later", ltr: "later", cya: "see you",
    cu: "see you", brb: "be right back", ttyl: "talk to you later", nvm: "never mind", nm: "not much",
    omw: "on my way", ily: "i love you", ilysm: "i love you so much", luv: "love", fav: "favorite",
    fave: "favorite", favourite: "favorite", colour: "color", colours: "colors", w: "with", wo: "without",
    abt: "about", bout: "about", ngl: "not going to lie", fr: "for real", frfr: "for real", jk: "just kidding",
    msg: "message", yr: "year", yrs: "years", hr: "hour", hrs: "hours", min: "minute", mins: "minutes",
    sec: "second", secs: "seconds", tmr: "tomorrow", tmrw: "tomorrow", tomorow: "tomorrow", "2day": "today",
    "2morrow": "tomorrow", "2nite": "tonight", tonite: "tonight", srsly: "seriously", prob: "probably",
    probs: "probably", def: "definitely", defo: "definitely", obv: "obviously", obvi: "obviously",
    mc: "minecraft", mincraft: "minecraft", minecarft: "minecraft", minecaft: "minecraft", yeh: "yeah",
    ye: "yeah", yea: "yeah", yup: "yep", yas: "yes", yass: "yes", ofc: "of course", np: "no problem",
    mb: "my bad", smth: "something", sth: "something", sm: "so much", ik: "i know", iirc: "if i remember correctly",
    wdym: "what do you mean", hmu: "hit me up", bff: "best friend", bf: "boyfriend", gf: "girlfriend",
    dm: "message", irl: "in real life", ima: "i am going to", imma: "i am going to",
    wat: "what", wut: "what", wht: "what", whta: "what", hw: "how", hows: "how is", whos: "who is",
    wheres: "where is", whens: "when is", whys: "why is", thats: "that is", whats: "what is", its: "it is",
    lets: "let us", im: "i am", ive: "i have", youre: "you are", youve: "you have", theyre: "they are",
    dont: "do not", doesnt: "does not", didnt: "did not", cant: "cannot", couldnt: "could not",
    wouldnt: "would not", shouldnt: "should not", wont: "will not", isnt: "is not", arent: "are not",
    wasnt: "was not", werent: "were not", havent: "have not", hasnt: "has not", hadnt: "had not",
    aint: "is not", howd: "how did", whatd: "what did", wouldve: "would have",
    couldve: "could have", shouldve: "should have", alot: "a lot", everytime: "every time",
    goodnight: "good night", goodmorning: "good morning", nothin: "nothing", somethin: "something",
    doin: "doing", goin: "going", luvs: "loves", bruh: "bro",
  };

  const CONTRACTIONS = [
    [/\bcan't\b/g, "cannot"], [/\bwon't\b/g, "will not"], [/\bshan't\b/g, "shall not"], [/\bain't\b/g, "is not"],
    [/\blet's\b/g, "let us"], [/\bi'm\b/g, "i am"], [/\b(\w+)n't\b/g, "$1 not"], [/\b(\w+)'re\b/g, "$1 are"],
    [/\b(\w+)'ve\b/g, "$1 have"], [/\b(\w+)'ll\b/g, "$1 will"], [/\b(\w+)'d\b/g, "$1 would"],
    [/\b(he|she|it|that|what|who|where|when|how|there|here|why)'s\b/g, "$1 is"],
  ];

  // word -> emotion (weights). Negation within 3 words flips positive/negative moods.
  const EMO = {};
  function addEmo(cat, words, w) { for (const x of words.split(" ")) EMO[x] = { cat, w: w || 1 }; }
  addEmo("sad", "sad unhappy depressed depressing miserable upset heartbroken crying cry cried tears gloomy hopeless " +
    "devastated disappointed disappointing awful terrible horrible worst hurt hurting grief grieving broken down low " +
    "bummed sucks sucked suck crappy lousy shitty rough blue meh blah unmotivated empty numb worthless useless failure " +
    "failed fail sadness sorrow heartbreak dumped rejected", 1);
  addEmo("lonely", "lonely alone isolated lonesome friendless ignored excluded unloved unwanted invisible", 1.2);
  addEmo("lonely", "miss missing", 0.7);
  addEmo("sad", "bad tough guilty ashamed embarrassed homesick regret sadder saddest crap cries garbage", 0.8);
  addEmo("angry", "whatever ugh pissed", 0.6);
  addEmo("angry", "unfair jealous", 0.9);
  addEmo("anxious", "scary awkward freaking panicky shaky", 0.8);
  addEmo("anxious", "anxious anxiety worried worry worrying nervous scared afraid stressed stress stressful panic " +
    "panicking overwhelmed terrified frightened tense uneasy dread dreading fear fearful insecure paranoid", 1.1);
  addEmo("angry", "angry mad furious annoyed annoying irritated pissed frustrated frustrating hate hated rage livid " +
    "outraged fuming salty grumpy cranky", 1.1);
  addEmo("tired", "tired exhausted sleepy drained fatigued exhausting knackered sleepless insomnia", 1);
  addEmo("bored", "bored boring boredom dull", 1.2);
  addEmo("happy", "happy glad great good awesome amazing fantastic wonderful excited thrilled joy joyful cheerful " +
    "nice cool delighted pumped stoked proud grateful thankful blessed relieved excellent fabulous brilliant " +
    "super lovely perfect best fun ecstatic elated content satisfied yay yippee hooray woohoo lit epic " +
    "incredible terrific splendid better calmer calm safe okayish hopeful", 1);
  addEmo("sick", "sick ill fever flu covid headache migraine nauseous vomiting puking cough coughing sore injured " +
    "hospital", 1.1);
  addEmo("love", "love loving crush adore", 0.6);
  const NEGATORS = new Set(["not", "no", "never", "nothing", "hardly", "barely", "without", "nor", "neither"]);
  const INTENS = new Set(["so", "very", "really", "super", "extremely", "incredibly", "totally", "quite", "too", "sooo", "soo", "hella", "mega"]);

  // --- dictionary for spell correction -------------------------------------------------------------
  const dict = new Map();          // word -> frequency score
  let dictReady = false;
  let delIndex = null;             // deletion-variant index for fast typo lookup
  function addWords(words, score) {
    delIndex = null; // rebuild the typo index so new words can be suggested
    for (const w of words) {
      if (!w || w.length < 1) continue;
      const cur = dict.get(w) || 0;
      if (score > cur) dict.set(w, score);
    }
  }
  function ensureDict() {
    if (dictReady) return;
    dictReady = true;
    const list = (P.data && P.data.words) || "";
    if (list) {
      const words = list.split(" ");
      // rank-based score: common words win ties
      for (let i = 0; i < words.length; i++) addWords([words[i]], 1 / Math.log(i + 3));
    }
    addWords(Object.values(SLANG).join(" ").split(" "), 0.5);
    addWords(Object.keys(EMO), 0.3);
  }
  // candidate index by deletion keys (SymSpell-lite) for fast lookup of distance-1/2 neighbors
  function buildDelIndex() {
    ensureDict();
    delIndex = new Map();
    for (const w of dict.keys()) {
      if (w.length < 3 || w.length > 14) continue;
      for (const d of deletes(w)) {
        let arr = delIndex.get(d);
        if (!arr) delIndex.set(d, (arr = []));
        if (arr.length < 40) arr.push(w);
      }
    }
  }
  function deletes(w) {
    const out = new Set([w]);
    for (let i = 0; i < w.length; i++) out.add(w.slice(0, i) + w.slice(i + 1));
    return out;
  }
  function correctWord(w) {
    ensureDict();
    if (w.length < 4 || dict.has(w) || /\d/.test(w)) return w;
    if (!delIndex) buildDelIndex();
    let best = w, bestScore = 0;
    const seen = new Set();
    for (const d of deletes(w)) {
      const cands = delIndex.get(d);
      if (!cands) continue;
      for (const c of cands) {
        if (seen.has(c)) continue;
        seen.add(c);
        const dist = U.levenshtein(w, c, 2);
        if (dist > (w.length >= 7 ? 2 : 1)) continue;
        // prefer same first letter and higher frequency
        const score = (dict.get(c) || 0) * (dist === 1 ? 1 : 0.35) * (c[0] === w[0] ? 1 : 0.5);
        if (score > bestScore) { bestScore = score; best = c; }
      }
    }
    return best;
  }
  function knownWord(w) { ensureDict(); return dict.has(w); }

  // --- normalization ---------------------------------------------------------------------------------
  function basicClean(text) {
    return String(text || "")
      .replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...")
      .replace(/[–—]/g, " - ").replace(/\s+/g, " ").trim();
  }

  // collapse "sooooo" -> "soo", "hiiii" -> "hii" (then spell-fix can finish the job)
  function squeeze(w) { return w.replace(/(\w)\1{2,}/g, "$1$1"); }

  const LAUGH = /^(a?(ha){2,}h?|(he){2,}|(hi){3,}|l+o+l+(o+l+)*|lmf?a+o+|rofl|xd+|kek|haha\w*|jaja\w*)$/;

  function normalize(text, opts) {
    opts = opts || {};
    let s = basicClean(text).toLowerCase();
    s = s.replace(/[’]/g, "'");
    for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
    s = s.replace(/(\d),(\d{3})/g, "$1$2");            // 1,000 -> 1000
    s = s.replace(/([a-z])([?!.,;:])/g, "$1 $2").replace(/([?!.,;:])([a-z])/g, "$1 $2");
    const raw = s.split(/\s+/).filter(Boolean);
    const out = [];
    for (let ri = 0; ri < raw.length; ri++) {
      const t = raw[ri];
      const core = t.replace(/^[^a-z0-9<]+|[^a-z0-9>+%]+$/g, "");
      if (!core) { if (/[?!]/.test(t)) out.push(t.replace(/[^?!]/g, "").slice(0, 1)); continue; }
      let w = squeeze(core);
      if (LAUGH.test(w)) { out.push("haha"); continue; }
      if (w === "y" && /^(lev|lvl|=|-?\d|coord|axis|value|is|of)/.test(raw[ri + 1] || "")) { out.push("y"); continue; }
      if (SLANG[w] !== undefined) { out.push(...SLANG[w].split(" ")); continue; }
      if (opts.spell !== false && /^[a-z]+$/.test(w)) {
        const fixed = correctWord(w);
        if (fixed !== w && SLANG[fixed] !== undefined) { out.push(...SLANG[fixed].split(" ")); continue; }
        w = fixed;
      }
      out.push(w);
      if (/[?!]$/.test(t)) out.push(t.slice(-1));
    }
    return out.join(" ").replace(/\s+([?!])/g, "$1").trim();
  }

  function words(s) { return (s.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) || []); }

  // light stemmer: enough to match "crafting"/"craft", "pickaxes"/"pickaxe", "loved"/"love"
  function stem(w) {
    if (w.length <= 3) return w;
    if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + "y";
    if (/(ss|us|is)$/.test(w)) return w;
    if (/ing$/.test(w) && w.length > 5) { const b = w.slice(0, -3); return /(\w)\1$/.test(b) && !/(ll|ss|zz)$/.test(b) ? b.slice(0, -1) : b; }
    if (/ed$/.test(w) && w.length > 4) { const b = w.slice(0, -2); return /(\w)\1$/.test(b) && !/(ll|ss)$/.test(b) ? b.slice(0, -1) : b; }
    if (/es$/.test(w) && /(ch|sh|x|z|ss)es$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    if (/ly$/.test(w) && w.length > 5) return w.slice(0, -2);
    return w;
  }

  const STOP = new Set(("a an the is am are was were be been being to of in on at for with by from and or but so if " +
    "then than that this these those it its i me my you your he she him her they them their we us our do does did " +
    "have has had just very really quite can could would should will shall may might must there here what which who " +
    "whom whose how when where why not no yes oh um uh hmm like").split(" "));

  // --- emotion ----------------------------------------------------------------------------------------
  function emotion(tokens) {
    const scores = {};
    for (let i = 0; i < tokens.length; i++) {
      const e = EMO[tokens[i]];
      if (!e) continue;
      // "my best friend" / "have fun at school" style phrases are not feelings
      if (tokens[i] === "best" && /^(friends?|part|thing|way|mate|buddy)$/.test(tokens[i + 1] || "")) continue;
      let w = e.w;
      let neg = false;
      // "not happy" is negated, but in "I don't know, it's fun" the "not" belongs to "know"
      for (let j = Math.max(0, i - 4); j < i; j++) if (NEGATORS.has(tokens[j]) && (tokens[j] !== "no" || j === i - 1) && (i - j <= 3 || tokens[j] === "not") && !/^(know|sure|think|care|mind|get|understand|remember)$/.test(tokens[j + 1] || "")) neg = true;
      if (i > 0 && INTENS.has(tokens[i - 1])) w *= 1.5;
      let cat = e.cat;
      if (neg) {
        if (cat === "happy") cat = "sad";
        else if (cat === "love") continue;
        else { scores.happy = (scores.happy || 0) + 0.3; continue; }  // "not sad" is mildly positive
      }
      // "good"/"fine" are weak signals on their own
      if (cat === "happy" && /^(good|nice|cool|fine|best|super|fun|perfect)$/.test(tokens[i])) w *= 0.6;
      scores[cat] = (scores[cat] || 0) + w;
    }
    const joined = " " + tokens.join(" ") + " ";
    if (/ (by myself|on my own|no one to|nobody to|(do not|don't|dont) (really |even )?have (anyone|anybody|any friends)|no friends|have nobody|have no one|nobody to talk to|sit alone|eat alone|nobody (listens|cares|does|understands|gets it)|no one (listens|cares|understands)|(does not|doesn't|doesnt|do not|don't|dont) (even )?listen) /.test(joined)) scores.lonely = (scores.lonely || 0) + 1.2;
    let best = null, bestV = 0;
    for (const k in scores) if (scores[k] > bestV) { best = k; bestV = scores[k]; }
    const positive = (scores.happy || 0) + (scores.love || 0) * 0.5;
    const negative = (scores.sad || 0) + (scores.lonely || 0) + (scores.anxious || 0) + (scores.angry || 0) +
      (scores.tired || 0) * 0.6 + (scores.bored || 0) * 0.5 + (scores.sick || 0);
    return { label: best, strength: bestV, scores, valence: positive - negative };
  }

  // --- analysis of one user message -------------------------------------------------------------------
  const QWORDS = /^(what|whats|who|whom|whose|where|when|why|how|which|is|are|am|was|were|do|does|did|can|could|would|will|should|shall|have|has|had|may|might|wanna|any|anything|tell me|explain)\b/;

  function analyze(raw) {
    const clean = basicClean(raw);
    const norm = normalize(clean);
    const plain = normalize(clean, { spell: false });
    const toks = words(norm);
    const stems = toks.map(stem);
    const isQuestion = /\?\s*$/.test(clean) || QWORDS.test(norm) || /\b(right|yeah|no)\?$/.test(norm);
    let emo = emotion(toks);
    // "great. even the ai doesn't listen to me": a sarcastic "great" in front of a complaint
    if (/^(great|perfect|awesome|wonderful|fantastic|nice|cool|lovely|brilliant|wow|thanks|oh great|just great|oh wow|oh nice|yay)[.,!]+\s+\S/i.test(clean.trim())) {
      const rest = emotion(toks.slice(toks[1] === "great" || toks[1] === "wow" || toks[1] === "nice" ? 2 : 1));
      if (rest.valence < 0 || /\b(not|never|nobody|no one|even|ugh|hate|doesn'?t|don'?t|didn'?t|can'?t|won'?t)\b/.test(norm)) emo = Object.assign({}, rest, { valence: Math.min(rest.valence, 0) - 0.6, label: rest.label || "sad", strength: Math.max(rest.strength, 0.9), sarcasm: true });
    }
    return {
      raw: String(raw || ""), clean, lower: clean.toLowerCase(), norm, plain, tokens: toks, stems,
      content: stems.filter((w) => !STOP.has(w)), isQuestion, emotion: emo,
      isShort: toks.length <= 2, empty: toks.length === 0,
    };
  }

  // --- TF-IDF index (unigram + bigram stems) for matching messages against examples -------------------
  function features(stems) {
    const f = new Map();
    for (let i = 0; i < stems.length; i++) {
      const w = stems[i];
      f.set(w, (f.get(w) || 0) + (STOP.has(w) ? 0.35 : 1));
      if (i + 1 < stems.length) { const b = w + "_" + stems[i + 1]; f.set(b, (f.get(b) || 0) + 0.8); }
    }
    return f;
  }
  class TfIdf {
    constructor() { this.docs = []; this.df = new Map(); this.built = false; }
    add(text, payload) { this.docs.push({ stems: words(normalize(text, { spell: false })).map(stem), payload }); this.built = false; }
    build() {
      this.df.clear();
      for (const d of this.docs) { d.f = features(d.stems); for (const k of d.f.keys()) this.df.set(k, (this.df.get(k) || 0) + 1); }
      const N = this.docs.length;
      this.idf = (k) => Math.log((N + 1) / ((this.df.get(k) || 0) + 1)) + 1;
      for (const d of this.docs) d.vec = this.weigh(d.f);
      this.built = true;
    }
    weigh(f) {
      const v = new Map(); let n = 0;
      for (const [k, c] of f) { const x = (1 + Math.log(c)) * this.idf(k); v.set(k, x); n += x * x; }
      n = Math.sqrt(n) || 1;
      for (const [k, x] of v) v.set(k, x / n);
      return v;
    }
    query(stems, k) {
      if (!this.built) this.build();
      const q = this.weigh(features(stems));
      const res = [];
      for (const d of this.docs) {
        let s = 0;
        const [small, big] = q.size < d.vec.size ? [q, d.vec] : [d.vec, q];
        for (const [key, x] of small) { const y = big.get(key); if (y) s += x * y; }
        if (s > 0) res.push({ score: s, payload: d.payload, doc: d });
      }
      res.sort((a, b) => b.score - a.score);
      return res.slice(0, k || 5);
    }
  }

  P.nlp = { normalize, basicClean, words, stem, analyze, emotion, correctWord, knownWord, addWords, TfIdf, STOP, SLANG };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
