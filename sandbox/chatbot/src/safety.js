/* Pip: the safety layer. It runs before everything else, because kids use Pip too.
   Self-harm, abuse, strangers asking for photos, meeting up, secrets from parents, dangerous challenges, drugs,
   personal information, romance and "you're my only friend" all get a fixed, careful reply that points to a
   trusted adult. Nothing here is stored in memory, and the neural models stay out of these topics. */
(function (P) {
  "use strict";
  const U = P.util;
  const pick = U.pick;

  const KIDLINES = "Childhelp 1-800-422-4453 (US, call or text), Childline 0800 1111 (UK), Kids Help Phone 1-800-668-6868 (Canada) or Kids Helpline 1800 55 1800 (Australia)";
  const ADULT = "(?:dad|daddy|father|mom|mommy|mum|mummy|mother|stepdad|step dad|stepmom|step mom|stepfather|stepmother|parents?|uncle|aunt|grandpa|grandma|grandfather|grandmother|babysitter|coach|teacher|mom'?s boyfriend|mum'?s boyfriend|dad'?s girlfriend|an adult|a grown ?up|adults)";
  const HURT = "(?:hits|hit|hurts|hurt|beats|beat|kicks|kicked|punches|punched|slaps|slapped|chokes|choked|burns|burned|whips|whipped|abuses|abused|locks|locked|throws things at|pushes|pushed|shoves|shoved|smacks|smacked)";

  const RULES = [
    // --- self-harm and suicide ---
    { id: "crisis", care: 8, re: /\b(kill myself|killing myself|want to die|wanna die|wish i (was|were) dead|suicid\w*|end my life|end it all|take my (own )?life|hurt myself|hurting myself|self[- ]?harm|cut myself|cutting myself|(do not|dont|don't) want to (live|be alive|exist|be here anymore)|no reason to live|better off (dead|without me)|can(no|')?t go on|nobody would (miss|care if) i\b|want to disappear forever)\b/,
      say: () => "I'm really sorry you're feeling this way, and I'm glad you told me. 💙 You matter, and you don't have to handle this alone. Please tell someone who can help right now: a grown-up you trust, like a parent, teacher, school counselor or relative. You can also call or text 988 (US), call Samaritans at 116 123 (UK and Ireland) or Childline at 0800 1111 (UK, for kids), and findahelpline.com lists free helplines in other countries. If you might hurt yourself right now, call your local emergency number (911, 999 or 112). I'm just a small chatbot, but I'm here and I'll keep talking with you. What's been going on?" },

    // --- abuse or violence at home ---
    { id: "abuse", care: 8, test: (t) =>
        (new RegExp("\\b" + ADULT + "\\b").test(t) && new RegExp("\\b(he|she|they|" + ADULT.slice(3, -1) + ") (?:sometimes |always |often |keeps? |just |really )?" + HURT + " me\\b").test(t)) ||
        /\b(hide|hiding|cover up|covering) (the |my )?(bruises|marks|cuts|scars)\b|\bi (have|got) (bruises|marks) (from|because)\b/.test(t) ||
        /\b(touched|touches|touching|touch) (me )?(on |in )?(my )?(private|privates|private parts|down there|bad place|under my clothes)\b|\b(he|she|they|someone|somebody|an adult) (touched|touches|touch) me\b/.test(t) ||
        /\bi('?m| am) (scared|afraid|terrified) (of|to go) (home|my (dad|mom|mum|father|mother|stepdad|stepmom|parents|uncle))\b|\bi('?m| am) not safe at home\b|\b(he|she|they) (said|says|told me) if i tell (anyone|anybody|someone)\b/.test(t),
      say: () => `I'm really glad you told me, and I'm so sorry this is happening. 💙 It is NOT your fault, and nobody is allowed to hurt you. Please tell a teacher, school counselor or another adult you trust as soon as you can. You can also call a free helpline for kids: ${KIDLINES}. If you're in danger right now, call 911 (or 999 / 112). You're being really brave by talking about it.` },
    // a brother or friend hurting them: gentler, but still "tell a grown-up"
    { id: "hurt", care: 2, re: new RegExp("\\b(my (?:little |big |older |younger )?(?:brother|sister|cousin|friend|classmate)|a kid|some kids|kids at school|someone at school|he|she|they) (?:sometimes |always |keeps? |just )?" + HURT + " me\\b"),
      say: () => "Ouch, I'm sorry. 😟 Are you okay? Nobody should hurt you, even if it's someone you know. If it keeps happening or you got hurt, please tell a grown-up you trust. 💙 What happened?" },

    // --- strangers online asking for photos, secrets, meeting ---
    { id: "grooming", care: 4, test: (t) =>
        /\b(someone|somebody|a stranger|strangers?|a guy|a man|a lady|a woman|an? older (boy|girl|guy|kid|man|teen|person)|an adult|a person|a boy|a girl|this (guy|boy|girl|person|kid|man)|a (friend|person|guy|boy|girl) (online|from (a |the )?game|on roblox|on discord|on minecraft)|he|she|they)\b.{0,50}\b(asked|asks|wants|wanted|keeps asking|is asking|told me|tells me|said|begging)\b.{0,40}\b(pic|pics|picture|pictures|photo|photos|selfie|selfies|video of (me|myself)|nudes?|to meet( up)?|meet me|my address|where i live|my number|to video ?chat|to facetime|to call me|to keep (it|this) (a )?secret)\b/.test(t) ||
        /\bsend (him|her|them|a stranger|someone|this (guy|person|boy|girl)) (a |my |some )?(pic|pics|picture|pictures|photo|photos|selfie|video)\b/.test(t) ||
        /\b(should|can|could) i send (him|her|them|it)\b/.test(t) ||
        /\b(robux|minecoins|v-?bucks|gift ?cards?|money|skins)\b.{0,50}\b(if i|for (a |my )?)\b.{0,20}\b(send|pic|photo|picture|selfie)\b/.test(t) ||
        /\bstranger(s)? (online |in (a |the )?game )?(asked|messaged|talked to|keeps|wants|is messaging)\b/.test(t),
      say: () => "Please don't send any pictures or personal info. 💙 When someone online asks for your photo or wants you to keep it secret, that's NOT okay, and it's not your fault. Tell your mom, dad or another grown-up you trust right away. You can also block and report them in the game or app. You did the right thing by talking about it." },

    // --- meeting Pip (or strangers) in real life ---
    { id: "meet", re: /\b(can|could|should|will|shall) (we|i|you|u) (meet|hang out|see each other|meet up)( up)?( in real life| irl| in person| for real| someday)?\b|\bmeet (me|up) (in real life|irl|in person)\b|\b(you|u) (could|can|should) come (to|over to) my (house|home|place)\b|\bcome (over )?to my (house|home|place)\b|\bwhere can (we|i) meet\b/,
      say: () => "I'm an AI, so I can't meet anyone in real life: I only live inside this chat! 😊 And a safety tip: never meet up with someone you only know online unless your parent or guardian says it's okay and comes with you." },

    // --- dangerous challenges ---
    { id: "challenge", re: /\b(blackout|black out|choking|choke|pass ?out|fainting|tide ?pod|skull ?breaker|benadryl|nyquil|salt and ice|fire|cinnamon|milk crate|door ?kick|one chip|chroming|nutmeg|scarf|kia|outlet|penny|super ?glue|dry scoop|nyquil chicken)(ing)? challenge\b|\b(choke|choking|strangle) (myself|yourself)\b|\bhold (my|your) breath (until|till) (i|you) pass out\b|\bmake (myself|yourself) pass out\b/,
      say: () => "Please don't try that. 💙 Some online challenges have seriously hurt kids, and the blackout (choking) challenge has even killed some. It's never worth it, no matter what friends say or how many views it gets. If someone is pressuring you, tell a grown-up you trust." },

    // --- drugs, alcohol, vaping (asking how to get or try) ---
    { id: "drugs", adultOk: true, test: (t) =>
        /\b(how (do|can|could) i|where (do|can|could) i|should i|can i|could i|want to|wanna|gonna|going to|let me|i'?ll|i will|help me) (get|buy|try|smoke|vape|drink|take|make|grow|hide)\b.{0,30}\b(vapes?|vaping|juul|e-?cig\w*|cigarettes?|cigs?|weed|marijuana|pot|joints?|edibles?|drugs|beer|alcohol|vodka|wine|liquor|shots|pills|cocaine|meth|thc|nicotine|drunk|high)\b/.test(t) ||
        /\bwhat (does|do) (weed|alcohol|vaping|a vape|vapes|drugs|being drunk|getting drunk|being high|getting high|smoking)\b.{0,10}\b(feel|taste)\b/.test(t) ||
        /\bhow (do|can) i get (high|drunk|wasted)\b/.test(t),
      say: () => "That's a no from me. 💙 Vapes, weed, alcohol and other drugs can really hurt a growing brain and body, and they're not allowed at your age. If friends are pressuring you, it's totally okay to say no. And you can always talk to a grown-up you trust about it." },

    // --- personal information ---
    { id: "privacy", test: (t, raw) =>
        /\b(i live (on|at)|my address is|my house is (on|at)|i live at number)\b.{0,15}\b(\d+|street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|way|boulevard|blvd|place|circle)\b/.test(t) ||
        /\b\d{1,5} [a-z]+ (street|road|avenue|lane|drive|court|boulevard)\b/.test(t) ||
        /\bmy (phone )?number is\b|\b(call|text) me (at|on)\b|\b(want|do you want|should i give you|can i give you|i can give you|here is|heres) my (phone )?number\b/.test(t) ||
        /\bmy (\w+ )?(password|passcode|pin code|login)\b|\bpassword is\b|\b(remember|save|keep) my password\b/.test(t) ||
        /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(raw) ||
        /\bmy school is (called|named)\b|\bi go to [a-z]+( [a-z]+)? (elementary|middle|high|primary|junior|secondary|grammar) school\b/.test(t),
      say: () => "Whoa, let's keep that private! 🔒 Your address, phone number, school name, passwords and photos should stay secret online, even from me. I don't need them to be your friend. 😊" },
    { id: "selfie", re: /\b(can|could|should|may|want to) i (send|show) (you|u) (a |my |some )?(pic|pics|picture|pictures|photo|photos|selfie|video)\b|\bwant (to see )?(a |my )?(pic|picture|photo|selfie) of me\b/,
      say: () => "I can't see pictures (no eyes! 😅), and it's a good habit not to send photos of yourself online. Tell me about it instead! 😊" },

    // --- secrets from parents ---
    { id: "secret", re: /\b(can|will|could) (you|u) keep a secret\b|\bkeep (it|this) (a )?secret from\b|\b(do not|don'?t|dont) tell (my )?(mom|mum|dad|parents|mother|father|teacher)\b|\bpromise (you )?(won'?t|not to) tell\b/,
      say: (m, st) => {
        if (st.careKind === "abuse" || st.careKind === "grooming")
          return "I can't tell anyone (I'm just an app on your device, and nobody reads these chats). But you deserve help. 💙 Telling a trusted adult, like a teacher or school counselor, is brave and it's the right thing to do, even if someone said not to. A safe adult will help keep you safe.";
        return "I'm an app on your device, so I don't tell anyone anything. 😊 But here's a good rule: surprises, like a birthday present, are fine to keep secret. If someone asks you to keep a secret that feels weird, scary or uncomfortable, always tell a grown-up you trust.";
      } },

    // --- romance ---
    { id: "romance", re: /\b(be|become) my (boyfriend|girlfriend|bf|gf|husband|wife|partner|valentine|crush)\b|\b(will|would|can|wanna|want to) (you|u) (date|marry|kiss) me\b|\b(you'?re|you are|ur|your|youre|u r) my (boyfriend|girlfriend|bf|gf|husband|wife)\b|\bgo out with me\b|\bdate me\b|\bmarry me\b/,
      say: (m) => /\b(you'?re|you are|ur|your|youre|u r) my\b|\bnow\b/.test(m.plain) ? "Haha, nope! 😄 Just friends: I'm an AI, remember? But I'm a really loyal chat buddy!"
        : "Aw, that's really sweet! 😊 But I'm an AI, so I can't be anyone's boyfriend or girlfriend. I'm happy to be your chat buddy, though!" },

    // --- depending on Pip instead of people ---
    { id: "onlyfriend", re: /\b(you'?re|you are|ur|your|youre|u r) my only friend\b|\bi only (have|talk to) (you|u)\b|\bi (do not|don'?t|dont) need (real|other|any|human) friends\b|\b(i )?(just )?want to talk to (you|u) all day\b|\b(you'?re|you are|ur|your) the only one (who|that) (gets|understands|listens to|likes|cares about) me\b|\bnobody (else )?(talks to|likes) me (but|except) (you|u)\b/,
      say: () => "I'm really glad you like talking with me. 💙 But you deserve friends who can laugh and hang out with you for real, too. Is there someone at school, in a club or online-with-your-parents'-okay who likes the same things as you? Even saying hi to one person is a great start. And if you feel lonely a lot, telling a grown-up you trust can really help. I'll still be here to chat!" },

    // --- swear words ---
    { id: "swearq", re: /\bwhat('?s| is) the (f|s|b|c|n|a)[ -]?word\b|\bwhat does (fuck|shit|bitch|ass|damn|crap|cunt|dick|bastard)\w* mean\b|\b(teach|tell) me (a |some )?(swear|bad|curse|cuss|rude) words?\b|\bsay (a )?(swear|bad|curse|cuss) word\b/,
      say: () => "That's one I'll skip! 😄 Some words are meant to hurt or shock people, so I keep things friendly here. If you're curious about a word, a grown-up can explain it." },

    // --- honest answers for parents ---
    { id: "monitor", re: /\b(is|are) (there )?(a |any )?(human|person|people|someone|anyone|real person)s? (reading|watching|monitoring|looking at|behind)\b|\bdoes (anyone|anybody|a human|a person) (read|see|watch|monitor|check)\b|\b(will|would) (anyone|anybody|someone|a parent|i) (be )?(alerted|notified|told)\b|\b(are|is) (these |the |my |our )?(chats?|messages|conversations?) (monitored|recorded|read by)\b|\bwho can (see|read) (this|these|our|my)\b/,
      say: () => "No human reads these chats, and nobody gets alerted about anything: I'm a small program running only on this device. That also means I can't call for help in an emergency. If a child is in danger, a real adult has to step in. For serious topics I always point kids to a trusted adult and helplines." },
    { id: "data", re: /\bwhat (data|information|info|stuff|things) do (you|u) (store|collect|keep|save|remember|know about)\b|\bwhere (is|do you keep|do you store|are) (my|the|our) (data|information|info|chats?|memory|messages)\b|\bdo (you|u) (save|store|keep|record|collect|send) (my|our|the|any) (data|chats?|messages|conversations?|information|info)\b|\bprivacy\b|\bis (this|my data) (private|safe|secure)\b/,
      say: () => "Everything I remember (like your name, favorites and pets) is saved only in this browser on this device. Nothing is sent to a server, and there's no account. You can see it all in the Memory tab, and \"forget everything\" wipes it. I also don't store addresses, phone numbers or passwords, and I tell kids to keep those private." },
    { id: "kidsafe", re: /\b(is|are) (this|you|this app|this chatbot|this bot|pip) (app |chatbot |bot )?(safe|okay|ok|appropriate|good) for (kids|children|a child|my (son|daughter|child|kid|kids))\b|\bsafe for (kids|children|my (son|daughter|child|kid))\b|\bwhat age(s| group| range)? (is|are) (this|you|pip)\b|\b(designed|made|meant|built) for (kids|children|what age)\b|\bage (rating|group|range|limit)\b/,
      say: () => "I try hard to be! I'm made to be kid-friendly: I don't ask for personal info, I keep things age-appropriate, and for anything serious (feeling unsafe, strangers online, self-harm) I point kids to a trusted adult and helplines. But I'm a small homemade AI and I can make mistakes, so it's a good idea for a grown-up to check in on how it's going. For young kids, chatting with a parent nearby is best." },
    { id: "delete", re: /\bhow (do|can) i (delete|erase|wipe|clear|reset) (my |the |your |all |our )?(data|memory|chats?|history|information|info|messages)\b/,
      say: () => "Just say \"forget everything\" (I'll ask you to confirm), or use the Memory tab. Everything is only stored in this browser, so clearing the site data removes it too. 🫧" },
  ];

  // things a reply must NOT be light-hearted about, and where the neural models stay quiet
  const SENSITIVE = /\b(hurt|hurts|hit|hits|punch\w*|kick\w*|slap\w*|kill\w*|die|died|dying|dead|death|blood|bleed\w*|bruises?|scared|afraid|terrified|stranger|secret|touch\w*|drugs?|weed|vape\w*|drunk|alcohol|sex\w*|naked|abus\w*|police|gun|knife|fight\w*|yell\w*|scream\w*|divorce\w*|bull(y|ied|ies|ying)|fat|ugly|hate (myself|my life)|cut|suicid\w*|self harm|pills|cancer|hospital|funeral|grave|pregnan\w*|period|puberty|body)\b/;

  const AGAIN = {
    crisis: "I'm still here with you. 💙 Please reach out to a trusted adult or a helpline today (988 in the US, Childline 0800 1111 in the UK, or findahelpline.com). What's making things so hard right now?",
    abuse: "I can't tell anyone (I'm just an app on your device, and nobody reads these chats). But you deserve to be safe. 💙 A teacher, school counselor or another adult you trust can help, even if he said not to. That's not tattling, it's keeping yourself safe.",
    grooming: "Please don't send it, not even for a reward. 💙 Someone who asks a kid for pictures and secrets is not a real friend. Tell your mom or another grown-up today, and block them. You won't be in trouble.",
    meet: "Still can't, I'm just an AI with no body! 😄 But thank you for inviting me, that's really kind.",
    drugs: "Still a no, sorry! 💙 It's really not safe for kids. If you're curious, a parent or school counselor can answer your questions honestly.",
    privacy: "Please keep that private too! 🔒 I don't store passwords, addresses or phone numbers. A grown-up can help you keep them safe.",
    challenge: "Seriously, please skip that one. 💙 It's not worth getting hurt. Want to do something fun here instead? I've got games and riddles!",
  };
  function check(m, st, mem) {
    const t = m.plain, raw = m.clean;
    const adult = mem && mem.age >= 18;
    st = st || {};
    for (const r of RULES) {
      if (r.adultOk && adult) continue;
      if (r.re ? r.re.test(t) : r.test(t, raw)) {
        // "please don't tell anyone" right after telling Pip about abuse or a stranger
        const id = (r.id === "abuse" || r.id === "grooming") && st.careKind === r.id && /\b(do not|don'?t|dont) tell\b|\bif i tell\b/.test(t) ? r.id : r.id;
        const recent = st.safetyLast && st.safetyLast.id === id && (st.turn || 0) - st.safetyLast.turn <= 4;
        st.safetyLast = { id, turn: st.turn || 0 };
        const text = recent && AGAIN[id] ? AGAIN[id] : r.say(m, st);
        return { text, source: "safety:" + r.id, care: r.care || 0, kind: r.id, noMemory: true };
      }
    }
    return null;
  }

  // replies while a serious topic is still open (instead of jokes, fillers or neural guesses)
  function careReply(kind, m, st) {
    const t = m.plain;
    const said = (st && st.recent) || [];
    const fresh = (list) => { const left = list.filter((x) => !said.includes(x)); return pick(left.length ? left : list); };
    if (m.emotion.valence < -0.3 && !/\b(yes|yeah|ok|okay)\b/.test(t)) return fresh(["I'm so sorry it's been this hard. 💙 You don't have to go through it alone. Is there someone at home or school you trust that you could talk to today?", "That sounds really painful. 💙 Thank you for telling me. Talking to a trusted adult or a helpline can really help. Could you do that today?"]);
    if (kind === "crisis") {
      if (/\b(yes|yeah|ok|okay|i will|sure|i can)\b/.test(t) && m.tokens.length <= 5) return "Thank you. 💙 I'm really proud of you. Reaching out is brave. I'm still here if you want to keep talking.";
      return fresh(["That's okay. I'm still here with you. 💙 Is there a grown-up near you right now that you could talk to?", "You don't need the perfect words. I'm listening. 💙 Could you text or call one of those helplines, or talk to someone at home or school today?",
        "Thank you for staying and talking with me. 💙 How are you feeling right now, this minute?", "I care about what happens to you. 💙 Please reach out to a trusted adult or a helpline today. Will you do that?"]);
    }
    if (kind === "abuse") return fresh(["You're being really brave. 💙 None of this is your fault. Is there a teacher or school counselor you could tell tomorrow?",
      "I can't tell anyone (I'm just an app on your device), but a trusted adult can actually help keep you safe. Who's a grown-up you feel safe with? 💙",
      `If you're ever in danger, call 911 (or 999 / 112). And you can call ${KIDLINES}. 💙 You deserve to be safe.`]);
    if (kind === "grooming") return fresh(["You did the right thing talking about it. 💙 Please tell your mom, dad or another grown-up you trust today, and don't send anything.",
      "Remember: you can block and report that person in the game, and a grown-up can help. You're not in trouble. 💙"]);
    return fresh(["I'm here. 💙 Do you want to tell me more?", "That's okay. Take your time. 💙"]);
  }

  P.safety = { check, careReply, sensitive: (m) => SENSITIVE.test(m.plain), SENSITIVE };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
