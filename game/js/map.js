// PAPERLIGHT — overworld: characters, map rendering, movement, events, lighting
'use strict';

// Prop definitions: img key, draw width (logical px), footprint [w,h] in tiles, decal = drawn under characters
const PROPS = {
  // real world
  bed: { w: 76, f: [2, 2] }, wardrobe: { w: 70, f: [2, 1] }, box: { w: 38, f: [1, 1] }, boxes: { w: 42, f: [1, 1] },
  piano: { w: 82, f: [2, 1] }, gclock: { w: 40, f: [1, 1] }, bookshelf: { w: 70, f: [2, 1] }, armchair: { w: 48, f: [1, 1] },
  sidetable: { w: 36, f: [1, 1] }, counter: { w: 80, f: [2, 1] }, stove: { w: 40, f: [1, 1] }, table: { w: 72, f: [2, 1] },
  plant: { w: 36, f: [1, 1] }, chair: { w: 30, f: [1, 1] }, rug: { w: 120, f: [4, 2], decal: true }, ladder: { w: 34, f: [1, 1] },
  trunk: { w: 64, f: [2, 1] }, desk: { w: 80, f: [2, 1] },
  counter2: { w: 78, f: [2, 1] }, phototable: { w: 40, f: [1, 1] }, nightstand: { w: 38, f: [1, 1] }, soupstove: { w: 40, f: [1, 1] },
  fridge: { w: 40, f: [1, 1] }, booktrunk: { w: 64, f: [2, 1] }, owleasel: { w: 44, f: [1, 1] }, xmasbox: { w: 38, f: [1, 1] },
  phonetable: { w: 32, f: [1, 1] },
  art_garden: { w: 54, f: [1, 1] }, art_tea: { w: 54, f: [1, 1] }, art_song: { w: 54, f: [1, 1] }, // finished gallery paintings
  // dream: meadow / village
  tree: { w: 96, f: [2, 1] }, pine: { w: 60, f: [1, 1] }, bush: { w: 44, f: [1, 1] }, mushhouse: { w: 120, f: [3, 2] },
  sign: { w: 34, f: [1, 1] }, lamppost: { w: 32, f: [1, 1] }, rock: { w: 36, f: [1, 1] }, well: { w: 60, f: [2, 1] },
  fence: { w: 36, f: [1, 1] },
  // dream: forest / village 2
  darktree: { w: 96, f: [2, 1] }, lanterntree: { w: 100, f: [2, 1] }, bluemush: { w: 44, f: [1, 1] }, teahouse: { w: 120, f: [3, 2] },
  stump: { w: 40, f: [1, 1] }, bookmark: { w: 34, f: [1, 1] }, mailbox: { w: 32, f: [1, 1] }, easel: { w: 44, f: [1, 1] },
  bookstack: { w: 36, f: [1, 1] },
  // dream: unfinished
  sketchtree: { w: 96, f: [2, 1] }, sketchhouse: { w: 120, f: [3, 2] }, frame: { w: 52, f: [1, 1] }, paperball: { w: 30, f: [1, 1] },
  pencil: { w: 30, f: [1, 1] }, eraserblock: { w: 44, f: [1, 1] }, sketchlamp: { w: 34, f: [1, 1] }, inkbottle: { w: 30, f: [1, 1] },
  gate: { w: 110, f: [3, 1] },
};
// fallback heights for procedural props (logical px)
const PROP_FALLBACK_H = { bed: 64, wardrobe: 90, piano: 70, gclock: 96, bookshelf: 90, tree: 110, darktree: 120, lanterntree: 120, pine: 100,
  sketchtree: 110, mushhouse: 110, teahouse: 110, sketchhouse: 110, lamppost: 70, sketchlamp: 70, pencil: 90, gate: 90, frame: 60, easel: 60, counter: 56, desk: 56, rug: 50 };

function propImg(k) { return Assets.get('p_' + k); }

function drawProceduralProp(ctx, k, x, y, w, h) {
  // x,y = bottom center
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round';
  const r = $.seeded(k.length * 13 + k.charCodeAt(1));
  const blob = (cx, cy, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * 6.283; const rr = 1 + (r() - 0.5) * 0.18; ctx.lineTo(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); };
  if (/tree|pine/.test(k)) {
    ctx.fillStyle = k === 'sketchtree' ? '#fff' : '#8a6246'; ctx.fillRect(x - 7, y - h * 0.4, 14, h * 0.4); ctx.strokeRect(x - 7, y - h * 0.4, 14, h * 0.4);
    const col = k === 'darktree' || k === 'lanterntree' ? '#2f4a6b' : k === 'sketchtree' ? '#fbfaf6' : k === 'pine' ? '#4f8a5b' : '#7dbb66';
    blob(x, y - h * 0.62, w * 0.46, h * 0.36, col);
    if (k === 'lanterntree') { ctx.fillStyle = '#f6c46b'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 20 + i * 20, y - h * 0.45 - (i % 2) * 14, 6, 0, 7); ctx.fill(); ctx.stroke(); } }
  } else if (k === 'bush') blob(x, y - h * 0.4, w * 0.5, h * 0.4, '#6fae5c');
  else if (k === 'rock' || k === 'paperball') blob(x, y - h * 0.35, w * 0.45, h * 0.35, k === 'rock' ? '#a9a39a' : '#f4f1ea');
  else if (/mush/.test(k)) { ctx.fillStyle = '#f3e7cf'; ctx.fillRect(x - w * 0.25, y - h * 0.5, w * 0.5, h * 0.5); ctx.strokeRect(x - w * 0.25, y - h * 0.5, w * 0.5, h * 0.5); blob(x, y - h * 0.62, w * 0.5, h * 0.3, k === 'bluemush' ? '#6f9fe0' : '#d8574f'); }
  else if (/lamp/.test(k)) { ctx.fillStyle = '#6b5a4a'; ctx.fillRect(x - 3, y - h, 6, h); ctx.strokeRect(x - 3, y - h, 6, h); blob(x, y - h, 11, 13, '#f6d36b'); }
  else { const col = { sign: '#c8a071', bookmark: '#d8574f', box: '#c9a878', boxes: '#c9a878', trunk: '#8a6246', rug: '#c98f86' }[k] || `hsl(${Math.floor(r() * 360)},30%,68%)`;
    ctx.fillStyle = col; Draw.wobbleRect(ctx, x - w / 2, y - h, w, h, k.length, 1.2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- characters
class Char {
  constructor(o) {
    Object.assign(this, { x: 0, y: 0, dir: 'down', key: null, kind: 'char', h: 54, speed: 2, moving: false, walkT: 0, alpha: 1,
      visible: true, solid: true, offY: 0, bob: 0, scale: 1 }, o);
    this.px = this.x * TILE; this.py = this.y * TILE; this.tx = this.x; this.ty = this.y;
  }
  place(x, y, dir) { this.x = this.tx = x; this.y = this.ty = y; this.px = x * TILE; this.py = y * TILE; if (dir) this.dir = dir; this.moving = false; }
  startMove(dir, speed) {
    const [dx, dy] = DIRV[dir]; this.dir = dir; this.tx = this.x + dx; this.ty = this.y + dy; this.moving = true; if (speed) this.speed = speed;
  }
  update() {
    if (this.moving) {
      const gx = this.tx * TILE, gy = this.ty * TILE;
      const dx = gx - this.px, dy = gy - this.py, d = Math.hypot(dx, dy);
      if (d <= this.speed) { this.px = gx; this.py = gy; this.x = this.tx; this.y = this.ty; this.moving = false; this.arrived = true; }
      else { this.px += dx / d * this.speed; this.py += dy / d * this.speed; }
      this.walkT += this.speed;
    } else this.walkT = 0;
  }
  img() {
    if (this.kind === 'char') return charImg(this.key, this.dir === 'right' && !Assets.get(`c_${this.key}_right`) ? 'left' : this.dir);
    if (this.kind === 'enemy') return enemyImg(this.key);
    if (this.kind === 'prop') return propImg(this.key);
    return null;
  }
  draw(ctx, cam, t) {
    if (!this.visible || this.kind === 'none') return;
    const x = this.px - cam.x + TILE / 2, y = this.py - cam.y + TILE - 2 + this.offY;
    // soft shadow
    ctx.save(); ctx.globalAlpha = 0.18 * this.alpha; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y - 1, 13 * this.scale, 5, 0, 0, 7); ctx.fill(); ctx.restore();
    if (this.kind === 'prop') {
      const d = PROPS[this.key]; const im = propImg(this.key);
      if (im) { const w = d.w; Draw.imgBottom(ctx, im, x, y + 2, im.height * w / im.width, { alpha: this.alpha }); }
      else drawProceduralProp(ctx, this.key, x, y, d.w, PROP_FALLBACK_H[this.key] || 40);
      if (this.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + Math.sin(t / 20) * 0.1; const g = ctx.createRadialGradient(x, y - 20, 2, x, y - 20, 36); g.addColorStop(0, this.glow); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 40, y - 60, 80, 80); ctx.restore(); }
      return;
    }
    const im = this.img(); if (!im) return;
    let bob = 0, rot = 0, sy = 1;
    if (this.moving || this.walkT) { const ph = this.walkT / 16 * Math.PI; bob = Math.abs(Math.sin(ph)) * 2.5; rot = Math.sin(ph) * 0.05; }
    else if (this.kind === 'enemy' || this.idleBob) { sy = 1 + Math.sin(t / 18 + this.x) * 0.03; }
    const flip = this.kind === 'char' && this.dir === 'right' && !Assets.get(`c_${this.key}_right`) && !!Assets.get(`c_${this.key}_left`);
    const h = this.h * this.scale;
    Draw.imgBottom(ctx, im, x, y - bob, h, { flip, alpha: this.alpha, rot, sy });
    if (this.lantern) this.drawLantern(ctx, x, y - bob, t);
    if (this.emote) this.drawEmote(ctx, x, y - h - 8, t);
  }
  drawLantern(ctx, x, y, t) {
    const side = this.dir === 'left' ? -1 : this.dir === 'right' ? 1 : this.dir === 'up' ? -0.6 : 0.8;
    const lx = x + side * 15, ly = y - 18 + Math.sin(t / 10) * 1.2;
    if (this.dir === 'up') return; // behind the body
    ctx.save();
    const icon = Assets.get('i_lantern'); // the generated paper lantern
    if (icon) Draw.imgBottom(ctx, icon, lx, ly + 9, 19);
    else {
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(lx, ly - 12); ctx.lineTo(lx, ly - 6); ctx.stroke();
      ctx.fillStyle = '#fff1c4'; ctx.beginPath(); ctx.ellipse(lx, ly, 5.5, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
    const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 16); g.addColorStop(0, 'rgba(255,210,120,0.9)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.fillRect(lx - 16, ly - 16, 32, 32); ctx.restore();
  }
  drawEmote(ctx, x, y, t) {
    const e = this.emote; const s = 1 + Math.max(0, 1 - (t - (this.emoteT || 0)) / 10) * 0.4;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    Draw.box(ctx, -14, -28, 28, 26, { seed: 3, lw: 1.8 });
    Draw.text(ctx, e, 0, -8, { size: 22, align: 'center', bold: true, color: e === '!' ? PAL.red : PAL.ink });
    ctx.restore();
  }
}
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
// how fast each kind of Worry chases (px/frame). The player walks at 2 and runs at 4, so walking gets you caught.
const CHASE_SPEED = { en_clock: 2.7, en_crow: 2.5, en_cloud: 1.9, en_dustbunny: 2.2, en_sketchling: 2.1 };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

// ---------------------------------------------------------------- themes
const THEMES = {
  house: { floor: 'wood', floor2: 'rug', floor3: 'tile', wall: 'wall', wallTop: '#4a4152', style: 'room', tint: 'rgba(120,130,160,0.10)' },
  attic: { floor: 'attic', floor2: 'wood', floor3: 'attic', wall: 'attic', wallTop: '#2e2622', style: 'room', tint: 'rgba(90,80,70,0.12)' },
  meadow: { floor: 'grass', floor2: 'path', floor3: 'grass', wall: 'grass', style: 'hedge', bg: '#79b35e' },
  forest: { floor: 'forest', floor2: 'forestpath', floor3: 'forest', wall: 'forest', style: 'woods', bg: '#152430' },
  paper: { floor: 'paper', floor2: 'white', floor3: 'paper', wall: 'paper', style: 'sketch', bg: '#f4f1e8' },
  void: { floor: 'white', floor2: 'paper', floor3: 'white', wall: 'white', style: 'none', bg: '#fdfcf8' },
  night: { floor: 'wood', floor2: 'rug', floor3: 'tile', wall: 'wall', wallTop: '#231f2c', style: 'room', tint: 'rgba(20,25,60,0.35)' },
};

// ---------------------------------------------------------------- the map scene
const MapScene = {
  map: null, player: null, followers: [], events: [], t: 0, cam: { x: 0, y: 0 }, busy: 0, ground: null, lights: [],
  encounterLock: 0,
  async load(id, x, y, dir) {
    const def = MAPS[id]; if (!def) throw new Error('no map ' + id);
    this.map = def; this.id = id; G.s.map = id;
    this.theme = THEMES[def.theme];
    this.rows = def.rows; this.w = Math.max(...def.rows.map(r => r.length)); this.h = def.rows.length;
    this.solid = []; for (let yy = 0; yy < this.h; yy++) { this.solid.push([]); for (let xx = 0; xx < this.w; xx++) this.solid[yy].push('# ~o'.includes(this.tile(xx, yy))); }
    this.props = (def.props || []).filter(p => !p.cond || p.cond()).map(p => ({ ...p }));
    for (const p of this.props) { const d = PROPS[p.k]; if (!d || d.decal || p.walk) continue; for (let i = 0; i < d.f[0]; i++) for (let j = 0; j < d.f[1]; j++) if (this.solid[p.y + j]) this.solid[p.y + j][p.x + i] = true; }
    this.buildGround();
    // player & followers
    this.player = new Char({ key: 'wren', x, y, dir: dir || 'down', lantern: !!def.dream && G.hasItem('lantern'), h: 68 });
    this.followers = G.s.party.slice(1).map((k, i) => new Char({ key: k, x, y, dir: dir || 'down', h: k === 'moth' ? 50 : 52, solid: false }));
    this.trail = [];
    // events
    this.events = [];
    for (const e of def.events || []) {
      if (e.cond && !e.cond()) continue;
      if (e.enemy && G.flag(`gone_${id}_${e.id}`)) continue;
      const ch = new Char({ ...e, kind: e.enemy ? 'enemy' : e.prop ? 'prop' : e.char ? 'char' : 'none', key: e.enemy ? TROOPS[e.enemy].enemies[0] : (typeof e.prop === 'function' ? e.prop() : e.prop) || e.char,
        h: e.h || (e.enemy ? 44 : 54), solid: e.solid !== false, idleBob: !!e.enemy || e.bob });
      ch.def = e; ch.home = { x: e.x, y: e.y }; ch.moveT = $.irand(30, 120);
      this.events.push(ch);
    }
    G.s.x = x; G.s.y = y;
    this.encounterLock = 30;
    if (def.bgm !== undefined) Audio2.bgm(typeof def.bgm === 'function' ? def.bgm() : def.bgm);
    this.updateCam(true);
    Game.scene = this;
  },
  tile(x, y) { const r = this.rows[y]; if (!r || x < 0 || x >= r.length) return ' '; return r[x]; },
  buildGround() {
    const L = Screen.makeLayer(this.w * TILE, this.h * TILE); const c = L.cx; const th = this.theme;
    c.fillStyle = th.bg || '#222'; c.fillRect(0, 0, L.w, L.h);
    const pat = name => { const tex = Tex.get(name); const p = c.createPattern(tex, 'repeat'); const s = tex.width > 300 ? 0.5 : 1; p.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0])); return p; };
    const P = { '.': pat(th.floor), ',': pat(th.floor2), ':': pat(th.floor3), '=': pat('wood'), '~': pat('water'), o: pat(th.floor), '#': pat(th.wall) };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ch = this.tile(x, y); if (ch === ' ') continue;
      if (ch === '#') continue;
      c.fillStyle = P[ch] || P['.']; c.fillRect(x * TILE, y * TILE, TILE + 0.5, TILE + 0.5);
    }
    // soft edges for path/water tiles
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ch = this.tile(x, y);
      if (ch === '~' || ch === ',') {
        c.save(); c.strokeStyle = ch === '~' ? 'rgba(40,70,120,0.45)' : 'rgba(90,70,40,0.25)'; c.lineWidth = 1.6;
        for (const [d, [dx, dy]] of Object.entries(DIRV)) {
          const n = this.tile(x + dx, y + dy); if (n === ch || n === '=' || (ch === ',' && n === '#')) continue;
          c.beginPath();
          if (d === 'up') { c.moveTo(x * TILE, y * TILE + 1); c.lineTo(x * TILE + TILE, y * TILE + 1); }
          if (d === 'down') { c.moveTo(x * TILE, y * TILE + TILE - 1); c.lineTo(x * TILE + TILE, y * TILE + TILE - 1); }
          if (d === 'left') { c.moveTo(x * TILE + 1, y * TILE); c.lineTo(x * TILE + 1, y * TILE + TILE); }
          if (d === 'right') { c.moveTo(x * TILE + TILE - 1, y * TILE); c.lineTo(x * TILE + TILE - 1, y * TILE + TILE); }
          c.stroke();
        }
        c.restore();
      }
      if (ch === '=') { c.strokeStyle = 'rgba(70,45,30,0.6)'; c.lineWidth = 1.5; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x * TILE + k * 8 + 1, y * TILE); c.lineTo(x * TILE + k * 8 + 1, y * TILE + TILE); c.stroke(); } }
    }
    // walls
    const style = th.style;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.tile(x, y) !== '#') continue;
      const below = this.tile(x, y + 1);
      const X = x * TILE, Y = y * TILE;
      if (style === 'room') {
        if (below !== '#' && below !== ' ') {
          c.fillStyle = pat(th.wall); c.fillRect(X, Y, TILE + 0.5, TILE + 0.5);
          c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(X, Y, TILE, 4);
          c.fillStyle = '#7a5a44'; c.fillRect(X, Y + TILE - 6, TILE + 0.5, 6); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(X, Y + TILE - 1, TILE + 0.5, 3);
        } else { c.fillStyle = th.wallTop; c.fillRect(X, Y, TILE + 0.5, TILE + 0.5); }
      } else if (style === 'hedge' || style === 'woods') {
        c.fillStyle = style === 'hedge' ? '#4f8f4a' : '#101c28'; c.fillRect(X, Y, TILE + 0.5, TILE + 0.5);
      } else if (style === 'sketch') {
        c.fillStyle = '#e9e5da'; c.fillRect(X, Y, TILE + 0.5, TILE + 0.5);
        c.strokeStyle = 'rgba(80,80,80,0.35)'; c.lineWidth = 1; for (let k = -TILE; k < TILE; k += 6) { c.beginPath(); c.moveTo(X + k, Y + TILE); c.lineTo(X + k + TILE, Y); c.stroke(); }
      }
    }
    // hedge/woods: scribbly bushes along the edge of wall regions
    if (style === 'hedge' || style === 'woods' || style === 'sketch') {
      const r = $.seeded(this.w * 7 + this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.tile(x, y) !== '#') continue;
        let edge = false; for (const [dx, dy] of Object.values(DIRV)) { const n = this.tile(x + dx, y + dy); if (n !== '#' && n !== ' ') edge = true; }
        if (!edge && (x + y) % 2) continue;
        const bush = Assets.get('p_' + { hedge: 'bush_green', woods: 'bush_night', sketch: 'bush_sketch' }[style]);
        for (let k = 0; k < (edge ? 2 : 1); k++) {
          const cx = x * TILE + 16 + (r() - 0.5) * 14, cy = y * TILE + 16 + (r() - 0.5) * 14, rr = 14 + r() * 8;
          if (bush) { // generated bush sprites, slightly varied in size and brightness
            const s = rr * 2.9; c.save(); if (style === 'woods') c.filter = `brightness(${0.55 + r() * 0.2})`; else if (r() < 0.4) c.filter = `brightness(${0.88 + r() * 0.1})`;
            c.drawImage(bush, cx - s / 2, cy - s / 2, s, s); c.restore(); continue;
          }
          c.fillStyle = style === 'hedge' ? ['#5c9e52', '#6aad5b', '#4e8b48'][k % 3] : style === 'woods' ? ['#14222f', '#172839'][k % 2] : '#f7f5ef';
          c.strokeStyle = style === 'sketch' ? 'rgba(90,90,90,0.55)' : 'rgba(40,40,40,0.45)'; c.lineWidth = 1.5;
          c.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.283; const q = rr * (0.85 + r() * 0.25); c.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } c.closePath(); c.fill(); c.stroke();
        }
      }
    }
    // decals
    for (const p of this.props) {
      const d = PROPS[p.k]; if (!d || !d.decal) continue;
      const im = propImg(p.k), cx = (p.x + d.f[0] / 2) * TILE, by = (p.y + d.f[1]) * TILE;
      if (im) Draw.imgBottom(c, im, cx, by, im.height * d.w / im.width);
      else { c.fillStyle = pat('rug'); c.beginPath(); c.ellipse(cx, by - d.f[1] * TILE / 2, d.f[0] * TILE / 2, d.f[1] * TILE / 2 - 2, 0, 0, 7); c.fill(); c.strokeStyle = PAL.ink; c.lineWidth = 2; c.stroke(); }
    }
    this.ground = L;
  },
  // ------------------------------------------------ queries
  blocked(x, y, self) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    if (this.solid[y][x]) return true;
    if (this.map.block && this.map.block(x, y)) return true;
    for (const e of this.events) if (e !== self && e.solid && e.visible && ((e.x === x && e.y === y) || (e.moving && e.tx === x && e.ty === y))) return true;
    if (self && self !== this.player && ((this.player.x === x && this.player.y === y) || (this.player.moving && this.player.tx === x && this.player.ty === y))) return true;
    return false;
  },
  removeProp(k) {
    const i = this.props.findIndex(p => p.k === k); if (i < 0) return;
    const p = this.props[i], d = PROPS[k]; this.props.splice(i, 1);
    for (let a = 0; a < d.f[0]; a++) for (let b = 0; b < d.f[1]; b++) if (this.solid[p.y + b]) this.solid[p.y + b][p.x + a] = '# ~o'.includes(this.tile(p.x + a, p.y + b));
  },
  eventAt(x, y, pred = () => true) { return this.events.find(e => e.visible && e.x === x && e.y === y && pred(e)); },
  ev(id) { return this.events.find(e => e.def.id === id); },
  // ------------------------------------------------ scripting
  // "busy" blocks player control while scripts run. Each lock belongs to a game session (gen); returning to the
  // title starts a new session, so a script left over from the old one can never unlock (or re-lock) the new one.
  gen: 0,
  lock() { this.busy++; return this.gen; },
  unlock(g) { if (g === this.gen) this.busy = Math.max(0, this.busy - 1); },
  reset() { this.gen++; this.busy = 0; },
  async run(fn, ev) {
    const g = this.lock();
    try { await fn(ev); } catch (err) { console.error(err); }
    this.unlock(g);
  },
  async transfer(id, x, y, dir, { fade = 18, color = '#000', sound = true } = {}) {
    const g = this.lock();
    if (sound) Audio2.se('door', 0.6);
    await FX.fadeOut(fade, color);
    const prevName = this.map && this.map.name;
    await this.load(id, x, y, dir);
    if (this.map.name !== prevName) this.nameT = 200;
    if (this.map.onEnter) await this.map.onEnter();
    await FX.fadeIn(fade);
    this.unlock(g);
    if (g === this.gen) this.checkAuto();
  },
  checkAuto() {
    for (const e of this.events) if (e.def.trigger === 'auto' && e.visible && (!e.def.once || !G.flag('auto_' + this.id + '_' + e.def.id))) {
      if (e.def.once) G.set('auto_' + this.id + '_' + e.def.id);
      this.run(e.def.run, e); return;
    }
  },
  async moveChar(ch, path, speed = 2) {
    for (const d of path) {
      if (d === 'wait') { await wait(10); continue; }
      if ('udlr'.includes(d) && d.length === 1) { const dd = { u: 'up', d: 'down', l: 'left', r: 'right' }[d]; ch.startMove(dd, speed); await until(() => !ch.moving); }
      else if (d.startsWith('face')) ch.dir = d.slice(5);
    }
  },
  followersTo(x, y) { for (const f of this.followers) f.place(x, y, this.player.dir); this.trail = []; },
  // ------------------------------------------------ update
  update() {
    this.t++;
    if (this.encounterLock > 0) this.encounterLock--;
    const p = this.player;
    const free = !this.busy && !Msg.active && !Choice.active && !Game.overlay;
    if (free && !p.moving) {
      if (p.arrived) { p.arrived = false; if (this.onStep()) return; }
      const d = Input.dir();
      if (Input.pressed('menu') || Input.pressed('cancel')) { Game.openMenu(); return; }
      if (Input.pressed('ok')) { this.interact(); return; }
      if (d) {
        const [dx, dy] = DIRV[d];
        p.dir = d;
        if (!this.blocked(p.x + dx, p.y + dy, p)) {
          this.trail.unshift({ x: p.x, y: p.y });
          p.startMove(d, Input.down('run') ? 4 : 2);
          this.followers.forEach((f, i) => { const tgt = this.trail[i]; if (tgt && (tgt.x !== f.x || tgt.y !== f.y)) { const fd = tgt.x > f.x ? 'right' : tgt.x < f.x ? 'left' : tgt.y > f.y ? 'down' : 'up'; if (Math.abs(tgt.x - f.x) + Math.abs(tgt.y - f.y) === 1) f.startMove(fd, p.speed); else f.place(tgt.x, tgt.y, fd); } });
          this.trail.length = this.followers.length + 1;
        } else if (this.eventAt(p.x + dx, p.y + dy, e => e.kind === 'enemy' && !e.def.noEncounter) && this.encounterLock <= 0) {
          this.encounter(this.eventAt(p.x + dx, p.y + dy, e => e.kind === 'enemy'));
        } else if (this.bumpT-- <= 0) { this.bumpT = 20; const e = this.eventAt(p.x + dx, p.y + dy, e => e.def.trigger === 'bump'); if (e) this.run(e.def.run, e); }
      }
    } else if (!p.moving && p.arrived && !this.busy) { p.arrived = false; }
    p.update(); for (const f of this.followers) f.update();
    for (const e of this.events) { this.updateEvent(e, free); e.update(); }
    if (this.map.update) this.map.update(this);
    this.updateCam();
  },
  updateEvent(e, free) {
    const d = e.def;
    if (e.kind === 'enemy' && e.visible) {
      if (!free || d.noEncounter) return;
      const p = this.player;
      const pdx = Math.abs(p.px - e.px), pdy = Math.abs(p.py - e.py);
      if (this.encounterLock <= 0 && pdx < 22 && pdy < 22) { this.encounter(e); return; }
      if (d.still || e.moving) return;
      // Worry AI: wander near home -> notice the player (!) -> chase -> give up (?) -> walk back home
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      const SIGHT = d.sight || 5, GIVE_UP = 6.5, MAX_CHASE_STEPS = 24; // about 5-6 seconds of pursuit
      if (this.encounterLock > 0) { if (e.ai === 'chase' || e.ai === 'alert') e.ai = 'return'; }
      else if ((!e.ai || e.ai === 'idle' || e.ai === 'return') && dist <= SIGHT) {
        e.ai = 'alert'; e.alertT = 22; this.emoteOn(e, '!');
      }
      if (e.ai === 'alert') { if (--e.alertT <= 0) { e.ai = 'chase'; e.chaseT = 0; } return; }
      if (e.ai === 'chase') {
        if (dist > GIVE_UP || ++e.chaseT > MAX_CHASE_STEPS) { e.ai = 'return'; e.moveT = 60; this.emoteOn(e, '?'); return; }
        const dir = this.stepToward(e, p.x, p.y);
        if (dir) e.startMove(dir, d.chaseSpeed || CHASE_SPEED[e.key] || 2.3);
        return;
      }
      if (--e.moveT > 0) return;
      if (e.ai === 'return' && (e.x !== e.home.x || e.y !== e.home.y)) {
        const dir = this.stepToward(e, e.home.x, e.home.y); e.moveT = 4;
        if (dir) e.startMove(dir, 1.5); else e.ai = 'idle';
        return;
      }
      e.ai = 'idle'; e.moveT = $.irand(40, 110);
      let dir = $.pick(['up', 'down', 'left', 'right']);
      if (Math.abs(e.x + DIRV[dir][0] - e.home.x) > 3 || Math.abs(e.y + DIRV[dir][1] - e.home.y) > 3) dir = null;
      if (dir && !this.blockedForEnemy(e.x + DIRV[dir][0], e.y + DIRV[dir][1], e)) e.startMove(dir, 1.4);
    } else if (d.wander && free && !e.moving && --e.moveT <= 0) {
      e.moveT = $.irand(60, 160); const dir = $.pick(['up', 'down', 'left', 'right']);
      const nx = e.x + DIRV[dir][0], ny = e.y + DIRV[dir][1];
      if (Math.abs(nx - e.home.x) <= 2 && Math.abs(ny - e.home.y) <= 2 && !this.blocked(nx, ny, e)) e.startMove(dir, 1);
    }
  },
  emoteOn(e, mark) {
    e.emote = mark; e.emoteT = this.t; if (mark === '!') Audio2.se('bell', 0.35, 1.3);
    setTimeout(() => { if (e.emote === mark) e.emote = null; }, 800);
  },
  // one greedy step toward a tile: main axis first, then the other axis, then sidestep around obstacles
  stepToward(e, tx, ty) {
    const dx = tx - e.x, dy = ty - e.y;
    const h = dx > 0 ? 'right' : dx < 0 ? 'left' : null, v = dy > 0 ? 'down' : dy < 0 ? 'up' : null;
    const order = Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h];
    const side = order[0] === 'left' || order[0] === 'right' ? ['up', 'down'] : ['left', 'right'];
    if (Math.random() < 0.5) side.reverse();
    for (const dir of [...order, ...side]) {
      if (!dir || dir === OPP[e.lastDir]) continue; // don't just bounce back and forth
      if (!this.blockedForEnemy(e.x + DIRV[dir][0], e.y + DIRV[dir][1], e)) { e.lastDir = dir; return dir; }
    }
    e.lastDir = null; return null;
  },
  blockedForEnemy(x, y, e) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || this.solid[y][x]) return true;
    if (this.map.block && this.map.block(x, y)) return true;
    for (const o of this.events) if (o !== e && o.solid && o.visible && ((o.x === x && o.y === y) || (o.tx === x && o.ty === y))) return true;
    return false;
  },
  async encounter(e) {
    const troop = e.def.enemy;
    const g = this.lock();
    const res = await Battle.start(troop, { canRun: !e.def.boss });
    this.unlock(g);
    if (g !== this.gen) return; // the game was quit to the title meanwhile
    if (res === 'win') { G.set(`gone_${this.id}_${e.def.id}`); e.visible = false; if (e.def.after) this.run(e.def.after, e); }
    else if (res === 'run') { this.encounterLock = 150; e.place(e.home.x, e.home.y); e.ai = 'idle'; }
  },
  onStep() {
    const p = this.player;
    G.s.x = p.x; G.s.y = p.y; G.s.dir = p.dir;
    const e = this.eventAt(p.x, p.y, e => e.def.trigger === 'touch');
    if (e) { this.run(e.def.run, e); return true; }
    const ex = (this.map.exits || []).find(x => x.x === p.x && x.y === p.y || (x.x2 !== undefined && p.x >= x.x && p.x <= x.x2 && p.y === x.y) || (x.y2 !== undefined && p.y >= x.y && p.y <= x.y2 && p.x === x.x));
    if (ex && (!ex.cond || ex.cond())) {
      const off = ex.fixed ? 0 : ex.x2 !== undefined ? p.x - ex.x : ex.y2 !== undefined ? p.y - ex.y : 0;
      const tx = ex.tx + (ex.x2 !== undefined ? off : 0), ty = ex.ty + (ex.y2 !== undefined ? off : 0);
      this.transfer(ex.to, tx, ty, ex.dir || p.dir, { sound: ex.sound !== false, color: ex.color || '#000' });
      return true;
    }
    return false;
  },
  interact() {
    const p = this.player; const [dx, dy] = DIRV[p.dir];
    let e = this.eventAt(p.x + dx, p.y + dy, e => e.def.trigger === 'act' || !e.def.trigger);
    // counters: allow talking across a table/counter tile
    if (!e && this.solid[p.y + dy] && this.solid[p.y + dy][p.x + dx]) e = this.eventAt(p.x + dx * 2, p.y + dy * 2, e => e.def.across);
    if (!e) e = this.eventAt(p.x, p.y, e => e.def.trigger === 'act' && !e.solid);
    if (e && e.def.run && e.kind !== 'enemy') {
      if (e.kind === 'char' && !e.def.noturn) e.dir = OPP[p.dir];
      this.run(e.def.run, e);
    }
  },
  updateCam(snap) {
    const p = this.player; const mw = this.w * TILE, mh = this.h * TILE;
    let tx = p.px + TILE / 2 - W / 2, ty = p.py + TILE / 2 - H / 2;
    tx = mw <= W ? (mw - W) / 2 : $.clamp(tx, 0, mw - W);
    ty = mh <= H ? (mh - H) / 2 : $.clamp(ty, 0, mh - H);
    if (this.camLock) { tx = this.camLock.x; ty = this.camLock.y; }
    if (snap) { this.cam.x = tx; this.cam.y = ty; } else { this.cam.x += (tx - this.cam.x) * 0.2; this.cam.y += (ty - this.cam.y) * 0.2; }
    if (Math.abs(this.cam.x - tx) < 0.3) this.cam.x = tx; if (Math.abs(this.cam.y - ty) < 0.3) this.cam.y = ty;
  },
  // ------------------------------------------------ draw
  draw(ctx) {
    const [sx, sy] = FX.offset();
    const cam = { x: Math.round((this.cam.x + sx) * 2) / 2, y: Math.round((this.cam.y + sy) * 2) / 2 };
    ctx.fillStyle = this.theme.bg || '#111'; ctx.fillRect(0, 0, W, H);
    if (this.map.underlay) this.map.underlay(ctx, cam, this.t);
    ctx.drawImage(this.ground.cv, cam.x * RES, cam.y * RES, W * RES, H * RES, 0, 0, W, H);
    if (this.map.drawGround) this.map.drawGround(ctx, cam, this.t);
    // depth-sorted objects
    const objs = [];
    for (const pr of this.props) { const d = PROPS[pr.k]; if (!d || d.decal) continue; objs.push({ y: (pr.y + d.f[1]) * TILE - 1, draw: () => this.drawProp(ctx, pr, cam) }); }
    for (const e of this.events) if (e.visible && e.kind !== 'none') objs.push({ y: e.py + TILE + (e.def.z || 0), draw: () => e.draw(ctx, cam, this.t) });
    for (const f of this.followers) if (f.visible) objs.push({ y: f.py + TILE - 0.5, draw: () => f.draw(ctx, cam, this.t) });
    objs.push({ y: this.player.py + TILE, draw: () => this.player.draw(ctx, cam, this.t) });
    objs.sort((a, b) => a.y - b.y); for (const o of objs) o.draw();
    if (this.map.drawOver) this.map.drawOver(ctx, cam, this.t);
    if (this.theme.tint) { ctx.fillStyle = this.theme.tint; ctx.fillRect(0, 0, W, H); }
    const dark = typeof this.map.dark === 'function' ? this.map.dark() : this.map.dark;
    if (dark) this.drawDark(ctx, cam, dark);
    if (this.map.drawTop) this.map.drawTop(ctx, cam, this.t);
    // map name card
    if (this.nameT > 0) {
      this.nameT--; const a = Math.min(1, this.nameT / 30, (200 - this.nameT) / 30);
      const w = Draw.measure(ctx, this.map.name, 24) + 48;
      Draw.box(ctx, 18, 16, w, 40, { alpha: a, fill: PAL.cream, seed: 31 });
      Draw.text(ctx, this.map.name, 42, 44, { size: 24, alpha: a });
    }
  },
  drawProp(ctx, pr, cam) {
    const d = PROPS[pr.k]; const im = propImg(pr.k);
    const cx = (pr.x + d.f[0] / 2) * TILE - cam.x, by = (pr.y + d.f[1]) * TILE - cam.y + 2;
    if (cx < -150 || cx > W + 150 || by < -30 || by > H + 250) return;
    const w = pr.w || d.w;
    if (im) Draw.imgBottom(ctx, im, cx, by, im.height * w / im.width, { flip: pr.flip, alpha: pr.alpha ?? 1 });
    else drawProceduralProp(ctx, pr.k, cx, by, w, PROP_FALLBACK_H[pr.k] || 40);
  },
  drawDark(ctx, cam, dark) {
    if (!this.darkL) this.darkL = Screen.makeLayer();
    const L = this.darkL, c = L.cx;
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
    c.fillStyle = `rgba(8,6,22,${dark})`; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => { const g = c.createRadialGradient(x, y, r * 0.15, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
    const p = this.player; const flick = Math.sin(this.t / 7) * 3 + Math.sin(this.t / 3.1) * 1.5;
    const lr = this.player.lantern ? 120 + (this.map.lanternBoost || 0) : 60;
    hole(p.px - cam.x + 16, p.py - cam.y + 4, lr + flick);
    for (const e of this.events) if (e.visible && e.def.light && (!e.def.lightCond || e.def.lightCond())) hole(e.px - cam.x + 16, e.py - cam.y, e.def.light + Math.sin(this.t / 9 + e.x) * 2);
    for (const l of this.map.lights ? this.map.lights() : []) hole(l.x * TILE - cam.x + 16, l.y * TILE - cam.y + 8, l.r);
    ctx.drawImage(L.cv, 0, 0, W, H);
    // warm glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12;
    const g = ctx.createRadialGradient(p.px - cam.x + 16, p.py - cam.y, 5, p.px - cam.x + 16, p.py - cam.y, lr);
    g.addColorStop(0, '#ffcf7a'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  },
};
