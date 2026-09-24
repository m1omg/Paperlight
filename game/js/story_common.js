// PAPERLIGHT — story helpers, map builder, decorations
'use strict';

const MAPS = {};

// ---------------------------------------------------------------- map builder for organic outdoor maps
const MB = {
  grid(w, h, ch = '.') { return Array.from({ length: h }, () => Array(w).fill(ch)); },
  rect(g, x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = ch; },
  border(g, t = 1, ch = '#') { const h = g.length, w = g[0].length; this.rect(g, 0, 0, w, t, ch); this.rect(g, 0, h - t, w, t, ch); this.rect(g, 0, 0, t, h, ch); this.rect(g, w - t, 0, t, h, ch); },
  path(g, pts, ch = ',', wdt = 2) {
    for (let k = 0; k < pts.length - 1; k++) {
      let [x0, y0] = pts[k]; const [x1, y1] = pts[k + 1];
      while (x0 !== x1 || y0 !== y1) { this.rect(g, x0, y0, wdt, wdt, ch); if (x0 !== x1) x0 += Math.sign(x1 - x0); else y0 += Math.sign(y1 - y0); }
      this.rect(g, x1, y1, wdt, wdt, ch);
    }
  },
  blob(g, cx, cy, rx, ry, ch) { for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx + 0.5) + (j * j) / (ry * ry + 0.5) <= 1) this.rect(g, cx + i, cy + j, 1, 1, ch); },
  rows(g) { return g.map(r => r.join('')); },
};

// ---------------------------------------------------------------- decorations drawn on the ground layer each frame
function drawDeco(map, ctx, cam, t) {
  for (const d of map.deco || []) {
    if (d.cond && !d.cond()) continue;
    const x = d.x * TILE - cam.x, y = d.y * TILE - cam.y;
    if (x < -120 || x > W + 60 || y < -120 || y > H + 60) continue;
    ctx.save();
    if (!drawDecoImage(ctx, d, x, y, t)) drawDecoSketch(ctx, d, x, y, t);
    ctx.restore();
  }
}
// generated art for decorations; returns false when there is no image (then the sketch fallback is drawn)
const DOODLES = ['doodle_sun', 'doodle_house', 'doodle_bird', 'doodle_star', 'doodle_boat', 'doodle_cat', 'doodle_tree'];
function drawDecoImage(ctx, d, x, y, t) {
  const img = k => Assets.get('p_' + k);
  const fit = (im, bx, by, bw, bh) => { Draw.imgFit(ctx, im, bx, by, bw, bh); return true; };
  const rain = (bx, by, bw, bh, col) => { // animated raindrops over a window
    ctx.save(); ctx.beginPath(); ctx.rect(bx + 4, by + 4, bw - 8, bh - 8); ctx.clip(); ctx.strokeStyle = col; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const rx = bx + 4 + ((i * 13 + t * 1.3) % (bw - 8)), ry = by + ((i * 17 + t * 4) % bh); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 6); ctx.stroke(); }
    ctx.restore();
  };
  let im;
  switch (d.type) {
    case 'door': im = img(d.open ? (d.glow ? 'doorway_lit' : 'doorway') : 'door'); if (!im) return false;
      Draw.imgBottom(ctx, im, x + 16, y + 32, 52); return true;
    case 'window': {
      const w = (d.w || 1) * TILE;
      if ((d.w || 1) === 1) { im = img('win_round'); if (!im) return false; fit(im, x + 1, y - 6, 30, 34); if (!d.morning) rain(x + 4, y - 3, 24, 28, 'rgba(255,255,255,0.45)'); return true; }
      im = img(d.night ? 'win_night' : d.morning ? 'win_morning' : 'win_rain'); if (!im) return false;
      fit(im, x + 2, y - 14, w - 4, 44);
      if (!d.morning) rain(x + 8, y - 10, w - 16, 36, d.night ? 'rgba(170,190,240,0.35)' : 'rgba(255,255,255,0.5)');
      return true; }
    case 'picture': im = img('pic_' + (d.pic || 'lighthouse')); if (!im) return false; return fit(im, x + 3, y - 8, 26, 28);
    case 'wallimg': im = img(d.img); if (!im) return false; return fit(im, x + 3, y - 6, 26, 30);
    case 'floorimg': im = img(d.img); if (!im) return false; return fit(im, x, y + 4, (d.w || 1) * TILE, TILE - 6);
    case 'stairs': im = img('stairs_up'); if (!im) return false; ctx.drawImage(im, x, y - 4, (d.w || 2) * TILE, TILE + 4); return true;
    case 'vstairs': im = img('stairs_down'); if (!im) return false; ctx.drawImage(im, x, y, TILE, (d.h || 2) * TILE); return true;
    case 'thorns': if (d.gone && d.gone()) return true; im = img('thorns'); if (!im) return false;
      return fit(im, x - 8, y - 16, d.w * TILE + 16, TILE + 20);
    case 'uncolored': if (d.done && d.done()) return true; im = img('bridge_blank'); if (!im) return false;
      ctx.fillStyle = '#fbfaf5'; ctx.fillRect(x, y, d.w * TILE, d.h * TILE); ctx.drawImage(im, x, y - 6, d.w * TILE, d.h * TILE + 12); return true;
    case 'bridge': im = img('bridge'); if (!im) return false; ctx.drawImage(im, x, y - 6, d.w * TILE, d.h * TILE + 12); return true;
    case 'erased': { im = img('erased'); if (!im) return false; const r = (d.r || 40) * 1.4;
      // blank rubbed-out paper underneath, then the torn crayon edge + eraser crumbs on top
      ctx.fillStyle = '#fbfaf5'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.95, r * 0.66, 0, 0, 7); ctx.fill();
      Draw.imgFit(ctx, im, x - r * 1.3, y - r, r * 2.6, r * 2); return true; }
    case 'scribble': { const k = d.img || DOODLES[(d.x * 7 + d.y * 3) % DOODLES.length]; im = img(k); if (!im) return false;
      ctx.globalAlpha = 0.5; ctx.filter = 'grayscale(1) contrast(1.2)'; // read as pencil sketches on the blank page
      const s = 30 + (d.n || 10) * 2.4; return fit(im, x + 16 - s / 2, y + 16 - s / 2, s, s); }
    case 'frameart': return !!img('art_' + d.art); // the finished painting replaces the easel prop itself
  }
  return false;
}
// hand-drawn fallbacks (only used if a generated image is missing)
function drawDecoSketch(ctx, d, x, y, t) {
    ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round';
    switch (d.type) {
      case 'door': {
        ctx.fillStyle = d.open ? '#2a2230' : '#8a5f43'; Draw.wobbleRect(ctx, x + 3, y - 14, 26, 44, d.x * 7 + d.y, 0.8); ctx.fill(); ctx.stroke();
        if (!d.open) { ctx.fillStyle = '#e8c36a'; ctx.beginPath(); ctx.arc(x + 23, y + 10, 2.5, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.strokeRect(x + 8, y - 8, 16, 14); ctx.strokeRect(x + 8, y + 12, 16, 12); }
        else if (d.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffd48a'; ctx.fillRect(x + 5, y - 12, 22, 40); }
        break; }
      case 'window': {
        const w = (d.w || 1) * TILE - 8;
        ctx.fillStyle = d.night ? '#1d2440' : d.morning ? '#f6e4b8' : '#9fb0c4'; Draw.wobbleRect(ctx, x + 4, y - 10, w, 34, d.x, 0.8); ctx.fill(); ctx.stroke();
        if (!d.morning) { ctx.save(); Draw.wobbleRect(ctx, x + 4, y - 10, w, 34, d.x, 0.8); ctx.clip(); ctx.strokeStyle = d.night ? 'rgba(160,180,230,0.35)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
          for (let i = 0; i < 8; i++) { const rx = x + 4 + ((i * 13 + t * 1.3) % w), ry = y - 10 + ((i * 17 + t * 4) % 40); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 7); ctx.stroke(); } ctx.restore(); }
        ctx.beginPath(); ctx.moveTo(x + 4 + w / 2, y - 10); ctx.lineTo(x + 4 + w / 2, y + 24); ctx.moveTo(x + 4, y + 7); ctx.lineTo(x + 4 + w, y + 7); ctx.stroke();
        break; }
      case 'stairs': {
        const n = d.w || 2; ctx.fillStyle = '#9a7456';
        for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#a57d5e' : '#8f6a4e'; ctx.fillRect(x, y + k * 6.4, n * TILE, 6.4); }
        ctx.strokeRect(x, y, n * TILE, TILE); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y, n * TILE, 8);
        if (d.side) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y, n * TILE, 3); }
        break; }
      case 'vstairs': { // stairs on right side of a corridor going down
        for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#a57d5e' : '#8f6a4e'; ctx.fillRect(x + k * 6.4, y, 6.4, (d.h || 2) * TILE); }
        ctx.strokeRect(x, y, TILE, (d.h || 2) * TILE); break; }
      case 'picture': { ctx.fillStyle = '#d6c3a0'; Draw.wobbleRect(ctx, x + 6, y - 6, 20, 18, d.x + 3, 0.6); ctx.fill(); ctx.stroke(); ctx.fillStyle = d.col || '#9fc3a0'; ctx.fillRect(x + 10, y - 2, 12, 10); break; }
      case 'phone': { ctx.fillStyle = '#e8dcc0'; Draw.wobbleRect(ctx, x + 10, y - 4, 13, 20, 4, 0.5); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 16, y + 16); ctx.quadraticCurveTo(x + 22, y + 26, x + 14, y + 30); ctx.stroke(); break; }
      case 'fridge': { ctx.fillStyle = '#eef0ea'; Draw.wobbleRect(ctx, x + 2, y - 26, 28, 56, 8, 0.7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 2, y - 6); ctx.lineTo(x + 30, y - 6); ctx.stroke();
        ctx.fillStyle = '#f5f0e0'; ctx.fillRect(x + 8, y + 2, 12, 12); ctx.strokeRect(x + 8, y + 2, 12, 12); ctx.fillStyle = '#a5795a'; ctx.beginPath(); ctx.arc(x + 14, y + 8, 3.5, 0, 7); ctx.fill(); break; }
      case 'scribble': { // pencil doodles on paper worlds
        ctx.strokeStyle = d.col || 'rgba(90,90,90,0.5)'; ctx.lineWidth = 1.3; const r = $.seeded(d.x * 31 + d.y);
        ctx.beginPath(); let px = x + 16, py = y + 16; ctx.moveTo(px, py);
        for (let i = 0; i < (d.n || 10); i++) { px += (r() - 0.5) * 26; py += (r() - 0.5) * 14; ctx.lineTo(px, py); } ctx.stroke(); break; }
      case 'erased': { ctx.fillStyle = '#fbfaf5'; ctx.strokeStyle = 'rgba(160,150,140,0.5)'; ctx.lineWidth = 1.2; const r = $.seeded(d.x * 5 + d.y);
        ctx.beginPath(); for (let i = 0; i <= 14; i++) { const a = i / 14 * 6.283, q = (d.r || 40) * (0.8 + r() * 0.35); ctx.lineTo(x + Math.cos(a) * q * 1.3, y + Math.sin(a) * q * 0.8); } ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
      case 'thorns': { if (d.gone && d.gone()) break;
        ctx.strokeStyle = '#0b0a14'; ctx.lineWidth = 2.2; const r = $.seeded(d.x * 17 + d.y);
        for (let i = 0; i < d.w; i++) for (let k = 0; k < 4; k++) { const bx = x + i * TILE + r() * TILE, by = y + r() * TILE; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + (r() - 0.5) * 30, by - 20, bx + (r() - 0.5) * 30, by - 30 * r()); ctx.stroke(); }
        ctx.fillStyle = 'rgba(10,8,20,0.55)'; ctx.fillRect(x, y + 4, d.w * TILE, TILE - 8);
        break; }
      case 'uncolored': { // the bridge before coloring
        if (d.done && d.done()) break;
        ctx.fillStyle = '#fbfaf5'; ctx.fillRect(x, y, d.w * TILE, d.h * TILE); ctx.strokeStyle = 'rgba(90,90,90,0.6)'; ctx.setLineDash([4, 4]);
        ctx.strokeRect(x + 2, y + 2, d.w * TILE - 4, d.h * TILE - 4); ctx.setLineDash([]); break; }
      case 'frameart': { // finished gallery drawing
        if (!d.cond || d.cond()) { ctx.save(); ctx.globalAlpha = 0.95; drawFrameArt(ctx, d.art, x + 16, y - 26, t); ctx.restore(); }
        break; }
      case 'text': Draw.text(ctx, d.text, x, y, { size: d.size || 18, color: d.col || 'rgba(90,80,70,0.6)', align: 'center' }); break;
    }
}
function drawFrameArt(ctx, art, x, y, t) {
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.ink;
  if (art === 'garden') { ctx.fillStyle = '#bfe3a6'; ctx.fillRect(-15, -8, 30, 18); ctx.fillStyle = '#e25d4f'; for (const [a, b] of [[-8, 0], [0, -3], [8, 2]]) { ctx.beginPath(); ctx.arc(a, b, 3.5, 0, 7); ctx.fill(); } }
  if (art === 'tea') { ctx.fillStyle = '#c9dcef'; ctx.fillRect(-15, -8, 30, 18); ctx.fillStyle = '#fff'; ctx.fillRect(-10, -2, 8, 7); ctx.fillRect(2, -2, 8, 7); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-3, -9, -6, -12); ctx.stroke(); }
  if (art === 'song') { ctx.fillStyle = '#2e335a'; ctx.fillRect(-15, -8, 30, 18); ctx.fillStyle = '#f6d36b'; ctx.beginPath(); ctx.arc(8, -3, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `12px ${FONT}`; ctx.fillText('♪', -10, 4 + Math.sin(t / 15) * 1.5); }
  ctx.restore();
}

// ---------------------------------------------------------------- scripting helpers
const P = () => MapScene.player;
const EV = id => MapScene.ev(id);
const FOL = key => MapScene.followers.find(f => f.key === key);

async function give(id, n = 1, quiet = false) {
  G.addItem(id, n); Audio2.se('item');
  const nm = ITEMS[id].name;
  if (!quiet) await narrate(`Got {c:#b0761a}${nm}{/c}${n > 1 ? ' x' + n : ''}!`);
}
function emote(ch, e = '!', ms = 900) { if (!ch) return; ch.emote = e; ch.emoteT = MapScene.t; if (e === '!') Audio2.se('bell', 0.5); setTimeout(() => { if (ch.emote === e) ch.emote = null; }, ms); }
async function walk(ch, path, speed = 2) { await MapScene.moveChar(ch, path.split(' ').filter(Boolean), speed); }
function face(ch, dir) { if (ch) ch.dir = dir; }
function partyJoin(id) {
  if (!G.s.party.includes(id)) G.s.party.push(id);
  const a = G.actor(id); a.hp = a.mhp; a.wax = a.mwax;
  // match the leader's level (so new friends aren't useless)
  const lv = G.actor('wren').lv; if (a.lv < lv) { G.setLevel(a, lv); a.hp = a.mhp; a.wax = a.mwax; }
  const p = P(); const c = new Char({ key: id, x: p.x, y: p.y, dir: p.dir, h: id === 'moth' ? 50 : 52, solid: false });
  MapScene.followers.push(c);
}
async function savePoint() {
  Audio2.se('save'); G.healAll();
  await narrate('A ribbon bookmark, glowing softly. Resting here makes everyone feel better. {c:#6a9a5a}(HEART and WAX restored.){/c}');
  const c = await choose('Mark your place in the book?', ['Save', 'Not now'], 1);
  if (c === 0) {
    const ok = await G.save(); Audio2.se(ok ? 'page' : 'buzzer');
    await narrate(ok ? 'Your place is marked. (Saved)' : 'The bookmark won\'t stay put... (Saving failed: your browser blocked storage and the local server isn\'t reachable.)');
  }
}
async function shop(stock) {
  while (true) {
    const opts = stock.map(id => `${ITEMS[id].name} — ${ITEMS[id].price}★`).concat(['Leave']);
    const c = await choose(`What would you like, dear? (You have ${G.s.stars}★)`, opts, opts.length - 1, 'teacup');
    if (c === opts.length - 1) break;
    const id = stock[c];
    if (G.s.stars < ITEMS[id].price) { Audio2.se('buzzer'); await say('teacup', 'Oh dear, not quite enough stars. Worries drop them, you know.'); continue; }
    G.s.stars -= ITEMS[id].price; G.addItem(id); Audio2.se('item');
    await narrate(`Bought ${ITEMS[id].name}.`);
  }
}
async function sfxWait(se, f = 30) { Audio2.se(se); await wait(f); }

// simple NPC factory
function npc(id, key, x, y, run, o = {}) { return { id, char: key, x, y, dir: o.dir || 'down', run, h: o.h || 50, ...o }; }
function sign(id, x, y, text, prop = 'sign') { return { id, prop, x, y, run: () => narrate(text) }; }
function thing(id, x, y, run, o = {}) { return { id, x, y, run, ...o }; } // invisible interactable
function bookmark(id, x, y) { return { id, prop: 'bookmark', x, y, run: savePoint, light: 70, glow: 'rgba(255,120,110,0.9)' }; }
function worry(id, troop, x, y, o = {}) { return { id, enemy: troop, x, y, h: o.h || 46, ...o }; }

// finalize map definitions (called at boot from story files)
function defMap(id, def) {
  if (def.deco && !def.drawGround) def.drawGround = (ctx, cam, t) => drawDeco(def, ctx, cam, t);
  MAPS[id] = def;
  return def;
}
