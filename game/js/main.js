// PAPERLIGHT — boot, main loop, title, cards, CGs, credits
'use strict';

const PROP_SHEETS = {
  props_house1: ['bed', 'wardrobe', 'box', 'boxes', 'piano', 'gclock', 'bookshelf', 'armchair', 'sidetable'],
  props_house2: ['counter', 'stove', 'table', 'plant', 'chair', 'rug', 'ladder', 'trunk', 'desk'],
  props_house3: ['counter2', 'phototable', 'nightstand', 'soupstove', 'fridge', 'booktrunk', 'owleasel', 'xmasbox', 'phonetable'],
  // wall & ground details (doors, windows, pictures, stairs, bushes, doodles...)
  deco_house: ['door', 'doorway', 'doorway_lit', 'win_rain', 'win_night', 'win_morning', 'pic_lighthouse', 'pic_rose', 'pic_sea'],
  deco_house2: ['pic_dandelion', 'pic_lanternkid', 'win_round', 'stairs_up', 'stairs_down', 'doormat', 'coathook', 'wallclock', 'switch'],
  deco_dream: ['thorns', 'bridge', 'bridge_blank', 'art_garden', 'art_tea', 'art_song', 'bush_green', 'bush_night', 'bush_sketch'],
  deco_dream2: ['erased', 'doodle_sun', 'doodle_house', 'doodle_bird', 'doodle_star', 'doodle_boat', 'doodle_path', 'doodle_cat', 'doodle_tree'],
  props_dream1: ['tree', 'pine', 'bush', 'mushhouse', 'sign', 'lamppost', 'rock', 'well', 'fence'],
  props_dream2: ['darktree', 'lanterntree', 'bluemush', 'teahouse', 'stump', 'bookmark', 'mailbox', 'easel', 'bookstack'],
  props_dream3: ['sketchtree', 'sketchhouse', 'frame', 'paperball', 'pencil', 'eraserblock', 'sketchlamp', 'inkbottle', 'gate'],
  icons: ['crayon_r', 'crayon_y', 'crayon_b', 'lantern', 'cookie', 'tea', 'key', 'letter', 'candy'],
};
const NPC_NAMES = ['snail', 'mushroom', 'teacup', 'crane', 'mayor', 'kitten'];

function assetList() {
  const L = [];
  for (const k of ['wren', 'button', 'moth', 'mom']) for (const d of ['down', 'left', 'right', 'up']) L.push([`c_${k}_${d}`, `img/chars/${k}_${d}.webp`]);
  L.push(['c_owl_down', 'img/chars/owl_down.webp']);
  NPC_NAMES.forEach((n, i) => L.push([`c_${n}_down`, `img/chars/npc${i}.webp`]));
  for (const k of ['wren', 'button', 'moth', 'mom']) for (let i = 0; i < 4; i++) L.push([`f_${k}_${i}`, `img/faces/${k}_${i}.webp`]);
  L.push(['f_owl_0', 'img/faces/owl_0.webp']);
  for (const k of Object.keys(ENEMIES)) L.push([k, `img/enemies/${k}.webp`]);
  for (const k of ['bb_meadow', 'bb_forest', 'bb_eraser', 'bb_unfinished', 'bb_hush', 'title', 'cg_fall', 'cg_owl', 'cg_ending', 'cg_photo']) L.push([k, `img/bg/${k}.webp`]);
  // 'attic' and 'paper' use the procedural crayon textures (the generated ones didn't fit)
  for (const k of ['wood', 'wall', 'grass', 'path', 'forest', 'water', 'tile']) L.push(['tex_' + k, `img/tex/${k}.webp`]);
  for (const [sheet, names] of Object.entries(PROP_SHEETS)) names.forEach((n, i) => L.push([(sheet === 'icons' ? 'i_' : 'p_') + n, `img/props/${sheet}_${i}.webp`]));
  return L;
}

const Game = {
  scene: null, overlay: null, cg: null, transOverlay: null, frame: 0,
  async boot() {
    Screen.init(); Input.init();
    const ctx = Screen.begin();
    ctx.fillStyle = '#1d1b33'; ctx.fillRect(0, 0, W, H);
    try { await Promise.race([Promise.all([document.fonts.load('24px Gaegu'), document.fonts.load('bold 24px Gaegu'), document.fonts.load('24px "Patrick Hand"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
    await Audio2.init();
    await G.initSaves();
    await Assets.loadAll(assetList(), p => { const c = Screen.begin(); c.fillStyle = '#1d1b33'; c.fillRect(0, 0, W, H); Draw.bar(c, W / 2 - 120, H / 2, 240, 14, p, PAL.light, { back: 'rgba(255,255,255,0.1)' }); Draw.text(c, 'unfolding the pages...', W / 2, H / 2 - 16, { size: 22, align: 'center', color: '#fff4d6' }); });
    this.toTitle(true);
    // fixed 60fps update even on high-refresh screens
    let last = performance.now(), acc = 0;
    const tick = now => {
      acc += Math.min(100, now - last); last = now;
      let n = 0; while (acc >= 1000 / 60 && n < 4) { try { this.update(); } catch (e) { console.error(e); } acc -= 1000 / 60; n++; }
      try { this.draw(); } catch (e) { console.error(e); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
  update() {
    this.frame++;
    if (G.s && this.scene !== Title) G.s.playFrames++;
    Tasks.update();
    Choice.update();
    if (!Choice.active) Msg.update();
    if (this.overlay) this.overlay.update(); else if (this.scene && this.scene.update) this.scene.update();
    FX.update(); Toast.update();
    Input.endFrame();
  },
  draw() {
    const ctx = Screen.begin();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (this.scene) this.scene.draw(ctx);
    if (this.cg) this.drawCG(ctx);
    Toast.draw(ctx); // under menus, so a hint never covers an open menu
    if (this.overlay) this.overlay.draw(ctx);
    if (this.transOverlay) this.transOverlay.drawTransition(ctx);
    Msg.draw(ctx); Choice.draw(ctx);
    FX.drawOver(ctx);
    if (this.cardText) this.drawCard(ctx);
  },
  openMenu(mode = 'game') { Menu.open(mode); this.overlay = Menu; },
  toTitle(first = false) {
    Msg.active = false; Choice.active = false; this.cg = null; this.cardText = null; Tasks.list = []; FX.fade = 0;
    MapScene.reset(); this.overlay = null; Game.transOverlay = null;
    Title.enter(first); this.scene = Title;
  },
  // ---------------------------------------------------------------- CG
  async showCG(key, frames = 40) { this.cg = { key, a: 0 }; await tween(this.cg, { a: 1 }, frames); },
  async hideCG(frames = 40) { if (!this.cg) return; await tween(this.cg, { a: 0 }, frames); this.cg = null; },
  drawCG(ctx) {
    const im = Assets.get(this.cg.key); ctx.save(); ctx.globalAlpha = this.cg.a;
    if (im) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); Draw.imgCover(ctx, im, 0, 0, W, H); }
    else { // simple drawn fallback
      ctx.fillStyle = '#f7f1e3'; ctx.fillRect(0, 0, W, H);
      Draw.text(ctx, { cg_fall: '(falling into the pages)', cg_owl: '(the Storyteller\'s room)', cg_ending: '(Sunday morning)', cg_photo: '(an old photograph)' }[this.cg.key] || '', W / 2, H / 2, { size: 30, align: 'center', color: '#8a7a70' });
    }
    ctx.restore();
  },
  // ---------------------------------------------------------------- chapter card
  async card(title, sub, frames = 150) {
    Audio2.jingle('chapter');
    this.cardText = { title, sub, a: 0 };
    await tween(this.cardText, { a: 1 }, 40);
    await wait(frames);
    await tween(this.cardText, { a: 0 }, 40);
    this.cardText = null;
  },
  drawCard(ctx) {
    const c = this.cardText; ctx.save(); ctx.globalAlpha = c.a;
    ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,150,190,0.15)'; for (let y = 30; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    Draw.text(ctx, c.title, W / 2, H / 2 - 10, { size: 44, align: 'center', bold: true });
    Draw.text(ctx, c.sub, W / 2, H / 2 + 34, { size: 26, align: 'center', color: '#8a6a5a' });
    ctx.restore();
  },
};

// ---------------------------------------------------------------- title screen
const Title = {
  enter(first) {
    this.t = 0; this.idx = G.loadData() ? 1 : 0; this.pressed = !first; this.fade = 0;
    if (!first) Audio2.bgm('title', 30);
  },
  update() {
    this.t++;
    if (!this.pressed) { if (Input.pressed('ok') || Input.pressed('cancel')) { this.pressed = true; Input.consume(); Audio2.unlock(); Audio2.bgm('title', 60, true); Audio2.se('confirm'); } return; }
    if (this.busy) return;
    const opts = this.opts();
    if (Input.rep('up')) { this.idx = (this.idx + opts.length - 1) % opts.length; Audio2.se('cursor'); }
    if (Input.rep('down')) { this.idx = (this.idx + 1) % opts.length; Audio2.se('cursor'); }
    if (Input.pressed('ok')) {
      Input.consume(); const o = opts[this.idx];
      if (o.disabled) { Audio2.se('buzzer'); return; }
      Audio2.se('confirm'); this.busy = true;
      if (o.v === 'new') Story.newGame().finally(() => this.busy = false);
      else if (o.v === 'cont') Story.continueGame().finally(() => this.busy = false);
      else if (o.v === 'opt') { Game.openMenu('title'); this.busy = false; }
    }
  },
  opts() { return [{ label: 'NEW GAME', v: 'new' }, { label: 'CONTINUE', v: 'cont', disabled: !G.loadData() }, { label: 'OPTIONS', v: 'opt' }]; },
  draw(ctx) {
    const im = Assets.get('title');
    if (im) Draw.imgCover(ctx, im, 0, 0, W, H);
    else {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d1b3d'); g.addColorStop(1, '#4b3f6b'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const r = $.seeded(5); ctx.fillStyle = '#fff4d6';
      for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.4 + Math.sin(this.t / 30 + i) * 0.3; ctx.beginPath(); ctx.arc(r() * W, r() * H * 0.6, r() * 1.8 + 0.4, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      // open book
      ctx.save(); ctx.translate(W / 2, 380); ctx.fillStyle = '#fbf6ea'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 110, -30, s * 220, -10); ctx.lineTo(s * 220, 70); ctx.quadraticCurveTo(s * 110, 50, 0, 80); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      Draw.imgBottom(ctx, charImg('wren', 'down'), W / 2, 395, 90);
      Draw.imgBottom(ctx, charImg('button', 'down'), W / 2 - 80, 400, 64);
      Draw.imgBottom(ctx, charImg('moth', 'down'), W / 2 + 80, 400, 58);
    }
    // floating lantern glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + Math.sin(this.t / 40) * 0.05;
    const gg = ctx.createRadialGradient(W / 2, 320, 10, W / 2, 320, 260); gg.addColorStop(0, '#ffd27a'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H); ctx.restore();
    if (Game.overlay) return; // the options screen is open on top of the title
    // logo
    const bob = Math.sin(this.t / 50) * 3;
    Draw.text(ctx, 'PAPERLIGHT', W / 2, 92 + bob, { size: 76, align: 'center', bold: true, color: '#fff4d6', shadow: 'rgba(30,20,50,0.85)' });
    Draw.text(ctx, 'a story about the pages we leave blank', W / 2, 128 + bob, { size: 24, align: 'center', color: '#fff4d6', shadow: 'rgba(30,20,50,0.85)' });
    if (!this.pressed) {
      if (Math.floor(this.t / 40) % 2 === 0) Draw.text(ctx, 'press Z or Enter', W / 2, H - 40, { size: 24, align: 'center', color: '#fff', shadow: '#000' });
      return;
    }
    const opts = this.opts(); const bx = W / 2 - 90, by = H - 50 - opts.length * 34;
    Draw.box(ctx, bx, by - 12, 180, opts.length * 34 + 18, { seed: 3, alpha: 0.95 });
    opts.forEach((o, i) => Draw.text(ctx, o.label, bx + 42, by + 16 + i * 34, { size: 23, color: o.disabled ? '#b0a6a0' : PAL.ink, bold: i === this.idx }));
    Draw.cursor(ctx, bx + 32, by + 9 + this.idx * 34, this.t);
    Draw.text(ctx, 'v1.0', W - 10, H - 8, { size: 14, align: 'right', color: 'rgba(255,255,255,0.6)' });
  },
};

// ---------------------------------------------------------------- credits
const Credits = {
  lines: [],
  start(lines) { this.lines = lines; this.y = H + 20; this.t = 0; Game.scene = this; return new Promise(r => this.res = r); },
  update() { this.t++; this.y -= Input.down('ok') ? 2.4 : 0.6; if (this.y < -this.lines.length * 34 - 60) { const r = this.res; this.res = null; r && r(); } },
  draw(ctx) {
    ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,150,190,0.15)'; for (let y = 30; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    this.lines.forEach((l, i) => { const y = this.y + i * 34; if (y < -40 || y > H + 40) return; const big = l.startsWith('#'); Draw.text(ctx, big ? l.slice(1) : l, W / 2, y, { size: big ? 34 : 22, align: 'center', bold: big, color: big ? PAL.ink : '#6a5a55' }); });
  },
};

window.addEventListener('load', () => Game.boot());
