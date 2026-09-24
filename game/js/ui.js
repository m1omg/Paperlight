// PAPERLIGHT — dialogue, choices, toasts
'use strict';

const SPEAKERS = {
  wren: { name: 'WREN', blip: 'blip', face: 'wren' },
  button: { name: 'BUTTON', blip: 'blip_button', face: 'button' },
  moth: { name: 'MOTH', blip: 'blip_moth', face: 'moth' },
  mom: { name: 'MOM', blip: 'blip_mom', face: 'mom' },
  owl: { name: 'STORYTELLER', blip: 'blip_owl', face: 'owl' },
  hush: { name: '???', blip: 'blip_hush' },
  eraser: { name: 'THE ERASER', blip: 'blip_hush' },
  mayor: { name: 'PENCIL MAYOR', blip: 'blip_button' },
  snail: { name: 'POSTMASTER SNAIL', blip: 'blip_mom' },
  crane: { name: 'PAPER CRANE', blip: 'blip_moth' },
  mushroom: { name: 'SLEEPY MUSHROOM', blip: 'blip_owl' },
  teacup: { name: 'TEACUP LADY', blip: 'blip_mom' },
  kitten: { name: 'YARN KITTEN', blip: 'blip_moth' },
};

// parse "{c:#f00}red{/c} {s}shaky{/s} {v}wavy{/v} {b}big{/b} {w:30}" into glyphs (styles carry across line breaks)
function parseText(str) {
  const out = []; let color = null, shake = false, wave = false, big = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '{') {
      const j = str.indexOf('}', i); if (j < 0) { out.push({ ch, color, shake, wave, big }); continue; }
      const tag = str.slice(i + 1, j); i = j;
      if (tag.startsWith('c:')) color = tag.slice(2); else if (tag === '/c') color = null;
      else if (tag === 's') shake = true; else if (tag === '/s') shake = false;
      else if (tag === 'v') wave = true; else if (tag === '/v') wave = false;
      else if (tag === 'b') big = true; else if (tag === '/b') big = false;
      else if (tag.startsWith('w:')) out.push({ wait: +tag.slice(2) });
      continue;
    }
    out.push({ ch, color, shake, wave, big });
  }
  return out;
}
// word-wrap glyphs into lines of at most maxW px (measured with the real font sizes)
function layoutText(ctx, text, maxW, size = 23) {
  const lines = [[]]; let lineW = 0, word = [], wordW = 0;
  ctx.save();
  const width = g => { ctx.font = `${g.big ? size + 7 : size}px ${FONT}`; return ctx.measureText(g.ch).width; };
  const cur = () => lines[lines.length - 1];
  const flush = () => {
    if (!word.length) return;
    if (lineW + wordW > maxW && cur().some(g => !g.wait && g.ch !== ' ')) {
      while (cur().length && cur()[cur().length - 1].ch === ' ') cur().pop(); // no trailing space
      lines.push([]); lineW = 0;
    }
    cur().push(...word); lineW += wordW; word = []; wordW = 0;
  };
  for (const g of parseText(text)) {
    if (g.wait !== undefined) { word.push(g); continue; }
    if (g.ch === '\n') { flush(); lines.push([]); lineW = 0; continue; }
    if (g.ch === ' ') { flush(); if (cur().length) { cur().push(g); lineW += width(g); } continue; }
    word.push(g); wordW += width(g);
  }
  flush(); ctx.restore();
  return lines;
}
// draw a laid-out set of lines (used by the dialogue box and the battle log)
function drawGlyphLines(ctx, lines, x, y, lh, size, t, shown = Infinity) {
  ctx.save(); ctx.textBaseline = 'alphabetic'; let n = 0;
  outer: for (let li = 0; li < lines.length; li++) {
    let cx = x;
    for (const g of lines[li]) {
      if (n++ >= shown) break outer;
      if (g.wait !== undefined) continue;
      let dx = 0, dy = 0;
      if (g.shake) { dx = $.rand(-1, 1); dy = $.rand(-1, 1); }
      if (g.wave) dy = Math.sin(t / 8 + n * 0.6) * 2;
      ctx.font = `${g.big ? size + 7 : size}px ${FONT}`; ctx.fillStyle = g.color || PAL.ink;
      ctx.fillText(g.ch, cx + dx, y + li * lh + dy);
      cx += ctx.measureText(g.ch).width;
    }
  }
  ctx.restore();
}

const Msg = {
  active: false, glyphs: [], shown: 0, t: 0, speaker: null, faceKey: null, resolve: null, speed: 1, waitT: 0,
  auto: false, top: false, pages: [], page: 0, LINES: 3,
  show(speakerStr, text, opts = {}) {
    let spk = null, faceIdx = 0;
    if (speakerStr) { const [k, f] = speakerStr.split(':'); spk = { key: k, ...(SPEAKERS[k] || { name: k.toUpperCase() }) }; faceIdx = f !== undefined ? +f : 0; }
    this.speaker = spk; this.faceIdx = faceIdx;
    this.faceKey = spk && spk.face && opts.face !== false ? spk.face : null;
    this.nameOverride = opts.name || null;
    this.top = !!opts.top;
    const lines = layoutText(Screen.ctx, text, this.faceKey ? 440 : 560, 23);
    this.pages = []; for (let i = 0; i < lines.length; i += this.LINES) this.pages.push(lines.slice(i, i + this.LINES));
    if (!this.pages.length) this.pages.push([[]]);
    this.active = true; this.speed = opts.speed || 1; this.auto = opts.auto || 0;
    this.blip = opts.blip || (spk && spk.blip) || 'blip';
    this.silent = !!opts.silent; this.hold = !!opts.hold;
    this.setPage(0);
    return new Promise(res => { this.resolve = res; });
  },
  setPage(i) {
    this.page = i; this.lines = this.pages[i]; this.glyphs = this.lines.flat();
    this.shown = 0; this.t = 0; this.waitT = 0; this.acc = 0; this.autoT = 0;
  },
  lastPage() { return this.page >= this.pages.length - 1; },
  pageDone() { return this.shown >= this.glyphs.length; },
  done() { return this.pageDone() && this.lastPage(); }, // whole message shown (used by choices)
  update() {
    if (!this.active) return;
    this.t++;
    if (!this.pageDone()) {
      if (Input.pressed('ok') || Input.pressed('cancel')) { this.shown = this.glyphs.length; Input.consume(); return; }
      if (Settings.textSpeed >= 99) { this.shown = this.glyphs.length; return; }
      if (this.waitT > 0) { this.waitT--; return; }
      this.acc += this.speed * Settings.textSpeed;
      while (this.acc >= 1 && !this.pageDone()) {
        this.acc -= 1;
        const g = this.glyphs[this.shown++];
        if (g.wait) { this.waitT = Math.round(g.wait / Settings.textSpeed); break; }
        if (!this.silent && g.ch !== ' ' && this.shown % 2 === 1) Audio2.se(this.blip, 0.55, $.rand(0.94, 1.06));
        if ('.,!?'.includes(g.ch)) { this.waitT = Math.round((g.ch === ',' ? 4 : 8) / Settings.textSpeed); break; }
      }
    } else {
      if (!this.lastPage()) { // more of this message: continue on the next page
        if (this.auto ? ++this.autoT >= this.auto : (Input.pressed('ok') || Input.pressed('cancel'))) { Input.consume(); Audio2.se('cursor', 0.3); this.setPage(this.page + 1); }
        return;
      }
      if (this.hold) return;
      if (this.auto) { if (++this.autoT >= this.auto) this.close(); return; }
      if (Input.pressed('ok') || Input.pressed('cancel')) { Input.consume(); Audio2.se('cursor', 0.4); this.close(); }
    }
  },
  close() { this.active = false; const r = this.resolve; this.resolve = null; r && r(); },
  draw(ctx) {
    if (!this.active) return;
    const bx = 16, bw = W - 32, bh = 118, by = this.top ? 14 : H - bh - 12;
    Draw.box(ctx, bx, by, bw, bh, { seed: 5 });
    let tx = bx + 22;
    if (this.faceKey) {
      const im = faceImg(this.faceKey, this.faceIdx);
      ctx.save(); ctx.fillStyle = '#efe4cc'; Draw.wobbleRect(ctx, bx + 12, by + 10, 98, 98, 17); ctx.fill(); ctx.clip();
      Draw.imgFit(ctx, im, bx + 12, by + 10, 98, 98);
      ctx.restore(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2; Draw.wobbleRect(ctx, bx + 12, by + 10, 98, 98, 17); ctx.stroke();
      tx = bx + 124;
    }
    const name = this.nameOverride || (this.speaker && this.speaker.name);
    if (name) {
      const nw = Draw.measure(ctx, name, 20) + 26;
      Draw.box(ctx, bx + (this.faceKey ? 118 : 12), by - 20, nw, 30, { seed: 9, fill: PAL.cream });
      Draw.text(ctx, name, bx + (this.faceKey ? 131 : 25), by + 2, { size: 20, bold: true });
    }
    drawGlyphLines(ctx, this.lines, tx, by + 36, 27, 23, this.t, this.shown);
    if (this.pageDone() && !this.auto) {
      const o = Math.sin(this.t / 7) * 2;
      ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.moveTo(bx + bw - 26, by + bh - 20 + o); ctx.lineTo(bx + bw - 16, by + bh - 20 + o); ctx.lineTo(bx + bw - 21, by + bh - 13 + o); ctx.fill();
      if (!this.lastPage()) { ctx.beginPath(); ctx.moveTo(bx + bw - 26, by + bh - 28 + o); ctx.lineTo(bx + bw - 16, by + bh - 28 + o); ctx.lineTo(bx + bw - 21, by + bh - 21 + o); ctx.fill(); }
    }
  },
};

const Choice = {
  active: false, opts: [], idx: 0, t: 0, resolve: null, cancel: -1,
  show(opts, { cancel = -1, x = null, y = null, title = null } = {}) {
    this.opts = opts; this.idx = 0; this.t = 0; this.cancel = cancel; this.active = true; this.title = title;
    this.px = x; this.py = y;
    return new Promise(res => { this.resolve = res; });
  },
  update() {
    if (!this.active) return; this.t++;
    if (Input.rep('up')) { this.idx = (this.idx + this.opts.length - 1) % this.opts.length; Audio2.se('cursor'); }
    if (Input.rep('down')) { this.idx = (this.idx + 1) % this.opts.length; Audio2.se('cursor'); }
    if (Input.pressed('ok')) { Input.consume(); Audio2.se('confirm'); this.finish(this.idx); }
    else if (Input.pressed('cancel') && this.cancel >= 0) { Input.consume(); Audio2.se('cancel'); this.finish(this.cancel); }
  },
  finish(i) { this.active = false; const r = this.resolve; this.resolve = null; r && r(i); },
  draw(ctx) {
    if (!this.active) return;
    const w = Math.max(160, ...this.opts.map(o => Draw.measure(ctx, o, 22) + 60));
    const h = this.opts.length * 32 + 20;
    const x = this.px ?? W - w - 24, y = this.py ?? (Msg.active ? H - 130 - h - 22 : H / 2 - h / 2);
    Draw.box(ctx, x, y, w, h, { seed: 13 });
    this.opts.forEach((o, i) => Draw.text(ctx, o, x + 40, y + 34 + i * 32, { size: 22, color: i === this.idx ? PAL.ink : '#7a6a66' }));
    Draw.cursor(ctx, x + 30, y + 27 + this.idx * 32, this.t);
  },
};

const Toast = {
  list: [],
  add(text, icon = null) { this.list.push({ text, t: 0, icon }); },
  update() { for (const t of this.list) t.t++; this.list = this.list.filter(t => t.t < 170); },
  draw(ctx) {
    this.list.forEach((t, i) => {
      const a = Math.min(1, t.t / 12, (170 - t.t) / 20);
      const w = Draw.measure(ctx, t.text, 20) + 40;
      const y = 16 + i * 44 - (1 - Math.min(1, t.t / 12)) * 20;
      Draw.box(ctx, W / 2 - w / 2, y, w, 36, { alpha: a, seed: 21, fill: PAL.cream });
      Draw.text(ctx, t.text, W / 2, y + 25, { size: 20, align: 'center', alpha: a });
    });
  },
};

// scripting sugar
const say = (who, text, opts) => Msg.show(who, text, opts);
const narrate = (text, opts) => Msg.show(null, text, opts);
async function choose(question, opts, cancel = -1, who = null) {
  // show the question in the message box (all of it) and the options beside it
  const p = Msg.show(who, question, { hold: true });
  await until(() => Msg.done());
  const r = await Choice.show(opts, { cancel });
  Msg.close(); await p;
  return r;
}
