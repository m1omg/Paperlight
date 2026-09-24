// PAPERLIGHT — battle system "Lantern & Hearts"
'use strict';

const Battle = {
  // ---------------------------------------------------------------- setup
  start(troopId, opts = {}) {
    return new Promise(async resolve => {
      const tr = TROOPS[troopId];
      this.troop = tr; this.opts = opts; this.resolveBattle = resolve; this.t = 0; this.turn = 0;
      this.light = opts.light ?? 20; /* the lantern is always a little lit */ this.pops = []; this.parts = []; this.logText = ''; this.menuState = null; this.targeting = null;
      this.prevScene = Game.scene; this.final = !!ENEMIES[tr.enemies[0]].final;
      this.speakStage = 0; this.result = null; this.spoke = false; this.soothedHere = 0; this.reservedItems = {}; this.gameOver = false; this.active = null;
      this.snapshot = JSON.stringify(G.s.actors);
      this.enemies = tr.enemies.map((k, i) => {
        const d = ENEMIES[k];
        return { id: k, d, name: d.name + (tr.enemies.filter(x => x === k).length > 1 ? ' ' + 'ABC'[tr.enemies.slice(0, i).filter(x => x === k).length] : ''),
          hp: d.hp, mhp: d.hp, calm: 0, mcalm: d.calm, atk: d.atk, def: d.def, spd: d.spd, revealed: false, gone: null, mods: {},
          charging: null, intent: null, x: 0, y: 290, flash: 0, shake: 0, alpha: 0, lift: 0, scale: 1, isEnemy: true };
      });
      this.layoutEnemies();
      this.actors = G.partyActors().map(a => ({ a, id: a.id, d: ACTORS[a.id], mods: {}, guard: false, bounce: 0, shake: 0, flash: 0, isEnemy: false,
        get hp() { return a.hp; }, set hp(v) { a.hp = v; }, get name() { return ACTORS[a.id].name; } }));
      // transition
      Audio2.se('encounter');
      this.bgm = tr.bgm || 'battle';
      Audio2.bgm(this.bgm, 10);
      await this.transitionIn();
      Game.scene = this;
      this.intro = 1;
      tween(this, { intro: 0 }, 30);
      for (const e of this.enemies) tween(e, { alpha: 1 }, 30);
      await wait(20);
      if (opts.onStart) await opts.onStart(this);
      this.loop();
    });
  },
  async transitionIn() {
    // swirl of paper strips over the map
    this.trans = 0; Game.transOverlay = this;
    await tween(this, { trans: 1 }, 26, t => t);
    Game.transOverlay = null;
  },
  drawTransition(ctx) {
    const k = this.trans; ctx.save();
    for (let i = 0; i < 12; i++) {
      const y = i * 40, w = W * $.clamp(k * 1.6 - i * 0.05, 0, 1);
      ctx.fillStyle = i % 2 ? '#fbf6ea' : '#efe3c8'; ctx.fillRect(i % 2 ? W - w : 0, y, w, 41);
    }
    ctx.restore();
  },
  layoutEnemies() {
    const alive = this.enemies; const n = alive.length;
    alive.forEach((e, i) => { e.x = W / 2 + (i - (n - 1) / 2) * Math.min(200, 520 / n); });
  },
  aliveEnemies() { return this.enemies.filter(e => !e.gone); },
  aliveActors() { return this.actors.filter(b => !b.a.fallen); },
  actorBoxX(i) { const n = this.actors.length; const w = 150, gap = (W - 24 - n * w) / Math.max(1, n - 1); return n === 1 ? W / 2 - w / 2 : 12 + i * (w + gap); },

  // ---------------------------------------------------------------- main loop
  async loop() {
    while (true) {
      this.turn++;
      await this.turnStart();
      if (this.result) break;
      const actions = await this.commandPhase();
      if (actions === 'run') { if (await this.tryRun()) { this.result = 'run'; break; } else { await this.enemyOnlyTurn(); } }
      else await this.execute(actions);
      if (this.checkEnd()) break;
      this.endTurn();
    }
    await this.finish();
  },
  checkEnd() {
    if (this.result) return true;
    if (this.aliveEnemies().length === 0) { this.result = 'win'; return true; }
    if (this.aliveActors().length === 0) { this.result = 'lose'; return true; }
    return false;
  },
  async turnStart() {
    for (const e of this.aliveEnemies()) {
      if (e.charging) { e.intent = e.charging; e.charging = null; continue; }
      const mv = this.pickMove(e);
      if (mv.tele) { e.intent = { name: '(winding up)', kind: 'charge', move: mv }; }
      else e.intent = mv;
    }
    if (this.final) await this.finalTurnStart();
  },
  pickMove(e) {
    const moves = e.d.moves; let tot = moves.reduce((s, m) => s + m.w, 0), r = Math.random() * tot;
    // hurt or calm-ish enemies act a bit differently: almost-calm enemies hesitate
    if (e.calm / e.mcalm > 0.7 && Math.random() < 0.35) return { name: 'hesitates', kind: 'nothing' };
    for (const m of moves) { if ((r -= m.w) <= 0) return m; }
    return moves[0];
  },
  endTurn() {
    for (const b of [...this.actors, ...this.enemies]) {
      b.guard = false;
      for (const k in b.mods) { if (--b.mods[k].t <= 0) delete b.mods[k]; }
    }
  },

  // ---------------------------------------------------------------- commands
  async commandPhase() {
    const actors = this.aliveActors(); const acts = [];
    let i = 0;
    const tele = this.aliveEnemies().filter(e => e.intent && e.intent.kind === 'charge');
    this.logText = tele.length ? `${tele[0].name} ${tele[0].intent.move.tele}` : this.final ? this.finalHint() : (this.turn === 1 ? `${this.aliveEnemies().map(e => e.name).join(' and ')} ${this.aliveEnemies().length > 1 ? 'appear' : 'appears'}!` : 'What will you do?');
    while (i < actors.length) {
      const b = actors[i]; this.active = b;
      const act = await this.chooseAction(b, i);
      if (act === 'back') { if (i > 0) { i--; acts.pop(); } continue; }
      if (act === 'run') { this.active = null; return 'run'; }
      if (act && act.together) { this.active = null; return [act]; }
      acts.push(act); i++;
    }
    this.active = null;
    return acts;
  },
  commandList(b, idx) {
    const comfortName = this.final && b.id === 'wren' && this.turn >= 2 ? 'SPEAK' : COMFORTS[b.d.comfort].name.toUpperCase();
    const list = [
      { label: 'FIGHT', v: 'fight' },
      { label: comfortName, v: comfortName === 'SPEAK' ? 'speak' : 'comfort' },
      { label: 'SKILLS', v: 'skill' },
      { label: 'ITEMS', v: 'item', enabled: Object.keys(G.s.items).length > 0 },
      { label: 'GUARD', v: 'guard' },
    ];
    if (idx === 0 && this.light >= 100) list.unshift({ label: '★ TOGETHER', v: 'together', special: true });
    else if (idx === 0 && this.opts.canRun !== false && !this.final) list.push({ label: 'RUN', v: 'run' });
    return list;
  },
  async chooseAction(b, idx) {
    while (true) {
      const list = this.commandList(b, idx);
      const bx = this.actorBoxX(this.actors.indexOf(b));
      const pick = await this.menu(list, { x: $.clamp(bx - 2, 8, W - 170), y: 336 - list.length * 28 - 22, w: 154, cancel: idx > 0, memo: 'cmd_' + b.id });
      if (pick === -1) return 'back';
      const v = list[pick].v;
      if (v === 'fight') { const t = await this.pickTarget('enemy', b); if (t) return { b, kind: 'fight', target: t }; }
      else if (v === 'comfort') { const t = await this.pickTarget('enemy', b); if (t) return { b, kind: 'comfort', target: t }; }
      else if (v === 'speak') return { b, kind: 'speak', target: this.enemies[0] };
      else if (v === 'guard') return { b, kind: 'guard', prio: 1 };
      else if (v === 'run') return 'run';
      else if (v === 'together') {
        const p = await this.menu([{ label: 'Paper Storm', v: 0, desc: 'Everyone together! Big damage to every Worry.' }, { label: 'Lullaby', v: 1, desc: 'Everyone together. Calms every Worry a lot.' }], { x: 245, y: 200, w: 170, cancel: true });
        if (p >= 0) return { b, kind: 'together', which: p, together: true, prio: 2 };
      } else if (v === 'skill') {
        const sk = G.skillsOf(b.id);
        const items = sk.map(s => { const d = SKILLS[s]; const cost = d.light ? `${d.light} LIGHT` : `${d.wax} WAX`;
          const ok = d.light ? this.light >= d.light : b.a.wax >= d.wax; return { label: d.name, right: cost, enabled: ok, desc: d.desc, v: s }; });
        const p = await this.menu(items, { x: 150, y: 110, w: 340, cancel: true, memo: 'sk_' + b.id });
        if (p >= 0) { const s = items[p].v; const t = await this.pickTarget(SKILLS[s].target, b); if (t) return { b, kind: 'skill', skill: s, target: t }; }
      } else if (v === 'item') {
        const ids = Object.keys(G.s.items);
        const items = ids.map(id => ({ label: ITEMS[id].name, right: 'x' + G.s.items[id], desc: ITEMS[id].desc, v: id,
          enabled: (G.s.items[id] || 0) - this.reserved(id) > 0 }));
        const p = await this.menu(items, { x: 150, y: 110, w: 340, cancel: true });
        if (p >= 0) { const id = items[p].v; const t = await this.pickTarget(ITEMS[id].target, b); if (t) { this.reserve(id); return { b, kind: 'item', item: id, target: t, prio: 0.5 }; } }
      }
    }
  },
  reservedItems: {},
  reserved(id) { return this.reservedItems[id] || 0; },
  reserve(id) { this.reservedItems[id] = (this.reservedItems[id] || 0) + 1; },

  // generic menu (promise). items: {label, right, enabled, desc}
  menu(items, { x, y, w, cancel = true, memo = null }) {
    return new Promise(res => {
      const idx = memo && this.memo && this.memo[memo] !== undefined ? Math.min(this.memo[memo], items.length - 1) : 0;
      this.menuState = { items, x, y, w, idx, cancel, res, memo };
    });
  },
  pickTarget(kind, b) {
    if (kind === 'self') return Promise.resolve(b);
    if (kind === 'allies' || kind === 'enemies') return new Promise(res => { this.targeting = { kind, all: true, res }; });
    let list;
    if (kind === 'enemy') list = this.aliveEnemies();
    else if (kind === 'ally') list = this.aliveActors();
    else if (kind === 'fallen') { list = this.actors.filter(x => x.a.fallen); if (!list.length) { Audio2.se('buzzer'); return Promise.resolve(null); } }
    if (list.length === 1 && kind === 'enemy') return Promise.resolve(list[0]);
    return new Promise(res => { this.targeting = { kind, list, idx: 0, res }; });
  },
  updateMenus() {
    const m = this.menuState;
    if (m) {
      const n = m.items.length;
      if (Input.rep('up')) { m.idx = (m.idx + n - 1) % n; Audio2.se('cursor'); }
      if (Input.rep('down')) { m.idx = (m.idx + 1) % n; Audio2.se('cursor'); }
      if (Input.pressed('ok')) {
        const it = m.items[m.idx];
        if (it.enabled === false) Audio2.se('buzzer');
        else { Audio2.se('confirm'); this.menuState = null; if (m.memo) { this.memo = this.memo || {}; this.memo[m.memo] = m.idx; } Input.consume(); m.res(m.idx); }
      } else if (Input.pressed('cancel') && m.cancel) { Audio2.se('cancel'); this.menuState = null; Input.consume(); m.res(-1); }
      return;
    }
    const t = this.targeting;
    if (t) {
      if (!t.all) {
        const n = t.list.length;
        if (Input.rep('left') || Input.rep('up')) { t.idx = (t.idx + n - 1) % n; Audio2.se('cursor'); }
        if (Input.rep('right') || Input.rep('down')) { t.idx = (t.idx + 1) % n; Audio2.se('cursor'); }
      }
      if (Input.pressed('ok')) { Audio2.se('confirm'); this.targeting = null; Input.consume(); t.res(t.all ? t.kind : t.list[t.idx]); }
      else if (Input.pressed('cancel')) { Audio2.se('cancel'); this.targeting = null; Input.consume(); t.res(null); }
    }
  },

  // ---------------------------------------------------------------- execution
  async execute(acts) {
    this.reservedItems = {};
    const list = [];
    for (const a of acts) list.push({ ...a, spd: this.stat(a.b, 'spd') + (a.prio || 0) * 1000 + Math.random() * 3 });
    for (const e of this.aliveEnemies()) list.push({ enemy: e, spd: this.stat(e, 'spd') + Math.random() * 3 });
    list.sort((a, b) => b.spd - a.spd);
    for (const act of list) {
      if (this.checkEnd()) return;
      if (act.enemy) { if (!act.enemy.gone) await this.enemyAct(act.enemy); }
      else if (!act.b.a.fallen) await this.actorAct(act);
    }
  },
  async enemyOnlyTurn() { for (const e of this.aliveEnemies()) { if (this.checkEnd()) return; await this.enemyAct(e); } },
  async tryRun() {
    await this.log('You try to run away...', 30);
    if (Math.random() < 0.65) { Audio2.se('whoosh'); await this.log('You got away!', 30); return true; }
    await this.log('...but the Worries are right behind you!', 40); return false;
  },
  stat(b, k) {
    const base = b.isEnemy ? b[k] : b.a[k];
    const m = b.mods[k]; return base * (m ? m.v : 1);
  },
  resolveTargets(t) {
    if (t === 'enemies') return this.aliveEnemies();
    if (t === 'allies') return this.aliveActors();
    if (t && t.isEnemy && t.gone) return this.aliveEnemies().slice(0, 1);
    if (t && !t.isEnemy && t.a && t.a.fallen && t.kindFallen !== true) return [t];
    return [t];
  },
  dmgCalc(att, def, pow, { ignoreDef = false } = {}) {
    let d = this.stat(att, 'atk') * pow * 1.5 - (ignoreDef ? 0 : this.stat(def, 'def') * 0.9);
    d = Math.max(1, d) * $.rand(0.9, 1.1);
    const luck = att.isEnemy ? 4 : att.a.luck;
    const crit = Math.random() * 100 < luck;
    if (crit) d *= 1.5;
    if (def.guard) d *= 0.5;
    if (att.isEnemy) d *= 0.85; // difficulty: Worries hit a little softer
    return { dmg: Math.max(1, Math.round(d)), crit };
  },
  addLight(n) { this.light = $.clamp(this.light + n, 0, 100); },
  async actorAct(act) {
    const b = act.b; b.bounce = 1; tween(b, { bounce: 0 }, 20);
    this.addLight(b.id === 'wren' ? 14 : 7);
    const K = act.kind;
    if (K === 'guard') { b.guard = true; Audio2.se('guard'); await this.log(`${b.name} braces for it.`, 26); return; }
    if (K === 'fight') {
      const t = this.resolveTargets(act.target)[0]; if (!t) return;
      const verb = { wren: 'swings the lantern at', button: 'bonks', moth: 'flutters into' }[b.id];
      await this.log(`${b.name} ${verb} ${t.name}!`, 14);
      await this.hitEnemy(b, t, 1);
      return;
    }
    if (K === 'comfort') {
      const t = this.resolveTargets(act.target)[0]; if (!t) return;
      await this.comfort(b, t, COMFORTS[b.d.comfort], 1);
      return;
    }
    if (K === 'speak') { await this.speak(b); return; }
    if (K === 'together') { await this.together(act.which); return; }
    if (K === 'item') {
      const it = ITEMS[act.item]; if (!G.hasItem(act.item)) { await this.log('...but there are none left.', 24); return; }
      G.removeItem(act.item);
      const ts = act.target === 'allies' ? this.aliveActors() : [act.target];
      await this.log(`${b.name} uses the ${it.name}.`, 18);
      for (const t of ts) {
        if (it.revive) { if (t.a.fallen) { t.a.fallen = false; t.a.hp = Math.round(t.a.mhp * it.revive); Audio2.se('heal'); this.pop(t, 'UP!', PAL.leaf); } continue; }
        if (t.a.fallen) continue;
        if (it.heal) this.healActor(t, it.heal);
        if (it.wax) { t.a.wax = Math.min(t.a.mwax, t.a.wax + it.wax); this.pop(t, '+' + it.wax, PAL.wax); Audio2.se('heal'); }
      }
      await wait(24); return;
    }
    if (K === 'skill') await this.doSkill(b, act.skill, act.target);
  },
  healActor(t, n) { const v = Math.min(t.a.mhp - t.a.hp, n); t.a.hp += v; this.pop(t, '+' + v, PAL.leaf); Audio2.se('heal'); this.sparkle(this.actorCenter(t), '#bfe8a0'); },
  async doSkill(b, s, target) {
    const d = SKILLS[s];
    if (d.light) { if (this.light < d.light) { await this.log('Not enough Light...', 24); return; } this.light -= d.light; }
    else { if (b.a.wax < d.wax) { await this.log(`${b.name} doesn't have enough WAX...`, 24); return; } b.a.wax -= d.wax; }
    const T = this.resolveTargets(target);
    switch (s) {
      case 'illuminate': {
        const t = T[0]; Audio2.se('light'); await this.log(`${b.name} holds up the lantern...`, 20);
        this.glowAt(t.x, t.y - t.d.h / 2); t.revealed = true; await wait(16);
        await this.log(`${t.name} feels {c:${FEELINGS[t.d.feeling].color}}${FEELINGS[t.d.feeling].name}{/c}. ${t.d.blurb}`, 70, true);
        break; }
      case 'glow': Audio2.se('light'); await this.log(`The lantern glows warmly.`, 14); for (const t of this.aliveActors()) this.healActor(t, Math.round(t.a.mhp * 0.15)); this.addLight(10); await wait(20); break;
      case 'scribble': await this.log(`${b.name} scribbles furiously!`, 14); await this.hitEnemy(b, T[0], 1.4, { ignoreDef: true }); break;
      case 'warmth': Audio2.se('shimmer'); for (const t of this.aliveActors()) { t.mods.def = { v: 1.4, t: 3 }; this.pop(t, 'DEF UP', PAL.mustard); } await this.log('Everyone feels warm and safe. Defense up!', 34); break;
      case 'nightlight': Audio2.se('light'); await this.log('A soft nightlight fills the room...', 20);
        for (const t of this.aliveEnemies()) { t.revealed = true; this.addCalm(t, t.mcalm * 0.14, true); } await wait(30); await this.checkSoothed(); break;
      case 'bigbonk': await this.log(`${b.name} winds up a BIG BONK!`, 14); await this.hitEnemy(b, T[0], 1.9); break;
      case 'braveface': b.mods.taunt = { v: 1, t: 3 }; b.mods.def = { v: 1.5, t: 3 }; Audio2.se('guard'); this.pop(b, 'BRAVE!', PAL.red);
        await this.log(`${b.name} puffs up his chest! "Hey, worries! Over HERE!"`, 40); break;
      case 'peptalk': await this.log(`${b.name} gives everyone a big pep talk!`, 20); for (const t of this.aliveEnemies()) await this.comfort(b, t, COMFORTS.cheer, 0.6, true); await this.checkSoothed(); break;
      case 'hophop': await this.log(`${b.name} hops around like crazy!`, 14);
        for (let k = 0; k < 3; k++) { const al = this.aliveEnemies(); if (!al.length) break; await this.hitEnemy(b, $.pick(al), 0.8); } break;
      case 'mend': { const t = T[0]; await this.log(`${b.name} stitches ${t.name} up.`, 14); this.healActor(t, Math.round(t.a.mhp * 0.45)); await wait(20); break; }
      case 'moonbeam': await this.log(`${b.name} calls down a moonbeam!`, 14); Audio2.se('shimmer'); await this.hitEnemy(b, T[0], 1.5, { magic: true }); break;
      case 'wakeup': { const t = T[0]; if (!t.a.fallen) { await this.log(`...but ${t.name} is already awake.`, 30); break; } t.a.fallen = false; t.a.hp = Math.round(t.a.mhp * 0.5); Audio2.se('heal'); this.pop(t, 'UP!', PAL.leaf); await this.log(`${b.name} gently wakes ${t.name} up.`, 30); break; }
      case 'glowdust': Audio2.se('shimmer'); await this.log(`${b.name} scatters glowing dust!`, 14); for (const t of this.aliveActors()) this.healActor(t, Math.round(t.a.mhp * 0.35)); await wait(20); break;
    }
  },
  async hitEnemy(att, t, pow, o = {}) {
    if (!t || t.gone) { t = this.aliveEnemies()[0]; if (!t) return; }
    if (t.d.final) {
      Audio2.se('thud', 0.6); t.shake = 4;
      await this.log($.pick(['The silence swallows the blow. Nothing happens.', 'Hush doesn\'t even notice.', 'It\'s like hitting a pillow made of fog.']), 40);
      return;
    }
    const miss = !att.isEnemy && Math.random() < 0.04;
    if (miss) { Audio2.se('miss'); this.pop(t, 'MISS', '#888'); await wait(20); return; }
    const { dmg, crit } = this.dmgCalc(att, t, pow, { ignoreDef: o.ignoreDef || o.magic });
    t.hp = Math.max(0, t.hp - dmg); t.flash = 1; t.shake = crit ? 10 : 6;
    t.calm = Math.max(0, t.calm - t.mcalm * 0.08);
    Audio2.se(crit ? 'crit' : 'hit'); if (crit) FX.doShake(6);
    this.pop(t, (crit ? 'CRIT! ' : '') + dmg, crit ? PAL.red : '#fff');
    this.scribbleBurst(t.x, t.y - t.d.h / 2, 6);
    await wait(22);
    if (t.hp <= 0) await this.scatter(t);
  },
  async comfort(b, t, c, strength, quiet = false) {
    if (!t || t.gone) { t = this.aliveEnemies()[0]; if (!t) return; }
    const feeling = t.d.feeling;
    const fits = c.fits.includes(feeling) && (c !== COMFORTS.hold || true);
    let frac;
    if (c === COMFORTS.hold) frac = t.revealed ? 0.5 : 0.24;
    else frac = fits ? 0.36 : 0.11;
    frac *= strength * (1 + (b.a.lv - 1) * 0.04) * 1.1; // difficulty: comforting works a little better
    if (t.d.final) frac *= 0.12; // Hush is huge; it takes many small kindnesses
    else if (t.d.boss) frac *= 0.45;
    if (!quiet) {
      const lines = {
        cheer: [`${b.name} cheers! "You can do it!"`, `${b.name} does a silly little dance for ${t.name}.`, `${b.name}: "Hey! You're not so bad, you know!"`],
        listen: [`${b.name} sits down and listens to ${t.name}.`, `${b.name} nods quietly while ${t.name} rambles.`, `${b.name}: "...I'm here. Take your time."`],
        hold: [`${b.name} gives ${t.name} a long, quiet hug.`, `${b.name} holds out a sweater sleeve. ${t.name} holds on.`, `${b.name} stays close to ${t.name}.`],
      }[b.d.comfort];
      await this.log($.pick(lines), 20);
    }
    const bad = !fits && c !== COMFORTS.hold;
    this.addCalm(t, t.mcalm * frac, !bad);
    if (bad && feeling === 'sore') { t.mods.atk = { v: 1.3, t: 2 }; if (!quiet) { Audio2.se('buzzer', 0.5); await this.log(`${t.name} bristles. That wasn't what it needed. (ATK up)`, 36); } }
    else if (bad && !quiet) await this.log(`It helps... a little. ${t.name} needs something else.`, 32);
    else if (!quiet && t.revealed === false && fits && c !== COMFORTS.hold) await this.log(`${t.name} seems to like that!`, 22);
    if (!quiet) await this.checkSoothed();
  },
  addCalm(t, n, good = true) {
    t.calm = Math.min(t.mcalm, t.calm + n);
    Audio2.se('soothe', good ? 0.8 : 0.4, good ? 1 : 0.85);
    this.pop(t, '♥ ' + Math.round(n), PAL.calm);
    this.hearts(t.x, t.y - t.d.h * 0.6, good ? 5 : 2);
  },
  async checkSoothed() {
    for (const t of this.aliveEnemies()) if (t.calm >= t.mcalm && !t.d.final) await this.soothe(t);
  },
  async soothe(t) {
    t.gone = 'soothed'; Audio2.se('soothed');
    this.hearts(t.x, t.y - t.d.h / 2, 14);
    tween(t, { lift: 40, alpha: 0 }, 70);
    await this.log(t.d.soothe, 60);
    G.s.soothed++; G.s.pages++; G.s.soothedKinds[t.id] = (G.s.soothedKinds[t.id] || 0) + 1;
    this.soothedHere = (this.soothedHere || 0) + 1;
  },
  async scatter(t) {
    t.gone = 'scattered'; Audio2.se('scatter');
    this.scribbleBurst(t.x, t.y - t.d.h / 2, 24);
    tween(t, { scale: 0.2, alpha: 0 }, 40);
    await this.log(t.d.boss ? `${t.name} crumbles apart...` : `${t.name} scatters into scribbles.`, 40);
    G.s.scattered++;
  },
  async together(which) {
    this.light = 0; Audio2.se('together'); FX.doFlash('#fff3c9', 0.7);
    for (const b of this.aliveActors()) { b.bounce = 1; tween(b, { bounce: 0 }, 30); }
    if (which === 0) {
      await this.log('Everyone together! PAPER STORM!', 24);
      const pow = 0.9 + this.aliveActors().length * 0.35;
      const lead = this.aliveActors().reduce((a, b) => this.stat(a, 'atk') > this.stat(b, 'atk') ? a : b);
      for (const t of this.aliveEnemies()) { this.hitEnemy(lead, t, pow); }
      await wait(50);
    } else {
      await this.log('Everyone hums together. A lullaby with no words...', 30);
      for (const t of this.aliveEnemies()) this.addCalm(t, t.mcalm * (t.d.final ? 0.2 : 0.55), true);
      await wait(40); await this.checkSoothed();
    }
  },
  // ---------------------------------------------------------------- enemy turn
  async enemyAct(e) {
    const mv = e.intent || this.pickMove(e); e.intent = null;
    if (mv.kind === 'charge') { e.charging = mv.move; e.shake = 3; Audio2.se('heartbeat', 0.6); await this.log(`${e.name} ${mv.move.tele}`, 34); return; }
    if (mv.kind === 'nothing') { await this.log(mv.name === 'hesitates' ? `${e.name} hesitates. It doesn't really want to fight anymore.` : `${e.name} stares off into nothing.`, 34); return; }
    const alive = this.aliveActors(); if (!alive.length) return;
    const taunt = alive.find(b => b.mods.taunt);
    const target = taunt || $.pick(alive);
    e.lift = -12; tween(e, { lift: 0 }, 16);
    if (mv.kind === 'hit' || mv.kind === 'drain') {
      await this.log(`${e.name} uses ${mv.name}!`, 12);
      const d = await this.hurt(e, target, mv.pow);
      if (mv.kind === 'drain' && d) { e.hp = Math.min(e.mhp, e.hp + Math.round(d / 2)); }
    } else if (mv.kind === 'all') {
      await this.log(`${e.name} uses ${mv.name}!`, 12); FX.doShake(5);
      for (const t of alive) this.hurt(e, t, mv.pow, true);
      await wait(34);
    } else if (mv.kind === 'debuff') {
      const names = { atk: 'attack', def: 'defense', spd: 'speed' };
      target.mods[mv.stat] = { v: 0.7, t: 3 }; Audio2.se('buzzer', 0.4); this.pop(target, names[mv.stat].toUpperCase() + ' DOWN', '#8a8ac0');
      await this.log(`${e.name} uses ${mv.name}! ${target.name}'s ${names[mv.stat]} fell.`, 36);
    } else if (mv.kind === 'buff') {
      e.mods[mv.stat] = { v: 1.4, t: 3 }; Audio2.se('guard', 0.5);
      await this.log(`${e.name} uses ${mv.name}! It curls up tighter. (DEF up)`, 34);
    } else if (mv.kind === 'waxdrain') {
      for (const t of alive) { t.a.wax = Math.max(0, t.a.wax - mv.pow); this.pop(t, '-' + mv.pow + ' WAX', PAL.wax); }
      Audio2.se('whoosh'); await this.log(`${e.name} uses ${mv.name}. Everyone's crayons feel heavy. (WAX down)`, 40);
    }
  },
  async hurt(e, t, pow, quiet = false) {
    const { dmg, crit } = this.dmgCalc(e, t, pow);
    const d = Math.min(t.a.hp, dmg);
    t.a.hp -= d; t.shake = 8; t.flash = 1; Audio2.se('hurt'); if (crit) FX.doShake(7);
    this.pop(t, (crit ? 'OUCH! ' : '') + dmg, PAL.hp);
    this.addLight(4);
    if (t.a.hp <= 0) { t.a.hp = 0; t.a.fallen = true; if (!quiet) await wait(10); this.log(`${t.name} fades out...`, 30); Audio2.se('thud'); }
    if (!quiet) await wait(24);
    return d;
  },

  // ---------------------------------------------------------------- final battle special
  finalHint() {
    const hints = ['Hush looms over you. It makes no sound at all.', 'The room is so quiet it hurts.', 'Hush waits. It has always been waiting.',
      'You can hear your own heartbeat.', 'Button squeezes your hand. Moth is trembling, but stays.'];
    if (this.turn >= 2 && this.speakStage === 0) return 'Wren feels something stuck in their throat. (Try SPEAK.)';
    return hints[(this.turn - 1) % hints.length];
  },
  async finalTurnStart() {
    const h = this.enemies[0];
    const helpers = Object.values(G.s.soothedKinds).reduce((a, b) => a + b, 0);
    if (this.turn > 1 && helpers > 0) {
      const kinds = Object.keys(G.s.soothedKinds);
      const k = kinds[(this.turn - 2) % kinds.length];
      await this.log(`A ${ENEMIES[k].name} you soothed drifts in and hums softly beside you.`, 44);
      this.addCalm(h, 8 + Math.min(helpers, 12) * 2, true);
    }
  },
  async speak(b) {
    const h = this.enemies[0];
    const need = [0.2, 0.45, 0.7, 0.95][this.speakStage];
    Audio2.se('heartbeat');
    if (h.calm / h.mcalm < need) {
      await this.log($.pick(['Wren opens their mouth...', 'Wren takes a breath...']), 26);
      await this.log('...but the words get stuck. Hush is still too loud in its silence. (Comfort it more.)', 50);
      this.addLight(10);
      return;
    }
    this.speakStage++;
    if (this.speakStage === 1) Audio2.bgm('speak', 90);
    const lines = [
      ['Wren opens their mouth.', '{s}"..."{/s}', 'A tiny sound comes out. Hush flinches.'],
      ['Wren tries again.', '{s}"I..."{/s}', 'Hush\'s paper edges flutter.'],
      ['Wren\'s voice cracks.', '{s}"I... miss..."{/s}', 'Button and Moth hold on tight.'],
      ['Wren speaks.', '{b}"I MISS HER."{/b}', ''],
    ][this.speakStage - 1];
    for (const l of lines) if (l) await this.log(l, 44, true);
    this.addCalm(h, h.mcalm * 0.06, true); FX.doFlash('#fff', 0.5);
    if (this.speakStage >= 4) { this.result = 'win'; this.spoke = true; }
  },

  // ---------------------------------------------------------------- finish
  async finish() {
    this.menuState = null; this.targeting = null;
    const res = this.result;
    const resolveOuter = this.resolveBattle; // a retry calls start() again, which replaces this.resolveBattle
    if (res === 'win' && !this.final) {
      const exp = Math.round(this.enemies.reduce((s, e) => s + e.d.exp, 0) * 1.15); // difficulty: a bit faster leveling
      const stars = this.enemies.reduce((s, e) => s + (e.gone === 'scattered' ? Math.round(e.d.stars * 1.5) : e.d.stars), 0);
      Audio2.stopBgm(20); Audio2.jingle(this.soothedHere && this.soothedHere === this.enemies.length ? 'soothed' : 'victory');
      G.s.stars += stars;
      const drops = [];
      for (const e of this.enemies) if (Math.random() < (e.d.boss ? 1 : 0.22)) drops.push(e.d.boss ? 'tea' : $.pick(['cookie', 'cookie', 'milk', 'candy']));
      for (const d of drops) G.addItem(d);
      await this.log(`The Worries are gone. Everyone gains ${exp} EXP and finds ${stars} paper stars.`, 80, true);
      if (drops.length) await this.log(`Found: ${drops.map(d => ITEMS[d].name).join(', ')}.`, 50, true);
      const ups = G.gainExp(exp);
      for (const u of ups) {
        Audio2.se('levelup');
        await this.log(`${ACTORS[u.a.id].name} grew to level ${u.a.lv}!` + (u.learned.length ? ` Learned ${u.learned.map(s => SKILLS[s].name).join(', ')}!` : ''), 60, true);
      }
      // fallen members wake up with 1 HP after battle
      for (const a of G.partyActors()) if (a.fallen) { a.fallen = false; a.hp = Math.max(1, Math.round(a.mhp * 0.25)); }
    } else if (res === 'lose') {
      Audio2.bgm('gameover', 30);
      await this.log('Everyone faded out...', 60);
      const c = await this.gameOverChoice();
      if (c === 0) { // retry
        G.s.actors = JSON.parse(this.snapshot); this.reservedItems = {};
        Game.scene = this.prevScene; await wait(1);
        const r = await Battle.start(Object.keys(TROOPS).find(k => TROOPS[k] === this.troop), this.opts);
        resolveOuter(r); return;
      } else { Game.toTitle(); return; }
    } else if (res === 'run') { for (const a of G.partyActors()) if (a.fallen) { a.fallen = false; a.hp = Math.max(1, Math.round(a.mhp * 0.25)); } }
    await FX.fadeOut(20);
    Game.scene = this.prevScene;
    if (res !== 'lose' && !this.final && this.prevScene.map) Audio2.bgm(typeof this.prevScene.map.bgm === 'function' ? this.prevScene.map.bgm() : this.prevScene.map.bgm, 30, true);
    FX.fadeIn(20);
    resolveOuter(res);
  },
  gameOverChoice() {
    this.gameOver = true;
    return this.menu([{ label: 'Try again' }, { label: 'Return to title' }], { x: W / 2 - 90, y: 220, w: 180, cancel: false }).then(r => { this.gameOver = false; return r; });
  },

  // ---------------------------------------------------------------- effects
  async log(text, frames = 40, waitKey = false) {
    this.logText = text; this.logT = 0;
    frames = Math.round(frames * (Settings.textSpeed >= 99 ? 0.5 : Settings.textSpeed >= 2 ? 0.7 : 1));
    let t = 0;
    await until(() => { t++; if (waitKey && t > 12 && Input.pressed('ok')) { Input.consume(); return true; } if (!waitKey && t > 8 && (Input.down('ok') || Input.down('run'))) t += 3; return t >= frames * (waitKey ? 3 : 1); });
  },
  pop(b, text, color) {
    const c = b.isEnemy ? { x: b.x, y: b.y - Math.min(b.d.h, b.y - 50) * 0.6 } : this.actorCenter(b);
    this.pops.push({ text, color, x: c.x + $.rand(-10, 10), y: c.y, t: 0 });
  },
  actorCenter(b) { const i = this.actors.indexOf(b); return { x: this.actorBoxX(i) + 75, y: 380 }; },
  sparkle(c, color) { for (let i = 0; i < 8; i++) this.parts.push({ x: c.x + $.rand(-40, 40), y: c.y + $.rand(-30, 30), vx: 0, vy: -$.rand(0.5, 1.5), t: 0, life: 40, kind: 'star', color }); },
  hearts(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ x: x + $.rand(-40, 40), y: y + $.rand(-30, 30), vx: $.rand(-0.5, 0.5), vy: -$.rand(0.6, 1.8), t: 0, life: 60, kind: 'heart' }); },
  scribbleBurst(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = $.rand(1.5, 4.5); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 30, kind: 'line', rot: a }); } },
  glowAt(x, y) { this.parts.push({ x, y, vx: 0, vy: 0, t: 0, life: 50, kind: 'glow' }); },

  // ---------------------------------------------------------------- update/draw
  update() {
    this.t++;
    this.updateMenus();
    for (const p of this.pops) { p.t++; p.y -= Math.max(0, 1.2 - p.t * 0.03); }
    this.pops = this.pops.filter(p => p.t < 60);
    for (const p of this.parts) { p.t++; p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.96; }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const e of this.enemies) { e.flash *= 0.85; e.shake *= 0.85; }
    for (const b of this.actors) { b.flash *= 0.85; b.shake *= 0.85; }
  },
  draw(ctx) {
    const [sx, sy] = FX.offset();
    ctx.save(); ctx.translate(sx, sy);
    this.drawBg(ctx);
    // enemies
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    // particles
    for (const p of this.parts) this.drawPart(ctx, p);
    ctx.restore();
    // log box
    // (the box grows to fit the text, so nothing gets cut off)
    const logLines = this.logText ? layoutText(ctx, this.logText, W - 70, 21) : [];
    Draw.box(ctx, 16, 10, W - 32, Math.max(62, 14 + logLines.length * 24), { seed: 41 });
    if (logLines.length) drawGlyphLines(ctx, logLines, 36, 36, 24, 21, this.t);
    // light meter
    this.drawLight(ctx);
    // actors
    this.actors.forEach((b, i) => this.drawActor(ctx, b, i));
    // pops
    for (const p of this.pops) { const a = Math.min(1, (60 - p.t) / 15); Draw.text(ctx, p.text, p.x, p.y, { size: 26, align: 'center', color: p.color, shadow: 'rgba(40,20,30,0.8)', bold: true, alpha: a }); }
    // menus
    this.drawMenus(ctx);
    if (this.intro) { ctx.save(); ctx.globalAlpha = this.intro; ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  },
  drawBg(ctx) {
    const im = Assets.get('bb_' + this.troop.bb);
    if (im) { Draw.imgCover(ctx, im, 0, 0, W, H); ctx.fillStyle = 'rgba(255,250,240,0.08)'; ctx.fillRect(0, 0, W, H); }
    else {
      const cols = { meadow: ['#cfe7f6', '#bfe0a4'], forest: ['#1b2440', '#2b3d52'], eraser: ['#f3eee4', '#d9e5c4'], unfinished: ['#f7f4ec', '#e6e1d5'], hush: ['#3b3a44', '#8f8d96'] }[this.troop.bb] || ['#ccc', '#aaa'];
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.2; const r = $.seeded(3);
      for (let i = 0; i < 30; i++) { const x = r() * W, y = 180 + r() * 150; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 + r() * 30, y + (r() - 0.5) * 8); ctx.stroke(); }
      ctx.restore();
    }
    // gentle moving paper motes
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = this.troop.bb === 'forest' || this.troop.bb === 'hush' ? '#f6e3a8' : '#fff';
    for (let i = 0; i < 16; i++) { const x = (i * 97 + this.t * (0.2 + (i % 3) * 0.1)) % W, y = (i * 53 + Math.sin(this.t / 50 + i) * 20 + 60) % 320; ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, 7); ctx.fill(); }
    ctx.restore();
  },
  drawEnemy(ctx, e) {
    if (e.alpha <= 0.01) return;
    const im = enemyImg(e.id);
    const breathe = 1 + Math.sin(this.t / 24 + e.x) * 0.02;
    const sh = e.shake ? $.rand(-e.shake, e.shake) : 0;
    const h = Math.min(e.d.h, e.y - 50) * e.scale;
    ctx.save();
    ctx.globalAlpha = 0.2 * e.alpha; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(e.x, e.y, h * 0.35, 10, 0, 0, 7); ctx.fill();
    ctx.restore();
    Draw.imgBottom(ctx, im, e.x + sh, e.y - e.lift, h, { alpha: e.alpha, sy: breathe, sx: 2 - breathe });
    if (e.flash > 0.05) { ctx.save(); ctx.globalAlpha = e.flash * 0.6 * e.alpha; ctx.globalCompositeOperation = 'lighter'; Draw.imgBottom(ctx, im, e.x + sh, e.y - e.lift, h, { sy: breathe }); ctx.restore(); }
    if (e.gone) return;
    // bars under enemy
    const bw = this.enemies.length >= 3 ? 84 : 110, bx = e.x - bw / 2 - (e.revealed ? 36 : 0), by = e.y + 8;
    const sel = this.targeting && (this.targeting.all ? this.targeting.kind === 'enemies' : this.targeting.list[this.targeting.idx] === e);
    if (!e.d.final) Draw.bar(ctx, bx, by, bw, 9, e.hp / e.mhp, PAL.hp, { seed: 5 });
    Draw.bar(ctx, bx, by + (e.d.final ? 0 : 13), bw, 9, e.calm / e.mcalm, PAL.calm, { seed: 6 });
    Draw.heart(ctx, bx - 9, by + (e.d.final ? 4 : 17), 12, PAL.calm);
    if (sel || e.revealed) Draw.text(ctx, e.name, e.x, by + 40, { size: 18, align: 'center', color: '#fff', shadow: 'rgba(0,0,0,0.7)' });
    if (e.revealed) {
      const f = FEELINGS[e.d.feeling];
      Draw.box(ctx, bx + bw + 6, by - 1, 66, 22, { seed: 2, fill: f.color, lw: 1.5 });
      Draw.text(ctx, f.name, bx + bw + 39, by + 15, { size: 15, align: 'center', bold: true });
      if (e.charging || (e.intent && e.intent.kind === 'charge')) Draw.text(ctx, '⚠ ' + (e.charging || e.intent.move).name, e.x, e.y - h - 10, { size: 18, align: 'center', color: '#ffe38a', shadow: '#000' });
    }
    if (sel) { ctx.save(); ctx.translate(e.x, Math.max(90, e.y - h - 18)); ctx.rotate(Math.PI / 2); Draw.cursor(ctx, 0, 0, this.t); ctx.restore(); }
  },
  drawActor(ctx, b, i) {
    const x = this.actorBoxX(i), y = 342 - b.bounce * 14 + (b.shake ? $.rand(-b.shake, b.shake) : 0);
    const active = this.active === b;
    const sel = this.targeting && (this.targeting.all ? this.targeting.kind === 'allies' : this.targeting.list && this.targeting.list[this.targeting.idx] === b);
    Draw.box(ctx, x, y, 150, 130, { seed: 50 + i, fill: b.a.fallen ? '#d9d4cc' : active ? '#fff7dc' : PAL.paper, lw: active || sel ? 3.5 : 2.5 });
    // portrait
    const a = b.a; const frac = a.hp / a.mhp;
    const faceIdx = a.fallen ? 3 : frac < 0.35 ? (b.id === 'button' ? 2 : 1) : (this.light >= 100 ? (b.id === 'button' ? 0 : 2) : (b.id === 'button' && b.guard ? 1 : 0));
    const im = faceImg(b.d.face, faceIdx);
    ctx.save(); Draw.wobbleRect(ctx, x + 8, y + 8, 66, 66, 9 + i); ctx.fillStyle = '#efe4cc'; ctx.fill(); ctx.clip();
    if (a.fallen) ctx.filter = 'grayscale(1)';
    Draw.imgFit(ctx, im, x + 8, y + 8, 66, 66); ctx.filter = 'none'; ctx.restore();
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.8; Draw.wobbleRect(ctx, x + 8, y + 8, 66, 66, 9 + i); ctx.stroke();
    if (b.flash > 0.05) { ctx.save(); ctx.globalAlpha = b.flash * 0.4; ctx.fillStyle = PAL.red; Draw.wobbleRect(ctx, x, y, 150, 130, 50 + i); ctx.fill(); ctx.restore(); }
    Draw.text(ctx, b.name, x + 80, y + 28, { size: 20, bold: true });
    Draw.text(ctx, 'Lv ' + a.lv, x + 80, y + 48, { size: 16, color: '#7a6a66' });
    if (b.guard) Draw.text(ctx, '🛡', x + 126, y + 48, { size: 16 });
    const st = Object.keys(b.mods).filter(k => k !== 'taunt').map(k => k.toUpperCase() + (b.mods[k].v > 1 ? '↑' : '↓')).join(' ');
    if (st) Draw.text(ctx, st, x + 80, y + 68, { size: 14, color: '#5a4a88' });
    Draw.heart(ctx, x + 16, y + 91, 12, PAL.hp);
    Draw.bar(ctx, x + 26, y + 84, 84, 12, a.hp / a.mhp, PAL.hp, { seed: 11 + i });
    Draw.text(ctx, `${a.hp}`, x + 140, y + 95, { size: 15, align: 'right' });
    ctx.fillStyle = PAL.wax; ctx.fillRect(x + 12, y + 104, 8, 14); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.2; ctx.strokeRect(x + 12, y + 104, 8, 14);
    Draw.bar(ctx, x + 26, y + 105, 84, 12, a.wax / a.mwax, PAL.wax, { seed: 21 + i });
    Draw.text(ctx, `${a.wax}`, x + 140, y + 116, { size: 15, align: 'right' });
    if (a.fallen) Draw.text(ctx, 'FADED', x + 75, y + 50, { size: 26, align: 'center', color: '#8a8a8a', bold: true });
    if (sel) { ctx.save(); ctx.translate(x + 75, y - 10); ctx.rotate(Math.PI / 2); Draw.cursor(ctx, 0, 0, this.t); ctx.restore(); }
  },
  drawLight(ctx) {
    const x = W - 176, y = 104;
    Draw.box(ctx, x, y, 160, 34, { seed: 61, fill: '#2a2640', dark: true, alpha: 0.92 });
    // lantern icon
    const full = this.light >= 100;
    ctx.save(); ctx.fillStyle = full ? '#ffe9a0' : '#f6d36b'; ctx.strokeStyle = '#fff4d6'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x + 18, y + 18, 7, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
    if (full) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + Math.sin(this.t / 6) * 0.3; const g = ctx.createRadialGradient(x + 18, y + 18, 2, x + 18, y + 18, 26); g.addColorStop(0, '#ffd978'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 10, y - 10, 56, 56); }
    ctx.restore();
    Draw.bar(ctx, x + 32, y + 11, 88, 13, this.light / 100, PAL.light, { back: 'rgba(255,255,255,0.15)', seed: 71 });
    Draw.text(ctx, full ? 'FULL' : Math.floor(this.light) + '', x + 150, y + 23, { size: 15, align: 'right', color: '#fff4d6' });
    Draw.text(ctx, 'LIGHT', x + 76, y + 50, { size: 14, align: 'center', color: '#fff', shadow: 'rgba(0,0,0,0.6)' });
  },
  drawMenus(ctx) {
    const m = this.menuState; if (!m) return;
    const rowH = 28, h = m.items.length * rowH + 20;
    let y = m.y; if (y + h > 336 && m.w > 200) y = Math.max(80, 336 - h);
    Draw.box(ctx, m.x, y, m.w, h, { seed: 81 });
    m.items.forEach((it, i) => {
      const col = it.enabled === false ? '#b0a6a0' : it.special ? '#b0761a' : PAL.ink;
      Draw.text(ctx, it.label, m.x + 34, y + 32 + i * rowH, { size: 21, color: col, bold: i === m.idx });
      if (it.right) Draw.text(ctx, it.right, m.x + m.w - 14, y + 32 + i * rowH, { size: 17, color: col, align: 'right' });
    });
    Draw.cursor(ctx, m.x + 26, y + 25 + m.idx * rowH, this.t);
    const desc = m.items[m.idx].desc;
    if (desc) {
      const dl = layoutText(ctx, desc, W - 70, 20);
      Draw.box(ctx, 16, 10, W - 32, Math.max(62, 14 + dl.length * 23), { seed: 41 });
      drawGlyphLines(ctx, dl, 36, 36, 23, 20, this.t);
    }
    if (this.gameOver) Draw.text(ctx, 'Everyone faded out...', W / 2, 190, { size: 34, align: 'center', color: '#fff', shadow: '#000' });
  },
  drawPart(ctx, p) {
    const a = 1 - p.t / p.life;
    if (p.kind === 'heart') { ctx.save(); ctx.globalAlpha = a; Draw.heart(ctx, p.x, p.y, 12, PAL.calm); ctx.restore(); }
    else if (p.kind === 'star') { ctx.save(); ctx.globalAlpha = a; Draw.star(ctx, p.x, p.y, 5, p.color || PAL.gold, p.t / 10); ctx.restore(); }
    else if (p.kind === 'line') { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + Math.cos(p.rot + 1) * 8, p.y + Math.sin(p.rot + 1) * 8, p.x + Math.cos(p.rot) * 14, p.y + Math.sin(p.rot) * 14); ctx.stroke(); ctx.restore(); }
    else if (p.kind === 'glow') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.8; const r = 40 + p.t * 3; const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2); ctx.restore(); }
  },
};
