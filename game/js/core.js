// PAPERLIGHT — core: canvas, loop, input, assets, audio, tweens, helpers
'use strict';

const W = 640, H = 480, TILE = 32, RES = 2;

const $ = {
  rand: (a, b) => a + Math.random() * (b - a),
  irand: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  ease: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  // deterministic pseudo random (for procedural art)
  seeded(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
};

// ---------------------------------------------------------------- canvas
const Screen = {
  init() {
    this.canvas = document.getElementById('game');
    this.canvas.width = W * RES; this.canvas.height = H * RES;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    const fit = () => {
      const s = Math.min(window.innerWidth / W, window.innerHeight / H);
      this.canvas.style.width = Math.floor(W * s) + 'px';
      this.canvas.style.height = Math.floor(H * s) + 'px';
    };
    window.addEventListener('resize', fit); fit();
  },
  begin() { const c = this.ctx; c.setTransform(RES, 0, 0, RES, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; return c; },
  makeLayer(w = W, h = H) {
    const cv = document.createElement('canvas'); cv.width = w * RES; cv.height = h * RES;
    const cx = cv.getContext('2d'); cx.setTransform(RES, 0, 0, RES, 0, 0); return { cv, cx, w, h };
  },
};

// ---------------------------------------------------------------- input
const Input = {
  map: {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyE: 'ok', KeyX: 'cancel', Escape: 'cancel', Backspace: 'cancel', KeyQ: 'cancel',
    ShiftLeft: 'run', ShiftRight: 'run', KeyC: 'menu', KeyM: 'menu', F4: 'fullscreen',
  },
  held: {}, hit: {}, repeatT: {},
  init() {
    window.addEventListener('keydown', e => {
      const a = this.map[e.code]; if (!a) return;
      e.preventDefault();
      if (!this.held[a]) { this.hit[a] = true; this.repeatT[a] = 0; }
      this.held[a] = true;
      Audio2.unlock();
      if (a === 'fullscreen') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
    });
    window.addEventListener('keyup', e => { const a = this.map[e.code]; if (a) this.held[a] = false; });
    window.addEventListener('blur', () => { this.held = {}; });
    window.addEventListener('mousedown', () => Audio2.unlock());
  },
  // pressed this frame
  pressed(a) { return !!this.hit[a]; },
  down(a) { return !!this.held[a]; },
  // pressed with key-repeat (for menus)
  rep(a) {
    if (this.hit[a]) return true;
    if (this.held[a]) { const t = this.repeatT[a]; return t > 22 && t % 5 === 0; }
    return false;
  },
  endFrame() { for (const k in this.held) if (this.held[k]) this.repeatT[k] = (this.repeatT[k] || 0) + 1; this.hit = {}; },
  consume() { this.hit = {}; },
  dir() {
    if (this.held.up) return 'up'; if (this.held.down) return 'down';
    if (this.held.left) return 'left'; if (this.held.right) return 'right'; return null;
  },
};

// ---------------------------------------------------------------- assets
const Assets = {
  img: {}, missing: new Set(), pending: 0,
  load(key, src) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => { this.img[key] = im; res(); };
      im.onerror = () => { this.missing.add(key); res(); };
      im.src = src;
    });
  },
  get(key) { return this.img[key] || null; },
  async loadAll(list, onProgress) {
    let done = 0;
    await Promise.all(list.map(([k, s]) => this.load(k, s).then(() => onProgress && onProgress(++done / list.length))));
  },
};

// ---------------------------------------------------------------- audio
const Audio2 = {
  ctx: null, useWA: false, buffers: {}, els: {}, manifest: { bgm: {}, se: [] },
  vol: { bgm: 0.7, se: 0.8 }, cur: null, curName: null, unlocked: false,
  async init() {
    try { const s = localStorage.getItem('paperlight_vol'); if (s) Object.assign(this.vol, JSON.parse(s)); } catch (e) {}
    try {
      const r = await fetch('audio/manifest.json');
      this.manifest = await r.json(); this.useWA = true;
    } catch (e) {
      this.useWA = false; // file:// — fall back to <audio>
      if (window.AUDIO_MANIFEST) this.manifest = window.AUDIO_MANIFEST;
    }
    if (this.useWA) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.useWA = false; }
    }
    if (this.useWA) {
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain(); this.bgmGain.connect(this.master);
      this.seGain = this.ctx.createGain(); this.seGain.connect(this.master);
      this.applyVol();
      // SE are small: preload now. BGM loads lazily.
      for (const n of this.manifest.se || []) this.loadBuf('se/' + n);
    }
  },
  saveVol() { try { localStorage.setItem('paperlight_vol', JSON.stringify(this.vol)); } catch (e) {} this.applyVol(); },
  applyVol() {
    if (this.useWA) { this.bgmGain.gain.value = this.vol.bgm; this.seGain.gain.value = this.vol.se; }
    if (this.cur && this.cur.el) this.cur.el.volume = this.vol.bgm * this.cur.baseVol * this.cur.fade;
  },
  unlock() { if (this.unlocked) return; this.unlocked = true; if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); if (this.wantBgm) { const w = this.wantBgm; this.wantBgm = null; this.bgm(w.name, w.fade, true); } },
  loadBuf(path) {
    if (this.buffers[path]) return this.buffers[path];
    const p = fetch('audio/' + path + '.ogg').then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(ab => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej))).catch(() => null);
    this.buffers[path] = p; return p;
  },
  se(name, vol = 1, rate = 1) {
    if (!this.unlocked) return;
    if (this.useWA) {
      const p = this.buffers['se/' + name]; if (!p) return;
      p.then(buf => {
        if (!buf) return;
        const s = this.ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
        const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.seGain); s.start();
      });
    } else {
      let base = this.els['se/' + name];
      if (!base) { base = this.els['se/' + name] = new Audio('audio/se/' + name + '.ogg'); }
      const a = base.cloneNode(); a.volume = $.clamp(vol * this.vol.se, 0, 1); a.playbackRate = rate; a.play().catch(() => {});
    }
  },
  bgm(name, fade = 40, force = false) {
    if (!force && this.curName === name) return;
    if (!this.unlocked) { this.wantBgm = { name, fade }; this.curName = name; return; }
    this.stopBgm(fade);
    this.curName = name;
    if (!name) return;
    const info = (this.manifest.bgm || {})[name] || { loop: true, vol: 0.8 };
    const baseVol = info.vol ?? 0.8, loop = info.loop !== false;
    const token = {}; this.cur = { token, baseVol, fade: 1, name };
    if (this.useWA) {
      this.loadBuf('bgm/' + name).then(buf => {
        if (!buf || this.cur.token !== token) return;
        const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop;
        const g = this.ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.bgmGain);
        const t = this.ctx.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(baseVol, t + Math.max(0.05, fade / 60));
        s.start(); this.cur.src = s; this.cur.gain = g;
      });
    } else {
      const el = new Audio('audio/bgm/' + name + '.ogg'); el.loop = loop; el.volume = 0;
      el.play().catch(() => {}); this.cur.el = el; this.cur.fade = 0;
      const tgt = this.cur; const step = () => { if (this.cur !== tgt) return; tgt.fade = Math.min(1, tgt.fade + 1 / Math.max(1, fade)); this.applyVol(); if (tgt.fade < 1) requestAnimationFrame(step); };
      step();
    }
  },
  stopBgm(fade = 40) {
    const c = this.cur; this.cur = null; this.curName = null;
    if (!c) return;
    if (c.src) {
      const t = this.ctx.currentTime; c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(c.gain.gain.value, t);
      c.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.03, fade / 60)); c.src.stop(t + Math.max(0.03, fade / 60) + 0.05);
    }
    if (c.el) {
      const el = c.el; let v = el.volume; const d = v / Math.max(1, fade);
      const step = () => { v -= d; if (v <= 0) { el.pause(); return; } el.volume = Math.max(0, v); requestAnimationFrame(step); }; step();
    }
  },
  // duck the current bgm (for jingles)
  duck(on) {
    const c = this.cur; if (!c) return;
    if (c.gain) { const t = this.ctx.currentTime; c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(c.gain.gain.value, t); c.gain.gain.linearRampToValueAtTime(on ? 0 : c.baseVol, t + 0.4); }
    if (c.el) { c.fade = on ? 0 : 1; this.applyVol(); }
  },
  jingle(name) {
    if (!this.unlocked) return;
    if (this.useWA) {
      this.loadBuf('bgm/' + name).then(buf => {
        if (!buf) return; const s = this.ctx.createBufferSource(); s.buffer = buf;
        const g = this.ctx.createGain(); g.gain.value = ((this.manifest.bgm || {})[name] || {}).vol ?? 0.8;
        s.connect(g); g.connect(this.bgmGain); s.start();
      });
    } else { const a = new Audio('audio/bgm/' + name + '.ogg'); a.volume = this.vol.bgm * 0.8; a.play().catch(() => {}); }
  },
};

// ---------------------------------------------------------------- frame-based task system
// Scripts are async functions. They await promises that resolve after N frames or conditions.
const Tasks = {
  list: [],
  add(fn) { this.list.push(fn); },
  update() { const l = this.list; this.list = []; for (const f of l) if (f() !== true) this.list.push(f); },
};
const wait = n => new Promise(res => { let t = n; Tasks.add(() => { if (--t <= 0) { res(); return true; } }); });
const until = cond => new Promise(res => Tasks.add(() => { if (cond()) { res(); return true; } }));
function tween(obj, props, frames, easeFn = $.ease) {
  const from = {}; for (const k in props) from[k] = obj[k];
  let t = 0;
  return new Promise(res => Tasks.add(() => {
    t++; const k = easeFn(Math.min(1, t / frames));
    for (const p in props) obj[p] = from[p] + (props[p] - from[p]) * k;
    if (t >= frames) { res(); return true; }
  }));
}

// ---------------------------------------------------------------- screen effects (global)
const FX = {
  fade: 0, fadeColor: '#000', shake: 0, flash: 0, flashColor: '#fff', tint: null,
  async fadeOut(frames = 30, color = '#000') { this.fadeColor = color; await tween(this, { fade: 1 }, frames, t => t); },
  async fadeIn(frames = 30) { await tween(this, { fade: 0 }, frames, t => t); },
  doShake(p = 6) { this.shake = Math.max(this.shake, p); },
  doFlash(color = '#fff', a = 0.8) { this.flashColor = color; this.flash = a; },
  update() { this.shake *= 0.85; if (this.shake < 0.3) this.shake = 0; this.flash *= 0.88; if (this.flash < 0.01) this.flash = 0; },
  offset() { return this.shake ? [$.rand(-this.shake, this.shake), $.rand(-this.shake, this.shake)] : [0, 0]; },
  drawOver(ctx) {
    if (this.flash) { ctx.globalAlpha = this.flash; ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.fade) { ctx.globalAlpha = this.fade; ctx.fillStyle = this.fadeColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  },
};
