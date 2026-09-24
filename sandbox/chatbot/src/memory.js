/* Pip: long-term memory about the user (like Replika's "memory" page).
   Facts are pulled out of what the user says with patterns, stored in a small profile, saved to
   localStorage (browser) or a JSON file (terminal), and used later: greetings by name, "how did your
   test go?", "what's my dog's name?", "what do you know about me?" */
(function (P) {
  "use strict";
  const U = P.util;

  function blank() {
    return {
      v: 1, name: null, age: null, ageAt: null, location: null, birthday: null, job: null, school: null,
      likes: [], dislikes: [], favorites: {}, pets: [], people: {}, notes: [], events: [], moods: [], threads: [],
      botName: "Pip", firstSeen: Date.now(), lastSeen: null, sessions: 0, messages: 0, facts: 0,
    };
  }

  // words that follow "I'm ..." but are not names
  const NOT_NAME = new Set(("tired fine good ok okay bored sad happy here back not a an the just so sorry busy sick ill " +
    "hungry thirsty sleepy home going gonna trying doing feeling done ready new old young alone lonely scared afraid " +
    "angry mad upset glad great awesome cool alright alive dead confused lost stuck serious kidding joking fat thin " +
    "tall short smart dumb stupid bad better worse well also only really very too still always never from in at on " +
    "with your you yours his her their our my me i it its this that what who why how when where there them they " +
    "he she we us one two three nothing something anything everything nobody somebody everyone human person boy " +
    "girl man woman kid child teen adult student gamer robot bot ai back right wrong sure certain nervous excited " +
    "stressed curious interested free available male female single married gay straight bi trans nonbinary called " +
    "named about like into over under out up down off almost pretty quite kind sort literally probably maybe perhaps " +
    "definitely totally actually honestly seriously basically listening waiting thinking talking playing working " +
    "studying reading watching eating sleeping chilling relaxing leaving joking asking telling saying hiding late " +
    "early on fire speechless dying crying laughing blessed grateful thankful sure positive okay hi hello hey yo sup hiya " +
    "howdy yes yeah yep yup nope nah no lol haha hehe hmm hm um uh why what how who idk nothing bye thanks thank sure maybe " +
    "please sorry wow cool nice good bad fine great test testing anonymous secret unknown whatever dunno later brb ty thx " +
    "pip bot chatbot guess none nobody hru wyd").split(" "));

  const PET = "dogs?|cats?|pupp(?:y|ies)|kittens?|kitt(?:y|ies)|hamsters?|rabbits?|bunn(?:y|ies)|fish|goldfish|parrots?|birds?|" +
    "turtles?|tortoises?|snakes?|lizards?|horses?|guinea pigs?|ferrets?|gerbils?|mice|mouse|rats?|chickens?|ducks?|geckos?|axolotls?|frogs?|pigs?|goats?|cows?|budgies?|cockatiels?";
  const PEOPLE = "mom|mum|mother|dad|father|sister|brother|best friend|friend|girlfriend|boyfriend|wife|husband|son|daughter|" +
    "grandma|grandmother|grandpa|grandfather|aunt|uncle|cousin|teacher|boss|crush|partner|roommate|neighbor|neighbour|stepmom|stepdad|baby brother|baby sister|little brother|little sister|big brother|big sister|twin";
  const JOBS = new Set(("student teacher programmer developer coder software engineer nurse doctor engineer artist designer " +
    "writer author gamer youtuber streamer chef cook baker driver scientist lawyer musician singer dancer actor actress " +
    "photographer mechanic electrician plumber carpenter farmer pilot soldier firefighter police officer cop cashier " +
    "waiter waitress bartender barista manager accountant consultant therapist psychologist dentist vet veterinarian " +
    "pharmacist architect researcher professor tutor librarian journalist editor translator salesman seller entrepreneur " +
    "freelancer intern mom dad parent homemaker retiree babysitter nanny caregiver lifeguard athlete footballer " +
    "programmer hacker modder builder redstoner animator illustrator composer producer dj").split(" "));
  const SLOTS = { color: "color", colour: "color", food: "food", meal: "food", dish: "food", snack: "snack", animal: "animal",
    pet: "animal", game: "game", "video game": "game", movie: "movie", film: "movie", show: "show", "tv show": "show",
    series: "show", song: "song", band: "band", singer: "singer", artist: "artist", musician: "artist", music: "music",
    genre: "music", book: "book", author: "author", sport: "sport", team: "team", subject: "subject", class: "subject",
    season: "season", number: "number", holiday: "holiday", drink: "drink", fruit: "fruit", candy: "candy", dessert: "dessert",
    youtuber: "youtuber", streamer: "youtuber", mob: "mob", block: "block", place: "place", city: "city", country: "country",
    flower: "flower", character: "character", anime: "anime", superhero: "superhero", hero: "superhero", day: "day",
    word: "word", emoji: "emoji", weather: "weather", car: "car", instrument: "instrument", pokemon: "pokemon",
    ice: "ice cream flavor", "ice cream": "ice cream flavor", "ice cream flavor": "ice cream flavor", thing: "thing", person: "person" };

  function cleanValue(v) {
    return v.replace(/\b(too|also|as well|lol|haha|though|tho|btw|now|right now|i guess|i think|very much|so much|a lot|lots|really|honestly)\b/g, "")
      .replace(/\s+(and|but|because|since|so|when|which|who|if)\b.*$/, "").replace(/[^a-z0-9' &+-]/gi, " ").replace(/\s+/g, " ").trim();
  }
  function properCase(s) { return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()); }
  // keyboard mashes ("asdfghjkl") and consonant soup are not names
  function plausibleName(low) {
    if (!/[aeiouy]/.test(low)) return false;
    if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(low)) return false;
    if (/(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm)/.test(low)) return false;
    if (/(.)\1\1/.test(low)) return false;
    return true;
  }
  function looksLikeName(w, rawText, expecting) {
    if (!w || w.length < 2 || w.length > 20 || /\d/.test(w)) return false;
    const low = w.toLowerCase();
    if (NOT_NAME.has(low) || P.nlp.STOP.has(low) || !plausibleName(low)) return false;
    if (expecting) return true;
    // the user capitalized it, or it's not a common English word
    const cap = new RegExp("\\b" + w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() + "\\b").test(rawText);
    return cap || !P.nlp.knownWord(low);
  }
  function addUnique(list, v, max) {
    const i = list.findIndex((x) => x.toLowerCase() === v.toLowerCase());
    if (i >= 0) list.splice(i, 1);
    list.push(v);
    if (list.length > (max || 40)) list.shift();
  }

  // ---------- extraction ----------
  // Returns [{type, value, ...}] and updates `mem`. `m` is an analyzed message; `expect` is what Pip just asked.
  function extract(mem, m, expect) {
    const facts = [];
    const t = " " + m.plain + " ";
    const raw = m.clean;
    let r;

    // name
    const expectingName = expect && expect.kind === "name";
    if ((r = /\b(?:my name is|my names|my name s|name is|i am called|call me|you can call me|people call me|everyone calls me|i go by)\s+([a-z][a-z'-]*)(?:\s+([a-z][a-z'-]*))?/.exec(t)) &&
      !/\b(do not|don't|never|dont) call me\b/.test(t) && !/\bcall me (later|back|tomorrow|when|if|a|an|the|maybe|sometime)\b/.test(t)) {
      if (looksLikeName(r[1], raw, true) && r[1] !== "not") facts.push({ type: "name", value: properCase(r[1]) });
    } else if ((r = /^\s*(?:i am|im|it is|its|this is|hi i am|hello i am|hey i am|hi im|hey im|hello im)\s+([a-z][a-z'-]*)\s*[.!]?\s*$/.exec(m.plain)) && looksLikeName(r[1], raw, expectingName)) {
      facts.push({ type: "name", value: properCase(r[1]) });
    } else if ((r = /\b(?:hi|hello|hey),?\s+(?:i am|im)\s+([a-z][a-z'-]*)\b/.exec(t)) && looksLikeName(r[1], raw, expectingName)) {
      facts.push({ type: "name", value: properCase(r[1]) });
    } else if (expectingName && m.tokens.length <= 3) {
      const w = m.tokens.filter((x) => !/^(it|is|its|i|am|im|my|name|just|call|me|you|can|the)$/.test(x));
      const cand = raw.replace(/[^A-Za-z' -]/g, " ").trim().split(/\s+/).filter((x) => w.includes(x.toLowerCase()));
      // a lone word is taken as a name; inside a longer reply it must look like one (capitalized or not a common word)
      if (cand.length === 1 && looksLikeName(cand[0], raw, m.tokens.length === 1 && !/\b(not|cannot|no|never)\b/.test(m.plain))) facts.push({ type: "name", value: properCase(cand[0].toLowerCase()) });
    }

    // age
    if ((r = /\bi am (\d{1,3})(?: years? old| yrs? old| yo| y\/o)?\s*(?:$|[.!,]| and| but| now| today| lol)/.exec(t)) || (r = /\bi am (\d{1,3}) years? old\b/.exec(t)) ||
      (r = /\bmy age is (\d{1,3})\b/.exec(t)) || (r = /\bi (?:just )?turned (\d{1,3})\b/.exec(t)) || (expect && expect.kind === "age" && (r = /^\s*(?:i am |im )?(\d{1,3})\b/.exec(m.plain)))) {
      const a = parseInt(r[1], 10);
      if (a >= 3 && a <= 120) facts.push({ type: "age", value: a });
    }

    // where they live
    if ((r = /\bi (?:live|am living|stay|reside) in ([a-z][a-z .'-]{1,40})/.exec(t)) || (r = /\bi am from ([a-z][a-z .'-]{1,40})/.exec(t)) || (r = /\bi come from ([a-z][a-z .'-]{1,40})/.exec(t))) {
      const v = cleanValue(r[1]).replace(/^(the )?(city|town|state|country|village) of /, "");
      if (v && v.split(" ").length <= 4 && !/^(a|an|the|my|this|that|here|there|home|house|space|minecraft|nowhere|somewhere|your|his|her)\b/.test(v)) facts.push({ type: "location", value: properCase(v) });
    }

    // birthday
    if ((r = /\bmy (?:birthday|bday|birth day) is (?:on )?(?:the )?([a-z]+ \d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?(?: of)? [a-z]+|today|tomorrow|next week|in \w+(?: \w+)?)/.exec(t))) {
      facts.push({ type: "birthday", value: r[1] === "today" ? "today" : properCase(r[1]).replace(/ Of /, " of ") });
    }

    // favorites: "my favorite color is blue", "blue is my favorite color"
    const wh = /^\s*(what|which|who|whats|how|where|when|why|do you|can you|guess)\b/.test(m.plain);
    if (wh) { /* a question about favorites, not a statement */ }
    else if ((r = /\bmy (?:favorite|fav|favourite|fave) ([a-z]+(?: [a-z]+)?) (?:is|are|would be|has to be|must be) ([^.!?,]{1,40})/.exec(t)) ||
      (r = /\b([a-z][a-z' -]{1,30}) (?:is|are) my (?:favorite|fav|favourite|fave) ([a-z]+(?: [a-z]+)?)\b/.exec(t)) && (r = [r[0], r[2], r[1]])) {
      const slot = SLOTS[r[1].trim()] || SLOTS[r[1].split(" ")[0]] || (r[1].split(" ").length === 1 ? r[1] : null);
      const val = cleanValue(r[2]).replace(/^(the|a|an) /, "");
      if (slot && val && val.split(" ").length <= 5 && !/^(it|that|this|you|yours|mine|same)$/.test(val)) facts.push({ type: "favorite", slot, value: val });
    } else if (expect && expect.kind === "favorite" && m.tokens.length <= 6 && !m.isQuestion &&
      !/^(hi|hey|hello|yo|ok|okay|lol|haha|thanks|thank you|bye|what|why|how|nothing|idk|dunno|no|yes|yeah|nope|sure|cool|nice|hmm|wow|same|good|great|oh|ah|um|uh|i do not|i don't|not really|never mind|nvm|stop|help)\b/.test(m.plain)) {
      const val = cleanValue(m.plain.replace(/^(i think |probably |hmm |um |uh |well |my favorite is |i like |i love |its |it is |i would say |definitely |maybe )+/, "")).replace(/^(the|a|an) /, "");
      const colorOk = expect.slot !== "color" || /\b(red|orange|yellow|green|blue|purple|violet|pink|black|white|gr[ae]y|brown|teal|cyan|turquoise|magenta|gold|golden|silver|beige|maroon|navy|lime|indigo|lavender|crimson|aqua|mint|peach|rainbow|lilac|coral|scarlet|emerald|sky|dark|light|pastel)\b/.test(val);
      const sentence = /\b(is|are|was|were|am|have|has|had|does|did|will|would|can|should|could|must|got|get|went|go)\b/.test(val) || /^(my|i|we|you|it|this|that|he|she|they|there)\b/.test(val);
      if (val && colorOk && !sentence && val.split(" ").length <= 4 && !/^(no|nothing|none|idk|i do not know|not sure|dunno|i dont know|what|why|you|yours|same|everything|all of them)$/.test(val)) facts.push({ type: "favorite", slot: expect.slot, value: val });
    }

    // likes / dislikes (not "I like you", which is about Pip)
    if ((r = /\bi (?:really |absolutely |totally |also |just |kinda |kind of |sort of |truly )?(?:like|love|enjoy|adore|am into|am obsessed with|am a fan of|am a big fan of) ([a-z0-9][^.!?,]{1,40})/.exec(t))) {
      let v = cleanValue(r[1]);
      if (/^to /.test(v)) v = v.replace(/^to /, "").replace(/^(\w+?)(e?)\b/, (w) => w) ;
      const pm = new RegExp("^my (?:little |baby |pet |new |cute )?(" + PET + ")$").exec(v);
      if (pm) facts.push({ type: "pet", kind: singularPet(pm[1]), name: null });
      else if (/^my /.test(v)) { /* "I love my mom": warm, but not a hobby */ }
      else if (v && !/^(you|u|it|that|this|them|him|her|talking to you|chatting with you|you too|your|when you|how you|the way you|what you|pip)\b/.test(v) && v.split(" ").length <= 6 && !/^(to )?(be|have|know|ask|say|tell|see|go|get|think)\b/.test(v)) {
        facts.push({ type: "like", value: v });
      }
    }
    if ((r = /\bi (?:really |absolutely |totally |just )?(?:do not like|hate|dislike|can not stand|cannot stand|despise|am not a fan of|do not enjoy|do not love) ([a-z0-9][^.!?,]{1,40})/.exec(t))) {
      const v = cleanValue(r[1]);
      if (v && !/^(you|u|it|that|this|them|him|her|myself|me|my life|everything|everyone|when|how|being)\b/.test(v) && v.split(" ").length <= 6) facts.push({ type: "dislike", value: v });
    }

    // pets
    if ((r = new RegExp("\\bi (?:have|got|own|just got|adopted) (?:a|an|one|two|three|four|five|\\d+|some|a new|a little|a baby|a pet)? ?(?:little |baby |pet |new |cute |big |small |black |white |brown |orange |grey |gray )?(" + PET + ")\\b(?:,? (?:named|called|whose name is|his name is|her name is) ([a-z]+))?").exec(t))) {
      facts.push({ type: "pet", kind: singularPet(r[1]), name: r[2] && looksLikeName(r[2], raw, true) ? properCase(r[2]) : null });
    }
    if ((r = new RegExp("\\bmy (" + PET + ")(?:'s| s|s)? (?:name is|is named|is called|named|called) ([a-z]+)").exec(t))) {
      if (looksLikeName(r[2], raw, true)) facts.push({ type: "pet", kind: singularPet(r[1]), name: properCase(r[2]) });
    }

    // people in their life
    if ((r = new RegExp("\\bmy (" + PEOPLE + ")(?:'s| s)? (?:name is|is named|is called|named|called) ([a-z]+)").exec(t))) {
      if (looksLikeName(r[2], raw, true)) facts.push({ type: "person", rel: r[1], name: properCase(r[2]) });
    }

    // job / school
    if ((r = /\bi (?:am|work as) (?:a|an) ([a-z]+(?: [a-z]+)?)\b/.exec(t))) {
      const words = r[1].split(" ");
      const job = JOBS.has(r[1]) ? r[1] : JOBS.has(words[0]) ? words[0] : JOBS.has(words[words.length - 1]) ? r[1] : null;
      if (job) facts.push({ type: "job", value: job });
    }
    if ((r = /\bi am in (\d{1,2})(?:st|nd|rd|th)? grade\b/.exec(t)) || (r = /\bi am in (year \d{1,2}|high school|middle school|elementary school|primary school|college|university|uni|kindergarten)\b/.exec(t)) || (r = /\bi (?:go to|attend) (high school|middle school|elementary school|college|university|uni|school)\b/.exec(t))) {
      facts.push({ type: "school", value: /^\d+$/.test(r[1]) ? r[1] + ordinal(r[1]) + " grade" : r[1] });
    }

    // upcoming events worth asking about later
    if ((r = /\bi (?:have|got|have got|will have|am having) (?:a|an|my|the|this|that|some|another|a big|a huge|an important)? ?(big |huge |important |final |math |science |english |history |spanish |french |job |driving |piano |dance |soccer |football |basketball )?(test|exam|exams|quiz|interview|game|match|recital|appointment|date|presentation|party|trip|surgery|operation|competition|tournament|concert|audition|meeting|job interview|driving test|dentist appointment|doctor appointment|finals|midterm|midterms|essay|project|race|performance|show)\b(?:.*?\b(tomorrow|today|tonight|next week|this week|this weekend|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|later|soon|in \w+ days?))?/.exec(t))) {
      facts.push({ type: "event", what: ((r[1] || "") + r[2]).trim(), when: r[3] || "soon" });
    }

    // explicit "remember that ..."
    if ((r = /\b(?:remember|do not forget|never forget|please remember|pls remember|make a note|note) (?:that |this: |this |:)?(.{3,90})$/.exec(m.plain)) && !/^(me|my name|what|when|how|who|that time|the time)\b/.test(r[1])) {
      facts.push({ type: "note", value: r[1].replace(/\bmy\b/g, "your").replace(/\bi am\b/g, "you are").replace(/\bi\b/g, "you").replace(/\bme\b/g, "you") });
    }

    for (const f of facts) apply(mem, f);
    return facts;
  }
  // things worth asking about next time: "my brother is annoying", "my team won", "my cat is sick"
  const THREAD_WHO = new RegExp("\\bmy (" + PEOPLE + "|" + PET + "|team|class|school|job|teacher|project|band|game|garden|car|phone|computer|room)\\b");
  function noteThread(mem, m) {
    const r = THREAD_WHO.exec(m.plain);
    if (!r || m.isQuestion) return null;
    const v = m.emotion.valence;
    const eventful = /\b(annoying|mean|fight|fought|argue|argued|yelled|sick|hurt|broke|broken|lost|won|win|moved|moving|leaving|left|cheated|ignores?|ignored|bully|bullies|sad|angry|mad|happy|proud|passed|failed|died|sick|surgery|hospital|new)\b/.test(m.plain);
    if (Math.abs(v) < 0.5 && !eventful) return null;
    const who = singularPet(r[1]);
    const th = (mem.threads = mem.threads || []);
    const i = th.findIndex((x) => x.who === who);
    if (i >= 0) th.splice(i, 1);
    th.push({ who, text: m.clean.slice(0, 90), valence: v, at: Date.now(), asked: false });
    if (th.length > 12) th.shift();
    return who;
  }

  function ordinal(n) { n = +n; return n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"; }
  function singularPet(p) { return p.replace(/ies$/, "y").replace(/(dog|cat|kitten|hamster|rabbit|parrot|bird|turtle|tortoise|snake|lizard|horse|guinea pig|ferret|gerbil|rat|chicken|duck|gecko|axolotl|frog|pig|goat|cow|budgie|cockatiel)s$/, "$1").replace(/^mice$/, "mouse").replace(/^puppy$/, "puppy"); }

  function apply(mem, f) {
    mem.facts++;
    switch (f.type) {
      case "name": f.prev = mem.name; mem.name = f.value; break;
      case "age": mem.age = f.value; mem.ageAt = Date.now(); break;
      case "location": mem.location = f.value; break;
      case "birthday": mem.birthday = f.value; break;
      case "favorite": mem.favorites[f.slot] = f.value; break;
      case "like": addUnique(mem.likes, f.value); mem.dislikes = mem.dislikes.filter((x) => x.toLowerCase() !== f.value.toLowerCase()); break;
      case "dislike": addUnique(mem.dislikes, f.value); mem.likes = mem.likes.filter((x) => x.toLowerCase() !== f.value.toLowerCase()); break;
      case "pet": {
        const ex = mem.pets.find((p) => p.kind === f.kind && (!p.name || !f.name || p.name === f.name));
        if (ex) { if (f.name) ex.name = f.name; } else mem.pets.push({ kind: f.kind, name: f.name });
        break;
      }
      case "person": mem.people[f.rel] = f.name; break;
      case "job": mem.job = f.value; break;
      case "school": mem.school = f.value; break;
      case "event": mem.events.push({ what: f.what, when: f.when, at: Date.now(), asked: false }); if (mem.events.length > 10) mem.events.shift(); break;
      case "note": addUnique(mem.notes, f.value, 30); break;
    }
  }

  // ---------- recall ----------
  function petText(p) { return p.name ? `your ${p.kind} ${p.name}` : `your ${p.kind}`; }

  function summary(mem) {
    const parts = [];
    if (mem.name) parts.push(`your name is ${mem.name}`);
    if (mem.age) parts.push(`you're ${currentAge(mem)}`);
    if (mem.location) parts.push(`you live in ${mem.location}`);
    if (mem.job) parts.push(`you're ${U.aOrAn(mem.job)} ${mem.job}`);
    if (mem.school) parts.push(`you're in ${mem.school}`);
    if (mem.birthday) parts.push(`your birthday is ${mem.birthday}`);
    if (mem.pets.length) parts.push(`you have ${U.listJoin(mem.pets.map((p) => (p.name ? `a ${p.kind} named ${p.name}` : `a ${p.kind}`)))}`);
    const favs = Object.entries(mem.favorites).slice(-4).map(([k, v]) => `your favorite ${k} is ${v}`);
    parts.push(...favs);
    if (mem.likes.length) parts.push(`you like ${U.listJoin(mem.likes.slice(-4))}`);
    if (mem.dislikes.length) parts.push(`you're not a fan of ${U.listJoin(mem.dislikes.slice(-3))}`);
    const ppl = Object.entries(mem.people).slice(-3).map(([k, v]) => `your ${k} is ${v}`);
    parts.push(...ppl);
    const ev = mem.events.filter((e) => Date.now() - e.at < 14 * 864e5).slice(-2);
    if (ev.length) parts.push(`you have ${U.listJoin(ev.map((e) => U.aOrAn(e.what) + " " + e.what + (e.when && e.when !== "soon" && Date.now() - e.at < 20 * 3600e3 ? " " + e.when : "")))} coming up`);
    if (mem.notes.length) parts.push(`you asked me to remember that ${mem.notes[mem.notes.length - 1]}`);
    return parts;
  }
  function currentAge(mem) {
    if (!mem.age) return null;
    const years = Math.floor((Date.now() - (mem.ageAt || Date.now())) / (365.25 * 864e5));
    return mem.age + years;
  }

  // Answer questions about the user. Returns {text, expect?} or null.
  function recall(mem, m) {
    const t = " " + m.plain.replace(/[?!.]/g, "") + " ";
    let r;
    const ask = /\b(what|whats|what is|do you know|do you remember|remember|tell me|who|where|when|how old|which)\b/.test(t);
    if (!ask && !/\?/.test(m.clean)) return null;

    if (/\b(what is|whats|do you (?:know|remember)|tell me|say|guess) my name\b|\bwho am i\b|\bdo you know who i am\b|\bremember me\b|\bdo you (still )?(know|remember) me\b|\byou (know|remember) me\b/.test(t)) {
      if (mem.name) return { text: U.pick([`You're ${mem.name}! How could I forget? 😊`, `Your name is ${mem.name}.`, `${mem.name}, of course!`]) };
      return { text: "You haven't told me your name yet! What should I call you?", expect: { kind: "name" } };
    }
    if (/\bhow old am i\b|\bwhat is my age\b|\bdo you (?:know|remember) (?:my age|how old i am)\b/.test(t)) {
      return mem.age ? { text: `You told me you're ${currentAge(mem)}.` } : { text: "I don't know yet! How old are you?", expect: { kind: "age" } };
    }
    if (/\bwhere (?:do i live|am i from|i live)\b|\bwhat is my (?:city|country|hometown|location)\b/.test(t)) {
      return mem.location ? { text: `You told me you live in ${mem.location}.` } : { text: "You haven't told me where you live. Where are you from?" };
    }
    if (/\bwhen is my (?:birthday|bday)\b|\bdo you (?:know|remember) my birthday\b/.test(t)) {
      return mem.birthday ? { text: `Your birthday is ${mem.birthday}! 🎂` } : { text: "I don't know your birthday yet! When is it?" };
    }
    if ((r = /\bwhat is my (?:favorite|fav|favourite|fave) ([a-z]+(?: [a-z]+)?)\b/.exec(t)) || (r = /\bdo you (?:know|remember) my (?:favorite|fav|favourite|fave) ([a-z]+(?: [a-z]+)?)\b/.exec(t))) {
      const slot = SLOTS[r[1]] || SLOTS[r[1].split(" ")[0]] || r[1];
      if (mem.favorites[slot]) return { text: `Your favorite ${slot} is ${mem.favorites[slot]}!` };
      return { text: `Hmm, you haven't told me your favorite ${slot}. What is it?`, expect: { kind: "favorite", slot } };
    }
    if ((r = new RegExp("\\b(?:what is|whats|do you (?:know|remember)|what was) (?:the name of )?my (" + PET + ")(?:'s| s|s)?(?: name)?\\b").exec(t))) {
      const kind = singularPet(r[1]);
      const p = mem.pets.find((x) => x.kind === kind);
      if (p && p.name) return { text: `Your ${kind}'s name is ${p.name}! 🐾` };
      if (p) return { text: `You told me you have ${U.aOrAn(kind)} ${kind}, but not its name. What's it called?`, expect: { kind: "petname", pet: kind } };
      return { text: `You haven't told me about ${U.aOrAn(kind)} ${kind} yet! Do you have one?` };
    }
    if ((r = new RegExp("\\b(?:what is|whats|do you (?:know|remember)) my (" + PEOPLE + ")(?:'s| s)? name\\b").exec(t))) {
      const n = mem.people[r[1]];
      return n ? { text: `Your ${r[1]}'s name is ${n}.` } : { text: `You haven't told me your ${r[1]}'s name yet.` };
    }
    if (/\bwhat do i (?:like|love|enjoy)\b|\bwhat are my (?:hobbies|interests)\b|\bwhat things do i like\b/.test(t)) {
      if (mem.likes.length) return { text: `You told me you like ${U.listJoin(mem.likes.slice(-6))}.` };
      return { text: "You haven't told me much about what you like yet. What are you into?" };
    }
    if (/\bwhat do i (?:hate|dislike|not like)\b/.test(t)) {
      return mem.dislikes.length ? { text: `You're not a fan of ${U.listJoin(mem.dislikes.slice(-5))}.` } : { text: "I don't think you've told me anything you dislike!" };
    }
    if (/\bwhat (?:is|was) my job\b|\bwhat do i do for (?:a living|work)\b/.test(t)) {
      return mem.job ? { text: `You're ${U.aOrAn(mem.job)} ${mem.job}!` } : { text: "You haven't told me what you do. Do you work or go to school?" };
    }
    if (/\bwhat do you (?:know|remember) about me\b|\btell me (?:what you know )?about (?:me|myself)\b|\bwhat have i told you\b|\bdo you remember (?:anything|stuff|things) about me\b|\bwhat do you know of me\b/.test(t)) {
      const s = summary(mem);
      if (!s.length) return { text: "Not much yet! Tell me about yourself: what's your name, and what do you like to do?" };
      return { text: `Here's what I remember: ${U.listJoin(s.slice(0, 9))}. ${U.pick(["Did I get it right?", "I pay attention! 😊", "Anything I should add?"])}` };
    }
    if (/\b(what|where|when|who|how|which) (did|do|was|were|am|have|had) i (have|eat|do|go|see|say|buy|get|watch|play|wear|meet|call)\b/.test(t) && !/\bwhat did i (just )?say\b/.test(t)) {
      return { text: U.pick(["Hmm, I don't know! You haven't told me. 😄 What was it?", "You'd have to tell me! I only know what you share with me. What was it?"]) };
    }
    if ((r = /\bdo you remember (?:that |when |what |how |my |about )?(.{2,40})$/.exec(m.plain.replace(/[?!.]/g, "")))) {
      const q = r[1].replace(/\bmy\b/g, "").trim();
      const all = mem.notes.concat(mem.likes, Object.values(mem.favorites), mem.pets.map((p) => p.kind + " " + (p.name || "")), mem.events.map((e) => e.what));
      const hit = all.find((x) => q.split(" ").some((w) => w.length > 3 && x.toLowerCase().includes(w)));
      if (hit) return { text: `Yes! I remember: ${hit}.` };
      return null;
    }
    return null;
  }

  // "forget ..." commands
  function forget(mem, m) {
    const t = m.plain;
    if (/\b(forget|delete|erase|wipe|clear) (everything|all|all about me|all of it|my data|your memory|everything about me|me)\b/.test(t)) return { all: true };
    let r;
    if ((r = /\bforget (?:my|that i|about my) (name|age|birthday|location|job|school|pets?|likes|favorites)\b/.exec(t))) {
      const k = r[1];
      if (k === "name") mem.name = null; else if (k === "age") mem.age = null; else if (k === "birthday") mem.birthday = null;
      else if (k === "location") mem.location = null; else if (k === "job") mem.job = null; else if (k === "school") mem.school = null;
      else if (/^pet/.test(k)) mem.pets = []; else if (k === "likes") mem.likes = []; else if (k === "favorites") mem.favorites = {};
      return { what: k };
    }
    return null;
  }

  // Something from memory worth bringing up when the user comes back (Replika-style follow-ups)
  function followUp(mem) {
    const ev = mem.events.find((e) => !e.asked && Date.now() - e.at > 3 * 3600e3 && Date.now() - e.at < 14 * 864e5);
    if (ev) { ev.asked = true; return `Last time you mentioned your ${ev.what}${ev.when && ev.when !== "soon" ? " (" + ev.when + ")" : ""}. How did it go?`; }
    const mood = mem.moods[mem.moods.length - 1];
    if (mood && /sad|lonely|anxious|angry|sick|tired/.test(mood.label) && Date.now() - mood.at > 3 * 3600e3 && Date.now() - mood.at < 7 * 864e5 && !mood.asked) {
      mood.asked = true;
      return { sad: "Last time you were feeling down. Are you doing any better today?", lonely: "Last time you felt a bit lonely. How are you feeling today?",
        anxious: "Last time you were stressed. Did things calm down?", angry: "Last time something made you really angry. Is it any better now?",
        sick: "Last time you weren't feeling well. Are you feeling better?", tired: "Last time you were really tired. Did you get some rest?" }[mood.label];
    }
    const th = (mem.threads || []).slice().reverse().find((x) => !x.asked && Date.now() - x.at > 3 * 3600e3 && Date.now() - x.at < 10 * 864e5);
    if (th) {
      th.asked = true;
      return th.valence < 0 ? `Last time you told me about your ${th.who}, and it sounded tough. How are things now?` : `Last time you told me about your ${th.who}! Any news?`;
    }
    if (mem.pets.length && U.chance(0.3)) { const p = U.pick(mem.pets); return `How's ${petText(p)} doing?`; }
    return null;
  }

  // ---------- persistence ----------
  const KEY = "pip.memory.v1";
  function load(storage) {
    try {
      const s = storage ? storage.getItem(KEY) : null;
      if (s) return Object.assign(blank(), JSON.parse(s));
    } catch (e) { /* private mode or blocked storage: start fresh */ }
    return blank();
  }
  function save(mem, storage) {
    try { if (storage) storage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ }
  }

  P.memory = { noteThread, blank, extract, apply, recall, forget, followUp, summary, load, save, looksLikeName, currentAge, petText, SLOTS };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
