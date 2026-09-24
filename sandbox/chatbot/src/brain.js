/* Pip: the dialogue manager. Every message goes through the same pipeline:
     safety -> what Pip was waiting for (a name, yes/no, a game move) -> memory -> skills
     (math, Minecraft, time, facts...) -> intents -> feelings -> neural chat -> ELIZA-style fallback.
   Each stage can answer; the brain keeps short-term state (what it asked, the current game, topics)
   and long-term memory (the user profile), and it avoids repeating itself. */
(function (P) {
  "use strict";
  const U = P.util, N = P.nlp, C = P.content, S = P.skills, MEM = P.memory;
  const pick = U.pick;

  const PART_OF_DAY = () => { const h = new Date().getHours(); return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night"; };
  const YES = /^(yes|yeah|yep|yup|sure|ok|okay|of course|definitely|absolutely|please|yes please|why not|let's do it|lets do it|go ahead|go for it|alright|y|ye|ya|yea|uh huh|mhm|sounds good|sure thing|totally|i do|i would|i guess|ok sure|sure why not|do it|another|another one|one more|again|more)\b/;
  const NO = /^(no|nope|nah|not really|no thanks|no thank you|not now|maybe later|i'm good|i am good|i'm ok|i am ok|never|no way|pass|stop|not today|i do not|i don't|n)\b/;

  // ELIZA-style reflection for statements nobody else handled
  const REFLECT = { i: "you", me: "you", my: "your", mine: "yours", myself: "yourself", am: "are", was: "were", "i'm": "you're",
    you: "I", your: "my", yours: "mine", yourself: "myself", are: "am", "you're": "I'm", we: "you", our: "your", us: "you" };
  function reflect(s) { return s.split(/\s+/).map((w) => (REFLECT[w] !== undefined ? REFLECT[w] : w)).join(" ").replace(/\bI am\b/g, "I am").replace(/\byou am\b/g, "you are").replace(/\bI are\b/g, "I am"); }
  const ELIZA = [
    [/^i (?:want|wanna|would like|would love|hope) to (.{3,60})$/, ["Why do you want to {1}?", "That sounds like a great goal! What would be the first step?", "Ooh! What made you want to {1}?"]],
    [/^i (?:want|wanna|would like|would love) ((?:a |an |some |the |more )?.{3,60})$/, ["Why do you want {1}?", "What would you do with {1}?", "Ooh, {1}! What made you want that?"]],
    [/^i need (?:to )?(.{3,60})$/, ["Why do you need {1}?", "Would {1} really help you?", "What would happen if you did?"]],
    [/^i (?:think|believe|guess) (?:that )?(.{3,60})$/, ["What makes you think {1}?", "Do you really think so?", "Interesting! Why do you think that?"]],
    [/^i (?:can not|cannot|can't) (.{3,60})$/, ["What makes you think you can't {1}?", "Have you tried? Sometimes it just takes practice!", "Maybe you can, just not yet! 💪"]],
    [/^i (?:do not|don't) (.{3,60})$/, ["Why don't you {1}?", "Do you wish you did?", "Fair enough! Why not?"]],
    [/^i (?:just |recently )?(?:finished|made|built|drew|wrote|won|learned|started|beat|completed) (.{3,60})$/, ["Nice! Tell me more about it!", "Ooh, how did that go?", "That's cool! How do you feel about it?"]],
    [/^my (\w+) (?:is|was|are|were) (.{2,50})$/, ["Why do you say your {1} is {2}?", "Tell me more about your {1}!", "How do you feel about that?"]],
    [/^(?:because|cause|cuz) (.{3,60})$/, ["That makes sense.", "Is that the only reason?", "Oh, I see!"]],
    [/^(?:do|can|will|would|should|could|are|is|have) you (.{3,60})\?*$/, ["Hmm, I'm not sure I can {1}! What about you?", "Good question! What do you think?"]],
  ];

  class Brain {
    constructor(opts) {
      opts = opts || {};
      this.storage = opts.storage || null;
      this.mem = opts.memory || MEM.load(this.storage);
      this.neural = opts.neural || null;
      this.state = { turn: 0, history: [], expect: null, game: null, quiet: 0, recent: [], shortStreak: 0, lastIntent: null, mc: null };
      this.debug = !!opts.debug;
      this._buildIntents();
      if (P.minecraft) P.minecraft.build(); // teaches the spell checker all Minecraft words up front
    }

    _buildIntents() {
      this.intentIndex = new N.TfIdf();
      this.intentById = {};
      for (const it of C.intents) {
        this.intentById[it.id] = it;
        for (const ex of it.ex || []) this.intentIndex.add(ex, it.id);
      }
      this.intentIndex.build();
    }

    get botName() { return this.mem.botName || "Pip"; }

    // opening line when the chat is (re)opened
    greet() {
      const mem = this.mem;
      mem.sessions = (mem.sessions || 0) + 1;
      const away = mem.lastSeen ? Date.now() - mem.lastSeen : null;
      mem.lastSeen = Date.now();
      this.save();
      let text, expect = null;
      if (!mem.name && mem.messages < 3) {
        text = `Hi! I'm ${this.botName}, your AI buddy. 👋 I can chat, remember things about you, tell jokes, do exact math, play games, and I know a LOT about Minecraft. What's your name?`;
        expect = { kind: "name" };
      } else {
        const fu = MEM.followUp(mem);
        const n = mem.name ? " " + mem.name : "";
        if (fu) text = `${pick(["Hey", "Hi", "Welcome back"])}${n}! 😊 ${fu}`;
        else if (away && away > 3 * 864e5) text = `${n ? U.capitalizeFirst(n.trim()) + "! " : ""}It's been a while! I missed you. 😊 How have you been?`;
        else text = pick([`Hey${n}! 👋 How's your ${PART_OF_DAY()} going?`, `Welcome back${n}! 😊 What's new?`, `Hi${n}! Good to see you again. How are you?`]);
        if (!fu) expect = { kind: "howareyou" };
      }
      this.state.expect = expect;
      this._remember("bot", text);
      return { text, source: "greeting" };
    }

    save() { MEM.save(this.mem, this.storage); }

    reset(all) {
      if (all) { const bot = this.mem.botName; this.mem = MEM.blank(); this.mem.botName = bot; }
      this.state = { turn: 0, history: [], expect: null, game: null, quiet: 0, recent: [], shortStreak: 0, lastIntent: null, mc: null };
      this.save();
    }

    _remember(role, text) {
      this.state.history.push({ role, text });
      if (this.state.history.length > 16) this.state.history.shift();
      if (role === "bot") { this.state.recent.push(text); if (this.state.recent.length > 40) this.state.recent.shift(); }
    }

    ctx(m) {
      const self = this;
      const lastBot = [...this.state.history].reverse().find((h) => h.role === "bot");
      const lastUser = [...this.state.history].reverse().find((h) => h.role === "user");
      return {
        mem: this.mem, name: this.mem.name, bot: this.botName, m, state: this.state, partOfDay: PART_OF_DAY(),
        lastBot: lastBot && lastBot.text, lastUser: lastUser && lastUser.text, lastIntent: this.state.lastIntent,
        neuralSize: this.neural && this.neural.gptParams ? (this.neural.gptParams / 1e6).toFixed(1) + " million" : null,
        get followUp() { return MEM.followUp(self.mem); },
        skill: (k) => S.start(k, this.ctx(m)),
        stall: (idk) => self._stall(idk),
      };
    }

    _stall(idk) {
      const st = this.state;
      const exp = st.lastExpect;
      if (idk && exp && (exp.kind === "open" || exp.kind === "favorite" || exp.kind === "pets")) return pick(["That's okay! No pressure. 😊", "Fair enough! Not everything needs an answer.", "No worries! We can talk about something else."]);
      if (st.shortStreak >= 2 && !st.quiet) {
        st.shortStreak = 0;
        return U.chance(0.5) ? S.start("question", this.ctx(null)) : { text: pick(["Want to play a game? 🎮 Or I could tell you a fun fact!", "Hmm, let's liven things up! Joke, riddle or trivia? 😄"]), chips: ["Tell me a joke", "Riddle", "Trivia"] };
      }
      return pick(["😊", "Cool cool.", "Alright! 😄", "Mhm!", "Nice.", "👍"]).concat(U.chance(0.4) && !st.quiet ? " " + pick(C.stalls).replace(/^(Cool|Nice|Got it|Alright|Okay|Mhm)! (😊 )?/, "") : "");
    }

    // ---------- main entry ----------
    async reply(text) {
      const st = this.state, mem = this.mem;
      st.turn++;
      mem.messages = (mem.messages || 0) + 1;
      mem.lastSeen = Date.now();
      // "hey Pip, how's it going?" -> answer "how's it going?" and greet back
      let greetBack = "";
      const bn = this.botName.toLowerCase().replace(/[^a-z]/g, "");
      const lead = new RegExp("^\\s*((?:hi+|hello+|hey+|heya|hiya|yo|howdy|good (?:morning|afternoon|evening))(?: there)?(?: (?:" + bn + "|buddy|friend))?|" + bn + ")\\s*[,!.:;-]+\\s*(.{2,})$", "i").exec(N.basicClean(text));
      if (lead && !/^(my name|i am|i'm|im|it's|its|this is)\b/i.test(lead[2])) {
        if (!new RegExp("^" + bn + "$", "i").test(lead[1])) greetBack = pick(["Hi", "Hey", "Hello"]) + (mem.name ? " " + mem.name : "") + "! ";
        text = lead[2];
      }
      text = String(text).replace(new RegExp("[,\\s]+" + bn + "[?!.]*$", "i"), (x) => x.replace(/[^?!.]/g, ""));
      const m = N.analyze(text);
      const c = this.ctx(m);
      const trace = [];
      const expect = st.expect;
      st.lastExpect = expect;
      st.expect = null;
      if (st.quiet > 0) st.quiet--;
      st.shortStreak = m.tokens.length <= 2 ? st.shortStreak + 1 : 0;

      let out = null;
      if (m.empty) out = { text: pick(["You can type anything! 😊", "Hm? Say something! I'm listening.", "👀"]), source: "empty" };

      // 0) safety first
      if (!out && C.safety.crisis.test(m.plain)) out = { text: C.safety.reply, source: "safety", expect: { kind: "vent", emotion: "sad" } };

      // 1) memory facts ("my name is...", "I have a dog", "my favorite color is...")
      const facts = out ? [] : MEM.extract(mem, m, expect);

      // 2) whatever Pip was waiting for
      if (!out && expect) out = this._onExpect(expect, m, c, facts);
      // 3) a running game
      if (!out && st.game) { const g = S.gameTurn(m, c); if (g) out = Object.assign(g, { source: "game:" + (st.game ? st.game.type : "end") }); }
      // 4) commands and memory questions
      if (!out) out = this._commands(m, c);
      if (!out) { const r = MEM.recall(mem, m); if (r) out = Object.assign(r, { source: "memory" }); }
      // 5) facts just learned get a warm acknowledgement
      if (!out && facts.length) out = this._ackFacts(facts, m, c);
      // 6) exact skills
      if (!out) out = this._skills(m, c, trace);
      // 7) intents, feelings, opinions, neural chat, fallback: scored candidates
      if (!out) out = await this._open(m, c, trace, expect);

      if (typeof out === "string") out = { text: out };
      if (greetBack && !/^(hi|hey|hello|good (morning|afternoon|evening)|oh hi|welcome)\b/i.test(out.text)) out.text = greetBack + out.text;
      out.text = this._post(out.text);
      if (st.recent.includes(out.text) && out.alts && out.alts.length) out.text = this._post(pick(out.alts));
      if (out.expect) st.expect = out.expect;
      if (out.intent) st.lastIntent = out.intent; else if (out.source && out.source.startsWith("intent:")) st.lastIntent = out.source.slice(7);
      else st.lastIntent = null;
      this._remember("user", m.clean);
      this._remember("bot", out.text);
      this.save();
      if (this.debug || out.debug) out.trace = trace;
      return out;
    }

    // ---------- stages ----------
    _onExpect(ex, m, c, facts) {
      const t = m.norm;
      const isYes = YES.test(t) && m.tokens.length <= 5, isNo = NO.test(t) && m.tokens.length <= 6;
      switch (ex.kind) {
        case "name": {
          const f = facts.find((x) => x.type === "name");
          if (f) return this._nameAck(f.value, m, c);
          if (/\b(no|nope|why|secret|not telling|i (do not|don't|dont) want|rather not|none of your|guess)\b/.test(t) && m.tokens.length <= 8)
            return { text: pick(["That's okay! I'll just call you friend. 😊 So, what's up?", "No problem! A mystery friend, how exciting. 🕵️ What would you like to talk about?"]), source: "expect:name" };
          return null;
        }
        case "age": if (facts.some((x) => x.type === "age")) return null; break;
        case "location": if (facts.some((x) => x.type === "location")) return null;
          if (m.tokens.length <= 4 && !m.isQuestion && !isNo) {
            const v = m.clean.replace(/^(i live in|i am from|i'm from|im from|from|in)\s+/i, "").replace(/[.!]+$/, "").trim();
            if (v && v.length < 40 && !/\b(idk|dunno|not telling|secret|no)\b/i.test(v)) { MEM.apply(this.mem, { type: "location", value: U.titleCase(v.toLowerCase()) }); return { text: `${U.titleCase(v.toLowerCase())}! Cool! 🌍 What's it like there?`, source: "expect:location", expect: { kind: "open", topic: "home" } }; }
          }
          break;
        case "favorite": {
          const f = facts.find((x) => x.type === "favorite");
          if (f) return null; // acknowledged by _ackFacts
          break;
        }
        case "pets": {
          if (facts.some((x) => x.type === "pet")) return null;
          if (isYes) return { text: "Yay! 🐾 What kind of pet? And what's its name?", source: "expect:pets", expect: { kind: "open", topic: "pets" } };
          if (isNo) return { text: pick(["Aw! Would you like one someday? If I could, I'd get an axolotl. 🦎", "No pets? That's okay! If you could have any animal as a pet, what would it be?"]), source: "expect:pets", expect: { kind: "open", topic: "dream pet" } };
          break;
        }
        case "petname": {
          const w = m.clean.replace(/^(his|her|its|their|the) name is |^(it's|its|he's|hes|she's|shes) /i, "").replace(/[.!]+$/, "").trim();
          if (w && w.split(" ").length <= 2 && MEM.looksLikeName(w.split(" ")[0], m.clean, true)) {
            MEM.apply(this.mem, { type: "pet", kind: ex.pet, name: U.titleCase(w.toLowerCase()) });
            return { text: `${U.titleCase(w.toLowerCase())}! That's an adorable name for ${U.aOrAn(ex.pet)} ${ex.pet}. 🐾`, source: "expect:petname" };
          }
          break;
        }
        case "mcrecipe": {
          if (isYes) {
            const r = P.minecraft.answer(N.analyze("how do i craft " + ex.item), Object.assign(this.state, { turn: this.state.turn }));
            if (r) return { text: r.text, card: r.card, ascii: r.ascii, source: "skill:minecraft" };
          }
          if (isNo) return { text: "Okay! 😊", source: "expect:no" };
          break;
        }
        case "yesno": {
          if (isYes && ex.yesAction === "forgetAll") { this.reset(true); return { text: ex.yesText, source: "command:forget", expect: ex.then }; }
          if (isYes) {
            if (typeof ex.yes === "string") { const r = S.start(ex.yes, c); if (r) return Object.assign(r, { source: "expect:yes" }); }
            if (ex.yesText) return { text: ex.yesText, source: "expect:yes", expect: ex.then };
          }
          if (isNo) return { text: ex.noText || pick(["Okay! What would you like to do instead?", "No problem! 😊", "Alright! Just let me know if you change your mind."]), source: "expect:no" };
          break;
        }
        case "pickgame": {
          const g = /\b(rock|paper|scissors|rps)\b/.test(t) ? "rps" : /\b(guess|number)\b/.test(t) ? "guess" : /\btrivia|quiz\b/.test(t) ? "trivia" : /\briddle/.test(t) ? "riddle" : /\bwould you rather|wyr|rather\b/.test(t) ? "wyr" : null;
          if (g) return Object.assign(S.start(g, c), { source: "game:" + g });
          if (isYes) return { text: "Pick one: rock paper scissors, guess my number, trivia, riddles or would you rather!", expect: ex, chips: ["Rock paper scissors", "Guess my number", "Trivia", "Riddle", "Would you rather"], source: "expect:pickgame" };
          break;
        }
        case "howareyou": {
          // "good, you?" / "not great" / "tired"
          const e = m.emotion;
          const askBack = /\b(you|u|yourself)\??$/.test(t) || /\b(and|what about|how about) (you|u)\b/.test(t);
          const back = askBack ? " " + pick(["I'm doing great too, thanks for asking!", "I'm good too! 😊", "Me? I'm great!"]) : "";
          if (m.tokens.length > 12 || (m.isQuestion && !askBack)) break;
          if (e.valence <= -0.5 || /\b(not (good|great|well|ok|okay|fine)|bad|terrible|awful|horrible|meh|could be better|so so|not so good)\b/.test(t)) {
            const lab = e.label && e.label !== "happy" && e.label !== "love" ? e.label : "sad";
            this._mood(lab);
            return { text: this._feelingReply(lab, m) + back, source: "expect:howareyou", expect: { kind: "vent", emotion: lab } };
          }
          if (e.valence > 0.3 || /\b(good|great|fine|well|awesome|amazing|fantastic|ok|okay|alright|not bad|pretty good|excellent|wonderful|super|perfect|chilling)\b/.test(t)) {
            const meh = /\b(ok|okay|alright|fine|not bad)\b/.test(t) && e.valence < 0.6;
            this._mood(meh ? "okay" : "happy");
            const q = meh ? pick(["Just okay? Anything on your mind?", "Okay is okay! Anything fun planned?"]) : askBack
              ? pick(["Glad to hear it! I'm doing great too, thanks for asking. 😊 What have you been up to?", "I'm good too, thanks! 😊 So what made your day good?"])
              : pick(["Glad to hear it! 😊 What have you been up to?", "Yay! What made it a good day?", "Awesome! 😄 Anything exciting happening?"]);
            return { text: meh && askBack ? back.trim() + " " + q : q, source: "expect:howareyou", expect: { kind: "open", topic: "day" } };
          }
          break;
        }
      }
      return null;
    }

    _nameAck(name, m, c) {
      const greet = /^(hi|hello|hey|yo)\b/.test(m.norm) ? pick(["Hi", "Hey", "Hello"]) + " " + name + "! " : "";
      const variants = [`Nice to meet you, ${name}! 😊`, `${name}! What a great name. 😊`, `Hi ${name}! I'm so glad to meet you. 😊`, `${name}, got it! I'll remember that. 😊`];
      const follow = pick([" How's your day going?", " What do you like to do for fun?", " So, what brings you here today?", " How are you doing?"]);
      const text = (greet ? greet + "Nice to meet you! 😊" : pick(variants)) + follow;
      return { text, source: "memory:name", expect: /day|doing/.test(follow) ? { kind: "howareyou" } : { kind: "open", topic: "intro" } };
    }

    _ackFacts(facts, m, c) {
      const f = facts.find((x) => x.type === "name") || facts.find((x) => x.type === "event") || facts.find((x) => x.type === "pet") ||
        facts.find((x) => x.type === "favorite") || facts.find((x) => x.type === "age") || facts.find((x) => x.type === "note") ||
        facts.find((x) => x.type === "birthday") || facts.find((x) => x.type === "location") || facts.find((x) => x.type === "job") ||
        facts.find((x) => x.type === "school") || facts.find((x) => x.type === "person") || facts.find((x) => x.type === "like") || facts.find((x) => x.type === "dislike");
      const P0 = C.persona;
      switch (f.type) {
        case "name": return f.prev && f.prev !== f.value ? { text: `Oh, ${f.value}! Got it, I'll call you ${f.value} from now on. 😊`, source: "memory:name" } : this._nameAck(f.value, m, c);
        case "age": {
          const a = f.value;
          const tail = a < 13 ? "That's a great age! 😊 What grade are you in?" : a < 20 ? "Nice! 😊 Are you in school?" : a < 30 ? "Cool! Do you work or study?" : "Cool! What do you do?";
          return { text: `${a}! ${tail}`, source: "memory:age", expect: { kind: "open", topic: "school/work" } };
        }
        case "location": return { text: `${f.value}! ${pick(["Cool! 🌍 What's it like there?", "I've never been there (I've never been anywhere 😄). What's it like?", "Nice! What's your favorite thing about living there?"])}`, source: "memory:location", expect: { kind: "open", topic: "home" } };
        case "birthday": return { text: f.value === "today" ? "It's your birthday TODAY?! 🎉🎂 Happy birthday! Any plans?" : `${f.value}, noted! 🎂 I'll remember that.`, source: "memory:birthday" };
        case "favorite": {
          const mine = P0.favorites[f.slot];
          const same = mine && mine.toLowerCase().startsWith(f.value.toLowerCase());
          const praise = pick([`${U.capitalizeFirst(f.value)}? Great choice!`, `Ooh, ${f.value}! Nice.`, `${U.capitalizeFirst(f.value)}! I like that.`]);
          return { text: same ? `No way, ${f.value} is my favorite too! 🤝` : mine ? `${praise} Mine is ${mine}.` : `${praise} I'll remember that! 😊`, source: "memory:favorite" };
        }
        case "pet": {
          const who = f.name || "them";
          const emoji = { dog: "🐶", puppy: "🐶", cat: "🐱", kitten: "🐱", fish: "🐟", hamster: "🐹", rabbit: "🐰", bunny: "🐰", bird: "🐦", parrot: "🦜", horse: "🐴", turtle: "🐢", snake: "🐍", axolotl: "🦎" }[f.kind] || "🐾";
          if (f.name) return { text: `Aww, ${f.name} is such a cute name for ${U.aOrAn(f.kind)} ${f.kind}! ${emoji} What's ${f.name} like?`, source: "memory:pet", expect: { kind: "open", topic: "pet" } };
          return { text: `You have ${U.aOrAn(f.kind)} ${f.kind}? ${emoji} That's awesome! What's its name?`, source: "memory:pet", expect: { kind: "petname", pet: f.kind }, alts: [`Aww, ${U.aOrAn(f.kind)} ${f.kind}! ${emoji} What's ${who === "them" ? "its" : who + "'s"} name?`] };
        }
        case "event": {
          const when = f.when && f.when !== "soon" ? " " + f.when : "";
          return { text: pick([`Good luck with your ${f.what}${when}! 🍀 Are you feeling ready?`, `Ooh, a ${f.what}${when}! How are you feeling about it?`, `I'll be rooting for you on your ${f.what}${when}! 💪 Nervous at all?`]) + "", source: "memory:event", expect: { kind: "open", topic: f.what } };
        }
        case "note": return { text: pick([`Got it! I'll remember that ${f.value}. 📝`, `Noted! 📝 ${U.capitalizeFirst(f.value)}.`]), source: "memory:note" };
        case "job": return { text: f.value === "student" ? "A student! 📚 What's your favorite subject?" : `${U.aOrAn(f.value) === "an" ? "An" : "A"} ${f.value}! That's cool. Do you like it?`, source: "memory:job", expect: f.value === "student" ? { kind: "favorite", slot: "subject" } : { kind: "open", topic: "job" } };
        case "school": return { text: `${U.capitalizeFirst(f.value)}! How's school going?`, source: "memory:school", expect: { kind: "open", topic: "school" } };
        case "person": return { text: `${f.name}! I'll remember your ${f.rel}'s name. 😊`, source: "memory:person" };
        case "like": {
          const v = f.value;
          const pl = P0.likes.find((l) => v.toLowerCase().includes(l));
          if (/\bminecraft\b/.test(v)) return null; // the Minecraft intent has a better answer
          return { text: pl ? pick([`I love ${pl} too! 😄 What do you like most about it?`, `Same! ${U.capitalizeFirst(pl)} is awesome. 🙌`]) : pick([`${U.capitalizeFirst(v)}? That's cool! What do you like about it?`, `Ooh, ${v}! I'll remember that you like it. 😊`, `Nice! How did you get into ${v}?`]), source: "memory:like", expect: { kind: "open", topic: v } };
        }
        case "dislike": return { text: pick([`Not a fan of ${f.value}, huh? Fair enough! 😄`, `Yeah, ${f.value} isn't for everyone. What don't you like about it?`]), source: "memory:dislike" };
      }
      return null;
    }

    _commands(m, c) {
      const t = m.plain;
      let r;
      if ((r = /\b(?:can i call you|i will call you|i'll call you|i am going to call you|im going to call you|your name is now|your new name is|i name you|let me call you|from now on you are|from now on your name is|rename you to|i want to call you|change your name to|you are now called)\s+([a-z][a-z'-]{1,20})\b/.exec(t))) {
        const n = U.titleCase(r[1]);
        if (!/^(a|an|the|my|bot|stupid|dumb|idiot|nothing|that|it)$/i.test(n)) {
          const old = this.mem.botName;
          this.mem.botName = n;
          return { text: `${n}? I love it! From now on I'm ${n}. 😊${old !== n ? ` (Bye bye, ${old}!)` : ""}`, source: "command:rename", rename: n };
        }
      }
      const f = MEM.forget(this.mem, m);
      if (f) {
        if (f.all) return { text: "Are you sure you want me to forget everything about you? This can't be undone.", expect: { kind: "yesno", yesAction: "forgetAll", yesText: "Okay... done. 🫧 It's like we're meeting for the first time! Hi, I'm " + this.botName + ". What's your name?", then: { kind: "name" }, noText: "Phew! I'll keep my memories then. 😊" }, source: "command:forget?", confirmForget: true };
        return { text: `Okay, I forgot your ${f.what}. 🫧`, source: "command:forget" };
      }
      return null;
    }

    _skills(m, c, trace) {
      const t = m.norm;
      let r;
      // math and units
      r = P.math.convert(m.clean) || P.math.convert(m.plain);
      if (r) return { text: r.error || pick(["", "Let's see... ", "Easy! "]) + r.text + (r.error ? "" : " 📏"), source: "skill:units" };
      r = P.math.solve(m.clean) || P.math.solve(m.plain);
      if (r) {
        if (r.error) {
          const why = { "divide by zero": "You can't divide by zero! Even computers get nervous about that one. 😅", "not a real number": "That's not a real number (it would be imaginary!).", undefined: "That's undefined!", "too big": "Whoa, that number is too big for me! 🤯" }[r.error];
          if (why) return { text: `${r.expr}: ${why}`, source: "skill:math" };
          return null;
        }
        let s = r.exact ? `${r.expr} = ${r.result}` : `${r.expr} ≈ ${r.result}`;
        if (r.fraction && !r.exact) s += ` (exactly ${r.fraction})`;
        if (r.notes.includes("negpow")) s += ". Heads up: the power comes before the minus sign, so -2^2 means -(2^2). (-2)^2 would be positive.";
        if (r.notes.includes("pct")) s += " (the % is taken of the first number, like on a calculator)";
        return { text: pick(["", "", "Easy! ", "Let me calculate... ", "🧮 "]) + s + (/[.)]$/.test(s) ? "" : ""), source: "skill:math" };
      }
      r = S.daysUntil(m.plain, this.mem); if (r) return { text: r, source: "skill:countdown" };
      r = S.wordTools(m); if (r) return { text: r, source: "skill:words" };
      r = S.capital(m.plain.replace(/[?!.]+$/, "")); if (r) return { text: r, source: "skill:capital" };
      // Minecraft
      if (P.minecraft) {
        r = P.minecraft.answer(m, this.state);
        if (r) return { text: r.text, card: r.card, ascii: r.ascii, source: "skill:minecraft", expect: r.offerRecipe ? { kind: "mcrecipe", item: r.item.name } : null };
      }
      r = S.faq(m); if (r) return { text: r, source: "skill:knowledge" };
      return null;
    }

    _mood(label) {
      const moods = this.mem.moods;
      moods.push({ label, at: Date.now() });
      if (moods.length > 30) moods.shift();
    }

    _feelingReply(label, m) {
      const n = this.mem.name ? ", " + this.mem.name : "";
      const R = {
        sad: [`I'm sorry you're feeling down${n}. 💙 Do you want to talk about what's going on?`, "Oh no... that sounds rough. I'm here for you. What happened?", "Sending you a big virtual hug 🫂 Want to tell me about it?"],
        lonely: [`Feeling lonely is really hard${n}. 💙 I'm here, and I'm happy to keep you company. What's been going on?`, "I'm sorry you feel alone. You're not alone right now, though: I'm right here. 🫂 Want to talk?"],
        anxious: ["That sounds stressful. 😟 Want to try something? Breathe in slowly for 4 seconds, hold for 4, and breathe out for 6. Then tell me what's on your mind.", "I'm sorry you're feeling anxious. 💙 What's worrying you? Sometimes saying it out loud helps."],
        angry: ["Ugh, that sounds really frustrating! 😤 What happened?", "It's okay to be mad. Want to vent? I'm listening."],
        tired: ["Aw, you sound exhausted. 😴 Have you been getting enough sleep?", "Tired days are the worst. Maybe take a little break? What's been wearing you out?"],
        bored: ["Bored? Let's fix that! Want to play a game, hear a joke, or should I ask you a random question? 🎲"],
        sick: [`Oh no, I'm sorry you're not feeling well${n}. 🤒 Make sure you rest and drink lots of water. What's wrong?`, "Feel better soon! 💙 Is it a cold or something else?"],
        happy: [`Yay! That makes me happy too${n}! 😄 What's got you in such a good mood?`, "Love that energy! ✨ Tell me what happened!", "That's awesome! 😊 What's the good news?"],
        love: ["Aww, that's sweet! 💕 Tell me more!"],
      };
      return pick(R[label] || R.sad);
    }

    // big life moments deserve a careful, specific answer
    _events(m) {
      const t = m.plain;
      let r;
      const PETS = "dog|cat|puppy|kitten|hamster|rabbit|bunny|fish|goldfish|bird|parrot|horse|turtle|guinea pig|pet|snake|lizard";
      const FAM = "mom|mum|mother|dad|father|grandma|grandmother|grandpa|grandfather|nana|papa|granny|brother|sister|aunt|uncle|cousin|friend|best friend|uncle|wife|husband|son|daughter";
      if ((r = new RegExp("\\bmy (" + PETS + "|" + FAM + ")(?: \\w+)? (?:just |recently |finally )?(?:died|passed away|passed|is dead|was put down|got put down|was put to sleep|got hit by a car|has died|is gone)\\b").exec(t)) ||
          (r = new RegExp("\\b(?:i )?(?:lost|am losing) my (" + PETS + "|" + FAM + ")\\b").exec(t))) {
        const who = r[1];
        const isPet = new RegExp("^(" + PETS + ")$").test(who);
        this._mood("sad");
        return { text: isPet ? pick([`Oh no... I'm so sorry about your ${who}. 💙 Losing a pet is like losing a family member. Do you want to tell me about them?`, `I'm really sorry. 😢 Your ${who} was lucky to have someone who loved them so much. What was their name?`])
          : pick([`I'm so, so sorry about your ${who}. 💙 That's one of the hardest things anyone can go through. I'm here if you want to talk about them.`, `Oh no... I'm really sorry for your loss. 🫂 How are you holding up?`]), source: "event:grief", score: 0.95, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/\b(broke up with me|dumped me|we broke up|i broke up|my (girlfriend|boyfriend|gf|bf|partner|crush) (left|cheated|rejected)|got dumped|rejected me)\b/.test(t)) {
        this._mood("sad");
        return { text: pick(["Oh no, breakups really hurt. 💔 I'm sorry. Do you want to talk about what happened?", "I'm sorry. 🫂 That's really painful, and it's okay to feel sad about it. How are you doing?"]), source: "event:breakup", score: 0.9, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/\b(i am|i'm|im|i get|getting|got|being) (being )?(bullied|picked on|made fun of)\b|\b(bully|bullies) (me|at school)\b|\bpeople (are mean to me|make fun of me|laugh at me)\b/.test(t)) {
        this._mood("sad");
        return { text: "I'm really sorry that's happening to you. 💙 Nobody deserves to be treated like that, and it's not your fault. Have you been able to tell a parent, teacher or another adult you trust? You don't have to handle it alone. Do you want to tell me what happened?", source: "event:bullied", score: 0.95, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/\b(i have no friends|nobody likes me|no one likes me|everyone hates me|nobody cares about me|no one cares about me|nobody talks to me|no one talks to me|i am alone|i'm alone|i feel invisible)\b/.test(t)) {
        this._mood("lonely");
        return { text: pick(["That sounds really lonely, and I'm sorry you feel that way. 💙 For what it's worth, I like talking with you! Do you want to talk about what's going on?", "I'm here, and I care about how you're doing. 🫂 Feeling like that is really hard. What's been happening?"]), source: "event:lonely", score: 0.9, expect: { kind: "vent", emotion: "lonely" } };
      }
      if (/\b(i hate myself|i am (so )?(ugly|stupid|worthless|useless|a failure|a loser|dumb)|i'm (so )?(ugly|stupid|worthless|useless|a failure|a loser|dumb)|im (so )?(ugly|stupid|worthless|useless|a failure|a loser|dumb)|i am not good enough|i'm not good enough|i suck at everything)\b/.test(t)) {
        this._mood("sad");
        return { text: pick(["Hey, that's not true. 💙 Everybody has hard days, and the voice that says those things is way too harsh. What happened that made you feel this way?", "I don't think that's true at all. You're talking to me with honesty and courage right now, and that counts for a lot. 🫂 What's making you feel like this?"]), source: "event:selfesteem", score: 0.95, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/\b(i )?(failed|bombed|flunked) (my|the|a|an) (test|exam|quiz|class|driving test|interview)\b/.test(t)) {
        this._mood("sad");
        return { text: pick(["Oh no, I'm sorry. 😔 One test doesn't define you, though. Do you know what went wrong?", "That's really disappointing, I'm sorry. 💙 Everyone fails sometimes, and it's how we learn. How are you feeling about it?"]), source: "event:failed", score: 0.9, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/\b(i )?(passed|aced|nailed) (my|the|a|an) (test|exam|quiz|class|driving test|interview)\b|\bi got (an a|a good grade|the job|accepted|a promotion|first place)\b|\bi won\b/.test(t)) {
        this._mood("happy");
        return { text: pick(["WOW, congratulations!! 🎉🎉 I'm so proud of you! How are you celebrating?", "That's amazing! 🥳 You worked for it and it paid off! Tell me everything!", "YES! 🎉 Great job! How does it feel?"]), source: "event:win", score: 0.9, expect: { kind: "open", topic: "good news" } };
      }
      if (/\b(it is|it's|its|today is) my (birthday|bday)\b/.test(t)) {
        MEM.apply(this.mem, { type: "birthday", value: new Date().toLocaleString("en-US", { month: "long", day: "numeric" }) });
        return { text: "HAPPY BIRTHDAY!!! 🎉🎂🎈 I hope you have the best day ever! Are you doing anything special?", source: "event:birthday", score: 0.95, expect: { kind: "open", topic: "birthday" } };
      }
      if (/\b(i am|i'm|im|i feel) (sick|ill)\b|\bi (have|got) (a |the )?(cold|flu|fever|covid|headache|stomach ache|migraine)\b/.test(t)) {
        this._mood("sick");
        return { text: pick(["Oh no, I'm sorry you're sick! 🤒 Get lots of rest and drink water, okay? Is it bad?", "Feel better soon! 💙 Make sure you rest. Do you need a distraction? I could tell you a joke."]), source: "event:sick", score: 0.9, expect: { kind: "vent", emotion: "sick" } };
      }
      if (/\bi (can not|cannot|can't|cant) sleep\b|\binsomnia\b|\bi am (still )?awake\b/.test(t)) {
        return { text: "Can't sleep? 😴 Try putting the screen away soon, breathing slowly (in for 4, out for 6), and thinking of a calm place, like a quiet Minecraft world at sunset. Want me to tell you a calm story?", source: "event:sleep", score: 0.85, expect: { kind: "yesno", yes: "story" } };
      }
      return null;
    }

    // statements about how the user feels ("I'm so sad", "today sucked", "feeling great")
    _feelings(m) {
      const e = m.emotion;
      if (!e.label || e.strength < 0.9) return null;
      const t = m.norm;
      const self = /\b(i am|i'm|im|i feel|i felt|i have been|i've been|feeling|felt|i get|i got|makes me|made me|i was|today (was|is|has been)|my day (was|is|has been)|this day|life is|life sucks|everything is|i hate my life|i am so|so)\b/.test(t) || m.tokens.length <= 3;
      if (!self || m.isQuestion && !/^(why do i|why am i)\b/.test(t)) return null;
      if (/\b(you|u) (are|r|make me)\b/.test(t) && !/\bmake me\b/.test(t)) return null;
      if (e.label === "love" || (e.label === "happy" && e.valence < 0.5)) return null;
      this._mood(e.label);
      if (e.label === "bored") return null; // the bored intent handles it with game chips
      const expect = e.label === "happy" ? { kind: "open", topic: "good news" } : { kind: "vent", emotion: e.label };
      return { text: this._feelingReply(e.label, m), source: "feelings:" + e.label, expect, score: 0.82 };
    }

    _opinion(m, c) {
      const t = m.plain.replace(/[?!.]+$/, "");
      let r;
      if ((r = /\b(?:what is|whats|what's|what are) your (?:favorite|fav|favourite|fave) ([a-z]+(?: [a-z]+)?)\b/.exec(t)) || (r = /\bdo you have a (?:favorite|fav|favourite|fave) ([a-z]+(?: [a-z]+)?)\b/.exec(t))) {
        const slot = MEM.SLOTS[r[1]] || MEM.SLOTS[r[1].split(" ")[0]] || r[1].split(" ")[0];
        const fav = C.persona.favorites[slot];
        const theirs = this.mem.favorites[slot];
        if (fav) return { text: `My favorite ${slot} is ${fav}! ${theirs ? `And yours is ${theirs}, right? 😊` : "What's yours?"}`, source: "opinion:favorite", expect: theirs ? null : { kind: "favorite", slot }, score: 0.9 };
        return { text: `Hmm, I don't think I have a favorite ${slot} yet! What's yours? Maybe you can help me choose. 😊`, source: "opinion:favorite", expect: { kind: "favorite", slot }, score: 0.85 };
      }
      if ((r = /\bdo (?:you|u) (like|love|enjoy|hate|play|watch|listen to|eat) ([a-z0-9][a-z0-9 '-]{1,40})$/.exec(t)) || (r = /\bwhat do you think (?:about|of) ([a-z0-9][a-z0-9 '-]{1,40})$/.exec(t)) && (r = [r[0], "like", r[1]])) {
        const thing = r[2].replace(/^(the|a|an) /, "").trim();
        if (/^(me|it|that|this|them|him|her|you|yourself)$/.test(thing)) return null;
        const low = thing.toLowerCase();
        const dis = Object.keys(C.persona.dislikes).find((k) => low.includes(k.replace(/s$/, "")));
        if (dis && C.persona.dislikes[dis]) return { text: C.persona.dislikes[dis], source: "opinion:dislike", score: 0.85 };
        const like = C.persona.likes.find((l) => low === l || low.includes(l) || l.includes(low));
        if (r[1] === "eat") return { text: `I don't eat anything (no mouth! 😄), but ${thing} sounds good. Do you like it?`, source: "opinion", score: 0.8 };
        if (like) {
          const mc = /minecraft/.test(low) ? " I know tons of recipes and tips, just ask!" : "";
          return { text: pick([`Yes! I love ${thing}! 😄${mc} Do you?`, `${U.capitalizeFirst(thing)}? Definitely!${mc} What about you?`, `I really like ${thing}! What do you like about it?`]), source: "opinion:like", expect: { kind: "open", topic: thing }, score: 0.85 };
        }
        if (P.minecraft && P.minecraft.findMentions(m.tokens).length) return { text: `${U.capitalizeFirst(thing)} in Minecraft? I think it's pretty cool! What do you think?`, source: "opinion:mc", score: 0.7 };
        return { text: pick([`Hmm, I've never really thought about ${thing}! Do you like it?`, `I don't know much about ${thing} yet, but I'm curious! What's it like?`, `${U.capitalizeFirst(thing)}? I'm not sure yet! Tell me what you think of it.`]), source: "opinion:unknown", expect: { kind: "open", topic: thing }, score: 0.55 };
      }
      return null;
    }

    _intent(m, c) {
      let best = null;
      for (const it of C.intents) {
        if (it.re && (it.re.test(m.norm) || it.re.test(m.plain))) { best = { it, score: 0.9, how: "regex" }; break; }
      }
      if (!best) {
        const hits = this.intentIndex.query(m.stems, 3);
        if (hits.length) {
          const h = hits[0];
          // fuzzy matches must be similar in length to the example (avoid matching one word of a long message)
          const lenRatio = Math.min(m.stems.length, h.doc.stems.length) / Math.max(m.stems.length, h.doc.stems.length, 1);
          const score = h.score * (0.55 + 0.45 * lenRatio);
          if (score > 0.45) best = { it: this.intentById[h.payload], score, how: "tfidf" };
        }
      }
      if (!best) return null;
      let res = typeof best.it.say === "function" ? best.it.say(c) : pick(best.it.say);
      if (!res) return null;
      if (typeof res === "string") res = { text: res };
      const alts = Array.isArray(best.it.say) ? best.it.say.filter((x) => x !== res.text) : null;
      return Object.assign({ source: "intent:" + best.it.id, score: best.score, alts, intent: best.it.id }, res);
    }

    async _open(m, c, trace, expect) {
      const cands = [];
      const add = (x) => { if (x && x.text) { cands.push(x); trace.push({ source: x.source, score: +(x.score || 0).toFixed(3), text: x.text }); } };

      const ev = this._events(m); if (ev) add(ev);
      const op = this._opinion(m, c); if (op) add(op);
      const it = this._intent(m, c); if (it) add(it);
      const fe = this._feelings(m); if (fe) add(fe);
      const ch = S.choose(m, C.persona); if (ch) add({ text: ch, source: "skill:choose", score: 0.75 });
      // "what is a quokka?" / "who is Taylor Swift?": be honest instead of letting retrieval guess
      const wq = /^(what(?:'s| is| are)|whats|who(?:'s| is| are)|whos|define|what does)\s+(?:a |an |the )?([a-z0-9][a-z0-9 '-]{1,40}?)(?: mean| means)?\??$/i.exec(m.plain.replace(/[?!.]+$/, ""));
      if (wq && !/\b(you|your|yours|my|me|i|it|that|this|up|going on|new|wrong|happening|the matter|that about|love)\b/.test(wq[2])) {
        const who = /^who/i.test(wq[1]);
        const rawHit = new RegExp(wq[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").exec(m.clean);
        const thing = who ? U.titleCase(wq[2].trim()) : rawHit ? rawHit[0] : wq[2].trim();
        const text = who ? pick([`Hmm, I don't know who ${thing} is! I'm a small chatbot without internet. Can you tell me about them?`, `I'm not sure who ${thing} is. 🙈 Are they someone you like?`])
          : pick([`Hmm, I don't know much about ${thing}. Can you tell me about it?`, `Good question! I'm not sure what ${thing} is. I'm a small chatbot without internet, so I only know a few things. What is it?`, `I don't know that one! 🙈 Is ${thing} something you're into?`]);
        add({ text, source: "unknown:whatis", score: 0.56, expect: { kind: "open", topic: thing } });
      }

      const top = cands.reduce((a, b) => (b.score > (a ? a.score : -1) ? b : a), null);
      const venting = expect && expect.kind === "vent";
      // Neural chat when nothing scripted is confident, or when the user is opening up about something.
      if (this.neural && this.neural.ready && (!top || top.score < 0.8 || (venting && top.source.startsWith("intent:ok")))) {
        try {
          const n = await this.neural.respond(this.state.history, m.clean, { name: this.mem.name, bot: this.botName, venting, recent: this.state.recent, emotion: m.emotion.label });
          for (const x of n || []) add(x);
        } catch (e) { trace.push({ source: "neural:error", score: 0, text: String(e && e.message || e) }); }
      }
      // ELIZA-style reflection (only for neutral/positive statements; sad ones get empathy instead)
      for (const [re, outs] of m.emotion.valence < 0 ? [] : ELIZA) {
        const r = re.exec(m.plain.replace(/[.!]+$/, ""));
        if (r) {
          const parts = r.slice(1).map((x) => reflect(x || "").replace(/[?.!]+$/, ""));
          add({ text: U.fill(pick(outs).replace(/\{(\d)\}/g, "{a$1}"), { a1: parts[0], a2: parts[1] }), source: "eliza", score: 0.42 });
          break;
        }
      }
      if (!cands.length || cands.every((x) => x.score < 0.3)) add(this._fallback(m, venting));

      // choose: best score, penalize repeats
      for (const x of cands) if (this.state.recent.includes(this._post(x.text))) x.score -= 0.25;
      cands.sort((a, b) => b.score - a.score);
      let pickd = cands[0];
      // among near-ties from the neural models, add a little variety
      const close = cands.filter((x) => x.score > pickd.score - 0.03 && x.source.startsWith("neural"));
      if (close.length > 1 && pickd.source.startsWith("neural")) pickd = pick(close);
      // Replika-style: after a neutral acknowledgement, sometimes ask something back
      if (pickd.source.startsWith("neural") && !/\?\s*\S*$/.test(pickd.text) && !this.state.quiet && U.chance(0.18) && this.state.turn > 3) {
        const q = S.askQuestion(this.ctx(m));
        const qt = q.text.replace(/^(Okay, here's one: |Ooh, let me think\.\.\. |Question for you: )/, "");
        pickd = Object.assign({}, pickd, { text: pickd.text + " By the way, " + qt.charAt(0).toLowerCase() + qt.slice(1), expect: q.expect });
      }
      if (venting && !pickd.expect && pickd.source.startsWith("neural")) pickd.expect = { kind: "vent", emotion: expect.emotion };
      return pickd;
    }

    _fallback(m, venting) {
      if (venting) return { text: pick(["That sounds really hard. I'm here for you. 💙", "I hear you. Do you want to tell me more?", "Thank you for telling me. How are you feeling right now?", "That must be tough. You don't have to go through it alone. 🫂"]), source: "fallback:vent", score: 0.3, expect: { kind: "vent" } };
      if (m.isQuestion) return { text: pick(["Hmm, that's a tough one! I'm not sure. What do you think? 🤔", "Good question! I don't know the answer to that one. I'm best at chatting, Minecraft and math!", "I'm not smart enough to answer that yet 😅 Ask me about Minecraft, do some math with me, or tell me about your day!", "I wish I knew! I'm a small chatbot without internet. What's your guess?"]), source: "fallback:question", score: 0.25 };
      return { text: pick(["Tell me more! 😊", "Interesting! How do you feel about that?", "Oh really? What happened next?", "I see! 😊 And then?", "Hmm, I'm not sure what to say to that, but I'm listening! 👂", "That's cool! What else is on your mind?"]), source: "fallback", score: 0.25 };
    }

    // ---------- output polish ----------
    _post(text) {
      if (!text) return text;
      const name = this.mem.name;
      let s = String(text);
      // placeholders from the training data: <|you|> = the user, <|me|> = the bot
      s = s.replace(/<\|me\|>/g, this.botName);
      s = name ? s.replace(/<\|you\|>/g, name) : s.replace(/,?\s*<\|you\|>\s*([,.!?])?/g, (mm, p) => p || "").replace(/^\s*[,.]\s*/, "");
      s = s.replace(/\bi\b/g, "I").replace(/\bi'(m|ve|d|ll)\b/g, "I'$1").replace(/\bminecraft\b/g, "Minecraft").replace(/\bpip\b/g, "Pip");
      s = s.replace(/(^|(?<!\.)[.!?]\s+)([a-z])/g, (mm, a, b) => a + b.toUpperCase());
      s = s.replace(/\s+([,.!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
      return s;
    }
  }

  P.Brain = Brain;
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
