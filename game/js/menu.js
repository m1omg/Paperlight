// PAPERLIGHT — menus: in-game pause menu, and a settings-only screen for the title
'use strict';

// Player settings (persist in the browser; missing/blocked storage just means defaults)
const Settings = {
  textSpeed: 1, // 1 normal, 2 fast, 99 instant
  load() { try { Object.assign(this, JSON.parse(localStorage.getItem('paperlight_settings') || '{}')); } catch (e) {} },
  save() { try { localStorage.setItem('paperlight_settings', JSON.stringify({ textSpeed: this.textSpeed })); } catch (e) {} },
};
Settings.load();
const TEXT_SPEEDS = [[1, 'Normal'], [2, 'Fast'], [99, 'Instant']];
const FIELD_SKILLS = { mend: 0.45, glowdust: 0.35, glow: 0.15, wakeup: 0.5 }; // usable outside battle

const Menu = {
  // mode 'game' = pause menu on the map; mode 'title' = settings only (no game is loaded yet)
  open(mode = 'game') {
    this.mode = mode; this.idx = 0; this.sub = 0; this.who = 0; this.who2 = 0; this.t = 0; this.anim = 0; this.fx = null;
    this.state = mode === 'title' ? 'options' : 'main';
    tween(this, { anim: 1 }, 10); Audio2.se('page', 0.7);
  },
  // the real world has no lantern magic, so SKILLS only appears inside the Book
  inBook() { return !!(MapScene.map && MapScene.map.dream); },
  cmds() { return this.inBook() && G.hasItem('lantern') ? ['ITEMS', 'SKILLS', 'STATUS', 'OPTIONS', 'TITLE'] : ['ITEMS', 'STATUS', 'OPTIONS', 'TITLE']; },
  close() { Audio2.se('cancel'); Game.overlay = null; },
  back() { if (this.mode === 'title') this.close(); else { Audio2.se('cancel'); this.state = 'main'; } },
  optionRows() { return ['Music', 'Sounds', 'Text speed', 'Fullscreen', 'Back']; },
  update() {
    this.t++;
    if (this.fx && ++this.fx.t > 50) this.fx = null;
    const S = this.state;
    const nav = (n, key = 'idx') => {
      if (Input.rep('up')) { this[key] = (this[key] + n - 1) % n; Audio2.se('cursor'); }
      if (Input.rep('down')) { this[key] = (this[key] + 1) % n; Audio2.se('cursor'); }
    };
    if (S === 'main') {
      const cmds = this.cmds(); this.idx = Math.min(this.idx, cmds.length - 1);
      nav(cmds.length);
      if (Input.pressed('cancel') || Input.pressed('menu')) { Input.consume(); this.close(); return; }
      if (Input.pressed('ok')) {
        Input.consume(); Audio2.se('confirm');
        this.state = { ITEMS: 'items', SKILLS: 'skills', STATUS: 'status', OPTIONS: 'options', TITLE: 'title' }[cmds[this.idx]];
        this.sub = 0; this.who = 0;
      }
    } else if (S === 'items') {
      const list = this.itemList(); this.sub = Math.min(this.sub, Math.max(0, list.length - 1));
      if (!list.length) { if (Input.pressed('cancel') || Input.pressed('ok')) { Input.consume(); this.back(); } return; }
      nav(list.length, 'sub');
      if (Input.pressed('cancel')) { Input.consume(); this.back(); }
      else if (Input.pressed('ok')) {
        Input.consume(); const id = list[this.sub]; const it = ITEMS[id];
        if (it.key || !it.target) { Audio2.se('buzzer'); return; }
        this.pending = { type: 'item', id };
        if (it.target === 'allies') this.applyPending(null);
        else { Audio2.se('confirm'); this.state = 'target'; this.who2 = 0; }
      }
    } else if (S === 'skills') {
      const party = G.s.party;
      if (Input.rep('left')) { this.who = (this.who + party.length - 1) % party.length; this.sub = 0; Audio2.se('cursor'); }
      if (Input.rep('right')) { this.who = (this.who + 1) % party.length; this.sub = 0; Audio2.se('cursor'); }
      const sk = G.skillsOf(party[this.who]); nav(sk.length, 'sub');
      if (Input.pressed('cancel')) { Input.consume(); this.back(); }
      else if (Input.pressed('ok')) {
        Input.consume(); const s = sk[this.sub]; const a = G.actor(party[this.who]);
        if (!(s in FIELD_SKILLS)) { Audio2.se('buzzer'); this.note('Only in battle.'); return; }
        if (a.wax < SKILLS[s].wax) { Audio2.se('buzzer'); this.note('Not enough WAX.'); return; }
        this.pending = { type: 'skill', id: s, user: a };
        if (SKILLS[s].target === 'allies') this.applyPending(null);
        else { Audio2.se('confirm'); this.state = 'target'; this.who2 = 0; }
      }
    } else if (S === 'target') {
      const n = G.s.party.length;
      if (Input.rep('left') || Input.rep('up')) { this.who2 = (this.who2 + n - 1) % n; Audio2.se('cursor'); }
      if (Input.rep('right') || Input.rep('down')) { this.who2 = (this.who2 + 1) % n; Audio2.se('cursor'); }
      if (Input.pressed('cancel')) { Input.consume(); Audio2.se('cancel'); this.state = this.pending.type === 'item' ? 'items' : 'skills'; }
      else if (Input.pressed('ok')) { Input.consume(); this.applyPending(G.actor(G.s.party[this.who2])); }
    } else if (S === 'status') {
      const n = G.s.party.length;
      if (Input.rep('left') || Input.rep('up')) { this.who = (this.who + n - 1) % n; Audio2.se('cursor'); }
      if (Input.rep('right') || Input.rep('down')) { this.who = (this.who + 1) % n; Audio2.se('cursor'); }
      if (Input.pressed('cancel') || Input.pressed('ok')) { Input.consume(); this.back(); }
    } else if (S === 'options') {
      const rows = this.optionRows(); nav(rows.length, 'sub');
      const row = rows[this.sub], L = Input.rep('left'), R = Input.rep('right');
      if (row === 'Music' || row === 'Sounds') {
        const k = row === 'Music' ? 'bgm' : 'se';
        if (L || R) { Audio2.vol[k] = $.clamp(Math.round((Audio2.vol[k] + (L ? -0.1 : 0.1)) * 10) / 10, 0, 1); Audio2.saveVol(); Audio2.se('cursor'); }
      } else if (row === 'Text speed' && (L || R || Input.pressed('ok'))) {
        const i = TEXT_SPEEDS.findIndex(([v]) => v === Settings.textSpeed);
        Settings.textSpeed = TEXT_SPEEDS[(i + (L ? TEXT_SPEEDS.length - 1 : 1)) % TEXT_SPEEDS.length][0]; Settings.save(); Audio2.se('cursor'); Input.consume();
      } else if (row === 'Fullscreen' && Input.pressed('ok')) {
        Input.consume(); Audio2.se('confirm');
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
      }
      if (Input.pressed('cancel') || (Input.pressed('ok') && row === 'Back')) { Input.consume(); this.back(); }
    } else if (S === 'title') {
      nav(2, 'sub');
      if (Input.pressed('cancel') || (Input.pressed('ok') && this.sub === 1)) { Input.consume(); this.back(); }
      else if (Input.pressed('ok') && this.sub === 0) {
        Input.consume(); Game.overlay = null; Audio2.stopBgm(30);
        FX.fadeOut(30).then(() => { Game.toTitle(); FX.fadeIn(30); });
      }
    }
  },
  note(text) { this.fx = { text, t: 0, i: -1 }; },
  itemList() { return [...Object.keys(G.s.items), ...G.s.keyItems]; },
  applyPending(target) {
    const p = this.pending; const party = G.partyActors();
    const results = [];
    if (p.type === 'item') {
      const it = ITEMS[p.id]; const ts = it.target === 'allies' ? party : [target];
      for (const a of ts) {
        if (it.revive) { if (a.fallen) { a.fallen = false; a.hp = Math.round(a.mhp * it.revive); results.push([a, 'UP!']); } continue; }
        if (a.fallen) continue;
        if (it.heal && a.hp < a.mhp) { const v = Math.min(a.mhp - a.hp, it.heal); a.hp += v; results.push([a, '+' + v]); }
        if (it.wax && a.wax < a.mwax) { const v = Math.min(a.mwax - a.wax, it.wax); a.wax += v; results.push([a, '+' + v + ' WAX']); }
      }
      if (!results.length) { Audio2.se('buzzer'); this.note(it.revive ? 'Nobody needs waking up.' : 'Nobody needs that right now.'); return; }
      G.removeItem(p.id); Audio2.se('heal');
      if (!G.hasItem(p.id)) { this.state = 'items'; }
    } else {
      const s = p.id, u = p.user; const ts = SKILLS[s].target === 'allies' ? party : [target];
      for (const a of ts) {
        if (s === 'wakeup') { if (a.fallen) { a.fallen = false; a.hp = Math.round(a.mhp * FIELD_SKILLS.wakeup); results.push([a, 'UP!']); } continue; }
        if (a.fallen || a.hp >= a.mhp) continue;
        const v = Math.min(a.mhp - a.hp, Math.round(a.mhp * FIELD_SKILLS[s])); a.hp += v; results.push([a, '+' + v]);
      }
      if (!results.length) { Audio2.se('buzzer'); this.note(s === 'wakeup' ? 'Nobody needs waking up.' : 'Everyone is already fine.'); return; }
      u.wax -= SKILLS[s].wax; Audio2.se('heal');
      if (SKILLS[s].target !== 'allies') this.state = 'skills';
    }
    this.fx = { t: 0, results: results.map(([a, txt]) => [G.s.party.indexOf(a.id), txt]) };
  },
  // ---------------------------------------------------------------- drawing
  draw(ctx) {
    ctx.save(); ctx.globalAlpha = (this.mode === 'title' ? 0.72 : 0.35) * this.anim; ctx.fillStyle = '#1b1830'; ctx.fillRect(0, 0, W, H); ctx.restore();
    if (this.mode === 'title') { this.drawOptions(ctx, (W - 460) / 2, 120, 460); this.drawFx(ctx); return; }
    const ox = (1 - this.anim) * -40, cmds = this.cmds();
    Draw.box(ctx, 16 + ox, 16, 150, cmds.length * 34 + 22, { seed: 91 });
    cmds.forEach((c, i) => Draw.text(ctx, c, 48 + ox, 46 + i * 34, { size: 22, bold: this.idx === i }));
    if (this.state === 'main') Draw.cursor(ctx, 40 + ox, 39 + this.idx * 34, this.t);
    const mins = Math.floor(G.s.playFrames / 3600);
    Draw.box(ctx, 16 + ox, H - 96, 150, 80, { seed: 92, fill: PAL.cream });
    if (this.inBook()) { Draw.star(ctx, 36 + ox, H - 68, 8); Draw.text(ctx, `${G.s.stars} stars`, 52 + ox, H - 61, { size: 19 }); }
    else Draw.text(ctx, MapScene.map ? MapScene.map.name : '', 30 + ox, H - 61, { size: 17 });
    Draw.text(ctx, `played ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`, 30 + ox, H - 32, { size: 17, color: '#7a6a66' });
    const S = this.state;
    if (S === 'main' || S === 'status' || S === 'target') this.drawParty(ctx);
    if (S === 'items') this.drawItems(ctx);
    if (S === 'skills') this.drawSkills(ctx);
    if (S === 'options') this.drawOptions(ctx, 184, 16, W - 200);
    if (S === 'title') this.drawConfirm(ctx, 'Return to the title screen? Anything since your last save will be lost.');
    this.drawFx(ctx);
  },
  cardY(i) { const n = G.s.party.length; return 16 + i * (n >= 3 ? 128 : 150); },
  drawParty(ctx) {
    const party = G.partyActors(), n = party.length, ch = n >= 3 ? 122 : 140;
    party.forEach((a, i) => {
      const x = 184, y = this.cardY(i), d = ACTORS[a.id];
      const sel = (this.state === 'status' && this.who === i) || (this.state === 'target' && this.who2 === i);
      Draw.box(ctx, x, y, W - 200, ch, { seed: 100 + i, fill: sel ? '#fff7dc' : PAL.paper, lw: sel ? 3.5 : 2.5 });
      const ps = ch - 24;
      ctx.save(); Draw.wobbleRect(ctx, x + 12, y + 12, ps, ps, 5 + i); ctx.fillStyle = '#efe4cc'; ctx.fill(); ctx.clip();
      Draw.imgFit(ctx, faceImg(d.face, a.fallen ? 3 : 0), x + 12, y + 12, ps, ps); ctx.restore();
      const tx = x + ps + 28;
      Draw.text(ctx, d.name, tx, y + 34, { size: 26, bold: true });
      Draw.text(ctx, `Lv ${a.lv}   EXP ${a.exp}/${expToNext(a.lv)}`, tx, y + 57, { size: 18, color: '#7a6a66' });
      const by = y + ch - 60;
      Draw.heart(ctx, tx + 6, by + 7, 12); Draw.bar(ctx, tx + 18, by, 150, 12, a.hp / a.mhp, PAL.hp, { seed: i });
      Draw.text(ctx, `${a.hp}/${a.mhp}`, tx + 178, by + 12, { size: 17 });
      ctx.fillStyle = PAL.wax; ctx.fillRect(tx + 2, by + 23, 8, 14);
      Draw.bar(ctx, tx + 18, by + 24, 150, 12, a.wax / a.mwax, PAL.wax, { seed: i + 4 });
      Draw.text(ctx, `${a.wax}/${a.mwax}`, tx + 178, by + 36, { size: 17 });
      if (a.fallen) Draw.text(ctx, 'FADED', x + W - 220, y + 34, { size: 20, align: 'right', color: '#8a8a8a', bold: true });
      if (this.state === 'target' && sel) Draw.cursor(ctx, x - 2, y + ch / 2, this.t);
    });
    if (this.state === 'status') {
      const a = party[this.who]; const comfort = COMFORTS[ACTORS[a.id].comfort];
      const how = comfort.fits.length > 2 ? 'works on every feeling, best once revealed' : 'best for ' + comfort.fits.map(f => FEELINGS[f].name.toLowerCase()).join(' or ') + ' Worries';
      const tip = `ATK ${a.atk} · DEF ${a.def} · SPD ${a.spd}.` + (this.inBook() || G.s.chapter >= 1 ? ` Comfort: ${comfort.name.toUpperCase()}, ${how}.` : '');
      Draw.box(ctx, 184, H - 66, W - 200, 52, { seed: 120, fill: PAL.cream });
      Draw.wrap(ctx, tip, W - 240, 18).slice(0, 2).forEach((l, i) => Draw.text(ctx, l, 200, H - 44 + i * 20, { size: 18 }));
    }
    if (this.state === 'target' && this.pending) {
      const nm = this.pending.type === 'item' ? ITEMS[this.pending.id].name : SKILLS[this.pending.id].name;
      Draw.text(ctx, `Use ${nm} on whom?`, W - 24, H - 12, { size: 18, align: 'right', color: '#fff', shadow: '#000' });
    }
  },
  drawItems(ctx) {
    const list = this.itemList();
    Draw.box(ctx, 184, 16, W - 200, H - 120, { seed: 130 });
    if (!list.length) { Draw.text(ctx, 'Your pockets are empty.', 210, 56, { size: 22, color: '#7a6a66' }); return; }
    const top = Math.max(0, Math.min(this.sub - 5, list.length - 11));
    list.slice(top, top + 11).forEach((id, j) => {
      const i = j + top; const it = ITEMS[id];
      Draw.text(ctx, it.name, 218, 48 + j * 30, { size: 21, color: it.key ? '#8a5a2a' : PAL.ink, bold: i === this.sub });
      Draw.text(ctx, it.key ? 'key item' : 'x' + G.s.items[id], W - 34, 48 + j * 30, { size: it.key ? 16 : 19, align: 'right', color: it.key ? '#a08a70' : PAL.ink });
    });
    Draw.cursor(ctx, 210, 41 + (this.sub - top) * 30, this.t);
    const it = ITEMS[list[Math.min(this.sub, list.length - 1)]];
    Draw.box(ctx, 184, H - 96, W - 200, 80, { seed: 131, fill: PAL.cream });
    Draw.wrap(ctx, it.desc, W - 240, 19).slice(0, 3).forEach((l, i) => Draw.text(ctx, l, 200, H - 68 + i * 21, { size: 19 }));
  },
  drawSkills(ctx) {
    const party = G.s.party, id = party[this.who], a = G.actor(id);
    Draw.box(ctx, 184, 16, W - 200, H - 120, { seed: 140 });
    Draw.text(ctx, (party.length > 1 ? '◂ ' : '') + ACTORS[id].name + (party.length > 1 ? ' ▸' : ''), 210, 48, { size: 24, bold: true });
    Draw.text(ctx, `WAX ${a.wax}/${a.mwax}`, W - 34, 48, { size: 18, align: 'right', color: PAL.blue });
    const sk = G.skillsOf(id);
    sk.forEach((s, i) => {
      const d = SKILLS[s], field = s in FIELD_SKILLS;
      Draw.text(ctx, d.name, 218, 88 + i * 30, { size: 21, bold: i === this.sub, color: field ? PAL.ink : '#9a8f88' });
      Draw.text(ctx, field ? (d.light ? d.light + ' LIGHT' : d.wax + ' WAX') : 'battle only', W - 34, 88 + i * 30, { size: field ? 18 : 15, align: 'right', color: field ? PAL.ink : '#a8998f' });
    });
    Draw.cursor(ctx, 210, 81 + this.sub * 30, this.t);
    const d = SKILLS[sk[this.sub]];
    Draw.box(ctx, 184, H - 96, W - 200, 80, { seed: 141, fill: PAL.cream });
    if (d) Draw.wrap(ctx, d.desc + (d.light ? ` (Costs ${d.light} LIGHT, in battle.)` : ` (Costs ${d.wax} WAX.)`), W - 240, 19).slice(0, 3).forEach((l, i) => Draw.text(ctx, l, 200, H - 68 + i * 21, { size: 19 }));
  },
  drawOptions(ctx, x, y, w) {
    const rows = this.optionRows(), h = rows.length * 40 + 30;
    Draw.box(ctx, x, y, w, h, { seed: 150 });
    if (this.mode === 'title') Draw.text(ctx, 'OPTIONS', x + w / 2, y - 22, { size: 34, align: 'center', bold: true, color: '#fff4d6', shadow: '#000' });
    rows.forEach((l, i) => {
      const ry = y + 40 + i * 40;
      Draw.text(ctx, l, x + 34, ry, { size: 22, bold: this.sub === i });
      if (l === 'Music' || l === 'Sounds') { const k = l === 'Music' ? 'bgm' : 'se'; Draw.bar(ctx, x + 170, ry - 14, w - 250, 16, Audio2.vol[k], PAL.mustard, { seed: 9 + i }); Draw.text(ctx, Math.round(Audio2.vol[k] * 10) + '', x + w - 30, ry, { size: 20, align: 'right' }); }
      if (l === 'Text speed') Draw.text(ctx, '◂ ' + TEXT_SPEEDS.find(([v]) => v === Settings.textSpeed)[1] + ' ▸', x + 170, ry, { size: 20 });
      if (l === 'Fullscreen') Draw.text(ctx, document.fullscreenElement ? 'on' : 'off', x + 170, ry, { size: 20, color: '#7a6a66' });
    });
    Draw.cursor(ctx, x + 26, y + 33 + this.sub * 40, this.t);
    const cy = y + h + 12;
    Draw.box(ctx, x, cy, w, 58, { seed: 151, fill: PAL.cream });
    Draw.text(ctx, 'Arrows/WASD move · Z/Enter/Space OK · X/Esc back', x + 16, cy + 24, { size: 17, color: '#6a5a55' });
    Draw.text(ctx, 'Shift run · C/M menu · F4 fullscreen', x + 16, cy + 46, { size: 17, color: '#6a5a55' });
  },
  drawConfirm(ctx, q) {
    Draw.box(ctx, 184, 16, W - 200, 150, { seed: 160 });
    Draw.wrap(ctx, q, W - 240, 21).forEach((l, i) => Draw.text(ctx, l, 206, 50 + i * 24, { size: 21 }));
    ['Yes', 'No'].forEach((l, i) => Draw.text(ctx, l, 236, 112 + i * 30, { size: 22, bold: this.sub === i }));
    Draw.cursor(ctx, 228, 105 + this.sub * 30, this.t);
  },
  drawFx(ctx) {
    const f = this.fx; if (!f) return;
    const a = Math.min(1, (50 - f.t) / 15), rise = f.t * 0.5;
    if (f.results) for (const [i, txt] of f.results) {
      if (i < 0) continue;
      Draw.text(ctx, txt, W - 60, this.cardY(i) + 40 - rise, { size: 24, align: 'right', bold: true, color: txt.includes('WAX') ? PAL.wax : '#5fa34a', shadow: 'rgba(0,0,0,0.5)', alpha: a });
    }
    if (f.text) {
      const w = Draw.measure(ctx, f.text, 19) + 30;
      const nx = this.mode === 'title' ? W / 2 : 184 + (W - 200) / 2;
      Draw.box(ctx, nx - w / 2, H - 140, w, 34, { alpha: a, seed: 171, fill: '#fff7dc', lw: 3 });
      Draw.text(ctx, f.text, nx, H - 117, { size: 19, align: 'center', alpha: a });
    }
  },
};
