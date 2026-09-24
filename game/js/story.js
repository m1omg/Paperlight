// PAPERLIGHT — game start / continue, plus a small debug warp for testing (?warp=map,x,y&party=wren,button)
'use strict';

const Story = {
  async newGame() {
    Audio2.stopBgm(60);
    await FX.fadeOut(60);
    G.newGame();
    await MapScene.load('guest_room', 2, 4, 'down');
    MapScene.checkAuto();
  },
  async continueGame() {
    if (!G.load()) return;
    Audio2.stopBgm(40);
    await FX.fadeOut(40);
    await MapScene.load(G.s.map, G.s.x, G.s.y, G.s.dir);
    MapScene.nameT = 200;
    await FX.fadeIn(40);
  },
  // debug helper for testing: jump straight to a map with a given party & level
  async warp(map, x, y, party = ['wren'], lv = 1, flags = []) {
    G.newGame(); G.s.party = party; for (const id of party) { const a = G.actor(id); G.setLevel(a, lv); a.hp = a.mhp; a.wax = a.mwax; }
    for (const f of flags) G.set(f);
    if (MAPS[map].dream) G.addItem('lantern');
    await MapScene.load(map, x, y, 'down');
    FX.fade = 0;
  },
};

// URL debug: index.html?warp=forest,13,31&party=wren,button,moth&lv=4&flags=button_joined,moth_joined
(() => {
  const q = new URLSearchParams(location.search);
  if (!q.get('warp')) return;
  window.addEventListener('load', () => setTimeout(async () => {
    await until(() => Game.scene === Title);
    const [m, x, y] = q.get('warp').split(',');
    Title.pressed = true; Audio2.unlock();
    await Story.warp(m, +x, +y, (q.get('party') || 'wren').split(','), +(q.get('lv') || 1), (q.get('flags') || '').split(',').filter(Boolean));
    if (q.get('auto') !== '0') MapScene.checkAuto();
  }, 50));
})();
