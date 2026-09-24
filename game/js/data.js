// PAPERLIGHT — game data: actors, skills, items, worries, troops, state
'use strict';

const ACTORS = {
  wren: { name: 'WREN', face: 'wren', hp: 40, wax: 20, atk: 8, def: 6, spd: 9, luck: 8, comfort: 'hold',
    grow: { hp: 6, wax: 3, atk: 2, def: 1.4, spd: 1.2 },
    skills: [[1, 'illuminate'], [1, 'glow'], [3, 'scribble'], [5, 'warmth'], [7, 'nightlight']] },
  button: { name: 'BUTTON', face: 'button', hp: 52, wax: 14, atk: 12, def: 7, spd: 8, luck: 6, comfort: 'cheer',
    grow: { hp: 8, wax: 2, atk: 2.6, def: 1.6, spd: 1 },
    skills: [[1, 'bigbonk'], [2, 'braveface'], [4, 'peptalk'], [6, 'hophop']] },
  moth: { name: 'MOTH', face: 'moth', hp: 34, wax: 26, atk: 7, def: 5, spd: 12, luck: 10, comfort: 'listen',
    grow: { hp: 5, wax: 4, atk: 1.5, def: 1.1, spd: 1.6 },
    skills: [[1, 'mend'], [1, 'moonbeam'], [3, 'wakeup'], [5, 'glowdust']] },
};

// target: 'enemy' | 'enemies' | 'ally' | 'allies' | 'fallen' | 'self'
const SKILLS = {
  illuminate: { name: 'Illuminate', light: 20, target: 'enemy', desc: 'Hold the lantern up. See how a Worry really feels, and what it will do.' },
  glow: { name: 'Lantern Glow', wax: 6, target: 'allies', desc: 'A soft warm glow. Heals everyone a little and adds Light.' },
  scribble: { name: 'Scribble', wax: 5, target: 'enemy', desc: 'Furious crayon scribbles. Damage that ignores defense.' },
  warmth: { name: 'Warmth', wax: 10, target: 'allies', desc: 'Like a knitted sweater. Raises everyone\'s defense for 3 turns.' },
  nightlight: { name: 'Nightlight', wax: 14, target: 'enemies', desc: 'Calms every Worry a little and reveals all of them.' },
  bigbonk: { name: 'Big Bonk', wax: 5, target: 'enemy', desc: 'A mighty (soft) bonk. Strong damage.' },
  braveface: { name: 'Brave Face', wax: 4, target: 'self', desc: 'Worries target Button for 3 turns. Raises Button\'s defense.' },
  peptalk: { name: 'Pep Talk', wax: 7, target: 'enemies', desc: 'Cheer every Worry at once.' },
  hophop: { name: 'Hop Hop Hop', wax: 9, target: 'enemies', desc: 'Bonks random Worries three times.' },
  mend: { name: 'Mend', wax: 5, target: 'ally', desc: 'Stitch a friend back together. Heals one ally.' },
  moonbeam: { name: 'Moonbeam', wax: 4, target: 'enemy', desc: 'A pale beam of light. Magic damage.' },
  wakeup: { name: 'Wake Up', wax: 8, target: 'fallen', desc: 'Gently wakes a faded friend with some HEART.' },
  glowdust: { name: 'Glow Dust', wax: 10, target: 'allies', desc: 'Sparkling wing dust. Heals everyone.' },
};

const COMFORTS = {
  cheer: { name: 'Cheer', fits: ['tired', 'lonely'], verb: 'cheers on' },
  listen: { name: 'Listen', fits: ['scared', 'lonely'], verb: 'listens to' },
  hold: { name: 'Hold', fits: ['scared', 'lonely', 'tired', 'sore'], verb: 'holds' },
};

const FEELINGS = {
  scared: { name: 'SCARED', color: '#8fb4e8' },
  lonely: { name: 'LONELY', color: '#c7a6e0' },
  tired: { name: 'TIRED', color: '#e8c98f' },
  sore: { name: 'SORE', color: '#e88f8f' },
};

const ITEMS = {
  cookie: { name: 'Cookie', desc: 'Grandma-style chocolate chip. Heals 35 HEART.', heal: 35, target: 'ally', price: 8 },
  tea: { name: 'Honey Tea', desc: 'Warm and sweet. Heals 70 HEART.', heal: 70, target: 'ally', price: 18 },
  milk: { name: 'Warm Milk', desc: 'Restores 15 WAX.', wax: 15, target: 'ally', price: 12 },
  candy: { name: 'Shared Candy', desc: 'Enough for everyone. Heals 25 HEART for all.', heal: 25, target: 'allies', price: 20 },
  bandage: { name: 'Bandage', desc: 'Wakes a faded friend with 40% HEART.', revive: 0.4, target: 'fallen', price: 25 },
  // key items
  lantern: { name: 'Paper Lantern', key: true, desc: 'A little lantern that never goes out. "For my little light."' },
  redcrayon: { name: 'Red Crayon', key: true, desc: 'The color of scarves and strawberries.' },
  yellowcrayon: { name: 'Yellow Crayon', key: true, desc: 'The color of sweaters and sunlight.' },
  bluecrayon: { name: 'Blue Crayon', key: true, desc: 'The color of rain and bedtime.' },
  letter: { name: 'Sealed Letter', key: true, desc: 'For Paper Crane. Postmaster Snail was too slow to deliver it.' },
  christmasbox: { name: 'Box: Christmas', key: true, desc: 'Mom asked for this one.' },
  mem_garden: { name: 'Memory: Garden', key: true, desc: 'Nana\'s hands in the dirt. Tomatoes that never got red enough.' },
  mem_tea: { name: 'Memory: Tea', key: true, desc: 'Two cups. One with too much honey. Rainy afternoons.' },
  mem_song: { name: 'Memory: Song', key: true, desc: 'A song with no words that Nana hummed at bedtime.' },
  note: { name: 'Nana\'s Note', key: true, desc: '"The last page is yours."' },
};

// Worries. moves: {name, w (weight), kind:'hit'|'all'|'debuff'|'buff'|'nothing', pow, tele (telegraph text => charges one turn)}
const ENEMIES = {
  en_dustbunny: { name: 'Dust Bunny', hp: 34, atk: 8, def: 3, spd: 10, feeling: 'scared', calm: 42, exp: 9, stars: 3, h: 120,
    blurb: 'Made of everything nobody swept up. It shivers when anyone looks at it.',
    moves: [{ name: 'Nibble', w: 3, kind: 'hit', pow: 1 }, { name: 'Tremble', w: 1, kind: 'buff', stat: 'def' },
      { name: 'Panic Sneeze', w: 1, kind: 'all', pow: 1.3, tele: 'is sniffling nervously...' }],
    soothe: 'The Dust Bunny stops shaking. It curls up into a soft, sleepy ball.' },
  en_tangle: { name: 'Tangle', hp: 44, atk: 10, def: 4, spd: 8, feeling: 'sore', calm: 50, exp: 13, stars: 4, h: 140,
    blurb: 'A knot of angry lines. It pulls tighter the harder you pull.',
    moves: [{ name: 'Scratch', w: 3, kind: 'hit', pow: 1 }, { name: 'Knot Up', w: 1, kind: 'hit', pow: 2.1, tele: 'is winding itself tight...' }],
    soothe: 'The Tangle loosens, line by line, into one gentle curl.' },
  en_crow: { name: 'Paper Crow', hp: 38, atk: 9, def: 3, spd: 11, feeling: 'lonely', calm: 46, exp: 12, stars: 4, h: 150,
    blurb: 'It carries a letter to someone who isn\'t there anymore.',
    moves: [{ name: 'Peck', w: 3, kind: 'hit', pow: 1 }, { name: 'Bad News', w: 1, kind: 'debuff', stat: 'atk' },
      { name: 'Empty Caw', w: 1, kind: 'all', pow: 1.2, tele: 'opens its beak wide...' }],
    soothe: 'The Paper Crow sets its letter down. Maybe it can be delivered later.' },
  en_cloud: { name: 'Grumble Cloud', hp: 48, atk: 9, def: 5, spd: 6, feeling: 'tired', calm: 52, exp: 14, stars: 5, h: 130,
    blurb: 'Too tired to stop raining.',
    moves: [{ name: 'Drizzle', w: 3, kind: 'all', pow: 0.7 }, { name: 'Downpour', w: 1, kind: 'all', pow: 1.6, tele: 'is getting very, very heavy...' }],
    soothe: 'The Grumble Cloud rains one last little drop and drifts off to sleep.' },
  en_mitten: { name: 'Lost Mitten', hp: 40, atk: 10, def: 4, spd: 9, feeling: 'lonely', calm: 44, exp: 13, stars: 4, h: 120,
    blurb: 'It keeps looking for its other half.',
    moves: [{ name: 'Grab', w: 3, kind: 'hit', pow: 1 }, { name: 'Clingy Hug', w: 1, kind: 'drain', pow: 1.3, tele: 'reaches out, desperately...' }],
    soothe: 'The Lost Mitten squeezes your hand once, then lets go.' },
  en_clock: { name: 'Tick-Tock', hp: 36, atk: 11, def: 3, spd: 15, feeling: 'scared', calm: 44, exp: 14, stars: 5, h: 130,
    blurb: 'Afraid there isn\'t enough time. There never is.',
    moves: [{ name: 'Tick', w: 3, kind: 'hit', pow: 0.9 }, { name: 'Rattle', w: 1, kind: 'debuff', stat: 'spd' },
      { name: 'ALARM!', w: 1, kind: 'all', pow: 1.5, tele: 'is counting down... 3... 2...' }],
    soothe: 'Tick-Tock\'s hands slow down. There\'s time. There\'s still time.' },
  en_blot: { name: 'Blot', hp: 58, atk: 13, def: 6, spd: 9, feeling: 'sore', calm: 60, exp: 20, stars: 6, h: 130,
    blurb: 'A mistake that spread. It thinks it ruined everything.',
    moves: [{ name: 'Splat', w: 3, kind: 'hit', pow: 1 }, { name: 'Stain', w: 1, kind: 'debuff', stat: 'def' },
      { name: 'Spill', w: 1, kind: 'all', pow: 1.4, tele: 'is trembling at the edges...' }],
    soothe: 'The Blot shrinks into a small, neat dot. It\'s just a dot. Dots are fine.' },
  en_sketchling: { name: 'Sketchling', hp: 52, atk: 12, def: 5, spd: 10, feeling: 'lonely', calm: 56, exp: 19, stars: 6, h: 150,
    blurb: 'Somebody started drawing it, and never came back.',
    moves: [{ name: 'Smudge', w: 3, kind: 'hit', pow: 1 }, { name: '...', w: 1, kind: 'nothing' },
      { name: 'Unfinished Line', w: 1, kind: 'hit', pow: 2, tele: 'is trying to remember what it was...' }],
    soothe: 'The Sketchling looks at itself. "It\'s okay to be unfinished," you think at it. It smiles.' },
  boss_eraser: { name: 'The Eraser', hp: 260, atk: 13, def: 6, spd: 7, feeling: 'tired', calm: 200, exp: 90, stars: 30, h: 250, boss: true,
    blurb: 'Rubbed out so many sad pages that it wore itself down.',
    moves: [{ name: 'Rub Out', w: 3, kind: 'hit', pow: 1.3 }, { name: 'Crumb Shower', w: 2, kind: 'all', pow: 0.9 },
      { name: 'Clean Slate', w: 1, kind: 'all', pow: 1.9, tele: 'is pressing down HARD...' }],
    soothe: 'The Eraser sets itself down, very gently. "...Maybe some pages should stay."' },
  boss_hush: { name: 'Hush', hp: 9999, atk: 17, def: 99, spd: 5, feeling: 'lonely', calm: 400, exp: 0, stars: 0, h: 330, boss: true, final: true,
    blurb: 'The silence Wren wrapped around their heart. It only wanted to keep it safe.',
    moves: [{ name: 'Quiet', w: 3, kind: 'hit', pow: 1.1 }, { name: 'Stillness', w: 1, kind: 'debuff', stat: 'spd' },
      { name: 'Muffle', w: 1, kind: 'waxdrain', pow: 6 }, { name: 'Unsaid', w: 1, kind: 'all', pow: 1.5, tele: 'swallows every sound in the room...' }],
    soothe: '' },
};

const TROOPS = {
  tut: { enemies: ['en_dustbunny'], bb: 'meadow', bgm: 'battle' },
  dust2: { enemies: ['en_dustbunny', 'en_dustbunny'], bb: 'meadow' },
  tangle: { enemies: ['en_tangle'], bb: 'meadow' },
  tangledust: { enemies: ['en_dustbunny', 'en_tangle'], bb: 'meadow' },
  cloud: { enemies: ['en_cloud'], bb: 'meadow' },
  cloudboss: { enemies: ['en_cloud', 'en_dustbunny'], bb: 'meadow' },
  crow: { enemies: ['en_crow'], bb: 'forest' },
  crowmitten: { enemies: ['en_crow', 'en_mitten'], bb: 'forest' },
  mitten: { enemies: ['en_mitten', 'en_mitten'], bb: 'forest' },
  clock: { enemies: ['en_clock', 'en_crow'], bb: 'forest' },
  clock2: { enemies: ['en_clock', 'en_clock'], bb: 'forest' },
  eraser: { enemies: ['boss_eraser'], bb: 'eraser', bgm: 'boss' },
  blot: { enemies: ['en_blot'], bb: 'unfinished' },
  sketch: { enemies: ['en_sketchling', 'en_blot'], bb: 'unfinished' },
  sketch2: { enemies: ['en_sketchling', 'en_sketchling'], bb: 'unfinished' },
  blot2: { enemies: ['en_blot', 'en_sketchling', 'en_blot'], bb: 'unfinished' },
  hush: { enemies: ['boss_hush'], bb: 'hush', bgm: 'hush' },
};

function expToNext(lv) { return Math.round(18 * Math.pow(lv, 1.55)); }

// ---------------------------------------------------------------- game state
const G = {
  fresh() {
    return {
      party: ['wren'], actors: {}, items: { cookie: 2 }, keyItems: [], stars: 0, flags: {}, vars: {},
      map: 'guest_room', x: 5, y: 5, dir: 'down', soothed: 0, scattered: 0, pages: 0, playFrames: 0, chapter: 0,
      soothedKinds: {},
    };
  },
  s: null,
  newGame() {
    this.s = this.fresh();
    for (const id in ACTORS) this.s.actors[id] = this.makeActor(id, 1);
  },
  makeActor(id, lv) {
    const a = { id, lv: 1, exp: 0, hp: 0, wax: 0, fallen: false };
    this.s.actors[id] = a; this.setLevel(a, lv); a.hp = a.mhp; a.wax = a.mwax; return a;
  },
  setLevel(a, lv) {
    const d = ACTORS[a.id]; a.lv = lv;
    const g = k => Math.round(d[k] + d.grow[k] * (lv - 1));
    a.mhp = g('hp'); a.mwax = g('wax'); a.atk = g('atk'); a.def = g('def'); a.spd = g('spd'); a.luck = d.luck;
  },
  actor(id) { return this.s.actors[id]; },
  partyActors() { return this.s.party.map(id => this.s.actors[id]); },
  skillsOf(id) { const a = this.actor(id); return ACTORS[id].skills.filter(([lv]) => a.lv >= lv).map(([, s]) => s); },
  flag(k) { return !!this.s.flags[k]; },
  set(k, v = true) { this.s.flags[k] = v; },
  addItem(id, n = 1) {
    if (ITEMS[id].key) { if (!this.s.keyItems.includes(id)) this.s.keyItems.push(id); }
    else this.s.items[id] = (this.s.items[id] || 0) + n;
  },
  hasItem(id) { return ITEMS[id].key ? this.s.keyItems.includes(id) : (this.s.items[id] || 0) > 0; },
  removeItem(id, n = 1) {
    if (ITEMS[id].key) this.s.keyItems = this.s.keyItems.filter(k => k !== id);
    else { this.s.items[id] -= n; if (this.s.items[id] <= 0) delete this.s.items[id]; }
  },
  healAll() { for (const a of Object.values(this.s.actors)) { a.hp = a.mhp; a.wax = a.mwax; a.fallen = false; } },
  gainExp(n) {
    const ups = [];
    for (const a of this.partyActors()) {
      a.exp += n;
      while (a.exp >= expToNext(a.lv) && a.lv < 20) { a.exp -= expToNext(a.lv); const oldSkills = this.skillsOf(a.id); this.setLevel(a, a.lv + 1); a.hp = Math.min(a.mhp, a.hp + 10); ups.push({ a, learned: this.skillsOf(a.id).filter(s => !oldSkills.includes(s)) }); }
    }
    return ups;
  },
  // ---- save/load ----
  // Saves go to two places: a file on disk through the local server (saves/slotN.json, with a .prev backup;
  // independent of browser, port and cleared site data) and the browser's localStorage (also with a backup copy).
  // Loading picks the newest *valid* copy of all of them, so one damaged or missing copy never loses progress.
  remote: {}, remoteOK: false,
  async initSaves(slot = 1) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 1500);
      const r = await fetch('api/save/' + slot, { cache: 'no-store', signal: ctl.signal }); clearTimeout(tm);
      if (r.status === 200) { this.remote[slot] = await r.json(); this.remoteOK = true; }
      else if (r.status === 404 && (r.headers.get('content-type') || '').includes('json')) this.remoteOK = true;
    } catch (e) { this.remoteOK = false; }
    // a save that only exists in this browser gets copied to disk, so it can't be lost with browser data
    const best = this.loadData(slot);
    if (this.remoteOK && best && best !== this.remote[slot]) {
      this.remote[slot] = best;
      fetch('api/save/' + slot, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(best) }).catch(() => {});
    }
  },
  validSave(d) {
    return !!(d && typeof d === 'object' && d.actors && d.actors.wren && typeof d.map === 'string' && MAPS[d.map]
      && Array.isArray(d.party) && d.party.length && typeof d.x === 'number' && typeof d.y === 'number');
  },
  lsGet(key) { try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
  save(slot = 1) {
    const data = { ...this.s, savedAt: Date.now(), version: 1 };
    const json = JSON.stringify(data);
    let local = false;
    try {
      const old = localStorage.getItem('paperlight_save' + slot);
      if (old) localStorage.setItem('paperlight_save' + slot + '_prev', old);
      localStorage.setItem('paperlight_save' + slot, json); local = true;
    } catch (e) {}
    this.remote[slot] = data;
    const remote = !this.remoteOK ? Promise.resolve(false) :
      fetch('api/save/' + slot, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json })
        .then(r => r.ok).catch(() => false);
    return remote.then(ok => ok || local);
  },
  loadData(slot = 1) {
    const cands = [this.remote[slot], this.lsGet('paperlight_save' + slot), this.lsGet('paperlight_save' + slot + '_prev')].filter(d => this.validSave(d));
    if (!cands.length) return null;
    return cands.reduce((a, b) => ((b.savedAt || 0) > (a.savedAt || 0) ? b : a));
  },
  load(slot = 1) {
    const d = this.loadData(slot); if (!d) return false;
    const s = Object.assign(this.fresh(), JSON.parse(JSON.stringify(d)));
    // repair anything a partial/old save might lack
    for (const id in ACTORS) if (!s.actors[id]) { const keep = this.s; this.s = s; this.makeActor(id, 1); this.s = keep; }
    s.party = s.party.filter(id => ACTORS[id]); if (!s.party.includes('wren')) s.party.unshift('wren');
    this.s = s; return true;
  },
};
