// DEV ONLY — test harness (delete before shipping)
window.step = async n => { for (let i = 0; i < n; i++) { Game.update(); await null; await null; await null; } Game.draw(); };
window.tap = async (a, n = 3) => { Input.hit[a] = true; Input.held[a] = true; await step(1); Input.held[a] = false; await step(n); };
window.free = () => Game.scene === MapScene && !MapScene.busy && !Msg.active && !Choice.active && !Game.cardText && !Game.overlay;
window.adv = async (max = 400) => { for (let i = 0; i < max; i++) { if (free()) return 'free'; if (Choice.active) return 'choice: ' + Choice.opts.join('|'); if (Game.scene === Battle && (Battle.menuState || Battle.targeting)) return 'battle'; await tap('ok', 8); } return 'timeout'; };
window.pick = async i => { for (let k = 0; k < i; k++) await tap('down', 2); await tap('ok', 4); return adv(); };
window.log = [];
if (!window._sayWrapped) { window._sayWrapped = Msg.show.bind(Msg); Msg.show = (w, t, o) => { log.push((w || '') + ': ' + t); return window._sayWrapped(w, t, o); }; }
window.path = (tx, ty) => { const M = MapScene, p = M.player; const key = (x, y) => x + ',' + y; const prev = {}; const q = [[p.x, p.y]]; prev[key(p.x, p.y)] = null;
  while (q.length) { const [x, y] = q.shift(); if (x === tx && y === ty) break; for (const [d, [dx, dy]] of Object.entries(DIRV)) { const nx = x + dx, ny = y + dy; const k = key(nx, ny); if (k in prev) continue; const bl = nx < 0 || ny < 0 || nx >= M.w || ny >= M.h || M.solid[ny][nx] || (M.map.block && M.map.block(nx, ny)) || M.events.some(e => e.kind !== 'enemy' && e.solid && e.visible && e.x === nx && e.y === ny);
      if (bl && !(nx === tx && ny === ty)) continue; prev[k] = [x, y, d]; q.push([nx, ny]); } }
  if (!(key(tx, ty) in prev)) return null; const dirs = []; let c = [tx, ty]; while (prev[key(c[0], c[1])]) { const [x, y, d] = prev[key(c[0], c[1])]; dirs.unshift(d); c = [x, y]; } return dirs; };
window.goto = async (tx, ty, run = true) => { const dirs = path(tx, ty); if (!dirs) return 'nopath'; const p = MapScene.player;
  for (const d of dirs) { if (!free()) return 'interrupted at ' + p.x + ',' + p.y; const sx = p.x, sy = p.y; Input.held[d] = true; Input.held.run = run; let n = 0;
    while ((p.x === sx && p.y === sy || p.moving) && n < 60) { await step(1); n++; if (MapScene.player !== p || !free()) break; }
    Input.held[d] = false; Input.held.run = false; if (MapScene.player !== p) { await step(80); return 'map->' + MapScene.id; } }
  await step(2); return 'at ' + p.x + ',' + p.y; };
window.act = async dir => { if (dir) { Input.held[dir] = true; await step(1); Input.held[dir] = false; await step(1); } await tap('ok', 4); return await adv(); };
window.reach = async (map, x, y, targets) => { await MapScene.load(map, x, y, 'down'); return targets.map(([tx, ty]) => [tx, ty, !!path(tx, ty)]); };
window.dumpMap = () => { const M = MapScene; const rows = []; for (let y = 0; y < M.h; y++) { let s = ''; for (let x = 0; x < M.w; x++) { const e = M.eventAt(x, y); s += (M.player.x === x && M.player.y === y) ? '@' : e && e.solid ? 'E' : M.blocked(x, y, M.player) ? '#' : '.'; } rows.push(s); } return rows.join('\n'); };
window.go = async (x, y, strat = 'fight') => { const m0 = MapScene.id; for (let k = 0; k < 8; k++) { if (MapScene.id !== m0) { await adv(); return 'map->' + MapScene.id; } const r = await goto(x, y); if (Game.scene === Battle || (MapScene.busy && !Msg.active)) { await step(40); if (Game.scene === Battle) { (window.out = window.out || []).push('battle:' + (await autoBattle(strat))); await adv(); continue; } } if (Msg.active || Choice.active) { const a = await adv(); if (a.startsWith('choice')) return a; continue; } if (r.startsWith('at') && MapScene.player.x === x && MapScene.player.y === y) return r; if (r.startsWith('map')) return r; if (r === 'nopath') return 'nopath'; } return 'gave up ' + MapScene.player.x + ',' + MapScene.player.y; };
// auto battle: strategy 'fight' | 'comfort'
window.autoBattle = async (strategy = 'fight', max = 3000) => {
  for (let i = 0; i < max; i++) {
    if (Game.scene !== Battle) { await step(5); if (Game.scene !== Battle) return 'ended: ' + Battle.result; }
    const m = Battle.menuState, t = Battle.targeting;
    if (m) { const labels = m.items.map(x => x.label);
      let want = strategy === 'fight' ? 'FIGHT' : (labels.includes('SPEAK') ? 'SPEAK' : labels[1]);
      if (Battle.gameOver) want = 'Try again';
      let idx = labels.indexOf(want); if (idx < 0) idx = 0; m.idx = idx; await tap('ok', 2); continue; }
    if (t) { await tap('ok', 2); continue; }
    await tap('ok', 3);
  }
  return 'timeout';
};
