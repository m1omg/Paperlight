// PAPERLIGHT — drawing helpers: fonts, hand-drawn boxes, procedural crayon textures, fallback art
'use strict';

const FONT = '"Gaegu", "Patrick Hand", "Comic Sans MS", cursive';
const FONT2 = '"Patrick Hand", "Gaegu", "Comic Sans MS", cursive';

const PAL = {
  ink: '#3b2b2b', paper: '#fbf6ea', cream: '#f4ead2', shade: '#e2d5b8', mustard: '#e0a93b', rose: '#e48a8a',
  lilac: '#b9a4d8', sky: '#9cc7e6', leaf: '#86b66b', night: '#1d1b33', gold: '#f3cf6b', red: '#d8574f', blue: '#5a86c9',
  hp: '#e0667a', wax: '#6d9be0', calm: '#f1b3cf', light: '#f6d36b',
};

const Draw = {
  text(ctx, str, x, y, { size = 22, color = PAL.ink, align = 'left', font = FONT, bold = false, shadow = null, alpha = 1, base = 'alphabetic' } = {}) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
    ctx.textAlign = align; ctx.textBaseline = base;
    if (shadow) { ctx.fillStyle = shadow; ctx.fillText(str, x + 1.5, y + 1.5); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    ctx.restore();
  },
  measure(ctx, str, size = 22, font = FONT) { ctx.save(); ctx.font = `${size}px ${font}`; const w = ctx.measureText(str).width; ctx.restore(); return w; },

  // wobbly hand-drawn path around a rectangle
  wobbleRect(ctx, x, y, w, h, seed = 1, amp = 1.4) {
    const r = $.seeded(seed);
    const pts = [];
    const seg = (x0, y0, x1, y1) => {
      const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 24));
      for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + (r() - 0.5) * amp, y0 + (y1 - y0) * t + (r() - 0.5) * amp]); }
    };
    const c = 6;
    seg(x + c, y, x + w - c, y); seg(x + w - c, y, x + w, y + c); seg(x + w, y + c, x + w, y + h - c); seg(x + w, y + h - c, x + w - c, y + h);
    seg(x + w - c, y + h, x + c, y + h); seg(x + c, y + h, x, y + h - c); seg(x, y + h - c, x, y + c); seg(x, y + c, x + c, y);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  },
  // paper-style window used for dialogue / menus
  box(ctx, x, y, w, h, { fill = PAL.paper, stroke = PAL.ink, seed = 7, alpha = 1, lw = 2.5, dark = false } = {}) {
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; this.wobbleRect(ctx, x + 3, y + 4, w, h, seed + 3); ctx.fill();
    ctx.fillStyle = dark ? '#262338' : fill; this.wobbleRect(ctx, x, y, w, h, seed); ctx.fill();
    // faint paper lines
    if (!dark) {
      ctx.save(); this.wobbleRect(ctx, x, y, w, h, seed); ctx.clip();
      ctx.strokeStyle = 'rgba(120,150,190,0.12)'; ctx.lineWidth = 1;
      for (let ly = y + 26; ly < y + h; ly += 26) { ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke(); }
      ctx.restore();
    }
    ctx.strokeStyle = dark ? '#d9d2f0' : stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round';
    this.wobbleRect(ctx, x, y, w, h, seed); ctx.stroke();
    ctx.restore();
  },
  bar(ctx, x, y, w, h, frac, color, { back = 'rgba(60,40,40,0.18)', seed = 3 } = {}) {
    frac = $.clamp(frac, 0, 1);
    ctx.save();
    ctx.fillStyle = back; this.wobbleRect(ctx, x, y, w, h, seed, 0.8); ctx.fill();
    if (frac > 0) {
      ctx.save(); this.wobbleRect(ctx, x, y, w, h, seed, 0.8); ctx.clip();
      ctx.fillStyle = color; ctx.fillRect(x, y, w * frac, h);
      // crayon hatch on the fill
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
      for (let i = x - h; i < x + w * frac; i += 5) { ctx.beginPath(); ctx.moveTo(i, y + h); ctx.lineTo(i + h, y); ctx.stroke(); }
      ctx.restore();
    }
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5; this.wobbleRect(ctx, x, y, w, h, seed, 0.8); ctx.stroke();
    ctx.restore();
  },
  // blinking cursor hand / arrow
  cursor(ctx, x, y, t) {
    const o = Math.sin(t / 6) * 2.5;
    ctx.save(); ctx.translate(x + o, y);
    ctx.fillStyle = PAL.mustard; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(2, 0); ctx.lineTo(-10, 7); ctx.quadraticCurveTo(-7, 0, -10, -7); ctx.fill(); ctx.stroke();
    ctx.restore();
  },
  heart(ctx, x, y, s, color = PAL.hp) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 16, s / 16);
    ctx.fillStyle = color; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-9, -1, -7, -9, 0, -4); ctx.bezierCurveTo(7, -9, 9, -1, 0, 6); ctx.fill(); ctx.stroke();
    ctx.restore();
  },
  star(ctx, x, y, r, color = PAL.gold, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  },
  // image drawn to fit a height, anchored bottom-center
  imgBottom(ctx, im, x, y, h, { flip = false, alpha = 1, sx = 1, sy = 1, rot = 0 } = {}) {
    const w = im.width * h / im.height;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip ? -sx : sx, sy);
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
    return w;
  },
  imgFit(ctx, im, x, y, w, h, alpha = 1) {
    const s = Math.min(w / im.width, h / im.height); const dw = im.width * s, dh = im.height * s;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore();
  },
  imgCover(ctx, im, x, y, w, h) {
    const s = Math.max(w / im.width, h / im.height); const dw = im.width * s, dh = im.height * s;
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  },
  wrap(ctx, str, maxW, size = 22, font = FONT) {
    ctx.save(); ctx.font = `${size}px ${font}`;
    const out = [];
    for (const para of str.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test.replace(/\{[^}]*\}/g, '')).width > maxW && line) { out.push(line); line = word; } else line = test;
      }
      out.push(line);
    }
    ctx.restore(); return out;
  },
};

// ---------------------------------------------------------------- procedural crayon textures
const Tex = {
  cache: {},
  // crayon-stroke texture: base color + many short strokes of palette colors
  make(key, size, base, cols, { strokes = 900, len = 10, lw = 1.6, alpha = 0.35, dots = null, seed = 1, lines = null } = {}) {
    if (this.cache[key]) return this.cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d'); const r = $.seeded(seed);
    c.fillStyle = base; c.fillRect(0, 0, size, size);
    c.lineCap = 'round';
    // draw each stroke 9 times (wrapped) so the texture tiles seamlessly
    const wrapDraw = f => { for (let ox = -size; ox <= size; ox += size) for (let oy = -size; oy <= size; oy += size) f(ox, oy); };
    for (let i = 0; i < strokes; i++) {
      const x = r() * size, y = r() * size, a = (r() - 0.5) * 1.2 + (lines ? lines : 0), l = len * (0.5 + r());
      c.strokeStyle = cols[Math.floor(r() * cols.length)]; c.globalAlpha = alpha * (0.5 + r() * 0.8); c.lineWidth = lw * (0.6 + r() * 0.8);
      wrapDraw((ox, oy) => { c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); c.stroke(); });
    }
    if (dots) for (let i = 0; i < dots.n; i++) {
      const x = r() * size, y = r() * size, col = dots.cols[Math.floor(r() * dots.cols.length)], rr = dots.r * (0.6 + r() * 0.8);
      c.globalAlpha = 0.9; c.fillStyle = col;
      wrapDraw((ox, oy) => { c.beginPath(); for (let k = 0; k < 5; k++) { const an = k * 1.2566; c.moveTo(x + ox, y + oy); c.arc(x + ox + Math.cos(an) * rr, y + oy + Math.sin(an) * rr, rr * 0.6, 0, 7); } c.fill(); });
      c.fillStyle = '#f5d35a'; wrapDraw((ox, oy) => { c.beginPath(); c.arc(x + ox, y + oy, rr * 0.45, 0, 7); c.fill(); });
    }
    c.globalAlpha = 1;
    this.cache[key] = cv; return cv;
  },
  planks(key, size, base, line, seed = 3) {
    if (this.cache[key]) return this.cache[key];
    const cv = this.make(key + '_b', size, base, [line, '#fff4dd', '#6b4a33'], { strokes: 700, len: 22, lw: 1.2, alpha: 0.18, seed, lines: 0.0001 });
    const out = document.createElement('canvas'); out.width = out.height = size; const c = out.getContext('2d');
    c.drawImage(cv, 0, 0); const r = $.seeded(seed + 9);
    c.strokeStyle = line; c.lineWidth = 2; c.globalAlpha = 0.55;
    const ph = size / 8;
    for (let i = 0; i < 8; i++) {
      const y = i * ph; c.beginPath(); c.moveTo(0, y + 0.5); for (let x = 0; x <= size; x += 16) c.lineTo(x, y + 0.5 + (r() - 0.5) * 1.2); c.stroke();
      const off = r() * size; for (let k = 0; k < 2; k++) { const x = (off + k * size / 2) % size; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 2, y + ph); c.stroke(); }
    }
    this.cache[key] = out; return out;
  },
  get(name) {
    // prefer generated texture if present
    const gen = Assets.get('tex_' + name); if (gen) return gen;
    switch (name) {
      case 'wood': return this.planks('wood', 256, '#b98d64', '#6e4c34', 3);
      case 'attic': return this.planks('attic', 256, '#9d8a76', '#5e4f42', 5);
      case 'wall': return this.make('wall', 128, '#a9b4c3', ['#8f9bb0', '#c7cfdb', '#b6a7b7'], { strokes: 300, len: 8, alpha: 0.25, dots: { n: 10, r: 3, cols: ['#d8c7d6', '#c9d6c3'] }, seed: 11 });
      case 'tile': {
        if (this.cache.tile) return this.cache.tile;
        const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#dfe6d2' : '#f0ead9'; c.fillRect(x * 32, y * 32, 32, 32); }
        c.drawImage(this.make('tile_n', 128, 'rgba(0,0,0,0)', ['#9aa58a', '#fff'], { strokes: 250, len: 7, alpha: 0.2, seed: 4 }), 0, 0);
        this.cache.tile = cv; return cv;
      }
      case 'grass': return this.make('grass', 256, '#9bcf7a', ['#79b35e', '#b4dd8f', '#6aa257', '#c6e59e'], { strokes: 1400, len: 9, lw: 1.8, alpha: 0.45, seed: 21, lines: -1.3, dots: { n: 6, r: 2.4, cols: ['#fff', '#fbe38a', '#f5b7c8'] } });
      case 'path': return this.make('path', 128, '#e9cf9b', ['#d7b77e', '#f5e2b8', '#c9a46a'], { strokes: 500, len: 7, alpha: 0.4, seed: 31 });
      case 'forest': return this.make('forest', 256, '#27404a', ['#1f3340', '#35545a', '#2e4a3f', '#3c3f66'], { strokes: 1400, len: 9, lw: 1.8, alpha: 0.5, seed: 41, lines: -1.2 });
      case 'forestpath': return this.make('forestpath', 128, '#4a4f6b', ['#3d4260', '#5d6284', '#44475e'], { strokes: 500, len: 7, alpha: 0.45, seed: 42 });
      case 'paper': return this.make('paper', 256, '#f7f4ec', ['#b8b2a6', '#d6d0c2', '#9d978c'], { strokes: 240, len: 14, lw: 0.8, alpha: 0.28, seed: 51, lines: 0.8 });
      case 'water': return this.make('water', 128, '#7fb5e0', ['#a7d0f0', '#5f98cc', '#cfe7f7'], { strokes: 400, len: 12, lw: 1.6, alpha: 0.45, seed: 61, lines: 0.0001 });
      case 'rug': return this.make('rug', 128, '#c98f86', ['#b5746e', '#e2b3a3', '#9f6a64'], { strokes: 500, len: 8, alpha: 0.35, seed: 71 });
      case 'void': return this.make('void', 128, '#15131f', ['#221f33', '#0e0c16'], { strokes: 200, len: 10, alpha: 0.4, seed: 81 });
      case 'white': return this.make('white', 128, '#fdfcf8', ['#eeeae0'], { strokes: 60, len: 10, alpha: 0.3, seed: 91 });
    }
    return this.make('fallback', 64, '#ccc', ['#bbb'], {});
  },
};

// ---------------------------------------------------------------- fallback character art (used until GPT art exists)
const Fallback = {
  cache: {},
  // draws a chibi figure into a canvas, returns canvas (160x? logical px)
  char(key, dir) {
    const id = key + '_' + dir; if (this.cache[id]) return this.cache[id];
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 140; const c = cv.getContext('2d');
    c.lineWidth = 4; c.strokeStyle = PAL.ink; c.lineJoin = c.lineCap = 'round';
    const specs = {
      wren: { body: '#e0a93b', hair: '#4a3328', skin: '#f6dfcb', legs: '#555' },
      mom: { body: '#9a9a9f', hair: '#4a3328', skin: '#f2d9c4', legs: '#5a74a0', tall: true },
      button: { body: '#f4ecdc', skin: '#f4ecdc', ears: true, scarf: '#d8574f' },
      moth: { body: '#cdbfe6', skin: '#e4dcf3', wings: true },
      owl: { body: '#a5795a', skin: '#e9d8bd', owl: true },
    };
    const s = specs[key] || { body: '#aaa', skin: '#ddd', hair: '#777', legs: '#666' };
    const cx = 60, back = dir === 'up', side = dir === 'left' || dir === 'right';
    if (s.wings) { c.fillStyle = '#efe6fa'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(cx + sx * 34, 70, 26, 34, sx * 0.5, 0, 7); c.fill(); c.stroke(); } }
    // legs / body
    if (s.legs) { c.fillStyle = s.legs; c.fillRect(cx - 14, 108, 10, 24); c.strokeRect(cx - 14, 108, 10, 24); c.fillRect(cx + 4, 108, 10, 24); c.strokeRect(cx + 4, 108, 10, 24); }
    c.fillStyle = s.body; c.beginPath(); c.ellipse(cx, 100, s.tall ? 24 : 28, 26, 0, 0, 7); c.fill(); c.stroke();
    if (s.scarf) { c.fillStyle = s.scarf; c.beginPath(); c.ellipse(cx, 80, 24, 8, 0, 0, 7); c.fill(); c.stroke(); }
    if (s.ears) { c.fillStyle = s.skin; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(cx + sx * 14, 18, 8, 22, sx * 0.25, 0, 7); c.fill(); c.stroke(); } }
    // head
    c.fillStyle = s.skin; c.beginPath(); c.ellipse(cx, 52, 32, 30, 0, 0, 7); c.fill(); c.stroke();
    if (s.hair && !back) { c.fillStyle = s.hair; c.beginPath(); c.ellipse(cx, 36, 33, 20, 0, Math.PI, 0); c.fill(); c.stroke(); }
    if (s.hair && back) { c.fillStyle = s.hair; c.beginPath(); c.ellipse(cx, 50, 33, 31, 0, 0, 7); c.fill(); c.stroke(); }
    if (s.owl && !back) { c.fillStyle = '#fff'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(cx + sx * 12, 52, 9, 0, 7); c.fill(); c.stroke(); } }
    if (!back) {
      c.fillStyle = PAL.ink;
      const eo = side ? (dir === 'left' ? -10 : 10) : 0;
      if (!side || dir === 'left') { c.beginPath(); c.arc(cx - 11 + eo, 55, 3.5, 0, 7); c.fill(); }
      if (!side || dir === 'right') { c.beginPath(); c.arc(cx + 11 + eo, 55, 3.5, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(230,120,120,0.35)'; c.beginPath(); c.arc(cx - 18 + eo, 64, 5, 0, 7); c.arc(cx + 18 + eo, 64, 5, 0, 7); c.fill();
    }
    this.cache[id] = cv; return cv;
  },
  // generic blob enemy
  enemy(key) {
    if (this.cache['en_' + key]) return this.cache['en_' + key];
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; const c = cv.getContext('2d');
    const r = $.seeded(key.length * 77 + key.charCodeAt(0));
    const col = { en_dustbunny: '#b8b3ad', en_tangle: '#3a2a30', en_crow: '#8e939c', en_cloud: '#4f6699', en_mitten: '#cc4a44', en_clock: '#e3c27a', en_blot: '#1f1d29', en_sketchling: '#d9d6cf', boss_eraser: '#f1a8b5', boss_hush: '#f4f2ee' }[key] || '#999';
    c.lineWidth = 5; c.strokeStyle = PAL.ink; c.fillStyle = col;
    c.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = 70 + (r() - 0.5) * 18; c.lineTo(100 + Math.cos(a) * rr, 110 + Math.sin(a) * rr * 0.85); }
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(100 + sx * 22, 100, 13, 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = PAL.ink; for (const sx of [-1, 1]) { c.beginPath(); c.arc(100 + sx * 22, 103, 5, 0, 7); c.fill(); }
    this.cache['en_' + key] = cv; return cv;
  },
  face(key) {
    if (this.cache['face_' + key]) return this.cache['face_' + key];
    const src = this.char(key.split('_')[0], 'down');
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const c = cv.getContext('2d');
    c.drawImage(src, 0, 0, 120, 100, 4, 8, 120, 100);
    this.cache['face_' + key] = cv; return cv;
  },
  prop(name, w, h) {
    const id = 'prop_' + name + w + 'x' + h; if (this.cache[id]) return this.cache[id];
    const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const c = cv.getContext('2d'); c.scale(2, 2);
    const r = $.seeded(name.length * 31 + name.charCodeAt(0));
    const col = `hsl(${Math.floor(r() * 360)},35%,${60 + r() * 15}%)`;
    c.fillStyle = col; c.strokeStyle = PAL.ink; c.lineWidth = 2;
    Draw.wobbleRect(c, 2, 2, w - 4, h - 4, name.length, 1.5); c.fill(); c.stroke();
    this.cache[id] = cv; return cv;
  },
};

// sprite lookup with fallback
function charImg(key, dir) {
  return Assets.get(`c_${key}_${dir}`) || (dir === 'right' && Assets.get(`c_${key}_left`)) || Assets.get(`c_${key}_down`) || Fallback.char(key, dir);
}
function faceImg(key, i = 0) {
  return Assets.get(`f_${key}_${i}`) || Assets.get(`f_${key}_0`) || Fallback.face(key + '_' + i);
}
function enemyImg(key) { return Assets.get(key) || Fallback.enemy(key); }
