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
      likes: [], dislikes: [], favorites: {}, pets: [], people: {}, notes: [], events: [], moods: [], threads: [], diary: [], topics: [],
      botName: "Pip", firstSeen: Date.now(), lastSeen: null, sessions: 0, messages: 0, facts: 0,
    };
  }

  // words that follow "I'm ..." but are not names
  const NOT_NAME = new Set(("monday tuesday wednesday thursday friday saturday sunday weekend today tomorrow tonight yesterday " +
    "january february march april june july august september october november december christmas halloween easter thanksgiving " +
    "red orange yellow green blue purple pink black white grey gray brown teal gold silver rainbow " +
    "minecraft fortnite roblox school homework recess lunch dinner breakfast bedtime " +
    "tired fine good ok okay bored sad happy here back not a an the just so sorry busy sick ill " +
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
    "pip bot chatbot guess none nobody hru wyd polish english american british french german spanish italian chinese japanese korean " +
    "indian mexican canadian australian russian ukrainian dutch swedish irish scottish welsh brazilian portuguese turkish greek arab african " +
    "asian european latino latina jewish muslim christian catholic hindu buddhist atheist gay straight bi lesbian trans nonbinary vegan " +
    "vegetarian now later soon here there done back ready fine hungry thirsty").split(" "));

  const PET = "dogs?|cats?|pupp(?:y|ies)|kittens?|kitt(?:y|ies)|hamsters?|rabbits?|bunn(?:y|ies)|fish|goldfish|parrots?|birds?|" +
    "turtles?|tortoises?|snakes?|lizards?|horses?|guinea pigs?|ferrets?|gerbils?|mice|mouse|rats?|chickens?|ducks?|geckos?|axolotls?|frogs?|pigs?|goats?|cows?|budgies?|cockatiels?";
  const PEOPLE = "mom|mum|mother|dad|father|sister|brother|best friend|friend|girlfriend|boyfriend|wife|husband|son|daughter|" +
    "grandma|grandmother|grandpa|grandfather|grandson|granddaughter|grandchild|niece|nephew|godson|goddaughter|stepson|stepdaughter|aunt|uncle|cousin|teacher|boss|crush|partner|roommate|neighbor|neighbour|stepmom|stepdad|baby brother|baby sister|little brother|little sister|big brother|big sister|twin";
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
    v = v.replace(/\s+\b(what|wdym|bye|lol|lmao|haha|btw|anyway|idk|ok|okay|you know|right|also|but|because|cause|cuz|so|when|which|who|if|and then)\b.*$/, "");
    return v.replace(/\b(too|also|as well|lol|lmao|haha|though|tho|btw|now|right now|rn|atm|lately|these days|ngl|tbh|i guess|i think|very much|so much|a lot|lots|really|honestly|more|better|the most|best|the best|instead|at all)\b/g, "")
      .replace(/\s+(and|but|because|since|so|when|which|who|if)\b.*$/, "").replace(/[^a-z0-9' &+-]/gi, " ").replace(/\s+/g, " ").trim();
  }
  const ADVERB = /^(just|also|really|always|never|finally|still|recently|actually|literally|totally|usually|sometimes|probably|even|only|already|kinda|basically|and|who|was|is|got|has|had|said|says|lives|moved|went|keeps|told|made|thinks|wants|needs|likes|loves|hates|left|came|called|texted|did|does|can|could|will|would|from|at|in|again|too|now|then|once|today|yesterday|tomorrow|last|every|all|both|who|which|that)$/;
  // common first names that are also in the word list (so "my friend jess moved" still counts)
  const NAMEISH = /^(jess|jessie|max|sam|alex|ben|jack|tom|will|bill|rose|lily|daisy|grace|hope|faith|joy|ruby|amber|jade|pearl|april|may|june|summer|autumn|dawn|holly|ivy|violet|jasmine|olive|poppy|sky|river|rain|storm|hunter|chase|mason|carter|cooper|taylor|jordan|morgan|casey|charlie|frank|mark|matt|nick|pat|rob|ray|joe|jim|dan|ken|kim|lee|ann|anna|mia|leo|eli|ava|zoe|noah|liam|emma|olivia|sophia|isabella|ella|chloe|lucy|sophie|ellie|jake|josh|ryan|tyler|ethan|logan|owen|luke|adam|evan|dylan|aaron|kyle|nathan|sean|shawn|tony|andy|jay|kay|bella|luna|stella|nova|penny|molly|sadie|maggie|bailey|buddy|rocky|duke|bear|cooper|milo|oscar|toby|jasper|finn|ollie|teddy|george|harry|henry|jacob|james|john|michael|david|chris|mike|sarah|emily|hannah|ashley|megan|rachel|laura|amy|beth|katie|kate|jen|jenny|becky|abby|abbie|maya|mila|nora|leah|julia|diana|victoria|sofia|lena|nina|tina|lisa|sara|maria|elena|carlos|juan|jose|luis|diego|pedro|miguel)$/;
  // pet names that are also normal words
  const PETNAMEISH = /^(biscuit|cookie|peanut|mochi|oreo|pepper|coco|cocoa|ginger|honey|muffin|nugget|pickles|pumpkin|shadow|smokey|snowball|sugar|waffles|bean|buttons|cupcake|marshmallow|noodle|potato|tofu|sushi|taco|toast|milo|luna|bella|daisy|lucky|rocky|buddy|bear|tiger|socks|boots|patch|spot|rex|fluffy|fuzzy|oscar|simba|nala|kiwi|mango|olive|pebble|pebbles|rusty|sandy|scout|shadow|sunny|ziggy|zeus|thor|loki|chewie|yoda|bubbles|nemo|dory|goldie|speedy|squeaky|hammy|peaches|cinnamon|nutmeg|biscuits)$/;
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
    if ((r = /\b(?:my name is|my names|my name s|(?<!\b(?:his|her|its|their|the|your|ur|\w+'s|\w+s) )name is|i am called|call me|you can call me|people call me|everyone calls me|i go by)\s+([a-z][a-z'-]*)(?:\s+([a-z][a-z'-]*))?/.exec(t)) && !/\b\w+'?s name is\b/.test(t.replace(/\bmy name is\b/g, "")) &&
      !/\b(do not|don't|never|dont) call me\b/.test(t) && !/\bcall me (later|back|tomorrow|when|if|a|an|the|maybe|sometime)\b/.test(t)) {
      if (looksLikeName(r[1], raw, true) && r[1] !== "not") facts.push({ type: "name", value: properCase(r[1]) });
    } else if ((r = /^\s*(?:i am|im|it is|its|this is|hi i am|hello i am|hey i am|hi im|hey im|hello im)\s+([a-z][a-z'-]*)\s*[.!]?\s*$/.exec(m.plain)) && looksLikeName(r[1], raw, expectingName)) {
      facts.push({ type: "name", value: properCase(r[1]) });
    } else if ((r = /\b(?:hi+|hello+|hey+|heyy+|hii+|yo)[!,.]*\s+(?:i am|im)\s+([a-z][a-z'-]*)\b/.exec(t)) && looksLikeName(r[1], raw, true) && !NOT_NAME.has(r[1])) {
      facts.push({ type: "name", value: properCase(r[1]) });
    } else if ((r = /^\s*(?:no+|nope|noo+)[!,. ]+(?:i am|im|my name is|it is|its)\s+([a-z][a-z'-]*)\b/.exec(t)) && looksLikeName(r[1], raw, true) && !NOT_NAME.has(r[1])) {
      facts.push({ type: "name", value: properCase(r[1]) });   // "NOOO im lily!! peanut is my HAMSTER"
    } else if ((expectingName || /^\s*(yo|hey|hi|hello|sup)\b/.test(t)) && (r = /\b(?:it is|its|i am|im|call me)\s+([a-z][a-z'-]*)(?:\s*,?\s*(\d{1,2}))?\s*[.!]*$/.exec(t)) && looksLikeName(r[1], raw, true) && !NOT_NAME.has(r[1])) {
      facts.push({ type: "name", value: properCase(r[1]) });   // "i did tho 🙄 its LILY", "yo its tyler, 13"
      if (r[2]) facts.push({ type: "age", value: +r[2] });
    } else if ((r = /\b(?:hi|hello|hey),?\s+(?:i am|im)\s+([a-z][a-z'-]*)\b/.exec(t)) && looksLikeName(r[1], raw, expectingName)) {
      facts.push({ type: "name", value: properCase(r[1]) });
    } else if ((r = /(?:^|[.!?]\s+)(?:i'?m|i am|im|my name is|it'?s|this is)\s+([A-Za-z][a-z'-]{1,20})\s*[.!]+(?=\s|$)/i.exec(raw)) && looksLikeName(r[1], raw, true) && !NOT_NAME.has(r[1].toLowerCase()) && !JOBS.has(r[1].toLowerCase()) &&
        (!/^(it'?s|this is)$/i.test(/(?:i'?m|i am|im|my name is|it'?s|this is)(?=\s+[A-Za-z])/i.exec(r[0])[0]) || expectingName || /\bname\b/.test(t) || (mem.name && mem.name.toLowerCase() === r[1].toLowerCase()))) {
      facts.push({ type: "name", value: properCase(r[1].toLowerCase()) });   // "Good afternoon, Pip. I'm Margaret. I used to be a teacher."
    } else if ((r = /^\s*(?:(?:hi|hey|hello|yo|ok|so)\s+)?([a-z][a-z'-]{1,20}) here\b/.exec(m.plain)) && !/^(its|it|me|im|i|we|you|nobody|someone|everyone|not)$/.test(r[1]) && looksLikeName(r[1], raw, false)) {
      facts.push({ type: "name", value: properCase(r[1]) });   // "Dan here. I'm 34..."
    } else if ((r = /\bmy name\b.*?\b(?:it'?s|its|it is)\s+([a-z][a-z'-]*)\b/.exec(t)) && looksLikeName(r[1], raw, true)) {
      facts.push({ type: "name", value: properCase(r[1]) });   // "I just told you my name. It's Dan."
    } else if (expectingName && /^\s*([A-Za-z][a-z'-]{1,20})\s*[.!,]\s+\S/.test(raw) && looksLikeName(/^\s*([A-Za-z][a-z'-]{1,20})/.exec(raw)[1], raw, true) && !/^\s*(no|nope|yes|yeah|ok|okay|hi|hey|hello|why|what|sure|well|um|uh|hmm|lol|guess)\b/i.test(raw)) {
      facts.push({ type: "name", value: properCase(/^\s*([A-Za-z][a-z'-]{1,20})/.exec(raw)[1].toLowerCase()) });   // "Dan. Let's see what you can do."
    } else if (expectingName && m.tokens.length <= 3) {
      const w = m.tokens.filter((x) => !/^(it|is|its|i|am|im|my|name|just|call|me|you|can|the)$/.test(x));
      const cand = raw.replace(/[^A-Za-z' -]/g, " ").trim().split(/\s+/).filter((x) => w.includes(x.toLowerCase()));
      // a lone word is taken as a name; inside a longer reply it must look like one (capitalized or not a common word)
      if (cand.length === 1 && looksLikeName(cand[0], raw, m.tokens.length === 1 && !/\b(not|cannot|no|never)\b/.test(m.plain))) facts.push({ type: "name", value: properCase(cand[0].toLowerCase()) });
    }

    // "its LILY" / "lily 🌸" when Pip already knows they're Lily: a reminder, not a new name
    if (!facts.some((f) => f.type === "name") && mem.name) {
      const nm = mem.name.toLowerCase();
      if (m.plain.replace(/[^a-z ]/g, "").trim() === nm || new RegExp("\\b(?:it'?s|its|it is|i'?m|im|i am|me|call me)\\s+" + nm + "\\s*[.!]*$").test(m.plain.replace(/[?]+$/, ""))) facts.push({ type: "name", value: mem.name });
    }
    // "jayden im 10": a name right before the age
    if (!facts.some((f) => f.type === "name") && (r = /^\s*([a-z]{2,20})[\s,.!]*(?:im|i am|i'm)\s+(\d{1,2})\b/.exec(m.plain))) {
      const cand = r[1].replace(/(.)\1{2,}$/, "$1").replace(/(.)\1{2,}/g, "$1$1");
      if (!NOT_NAME.has(cand) && !P.nlp.STOP.has(cand) && plausibleName(cand) && looksLikeName(cand, raw, !P.nlp.knownWord(cand))) facts.push({ type: "name", value: properCase(cand) });
    }
    // age
    if ((r = /\bi am (\d{1,3})(?: years? old| yrs? old| yo| y\/o)?\s*(?:$|[.!,;]| and| but| now| today| lol| [a-z]+ [a-z]+)/.exec(t)) || (r = /\b(\d{1,2}) (?:years? old|yrs? old|yo)\b/.exec(t)) || (r = /\bi am (\d{1,3}) years? old\b/.exec(t)) ||
      (r = /\bmy age is (\d{1,3})\b/.exec(t)) || (r = /\bi (?:just )?turned (\d{1,3})\b/.exec(t)) || (expect && (expect.kind === "age" || (expect.q && /how old are you/i.test(expect.q))) && (r = /^\s*(?:i am |im )?(\d{1,3})\b/.exec(m.plain))) ||
      (mem._askedAge && (r = /^\s*(?:i am |im |i'm )?(\d{1,2})(?: years old| yo)?\s*[.!]*$/.exec(m.plain)))) {
      const a = parseInt(r[1], 10);
      if (a >= 3 && a <= 120) facts.push({ type: "age", value: a });
    }

    // where they live
    if ((r = /\b(?:i )?(?:live|am living|living|stay|reside|based) in ([a-z][a-z .'-]{1,40})/.exec(t)) || (r = /\bi am from ([a-z][a-z .'-]{1,40})/.exec(t)) || (r = /\bi come from ([a-z][a-z .'-]{1,40})/.exec(t))) {
      const v = cleanValue(r[1]).replace(/^(the )?(city|town|state|country|village) of /, "");
      if (v && v.split(" ").length <= 4 && !/^(a|an|the|my|this|that|here|there|home|house|space|minecraft|nowhere|somewhere|your|his|her)\b/.test(v)) facts.push({ type: "location", value: properCase(v) });
    }

    // birthday
    if ((r = /\bmy (?:birthday|bday|birth day) is (?:on )?(?:the )?([a-z]+ \d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?(?: of)? [a-z]+|today|tomorrow|next week|in \w+(?: \w+)?)/.exec(t))) {
      const MON = { january: 31, february: 29, march: 31, april: 30, may: 31, june: 30, july: 31, august: 31, september: 30, october: 31, november: 30, december: 31 };
      const md = /([a-z]+) (\d{1,2})|(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)/.exec(r[1]);
      const mon = md ? (md[1] || md[4]) : null, day = md ? +(md[2] || md[3]) : null;
      if (!(mon && MON[mon] && day > MON[mon])) facts.push({ type: "birthday", value: r[1] === "today" ? "today" : properCase(r[1]).replace(/ Of /, " of ") });
    }

    // favorites: "my favorite color is blue", "blue is my favorite color"
    const wh = /^\s*(what|which|who|whats|how|where|when|why|do you|can you|guess)\b/.test(m.plain);
    if (wh) { /* a question about favorites, not a statement */ }
    else if ((r = /\bmy (?:favorite|fav|favourite|fave) ([a-z]+(?: [a-z]+)?) (?:is|are|would be|has to be|must be) ([^.!?,]{1,40})/.exec(t)) ||
      (r = /\b([a-z][a-z' -]{1,30}) (?:is|are) my (?:favorite|fav|favourite|fave) ([a-z]+(?: [a-z]+)?)\b/.exec(t)) && (r = [r[0], r[2], r[1]])) {
      const slot = SLOTS[r[1].trim()] || SLOTS[r[1].split(" ")[0]] || (r[1].split(" ").length === 1 ? r[1] : null);
      const first = r[0].startsWith("my ") || /\bmy (?:favorite|fav|favourite|fave) [a-z]+(?: [a-z]+)? (?:is|are)/.test(r[0]);
      let val = cleanValue(first ? r[2].split(/\b(?:but|because|cuz|cause|coz|bc|since|though|although|so|i was|i am|we|you)\b/)[0] : r[2].replace(/^.*\b(cuz|because|cause|since|and|but|so|coz|bc)\s+/, "")).replace(/^(a good|a nice|a really good|a proper|really good|the|a|an) /, "").replace(/^(good|nice|great|proper) (?=\w+ \w+)/, "");
      if (slot === "color") { const cm = /\b(?:(?:dark|light|pastel|sky|navy|neon|bright|baby|lime|forest|hot|mint|royal) )?(red|orange|yellow|green|blue|purple|violet|pink|black|white|gr[ae]y|brown|teal|cyan|turquoise|magenta|gold|silver|lavender|lilac|rainbow|aqua|mint|maroon|indigo)\b/.exec(val); if (cm) val = cm[0]; }
      if (slot && val && val.split(" ").length <= 5 && !/^(it|that|this|you|yours|mine|same)$/.test(val) && !/\b(what|which|who|how|why|whats)\b/.test(val)) facts.push({ type: "favorite", slot, value: val });
    } else if (expect && expect.kind === "favorite") {
      // the answer to "what's your favorite X?": "green like a creeper. what's yours?", "i told you, it's green"
      const ans = m.plain.replace(/[.!?]+$/, "")
        .replace(/[,.!?]*\s*(?:and |so )?(?:what about you|how about you|and you|wbu|hbu|what is yours|what are yours|what about yours|and yours|yours|what is your favorite(?: \w+)?|what is yours then|u|you)\s*$/, "")
        .replace(/^(?:i (?:already )?told (?:you|u)(?: already)?|like i said|i said|i already said)(?: that| before)?[,.]?\s*/, "")
        .replace(/[.!?]+$/, "").trim();
      const COLOR = /\b(?:(?:dark|light|pastel|sky|navy|neon|bright|baby|lime|forest|hot|mint|royal|blood) )?(red|orange|yellow|green|blue|purple|violet|pink|black|white|gr[ae]y|brown|teal|cyan|turquoise|magenta|gold|golden|silver|beige|maroon|navy|lime|indigo|lavender|crimson|aqua|mint|peach|rainbow|lilac|coral|scarlet|emerald)\b/;
      const toks = ans.split(/\s+/).filter(Boolean);
      if (ans && toks.length <= 8 && !/^(hi|hey|hello|yo|ok|okay|lol|haha|thanks|thank you|bye|what|why|how|nothing|idk|dunno|no|yes|yeah|nope|sure|cool|nice|hmm|wow|same|good|great|oh|ah|um|uh|i do not|i don't|not really|never mind|nvm|stop|help|do you|can you|are you|tell me)\b/.test(ans)) {
        let val = null;
        if (expect.slot === "color") { const c = COLOR.exec(ans); if (c) val = c[0]; }
        else {
          val = cleanValue(ans.replace(/^(i think |probably |hmm |um |uh |well |my favorite is |my favorite \w+ is |i like |i love |its |it is |it has to be |i would say |definitely |maybe |easily |obviously )+/, "")
            .replace(/\s+(obviously|of course|for sure|definitely|probably|i guess|i think|lol|haha|tbh|honestly|duh)$/, "")).replace(/^(the|a|an) /, "");
          const sentence = /\b(is|are|was|were|am|have|has|had|does|did|will|would|can|should|could|must|got|get|went|go)\b/.test(val) || /^(my|i|we|you|it|this|that|he|she|they|there)\b/.test(val);
          if (sentence || val.split(" ").length > 4) val = null;
        }
        if (val && !/^(no|nothing|none|idk|i do not know|not sure|dunno|i dont know|what|why|you|yours|same|everything|all of them|complicated|hard to say|hard to choose|too many|a lot|lots|many|depends|it depends|so many|good question)$/.test(val)) facts.push({ type: "favorite", slot: expect.slot, value: val });
      }
    }

    // likes / dislikes (not "I like you", which is about Pip)
    if ((r = /\bi (?:really |absolutely |totally |also |just |kinda |kind of |sort of |truly |so |super |literally |lowkey |low key |still |especially )*(?:like|love|enjoy|adore|am into|am (?:really |so |kind of |kinda |super |totally |literally |lowkey |low key )*(?:obsessed with|into|addicted to|hooked on|a (?:big |huge )?fan of)) ([a-z0-9][^.!?,]{1,40})/.exec(t))) {
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
    if ((r = new RegExp("\\bi (?:have|got|own|just got|adopted) (?:a|an|one|two|three|four|five|\\d+|some|a new|a little|a baby|a pet)? ?(?:(?:little|baby|pet|new|cute|big|small|black|white|brown|orange|grey|gray|real|fluffy|fat|tiny|old|golden|fancy) )*(" + PET + ")\\b(?:[,.!]? (?:named|called|whose name is|his name is|her name is|its name is|he'?s called|she'?s called|and (?:his|her|its) name is) ([a-z]+))?").exec(t))) {
      facts.push({ type: "pet", kind: singularPet(r[1]), name: r[2] && looksLikeName(r[2], raw, true) ? properCase(r[2]) : null });
    }
    if ((r = new RegExp("\\bmy (" + PET + ")(?:'s| s|s)? (?:name is|is named|is called|named|called) ([a-z]+)").exec(t))) {
      if (looksLikeName(r[2], raw, true)) facts.push({ type: "pet", kind: singularPet(r[1]), name: properCase(r[2]) });
    } else if ((r = new RegExp("\\bmy (?:little |baby |pet |new |old |cute |fat |crazy )?(" + PET + ") ([a-z]+)(?= (?:is|was|keeps|just|always|never|ate|eats|loves|likes|hates|sleeps|slept|barks|barked|barking|meows|jumped|jumps|ran|runs|got|has|did|and|bit|scratched|knocked|sat|sits|stole)\\b|[,.!]|$)").exec(t))) {
      const w = r[2];
      if (!ADVERB.test(w) && !NOT_NAME.has(w) && !P.nlp.STOP.has(w) && plausibleName(w) && w.length >= 3 && (looksLikeName(w, raw, false) || NAMEISH.test(w) || PETNAMEISH.test(w)))
        facts.push({ type: "pet", kind: singularPet(r[1]), name: properCase(w), quiet: true });
    }

    if ((r = new RegExp("\\b([a-z]+) is my (?:pet |little |baby )?(" + PET + ")\\b").exec(t)) && !NOT_NAME.has(r[1]) && !P.nlp.STOP.has(r[1]) && plausibleName(r[1]) && r[1].length >= 3) {
      facts.push({ type: "pet", kind: singularPet(r[2]), name: properCase(r[1]) });   // "peanut is my hamster"
    }

    // people in their life
    if ((r = new RegExp("\\bmy (" + PEOPLE + ")(?:'s| s)? (?:name is|is named|is called|named|called) ([a-z]+)").exec(t))) {
      if (looksLikeName(r[2], raw, true)) facts.push({ type: "person", rel: r[1], name: properCase(r[2]) });
    } else if ((r = new RegExp("\\bmy (" + PEOPLE + ") ([a-z]+)(?= (?:is|was|and|moved|lives|lived|said|says|told|went|goes|got|gets|has|had|likes|loves|hates|just|always|never|keeps|kept|texted|texts|called|calls|came|comes|left|broke|made|makes|helped|helps|does|did|can|could|will|would|thinks|wants|needs|who|from|at|in)\\b|$)").exec(t))) {
      const w = r[2];
      if (!ADVERB.test(w) && looksLikeName(w, raw, false) || (!ADVERB.test(w) && !NOT_NAME.has(w) && !P.nlp.STOP.has(w) && plausibleName(w) && new RegExp("\\b" + w.charAt(0).toUpperCase() + w.slice(1) + "\\b").test(raw)))
        facts.push({ type: "person", rel: r[1], name: properCase(w), quiet: true });
      else if (!ADVERB.test(w) && !NOT_NAME.has(w) && !P.nlp.STOP.has(w) && plausibleName(w) && w.length >= 3 && !(P.nlp.knownWord(w) && !NAMEISH.test(w)) && !/(ing|ed|ly|ness|ment|tion)$/.test(w))
        facts.push({ type: "person", rel: r[1], name: properCase(w), quiet: true });
    }

    if ((r = /\bmy (grandchildren|grandkids|kids|children|sons|daughters|sisters|brothers|cousins|best friends|friends|siblings)(?: are| are called| are named|,)? ([a-z]+)(?: \d+)?,? (?:and|&) ([a-z]+)\b/.exec(t)) && looksLikeName(r[2], raw, true) && looksLikeName(r[3], raw, true) && !NOT_NAME.has(r[2]) && !NOT_NAME.has(r[3])) {
      facts.push({ type: "person", rel: r[1], name: properCase(r[2]) + " and " + properCase(r[3]) });
    }
    // "i start at point guard", "I play goalie"
    if ((r = /\bi (?:start at|start as|play|am the|am a|am|play as|played) (point guard|shooting guard|small forward|power forward|center|centre|forward|guard|goalie|goalkeeper|keeper|striker|defender|midfielder|winger|pitcher|catcher|shortstop|first base|quarterback|wide receiver|running back|linebacker|setter|libero|wing|fly half|scrum half)\b/.exec(t))) {
      facts.push({ type: "position", value: r[1] });
    }
    // "prob just play fortnite", "i play basketball every day" -> things they do
    if ((r = /(?:^\s*|\b(?:i|we) )(?:just |mostly |usually |always |also |still |really |prob |probably |literally )*(?:play|plays|played|do|go to|am on the) ([a-z0-9][a-z0-9 ]{1,25}?)(?= (?:like |every|all|a lot|with|w |after|on |at |in |when|and|but|so|tho|though|lol)|[.!?,]|\s*$)/.exec(t)) && P.content && P.content.topicOf) {
      const tp = P.content.topicOf(r[1]);
      if (tp && !/^(it|that|this|them|with|games?)$/.test(r[1])) facts.push({ type: "like", value: cleanValue(r[1]), quiet: true });
    }
    if ((r = /\b([a-z]+) is (\d{1,2})(?: years old)?,? (?:and|&) ([a-z]+) is (\d{1,2})\b/.exec(t)) && /\b(grandchildren|grandkids|kids|children|sons|daughters|brothers|sisters|siblings|cousins|two|twins)\b/.test(t) &&
        looksLikeName(r[1], raw, true) && looksLikeName(r[3], raw, true) && !NOT_NAME.has(r[1]) && !NOT_NAME.has(r[3])) {
      const rel = (/\b(grandchildren|grandkids|kids|children|sons|daughters|brothers|sisters|siblings|cousins)\b/.exec(t) || [, "kids"])[1];
      facts.push({ type: "person", rel, name: properCase(r[1]) + " and " + properCase(r[3]), ages: [+r[2], +r[4]] });
    }
    // "i mostly listen to travis scott", or the answer right after Pip asked about music
    if ((r = /\bi (?:mostly |mainly |usually |really |just )*(?:listen to|am listening to|have been listening to|been listening to) ([a-z0-9][a-z0-9 .'&-]{1,40}?)(?= (?:a lot|all the time|every|rn|right now|lately|these days)|[.!?,]|\s*$)/.exec(t)) ||
        (expect && expect.kind === "music" && (r = /^\s*(?:rn |right now |lately |mostly |probably |prob |i guess |hmm )*([a-z0-9][a-z0-9 .'&-]{1,40}?)\s*[.!]*$/.exec(m.plain)))) {
      const v = r[1].trim().replace(/^(mostly|a lot of|lots of|some|like) /, "").replace(/\s+(lol|haha|tbh|rn|ngl)$/, "");
      if (v && v.split(" ").length <= 7 && !/^(it|that|this|music|nothing|idk|no|yes|you|the radio)$/.test(v)) facts.push({ type: "music", value: U.titleCase(v).replace(/ And /g, " and "), quiet: true });
    }
    // "I used to be a teacher", "I'm a retired nurse"
    if ((r = /\bi (?:used to be|was|worked as|am retired from being|retired as) (?:a |an )([a-z]+(?: [a-z]+)?)\b/.exec(t)) && JOBS.has(r[1].split(" ").pop())) {
      facts.push({ type: "job", value: "retired " + r[1].split(" ").pop() });
    }
    // "I grow tomatoes and roses" -> gardening
    if (/\bi (grow|plant|garden)\b|\bmy garden\b/.test(t)) facts.push({ type: "like", value: "gardening", quiet: true });

    // job / school
    if ((r = /\bi (?:am|work as) (?:a|an) ([a-z]+(?: [a-z]+)?)\b/.exec(t)) || (r = /(?:^|[,;] ?|\band )(?:i'?m |i am |im )?(?:a |an )?((?:(?:software|web|game|senior|junior|high school|high-school|primary school|primary-school|elementary school|elementary-school|middle school|retired|former|school|head|art|music|maths|math|science|english) )*(?:developer|engineer|programmer|teacher|nurse|doctor|designer|student|lawyer|accountant|chef|mechanic|electrician|artist|writer|musician|scientist|manager|firefighter|pilot|headteacher|librarian|midwife|dentist|vet|farmer|police officer|secretary|cleaner|driver|builder|plumber|carpenter|pharmacist))\b(?=\s*(?:$|[,.;!]|and\b))/.exec(m.clean.toLowerCase()))) {
      const words = r[1].split(" ");
      const job = JOBS.has(r[1]) ? r[1] : JOBS.has(words[words.length - 1]) ? r[1] : JOBS.has(words[0]) && words.length === 1 ? words[0] : null;
      if (job) facts.push({ type: "job", value: job });
    }
    if ((r = /\bi am in (\d{1,2})(?:st|nd|rd|th)? grade\b/.exec(t)) || (r = /\bi am in (year \d{1,2}|high school|middle school|elementary school|primary school|college|university|uni|kindergarten)\b/.exec(t)) || (r = /\bi (?:go to|attend) (high school|middle school|elementary school|college|university|uni|school)\b/.exec(t))) {
      facts.push({ type: "school", value: /^\d+$/.test(r[1]) ? r[1] + ordinal(r[1]) + " grade" : r[1] });
    }

    // upcoming events worth asking about later
    {
      const NOUN = "tests?|exams?|quiz|quizzes|interview|game|match|recital|appointment|date|presentation|party|sleepover|trip|surgery|operation|competition|tournament|concert|audition|meeting|finals|midterms?|essay|project|race|performance|show|tryouts?|practice|lesson|vacation|holiday|flight|wedding|funeral|checkup|check up|playdate|camp|first day|big day|debate|speech|sats?|hike|play|school play|recital|dance|prom|graduation|birthday party|sleepover";
      const WHEN = "tomorrow|today|tonight|later today|this (?:afternoon|evening|morning)|in (?:like )?(?:an|a few|\\d+|one|two|three) hours?|next week|next month|this month|this weekend|this week|on the weekend|over the weekend|in (?:a|two|three|\\d+) weeks?|(?:on|next|this) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|soon|in \\w+ days?";
      const PLACE = { dentist: "dentist appointment", doctor: "doctor's appointment", doctors: "doctor's appointment", zoo: "trip to the zoo", beach: "beach trip", museum: "museum trip", movies: "movie night", movie: "movie night", "amusement park": "amusement park trip", "theme park": "theme park trip", "water park": "water park trip" };
      const clean = (pre, noun) => {
        const words = (pre || "").trim().split(/\s+/).filter((w) => w && !/^(of|lot|lots|bunch|really|very|so|super|kind|pretty|such|some|kinda|sorta|the|a|an|my|our|this|that|another|couple|few|going|gonna|to|hard|easy|difficult|scary|stupid|boring|dumb|annoying)$/.test(w));
        return (words.join(" ") + " " + noun).trim();
      };
      const whenOf = (w) => (w ? w.replace(/^(later today|this (afternoon|evening|morning)|in (like )?(an|a few|\d+|one|two|three) hours?)$/, "today").replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/, "on $1").replace(/^(on|over) the weekend$/, "this weekend").replace(/^this (\w+day)$/, "on $1") : "soon");
      const ROUTINE = /^(practice|lesson|class|training|rehearsal|homework)$/;
      if ((r = new RegExp("\\b(?:i|we) (?:have|got|have got|will have|am having|are having|have to do|need to do) (?:a |an |my |our |the |this |that |some |another )?((?:[a-z]+ ){0,3}?)(" + NOUN + ")\\b(?:.*?\\b(" + WHEN + ")\\b)?").exec(t)) && !(ROUTINE.test(r[2]) && !/\b(big|important|first|last|final)\b/.test(r[1] || "")) ||
          (r = new RegExp("\\bmy ((?:[a-z]+ ){0,3}?)(" + NOUN + ") is (?:on |)(" + WHEN + ")\\b").exec(t))) {
        facts.push({ type: "event", what: clean(r[1], r[2]), when: whenOf(r[3]) });
      } else if ((r = new RegExp("\\b(?:(?:i am|we are|were|im) (?:going|goin|heading)|(?:i|we) (?:have|need|got) to go|(?:i|we) gotta go) (?:to|on) (?:a |an |the |my |our )?((?:[a-z]+ ){0,2}?)(" + NOUN + "|dentist|doctors?|zoo|beach|museum|movies?|amusement park|theme park|water park)\\b(?:.*?\\b(" + WHEN + ")\\b)?").exec(t)) && r[3]) {
        let what = PLACE[r[2]] || clean(r[1], r[2]);
        const dest = /^(trip|vacation|holiday)$/.test(r[2]) && /\b(?:trip|vacation|holiday) to ([a-z]+)\b/.exec(t);
        if (dest && !/^(the|a|my|see|visit)$/.test(dest[1])) what = r[2] + " to " + properCase(dest[1]);
        facts.push({ type: "event", what, when: whenOf(r[3]) });
      }
    }

    // explicit "remember that ..."
    if (!m.isQuestion && !/\b(do|can|did|will|would) (you|u) (still )?remember\b|\byou remember\b|\bsay you remember\b|\bremember (stuff|things|anything)\b/.test(m.plain) &&
        (r = /(?:^|[.!]\s*|\b(?:please|pls|can you|could you|and)\s+)(?:remember|do not forget|don't forget|never forget|make a note|note) (?:that |this: |this |:)?(.{3,90})$/.exec(m.plain)) && !/^(me|my name|what|when|how|who|why|that time|the time|to)\b/.test(r[1])) {
      facts.push({ type: "note", value: r[1].replace(/\bmy\b/g, "your").replace(/\bi am\b/g, "you are").replace(/\bi\b/g, "you").replace(/\bme\b/g, "you") });
    }

    for (const f of facts) apply(mem, f);
    for (const f of facts) if (f.type === "note") datedNote(mem, f.value);
    // "WE WON THE GAME" / "my test went great": that event is over
    if (/\b(we|i) (won|lost|tied|passed|failed|aced|nailed|finished|smashed|crushed|bombed)\b|\b(went|was) (great|well|good|ok|okay|fine|badly|bad|terrible|awful|amazing)\b/.test(t)) {
      for (const e of mem.events) if (!e.done && dueOf(e) < Date.now() + 36 * 3600e3 && e.what.split(" ").some((w) => w.length > 2 && t.includes(" " + w.replace(/s$/, "")))) { e.done = true; e.asked = true; e.wished = true; }
    }
    return facts;
  }
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  function datedNote(mem, note) {
    const r = /\bon (?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)\b|\bon ([a-z]+) (\d{1,2})(?:st|nd|rd|th)?\b/.exec(note);
    if (!r) return;
    const mon = MONTHS.indexOf(r[2] || r[3]), day = +(r[1] || r[4]);
    if (mon < 0 || day < 1 || day > 31) return;
    const now = new Date();
    let due = new Date(now.getFullYear(), mon, day, 12).getTime();
    if (due < now.getTime() - 864e5) due = new Date(now.getFullYear() + 1, mon, day, 12).getTime();
    const words = note.split(" ").filter((w) => w.length > 3 && !/^(your|you|that|this|with|have|will|from|about|remember)$/.test(w));
    const ev = mem.events.find((e) => words.some((w) => e.what.toLowerCase().includes(w.toLowerCase())));
    const when = `on ${U.capitalizeFirst(MONTHS[mon])} ${day}`;
    if (ev) { ev.due = due; ev.when = when; ev.asked = false; ev.wished = false; mem.notes = mem.notes.filter((n) => n !== note); }
    else {
      const what = /\bfly to ([a-z]+)/.exec(note) ? "flight to " + properCase(/\bfly to ([a-z]+)/.exec(note)[1]) : note.replace(/^you (have |are )?/, "").replace(/\s+on .*$/, "").slice(0, 40);
      mem.events.push({ what, when, at: Date.now(), due, asked: false });
    }
  }
  // a small diary of what the user told Pip, so "do you remember what I was cooking?" works
  const DIARY_SKIP = /\b(password|address|phone|number|email|kill|suicid\w*|hurt|abuse|touch\w*|secret)\b/;
  function noteDiary(mem, m) {
    if (m.tokens.length < 4 || m.tokens.length > 40 || DIARY_SKIP.test(m.plain)) return;
    const said = m.clean.split(/(?<=[.!?])\s+/).filter((x) => !/\?\s*$/.test(x) && !/^(what|how|why|where|when|who|which|do|does|did|can|could|should|would|will|is|are|forget|never ?mind|nvm|omg|ok|okay|lol)\b/i.test(x.trim()) && x.split(/\s+/).length >= 3).join(" ");
    if (!said || !/\b(i|i'm|im|my|we|me)\b/i.test(said)) return;
    const d = (mem.diary = mem.diary || []);
    const text = said.replace(/\s+/g, " ").trim().slice(0, 140);
    if (d.length && d[d.length - 1].text === text) return;
    d.push({ text, at: Date.now() });
    if (d.length > 60) d.shift();
  }
  const DSTOP = new Set("do you remember what where who when how which why i we was were am did had have said told went the a an my me you about that this it to of in on at for with and or but is are be been".split(" "));
  function searchDiary(mem, q) {
    const words = q.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !DSTOP.has(w));
    if (!words.length) return null;
    const stem = (w) => w.replace(/(ing|ed|es|s)$/, "");
    const ws = words.map(stem);
    let best = null, bestScore = 0;
    (mem.diary || []).filter((e) => Date.now() - e.at > 1500).forEach((e, i) => {
      const ew = e.text.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).map(stem);
      const score = ws.filter((w) => ew.includes(w)).length + i * 0.001;
      if (score > bestScore) { best = e; bestScore = score; }
    });
    return bestScore >= 1 ? best : null;
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
      case "event": {
        // the same event mentioned again (with a new day) replaces the old one ("big game" and "game" are the same)
        const same = (e) => e.what === f.what || ((e.what.endsWith(" " + f.what) || f.what.endsWith(" " + e.what)) && Date.now() - e.at < 7 * 864e5);
        if (f.when === "soon" && mem.events.some((e) => same(e) && !e.done)) break;
        mem.events = mem.events.filter((e) => !same(e));
        mem.events.push({ what: f.what, when: f.when, at: Date.now(), due: dueDate(f.when, Date.now()), asked: false });
        if (mem.events.length > 10) mem.events.shift();
        break;
      }
      case "note": addUnique(mem.notes, f.value, 30); break;
      case "position": mem.position = f.value; break;
      case "music": mem.favorites.music = f.value; break;
    }
  }

  // when an event probably happens: "tomorrow", "on friday", "next week"... (around noon that day)
  const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  function dueDate(when, now) {
    const d = new Date(now);
    const day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const at = (days, hour) => day0 + days * 864e5 + (hour === undefined ? 12 : hour) * 3600e3;
    let r;
    if (/^(today|later)$/.test(when)) return at(0, 15);
    if (when === "tonight") return at(0, 21);
    if (when === "tomorrow") return at(1);
    if ((r = /^(?:on|next|this) (\w+)$/.exec(when)) && WEEKDAYS.includes(r[1])) {
      let k = (WEEKDAYS.indexOf(r[1]) - d.getDay() + 7) % 7;
      if (k === 0) k = 7;
      return at(k);
    }
    if (when === "this weekend") return at(Math.max(1, (6 - d.getDay() + 7) % 7));
    if (when === "this week") return at(2);
    if (when === "next week") return at(7);
    if (when === "next month") return at(30);
    if (when === "this month") return at(10);
    if ((r = /^in (a|two|three|\d+) weeks?$/.exec(when))) return at(7 * ({ a: 1, two: 2, three: 3 }[r[1]] || +r[1]));
    if ((r = /^in (\w+) days?$/.exec(when))) return at({ a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 }[r[1]] || +r[1] || 3);
    return now + 864e5; // "soon"
  }
  function dayWord(t) {
    const a = new Date(), b = new Date(t);
    const days = Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
    const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return days <= 0 ? "today" : days === 1 ? "tomorrow" : days <= 6 ? "on " + U.capitalizeFirst(WEEKDAYS[b.getDay()]) : days <= 13 ? "next week" : `on ${MON[b.getMonth()]} ${b.getDate()}`;
  }
  const dueOf = (e) => e.due || e.at + 864e5;

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
    const favs = Object.entries(mem.favorites).slice(-4).map(([k, v]) => (k === "music" ? `you listen to ${v}` : `your favorite ${k} is ${v}`));
    parts.push(...favs);
    if (mem.likes.length) parts.push(`you like ${U.listJoin(mem.likes.slice(-4))}`);
    if (mem.dislikes.length) parts.push(`you're not a fan of ${U.listJoin(mem.dislikes.slice(-3))}`);
    const pe = Object.entries(mem.people);
    const inGroup = (v) => pe.some(([k2, v2]) => v2 !== v && / and /.test(v2) && v2.split(/ and |, /).includes(v));
    const ppl = pe.filter(([, v]) => !inGroup(v)).slice(-3).map(([k, v]) => `your ${k} ${/ and /.test(v) ? "are" : "is"} ${v}`);
    parts.push(...ppl);
    if (mem.position) parts.push(`you play ${mem.position}`);
    const ev = mem.events.filter((e) => !e.done && dueOf(e) > Date.now() - 6 * 3600e3).slice(-2);
    if (ev.length) parts.push(`you have ${U.listJoin(ev.map((e) => (/s$/.test(e.what) && !/(ss|us)$/.test(e.what) ? "" : U.aOrAn(e.what) + " ") + e.what + (e.when && e.when !== "soon" ? " " + (/month/.test(e.when) && !e.due ? e.when : dayWord(dueOf(e))) : "")))} coming up`.replace(/ (today|tomorrow|tonight) coming up$/, " $1"));
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
    // "what's my cat's name and what's my best friend's name?" -> answer both
    const parts = m.plain.split(/\s+(?:and|also|plus)\s+(?=(?:what|whats|who|where|when|how|do you)\b)|[?]\s*/).map((x) => x.trim()).filter((x) => x.length > 3);
    if (parts.length > 1) {
      const answers = parts.map((x) => recallOne(mem, { plain: x, clean: x + "?", isQuestion: true })).filter(Boolean);
      if (answers.length > 1) return { text: answers.map((a) => a.text).join(" "), expect: answers[answers.length - 1].expect };
    }
    // "and my best friend?" / "what about my sister?" right after a memory question
    let f;
    if ((f = new RegExp("^(?:and|what about|how about|and what about) my (" + PEOPLE + "|" + PET + ")(?:'s| s)?(?: name)?\\??$").exec(m.plain))) {
      const w = f[1];
      if (new RegExp("^(" + PET + ")$").test(w)) return recallOne(mem, { plain: `what is my ${w} name`, clean: "?", isQuestion: true });
      return recallOne(mem, { plain: `what is my ${w} name`, clean: "?", isQuestion: true });
    }
    return recallOne(mem, m);
  }
  function recallOne(mem, m) {
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
    if ((r = /\b(?:names? of my|remember my|know my|who (?:are|is) my|what are my|whats my|what is my) (grandchildren|grandkids|kids|children|sons|daughters|sisters|brothers|cousins|best friends|friends|siblings)(?:'s|s)?(?: names?| called)?\b/.exec(t))) {
      const group = mem.people[r[1]] || (/grand/.test(r[1]) && [mem.people.granddaughter, mem.people.grandson].filter(Boolean).join(" and "));
      if (group) return { text: `Your ${r[1]} are ${group}! 😊` };
    }
    // "what position do i play?", "what game do i play every day?"
    if (/\bwhat position do i play\b/.test(t)) return mem.position ? { text: `You play ${mem.position}! 🏀` } : { text: "Hmm, I don't think you've told me your position yet! What do you play?" };
    if ((r = /\bwhat (game|games|sport|sports|instrument) do i (?:play|like)\b/.exec(t))) {
      const want = /sport/.test(r[1]) ? /\b(basketball|bball|soccer|football|baseball|hockey|tennis|volleyball|softball|swimming|gymnastics|dance|rugby|cricket|golf|lacrosse|track|running|karate|judo|boxing|wrestling)\b/ : /game/.test(r[1]) ? /\b(fortnite|roblox|minecraft|among us|pokemon|zelda|mario|valorant|apex|overwatch|call of duty|cod|fifa|fc \d+|rocket league|league|gta|splatoon|animal crossing|genshin|brawl stars|clash|terraria|stardew)\b/ : /\b(piano|guitar|violin|drums|flute|cello|trumpet|clarinet|saxophone|ukulele|bass)\b/;
      const hits = mem.likes.filter((x) => want.test(x.toLowerCase()));
      if (hits.length) return { text: `${U.capitalizeFirst(U.listJoin(hits.slice(-3)))}! ${/game/.test(r[1]) ? "🎮" : /sport/.test(r[1]) ? "🏅" : "🎵"}` };
    }
    if (/\bwho do i (listen to|like to listen to)\b|\bwhat music do i (like|listen to)\b|\bwho is my favou?rite (rapper|singer|artist|band)\b/.test(t)) {
      const fav = mem.favorites.rapper || mem.favorites.singer || mem.favorites.artist || mem.favorites.band || mem.favorites.music || mem.favorites.song;
      if (fav) return { text: `You listen to ${fav}! 🎵` };
    }
    if ((r = /\bwhen (?:do|am|will) i (?:fly|leave|go|travel|have)\b.*?\b(?:to )?([a-z]+)\s*$/.exec(t.trim()))) {
      const key = r[1];
      const ev = mem.events.find((e) => e.what.toLowerCase().includes(key));
      const note = mem.notes.find((n) => n.toLowerCase().includes(key));
      const days = ev && ev.due ? Math.round((ev.due - Date.now()) / 864e5) : null;
      if (ev) return { text: `Your ${ev.what} is ${ev.when && ev.when !== "soon" ? (/month/.test(ev.when) && !ev.due ? ev.when : dayWord(dueOf(ev))) : "coming up soon"}!${days > 1 ? ` That's in ${days} days.` : ""} ${U.pick(["Exciting! ✈️", "Not long now!"])}` };
      if (note) return { text: `You told me: ${note}. 📝` };
    }
    if ((r = new RegExp("\\b(?:what is|whats|do you (?:know|remember)|what was) my (" + PEOPLE + ")(?:'s| s|s)? name\\b").exec(t))) {
      const key = Object.keys(mem.people).find((k) => k === r[1]) || Object.keys(mem.people).find((k) => k.endsWith(" " + r[1]) || k.replace(/^(little|big|older|younger|baby|twin|step|half) /, "") === r[1]);
      const n = key && mem.people[key];
      return n ? { text: U.pick([`Your ${r[1]}'s name is ${n}.`, `${n}! Your ${r[1]}. 😊`]) } : { text: `Hmm, I don't think you've told me your ${r[1]}'s name yet. What is it?`, expect: { kind: "personname", rel: r[1] } };
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
    // "what did we talk about yesterday?"
    if (/\bwhat (did|have) we (talk|talked|chat|chatted|speak|spoke) about\b|\bwhat were we talking about\b|\bdo you remember (what we talked about|our (last )?(chat|conversation))\b/.test(t)) {
      const now = Date.now(), start = mem.sessionStart || now;
      const today = /\b(today|just now|earlier|before)\b/.test(t) && !/\byesterday|last time\b/.test(t);
      const pool = (mem.topics || []).filter((x) => (today ? x.at >= start : x.at < start));
      const labels = [];
      for (const x of pool.slice().reverse()) if (!labels.includes(x.label)) labels.push(x.label);
      if (!labels.length) return { text: today ? "We've only just started! 😊 What's on your mind?" : "Hmm, I don't have much saved from before. 😅 What's new with you?" };
      return { text: `${today ? "So far we talked about" : "Last time we talked about"} ${U.listJoin(labels.slice(0, 5).reverse())}! 😊` };
    }
    // "do you remember what I was cooking?" -> search what they told Pip
    if (/(^|[.!?]\s*)\s*(do you remember|remember|what) (what|where|who|when|how|which|why)? ?(i|we) (was|were|am|did|had|said|told|went|ate|made|cooked|played|watched|got|bought)\b|(^|[.!?]\s*)\s*what (was|were) i (doing|cooking|making|playing|watching|reading|eating|building|drawing)\b|\bwhat did i (tell you|say) about\b|(^|[.!?]\s*)\s*what did i (have|eat|do|make|cook|watch|play|buy|get|build|draw)\b/.test(m.plain.trim()) && !/\bwhat did i (just )?say\s*$/.test(t) && !/\bguess what\b/.test(t)) {
      const hit = searchDiary(mem, m.plain);
      const old = hit && mem.sessionStart && hit.at < mem.sessionStart && /\b(tonight|tomorrow|going to|gonna|will|cooking|making|planning|trying)\b/i.test(hit.text);
      const q = hit && hit.text.replace(/([^.!?])\s*$/, "$1.");
      if (hit) return { text: U.pick([`You told me: "${q}" 😊`, `I remember! You said: "${q}"`]) + (old ? " " + U.pick(["How did it go?", "How did it turn out?"]) : "") };
      if (/\b(did|was|were|had|told|said|went|ate|made|cooked|played|watched|got|bought)\b/.test(t))
        return { text: U.pick(["Hmm, I don't think you told me that one! 😅 What was it?", "I don't remember you telling me that. What was it?"]) };
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
    if (/^(?:(?:ok|okay|pip|please|pls|can you|could you|i want you to|i want to)\s+)*(forget|delete|erase|wipe|clear|reset) (everything|all|all about me|all of it|my data|your memory|everything about me|me|what you know about me)\b(?!.*\b(worlds?|files?|photos?|pictures?|account|minecraft|game|roblox|messages)\b)/.test(t) && !/\b(do not|don'?t|dont|never|won'?t|will you|you will)\b/.test(t)) return { all: true };
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
  // Returns { text, expect } so the brain knows what the next answer is about.
  const HARD_CARE = /^(overdose|crisis|abuse|neglect|grooming|sextortion|meetstranger|friendcrisis|runaway)$/;
  function followUp(mem) {
    const now = Date.now();
    const cf = mem.careFollow;
    if (cf && !cf.asked && now - cf.at > 2 * 3600e3 && now - cf.at < 14 * 864e5) {
      cf.asked = true;
      const hard = HARD_CARE.test(cf.kind || "");
      // a serious moment gets a real check-in; a sad or touchy chat just gets a warm "how are you?"
      let text = cf.kind === "overdose" ? "I've been thinking about you. 💙 How are you feeling? Did you tell an adult about what happened?"
        : hard ? "I've been thinking about you. 💙 How are you feeling today? Did you get a chance to talk to someone you trust?"
        : cf.kind === "grief" ? "I've been thinking about what you told me. 💙 How are you feeling today?"
        : "I've been thinking about you. 💙 How are you feeling today?";
      const soon = !hard && mem.events.find((e) => !e.wished && e.due && e.due > now && e.due - now < 30 * 3600e3);
      if (soon) { soon.wished = true; text += ` And your ${soon.what} is ${dayWord(soon.due)}! Good luck! 🍀`; }
      return { text, expect: { kind: "followup", about: "care", label: cf.kind || "soft", hard } };
    }
    // an event later today ("the play is on friday", and it's friday afternoon) still gets a good-luck wish, not "how did it go?"
    const d0 = new Date(now); const day0 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
    const laterToday = (e) => e.due && e.due >= day0 && e.due < day0 + 864e5 && d0.getHours() < 20 && !/^(today|later)$/.test(e.when || "");
    const ev = mem.events.find((e) => !e.asked && !e.done && now - e.at > 3 * 3600e3 && now - e.at < 14 * 864e5 && dueOf(e) <= now && !laterToday(e));
    if (ev) {
      ev.asked = true;
      return { text: U.pick([`How did your ${ev.what} go? I was rooting for you! 🍀`, `Last time you told me about your ${ev.what}. How did it go?`, `I've been wondering: how did your ${ev.what} go?`]),
        expect: { kind: "followup", about: "event", what: ev.what } };
    }
    const soon = mem.events.find((e) => !e.wished && !e.done && e.due && (e.due > now || laterToday(e)) && e.due - now < 30 * 3600e3 && now - e.at > 3 * 3600e3);
    if (soon) {
      soon.wished = true;
      return { text: `Your ${soon.what} is ${dayWord(soon.due)}, right? Good luck! 🍀 Are you feeling ready?`, expect: { kind: "followup", about: "upcoming", what: soon.what } };
    }
    const mood = mem.moods[mem.moods.length - 1];
    if (mood && /sad|lonely|anxious|angry|sick|tired/.test(mood.label) && now - mood.at > 3 * 3600e3 && now - mood.at < 7 * 864e5 && !mood.asked) {
      mood.asked = true;
      return { text: { sad: "Last time you were feeling down. Are you doing any better today?", lonely: "Last time you felt a bit lonely. How are you feeling today?",
        anxious: "Last time you were stressed. Did things calm down?", angry: "Last time something made you really angry. Is it any better now?",
        sick: "Last time you weren't feeling well. Are you feeling better?", tired: "Last time you were really tired. Did you get some rest?" }[mood.label],
        expect: { kind: "followup", about: "mood", label: mood.label } };
    }
    const th = (mem.threads || []).slice().reverse().find((x) => !x.asked && now - x.at > 3 * 3600e3 && now - x.at < 10 * 864e5);
    if (th) {
      th.asked = true;
      return { text: th.valence < 0 ? `Last time you told me about your ${th.who}, and it sounded tough. How are things now?` : `Last time you told me about your ${th.who}! Any news?`,
        expect: { kind: "followup", about: "thread", who: th.who, valence: th.valence } };
    }
    if (mem.pets.length && U.chance(0.3)) {
      const p = U.pick(mem.pets);
      return { text: `How's ${petText(p)} doing?`, expect: { kind: "followup", about: "pet", pet: p.name || "your " + p.kind } };
    }
    return null;
  }
  // "it's not until next week" -> ask again after the new date
  function rearmEvent(mem, what, when) {
    const e = mem.events.find((x) => x.what === what);
    if (!e) return;
    e.asked = false; e.wished = true; e.at = Date.now();
    if (when) { e.when = when; e.due = dueDate(when, Date.now()); } else e.due = Date.now() + 864e5;
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

  P.memory = { noteThread, noteDiary, searchDiary, blank, extract, apply, recall, forget, followUp, rearmEvent, dueDate, dayWord, dueOf, summary, load, save, looksLikeName, currentAge, petText, SLOTS };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
