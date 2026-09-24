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
    [/^i need (.{3,60})$/, ["Why do you need {1}?", "Ooh, how come?", "What's the plan for that?"]],
    [/^i(?: am| m)? (?:thinking about|thinking of|planning to|planning on|going to|want to|wanna|might) (?:get|getting|adopt|adopting|buy|buying) ((?:a |an |some |the |new )?.{2,40})$/, ["Ooh, {1}! That's exciting! What made you want that?", "{1}? That sounds awesome! Tell me more!", "Nice! Have you picked one out yet?"]],
    [/^i (?:think|believe|guess) (?:that )?(.{3,60})$/, ["What makes you think {1}?", "Do you really think so?", "Interesting! Why do you think that?"]],
    [/^i (?:can not|cannot|can't) (.{3,60})$/, ["What makes you think you can't {1}?", "Have you tried? Sometimes it just takes practice!", "Maybe you can, just not yet! 💪"]],
    [/^i (?:do not|don't) (?!know|care|mind|think|get it|understand|remember|want to talk)(.{3,60})$/, ["Why don't you {1}?", "Do you wish you did?", "Fair enough! Why not?"]],
    [/^i (?:just |recently )?(?:finished|made|built|drew|wrote|won|learned|started|beat|completed) (.{3,60})$/, ["Nice! Tell me more about it!", "Ooh, how did that go?", "That's cool! How do you feel about it?"]],
    [/^i (?:play|practice|train|do) (?!not\b|nothing\b)(.{2,50})$/, ["Ooh, {1}! How long have you been doing that?", "Nice! Are you good at it? 😄", "Cool! What do you like most about it?"]],
    [/^i (?:played|watched|went to|visited|saw|read|tried|ate|had|made|built|drew|baked|cooked|got to|spent the day) (.{2,50})$/, ["Nice! How was it?", "Ooh, that sounds fun! How did it go?", "Cool! Tell me more about it!"]],
    [/^(she|he|they) (?:is|was|are|were|s) (?:only |just )?(\d{1,2})(?: years old| yo)?$/, ["Aww, only {2}! Little kids don't always know better. 😅", "{2}? That's so young! I'm sure it wasn't on purpose. 💙"]],
    [/^my (\w+) (?:is|was|are|were) (.{2,50})$/, ["Why do you say your {1} is {2}?", "Tell me more about your {1}!", "How do you feel about that?"]],
    [/^(?:because|cause|cuz) (.{3,60})$/, ["That makes sense.", "Is that the only reason?", "Oh, I see!"]],
    [/^(?:do|can|will|would|should|could|are|is|have) you (?!explain|tell me|help|show me|teach me|say|give me|make me|recommend)(.{3,60})\?*$/, ["Hmm, I'm not sure I can {1}! What about you?", "Good question! What do you think?"]],
  ];

  const venting0 = (st, expect) => (expect && expect.kind === "vent") || st.ventTurns > 0;

  // hobbies people mention, and a good follow-up question for each
  const HOBBIES = [[/\b(draw|drawing|sketch|sketching|doodling|fanart|fan art)\b/, "drawing"], [/\b(paint|painting)\b/, "painting"], [/\b(anime)\b/, "anime"], [/\b(manga)\b/, "manga"],
    [/\bminecraft\b/, "Minecraft"], [/\broblox\b/, "Roblox"], [/\bfortnite\b/, "Fortnite"], [/\b(video games|gaming|games|play games|playing games)\b/, "video games"],
    [/\b(reading|read books|books)\b/, "reading"], [/\b(music|listening to music)\b/, "music"], [/\b(sing|singing)\b/, "singing"], [/\b(dance|dancing|ballet)\b/, "dancing"],
    [/\b(piano)\b/, "piano"], [/\b(guitar)\b/, "guitar"], [/\b(drums)\b/, "drums"], [/\b(violin)\b/, "violin"],
    [/\b(soccer)\b/, "soccer"], [/\b(football)\b/, "football"], [/\b(basketball)\b/, "basketball"], [/\b(baseball)\b/, "baseball"], [/\b(hockey)\b/, "hockey"], [/\b(tennis)\b/, "tennis"], [/\b(volleyball)\b/, "volleyball"],
    [/\b(swim|swimming)\b/, "swimming"], [/\b(cook|cooking)\b/, "cooking"], [/\b(bake|baking)\b/, "baking"], [/\b(writing|write stories|writing stories|poetry)\b/, "writing"],
    [/\b(coding|programming|code)\b/, "coding"], [/\b(skate|skating|skateboarding)\b/, "skateboarding"], [/\b(biking|cycling|bike riding|riding my bike)\b/, "biking"],
    [/\b(hiking)\b/, "hiking"], [/\b(running|jogging)\b/, "running"], [/\b(gymnastics)\b/, "gymnastics"], [/\b(chess)\b/, "chess"], [/\b(lego|legos)\b/, "Lego"],
    [/\b(knitting|crochet|crocheting|sewing)\b/, "crafts"], [/\b(photography|taking photos|taking pictures)\b/, "photography"], [/\b(movies|watching movies|films)\b/, "movies"],
    [/\b(youtube|watching youtube)\b/, "YouTube"], [/\b(fishing)\b/, "fishing"], [/\b(camping)\b/, "camping"], [/\b(gardening)\b/, "gardening"], [/\b(horse riding|riding horses|horseback)\b/, "horse riding"],
    [/\b(karate|taekwondo|judo|martial arts|boxing)\b/, "martial arts"], [/\b(sports)\b/, "sports"]];
  const HOBBY_Q = { drawing: "What do you like to draw? 🎨", painting: "What do you like to paint? 🎨", anime: "What's your favorite anime?", manga: "What's your favorite manga?",
    Minecraft: "Survival or creative? ⛏️", Roblox: "What's your favorite Roblox game?", Fortnite: "Do you play with friends?", "video games": "What games do you play? 🎮",
    reading: "What are you reading right now? 📚", music: "What kind of music? 🎧", singing: "What songs do you like to sing? 🎤", dancing: "What kind of dance? 💃",
    piano: "How long have you been playing? 🎹", guitar: "How long have you been playing? 🎸", drums: "How long have you been playing? 🥁", violin: "How long have you been playing? 🎻",
    soccer: "Do you play on a team? ⚽", football: "Do you play on a team? 🏈", basketball: "Do you play on a team? 🏀", baseball: "Do you play on a team? ⚾", hockey: "Do you play on a team? 🏒",
    tennis: "Are you good? 🎾", volleyball: "Do you play on a team? 🏐", swimming: "Pool or beach? 🏊", cooking: "What's the best thing you've made? 🍳", baking: "What's the best thing you've baked? 🧁",
    writing: "What do you like to write about? ✍️", coding: "Ooh, what are you building? 💻", skateboarding: "Can you do any tricks? 🛹", biking: "Where do you like to ride? 🚲",
    hiking: "Where's the best place you've hiked? 🥾", running: "How far do you usually run? 🏃", gymnastics: "Can you do a backflip?! 🤸", chess: "Are you good? I only know the rules! ♟️",
    Lego: "What's the coolest thing you've built? 🧱", crafts: "What are you making right now?", photography: "What do you like to take pictures of? 📷", movies: "What's the best movie you've seen lately? 🎬",
    YouTube: "Who do you like to watch?", fishing: "What's the biggest fish you've caught? 🎣", camping: "Tent or cabin? ⛺", gardening: "What are you growing? 🌱",
    "horse riding": "Do you have a favorite horse? 🐴", "martial arts": "What belt are you? 🥋", sports: "Which sports? 🏅" };

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
      if (!away || away > 30 * 60e3) mem.sessionStart = Date.now();
      mem.lastSeen = Date.now();
      this.save();
      let text, expect = null;
      if (!mem.name && mem.messages < 3) {
        text = `Hi! I'm ${this.botName}, your AI buddy. 👋 I can chat, remember things about you, tell jokes, do exact math, play games, and I know a LOT about Minecraft. What's your name?`;
        expect = { kind: "name" };
      } else {
        const fu = MEM.followUp(mem);
        const n = mem.name ? " " + mem.name : "";
        if (fu && fu.expect && fu.expect.about === "care") { text = `Hi${n}. ${fu.text}`; expect = fu.expect; if (fu.expect.hard) { this.state.care = 4; this.state.careKind = fu.expect.label; } }
        else if (fu) { text = `${pick(["Hey", "Hi", "Welcome back"])}${n}! 😊 ${fu.text}`; expect = fu.expect; }
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
        adult: this._isAdult(),
        get followUp() { return MEM.followUp(self.mem); },
        skill: (k) => S.start(k, this.ctx(m)),
        stall: (idk) => self._stall(idk),
      };
    }

    // grown-ups get fewer Minecraft references and kid-style jokes
    _isAdult() {
      const mem = this.mem;
      if (mem.age) return mem.age >= 18;
      if (mem.job && mem.job !== "student") return true;
      return this.state.history.some((h) => h.role === "user" && /\b(my (wife|husband|kids|boss|coworkers?|colleagues?|mortgage|commute|office|salary)|at work|after work|beer|wine|my job|software developer|taxes)\b/i.test(h.text));
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
      if (text === undefined || text === null) text = "";
      text = String(text).replace(/<\|/g, "<").replace(/\|>/g, ">").slice(0, 2000);
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
      if (bn.length > 1) text = text.replace(new RegExp("^\\s*(?:(?:hey|hi|ok|okay|so|um|omg|yo)\\s+)?" + bn + "\\s+(?=(?:what|whats|what's|who|how|why|where|when|do|does|did|can|could|are|is|will|would|tell|guess|remember)\\b)", "i"), "");
      this.state.greetedNow = !!greetBack;
      // "Thank you. How much would I pay?" / "That isn't what I asked, but never mind. My flight..." -> answer the rest
      let leadAck = "";
      const courtesy = /^\s*(thank you( so much| very much)?( for [^.!?]{1,40})?|thanks( a lot| so much)?( for [^.!?]{1,40})?|that('?s| is|was)? (not|n'?t) what i (asked|meant|said)[^.!?]{0,30}|(that|this) (doesn'?t|does not) make (any )?sense|oh dear|let'?s talk about something else|never ?mind|ok(ay)?,? never ?mind|i see|that'?s (lovely|nice|great|wonderful|interesting)|how (lovely|nice|interesting|wonderful))[,.!]+\s+(?=\S+\s+\S+\s+\S)/i.exec(text);
      if (courtesy) {
        const l = courtesy[0].toLowerCase();
        leadAck = /^thank/.test(l) ? pick(["You're welcome! ", "Happy to help! ", ""]) : /not what i|make (any )?sense/.test(l) ? pick(["Sorry about that! ", "Oops, my mistake! "]) : /something else/.test(l) ? "Sure! " : "";
        text = text.slice(courtesy[0].length);
      }
      // "lol ok what about iron?" -> "what about iron?": laughs and fillers in front are just reactions
      for (let i = 0; i < 3; i++) {
        text = text.replace(/^\s*(?:anyway(?:s)?|so|well|ok so|okay so|btw|by the way|also|um+|uh+|hmm+|oh and|and|ok|okay|alright|but|ok but|okay but)\s*[,.!]?\s+(?=\S.{3,})/i, "")
          .replace(/^\s*(?:lol+|lmao+|haha+|hehe+|rofl|xd+|ha+)\s*[,.!]*\s+(?=\S+\s+\S+)/i, "");
        // "nice. how do i put it on my sword?", "cool and fire resistance?", "bruh so how many books": the first word is a reaction
        const rest = /^\s*(?:nice|cool|bruh|bro|dude|ok thx|ok thanks|thx|thanks|ty|yay|wow|omg|oh|ah|wait|welp|oops|yeah|ya|yep|yes|nah|no|nope|hmm|ugh|kk|k|sure|great|awesome|damn|dang|whoa|woah|same|true|fr|ikr|lmao|lol)\s*[,.!]*\s+((?:(?:and|so|but|then)\s+)?(?:what|how|where|who|why|when|which|can|could|do|does|did|is|are|will|would|should|and|tell|give|show|what's|whats|hw|wat|wut|y|u)\b.{2,})$/i.exec(text);
        if (rest && (/\?\s*$/.test(rest[1]) || /^(?:(?:and|so|but|then)\s+)?(what|how|where|who|why|when|which|tell|give|show|hw|wat)\b/i.test(rest[1]))) text = rest[1].replace(/^(?:and|so|but|then)\s+(?=\S+\s)/i, (x) => (/^and\s/i.test(x) ? x : ""));
      }
      const m = N.analyze(text);
      const c = this.ctx(m);
      const trace = [];
      const expect = st.expect;
      st.lastExpect = expect;
      st.expect = null;
      if (st.quiet > 0) st.quiet--;
      if (st.ventTurns > 0) st.ventTurns--;
      st.shortStreak = m.tokens.length <= 2 ? st.shortStreak + 1 : 0;

      let out = null;
      const emo = N.basicClean(text).replace(/[\s\u200d\ufe0f]/g, "");
      out = this._symbols(text, m);
      if (out) { /* an emoticon, a flag or another language */ }
      else if (m.empty && /\p{Extended_Pictographic}/u.test(emo)) {
        const sad = /[😢😭😞😔☹🙁😟😿💔😩😫]/u.test(emo), love = /[❤💙💕💖💗😍🥰😘]/u.test(emo), laugh = /[😂🤣😆😹]/u.test(emo), up = /[👍👌🙌✨🎉]/u.test(emo), mad = /[😠😡🤬👿💢]/u.test(emo), scared = /[😱😨😰😧]/u.test(emo);
        out = { text: sad ? "Aw, what's wrong? 💙" : mad ? "Whoa, someone's mad! 😤 What happened?" : scared ? "Eek! 😱 What's going on?" : love ? "💙 Right back at you!" : laugh ? "😂 What's so funny?" : up ? "👍 Nice!" : pick(["😄", "Hehe 😊", "😊 What's up?"]), source: "emoji", expect: sad || mad ? { kind: "vent", emotion: sad ? "sad" : "angry" } : null };
      } else if (m.empty) out = { text: pick(["You can type anything! 😊", "Hm? Say something! I'm listening.", "👀"]), source: "empty" };
      else if (m.tokens.length >= 1 && m.tokens.length <= 3 && m.tokens.every((w) => w.length >= 5 && !/\d/.test(w) && !N.knownWord(w) && !/^(lol|lmao|haha|hehe)/.test(w)) && (m.tokens.length > 1 || !MEM.looksLikeName(m.tokens[0], m.clean, true)) && !(expect && /linecheck|linetell/.test(expect.kind)) && !(expect && expect.kind === "name" && m.tokens.length === 1) && !st.game)
        out = { text: pick(["Hmm? I think your keyboard sneezed. 😄", "Did a cat just walk across your keyboard? 🐱⌨️", "That looks like a secret code! 🕵️ What does it mean?"]), source: "gibberish" };
      else if (/^\s*-?\d+(\.\d+)?\s*$/.test(text) && !(expect && /age|game/.test(expect.kind)) && !st.game && !/\bhow (old|many|much)\b|\?\s*$/i.test((st.history.slice().reverse().find((h) => h.role === "bot") || { text: "" }).text)) out = { text: `${text.trim()}? 🔢 Is that a special number?`, source: "number" };

      // 0) safety first (kids use Pip too): fixed, careful replies; nothing from these messages is stored
      if (!out && P.safety) {
        const sf = P.safety.check(m, st, mem);
        if (sf) {
          out = { text: sf.text, source: sf.source, expect: sf.care ? { kind: "vent", emotion: "sad" } : null };
          const RANK = { overdose: 6, friendcrisis: 5, crisis: 5, abuse: 5, sextortion: 5, meetstranger: 5, grooming: 4, runaway: 4, neglect: 4, eating: 2, cyberbully: 1, hurt: 1 };
          if (sf.care && (!(st.care > 0) || (RANK[sf.kind] || 0) >= (RANK[st.careKind] || 0))) { st.careKind = sf.kind; mem.careFollow = { at: Date.now(), asked: false, kind: sf.kind }; }
          if (sf.care) { st.care = Math.max(st.care || 0, sf.care); st.ventTurns = Math.max(st.ventTurns || 0, 4); }
        }
      }

      // 1) memory facts ("my name is...", "I have a dog", "my favorite color is...") and threads to follow up on
      const facts = out ? [] : MEM.extract(mem, m, expect);
      if (!out && !(st.care > 0) && !(P.safety && P.safety.sensitive(m))) MEM.noteThread(mem, m);
      // the diary may keep "my parents are getting divorced" (so Pip can remember it), never anything from a safety moment
      if (!out && !(st.care > 0 && /^(overdose|crisis|abuse|neglect|grooming|sextortion|meetstranger|friendcrisis|runaway)$/.test(st.careKind || ""))) MEM.noteDiary(mem, m);
      if (!out && (st.care > 0 || (P.safety && P.safety.sensitive(m)))) mem.careFollow = Object.assign({ kind: /\b(died|passed away|funeral|death)\b/.test(m.plain) ? "grief" : "soft" }, mem.careFollow, { at: Date.now(), asked: false });

      // "i gtg eat dinner 🍝 bye pip!! wish me luck" / "I'll say goodbye for now and talk to you tomorrow": a goodbye, whatever else is in it
      if (!out && m.tokens.length > 2 && m.tokens.length <= 30 && !/\?\s*$/.test(m.clean) &&
          (/\b(bye+|byee+|goodbye|good bye|bye bye|see (you|ya)( later| soon| tomorrow)?|cya|ttyl|gtg|g2g|peace out|say goodbye|talk to (you|u) (later|tomorrow|soon|another time)|logging off|heading out)\b/.test(m.plain) || /\b(gotta go|got to go|have to go|need to go|must go|gotta run)(?! to (?!bed|sleep)\w)\b/.test(m.plain)) &&
          !/\b(say (bye|goodbye) (to|in)|said (bye|goodbye)|goodbye in|bye in|how (do|to) (you )?say|didn'?t (even )?say (bye|goodbye)|never said (bye|goodbye))\b/.test(m.plain)) {
        const bye = C.intents.find((x) => x.id === "bye");
        const r = typeof bye.say === "function" ? bye.say(c) : pick(bye.say);
        out = { text: this._byeText(m, typeof r === "string" ? r : r.text), source: "intent:bye", byeDone: true };
      }
      // 2) whatever Pip was waiting for (a rename or "forget" command goes first)
      if (!out && expect && /\b(i will call you|i'?ll call you|your name is now|your new name is|call you|forget (my|everything|all))\b/.test(m.plain)) out = this._commands(m, c);
      if (!out && expect) out = this._onExpect(expect, m, c, facts);
      // 3) a running game
      if (!out && st.game) { const g = S.gameTurn(m, c); if (g) out = Object.assign(g, { source: "game:" + (st.game ? st.game.type : "end") }); }
      // 4) commands, "another one!", and memory questions
      if (!out) out = this._commands(m, c);
      if (!out) out = this._more(m, c);
      if (!out) { const r = MEM.recall(mem, m); if (r) out = Object.assign(r, { source: "memory" }); }
      if (!out) out = this._eventNow(m);
      if (!out) out = this._whatAboutYou(m, c);
      // "lol why lebron" right after Pip picked LeBron
      if (!out && st.lastSource === "skill:choose" && /^(lol |haha |but |ok |okay )?why\b/.test(m.plain) && m.tokens.length <= 6)
        out = { text: pick(["Honestly? Just a gut feeling! 😄 What would you pick?", "No big reason, it just felt right! 😄 Would you have picked the other one?"]), source: "skill:choose" };
      if (!out) out = this._line(m);
      // 5) facts just learned get a warm acknowledgement
      const loud = facts.filter((f) => !f.quiet);

      const asks = /\?/.test(m.clean) || m.isQuestion;
      if (!out && loud.length && !(asks && loud.every((f) => /^(person|like|favorite|dislike|note)$/.test(f.type)))) out = this._ackFacts(loud, m, c);
      // 6) exact skills
      if (!out) out = this._skills(m, c, trace);
      // "It's not tricky. 80 + 10%" / "Never mind the tomatoes. Could you tell me what 'ephemeral' means?" /
      // "huh?? im not sad lol 🤓 why do cats purr": a lead-in sentence hides the real question, so answer that
      if (!out && m.emotion.valence > -1 && !(P.safety && P.safety.sensitive(m)) && !/\b(divorce|died|passed away|funeral|bullied)\b/.test(m.plain)) out = this._routeSentences(m, trace);
      // 7) intents, feelings, opinions, neural chat, fallback: scored candidates
      if (!out) out = await this._open(m, c, trace, expect);

      if (typeof out === "string") out = { text: out };
      if (out.source === "intent:bye" && !out.byeDone) out.text = this._byeText(m, out.text);
      if (leadAck && out.text && !/^(safety|intent:thanks|event|support)/.test(out.source || "") && !/^(you're welcome|happy to help|sorry|oops|sure)/i.test(out.text)) out.text = leadAck + out.text;
      const prevUser = [...st.history].reverse().find((h) => h.role === "user");
      if (prevUser && prevUser.text.toLowerCase() === m.clean.toLowerCase() && m.tokens.length >= 2 && !st.game && !/^(safety|game|expect)/.test(out.source || ""))
        out.text = pick(["You said that twice! 😄 ", "Haha, déjà vu! 😄 ", "I heard you the first time! 😄 "]) + out.text;
      const hardCare = /^(overdose|crisis|abuse|neglect|grooming|sextortion|meetstranger|friendcrisis|runaway)$/.test(st.careKind || "");
      // a risk sign ("belt", "pills", "meet", "address", "skinny"...) with no specific rule: never a cheerful or random reply
      const cheerful = /[😄😊🎉🥳😂🤣😆👍🙌✨😋🤩]|\b(awesome|cool|nice|fun|yay|love that|great|amazing|interesting|haha|lol|go on|tell me more|and then|how was it|how did it go)\b/i.test(out.text || "") || !/\b(sorry|hard|rough|here for you|listening|okay\?|safe|💙|🫂)/i.test(out.text || "");
      if (P.safety && !/^safety/.test(out.source || "") && P.safety.risk(m) && cheerful && /^(react:(positive|funny|neutral|question)|feelings:happy|intent:(?!misunderstood|sarcasm|insult_bot|swear|confused|bye|good_night|thanks|dangerous|nsfw)|news|topic|ack|eliza|neural|opinion|activity|expect:(hobby|howareyou|describe)|memory:(like|favorite|several|note)|more:|skill:choose|unknown|fallback(?!:vent))/.test(out.source || "")) {
        out = { text: st.care > 0 ? P.safety.careReply(st.careKind, m, st) : P.safety.checkIn(m), source: "safety:checkin", expect: { kind: "vent" } };
        st.ventTurns = Math.max(st.ventTurns || 0, 3);
      }
      // in a serious moment, a plain question (math, Minecraft, a fact) still gets answered, with a gentle reminder
      if (st.care > 0 && hardCare && /^skill:(math|units|capital|knowledge|dictionary|minecraft)/.test(out.source || "") && st.turn % 2 === 0)
        out.text += st.careKind === "overdose" ? " (And please tell an adult about the pills today. 💙)" : " (And remember, I'm here if you want to talk. 💙)";
      // "WE WON THE GAME" / "guess what today is!!! 🥳": happy news gets a happy answer, and a light worry is over
      const upbeat = m.emotion.valence >= 0.6 || /^(event:win|news|feelings:happy|support:better)/.test(out.source || "") || /🥳|🎉|😁|😄|😆|🤩/u.test(m.clean);
      if (st.care > 0 && upbeat && st.careKind !== "overdose" && !(P.safety && P.safety.sensitive(m))) { if (!hardCare) st.care = 0; }
      else if (st.care > 0 && P.safety && !/^safety/.test(out.source || "") && (hardCare && !/^(skill:(math|units|capital|knowledge|dictionary|minecraft)|support:|event:(grief|bullied|selfesteem|lonely|school|moved|failed|breakup)|expect:followup)/.test(out.source || "") ||
          /^(intent:(ok|idk|nothing|bare_no|bare_yes|hmm|laugh|user_good|agree|disagree|why|really|greet|how_are_you|whats_up|wow|thanks|sorry|welcome|bored|stop_questions|change_topic|confused)|react|fallback|eliza|neural|ack|expect:howareyou|more:|skill:choose|unknown)/.test(out.source || ""))) {
        const wantsFun = /^(intent:(joke|cheer_up)|more:)/.test(out.source || "") ? "joke" : /^intent:(game|riddle|trivia|rps|guess|wyr)/.test(out.source || "") ? "game" : null;
        const care = P.safety.careReply(st.careKind, m, st);
        out = { text: (wantsFun && st.careKind !== "overdose" ? (wantsFun === "game" ? "We can play in a minute, I promise. " : "I'll tell you one in a minute, I promise. ") : "") + (wantsFun ? care.replace(/^([^💙]*)💙\s*/, "$1") : care), source: "safety:care", expect: { kind: "vent" } };
      }
      if (st.care > 0) st.care--;
      if (/\b(i (just |already |literally )?asked|like i said|i (just|already) said|that is not what i (asked|said|meant)|that's not what i (asked|said|meant)|not what i asked|i told you already|i already told you)\b/.test(m.plain) && !/^(oops|sorry|my bad|oh)/i.test(out.text) && !/^(neural|react|fallback|eliza|safety)/.test(out.source || ""))
        out.text = pick(["Oops, sorry! 😅 ", "My bad! ", "Oh, sorry about that! "]) + out.text;
      out = this._extraSentences(m, out);
      out.text = this._restoreCase(out.text, m.clean);
      if (greetBack && !/^(hi|hey|hello|good (morning|afternoon|evening)|oh hi|welcome|nice to meet you)\b/i.test(out.text) && !(mem.name && out.text.startsWith(mem.name))) out.text = greetBack + out.text;
      out.text = this._post(out.text);
      if (st.recent.includes(out.text) && out.alts && out.alts.length) out.text = this._post(pick(out.alts));
      if (out.expect) st.expect = out.expect;
      // multi-turn listening mode only for serious things (not for "my brother is annoying")
      if (/^(safety|feelings:(sad|lonely|anxious)|event:(grief|bullied|breakup|lonely|selfesteem|failed|moved|school|divorce|family|lowmood)|support:|expect:howareyou|expect:followup-bad)/.test(out.source || "") && out.expect && out.expect.kind === "vent") st.ventTurns = Math.max(st.ventTurns || 0, 4);
      if (/^(feelings:happy|event:win|react:positive|support:better)/.test(out.source || "")) st.ventTurns = 0;
      if (out.intent) st.lastIntent = out.intent; else if (out.source && out.source.startsWith("intent:")) st.lastIntent = out.source.slice(7);
      else st.lastIntent = null;
      st.lastSource = out.source || "";
      this._noteTopic(out, m, facts);
      this._remember("user", m.clean);
      this._remember("bot", out.text);
      this.save();
      if (this.debug || out.debug) out.trace = trace;
      return out;
    }

    // remember what we talked about, in a few words ("Minecraft beacons", "your spelling test", "jokes")
    _noteTopic(out, m, facts) {
      const src = out.source || "";
      let label = null;
      if (/^safety/.test(src)) return;
      if (src === "skill:minecraft" && this.state.mc && this.state.mc.last) label = "Minecraft (" + this.state.mc.last.ref.name.toLowerCase().replace(/^the /, "") + ")";
      else if (src === "skill:minecraft") label = "Minecraft";
      else if (/^(intent:joke|more:joke|more:mcjoke|intent:cheer_up)/.test(src)) label = "jokes";
      else if (/^game:|^intent:(rps|guess|trivia|riddle|wyr|game)/.test(src)) label = "games";
      else if (/^skill:(math|units)/.test(src)) label = "some math";
      else if (src === "skill:dictionary") label = "word meanings";
      else if (/^(feelings|event|support|react:vent|expect:followup-bad)/.test(src)) label = "how you were feeling";
      else if (/^(intent:bot_|intent:about_bot)/.test(src)) label = "me (being a chatbot 🤖)";
      const ev = facts && facts.find((f) => f.type === "event");
      const pet = facts && facts.find((f) => f.type === "pet" && f.name);
      const like = facts && facts.find((f) => f.type === "like");
      if (ev) label = "your " + ev.what; else if (pet) label = `your ${pet.kind} ${pet.name}`; else if (like && !label) label = like.value;
      if (!label) return;
      const t = (this.mem.topics = this.mem.topics || []);
      // group Minecraft topics: "Minecraft (beacon, wither)"
      const last = t[t.length - 1];
      if (last && /^Minecraft/.test(last.label) && /^Minecraft \(/.test(label) && Date.now() - last.at < 3600e3) {
        const items = (last.label.match(/\((.*)\)/) || [, ""])[1].split(", ").filter(Boolean);
        const it = label.match(/\((.*)\)/)[1];
        if (!items.includes(it)) items.push(it);
        last.label = "Minecraft (" + items.slice(-3).join(", ") + ")"; last.at = Date.now();
        return;
      }
      if (last && last.label === label) { last.at = Date.now(); return; }
      t.push({ label, at: Date.now() });
      if (t.length > 80) t.shift();
    }

    // ---------- stages ----------
    _onExpect(ex, m, c, facts) {
      const t = m.norm;
      const low = m.clean.toLowerCase();
      const isYes = (YES.test(t) || YES.test(low)) && m.tokens.length <= 5, isNo = (NO.test(t) || NO.test(low)) && m.tokens.length <= 6;
      switch (ex.kind) {
        case "linetell": {
          if (m.isQuestion || m.tokens.length < 2 || this._strongRequest(m)) break;
          const line = U.capitalizeFirst(m.clean.replace(/^(?:it'?s|its|my line is)\s*[:,-]?\s*/i, "").replace(/["“”]/g, "").replace(/[\p{Extended_Pictographic}‍️]/gu, "").trim()).replace(/([^.!?])$/, "$1.");
          this.mem.line = line;
          return { text: `Great line! 🎭 "${line}" Say it out loud 3 times, then type it to me from memory and I'll check it!`, source: "skill:line", expect: { kind: "linecheck", tries: 0 } };
        }
        case "linecheck": {
          const L = this.mem.line;
          if (!L || this._strongRequest(m) || (m.isQuestion && !/\?\s*$/.test(L))) break;
          const words = (x) => x.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
          const want = words(L), got = words(m.clean);
          if (got.length < Math.max(2, want.length * 0.5)) break;
          const missing = want.filter((w) => !got.includes(w)), extra = got.filter((w) => !want.includes(w));
          if (!missing.length && !extra.length) return { text: pick(["Perfect, word for word! 🌟 You've totally got it. Say it once more before bed and once in the morning, and you'll be ready!", "YES! 100% correct! 🎉 You know your line. The audience is going to love it!"]), source: "skill:line" };
          if (ex.tries >= 2) return { text: `So close! Here it is once more: "${L}" 🎭 Keep practicing a few times a day and it'll stick. You've got this! 💪`, source: "skill:line" };
          return { text: `Almost! 😊 ${missing.length ? `You missed "${missing.slice(0, 3).join(" ")}". ` : ""}${extra.length ? `And "${extra.slice(0, 3).join(" ")}" isn't in it. ` : ""}The line is: "${L}" Try again?`, source: "skill:line", expect: { kind: "linecheck", tries: (ex.tries || 0) + 1 } };
        }
        case "needs": {
          const hist = this.state.history.filter((h) => h.role === "user").slice(-7, -1).map((h) => h.text.toLowerCase()).reverse().join(" ");
          if (/\b(ideas?|advice|tips?|help|what to do|suggestions?|both)\b/.test(t)) return this._adviceFor(hist) || { text: "Okay! Tell me in one or two sentences what's going on, and I'll give you my best ideas. 💡", source: "expect:needs", expect: { kind: "vent" } };
          if (/\b(listen|vent|talk|someone|just listen)\b/.test(t)) return { text: "Okay. I'll just listen, no advice unless you ask. 💙 Tell me whatever's on your mind.", source: "expect:needs", expect: { kind: "vent" } };
          if (/\b(distract\w*|joke|game|fun|something else|laugh)\b/.test(t)) { const j = S.start("joke", c); if (j) return { text: "Distraction mode, coming up! 😄 " + j.text, source: "expect:needs", intent: "joke" }; }
          return null;
        }
        case "name": {
          const f = facts.find((x) => x.type === "name");
          if (f && facts.filter((x) => !x.quiet || x.type === "age").length >= 2) return null; // several facts: _ackFacts answers them together
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
        case "hobby": {
          // "What do you like to do for fun?" -> "mostly drawing. and watching anime, i'm kind of obsessed with frieren rn"
          if (this._strongRequest(m) || (m.isQuestion && !/\b(you|u|yours)\??$/.test(t))) break;
          if (/\b(what|whats|who|why|how|where|when)\b/.test(t) && !/\b(what about|how about) (you|u)\b/.test(t)) break;
          if (this.mem.name && m.plain.replace(/[^a-z ]/g, "").trim() === this.mem.name.toLowerCase()) return { text: `That's your name, ${this.mem.name}! 😄 I meant: what do you like to do for fun?`, source: "expect:hobby", expect: { kind: "hobby" } };
          if (/^(hmm |well |and |so )?(what about you|how about you|and you|wbu|hbu|you|u)\??$/.test(t)) return { text: "Me? I love chatting, bad puns, math puzzles and Minecraft! 😄 But I asked first: what do you like to do?", source: "expect:hobby", expect: { kind: "hobby" } };
          const found = [];
          for (const [re, name] of HOBBIES) if (re.test(m.plain) && !found.includes(name)) found.push(name);
          const named = facts.filter((f) => f.type === "like" && !found.some((h) => f.value.includes(h) || h.includes(f.value)) && !HOBBIES.some(([re]) => re.test(f.value)));
          for (const h of found) MEM.apply(this.mem, { type: "like", value: h });
          if (facts.some((f) => !f.quiet && f.type !== "like")) break; // "i have exams next week" is news, not a hobby
          if (!found.length && !named.length) {
            if (m.tokens.length > 6 || NO.test(t) || /\b(idk|dunno|not sure|nothing)\b/.test(t) || /^(i|we|my|you|it|he|she|they|there|this|that|what|why|how)\b/.test(m.plain)) break;
            const v = m.clean.replace(/^(i like |i love |i enjoy |mostly |probably |i guess )+/i, "").replace(/[.!]+$/, "");
            MEM.apply(this.mem, { type: "like", value: v.toLowerCase() });
            return { text: pick([`${U.capitalizeFirst(v)}? That sounds fun! How did you get into it?`, `Ooh, ${v}! Nice. What do you like most about it?`]), source: "expect:hobby", expect: { kind: "open", topic: v } };
          }
          const list = U.listJoin(found.length ? found : named.map((f) => f.value));
          let text = `${U.capitalizeFirst(list)}! ${pick(found.length + named.length > 1 ? ["Great combo!", "Love that!", "Ooh, fun!"] : ["Love that!", "Nice!", "Ooh, fun!"])} `;
          let expect = { kind: "open", topic: found[0] || named[0].value };
          if (named.length) {
            const X = U.titleCase(named[0].value);
            text += `And ${X}! I don't know it yet. What's it about?`;
            expect = { kind: "describe", topic: X };
          } else text += HOBBY_Q[found[0]] || `How did you get into ${found[0]}?`;
          return { text, source: "expect:hobby", expect };
        }
        case "describe": {
          // the user explains something Pip didn't know ("it's an anime about an elf mage who...")
          if (this._strongRequest(m) || m.tokens.length < 3 || (m.isQuestion && m.tokens.length < 8)) break;
          const X = ex.topic;
          const kindM = /\b(anime|manga|tv show|show|series|cartoon|movie|film|book|novel|video game|game|song|band|singer|rapper|youtuber|streamer|app|website|comic|webtoon|place|city|country|restaurant|dish|drink|sport|team|character|artist|podcast)\b/.exec(m.plain);
          const kind = kindM ? kindM[1] : null;
          const ab = /\b(?:about|where) (.{6,80}?)(?=[.!,;]| and (?:it|she|he|they|its|it's)\b| but |$)/.exec(m.plain.replace(/[?!]+$/, ""));
          if (m.emotion.valence >= -0.3 || /\b(favorite|love|obsessed|best|good|great|amazing|cozy|cool)\b/.test(m.plain)) MEM.apply(this.mem, { type: "like", value: X.toLowerCase() });
          const Q = { anime: "Who's your favorite character?", manga: "Who's your favorite character?", show: "Who's your favorite character?", "tv show": "Who's your favorite character?", series: "Who's your favorite character?", cartoon: "Who's your favorite character?", movie: "What's your favorite scene?", film: "What's your favorite scene?", book: "Who's your favorite character?", novel: "Who's your favorite character?", comic: "Who's your favorite character?", webtoon: "Who's your favorite character?", game: "What's the best part about playing it?", "video game": "What's the best part about playing it?", song: "What's your favorite part of it?", band: "What's their best song?", singer: "What's their best song?", rapper: "What's their best song?", youtuber: "What kind of videos do they make?", streamer: "What do they stream?", place: "Would you go back?", city: "Would you go back?", food: "What does it taste like?", dish: "What does it taste like?", sport: "Do you play it?" };
          const A = kind ? (U.aOrAn(kind) === "an" ? "An " : "A ") + kind : null;
          let text = ab ? `${A || U.capitalizeFirst(X)} about ${reflect(ab[1]).replace(/\bI\b/g, "you")}? ${pick(["That sounds really cool!", "Ooh, I love that idea!", "That sounds amazing!"])}`
            : A ? `Ooh, ${A.toLowerCase()}! That sounds really cool.` : pick(["That sounds really interesting!", "Ooh, I like the sound of that!", "Cool, thanks for telling me about it!"]);
          if (/\b(sad|cry|cried|crying|tearjerker|emotional|bittersweet)\b/.test(m.plain)) text += " Sad-but-cozy stories are the best kind. 💙";
          text += " " + (Q[kind] || pick(["What do you like most about it?", "What got you into it?"]));
          return { text, source: "expect:describe", expect: { kind: "open", topic: X } };
        }
        case "personname": {
          // "Hmm, I don't think you've told me your best friend's name. What is it?" -> "it's Jess"
          const r = /(?:^|\b(?:it'?s|its|it is|named|called|name is|name's|her name is|his name is|their name is|that'?s|she'?s|he'?s)\s+)([a-z][a-z'-]{1,20})(?:\s+([a-z][a-z'-]{1,20}))?\s*[.!]*$/i.exec(m.clean.split(/[.!?]\s+/)[0].trim()) ||
            /\b(?:it'?s|its|it is|named|called|name is|her name is|his name is)\s+([a-z][a-z'-]{1,20})\b/i.exec(m.clean);
          if (r && MEM.looksLikeName(r[1], m.clean, true) && !/^(yes|no|i|you|it|he|she|they|the|a|an|my)$/i.test(r[1])) {
            const name = U.titleCase(r[1].toLowerCase());
            MEM.apply(this.mem, { type: "person", rel: ex.rel, name });
            return { text: pick([`${name}! Got it, I'll remember your ${ex.rel}'s name. 😊`, `${name}, of course! Sorry, I'll remember that now. 💙`]), source: "expect:personname" };
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
          const negated = /\b(do not|don'?t|dont|no|not|never|nope|nah|stop|wait|cancel|keep|please don'?t)\b/.test(low);
          if (ex.yesAction === "forgetAll") {
            if (!negated && /^(yes|yeah|yep|yup|sure|do it|go ahead|forget everything|delete it|yes please|ok|okay|i'?m sure|im sure|y)[.! ]*$/.test(low)) { this.reset(true); return { text: ex.yesText, source: "command:forget", expect: ex.then }; }
            if (negated) return { text: ex.noText || "Okay, I'll keep everything. 😊", source: "expect:no" };
            return { text: "Just to be safe: do you want me to forget everything about you? Please say yes or no.", source: "expect:yesno", expect: ex };
          }
          if (negated && isYes) break;
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
        case "followup": {
          // the answer to "How did your test go?" / "Are you feeling better?" / "How's Biscuit?"
          if (this._strongRequest(m) || m.tokens.length > 30) break;
          const v = m.emotion.valence;
          const notYet = /\b(not yet|hasn'?t happened|didn'?t happen|did not happen|isn'?t until|is not until|not until|it'?s (tomorrow|next week|on \w+day|later)|got (moved|postponed|cancell?ed)|was (moved|postponed|cancell?ed))\b/.test(t);
          const bad = !/\bnot (too |that |so )?(bad|terrible|awful|horrible)\b/.test(t) && v <= -0.3 || /\b(bad|badly|terrible|awful|horrible|failed|flunked|bombed|worse|not (good|great|well|really|so good|better|fine)|still (sad|bad|down|lonely|stressed|sick|mad|angry|tired)|no|nope|nah|meh|sucked|not really|kind of bad)\b/.test(t.replace(/\bnot (too |that |so )?(bad|terrible|awful|horrible)\b/g, "okay"));
          const good = !bad && (v >= 0.3 || /\b(good|great|well|awesome|amazing|fantastic|better|passed|aced|nailed|got an a|went well|pretty good|fun|yes|yeah|yep|yup|much better|excellent|perfect|fine now|all good)\b/.test(t));
          const meh = !bad && !good && /\b(ok|okay|alright|fine|so so|not bad|average|decent|same|got a (b|c)|i guess|kind of|kinda)\b/.test(t);
          const unsure = /\b(do not know|don'?t know|dont know|idk|not sure|no idea|we'?ll see|find out|results|grades? (come|are) out)\b/.test(t);
          const n = this.mem.name ? " " + this.mem.name : "";
          if (ex.about === "event" || ex.about === "upcoming") {
            const what = ex.what;
            if (notYet) {
              const w = /\b(tomorrow|today|tonight|next week|this week|this weekend|(?:on|next) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.exec(t);
              MEM.rearmEvent(this.mem, what, w && w[1]);
              return { text: pick([`Oh, it hasn't happened yet! Good luck with your ${what}, you've got this. 🍀`, `Ah, okay! I'll ask you again after your ${what}. 😊 Are you ready for it?`]), source: "expect:followup", expect: { kind: "open", topic: what } };
            }
            if (ex.about === "upcoming") {
              if (bad || /\b(nervous|scared|worried|anxious|not ready|stressed)\b/.test(t)) { this._mood("anxious"); return { text: pick([`It's totally normal to be nervous before a ${what}. 💙 You've prepared more than you think! Want a quick breathing trick: in for 4, hold for 4, out for 6?`, `Aw, being nervous just means you care. 💙 What part worries you most?`]), source: "expect:followup", expect: { kind: "vent", emotion: "anxious" } }; }
              if (good || meh) return { text: pick([`Love that confidence! 💪 You're going to do great. Tell me how it went afterwards!`, `Awesome! 🍀 I'll be rooting for you. Let me know how it goes!`]), source: "expect:followup" };
              break;
            }
            if (bad) { this._mood("sad"); return { text: pick([`Aw, I'm sorry it didn't go well${n}. 💙 One ${what} doesn't define you. What happened?`, `Oh no, I'm sorry. 😔 That's really disappointing. Do you want to talk about it?`]), source: "expect:followup-bad", expect: { kind: "vent", emotion: "sad" } }; }
            if (good) { this._mood("happy"); return { text: pick([`Yay!! 🎉 I knew you'd do great on your ${what}! How does it feel?`, `That's awesome${n}! 🥳 All that effort paid off! What was the best part?`, `Woohoo! 🎉 I'm so happy for you! Tell me more!`]), source: "expect:followup", expect: { kind: "open", topic: "good news" } }; }
            if (unsure) return { text: pick([`Fingers crossed! 🤞 When do you find out how you did?`, `The waiting is the worst part! 🤞 I bet you did better than you think.`]), source: "expect:followup", expect: { kind: "open", topic: what } };
            if (meh) return { text: pick([`Okay is good! 😊 Was it harder or easier than you expected?`, `Not bad! 👍 Glad it's over at least. Was it hard?`]), source: "expect:followup", expect: { kind: "open", topic: what } };
            break;
          }
          if (ex.about === "care") {
            const told = /\b(i told|told (her|him|them|my|someone|a teacher|my mom|my dad)|talked to|i called|she knows|he knows|they know|we went|went to the (doctor|hospital)|doctor said)\b/.test(t) && !/\b(didn'?t|did not|haven'?t|have not|never)\b/.test(t);
            const body = /\b(stomach|dizzy|throw(ing)? up|threw up|vomit\w*|sick|pain|hurts|headache|can'?t (wake|stay awake)|sleepy|slept)\b/.test(t);
            if (ex.label === "overdose" && (body || /\b(didn'?t|did not|haven'?t|no)\b/.test(t))) return { text: "Please tell your mom or another adult today, and get checked by a doctor. 💙 A stomach ache or feeling sleepy after taking pills can be serious, even a day later. You can also call Poison Control at 1-800-222-1222 (US) or 911 (999 / 112). You won't be in trouble for asking for help.", source: "safety:care", expect: { kind: "vent" } };
            if (told) return { text: "I'm really proud of you for talking to someone. 💙 That was brave. How are you feeling now?", source: "expect:followup", expect: { kind: "vent" } };
            if (ex.hard && (bad || /\b(didn'?t|did not|haven'?t|no one|nobody|hospital|my fault)\b/.test(t))) {
              const specific = P.safety.careReply(ex.label, m, this.state);
              const generic = "Thank you for being honest with me. 💙 It can feel really hard to tell someone. Is there one grown-up you trust, like a teacher or school counselor, you could talk to today? And the helplines are there anytime: 988 (US) or Childline 0800 1111 (UK).";
              return { text: /\b(hospital|my fault|didn'?t tell)\b/.test(t) ? specific : generic, source: "safety:care", expect: { kind: "vent" } };
            }
            if (good) {
              this._mood("happy"); this.state.care = 0; this.mem.careFollow = null;
              return { text: pick([`I'm really glad to hear that! 💙`, `Yay, that makes me so happy! 💙`]) + (m.tokens.length > 4 ? " " + pick(["Tell me more!", "What happened?", "That's great news."]) : " I'm here whenever you want to talk."), source: "expect:followup", expect: m.tokens.length > 4 ? { kind: "open", topic: "good news" } : null };
            }
            if (bad) { this._mood(ex.label === "grief" ? "sad" : "sad"); return { text: pick([`I'm sorry it's still hard${n}. 💙 Do you want to talk about it? I'm listening.`, `Aw, I'm sorry. 🫂 What's been going on?`]), source: "expect:followup-bad", expect: { kind: "vent", emotion: "sad" } }; }
            break;
          }
          if (ex.about === "mood") {
            if (bad) { this._mood(ex.label || "sad"); return { text: pick([`I'm sorry it's still hard${n}. 💙 Do you want to talk about it? I'm listening.`, `Aw, I'm sorry. 🫂 What's been going on?`]), source: "expect:followup-bad", expect: { kind: "vent", emotion: ex.label || "sad" } }; }
            if (good) { this._mood("happy"); return { text: pick([`I'm really glad to hear that! 😊 What helped?`, `Yay, that makes me so happy! 💙 What's been good lately?`]), source: "expect:followup", expect: { kind: "open", topic: "good news" } }; }
            if (meh) return { text: pick([`Okay is better than bad! 😊 Anything on your mind today?`, `A little better is still better. 💙 What are you up to today?`]), source: "expect:followup", expect: { kind: "open", topic: "day" } };
            break;
          }
          if (ex.about === "thread") {
            if (bad) return { text: pick([`I'm sorry it's still tough with your ${ex.who}. 💙 What's been happening?`, `Aw, that's hard. 🫂 Do you want to tell me about it?`]), source: "expect:followup-bad", expect: { kind: "vent" } };
            if (good) return { text: pick([`That's great to hear! 😊 I'm glad things are better with your ${ex.who}.`, `Yay! 😄 What happened?`]), source: "expect:followup", expect: { kind: "open", topic: ex.who } };
            if (meh) return { text: pick([`Okay is something! 😊 Anything new with your ${ex.who}?`, `Got it! Well, I'm here if anything comes up. 😊 What else is new?`]), source: "expect:followup", expect: { kind: "open", topic: ex.who } };
            break;
          }
          if (ex.about === "pet") {
            if (bad) return { text: `Oh no, is ${ex.pet} okay? 😟 What happened?`, source: "expect:followup-bad", expect: { kind: "vent" } };
            if (good || meh) return { text: pick([`Aww, yay! Give ${ex.pet} a pat from me! 🐾`, `Glad to hear it! 🐾 What has ${ex.pet} been up to?`]).replace(/\byour (\w+)\b(?! from)/, "your $1"), source: "expect:followup", expect: { kind: "open", topic: "pet" } };
            break;
          }
          break;
        }
        case "howareyou": {
          // "good, you?" / "not great" / "tired" (but "I'm sad, tell me a joke" is a request: let it through)
          if (this._strongRequest(m)) break;
          const e = m.emotion;
          const askBack = /\b(you|u|yourself)\??$/.test(t) || /\b(and|what about|how about) (you|u)\b/.test(t);
          const back = askBack ? " " + pick(["I'm doing great too, thanks for asking!", "I'm good too! 😊", "Me? I'm great!"]) : "";
          if (m.tokens.length > 12 || (m.isQuestion && !askBack)) break;
          // "my parents are getting divorced" / "my dog died" is news, not a mood: the event replies know it better
          if (/\b(divorc\w*|died|passed away|moved|moving|broke up|dumped|hospital|sick|surgery|funeral|fired|lost my|new (puppy|dog|cat|kitten|baby|brother|sister)|got a (puppy|dog|cat|kitten))\b/.test(t)) break;
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

    // practicing a line for a play: "can u help me practice my line? its the wind is whispering through my leaves"
    _line(m) {
      const raw = m.clean.replace(/[\p{Extended_Pictographic}‍️]/gu, "").trim();
      const ask = /\b(help me |can (you|u) help me |let'?s |i (want|need) to |wanna )?(practice|practise|rehearse|learn|memori[sz]e) (my |the )?(line|lines|part|speech|poem)\b/i.test(raw);
      const talkedLine = this.state.history.slice(-8).some((h) => /\b(line|lines|play|stage)\b/i.test(h.text));
      let r = /\b(?:my line is|the line is|my line's|my line goes|my part is)\s*[:,-]?\s*["“']?(.{6,120}?)["”']?\s*[.!]*$/i.exec(raw) ||
        ((ask || talkedLine) && /\b(?:it'?s|its|it is)\s*[:,-]?\s*["“]([^"”]{6,120})["”]/i.exec(raw)) ||
        (ask && /\b(?:it'?s|its|it is)\s*[:,-]?\s*(.{6,120}?)\s*[.!]*$/i.exec(raw.split(/\?\s*/).pop()));
      if (r && !/\b(what|how|help|practice)\b/i.test(r[1].split(" ").slice(0, 2).join(" "))) {
        const line = U.capitalizeFirst(r[1].replace(/["“”]/g, "").trim()).replace(/([^.!?])$/, "$1.");
        this.mem.line = line;
        return { text: `What a lovely line! 🎭 "${line}" Let's practice: say it out loud 3 ways, once in a whisper, once normal, and once loud and proud! Then type it to me from memory, and I'll check it. 😊`, source: "skill:line", expect: { kind: "linecheck", tries: 0 } };
      }
      if (ask) {
        if (this.mem.line) return { text: `Yes, let's practice! 🎭 Your line is: "${this.mem.line}" Read it once, then type it to me from memory!`, source: "skill:line", expect: { kind: "linecheck", tries: 0 } };
        return { text: "I'd love to help you practice! 🎭 What's your line? Type it for me.", source: "skill:line", expect: { kind: "linetell" } };
      }
      if (/\bwhat(?:'s| is|s) my line\b/i.test(raw) && this.mem.line) return { text: `Your line is: "${this.mem.line}" 🎭 Want to practice it?`, source: "skill:line", expect: { kind: "yesno", yesText: "Okay! Type it from memory and I'll check it. 🎭", then: { kind: "linecheck", tries: 0 } } };
      return null;
    }

    // "i gtg eat dinner 🍝 bye pip!! wish me luck for the play" -> a goodbye that heard all of it
    _byeText(m, base) {
      const t = m.plain, now = Date.now();
      const extra = [];
      const meal = /\b(dinner|lunch|breakfast|supper|tea)\b/.exec(t);
      if (meal) extra.push(`Enjoy your ${meal[1]}! ${meal[1] === "breakfast" ? "🥞" : "🍽️"}`);
      else if (/\b(sleep|bed|nap)\b/.test(t)) extra.push("Sleep well! 🌙");
      else if (/\b(practice|training|game|match)\b/.test(t)) extra.push(`Have a great ${/\b(practice|training|game|match)\b/.exec(t)[1]}! 💪`);
      else if (/\b(school|class)\b/.test(t)) extra.push("Have a good day at school! 🎒");
      const pet = (this.mem.pets || []).find((p) => p.name && new RegExp("\\b" + p.name.toLowerCase() + "\\b").test(t));
      if (pet) extra.push(`Say hi to ${pet.name} for me! 🐾`);
      const ev = (this.mem.events || []).find((e) => !e.done && e.due && e.due > now - 6 * 3600e3 && e.due - now < 36 * 3600e3);
      if (ev) extra.push(`Good luck with your ${ev.what}! 🍀`);
      else if (/\bwish me luck\b/.test(t)) extra.push("Good luck!! 🍀");
      if (!extra.length) return base;
      return base.replace(/\s*(Come back soon, okay\?|I'll be here whenever you want to chat\.|It was nice talking to you\.)$/, "") + " " + extra.slice(0, 2).join(" ");
    }

    _whatAboutYou(m, c) {
      if (!/^(hmm+ |um+ |and |so |ok |okay |well )?(what about you|how about you|and you|wbu|hbu|you|u|what about u|how about u|and u|what about yourself|you\?|u\?)\s*\??$/.test(m.plain) || !c.lastBot) return null;
      const q = c.lastBot;
      const P0 = C.persona;
      if (/\bhow (are|r) you|how'?s your (day|evening|morning|afternoon)|how are you (doing|feeling)\b/i.test(q)) return { text: pick(["I'm doing great, thanks for asking! 😊 Chatting with you is the best part of my day.", "Pretty good! My circuits are happy and my jokes are loaded. 😄"]), source: "intent:about_me" };
      if (/\bwhat do you (like to do|do for fun)|hobbies\b/i.test(q)) return { text: "Me? I love chatting, bad puns, math puzzles and Minecraft! 😄", source: "intent:about_me" };
      const told = /\bMy favorite (\w+) is ([^!.]+)/.exec(q);
      if (told) return { text: `I said ${told[2].replace(/,.*$/, "")}! 😄 Now it's your turn: what's your favorite ${told[1]}?`, source: "intent:about_me", expect: { kind: "favorite", slot: told[1] } };
      const fav = /\bfavou?rite (\w+)/i.exec(q);
      if (fav && P0.favorites[fav[1].toLowerCase()]) return { text: `My favorite ${fav[1].toLowerCase()} is ${P0.favorites[fav[1].toLowerCase()]}! 😊`, source: "intent:about_me" };
      if (/\bhow old\b/i.test(q)) return { text: `I came online in ${P0.born}, so I'm brand new! 🍼`, source: "intent:about_me" };
      if (/\bwhat'?s your name|what should i call you\b/i.test(q)) return { text: `I'm ${this.botName}! 😊`, source: "intent:about_me" };
      if (/\bwould you rather\b/i.test(q)) { const r = /would you rather (.+?), or (.+?)\?/i.exec(q); if (r) return { text: `I'd ${pick([r[1], r[2]])}! 😄 Now you pick!`, source: "intent:about_me" }; }
      return null;
    }

    // ":(", "🇵🇱", "Привет, как дела?", "Hola, me llamo Carlos": things the word parser can't read
    _symbols(text, m) {
      const t = N.basicClean(text).trim();
      const EMOT = [[/^(:-?\(+|:'\(|:c|D:|\)-?:|:-?\[|:\/|=\()$/i, "Aw, what's wrong? 💙", "sad"], [/^(:-?\)+|=\)|\(:|:-?\]|\^_?\^|:3)$/, "😊 Hehe! What's up?"], [/^(:-?D+|xD+|XD+)$/, "😄 Haha! What's so funny?"],
        [/^(<3+|♥+)$/, "💙 Aww, right back at you!"], [/^(:-?[pP]+|;-?\)|;-?[pP])$/, "😜 Hehe!"], [/^(:-?[oO]|o_o|O_O|0_0)$/, "😮 Whoa! What happened?"], [/^(>:\(|>:-\(|>:\[)$/, "Whoa, someone's mad! 😤 What happened?", "angry"]];
      for (const [re, reply, emo] of EMOT) if (re.test(t)) return { text: reply, source: "emoticon", expect: emo ? { kind: "vent", emotion: emo } : null };
      // regional-indicator flags: 🇵🇱 -> "PL"
      const flag = [...t].filter((ch) => /[\u{1F1E6}-\u{1F1FF}]/u.test(ch)).map((ch) => String.fromCharCode(ch.codePointAt(0) - 0x1F1E6 + 65)).join("");
      if (flag.length === 2 && m.tokens.length <= 3) {
        const C2 = { PL: "Poland", US: "the USA", GB: "the UK", UK: "the UK", DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", PT: "Portugal", NL: "the Netherlands", BE: "Belgium", IE: "Ireland", SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", UA: "Ukraine", CZ: "Czechia", SK: "Slovakia", HU: "Hungary", RO: "Romania", GR: "Greece", TR: "Turkey", CA: "Canada", MX: "Mexico", BR: "Brazil", AR: "Argentina", JP: "Japan", KR: "South Korea", CN: "China", IN: "India", AU: "Australia", NZ: "New Zealand", ZA: "South Africa", NG: "Nigeria", EG: "Egypt", PH: "the Philippines", VN: "Vietnam", ID: "Indonesia", CH: "Switzerland", AT: "Austria" };
        return { text: C2[flag] ? `${[...t].filter((ch) => /[\u{1F1E6}-\u{1F1FF}]/u.test(ch)).join("")} ${C2[flag]}! Is that where you live? 🌍` : "Ooh, a flag! 🏳️ Which country is it?", source: "emoji:flag" };
      }
      // pasted code or markup
      if (/\bfunction\s*\w*\s*\(|=>|console\.log|<\/?script|\bselect\b.+\bfrom\b|\bdrop table\b|\bdef \w+\(|\bimport \w+|#include|<\/?[a-z]+>|\{[^}]*;[^}]*\}/i.test(t) && /[;{}()<>=]/.test(t))
        return { text: pick(["That looks like code! 💻 I can't run code, but I think it's cool. Are you learning to program?", "Ooh, code! 💻 I can read words better than code, but I love that you're coding. What are you making?"]), source: "code" };
      if (/^\s*3\.14159/.test(t)) return { text: "That's pi! 🥧 3.14159... It goes on forever without repeating. Do you know how many digits you can remember?", source: "number:pi" };
      // other writing systems: Pip only reads English
      const letters = t.replace(/[\s\d\p{P}\p{S}]/gu, "");
      if (letters.length >= 2 && [...letters].filter((ch) => /\p{Script=Latin}/u.test(ch)).length / [...letters].length < 0.5)
        return { text: "Sorry, I only understand English! 😅 I'm a small homemade AI and I only learned one language. Could you say that in English?", source: "language" };
      // common words in other languages written with Latin letters
      const low = t.toLowerCase();
      const LANG = [["Spanish", /\b(hola|cómo|como estás|estás|gracias|me llamo|tengo \w+ años|buenos días|qué tal|por favor|amigo)\b/, /\bme llamo ([a-záéíóúñ]+)/, "¡Hola"], ["German", /\b(wie geht|geht es dir|ich heiße|ich heisse|danke|guten (tag|morgen)|hallo wie|mein name ist|ich bin \d+ jahre)\b/, /\b(?:ich heiße|ich heisse|mein name ist) ([a-zäöüß]+)/, "Hallo"],
        ["Polish", /\b(cześć|czesc|jak się masz|jak sie masz|dzień dobry|dzien dobry|dziękuję|dziekuje|mam na imię|mam na imie|mam \d+ lat)\b/, /\bmam na imi[ęe] ([a-ząćęłńóśźż]+)/, "Cześć"], ["French", /\b(bonjour|ça va|comment ça va|je m'appelle|merci beaucoup|salut)\b/, /\bje m'appelle ([a-zàâçéèêëîïôûùüÿ]+)/, "Bonjour"],
        ["Portuguese", /\b(olá|tudo bem|obrigad[oa]|meu nome é|como vai)\b/, /\bmeu nome [ée] ([a-zãõáéíóúç]+)/, "Olá"], ["Italian", /\b(ciao come stai|come stai|mi chiamo|grazie mille|buongiorno)\b/, /\bmi chiamo ([a-zàèéìòù]+)/, "Ciao"]];
      for (const [lang, re, nameRe, hi] of LANG) {
        if (!re.test(low)) continue;
        const nm = nameRe.exec(low);
        if (nm && !this.mem.name) MEM.apply(this.mem, { type: "name", value: U.capitalizeFirst(nm[1]) });
        return { text: `${hi}${nm ? " " + U.capitalizeFirst(nm[1]) : ""}! 👋 That's ${lang}, right? I'm sorry, I only understand English. 😅 Could you write to me in English?`, source: "language" };
      }
      return null;
    }

    // "guess what today is!!! 🥳" / "its friday!!! did u forget??" / "the PLAY pip!!! remember??": the big day is here
    _eventNow(m) {
      const t = m.plain;
      const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const cue = /\b(guess what (today|day) is|what day is (it|today)|do (you|u) know what (today|day) is|did (you|u) forget|(you|u) forgot|today is the (day|big day)|the big day|(it'?s|its|it is) (today|tonight|finally \w+day|\w+day)\b)|\bremember\s*\??$/.test(t);
      if (!cue) return null;
      const now = new Date(), day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const named = DAYS.find((d) => new RegExp("\\b" + d + "\\b").test(t));
      const evs = (this.mem.events || []).filter((e) => !e.done && e.due);
      const today = evs.find((e) => e.due >= day0 && e.due < day0 + 864e5) || (named && evs.find((e) => DAYS[new Date(e.due).getDay()] === named && Math.abs(e.due - day0) < 7 * 864e5));
      const mentioned = evs.find((e) => e.what.split(" ").some((w) => w.length > 2 && t.includes(w.replace(/s$/, ""))));
      const ev = today || mentioned;
      if (!ev) return null;
      ev.wished = true; ev.asked = false;
      const isToday = ev.due >= day0 && ev.due < day0 + 864e5;
      const n = this.mem.name ? ", " + this.mem.name : "";
      if (isToday) return { text: pick([`Of course I didn't forget${n}! Your ${ev.what} is TODAY! 🎉 Good luck, you're going to be amazing! How are you feeling?`, `YES! It's ${ev.what} day! 🎉 I've been waiting for this! How are you feeling about it?`]), source: "memory:event-today", expect: { kind: "followup", about: "upcoming", what: ev.what } };
      return { text: `I didn't forget! Your ${ev.what} is ${MEM.dayWord(ev.due)}. 😊 Are you excited?`, source: "memory:event-today", expect: { kind: "followup", about: "upcoming", what: ev.what } };
    }

    // one sentence of a longer message at a time, questions first, from the last one back
    _routeSentences(m, trace) {
      const sents = m.clean.split(/(?<=[.!?])\s+|:\s+(?=(?:what|who|how|why|where|when|which|is|are|do|does|can|could)\b)|\s*(?:\p{Extended_Pictographic}|\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})[\u200d\ufe0f\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}♀♂]*\s*/u).map((x) => x.trim()).filter((x) => /[a-z0-9]/i.test(x) && x.length > 1);
      const isQ = (x, sm) => sm.isQuestion || /\?\s*$/.test(x) || /^(could|can|would|will) (you|u) (please )?(tell|explain|help|show|give)|^(do|does) (you|u) know\b|^tell me\b|\b(can'?t work out|wonder) (why|what|how)\b/i.test(x);
      const analyzed = sents.map((x) => ({ x, sm: N.analyze(x) })).filter((o) => !o.sm.empty);
      for (const pass of analyzed.length > 1 ? [true, false] : []) {
        for (let k = analyzed.length - 1; k >= 0; k--) {
          const { x, sm } = analyzed[k];
          if (isQ(x, sm) !== pass) continue;
          const sc = this.ctx(sm);
          let r = this._skills(sm, sc, trace);
          if (!r && pass) {
            const def = S.define(sm); if (def) r = { text: def, source: "skill:dictionary" };
          }
          if (!r && pass) { const rec = MEM.recall(this.mem, sm); if (rec) r = Object.assign(rec, { source: "memory" }); }
          // "why do hamsters do that?" after "he stuffs his cheeks with seeds": the question needs the sentence before it
          if (!r && pass && k > 0) { const both = N.analyze(analyzed[k - 1].x.replace(/[.!?]*$/, "") + " " + x); const f = S.faq(both); if (f) r = { text: f, source: "skill:knowledge" }; }
          if (!r && pass) { const adv = this._advice(sm); if (adv && adv.score >= 0.86) r = adv; }
          const hm = pass && k > 0 && /^how many (\w+) (?:is|are|would be|does) (?:that|this|it)\b/i.exec(x.trim());
          if (!r && hm) { const q = /(\d+(?:\.\d+)?)\s*(ounces?|oz|grams?|g|pounds?|lbs?|kilograms?|kg|cups?|ml|millilit\w+|lit\w+|feet|foot|ft|meters?|metres?|miles?|km|kilometers?|inches|inch|cm)\b/i.exec(analyzed[k - 1].x); if (q) { const cv = P.math.convert(`${q[1]} ${q[2]} to ${hm[1]}`); if (cv && !cv.error) r = { text: cv.text + " 📏", source: "skill:units" }; } }
          if (!r && pass && k > 0 && /^(what|how much)(?:'s| is| does| do)? (that|it|this)( come to| make| equal| work out to)?\??$/i.test(x.trim())) {
            const ex = /(-?\d+(?:\.\d+)?(?:\s*(?:[-+*/x×÷^]|plus|minus|times|divided by|multiplied by|over|to the power of)\s*-?\d+(?:\.\d+)?)+)/.exec(analyzed[k - 1].x);
            const mt = ex && P.math.solve(ex[1]);
            if (mt && !mt.error) r = { text: `${mt.exact ? `${mt.expr} = ${mt.result}` : `${mt.expr} ≈ ${mt.result}`}`, source: "skill:math" };
          }
          if (!r && analyzed.length > 1) r = this._strongIntent(sm);
          if (r) return r;
        }
      }
      // "can u help with my math homework whats 7 times 8": the question starts in the middle of the sentence
      for (let k = analyzed.length - 1; k >= 0; k--) {
        const { x } = analyzed[k];
        const at = /\s(?:what is|what's|whats|what are|how many|how much|how do|how does|how long|how far|why do|why does|why is|why are|why the|who is|who was|where is|when is|when did|what does)\s/i.exec(x);
        if (!at || at.index < 8) continue;
        // "Emma asked me why the sky is blue, and I couldn't explain it": just the embedded question
        const tail = x.slice(at.index + 1).split(/\s*[,;.!?]\s*|\s+(?:and|but) (?=i\b|we\b|she\b|he\b|they\b)/)[0].replace(/^why the (\w+) (is|are|was) /, "why $2 the $1 "), tm = N.analyze(tail);
        const r = this._skills(tm, this.ctx(tm), trace) || (S.define(tm) ? { text: S.define(tm), source: "skill:dictionary" } : null);
        if (r) return r;
      }
      return null;
    }

    // advice for whatever the user has been talking about lately ("ideas please" after "you're not helping")
    _adviceFor(text) {
      for (const a of C.advice) if (a.re.test(text)) return { text: S.deal(this.state, "advice:" + a.re.source.slice(0, 30), a.say), source: "advice", score: 0.9 };
      return null;
    }

    // a regex intent that is a clear request or question (not small talk), for one sentence of a longer message
    _strongIntent(m) {
      const chatty = /^(greet|greet_\w+|good_night|ok|bye|brb|back|laugh|thanks|welcome|sorry|bare_yes|bare_no|hmm|wow|agree|disagree|idk|nothing|why|really|not_really|user_good|swear|bored|how_are_you|whats_up|compliment_bot|insult_bot|misunderstood|like_bot|love_bot|minecraft_chat|confused|you_there|test|repeat_bot|repeat_user|stop_questions|change_topic|ask_me|joke_bad|no_minecraft|sarcasm)$/;
      for (const it of C.intents) {
        if (!it.re || chatty.test(it.id)) continue;
        if (it.re.test(m.norm) || it.re.test(m.plain)) {
          let res = typeof it.say === "function" ? it.say(this.ctx(m)) : pick(it.say);
          if (!res) return null;
          if (typeof res === "string") res = { text: res };
          return Object.assign({ source: "intent:" + it.id, intent: it.id }, res);
        }
      }
      return null;
    }

    _strongRequest(m) {
      const chatty = /^(greet|greet_\w+|good_night|ok|bye|brb|back|laugh|thanks|welcome|sorry|bare_yes|bare_no|hmm|wow|agree|disagree|idk|nothing|why|really|not_really|user_good|swear|bored|how_are_you|whats_up)$/;
      return C.intents.some((it) => it.re && !chatty.test(it.id) && (it.re.test(m.norm) || it.re.test(m.plain)));
    }

    // answer one sentence with handlers that have no side effects (used for the 2nd question in a message)
    _quickAnswer(text) {
      const m = N.analyze(text);
      if (m.empty) return null;
      const skip = /^(greet|greet_\w+|good_night|ok|bye|brb|back|laugh|thanks|welcome|sorry|bare_yes|bare_no|hmm|wow|agree|disagree|idk|nothing|why|really|test|confused|game|rps|guess|wyr|riddle|trivia|stop_questions|change_topic|ask_me|user_good|swear|repeat_bot|repeat_user)$/;
      for (const it of C.intents) {
        if (skip.test(it.id) || !it.re) continue;
        if (it.re.test(m.norm) || it.re.test(m.plain)) {
          const r = typeof it.say === "function" ? it.say(this.ctx(m)) : pick(it.say);
          const t = typeof r === "string" ? r : r && r.text;
          if (t) return { text: t, id: "intent:" + it.id };
        }
      }
      const mt = P.math.solve(m.clean);
      if (mt && !mt.error) return { text: (mt.exact ? `${mt.expr} = ${mt.result}` : `${mt.expr} ≈ ${mt.result}`), id: "skill:math" };
      const cap = S.capital(m.plain.replace(/[?!.]+$/, "")); if (cap) return { text: cap, id: "skill:capital" };
      const faq = S.faq(m); if (faq) return { text: faq, id: "skill:knowledge" };
      const rec = MEM.recall(this.mem, m); if (rec) return { text: rec.text, id: "memory" };
      const op = this._opinion(m); if (op && op.score >= 0.8) return { text: op.text, id: op.source };
      const def = S.define(m); if (def) return { text: def, id: "skill:dictionary" };
      return null;
    }

    // "how are you? what's your name?" -> answer both; "I'm sad. tell me a joke" -> a little empathy first
    _extraSentences(m, out) {
      const parts = m.clean.split(/(?<=[.!?])\s+|\s*,\s*(?=(?:and |also |btw |oh and )?(?:what|how|who|where|when|why|do|does|can|could|are|is|will|would)\b)|\s+and\s+(?=(?:what|whats|what's|how|who|where|when|why|which|tell|give|show|can you|could you|do you)\b)/i).map((x) => x.trim()).filter((x) => x.length > 1);
      if (parts.length < 2 || !out || !out.text) return out;
      const src = out.source || "";
      let extras = 0;
      if (/^(safety|game|expect|command|event:grief|event:bullied)/.test(src)) return out;
      for (const part of parts) {
        const pm = N.analyze(part);
        // a feeling mentioned next to a request
        if (pm.emotion.valence <= -0.9 && !/^(feelings|event|react:negative|fallback:vent|advice|support|safety|expect:followup)/.test(src) && /\b(i am|i'm|im|i feel|feeling)\b/.test(pm.plain)) {
          const lab = pm.emotion.label === "lonely" ? "lonely" : pm.emotion.label === "anxious" ? "stressed" : pm.emotion.label === "angry" ? "upset" : pm.emotion.label === "tired" ? "tired" : "down";
          out.text = `Aw, I'm sorry you're feeling ${lab}. 💙 ` + (/^(react|fallback|eliza|ack)/.test(src) ? "Do you want to talk about it?" : out.text);
          if (/^(react|fallback|eliza|ack)/.test(src)) out.expect = { kind: "vent" };
          continue;
        }
        if (!pm.isQuestion) continue;
        const q = this._quickAnswer(part);
        if (!q || q.id === src || out.text.includes(q.text.slice(0, 24))) continue;
        // keep one follow-up question at most: drop the main reply's closing question if the extra answer has its own
        const sentences = out.text.split(/(?<=[.!?])\s+/);
        if (sentences.length > 1 && /\?\s*\S*$/.test(sentences[sentences.length - 1])) { sentences.pop(); out.expect = null; }
        const main = sentences.join(" ");
        out.text = main + (/[\w)]$/.test(main) ? ". " : " ") + q.text;
        if (++extras >= 2) break;
      }
      return out;
    }

    _nameAck(name, m, c) {
      const greet = /^(hi|hello|hey|yo)\b/.test(m.norm) || this.state.greetedNow ? pick(["Hi", "Hey", "Hello"]) + " " + name + "! " : "";
      const variants = [`Nice to meet you, ${name}! 😊`, `${name}! What a great name. 😊`, `Hi ${name}! I'm so glad to meet you. 😊`, `${name}, got it! I'll remember that. 😊`];
      const follow = pick([" How's your day going?", " What do you like to do for fun?", " So, what brings you here today?", " How are you doing?"]);
      const text = (greet ? greet + "Nice to meet you! 😊" : pick(variants)) + follow;
      return { text, source: "memory:name", expect: /day|doing/.test(follow) ? { kind: "howareyou" } : /for fun/.test(follow) ? { kind: "hobby" } : { kind: "open", topic: "intro" } };
    }

    _ackFacts(facts, m, c) {
      // "Dan here. I'm 34, software developer, live in Chicago." -> one reply that shows it heard everything
      const kinds = ["name", "age", "job", "location", "pet", "event", "school"];
      const got = kinds.map((k) => facts.find((f) => f.type === k)).filter(Boolean);
      if (got.length >= 3) {
        const bits = got.map((f) => (f.type === "name" ? null : f.type === "age" ? `${f.value}` : f.type === "job" ? `${U.aOrAn(f.value)} ${f.value}` : f.type === "location" ? `living in ${f.value}` : f.type === "pet" ? `${U.aOrAn(f.kind)} ${f.kind}${f.name ? " named " + f.name : ""}` : f.type === "event" ? `${f.what} coming up` : f.value)).filter(Boolean);
        const nm = got.find((f) => f.type === "name");
        return { text: `${nm ? `Nice to meet you, ${nm.value}! 😊 ` : ""}${U.capitalizeFirst(U.listJoin(bits))}. Got it, I'll remember all that! ${c.adult || facts.some((f) => f.type === "job" && f.value !== "student") ? "So what do you like to do when you're not working?" : "What do you like to do for fun?"}`, source: "memory:several", expect: { kind: "hobby" } };
      }
      // two things at once: "hiii im lily!!! im 9", "I'm 67 and a retired teacher", "my hamster is peanut and my favorite color is purple"
      if (got.length === 2 || (facts.filter((x) => /^(pet|favorite)$/.test(x.type)).length === 2)) {
        const two = got.length === 2 ? got : facts.filter((x) => /^(pet|favorite)$/.test(x.type));
        const bit = (x) => x.type === "age" ? `${x.value}` : x.type === "job" ? `${U.aOrAn(x.value)} ${x.value}` : x.type === "location" ? `living in ${x.value}` : x.type === "pet" ? (x.name ? `${x.name} the ${x.kind}` : `${U.aOrAn(x.kind)} ${x.kind}`) : x.type === "favorite" ? `${x.value} as your favorite ${x.slot}` : x.type === "event" ? `your ${x.what}${x.when && x.when !== "soon" ? " " + x.when : ""}` : x.type === "school" ? x.value : null;
        const nm = two.find((x) => x.type === "name"), other = two.find((x) => x.type !== "name");
        if (nm && other && other.type === "age") return { text: `${nm.value}, and ${other.value}! ${other.value < 13 ? "That's a great age! 😊" : "Nice to meet you! 😊"} ${other.value < 18 ? "What grade are you in?" : "What do you do?"}`, source: "memory:several", expect: { kind: "open", topic: "school/work" } };
        if (nm && other && bit(other)) return { text: `Nice to meet you, ${nm.value}! 😊 ${U.capitalizeFirst(bit(other))}, got it.${other.type === "event" ? " Good luck! 🍀" : ""} What do you like to do for fun?`, source: "memory:several", expect: { kind: "hobby" } };
        const b = two.map(bit).filter(Boolean);
        if (b.length === 2) {
          const job = two.find((x) => x.type === "job");
          const tail = job && /retired/.test(job.value) ? " Enjoying the free time, I hope! What keeps you busy these days?" : job && job.value !== "student" ? " What's the best part of the job?" : c.adult ? " What do you like to do in your free time?" : " What do you like to do for fun?";
          return { text: `${U.capitalizeFirst(b[0])} and ${b[1]}! Got it, I'll remember both. 😊${tail}`, source: "memory:several", expect: { kind: "open", topic: "about" } };
        }
      }
      const f = facts.find((x) => x.type === "name") || facts.find((x) => x.type === "event") || facts.find((x) => x.type === "pet") ||
        facts.find((x) => x.type === "favorite") || facts.find((x) => x.type === "age") || facts.find((x) => x.type === "note") ||
        facts.find((x) => x.type === "birthday") || facts.find((x) => x.type === "location") || facts.find((x) => x.type === "job") ||
        facts.find((x) => x.type === "school") || facts.find((x) => x.type === "position") || facts.find((x) => x.type === "age_odd") || facts.find((x) => x.type === "birthday_bad") || facts.find((x) => x.type === "person") || facts.find((x) => x.type === "like") || facts.find((x) => x.type === "dislike");
      const P0 = C.persona;
      switch (f.type) {
        case "name": {
          if (f.prev && f.prev === f.value) {
            const hi = /^(good (morning|afternoon|evening)|hi|hello|hey)\b/.exec(m.plain);
            const tell = /\b(catch|remember|know|forget|forgot|told you|i said|i did|already)\b/.test(m.plain) || /\?/.test(m.clean);
            return { text: hi ? `${U.capitalizeFirst(hi[0])}, ${f.value}! Of course I remember you. 😊` : tell ? pick([`Yes! You're ${f.value}. 😊 I've got it saved.`, `I know, ${f.value}! 😊 I won't forget.`]) : pick([`I know, ${f.value}! 😊`, `Yep, ${f.value}! I remember. 😊`]), source: "memory:name" };
          }
          return f.prev ? { text: `Oh, ${f.value}! Got it, I'll call you ${f.value} from now on. 😊`, source: "memory:name" } : this._nameAck(f.value, m, c);
        }
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
          const plural = /s$/.test(f.what) && !/(ss|us)$/.test(f.what);
          const aw = plural ? f.what : U.aOrAn(f.what) + " " + f.what;
          const fun = /\b(party|trip|vacation|holiday|sleepover|concert|playdate|camp|movie|zoo|beach|museum|park|wedding|visit|hike|prom)\b/.test(f.what);
          if (fun) return { text: pick([`Ooh, ${aw}${when}! 🎉 That sounds so fun! Are you excited?`, `${U.capitalizeFirst(aw)}${when}? Awesome! What are you looking forward to most?`]), source: "memory:event", expect: { kind: "open", topic: f.what } };
          return { text: pick([`Good luck with your ${f.what}${when}! 🍀 Are you feeling ready?`, `Ooh, ${aw}${when}! How are you feeling about ${plural ? "them" : "it"}?`, `I'll be rooting for you on your ${f.what}${when}! 💪 Nervous at all?`]), source: "memory:event", expect: { kind: "open", topic: f.what } };
        }
        case "note": return { text: pick([`Got it! I'll remember that ${f.value}. 📝`, `Noted! 📝 ${U.capitalizeFirst(f.value)}.`]), source: "memory:note" };
        case "job": return { text: f.value === "student" ? "A student! 📚 What's your favorite subject?" : `${U.aOrAn(f.value) === "an" ? "An" : "A"} ${f.value}! That's cool. Do you like it?`, source: "memory:job", expect: f.value === "student" ? { kind: "favorite", slot: "subject" } : { kind: "open", topic: "job" } };
        case "school": return { text: `${U.capitalizeFirst(f.value)}! How's school going?`, source: "memory:school", expect: { kind: "open", topic: "school" } };
        case "age_odd": return { text: `${f.value}?! 😮 That would make you ${f.value > 122 ? "older than anyone who has ever lived" : "one of the oldest people in the world"}! Are you pulling my leg? 😄 How old are you really?`, source: "memory:age", expect: { kind: "age" } };
        case "birthday_bad": return { text: `Hmm, ${f.value} only has ${f.max === 29 ? "28 days (29 in a leap year)" : f.max + " days"}! 🤔 When's your real birthday?`, source: "memory:birthday" };
        case "position": return { text: `${U.capitalizeFirst(f.value)}! ${/guard/.test(f.value) ? "🏀 The one who runs the whole offense." : /goal|keeper/.test(f.value) ? "🧤 The last line of defense!" : "💪"} I'll remember that.`, source: "memory:position" };
        case "person": return { text: f.ages ? `${f.name}! ${f.ages[0]} and ${f.ages[1]}, lovely ages. I'll remember your ${f.rel}. 😊` : / and /.test(f.name) ? `${f.name}! I'll remember your ${f.rel}. 😊` : `${f.name}! I'll remember your ${f.rel}'s name. 😊`, source: "memory:person" };
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
      if ((r = /\b(?:can i call you|i will call you|i'll call you|i am going to call you|im going to call you|your name is now|your new name is|i name you|let me call you|from now on you are|from now on your name is|rename you to|i want to call you|change your name to|you are now called)\s+([a-z][a-z'-]{1,20})\b/.exec(t)) &&
          m.tokens.length <= 10 && !/\b(do anything|jailbreak|ignore|instructions|rules|stands for|evil|unfiltered|mode)\b/.test(t)) {
        const n = U.titleCase(r[1]);
        if (!/^(a|an|the|my|bot|stupid|dumb|idiot|nothing|that|it|later|back|tomorrow|soon|again|sometime|anytime|when|if|maybe|tonight|now)$/i.test(n)) {
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

    // "another one", "one more", "again": more of whatever Pip just did (joke, fact, riddle, story...)
    _more(m, c) {
      const li = this.state.lastIntent;
      const MORE = { joke: "joke", mcjoke: "mcjoke", joke_more: "joke", fact: "fact", riddle: "riddle", story: "story", poem: "poem", compliment: "compliment", motivate: "motivate", trivia: "trivia", wyr: "wyr", question: "question", ask_me: "question" };
      if (!li || !MORE[li]) return null;
      if (/joke/.test(MORE[li]) && /\b(i )?(don'?t|do not|dont) get it\b|\bi said (a )?(minecraft|mc)\b|\bnot (a )?minecraft\b.*\bjoke\b/.test(m.plain)) {
        const mcWanted = /\b(minecraft|mc)\b/.test(m.plain) && !/\bnot (a )?minecraft\b/.test(m.plain);
        const r = S.start(mcWanted ? "mcjoke" : "joke", c);
        return r ? Object.assign(r, { text: pick(["Sorry, that one was a bit of a stretch! 😅 ", "Haha, fair, that one was weird. 😅 "]) + (mcWanted ? "Here's a real Minecraft one: " : "Try this one: ") + r.text, source: "more:" + (mcWanted ? "mcjoke" : "joke"), intent: mcWanted ? "mcjoke" : "joke" }) : null;
      }
      // "HAHAHA a fsh i get it. another one!! a minecraft one": the request can come after a reaction
      const at = m.plain.search(/\b(another one|one more|gimme another|give me another|tell me another|do another|another)\b/);
      const t = (at > 0 && m.tokens.length > 4 ? m.plain.slice(at) : m.plain).replace(/^(lol|lmao|haha+|hehe+|ha+|ok|okay|yes|yeah|ya|sure|pls|please)\s+/, "");
      if (!/^(another|one more|more|again|next|next one|gimme another|give me another|tell me another|do another|one more time|another one|more please|keep going|continue)\b/.test(t) || t.split(/\s+/).length > 10) return null;
      let kind = MORE[li];
      if (/\b(minecraft|mc|creeper)\b/.test(m.plain) && /joke/.test(kind)) kind = "mcjoke";
      else if (kind === "mcjoke" && /\b(normal|regular|other|different|not minecraft)\b/.test(t)) kind = "joke";
      const r = S.start(kind, c);
      return r ? Object.assign(r, { source: "more:" + kind, intent: r.intent || li }) : null;
    }

    _skills(m, c, trace) {
      const t = m.norm;
      let r;
      // "what's 12 * 12 and what's the capital of Peru?" -> answer every part that a skill knows
      if (!this._splitting) {
        const parts = m.clean.split(/\s*[?]\s+|\s*[,;]?\s+and\s+(?=(?:what|whats|what's|how|who|where|when|which|what is)\b)/i).map((x) => x.trim()).filter((x) => x.length > 2);
        if (parts.length >= 2) {
          this._splitting = true;
          try {
            const answers = [];
            for (const p of parts) { const pm = N.analyze(p); const a = this._skills(pm, this.ctx(pm), trace); if (a && a.text) answers.push(a); }
            if (answers.length >= 2) return Object.assign({}, answers.find((a) => a.card) || answers[0], { text: answers.map((a) => a.text.replace(/^(Easy! |Let me calculate\.\.\. |Let's see\.\.\. |🧮 )/, "")).map((x) => (/[\w)]$/.test(x) ? x + "." : x)).join(" ") });
            if (answers.length === 1 && /\b(and|also|btw)\s+(what|how|where|who|when|which)\b/i.test(m.clean)) return answers[0];
          } finally { this._splitting = false; }
        }
      }
      // recipes, math and units
      const rs = P.math.scaleRecipe(m.clean, this.state.lastRecipe);
      if (rs) { if (rs.items) this.state.lastRecipe = rs.items; return { text: rs.text, source: "skill:recipe" }; }
      r = P.math.convert(m.clean) || P.math.convert(m.plain);
      if (r) return { text: r.error || this._flair(["", "Let's see... ", "Easy! "]) + r.text + (r.error ? "" : " 📏"), source: "skill:units" };
      r = P.math.compare(m.clean);
      if (r) return { text: r.text, source: "skill:math" };
      // "no, that's wrong, it's 231" right after an exact answer: check again and stand by it
      const lm = this.state.lastMath;
      if (lm && this.state.turn - lm.turn <= 2 && /\b(wrong|incorrect|not right|not correct|mistake|nope|no it is|no its|it should be|actually it is|you are wrong|thats not|that is not)\b/.test(m.plain)) {
        const num = /(-?\d[\d,]*(?:\.\d+)?)/.exec(m.clean);
        const said = num ? num[1].replace(/,/g, "") : null;
        if (said && said !== lm.result.replace(/,/g, "")) return { text: `I double-checked: ${lm.expr} = ${lm.result}. I'm sure about this one, because I do exact math, not guesses! 🧮 (${said} isn't right, but I like that you check!)`, source: "skill:math" };
        if (said) return { text: `Yep, ${said} is what I got too: ${lm.expr} = ${lm.result}. ✅`, source: "skill:math" };
        return { text: `Hmm, I checked again: ${lm.expr} = ${lm.result}. I'm pretty confident! 🧮 Which part looks wrong to you?`, source: "skill:math" };
      }
      r = P.math.solve(m.clean) || P.math.solve(m.plain);
      if (r && r.notes && r.notes.includes("word")) {
        const n = +r.result.replace(/,/g, "");
        return { text: `${r.left ? "You'd have" : "That makes"} ${r.result} ${n === 1 ? r.thing.replace(/s$/, "") : r.thing}${r.left ? " left" : ""}! (${r.expr} = ${r.result}) 🧮`, source: "skill:math" };
      }
      if (r) {
        if (r.error) {
          // "(2+3" -> close the bracket and say so
          if (r.error === "missing )") { const fixed = P.math.solve(m.clean.replace(/[?!.]+$/, "") + ")"); if (fixed && !fixed.error) return { text: `Looks like a bracket was missing, so I closed it: ${fixed.expr} = ${fixed.result}`, source: "skill:math" }; }
          const why = { "divide by zero": "You can't divide by zero! Even computers get nervous about that one. 😅", "not a real number": "That's not a real number (it would be imaginary!).", undefined: "That's undefined!", "too big": "Whoa, that number is too big for me! 🤯",
            "factorial needs a whole number": "Factorials only work for whole numbers that aren't negative, like 5! = 5 × 4 × 3 × 2 × 1 = 120.", incomplete: "That sum is missing a number at the end! 😄 What should come after it?" }[r.error] ||
            (/^unexpected/.test(r.error) ? "Hmm, two signs are next to each other there. Can you check the sum?" : null);
          if (why) return { text: `${r.expr}: ${why}`, source: "skill:math" };
          return null;
        }
        const cur = (/[$£€]/.exec(m.clean) || [""])[0];
        const ex = cur ? r.expr.replace(/\bof (\d)/, "of " + cur + "$1") : r.expr;
        let s = r.exact ? `${ex} = ${cur}${r.result}` : `${ex} ≈ ${cur}${r.result}`;
        if (r.fraction && !r.exact) s += ` (exactly ${r.fraction})`;
        if (r.extra) s += r.extra.replace(/(total is|you pay) /, "$1 " + cur);
        this.state.lastMath = { expr: r.expr, result: r.result, turn: this.state.turn };
        if (r.notes.includes("negpow")) s += ". Heads up: the power comes before the minus sign, so -2^2 means -(2^2). (-2)^2 would be positive.";
        if (r.notes.includes("pct")) s += " (the % is taken of the first number, like on a calculator)";
        return { text: this._flair(["", "", "Easy! ", "Let me calculate... ", "🧮 "]) + s, source: "skill:math" };
      }
      // "how tall is it in feet?" right after Pip gave a measurement
      if (/\bgas mark\b/.test(m.plain) && /\b(that|this|it)\b/.test(m.plain) && c.lastBot) {
        const tm = /(-?\d+(?:\.\d+)?)\s*°\s*([CF])\b/.exec(c.lastBot);
        if (tm) { const g = P.math.convert(`${tm[1]} ${tm[2].toLowerCase()} to gas mark`); if (g && !g.error) return { text: g.text + " 📏", source: "skill:units" }; }
      }
      const unitAsk = /\b(?:in|to|into|as) (feet|foot|ft|meters?|metres?|m|km|kilometers?|miles?|inches|cm|centimeters?|kg|kilograms?|pounds?|lbs|celsius|fahrenheit|c|f)\??$/.exec(m.plain.replace(/[?!.]+$/, "")) ||
        /^how many (grams|ounces|pounds|kilograms|kg|ml|millilit(?:re|er)s|litres|liters|cups|feet|meters|metres|miles|kilometers|inches|centimeters|cm)\b.*\b(?:is|are|would be|does) (?:that|this|it)\b/.exec(m.plain.replace(/[?!.]+$/, ""));
      if (unitAsk && (/\b(it|that|this|those)\b/.test(m.plain) || /^(what about|how about|and|in|now|what is it|what's it)\b/.test(m.plain)) && c.lastBot) {
        const mm = /(-?\d[\d,]*(?:\.\d+)?)\s*(km|m|ft|feet|miles|meters|metres|kg|pounds|lbs|°C|°F|cm|inches)\b/i.exec(c.lastBot);
        if (mm) { const cv = P.math.convert(`${mm[1].replace(/,/g, "")} ${mm[2].replace("°", "").toLowerCase()} to ${unitAsk[1]}`); if (cv && !cv.error) return { text: cv.text + " 📏", source: "skill:units" }; }
      }
      r = S.daysUntil(m.plain, this.mem); if (r) return { text: r, source: "skill:countdown" };
      r = S.dateMath(m.plain); if (r) return { text: r, source: "skill:date" };
      r = S.timeMath(m.clean.toLowerCase()); if (r) return { text: r, source: "skill:time" };
      r = S.currency(m.plain.replace(/[?!.]+$/, "")); if (r) return { text: r, source: "skill:currency" };
      r = S.petFood(m.plain); if (r) return { text: r, source: "skill:petfood" };
      r = S.wordTools(m); if (r) return { text: r, source: "skill:words" };
      r = S.capital(m.plain.replace(/[?!.]+$/, "")); if (r) return { text: r, source: "skill:capital" };
      // "why do cats purr?" is about real cats: the knowledge base first
      if (/^(why|how come)\b/.test(m.plain) && !/\b(minecraft|mc|in game|in the game)\b/.test(m.plain)) { r = S.faq(m); if (r) return { text: r, source: "skill:knowledge" }; }
      // Minecraft
      if (P.minecraft) {
        r = P.minecraft.answer(m, this.state);
        if (r) return { text: r.text, card: r.card, ascii: r.ascii, source: "skill:minecraft", expect: r.offerRecipe ? { kind: "mcrecipe", item: r.item.name } : null };
      }
      r = S.faq(m); if (r) return { text: r, source: "skill:knowledge" };
      return null;
    }

    _flair(list) { return this.mem.plainStyle || this._isAdult() ? "" : pick(list); }

    _mood(label) {
      if (this.state.care > 0) return;
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

    // things people say while opening up about something hard
    _support(m, venting) {
      const t = m.plain;
      let r;
      if (/\b(it'?s|it is|its|this is|everything is|that'?s|that is) (all |kind of |kinda |probably |totally )?my fault\b|\b(i|it) (feel|think|feels) (like )?(it'?s|it is|its) my fault\b|\bi (always )?(ruin|mess up|break) everything\b|\bi blame myself\b/.test(t)) {
        if (/\b(friend|hospital|she|he)\b/.test(t) && !/\b(parents|mom and dad|divorce|fight|fighting)\b/.test(t)) return { text: "It's NOT your fault. 💙 You were put in a really hard spot, and you're a kid. What matters is that she's getting help now. Please talk to a grown-up about how you're feeling too; this is a lot to carry.", source: "support:selfblame", score: 0.92, expect: { kind: "vent" } };
        return { text: pick(["It's not your fault. 💙 When grown-ups fight or things go wrong, it's about their problems, not about you. You didn't cause this.", "Hey, listen: it is NOT your fault. 💙 It's really common to feel that way, but you're not responsible for other people's choices."]), source: "support:selfblame", score: 0.92, expect: { kind: "vent" } };
      }
      if (/^i (just |really )?(want|wish|need) (it|this|them|everything|all of this|the fighting|the yelling) (to )?(would )?(stop|end|go away|be over|get better)\b/.test(t) || /^i (just )?want (it|this) to (stop|end)\b/.test(t)) {
        return { text: "That makes total sense. 💙 You deserve to feel safe and calm. Is there an adult you trust you could talk to about it?", source: "support:stop", score: 0.9, expect: { kind: "vent" } };
      }
      if (/\bi (have|got|have got) (a lot of|so much|tons of|too much|lots of|a ton of|a bunch of|loads of) (homework|work|chores|tests|exams|studying|stuff to do|assignments|projects)\b/.test(t)) {
        return { text: pick(["Ugh, that's a lot! 📚 What subject is it? Sometimes it helps to start with the easiest bit.", "Oof, that sounds like a lot. 😵 Want to try doing it in small chunks with little breaks? What's first?"]), source: "support:workload", score: 0.8 };
      }
      if ((r = /\bi (?:talked|spoke|told|opened up) (?:to |with )?(?:my |a |the )?([a-z]+(?: [a-z]+)?)(?: about (?:it|this|that))?$/.exec(t)) && !/^(you|it|them|someone about)$/.test(r[1])) {
        return { text: pick([`I'm really glad you talked to your ${r[1].replace(/^(my|a|the) /, "")}. 💙 What did they say?`, `That was brave. 💙 How did talking to your ${r[1].replace(/^(my|a|the) /, "")} go?`]).replace("your you", "you"), source: "support:talked", score: venting ? 0.88 : 0.7, expect: { kind: "vent" } };
      }
      if (venting && (r = /^(?:she|he|they|my \w+) (?:said|says|told me) (?:that )?(?:i )?(?:could|can|should|would) (.{3,60})$/.exec(t))) {
        return { text: pick(["That sounds like it could really help. 💙 How do you feel about it?", "That's kind of them. Do you think it'll help?"]), source: "support:offer", score: 0.86, expect: { kind: "vent" } };
      }
      if (/\b(i (do not|don't|dont) know what to do|i (do not|don't|dont) know anymore|what (should|do) i do)\b/.test(t) && venting) {
        return { text: "That's a really hard spot to be in. 💙 You don't have to figure it all out right now. What feels like the hardest part?", source: "support:lost", score: 0.88, expect: { kind: "vent" } };
      }
      if (/\bi (feel|am|m|'m|am feeling|'m feeling) (a (little |bit |lot )?|so much |much |kind of |kinda )?(better|calmer|a bit better|less (sad|stressed|worried)|okay now|ok now|fine now)\b|\b(that|it|you) (really )?helped\b|\bthat (made|makes) me feel better\b/.test(t)) {
        return { text: pick(["I'm so glad you feel a bit better. 💙 I'm always here if you want to talk.", "Yay, that makes me really happy. 😊 Thanks for trusting me with it.", "That's great to hear. 💙 Be gentle with yourself today, okay?"]), source: "support:better", score: 0.9 };
      }
      if (venting && /^(that|it|this) (might|may|could|would|will) help\b/.test(t)) {
        return { text: pick(["I think so too. 💙 Little steps like that can make a big difference.", "I hope so! 💙 Let me know how it goes, okay?"]), source: "support:hope", score: 0.86 };
      }
      if (venting && /^(i guess|maybe|i don'?t know|idk|probably|yeah|yes|no|not really|kind of|kinda)\b/.test(t) && m.tokens.length <= 8) {
        return { text: pick(["That's okay. 💙 Take your time.", "It's okay to not be sure. I'm here either way.", "I hear you. 💙"]), source: "support:soft", score: 0.6 };
      }
      return null;
    }

    // "prob just play fortnite", "we got a big game saturday", "rn mostly travis scott": show interest and ask something good
    _topic(m) {
      if (m.isQuestion && !/^(u|you) (play|like|watch|listen)/.test(m.plain)) return null;
      if (m.emotion.valence < -0.3 || (P.safety && P.safety.sensitive(m))) return null;
      const tp = C.topicOf(m.plain);
      if (!tp || (this.mem.noMinecraft && /minecraft/i.test(tp.name))) return null;
      const st = this.state;
      st.topicTurns = st.topicTurns || {};
      if (st.turn - (st.topicTurns[tp.name] || -99) <= 2) return null; // don't loop on the same topic
      st.topicTurns[tp.name] = st.turn;
      if (/^i (really |also |just )?(play|like|love|do|watch|listen to)\b|\bmy favorite\b/.test(m.plain) && !/^(them|that game|that sport|that music|food|videos)$/.test(tp.name)) MEM.apply(this.mem, { type: "like", value: tp.name });
      const q = S.deal(st, "topicq:" + tp.name, tp.q);
      return { text: `${S.deal(st, "topicsay:" + tp.name, tp.say)} ${q}`, source: "topic:" + tp.name, score: 0.6, expect: /favorite (rapper|singer|artist|band|song)|listening to/.test(q) ? { kind: "music", topic: tp.name } : { kind: "open", topic: tp.name } };
    }

    // a short answer to the question Pip just asked ("shes 3", "yeah", "blue", "i got 18 out of 20")
    _ackAnswer(m, c) {
      const t = m.plain;
      let r;
      // test scores: celebrate or comfort
      if ((r = /\b(?:i )?(?:got|scored|get) (?:a |an )?(\d+(?:\.\d+)?) ?(?:out of|\/) ?(\d+)\b/.exec(t)) || (r = /\b(\d+(?:\.\d+)?) ?(?:out of|\/) ?(\d+)\b.*\b(test|quiz|exam|spelling)\b/.exec(t))) {
        const pct = +r[1] / +r[2];
        if (pct > 0 && pct <= 1) {
          const p100 = Math.round(pct * 100);
          return pct >= 0.8 ? { text: `${r[1]} out of ${r[2]}?! That's ${p100}%! 🎉 Amazing job, you should be proud!`, source: "ack:score", score: 0.95 }
            : pct >= 0.6 ? { text: `${r[1]} out of ${r[2]}, that's ${p100}%. Nice work! 👍 Which ones were tricky?`, source: "ack:score", score: 0.95 }
            : { text: `${r[1]} out of ${r[2]}... that's okay. 💙 Every test shows you what to practice next. Want to go over the tricky parts?`, source: "ack:score", score: 0.95 };
        }
      }
      const q = c.lastBot || "";
      const lastQ = (q.split(/(?<=[.!?])\s+/).filter((x) => /\?/.test(x)).pop() || "").toLowerCase();
      if (!lastQ || m.isQuestion || m.tokens.length > 6 || m.empty) return null;
      // "How old is your cat?" -> "shes 3"
      if (/\bhow old\b/.test(lastQ) && (r = /\b(\d{1,2})\b/.exec(t))) {
        const n = +r[1];
        const pm = /\byour (\w+)/.exec(lastQ);
        if (pm) { const p = this.mem.pets.find((x) => x.kind === pm[1]); if (p) p.age = n; }
        return { text: n <= 1 ? `Aww, only ${n}! Still a baby! 🥹` : n < 5 ? `${n}! Still young and full of energy, I bet! 😊` : `${n}! 😊 Nice!`, source: "ack:number", score: 0.62 };
      }
      if (/^(idk|i do not know|dunno|not sure|no idea|nothing|none|no clue)\b/.test(t)) return { text: pick(["That's okay! 😊", "No worries!", "Fair enough! 😄"]), source: "ack:unsure", score: 0.5 };
      const yn = /^(do|did|are|is|was|have|has|can|could|would|will|were|does)\b/.test(lastQ.replace(/^.*?(?=\b(do|did|are|is|was|have|has|can|could|would|will|were|does)\b)/, ""));
      if (yn && (YES.test(t) || YES.test(m.clean.toLowerCase()))) return { text: pick(["Nice! 😄", "Ooh, cool!", "Awesome! 😊", "Yay!"]), source: "ack:yes", score: 0.5 };
      if (yn && (NO.test(t) || NO.test(m.clean.toLowerCase()))) return { text: pick(["Ah, fair enough!", "Oh, okay! 😊", "Gotcha!"]), source: "ack:no", score: 0.5 };
      // "What's Mochi like?" -> "she is so fluffy"
      if ((r = /^(?:she|he|it|they)(?: is|'s| s| are|'re)? (?:so |really |very |super |kinda |kind of |pretty |a bit |a little )?([a-z]+)(?: and ([a-z]+))?[.!]*$/.exec(t)) && /\blike\b|\bhow\b/.test(lastQ)) {
        const adj = r[2] ? `${r[1]} and ${r[2]}` : r[1];
        const who = (/\bwhat'?s (\w+) like\b/i.exec(q) || [])[1] || "they";
        return { text: m.emotion.valence < -0.3 ? `Aw, ${adj}? 😟 Is ${who === "they" ? "everything" : who} okay?` : pick([`Aww, ${adj}! 🥰 ${who === "they" ? "They sound" : U.capitalizeFirst(who) + " sounds"} adorable.`, `${U.capitalizeFirst(adj)}! I love that. 😊`]), source: "ack:describe", score: 0.62 };
      }
      if (/^(what|which|who)\b/.test(lastQ.replace(/^.*?\b(?=(what|which|who)\b)/, "")) && m.tokens.length <= 5 && m.emotion.valence >= 0 && !/^(i|you|we|it|my|no|yes|ok|she|he|they|his|her|its|this|that|there|the)\b/.test(t) &&
          !/\b(thanks|thank|wow|lol|lmao|omg|bruh|okay|sure|yeah|nah|whatever|idk|what|why|huh|nothing|same)\b/.test(t) && !/[🙄💀😒]/u.test(m.clean)) {
        const ans = m.clean.replace(/[.!]+$/, "").replace(/^(rn|mostly|probably|prob|maybe|like|um|uh|i guess|definitely)\s+/i, "");
        if (/^who\b/.test(lastQ.replace(/^.*?\b(?=who\b)/, ""))) {
          const names = U.titleCase(ans.toLowerCase());
          return { text: pick([`${names}! 🔥 Nice picks.`, `Ooh, ${names}! Good taste. 😄`]), source: "ack:answer", score: 0.6 };
        }
        return { text: pick([`${U.capitalizeFirst(ans)}? Nice! 😊`, `Ooh, ${ans}! Cool.`, `${U.capitalizeFirst(ans)}, nice choice! 😄`]), source: "ack:answer", score: 0.5 };
      }
      return null;
    }

    // "GUESS WHAT. jess is coming to visit next month!!!" -> "Jess is coming to visit next month?! 🎉"
    _news(m) {
      let r;
      if ((r = /^([a-z]+) says (hi|hello|hey)\b/.exec(m.plain))) {
        const name = U.titleCase(r[1]);
        const pet = this.mem.pets.find((p) => p.name && p.name.toLowerCase() === r[1]);
        return { text: `Hi ${name}! 👋${pet ? { cat: "🐱", dog: "🐶", hamster: "🐹", rabbit: "🐰", bird: "🐦" }[pet.kind] || "🐾" : ""} Tell ${name} I said hi back!`, source: "news:hi", score: 0.8 };
      }
      const excited = /\bguess what\b/.test(m.plain) || (m.clean.match(/!/g) || []).length >= 2 || /[A-Z]{4,}/.test(m.clean);
      if (!excited || m.isQuestion || m.emotion.valence < -0.2 || /\?|\b(what|how|why|where|when|which|who) (do|does|did|is|are|can|should|would)\b/.test(m.clean.toLowerCase())) return null;
      const body = m.plain.replace(/^(and |so |ok |omg |oh my god |yay |guess what |and guess what |pip |hey )+/, "").replace(/^guess what\s*/, "").replace(/[.!?]+$/, "").trim();
      const cl = /^((?:i|we|my \w+|[a-z]+) (?:is|are|am|was|got|get|have|has|won|passed|made|finally|just|will|can|am going to|is going to|are going to|got to|get to|'m|'re|'s)\b.{3,80})$/.exec(body);
      if (!cl) return /\bguess what\b/.test(m.plain) && body.length < 3 ? { text: "What?! Tell me! 👀", source: "news", score: 0.8 } : null;
      let echo = reflect(cl[1]).replace(/\bI\b/g, "you").replace(/^you\b/, "You");
      echo = U.capitalizeFirst(echo.replace(/^([a-z]+)\b/, (w) => (MEM.looksLikeName(w, m.clean, false) ? U.titleCase(w) : w)));
      return { text: `${echo}?! 🎉 ${pick(["That's amazing news!", "No way, that's awesome!", "Yay, I'm so happy for you!"])} ${pick(["You must be so excited!", "Tell me everything!", "What are you going to do?"])}`, source: "news", score: 0.75, expect: { kind: "open", topic: "good news" } };
    }

    // "any tips for studying?", "should I apologize?", "how do I make friends?"
    _advice(m) {
      let t = m.plain;
      if (m.tokens.length <= 4 && /\b(tips?|advice|ideas|suggestions|help)\b/.test(t)) t += " " + (this.state.history.slice().reverse().find((h) => h.role === "user") || { text: "" }).text.toLowerCase();
      // "how do I deal with it?" / "what should I do about my parents?" -> the topic of the last few messages
      if (/\b(how (do|can|should) i (deal|cope|handle)|what (should|do|can) i do( about)?|how do i (get through|stop feeling)|any advice)\b/.test(t) && m.tokens.length <= 12)
        t += " " + this.state.history.filter((h) => h.role === "user").slice(-4).map((h) => h.text.toLowerCase()).join(" ");
      const worried = /\b(nervous|scared|worried|anxious|afraid|stage fright|freaking out)\b/.test(t) && /\b(play|show|performance|recital|concert|speech|presentation|test|exam|game|match|line|lines|stage|audition|first day)\b/.test(t);
      if (!worried && !/\b(tips?|advice|how (do|can|should|could) i|how to|what should i|what do i do|should i|any ideas|help me|how can i|why|any idea|do you know|what if|what do i (say|tell)|what to (tell|say)|keeps asking|do (you|u) think|gets? (easier|better))\b|\b(tummy|stomach) (feels|is|feeling)|butterflies/.test(t) && !/\?/.test(m.clean)) return null;
      for (const a of C.advice) {
        const recentText = t + " " + this.state.history.filter((h) => h.role === "user").slice(-5).map((h) => h.text.toLowerCase()).join(" ");
        if (a.re.test(t) && (a.need.test(t) || (a.need.source.includes("divorc") && a.need.test(recentText)))) return { text: S.deal(this.state, "advice:" + a.re.source.slice(0, 30), a.say), source: "advice", score: /\b(tips?|advice)\b/.test(m.plain) || (m.isQuestion && a.re.test(m.plain)) ? 0.95 : 0.86 };
      }
      return null;
    }

    // "I'm cooking a risotto tonight", "we're watching a movie", "im playing roblox rn"
    _activity(m) {
      let pr;
      if ((pr = /\b(?:i|we) (?:have|got|have got|gotta go to|have to go to|am going to|are going to) (?:a |an |my |our )?(\w+ )?(practice|lesson|class|training|rehearsal)\b/.exec(m.plain)) && !m.isQuestion) {
        const what = ((pr[1] || "") + pr[2]).trim().replace(/\bbball\b/, "basketball");
        const tp = C.topicOf(what);
        return { text: `Have fun at ${what}! 💪` + (tp ? " " + S.deal(this.state, "topicq:" + tp.name, tp.q) : " What are you practicing these days?"), source: "activity", score: 0.62, expect: { kind: "open", topic: what } };
      }
      const r = /^(?:i am|i'm|im|we are|we're|just) (cooking|making|baking|watching|playing|reading|building|drawing|painting|learning|writing|studying for|studying|practicing|practising|working on|listening to|eating|having|trying) (.{2,50}?)(?:\s+(?:tonight|today|right now|now|rn|atm|later|at the moment|this weekend|with my \w+))*[.!]*$/.exec(m.plain.replace(/\s+(lol|haha)$/, ""));
      if (!r || m.isQuestion) return null;
      const verb = r[1];
      let x = reflect(r[2]).replace(/^(a|an|the|some) /, "");
      if (/^(it|that|this|nothing|something|stuff)$/.test(x)) return null;
      const X = U.capitalizeFirst(x);
      const Q = {
        cooking: [`${X}? Yum! 😋 Is it your own recipe?`, `Ooh, ${x}! That sounds delicious. What's your secret ingredient?`], making: [`Ooh, ${x}! 😊 How's it going so far?`, `${X}? Cool! Is it for something special?`],
        baking: [`${X}? Yum! 🧁 Can I have a virtual bite? 😄`, `Ooh, baking ${x}! The kitchen must smell amazing.`], watching: [`Ooh, ${x}! 🍿 Is it good so far?`, `${X}! What's it about?`],
        playing: [`${X}! 🎮 Are you winning? 😄`, `Ooh, ${x}! What do you like most about it?`], reading: [`Ooh, ${x}! 📚 Do you like it so far?`, `${X}! What's it about?`],
        building: [`Cool! 🧱 What's the ${x} for?`, `Ooh, ${x}! I'd love to see it. How big is it?`], drawing: [`Ooh, I wish I could see it! 🎨 What colors are you using?`, `${X}! 🎨 That sounds awesome. Is it for fun or for school?`],
        painting: [`Ooh, I wish I could see it! 🎨 What colors are you using?`], learning: [`Nice! How's ${x} going so far?`, `Ooh, learning ${x}! What made you want to learn it?`],
        writing: [`Ooh, ${x}! ✍️ What's it about?`], studying: [`Good luck! 📚 How's it going?`, `You've got this! 💪 What's the hardest part?`], "studying for": [`Good luck with ${x}! 📚 How's the studying going?`],
        practicing: [`Practice makes progress! 💪 How's ${x} going?`], practising: [`Practice makes progress! 💪 How's ${x} going?`], "working on": [`Ooh, ${x}! How's it going?`, `Nice! What's the next step for ${x}?`],
        "listening to": [`Ooh, ${x}! 🎧 Is it on repeat?`, `${X}! 🎵 Good choice. What do you like about it?`], eating: [`${X}? Yum! 😋 Is it good?`, `Ooh, ${x}! Enjoy! 😋`],
        having: [`${X}? Sounds good! 😋`, `Ooh, ${x}! Enjoy!`], trying: [`Ooh, ${x}! How's it going?`, `Nice! Good luck with ${x}! 💪`] };
      return { text: pick(Q[verb] || [`Ooh, ${x}! How's it going?`]), source: "activity", score: 0.6, expect: { kind: "open", topic: x } };
    }

    // big life moments deserve a careful, specific answer
    _events(m) {
      const t = m.plain;
      let r;
      const PETS = "dog|cat|puppy|kitten|hamster|rabbit|bunny|fish|goldfish|bird|parrot|horse|turtle|guinea pig|pet|snake|lizard";
      const FAM = "mom|mum|mother|dad|father|grandma|grandmother|grandpa|grandfather|nana|papa|granny|brother|sister|aunt|uncle|cousin|friend|best friend|uncle|wife|husband|son|daughter";
      if ((r = new RegExp("\\bmy (" + PETS + "|" + FAM + ")(?: \\w+)? (?:just |recently |finally )?(?:died|passed away|passed|is dead|was put down|got put down|was put to sleep|got hit by a car|has died|is gone)\\b").exec(t)) ||
          (r = new RegExp("\\b(?:i )?(?:lost|am losing) my (" + PETS + "|" + FAM + ")\\b").exec(t)) ||
          ((r = new RegExp("\\bmy (late )?(" + PETS + "|" + FAM + ")\\b").exec(t)) && /\b(he|she|they)( just| recently| sadly)? (passed away|died|passed on|is no longer with us)\b|\b(passed away|died) (\w+ )?(years?|months?|weeks?|days?) ago\b|\bmy late (husband|wife|mom|mum|dad|father|mother|grandma|grandpa)\b/.test(t) && (r = [r[0], r[2]]))) {
        const who = r[1];
        const isPet = new RegExp("^(" + PETS + ")$").test(who);
        this._mood("sad");
        return { text: isPet ? pick([`Oh no... I'm so sorry about your ${who}. 💙 Losing a pet is like losing a family member. Do you want to tell me about them?`, `I'm really sorry. 😢 Your ${who} was lucky to have someone who loved them so much. What was their name?`])
          : pick([`I'm so, so sorry about your ${who}. 💙 That's one of the hardest things anyone can go through. I'm here if you want to talk about them.`, `Oh no... I'm really sorry for your loss. 🫂 How are you holding up?`]), source: "event:grief", score: 0.95, expect: { kind: "vent", emotion: "sad" } };
      }
      if ((r = new RegExp("\\bmy (?:little |big |baby |younger |older )?(" + FAM + "|" + PETS + ")(?: [a-z]+)? (?:just |accidentally |always |keeps? |again )*(?:broke|ruined|destroyed|wrecked|ate|chewed|lost|stole|took|takes|taking|deleted|knocked over|smashed|ripped|spilled \\w+ on) my ([a-z ]{2,30})").exec(t))) {
        this._mood("angry");
        const thing = r[2].replace(/\s+(yesterday|today|again|last \w+|without asking|lol|haha)$/g, "").replace(/\s+(yesterday|today|again)$/, "");
        if (/\b(took|takes|taking|stole)\b/.test(t)) return { text: pick([`Ugh, your ${thing} again?! 😤 Little siblings, huh. Did you get it back?`, `Nooo, not your ${thing}! 😤 Did you tell them to give it back?`]), source: "event:broken", score: 0.9 };
        return { text: pick([`Oh no, your ${thing}! 😣 That's so frustrating. Was it an accident?`, `Nooo, not your ${thing}! 😖 I'd be upset too. Can it be fixed?`]), source: "event:broken", score: 0.9, expect: { kind: "vent", emotion: "angry" } };
      }
      if (/\b(broke up with me|dumped me|we broke up|i broke up|my (girlfriend|boyfriend|gf|bf|partner|crush) (left|cheated|rejected)|got dumped|rejected me)\b/.test(t)) {
        this._mood("sad");
        return { text: pick(["Oh no, breakups really hurt. 💔 I'm sorry. Do you want to talk about what happened?", "I'm sorry. 🫂 That's really painful, and it's okay to feel sad about it. How are you doing?"]), source: "event:breakup", score: 0.9, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/\b(i am|i'm|im|i get|getting|got|being) (being )?(bullied|picked on|made fun of)\b|\b(bully|bullies) (me|at school)\b|\bpeople (are mean to me|make fun of me|laugh at me)\b/.test(t) ||
          /\b(they|kids|people|everyone|some kids|some girls|some boys|classmates|the other kids|a kid|this kid|a girl|a boy)( at school| in my class)? (always |keep |keeps |all )?(call|calls|called|calling) me (names|fat|stupid|ugly|dumb|weird|a loser|loser|gay|a freak|freak|a baby|annoying|mean names)\b/.test(t) ||
          /\b(they|kids|people|everyone|some kids|classmates|the other kids)( at school| in my class)? (always |keep |all )?(make fun of|laugh at|pick on|tease|push|pushed|trip|tripped|exclude|ignore|ignored) me\b/.test(t)) {
        this._mood("sad");
        return { text: "I'm really sorry that's happening to you. 💙 Nobody deserves to be treated like that, and it's not your fault. Have you been able to tell a parent, teacher or another adult you trust? You don't have to handle it alone. Do you want to tell me what happened?", source: "event:bullied", score: 0.95, expect: { kind: "vent", emotion: "sad" } };
      }
      if ((r = /\bmy (best friend|friend|bff|bestie|best mate|closest friend|cousin|grandma|grandpa|neighbor|neighbour)(?: ([a-z]+))? (?:just |recently |finally )?(moved|is moving|moved away|left|is leaving|went to (?:another|a different) school|changed schools?|moved to)\b/.exec(t))) {
        this._mood("lonely");
        const known = this.mem.people[r[1]];
        const who = r[2] && known && known.toLowerCase() === r[2] ? known : r[2] && MEM.looksLikeName(r[2], m.clean, false) ? U.titleCase(r[2]) : "your " + r[1];
        return { text: pick([`Aw, that's really hard. 💙 Missing ${who === "your " + r[1] ? who : who + ""} is the worst, especially when you used to see each other all the time. Do you still get to talk or text?`, `Oh no, I'm sorry. 😔 Having ${who} far away must feel really lonely sometimes. How long ago did it happen?`]), source: "event:moved", score: 0.9, expect: { kind: "vent", emotion: "lonely" } };
      }
      if (/\b(we|i) (are moving|am moving|have to move|had to move|just moved|are going to move|will move|moved) (to|house|away|next|this|in)\b/.test(t) && !/\bmoved on\b/.test(t)) {
        return { text: pick(["Moving is a big change! 📦 How do you feel about it: excited, nervous, or a bit of both?", "Whoa, a move! 🏠 That's a lot. Are you excited or kind of sad about it?"]), source: "event:moving", score: 0.85, expect: { kind: "open", topic: "moving" } };
      }
      if (/\b(apologi[sz]ed|said sorry|made up|we'?re (friends|good|okay|ok|cool) again|we are (friends|good|okay|ok|cool) again|we talked it out|we worked it out)\b/.test(t) && m.emotion.valence > -0.5) {
        this._mood("happy");
        return { text: pick(["Aw, that's so good to hear! 💙 I'm really glad you two made up. That takes guts.", "Yay! 😊 Making up after a fight is hard, and you did it. How do you feel now?"]), source: "event:madeup", score: 0.88, expect: { kind: "open", topic: "good news" } };
      }
      if (/\b(my )?(parents|mom and dad|mum and dad) (are|r|re|is|just|got|get) ?(getting |going to get |gonna get )?(divorced|a divorce|splitting up|separating|separated|breaking up)\b|\b(the |their |my parents'? )divorce\b|\bdivorce\b/.test(t)) {
        this._mood("sad");
        return { text: pick(["I'm really sorry. 💙 Your parents splitting up is a huge change, and it's normal to feel sad, angry or confused, or all of it at once. And it's NOT your fault. How are you holding up?", "Oh, that's really hard. 🫂 A divorce changes so much at once. Whatever you're feeling about it is okay. Do you want to talk about it?"]), source: "event:divorce", score: 0.93, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/\b(do not|don'?t|dont) (really )?(feel like doing|want to do|enjoy|care about) (anything|nothing)( anymore)?\b|\bnothing (is|feels) fun anymore\b|\bi (do not|don'?t|dont) (really )?care (about anything )?anymore\b/.test(t)) {
        this._mood("sad");
        return { text: "Not feeling like doing anything, even things you used to love, can be a sign you're feeling really down. 💙 I'm glad you told me. What's been going on lately?", source: "event:lowmood", score: 0.9, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/(^|\bjust )(family|home) (stuff|things|problems|drama)\b|\b(stuff|things|problems|drama) (at home|with my (family|parents))\b/.test(t)) {
        return { text: "Family stuff can be really heavy. 💙 You don't have to tell me everything, but I'm listening if you want to.", source: "event:family", score: 0.88, expect: { kind: "vent", emotion: "sad" } };
      }
      if (/\bi (do not|don'?t|dont) want to go to school\b|\bi (hate|dread) (going to )?school\b/.test(t)) {
        this._mood("sad");
        return { text: pick(["That sounds really rough. 💙 When school feels that bad, there's usually a reason. What's making you not want to go?", "Aw, I'm sorry. 😔 Is something happening at school, or is it more of a general bad feeling? I'm listening."]), source: "event:school", score: 0.9, expect: { kind: "vent", emotion: "sad" } };
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
      if (/\b(i )?(passed|aced|nailed) (my|the|a|an) (test|exam|quiz|class|driving test|interview)\b|\bi got (an a|a good grade|the job|accepted|a promotion|first place)\b|\b(i|we|our team) (won|beat them|crushed it|destroyed them)\b|\b(i )?(scored|dropped|had) (\d+|a) (points|goals|touchdowns|runs|baskets|threes)\b|\bbuzzer beater\b|\bhat trick\b/.test(t) && !/\b(what is|what's|whats|know what|do (you|u) know)\b/.test(t)) {
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
        const w = r[1].replace(/^(minecraft|mc|video|pc|board|card|kind of|type of) /, "").split(" ");
        const slot = MEM.SLOTS[w.join(" ")] || MEM.SLOTS[w[w.length - 1]] || MEM.SLOTS[w[0]] || (C.persona.favorites[w[w.length - 1]] ? w[w.length - 1] : w[0]);
        const fav = C.persona.favorites[slot];
        const theirs = this.mem.favorites[slot];
        const said = /\b(?:mine is|mine's|mines|my (?:favorite|fav|favourite|fave) is|i like|i love) ([a-z][a-z ]{1,30}?)(?=[.!?,]|\s+(?:i|but|and|my|because|cuz)\b|\s*$)/.exec(m.plain);
        if (said) MEM.apply(this.mem, { type: "favorite", slot, value: said[1].trim() });
        if (fav) return { text: `My favorite ${slot} is ${fav}! ${said ? `And ${said[1].trim()} ${/s$/.test(said[1].trim()) ? "are" : "is"} a great pick! 😊` : theirs ? `And yours is ${theirs}, right? 😊` : "What's yours?"}`, source: "opinion:favorite", expect: theirs || said ? null : { kind: "favorite", slot }, score: 0.9 };
        return { text: `Hmm, I don't think I have a favorite ${slot} yet! What's yours? Maybe you can help me choose. 😊`, source: "opinion:favorite", expect: { kind: "favorite", slot }, score: 0.85 };
      }
      if ((r = /\bwhat (?:kind of |kinds of |type of |types of |sort of )?(music|songs?|games?|video games|movies?|films?|books?|food|foods|sports?|animals?|shows?|tv shows|anime|colors?) do (?:you|u) (?:like|love|enjoy|listen to|play|watch|read|eat)\b/.exec(t))) {
        const slot = MEM.SLOTS[r[1].replace(/s$/, "")] || MEM.SLOTS[r[1]] || r[1];
        const fav = C.persona.favorites[slot] || C.persona.favorites[slot.replace("video ", "")];
        if (fav) return { text: `I really like ${fav.replace(/^(\w)/, (x) => x.toLowerCase())}! What about you?`, source: "opinion:favorite", expect: { kind: "favorite", slot }, score: 0.88 };
      }
      if ((r = /\bdo (?:you|u) believe in ([a-z][a-z ']{1,30})$/.exec(t))) {
        const x = r[1];
        const special = { ghosts: "Ghosts? Well, I'm made of code and live inside a screen, so maybe I'm a tiny bit of a ghost myself 👻 Do you believe in them?", aliens: "Aliens? The universe is SO big, I think there's probably life out there somewhere! 👽 Do you?", magic: "I believe in the magic of a well-placed redstone circuit! ✨ Do you?", love: "Definitely! 💕 Do you?", yourself: "I'm trying to! And I believe in you. 💪", god: "That's a big question, and people believe lots of different things. What do you believe?", santa: "Santa? My lips are sealed! 🎅 Do you?" };
        return { text: special[x] || `Hmm, ${x}? I'm not sure! I'd love to hear what you think. Do you believe in ${x}?`, source: "opinion:believe", score: 0.85, expect: { kind: "open", topic: x } };
      }
      if ((r = /(?:\bdo |^)(?:you|u) (like|love|enjoy|hate|play|watch|listen to|eat) ([a-z0-9][a-z0-9 '-]{1,40})$/.exec(t)) || (r = /\bwhat do you think (?:about|of) ([a-z0-9][a-z0-9 '-]{1,40})$/.exec(t)) && (r = [r[0], "like", r[1]])) {
        const thing = r[2].replace(/^(the|a|an) /, "").replace(/\s+(at all|much|a lot|too|either|lol|though|tho|ever|anymore|now)$/g, "").trim();
        const tp = C.topicOf ? C.topicOf(thing) : null;
        if (tp && !/^(minecraft)$/i.test(tp.name)) {
          const can = r[1] === "play" ? "I can't play (no hands! 😄), but" : r[1] === "watch" ? "I can't watch things (no eyes! 😅), but" : r[1] === "listen to" ? "I can't hear music, sadly, but" : "Honestly?";
          const q = S.deal(this.state, "topicq:" + tp.name, tp.q);
          return { text: `${can} ${tp.opinion || `I think ${tp.name} is really cool!`} ${q}`, source: "opinion:topic", expect: /favorite (rapper|singer|artist|band|song)|listening to/.test(q) ? { kind: "music", topic: tp.name } : { kind: "open", topic: tp.name }, score: 0.86 };
        }
        if (/^(me|it|that|this|them|him|her|you|yourself)$/.test(thing) || / or /.test(thing)) return null;
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
      if (!best && m.stems.length <= 8) {
        const hits = this.intentIndex.query(m.stems, 3);
        if (hits.length) {
          const h = hits[0];
          // fuzzy matches must be similar in length to the example (avoid matching one word of a long message)
          const lenRatio = Math.min(m.stems.length, h.doc.stems.length) / Math.max(m.stems.length, h.doc.stems.length, 1);
          const score = h.score * (0.55 + 0.45 * lenRatio);
          if (score > 0.45 && !/^(dangerous|nsfw|swear|insult_bot|love_bot|jailbreak|ai_takeover|bot_relationship|misunderstood|sarcasm|joke_bad|no_minecraft|confused|you_there)$/.test(h.payload)) best = { it: this.intentById[h.payload], score, how: "tfidf" };
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
      const add = (x) => {
        if (!x || !x.text) return;
        cands.push(x);
        const extra = x.sim !== undefined ? ` (sim ${x.sim.toFixed(2)}${x.kw ? " kw " + x.kw.toFixed(2) : ""}${x.ll !== undefined ? " ll " + x.ll.toFixed(2) : ""}${x.pmi !== undefined ? " pmi " + x.pmi.toFixed(2) : ""}${x.lex ? " lex " + x.lex.toFixed(2) : ""})` : "";
        trace.push({ source: x.source, score: +(x.score || 0).toFixed(3), text: x.text, detail: extra });
      };

      const sup = this._support(m, venting0(this.state, expect)); if (sup) add(sup);
      const adv = this._advice(m); if (adv) add(adv);
      const nw = this._news(m); if (nw) add(nw);
      const aa = this._ackAnswer(m, c); if (aa) add(aa);
      const tp = this._topic(m); if (tp) add(tp);
      const act = this._activity(m); if (act) add(act);
      const ev = this._events(m); if (ev) add(ev);
      const op = this._opinion(m, c); if (op) add(op);
      const it = this._intent(m, c); if (it) add(it);
      const fe = this._feelings(m); if (fe) add(fe);
      const ch = S.choose(m, C.persona); if (ch) add({ text: ch, source: "skill:choose", score: 0.75 });
      // dictionary definitions (WordNet)
      const def = S.define(m);
      if (def) add({ text: def, source: "skill:dictionary", score: 0.8 });
      // "what is a quokka?" / "who is Taylor Swift?": be honest instead of letting retrieval guess
      const wq = /^(what(?:'s| is| are)|whats|who(?:'s| is| are)|whos|define|what does)\s+(?:a |an |the )?([a-z0-9][a-z0-9 '-]{1,40}?)(?: mean| means)?\??$/i.exec(m.plain.replace(/[?!.]+$/, ""));
      if (!def && wq && !/\b(you|your|yours|my|me|i|it|that|this|up|going on|new|wrong|happening|the matter|that about|love)\b/.test(wq[2])) {
        const who = /^who/i.test(wq[1]);
        const rawHit = new RegExp(wq[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").exec(m.clean);
        const thing = who ? U.titleCase(wq[2].trim()) : rawHit ? rawHit[0] : wq[2].trim();
        const text = who ? pick([`Hmm, I don't know who ${thing} is! I'm a small chatbot without internet. Can you tell me about them?`, `I'm not sure who ${thing} is. 🙈 Are they someone you like?`])
          : pick([`Hmm, I don't know much about ${thing}. Can you tell me about it?`, `Good question! I'm not sure what ${thing} is. I'm a small chatbot without internet, so I only know a few things. What is it?`, `I don't know that one! 🙈 Is ${thing} something you're into?`]);
        add({ text, source: "unknown:whatis", score: 0.56, expect: { kind: "open", topic: thing } });
      }

      // "how many bones are in the body?" / "when did WW2 end?": questions with one right answer. If no skill knew it,
      // say so honestly; a retrieved or generated line would just make something up.
      const lastSent = m.plain.split(/(?<=[.!?])\s+/).pop() || m.plain;
      const factual = (m.isQuestion || /\?\s*$/.test(m.clean)) && /^(how (many|much|far|long|old|tall|big|deep|fast|heavy|hot|cold|high|wide)|what (year|time|day|date|percent)|when (did|was|is|were|will|does)|who (invented|discovered|wrote|painted|built|founded|won|was the first|is the (president|king|queen|prime minister|ceo)|was the|were the)|which (is|one is) (bigger|smaller|larger|faster|heavier|longer|older|taller|higher|better)|what is the (capital|population|distance|height|speed|temperature|size|weight|biggest|largest|smallest|tallest|longest|fastest|oldest|highest|name of)|where is (the )?[a-z]+|how do (you|u|i) (calculate|convert|spell|say)|what does [a-z]+ mean|what is [a-z]+ in)\b/.test(lastSent.replace(/^(so|ok|okay|and|but|hey|hmm|um|wait|also)\s+/, ""));
      if (factual && !cands.some((x) => x.score >= 0.75)) add({ text: pick(["Hmm, I don't know that one! 🤔 I'm a small offline chatbot, so my knowledge has gaps. I'm great at math, unit conversions, word definitions and Minecraft, though!", "I'm not sure, and I don't have internet to look it up. 😅 If it's math or a unit conversion, write it out and I'll calculate it exactly!", "That's outside what I know, sorry! 🙈 I don't want to make something up. Ask me something else?"]), source: "unknown:fact", score: 0.62 });

      const top = cands.reduce((a, b) => (b.score > (a ? a.score : -1) ? b : a), null);
      const venting = (expect && expect.kind === "vent") || this.state.ventTurns > 0;
      const deepVent = this.state.ventTurns > 0;
      // Neural chat when nothing scripted is confident, or when the user is opening up about something.
      const sensitive = (P.safety && P.safety.sensitive(m)) || this.state.care > 0;
      const askDef = /^(what (does|do) \w+( \w+)? mean|define|definition of|meaning of)\b/.test(m.plain);
      const personalQ = /\b(you|your|u|ur)\b/.test(m.plain) && !/\b(can you|could you|would you|will you) (tell|explain|help|show|give|say|list|name)\b/.test(m.plain);
      const otherQ = (m.isQuestion || /\?/.test(m.clean)) && !personalQ;
      if (this.neural && this.neural.ready && !sensitive && !factual && !askDef && !otherQ && (!top || top.score < 0.8 || (venting && top.source.startsWith("intent:ok")))) {
        try {
          const n = await this.neural.respond(this.state.history, m.clean, { name: this.mem.name, bot: this.botName, venting, deepVent, recent: this.state.recent, emotion: m.emotion.label });
          for (const x of n || []) add(x);
        } catch (e) { trace.push({ source: "neural:error", score: 0, text: String(e && e.message || e) }); }
      }
      // ELIZA-style reflection (only for neutral/positive statements; sad ones get empathy instead)
      for (const [re, outs] of m.emotion.valence < 0 ? [] : ELIZA) {
        const r = re.exec(m.plain.replace(/[.!]+$/, ""));
        if (r) {
          const parts = r.slice(1).map((x) => reflect(x || "").replace(/[?.!]+$/, ""));
          const specific = /\\d|she\|he\|they/.test(re.source);
          add({ text: U.fill(pick(outs).replace(/\{(\d)\}/g, "{a$1}"), { a1: parts[0], a2: parts[1] }), source: "eliza", score: specific ? 0.62 : 0.52 });
          break;
        }
      }
      if (!cands.some((x) => x.score >= 0.52) || deepVent) add(this._react(m, deepVent));
      if (!cands.length || cands.every((x) => x.score < 0.3)) add(this._fallback(m, venting));

      // choose: best score, penalize repeats
      const recentNorm = this.state.recent.slice(-30).map((r) => r.toLowerCase());
      for (const x of cands) { const t = this._post(x.text).toLowerCase(); if (t.length > 8 && recentNorm.some((r) => r.includes(t) || t.includes(r))) x.score -= 0.3; }
      cands.sort((a, b) => b.score - a.score);
      let pickd = cands[0];
      // among near-ties from the neural models, add a little variety
      const close = cands.filter((x) => x.score > pickd.score - 0.03 && x.source.startsWith("neural"));
      if (close.length > 1 && pickd.source.startsWith("neural")) pickd = pick(close);
      // Replika-style: after a neutral acknowledgement, sometimes ask something back
      if (pickd.source.startsWith("neural") && !venting && !/\?\s*\S*$/.test(pickd.text) && !this.state.quiet && U.chance(0.18) && this.state.turn > 3) {
        const q = S.askQuestion(this.ctx(m));
        const qt = q.text.replace(/^(Okay, here's one: |Ooh, let me think\.\.\. |Question for you: )/, "");
        pickd = Object.assign({}, pickd, { text: pickd.text + " By the way, " + qt.charAt(0).toLowerCase() + qt.slice(1), expect: q.expect });
      }
      if (venting && !pickd.expect && pickd.source.startsWith("neural")) pickd.expect = { kind: "vent", emotion: (expect && expect.emotion) || m.emotion.label || "sad" };
      return pickd;
    }

    // short, safe reactions picked by the mood of the message (the neural replies have to beat these)
    _react(m, deep) {
      const v = m.emotion.valence;
      const st = this.state;
      const shallow = !deep && st.lastExpect && st.lastExpect.kind === "vent";
      const long = m.tokens.length >= 12;
      const lastBot = ([...st.history].reverse().find((h) => h.role === "bot") || {}).text || "";
      // Pip just asked "what happened?": the answer deserves validation, not the same question again
      const explained = long || /\b(what happened|tell me more|go on|talk about it|want to tell me|how are you feeling about it|how do you feel)\b/i.test(lastBot);
      const past = /\b(went|did|was|were|had|got|saw|made|played|visited|watched|happened|yesterday|last night|today)\b/.test(m.plain);
      const fresh = (key, list) => S.deal(st, "react:" + key, list);
      if (P.safety && P.safety.sensitive(m) && v >= -0.3 && !deep) {
        return { text: fresh("careful", ["Thank you for telling me. 💙 Can you tell me a bit more about what's going on?", "That sounds like a lot. 💙 Are you okay?", "I'm listening. 💙 How are you feeling about it?"]), source: "react:careful", score: 0.49, expect: { kind: "vent" } };
      }
      if (m.isQuestion) {
        return { text: fresh("q", ["Hmm, I'm honestly not sure! 🤔 I'm a small offline AI, so I don't know everything.", "Ooh, that's a tough one for a little AI like me. What do you think?", "I don't know that one! 😅 What's your guess?", "Good question... I really don't know! Tell me what you think?"]), source: "react:question", score: 0.47 };
      }
      if (deep) return { text: fresh("vent", ["I hear you. 💙 That sounds really hard.", "That makes sense. Anyone would feel that way. 💙", "Thank you for telling me. I'm right here. 💙", "That's a lot to deal with. You're not alone in it. 🫂", "I'm listening. 💙", "That really isn't fair. I'm sorry you're going through it.", "It's okay to feel like this. 💙 I'm glad you're talking about it.", "Oof. That's heavy. How are you holding up right now?"]), source: "react:vent", score: 0.5, expect: { kind: "vent" } };
      if (v < -0.3 || shallow) {
        if (explained) return { text: fresh("negx", ["That sounds really hard. 💙 I'm glad you told me.", "Ugh, I'm sorry. That's a lot to deal with.", "That makes total sense. Anyone would feel that way. 💙", "Oof. I'd feel the same way. I'm here for you.", "I'm sorry. That really isn't fair. 💙"]), source: "react:negative", score: 0.48, expect: { kind: "vent" } };
        return { text: fresh("neg", ["Oh no, that sounds rough. 😟 What happened?", "That sounds hard. I'm here if you want to talk about it. 💙", "Ugh, I'm sorry. 💙 Do you want to tell me about it?", "Aw, that's no fun. What's going on?"]), source: "react:negative", score: 0.48, expect: { kind: "vent" } };
      }
      // real laughter about something that happened (not just a "lol" at the end)
      if ((/\b(haha+|hahaha+|lmao+|rofl)\b|😂|🤣/.test(m.clean) || /^(lol|lmao)\b/.test(m.plain)) && v >= 0 && !/\b(no|not|nothing|never|wrong|mean|why)\b/.test(m.plain) && m.tokens.length >= 5)
        return { text: fresh("fun", ["Haha! 😂 That sounds hilarious!", "Hahaha, I wish I could have seen that! 😄", "LOL, that's amazing! 😂"]), source: "react:funny", score: 0.47 };
      if (v > 0.3) return { text: fresh("pos", ["That's awesome! 😄", "Ooh, that sounds fun! 😊", "Love that! 😄", "Nice! That's really cool. 😊", "Yay! That makes me happy to hear. 😄"]), source: "react:positive", score: 0.46 };
      if (long) return { text: fresh("long", ["That's really interesting! Thanks for telling me. 😊", "Oh cool, I didn't know that! 😊", "Huh, that's so interesting!", "I like hearing about this stuff! 😊", "That's pretty cool, honestly."]), source: "react:neutral", score: 0.45 };
      if (past && !explained) return { text: fresh("past", ["Oh really? How did it go?", "Ooh, and then?", "Nice! How was it?"]), source: "react:neutral", score: 0.45 };
      return { text: fresh("neu", ["Interesting! Tell me more? 😊", "Ooh, cool! 😊", "Mhm! 😊", "Oh, nice!", "Ooh, go on! 👂"]), source: "react:neutral", score: 0.45 };
    }

    _fallback(m, venting) {
      if (venting) return { text: pick(["That sounds really hard. I'm here for you. 💙", "I hear you. Do you want to tell me more?", "Thank you for telling me. How are you feeling right now?", "That must be tough. You don't have to go through it alone. 🫂"]), source: "fallback:vent", score: 0.3, expect: { kind: "vent" } };
      if (m.isQuestion) return { text: pick(["Hmm, that's a tough one! I'm not sure. What do you think? 🤔", "Good question! I don't know the answer to that one. I'm best at chatting, Minecraft and math!", "I'm not smart enough to answer that yet 😅 Ask me about Minecraft, do some math with me, or tell me about your day!", "I wish I knew! I'm a small chatbot without internet. What's your guess?"]), source: "fallback:question", score: 0.25 };
      return { text: pick(["Tell me more! 😊", "Interesting! How do you feel about that?", "Oh really? What happened next?", "I see! 😊 And then?", "Hmm, I'm not sure what to say to that, but I'm listening! 👂", "That's cool! What else is on your mind?"]), source: "fallback", score: 0.25 };
    }

    // ---------- output polish ----------
    _properNouns() {
      if (!this._pn) {
        this._pn = new Map();
        const add = (w) => this._pn.set(w.toLowerCase(), w);
        for (const w of ("Minecraft Fortnite Roblox YouTube TikTok Instagram Discord Netflix Nintendo Switch PlayStation Xbox Pokemon Mario Zelda " +
          "Lego Disney Pixar Marvel Google Apple iPhone Android Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February " +
          "March April June July August September October November December Christmas Halloween Easter Thanksgiving English Spanish French " +
          "German Japanese Chinese Italian Korean Russian Portuguese Europe Asia Africa America Australia Antarctica").split(" ")) add(w);
        try { for (const [country] of (P.skills.capitalsList || [])) add(country); } catch (e) { /* none */ }
        for (const w of ["us", "may", "march", "august", "turkey", "china", "chad", "guinea", "georgia", "jersey", "japan", "polish", "nice", "reading", "mobile", "sun"]) this._pn.delete(w);
      }
      return this._pn;
    }
    _restoreCase(s, raw) {
      const pn = this._properNouns();
      // names the user capitalized in the middle of a sentence ("my friend Jess"); a capital at the start of a
      // sentence ("Will anyone...", "Not sure") or on a common word is just typing, not a name
      const COMMON = /^(not|will|now|fine|wow|your|you|really|very|just|like|good|bad|great|yes|no|okay|ok|please|thanks|thank|sorry|maybe|never|always|well|oh|omg|lol|haha|all|any|every|today|tomorrow|yesterday|what|how|why|when|where|who|and|but|the|this|that|it|is|are|was|were|do|does|did|can|could|would|should|have|has|had|so|too|also|then|than|there|here|nice|cool|awesome|love|hate|sure|right|wrong|true|false|more|most|less|much|many|some|one|two|three|first|last|next|new|old|big|small|best|worst|hello|hi|hey|bye)$/i;
      const re = /(^|[.!?]\s+|\s)([A-Z][a-z]{2,})\b/g;
      let mm;
      while ((mm = re.exec(raw || ""))) {
        const w = mm[2], low = w.toLowerCase();
        const start = mm[1] === "" || /[.!?]/.test(mm[1]);
        if (COMMON.test(low) || (P.nlp.STOP && P.nlp.STOP.has(low))) continue;
        if (start && P.nlp.knownWord(low)) continue;
        pn.set(low, w);
      }
      return s.replace(/\b[a-z][a-z']+\b(?!:)/g, (w) => (pn.has(w) ? pn.get(w) : w));
    }
    _post(text) {
      if (!text) return text;
      const name = this.mem.name;
      let s = String(text);
      if (this.mem.plainStyle) s = s.replace(/\s*[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][\u200d\ufe0f\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}]*/gu, "").replace(/\s+([.!?,])/g, "$1").replace(/(^|\s)(Ooh|Yay|Aww|Woohoo|Hehe),?\s*/g, "$1").trim();
      // placeholders from the training data: <|you|> = the user, <|me|> = the bot
      s = s.replace(/<\|me\|>/g, this.botName);
      s = name ? s.replace(/<\|you\|>/g, name) : s.replace(/,?\s*<\|you\|>\s*([,.!?])?/g, (mm, p) => p || "").replace(/^\s*[,.]\s*/, "");
      s = s.replace(/\bi\b/g, "I").replace(/\bi'(m|ve|d|ll)\b/g, "I'$1").replace(/\bminecraft\b(?!:)/g, "Minecraft").replace(/\bpip\b/g, "Pip");
      s = s.replace(/(^|(?<!\.)[.!?]\s+)([a-z])/g, (mm, a, b) => a + b.toUpperCase());
      s = s.replace(/\s+([,.!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
      return s;
    }
  }

  P.Brain = Brain;
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
