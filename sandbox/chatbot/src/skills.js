/* Pip: skills: games (riddles, trivia, rock-paper-scissors, number guessing, would-you-rather),
   jokes/facts/stories without repeats, time and date, world capitals, general knowledge Q&A,
   spelling / letter counting / reversing, and "X or Y?" decisions. */
(function (P) {
  "use strict";
  const U = P.util, C = P.content;
  const pick = U.pick;

  // take items from a list without repeating until the list is used up
  function deal(state, key, list) {
    const bag = (state.bags = state.bags || {});
    const recent = state.recent || [];
    for (let tries = 0; tries < list.length; tries++) {
      if (!bag[key] || !bag[key].length) bag[key] = U.shuffle(list.map((_, i) => i));
      const item = list[bag[key].pop()];
      // the same joke can sit in two bags ("joke" and "mcjoke"): skip anything said lately
      const txt = typeof item === "string" ? item : Array.isArray(item) ? item[0] : null;
      if (!txt || !recent.some((r) => r.includes(txt.slice(0, 40)))) return item;
    }
    return list[Math.floor(U.rand() * list.length)];
  }
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  function matchesAnswer(text, answers) {
    const t = " " + norm(text) + " ";
    return answers.some((a) => t.includes(" " + norm(a) + " ") || (a.length > 4 && norm(text).split(" ").some((w) => U.levenshtein(w, norm(a), 1) <= 1)));
  }

  // ---------- starting skills ----------
  function start(kind, c) {
    const st = c.state;
    switch (kind) {
      case "joke": return { text: deal(st, "joke", C.jokes), intent: "joke" };
      case "mcjoke": return { text: deal(st, "mcjoke", C.mcJokes), intent: "mcjoke" };
      case "fact": return { text: pick(["Here's one: ", "Fun fact: ", "Did you know? ", ""]) + deal(st, "fact", C.facts) };
      case "riddle": {
        const r = deal(st, "riddle", C.riddles);
        st.game = { type: "riddle", r, tries: 0, idle: 0 };
        return { text: "Here's a riddle: " + r[0] + " 🤔", chips: ["Hint", "I give up"] };
      }
      case "trivia": {
        const g = st.game && st.game.type === "trivia" ? st.game : { type: "trivia", score: 0, asked: 0 };
        const q = deal(st, "trivia", C.trivia);
        Object.assign(g, { q, idle: 0 });
        st.game = g;
        return { text: (g.asked ? "" : "Trivia time! 🧠 ") + q[0], chips: ["I don't know", "Stop"] };
      }
      case "rps": st.game = { type: "rps", you: 0, me: 0, idle: 0 }; return { text: "Rock, paper, scissors! ✊✋✌️ Make your move!", chips: ["Rock", "Paper", "Scissors"] };
      case "guess": {
        st.game = { type: "guess", target: 1 + Math.floor(U.rand() * 100), tries: 0, idle: 0 };
        return { text: "I'm thinking of a number between 1 and 100. 🔢 Can you guess it?" };
      }
      case "wyr": {
        const q = deal(st, "wyr", C.wyr);
        st.game = { type: "wyr", q, idle: 0 };
        return { text: `Would you rather ${q[0]}, or ${q[1]}? 🤔`, chips: [U.capitalizeFirst(q[0]), U.capitalizeFirst(q[1])] };
      }
      case "story": return { text: deal(st, "story", C.stories) };
      case "poem": return { text: deal(st, "poem", C.poems) };
      case "compliment": return { text: (c.name ? c.name + ", " : "") + lowerFirst(deal(st, "compliment", C.compliments)) };
      case "motivate": return { text: deal(st, "motivate", C.motivation) };
      case "question": return askQuestion(c);
      case "time": return { text: timeText() };
      case "date": return { text: dateText(c.m.norm) };
    }
    return null;
  }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  function askQuestion(c) {
    const mem = c.mem;
    const open = C.questions.filter(([, slot]) => {
      if (!slot) return true;
      if (slot.startsWith("favorite:")) return !mem.favorites[slot.split(":")[1]];
      if (slot === "pets") return !mem.pets.length;
      if (slot === "age") return !mem.age;
      if (slot === "location") return !mem.location;
      if (slot === "hobby") return mem.likes.length < 2;
      return true;
    });
    const asked = (c.state.asked = c.state.asked || []);
    let pool = open.filter(([q]) => !asked.includes(q));
    if (!pool.length) { asked.length = 0; pool = open.length ? open : C.questions; }
    // prefer filling the profile first, like getting to know someone
    const slotted = pool.filter(([, s]) => s);
    const [q, slot] = slotted.length && U.chance(0.6) ? pick(slotted) : pick(pool);
    asked.push(q);
    let expect = { kind: "open", topic: "question", q };
    if (slot && slot.startsWith("favorite:")) expect = { kind: "favorite", slot: slot.split(":")[1], q };
    else if (slot === "age") expect = { kind: "age", q };
    else if (slot === "location") expect = { kind: "location", q };
    else if (slot === "pets") expect = { kind: "pets", q };
    return { text: pick(["Okay, here's one: ", "Ooh, let me think... ", "Question for you: ", ""]) + q, expect };
  }

  // ---------- running games ----------
  const QUIT = /\b(stop|quit|end|exit|enough|no more|i (am|m) done|done playing|cancel|forget it|nevermind|never mind|something else|another game)\b/;
  function gameTurn(m, c) {
    const st = c.state, g = st.game;
    if (!g) return null;
    const t = m.norm;
    if (QUIT.test(t) && m.tokens.length <= 6) {
      st.game = null;
      if (g.type === "trivia" && g.asked) return { text: `Game over! You got ${g.score} out of ${g.asked}. ${g.score >= g.asked * 0.7 ? "Impressive! 🏆" : "Nice try! 😊"}` };
      if (g.type === "rps" && g.you + g.me) return { text: `Good game! Final score: you ${g.you}, me ${g.me}. ${g.you > g.me ? "You win! 🏆" : g.you < g.me ? "I win this time! 😄" : "It's a tie!"}` };
      if (g.type === "guess") return { text: `Okay! My number was ${g.target}. 😄` };
      if (g.type === "riddle") return { text: `No problem! The answer was: ${g.r[2]}` };
      return { text: "Okay, game over! That was fun. 😊" };
    }
    switch (g.type) {
      case "riddle": {
        if (/\b(hint|clue|help)\b/.test(t)) { g.tries++; const a = g.r[1][0]; return { text: `Hint: it starts with "${a[0].toUpperCase()}" and has ${a.replace(/ /g, "").length} letters. 😉`, chips: ["I give up"] }; }
        if (/\b(give up|i do not know|idk|tell me|what is it|no idea|answer|reveal|i quit|dunno|no clue|pass|skip)\b/.test(t)) { st.game = null; return { text: `The answer is... ${g.r[2]} Want another riddle?`, expect: { kind: "yesno", yes: "riddle" } }; }
        if (matchesAnswer(m.clean, g.r[1])) { st.game = null; return { text: pick(["Yes! 🎉 You got it! ", "Correct! Nice brain! 🧠 ", "That's right! 🎉 "]) + g.r[2] + " Another one?", expect: { kind: "yesno", yes: "riddle" } }; }
        if (m.tokens.length > 8 || m.isQuestion && !/^(is it|a |an |the )/.test(t)) return idle(g, st);
        g.tries++;
        if (g.tries >= 3) { st.game = null; return { text: `Good guesses! The answer was: ${g.r[2]} Want another?`, expect: { kind: "yesno", yes: "riddle" } }; }
        return { text: pick(["Nope, not quite! Try again 🤔", "Hmm, good guess, but no! Want a hint?", "Not that one! One more try?"]), chips: ["Hint", "I give up"] };
      }
      case "trivia": {
        const q = g.q;
        if (/\b(skip|pass|next)\b/.test(t)) { g.asked++; const r = start("trivia", c); r.text = `It was ${q[2].replace(/^The /, "the ")}. Next: ` + r.text.replace("Trivia time! 🧠 ", ""); return r; }
        const idk = /\b(i do not know|idk|no idea|not sure|dunno|give up|no clue)\b/.test(t);
        if (!idk && m.tokens.length > 8) return idle(g, st);
        g.asked++;
        const right = !idk && matchesAnswer(m.clean, q[1]);
        if (right) g.score++;
        const ans = q[2].replace(/^The /, "the ");
        const verdict = right ? pick(["Correct! 🎉", "Yes! You got it! ✅", "That's right! 🧠"]) : idk ? `No worries! It's ${ans}.` : `Not quite, it's ${ans}.`;
        if (g.asked >= 5) { st.game = null; return { text: `${verdict} That's 5 questions: you got ${g.score}/5! ${g.score >= 4 ? "Trivia champion! 🏆" : g.score >= 2 ? "Nice job! 😊" : "You'll get them next time! 💪"} Play again?`, expect: { kind: "yesno", yes: "trivia" } }; }
        const nx = start("trivia", c);
        return { text: `${verdict} (Score: ${g.score}/${g.asked}) Next question: ${nx.text}`, chips: nx.chips };
      }
      case "rps": {
        const mv = /\b(rock|stone|fist)\b/.test(t) ? "rock" : /\b(paper|sheet)\b/.test(t) ? "paper" : /\b(scissors?|scissor|sissors|shears)\b/.test(t) ? "scissors" : null;
        if (!mv) return idle(g, st);
        const mine = pick(["rock", "paper", "scissors"]);
        const beats = { rock: "scissors", paper: "rock", scissors: "paper" };
        const em = { rock: "✊", paper: "✋", scissors: "✌️" };
        let res;
        if (mv === mine) res = "It's a tie! 🤝";
        else if (beats[mv] === mine) { g.you++; res = pick(["You win this round! 🎉", "Argh, you got me! 😄", "Nice one, you win!"]); }
        else { g.me++; res = pick(["I win! 😄", "Ha, gotcha! 🎉", "My round!"]); }
        return { text: `I choose ${mine} ${em[mine]}! ${res} (You ${g.you} : ${g.me} Me) Again?`, chips: ["Rock", "Paper", "Scissors", "Stop"] };
      }
      case "guess": {
        const nm = /(-?\d+)/.exec(t);
        if (!nm) return /\b(give up|tell me)\b/.test(t) ? (st.game = null, { text: `It was ${g.target}! 😄 Want to play again?`, expect: { kind: "yesno", yes: "guess" } }) : idle(g, st);
        const n = parseInt(nm[1], 10);
        g.tries++;
        if (n === g.target) { st.game = null; return { text: `🎉 YES! It was ${g.target}! You got it in ${g.tries} ${g.tries === 1 ? "try. Are you a mind reader?!" : "tries."} Play again?`, expect: { kind: "yesno", yes: "guess" } }; }
        if (n < 1 || n > 100) return { text: "It's between 1 and 100! 😄" };
        const diff = Math.abs(n - g.target);
        const warm = diff <= 3 ? " You're super close! 🔥" : diff <= 10 ? " Getting warm!" : "";
        return { text: (n < g.target ? "Higher! ⬆️" : "Lower! ⬇️") + warm };
      }
      case "wyr": {
        const [a, b] = g.q;
        const na = norm(a), nb = norm(b);
        const tt = norm(m.clean);
        const hitA = /\b(first|1|one|former|option a)\b/.test(tt) || na.split(" ").filter((w) => w.length > 3).some((w) => tt.includes(w));
        const hitB = /\b(second|2|two|latter|option b)\b/.test(tt) || nb.split(" ").filter((w) => w.length > 3).some((w) => tt.includes(w));
        if (hitA === hitB && !/\b(both|neither)\b/.test(tt)) return idle(g, st);
        st.game = null;
        const choice = /\bboth\b/.test(tt) ? "both" : /\bneither\b/.test(tt) ? "neither" : hitA ? a : b;
        const mine = pick([a, b]);
        const comment = choice === "both" || choice === "neither" ? `Ha, ${choice}? That's cheating! 😄` : pick([`Ooh, ${choice}! Good choice.`, `${U.capitalizeFirst(choice)}? I can see that!`, `Interesting pick!`]);
        return { text: `${comment} I think I'd ${mine}. ${mine === choice ? "Great minds think alike! 🤝" : "We're different, and that's cool!"} Another one?`, expect: { kind: "yesno", yes: "wyr" } };
      }
    }
    return null;
  }
  function idle(g, st) { g.idle = (g.idle || 0) + 1; if (g.idle >= 2) st.game = null; return null; }

  // ---------- time & date ----------
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function timeText() {
    const d = new Date();
    let h = d.getHours(); const mnt = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return `It's ${h}:${mnt} ${ap} right now (your device's time). ⏰`;
  }
  function dateText(t) {
    const d = new Date();
    if (/\byear\b/.test(t) && !/\bday|date|month\b/.test(t)) return `It's ${d.getFullYear()}!`;
    if (/\bmonth\b/.test(t) && !/\bday|date\b/.test(t)) return `It's ${MONTHS[d.getMonth()]}.`;
    return `Today is ${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}. 📅`;
  }
  const HOLIDAYS = { christmas: [11, 25], "new year": [0, 1], "new years": [0, 1], halloween: [9, 31], "valentine": [1, 14], "valentines day": [1, 14], "valentine's day": [1, 14], "april fools": [3, 1] };
  function daysUntil(t, mem) {
    const r = /\bhow (many|long) (days )?(until|till|til|before|to) (christmas|new years?|halloween|valentines? day|valentine's day|april fools|my birthday|the weekend|friday|saturday|summer)\b/.exec(t);
    if (!r) return null;
    const what = r[4];
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let target = null;
    if (HOLIDAYS[what]) { const [mo, da] = HOLIDAYS[what]; target = new Date(now.getFullYear(), mo, da); if (target < today) target.setFullYear(now.getFullYear() + 1); }
    else if (what === "the weekend" || what === "saturday" || what === "friday") {
      const want = what === "friday" ? 5 : 6; const diff = (want - now.getDay() + 7) % 7;
      return diff === 0 ? (what === "the weekend" ? "It IS the weekend! 🎉" : `It's ${U.capitalizeFirst(what)} today! 🎉`) : `${diff} day${diff === 1 ? "" : "s"} until ${what === "the weekend" ? "Saturday" : U.capitalizeFirst(what)}! ${diff <= 2 ? "Almost there! 🎉" : ""}`;
    } else if (what === "summer") { target = new Date(now.getFullYear(), 5, 21); if (target < today) target.setFullYear(now.getFullYear() + 1); }
    else if (what === "my birthday") {
      if (!mem.birthday) return "You haven't told me your birthday yet! When is it? 🎂";
      const bd = parseBirthday(mem.birthday);
      if (!bd) return `Your birthday is ${mem.birthday}, but I couldn't work out the date. 😅`;
      target = new Date(now.getFullYear(), bd[0], bd[1]); if (target < today) target.setFullYear(now.getFullYear() + 1);
    }
    if (!target) return null;
    const days = Math.round((target - today) / 864e5);
    const label = what === "my birthday" ? "your birthday" : U.titleCase(what.replace(/s$/, "").replace("new year", "New Year's Day"));
    return days === 0 ? `It's ${label} today! 🎉` : `${days} day${days === 1 ? "" : "s"} until ${label}! ${days < 7 ? "So soon! 🎉" : "📅"}`;
  }
  function parseBirthday(s) {
    const t = s.toLowerCase();
    const mi = MONTHS.findIndex((mo) => t.includes(mo.toLowerCase()) || t.includes(mo.toLowerCase().slice(0, 3) + " "));
    const dn = /(\d{1,2})/.exec(t);
    return mi >= 0 && dn ? [mi, parseInt(dn[1], 10)] : null;
  }

  // ---------- world capitals ----------
  const CAP = ("Afghanistan:Kabul|Albania:Tirana|Algeria:Algiers|Andorra:Andorra la Vella|Angola:Luanda|Argentina:Buenos Aires|Armenia:Yerevan|" +
    "Australia:Canberra|Austria:Vienna|Azerbaijan:Baku|Bahamas:Nassau|Bahrain:Manama|Bangladesh:Dhaka|Barbados:Bridgetown|Belarus:Minsk|" +
    "Belgium:Brussels|Belize:Belmopan|Benin:Porto-Novo|Bhutan:Thimphu|Bolivia:Sucre (La Paz is the seat of government)|Bosnia and Herzegovina:Sarajevo|" +
    "Botswana:Gaborone|Brazil:Brasília|Brunei:Bandar Seri Begawan|Bulgaria:Sofia|Burkina Faso:Ouagadougou|Burundi:Gitega|Cambodia:Phnom Penh|" +
    "Cameroon:Yaoundé|Canada:Ottawa|Cape Verde:Praia|Central African Republic:Bangui|Chad:N'Djamena|Chile:Santiago|China:Beijing|Colombia:Bogotá|" +
    "Comoros:Moroni|Costa Rica:San José|Croatia:Zagreb|Cuba:Havana|Cyprus:Nicosia|Czech Republic:Prague|Czechia:Prague|Denmark:Copenhagen|Djibouti:Djibouti|" +
    "Dominica:Roseau|Dominican Republic:Santo Domingo|DR Congo:Kinshasa|Democratic Republic of the Congo:Kinshasa|Congo:Brazzaville|Ecuador:Quito|Egypt:Cairo|" +
    "El Salvador:San Salvador|Equatorial Guinea:Malabo|Eritrea:Asmara|Estonia:Tallinn|Eswatini:Mbabane|Ethiopia:Addis Ababa|Fiji:Suva|Finland:Helsinki|" +
    "France:Paris|Gabon:Libreville|Gambia:Banjul|Georgia:Tbilisi|Germany:Berlin|Ghana:Accra|Greece:Athens|Grenada:St. George's|Guatemala:Guatemala City|" +
    "Guinea:Conakry|Guinea-Bissau:Bissau|Guyana:Georgetown|Haiti:Port-au-Prince|Honduras:Tegucigalpa|Hungary:Budapest|Iceland:Reykjavík|India:New Delhi|" +
    "Indonesia:Jakarta|Iran:Tehran|Iraq:Baghdad|Ireland:Dublin|Israel:Jerusalem|Italy:Rome|Ivory Coast:Yamoussoukro|Jamaica:Kingston|Japan:Tokyo|" +
    "Jordan:Amman|Kazakhstan:Astana|Kenya:Nairobi|Kiribati:Tarawa|Kosovo:Pristina|Kuwait:Kuwait City|Kyrgyzstan:Bishkek|Laos:Vientiane|Latvia:Riga|" +
    "Lebanon:Beirut|Lesotho:Maseru|Liberia:Monrovia|Libya:Tripoli|Liechtenstein:Vaduz|Lithuania:Vilnius|Luxembourg:Luxembourg|Madagascar:Antananarivo|" +
    "Malawi:Lilongwe|Malaysia:Kuala Lumpur|Maldives:Malé|Mali:Bamako|Malta:Valletta|Marshall Islands:Majuro|Mauritania:Nouakchott|Mauritius:Port Louis|" +
    "Mexico:Mexico City|Micronesia:Palikir|Moldova:Chișinău|Monaco:Monaco|Mongolia:Ulaanbaatar|Montenegro:Podgorica|Morocco:Rabat|Mozambique:Maputo|" +
    "Myanmar:Naypyidaw|Namibia:Windhoek|Nauru:Yaren (no official capital)|Nepal:Kathmandu|Netherlands:Amsterdam|New Zealand:Wellington|Nicaragua:Managua|" +
    "Niger:Niamey|Nigeria:Abuja|North Korea:Pyongyang|North Macedonia:Skopje|Norway:Oslo|Oman:Muscat|Pakistan:Islamabad|Palau:Ngerulmud|Panama:Panama City|" +
    "Papua New Guinea:Port Moresby|Paraguay:Asunción|Peru:Lima|Philippines:Manila|Poland:Warsaw|Portugal:Lisbon|Qatar:Doha|Romania:Bucharest|Russia:Moscow|" +
    "Rwanda:Kigali|Saint Lucia:Castries|Samoa:Apia|San Marino:San Marino|Saudi Arabia:Riyadh|Senegal:Dakar|Serbia:Belgrade|Seychelles:Victoria|" +
    "Sierra Leone:Freetown|Singapore:Singapore|Slovakia:Bratislava|Slovenia:Ljubljana|Solomon Islands:Honiara|Somalia:Mogadishu|South Africa:Pretoria (executive), Cape Town (legislative) and Bloemfontein (judicial)|" +
    "South Korea:Seoul|South Sudan:Juba|Spain:Madrid|Sri Lanka:Sri Jayawardenepura Kotte (Colombo is the biggest city)|Sudan:Khartoum|Suriname:Paramaribo|" +
    "Sweden:Stockholm|Switzerland:Bern|Syria:Damascus|Taiwan:Taipei|Tajikistan:Dushanbe|Tanzania:Dodoma|Thailand:Bangkok|Timor-Leste:Dili|Togo:Lomé|" +
    "Tonga:Nukuʻalofa|Trinidad and Tobago:Port of Spain|Tunisia:Tunis|Turkey:Ankara|Turkmenistan:Ashgabat|Tuvalu:Funafuti|Uganda:Kampala|Ukraine:Kyiv|" +
    "United Arab Emirates:Abu Dhabi|UAE:Abu Dhabi|United Kingdom:London|UK:London|England:London|Scotland:Edinburgh|Wales:Cardiff|Northern Ireland:Belfast|" +
    "United States:Washington, D.C.|USA:Washington, D.C.|US:Washington, D.C.|America:Washington, D.C.|Uruguay:Montevideo|Uzbekistan:Tashkent|Vanuatu:Port Vila|" +
    "Vatican City:Vatican City|Venezuela:Caracas|Vietnam:Hanoi|Yemen:Sanaa|Zambia:Lusaka|Zimbabwe:Harare|" +
    "California:Sacramento|Texas:Austin|New York:Albany|Florida:Tallahassee|Ontario:Toronto|Quebec:Quebec City|Bavaria:Munich").split("|").map((x) => x.split(":"));
  const capByCountry = new Map(CAP.map(([c, k]) => [c.toLowerCase(), [c, k]]));
  const capByCity = new Map(CAP.map(([c, k]) => [k.split(" (")[0].toLowerCase(), [c, k]]));
  function capital(t) {
    let r = /\bcapital (?:city )?of (?:the )?([a-z .'-]+?)\??$/.exec(t) || /\b([a-z .'-]+?)(?:'s| s) capital\b/.exec(t);
    if (r) {
      const q = r[1].trim().replace(/^the /, "");
      let hit = capByCountry.get(q);
      if (!hit) for (const [k, v] of capByCountry) if (U.levenshtein(k, q, 2) <= (q.length > 6 ? 2 : 1)) { hit = v; break; }
      if (hit) return `The capital of ${hit[0]} is ${hit[1]}. 🏛️`;
      if (/\b(minecraft|the nether|the end)\b/.test(q)) return "Minecraft doesn't have a capital, but I'd vote for the biggest village! 😄";
      return null;
    }
    r = /\b(?:what|which) country is ([a-z .'-]+?) (?:the capital of|in)\b/.exec(t) || /\bis ([a-z .'-]+?) the capital of what\b/.exec(t);
    if (r) { const hit = capByCity.get(r[1].trim()); if (hit) return `${hit[1].split(" (")[0]} is the capital of ${hit[0]}.`; }
    return null;
  }

  // ---------- general knowledge (question variants -> answer) ----------
  const FAQ = [
    [["is the earth flat", "is the world flat", "is the earth round"], "Nope, the Earth is round! (Technically a slightly squished sphere.) We know from photos taken from space, ships disappearing hull-first over the horizon, and the round shadow Earth casts on the Moon during an eclipse. 🌍"],
    [["is a tomato a fruit", "is tomato a fruit or a vegetable"], "Yes! Botanically a tomato is a fruit (a berry, even!), but cooks treat it like a vegetable. 🍅"],
    [["is a whale a fish", "are whales fish"], "Nope! Whales are mammals: they breathe air, are warm-blooded and feed their babies milk. 🐋"],
    [["is a bat a bird", "are bats birds"], "No, bats are mammals! They're the only mammals that can truly fly. 🦇"],
    [["is a spider an insect", "are spiders insects"], "No! Spiders are arachnids: 8 legs instead of 6, and no antennae. 🕷️"],
    [["is pluto a planet"], "Pluto was reclassified as a dwarf planet in 2006, because it hasn't cleared its orbit of other objects. Still a great little world though! 🪐"],
    [["is a peanut a nut", "are peanuts nuts"], "Surprise: peanuts are legumes, like beans and peas, not true nuts! 🥜"],
    [["is a strawberry a berry", "are strawberries berries"], "Funny enough, no! Botanically strawberries aren't berries, but bananas are. 🍓🍌"],
    [["is a banana a berry", "are bananas berries"], "Yes! Botanically a banana is a berry. 🍌"],
    [["is glass a liquid"], "No, glass is an amorphous solid. Old windows are thicker at the bottom because of how they were made, not because the glass flowed. 🪟"],
    [["is the moon made of cheese"], "Sadly no! 🧀 The Moon is made of rock and dust. Astronauts brought back 382 kg of it, and not a single cracker's worth of cheese."],
    [["did we land on the moon", "was the moon landing fake", "is the moon landing real"], "Yes, it was real! 12 astronauts walked on the Moon between 1969 and 1972, and they left reflectors there that scientists still bounce lasers off today. 🌙"],
    [["are dinosaurs real", "did dinosaurs exist"], "Yes! Dinosaurs lived for about 165 million years and went extinct about 66 million years ago (birds are their living relatives!). 🦖"],
    [["is the sun a star"], "Yes! The Sun is a star, a medium-sized yellow one. It only looks special because it's so close to us. ☀️"],
    [["how far is the moon", "distance to the moon", "how far away is the moon"], "The Moon is about 384,400 km (238,900 miles) from Earth on average. 🌙"],
    [["how far is the sun", "distance to the sun", "how far away is the sun"], "The Sun is about 150 million km (93 million miles) away. Its light takes about 8 minutes 20 seconds to reach us! ☀️"],
    [["how many planets are there", "how many planets in the solar system", "list the planets", "what are the planets"], "There are 8 planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. (Pluto became a dwarf planet in 2006.) 🪐"],
    [["what is the biggest planet", "largest planet"], "Jupiter is the biggest planet in our solar system, more than 11 times wider than Earth! 🪐"],
    [["what is the smallest planet", "smallest planet"], "Mercury is the smallest planet, and the closest to the Sun."],
    [["what is the hottest planet", "hottest planet"], "Venus is the hottest planet (about 465°C), even though Mercury is closer to the Sun. Its thick atmosphere traps the heat!"],
    [["how old is the earth", "age of the earth"], "The Earth is about 4.5 billion years old! 🌍"],
    [["how old is the universe", "age of the universe"], "The universe is about 13.8 billion years old. ✨"],
    [["what is the speed of light", "how fast is light"], "Light travels at about 299,792 km per second in a vacuum. That's about 7.5 trips around the Earth every second! ⚡"],
    [["what is the speed of sound", "how fast is sound"], "Sound travels at about 343 meters per second in air at 20°C. 🔊"],
    [["what is the tallest mountain", "highest mountain in the world", "tallest mountain in the world"], "Mount Everest is the highest mountain above sea level, at 8,849 m (29,032 ft). 🏔️"],
    [["what is the longest river", "longest river in the world"], "The Nile and the Amazon are both about 6,400-6,650 km long. Scientists still argue about which one is longer! 🌊"],
    [["what is the biggest ocean", "largest ocean"], "The Pacific Ocean is the biggest, bigger than all the land on Earth put together! 🌊"],
    [["what is the biggest country", "largest country in the world"], "Russia is the biggest country by area, about 17.1 million km². 🗺️"],
    [["what is the smallest country", "smallest country in the world"], "Vatican City is the smallest country, only about 0.44 km²!"],
    [["how many countries are there", "how many countries in the world"], "There are 195 countries: 193 UN members plus 2 observer states (Vatican City and Palestine). 🌍"],
    [["how many continents are there", "what are the continents"], "There are 7 continents: Africa, Antarctica, Asia, Australia (Oceania), Europe, North America and South America."],
    [["how many people are on earth", "world population", "how many people live on earth"], "There are a bit over 8 billion people on Earth. 🌏"],
    [["what is the biggest animal", "largest animal in the world", "biggest animal ever"], "The blue whale is the biggest animal that has ever lived, up to about 30 m long! 🐋"],
    [["what is the fastest animal", "fastest animal in the world"], "The peregrine falcon is the fastest: over 300 km/h when diving! On land it's the cheetah (about 100-120 km/h). 🦅"],
    [["who invented the light bulb", "who invented the lightbulb"], "Thomas Edison made the first practical long-lasting light bulb in 1879, building on work by many others, like Joseph Swan. 💡"],
    [["who invented the telephone", "who made the first phone"], "Alexander Graham Bell got the first patent for the telephone in 1876. ☎️"],
    [["who invented the internet", "who made the internet"], "The internet grew out of ARPANET in the 1960s-70s. Vint Cerf and Bob Kahn created its core protocols (TCP/IP), and Tim Berners-Lee invented the World Wide Web in 1989. 🌐"],
    [["who invented the computer", "who made the first computer"], "Charles Babbage designed the first mechanical computer in the 1830s, and Ada Lovelace wrote the first program for it! Modern electronic computers came in the 1940s. 💻"],
    [["who was the first person on the moon", "first man on the moon", "who walked on the moon first"], "Neil Armstrong was the first person to walk on the Moon, on July 20, 1969 (Apollo 11), followed by Buzz Aldrin. 🌙👨‍🚀"],
    [["who painted the mona lisa"], "Leonardo da Vinci painted the Mona Lisa, in the early 1500s. 🖼️"],
    [["who wrote romeo and juliet"], "William Shakespeare wrote Romeo and Juliet, around 1595. 🎭"],
    [["who discovered gravity", "who discovered gravity with an apple"], "Isaac Newton described the law of universal gravitation in 1687 (the falling apple story is probably exaggerated!). 🍎"],
    [["what is gravity"], "Gravity is the force that pulls things with mass toward each other. It keeps your feet on the ground, the Moon around the Earth and the Earth around the Sun!"],
    [["what is photosynthesis", "how do plants make food"], "Photosynthesis is how plants make food: they use sunlight, water and carbon dioxide to make sugar, and they release oxygen. 🌱☀️"],
    [["what is dna"], "DNA is the molecule that carries the instructions for building and running living things. It's shaped like a twisted ladder (a double helix). 🧬"],
    [["what is the boiling point of water", "at what temperature does water boil"], "Water boils at 100°C (212°F) at sea level."],
    [["what is the freezing point of water", "at what temperature does water freeze"], "Water freezes at 0°C (32°F)."],
    [["what is pi", "what is the value of pi"], "Pi (π) is the ratio of a circle's circumference to its diameter: about 3.14159265358979... and the digits never end or repeat! 🥧"],
    [["how many bones are in the human body", "how many bones do humans have"], "Adults have 206 bones. Babies are born with about 270, and some fuse together as they grow! 🦴"],
    [["how many teeth do humans have", "how many teeth do adults have"], "Adults usually have 32 teeth (including wisdom teeth). Kids have 20 baby teeth. 🦷"],
    [["why is the sky blue"], "The sky is blue because air scatters blue sunlight much more than red light (it's called Rayleigh scattering). At sunset the light travels through more air, so we see more reds and oranges! 🌅"],
    [["why is the ocean salty", "why is the sea salty"], "Rain slowly wears down rocks, and rivers carry the dissolved minerals (like salt) into the ocean. The water evaporates, but the salt stays behind! 🌊"],
    [["what is the capital of the moon"], "The Moon doesn't have a capital, but Tranquility Base (where Apollo 11 landed) would be my pick! 🌙"],
    [["how many days are in a year", "how many days in a year"], "365 days, or 366 in a leap year (every 4 years, except most century years). 📅"],
    [["what is a leap year"], "A leap year has 366 days, with February 29 added. It happens every 4 years, except years divisible by 100 but not by 400 (so 2000 was a leap year, 1900 wasn't)."],
    [["how many hours are in a day", "how many hours in a day"], "24 hours! (Technically Earth spins once every 23 hours 56 minutes relative to the stars.)"],
    [["what is the biggest desert", "largest desert"], "The biggest desert is Antarctica (a desert is a place with very little rain)! The biggest hot desert is the Sahara. 🏜️"],
    [["what is the most spoken language", "most spoken language in the world"], "English has the most speakers in total (native + learners), and Mandarin Chinese has the most native speakers. 🗣️"],
    [["what is the tallest building", "tallest building in the world"], "The Burj Khalifa in Dubai is the tallest building, at 828 m (2,717 ft). 🏙️"],
    [["how many legs does a spider have"], "Spiders have 8 legs! 🕷️ (Insects have 6.)"],
    [["what do cats eat", "what should i feed my cat"], "Cats are carnivores, so they need meat-based cat food. Never give them chocolate, onions, grapes or lilies! 🐱"],
    [["what do dogs eat", "can dogs eat chocolate"], "Dogs eat dog food, and some safe treats like plain carrots or apple slices. Chocolate, grapes, raisins, onions and xylitol are toxic to dogs! 🐶"],
    [["what is the meaning of lol", "what does lol mean"], "LOL means \"laughing out loud\"! 😂"],
    [["what is ai", "what is artificial intelligence"], "AI (artificial intelligence) means computer programs that do things that usually need human intelligence, like understanding language, recognizing pictures or playing games. I'm a very small, simple example! 🤖"],
    [["what is a neural network"], "A neural network is a program made of layers of simple math \"neurons\". It learns patterns by adjusting millions of little numbers (weights) from examples. I have two tiny ones inside me!"],
    [["what is a black hole"], "A black hole is a place where gravity is so strong that nothing, not even light, can escape. They form when giant stars collapse. 🕳️"],
    [["how big is the sun", "how big is the sun compared to earth"], "The Sun is about 109 times wider than Earth, and you could fit around 1.3 million Earths inside it! ☀️"],
    [["how many stars are in the sky", "how many stars are there"], "The Milky Way alone has about 100-400 billion stars, and there are probably over 2 trillion galaxies. On a dark night you can see about 5,000 stars with your eyes. ✨"],
    [["what is the closest star", "nearest star"], "The closest star is the Sun! After that it's Proxima Centauri, about 4.24 light-years away."],
    [["who is the richest person", "richest person in the world"], "That changes all the time with the stock market, so I can't say for sure. I don't have internet access to check! 💰"],
    [["who is the president", "who is the president of the united states", "who is the prime minister"], "Leaders change with elections, and I can't go online to check the latest, so I'd better not guess! 🗳️"],
  ];
  let faqIndex = null;
  function faq(m) {
    if (!faqIndex) { faqIndex = new P.nlp.TfIdf(); FAQ.forEach(([qs], i) => qs.forEach((q) => faqIndex.add(q, i))); }
    const hit = faqIndex.query(m.stems, 1)[0];
    if (!hit || hit.score < 0.72) return null;
    // the key content words of the matched question should all be present
    const need = hit.doc.stems.filter((w) => !P.nlp.STOP.has(w) && w.length > 2);
    if (need.some((w) => !m.stems.includes(w))) return null;
    return FAQ[hit.payload][1];
  }

  // ---------- dictionary (WordNet definitions, loaded in the background) ----------
  let dictMap = null;
  function lookup(word) {
    const blob = P.data && P.data.dictionary;
    if (!blob) return null;
    if (!dictMap) { dictMap = new Map(); for (const line of blob.split("\n")) { const i = line.indexOf("\t"); dictMap.set(line.slice(0, i), line.slice(i + 1)); } }
    const w = word.toLowerCase().trim();
    for (const c of [w, w.replace(/ies$/, "y"), w.replace(/es$/, ""), w.replace(/s$/, ""), w.replace(/^the /, "")]) {
      const e = dictMap.get(c);
      if (e) { const i = e.indexOf("\t"); return { word: c, pos: e.slice(0, i), def: e.slice(i + 1) }; }
    }
    return null;
  }
  function define(m) {
    const t = m.plain.replace(/[?!.]+$/, "").trim();
    const r = /^(?:(what(?:'s| is| are| was| were)|whats|who(?:'s| is| was| are)|whos|define|definition of|meaning of|what(?:'s| is) the meaning of|what does|what do)\s+)(?:a |an |the |some )?([a-z][a-z '-]{1,30}?)(?:\s+mean| means)?$/.exec(t);
    if (!r || /\b(you|your|yours|my|me|i|it|that|this|up|going on|new|wrong|happening|the matter|next|there|here|they|he|she|we|u|ur)\b/.test(r[2])) return null;
    const e = lookup(r[2]);
    if (!e) return null;
    const W = U.capitalizeFirst(/^who/.test(r[1]) ? U.titleCase(e.word) : e.word);
    let text;
    if (e.pos === "v") text = `To ${e.word} means to ${e.def}.`;
    else if (e.pos === "a" || e.pos === "r") text = `${W} means ${e.def}.`;
    else if (/^(a|an|the|any|one) /.test(e.def) && !/^who/.test(r[1])) text = `${U.capitalizeFirst(U.aOrAn(e.word))} ${e.word} is ${e.def}.`;
    else text = pick([`📖 ${W}: ${e.def}.`, `My dictionary says ${W} is: ${e.def}.`]);
    return text.replace(/\.\.$/, ".");
  }

  // ---------- word tools ----------
  function wordTools(m) {
    const t = m.plain, raw = m.clean;
    let r;
    if ((r = /\bhow many (?:letters|characters|chars) (?:are )?(?:there )?in (?:the word |the name )?["']?([a-z'-]+)["']?/i.exec(raw))) {
      const w = r[1].replace(/[^a-z]/gi, "");
      return `"${r[1]}" has ${w.length} letter${w.length === 1 ? "" : "s"}.`;
    }
    if ((r = /\bhow many (?:times (?:does |is )?)?(?:the letter )?["']?([a-z])["']?(?:'s|s)?\b.*?\b(?:in|does) (?:the word )?["']?([a-z'-]+)["']?/i.exec(raw)) && !/^(a|i)$/i.test(r[1]) || (r = /\bhow many ["']?([a-z])["']?(?:'s|s) (?:are )?(?:there )?in (?:the word )?["']?([a-z'-]+)["']?/i.exec(raw))) {
      const letter = r[1].toLowerCase(), word = r[2];
      if (!/^(words?|letters?|times|it|the|a)$/i.test(word)) {
        const n = word.toLowerCase().split("").filter((ch) => ch === letter).length;
        const spelled = word.split("").map((ch) => (ch.toLowerCase() === letter ? ch.toUpperCase() : ch.toLowerCase())).join("-");
        return `There ${n === 1 ? "is" : "are"} ${n} "${letter}"${n === 1 ? "" : "s"} in "${word}": ${spelled}.`;
      }
    }
    if ((r = /\bhow (?:do (?:you|u|i)|to|would you) spell ["']?([a-z'-]+)["']?/i.exec(raw)) || (r = /^spell ["']?([a-z'-]+)["']?[?!.]*$/i.exec(raw))) {
      const w = r[1];
      const fixed = P.nlp.knownWord(w.toLowerCase()) ? w.toLowerCase() : P.nlp.correctWord(w.toLowerCase());
      return `${fixed === w.toLowerCase() ? "" : `I think you mean "${fixed}". `}It's spelled ${fixed.toUpperCase().split("").join("-")}.`;
    }
    if ((r = /\b(?:reverse|say|spell|write) ["']?(.{1,60}?)["']? backwards?\b/i.exec(raw)) || (r = /^reverse ["']?(.{1,60}?)["']?$/i.exec(raw))) {
      return `Backwards: "${[...r[1]].reverse().join("")}" 🔄`;
    }
    if ((r = /^(?:repeat after me|say)[:,]?\s+["']?(.{1,120}?)["']?$/i.exec(raw)) && !/^(hi|hello|something|anything|goodbye|bye|sorry|thanks|a joke|it|that|what|again|yes|no|please)\b/i.test(r[1])) {
      if (/\b(fuck|shit|bitch|stupid|idiot|hate|kill|nazi)\b/i.test(r[1])) return "Hmm, I'd rather not say that one. 😅";
      return `${r[1]}${/[.!?]$/.test(r[1]) ? "" : "!"} 😄`;
    }
    if ((r = /\b(?:pick|choose|give me|generate|think of) (?:a )?random number(?: (?:between|from) (-?\d+) (?:and|to) (-?\d+))?/.exec(t)) || (r = /\b(?:pick|choose) a number (?:between|from) (-?\d+) (?:and|to) (-?\d+)/.exec(t))) {
      let lo = r[1] !== undefined ? parseInt(r[1], 10) : 1, hi = r[2] !== undefined ? parseInt(r[2], 10) : 100;
      if (lo > hi) [lo, hi] = [hi, lo];
      return `🎲 ${lo + Math.floor(U.rand() * (hi - lo + 1))}!`;
    }
    return null;
  }

  // "should I play minecraft or read?", "pizza or burgers?"
  function choose(m, persona) {
    const raw = m.clean.replace(/[?!.]+$/, "");
    const r = /^(?:(?:should i|do i|would you|which is better|what(?:'s| is) better|which one|pick one|choose|you choose|do you prefer|which do you prefer|what do you prefer|do you like|do you love|which do you like(?: more| better)?|what do you like(?: more| better)?|are you team|team)[:,]?\s+)?(.{1,40}?),? or (.{1,40}?)$/i.exec(raw);
    if (!r || m.tokens.length > 14) return null;
    let a = r[1].trim(), b = r[2].trim();
    a = a.replace(/^(to |a |an |the |should i |i should )/i, ""); b = b.replace(/^(to |a |an |the |should i )/i, "");
    if (!a || !b || a.toLowerCase() === b.toLowerCase() || /\b(not|no)$/i.test(b)) return null;
    // Pip's own taste first
    const liked = (x) => persona.likes.some((l) => x.toLowerCase().includes(l));
    const ch = liked(a) && !liked(b) ? a : liked(b) && !liked(a) ? b : pick([a, b]);
    return pick([`I'd go with ${ch}! 😄`, `Hmm... ${ch}! Final answer.`, `${U.capitalizeFirst(ch)}, definitely.`, `My pick: ${ch}! But what do you think?`]);
  }

  P.skills = { capitalsList: CAP, define, lookup, start, gameTurn, askQuestion, daysUntil, capital, faq, wordTools, choose, deal, timeText, dateText };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
