// PAPERLIGHT — Chapter 1: The Meadow Page
'use strict';

// ------------------------------------------------------------ the first page (blank)
(() => {
  const g = MB.grid(22, 14, '.'); MB.border(g, 1, 'o');
  MB.path(g, [[2, 7], [20, 7]], ',', 1); MB.rect(g, 21, 6, 1, 2, '.');
  defMap('first_page', {
    name: 'The First Page', theme: 'void', bgm: 'title', dream: true, rows: MB.rows(g),
    deco: [{ type: 'scribble', x: 4, y: 3, n: 14, img: 'doodle_sun' }, { type: 'scribble', x: 12, y: 10, n: 10, img: 'doodle_boat' },
      { type: 'scribble', x: 16, y: 3, n: 8, img: 'doodle_house' }, { type: 'scribble', x: 6, y: 11, n: 6, img: 'doodle_cat' },
      { type: 'scribble', x: 17, y: 11, n: 6, img: 'doodle_star' },{ type: 'text', x: 11, y: 12, text: '(page 1)' }],
    underlay: (ctx, cam) => {}, // background is the white void
    drawOver: (ctx, cam, t) => {
      // color bleeding in from the east edge
      const x0 = 15 * TILE - cam.x; const gr = ctx.createLinearGradient(x0, 0, x0 + 7 * TILE, 0);
      gr.addColorStop(0, 'rgba(155,207,122,0)'); gr.addColorStop(1, 'rgba(155,207,122,0.65)'); ctx.fillStyle = gr; ctx.fillRect(x0, 0, 8 * TILE, H);
      if (!G.hasItem('lantern')) { // the lantern on its stand
        const lx = 9 * TILE - cam.x + 16, ly = 7 * TILE - cam.y + 6 + Math.sin(t / 20) * 2;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; const gg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 50); gg.addColorStop(0, '#ffd27a'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(lx - 50, ly - 50, 100, 100); ctx.restore();
        const im = Assets.get('i_lantern');
        if (im) Draw.imgBottom(ctx, im, lx, ly + 10, 30); else { ctx.fillStyle = '#fff1c4'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(lx, ly, 8, 10, 0, 0, 7); ctx.fill(); ctx.stroke(); }
      }
    },
    exits: [{ x: 21, y: 6, y2: 7, to: 'meadow', tx: 1, ty: 11, dir: 'right', sound: false, color: '#fbf6ea' }],
    events: [
      { id: 'arrive', trigger: 'auto', once: true, x: 0, y: 0, run: async () => {
        await narrate('Everything is white. Like a page nobody has drawn on yet.');
        await say('wren:0', '...');
        await narrate('Somewhere nearby, something small is glowing.');
      } },
      thing('lantern', 9, 7, async ev => {
        if (G.hasItem('lantern')) return;
        await narrate('A paper lantern on a little pencil-drawn stand. It\'s warm, like a hand.');
        await narrate('A tag hangs from the handle. The writing is Nana\'s:{w:20} {c:#b0761a}"For my little light."{/c}');
        await give('lantern');
        P().lantern = true; Audio2.se('light'); FX.doFlash('#fff3c9', 0.5);
        MapScene.ev('lantern').solid = false;
        await narrate('The path ahead fills with color.');
      }),
    ],
    block: (x, y) => !G.hasItem('lantern') && x > 10,
  });
})();

// ------------------------------------------------------------ meadow
(() => {
  const g = MB.grid(38, 24, '.'); MB.border(g, 2, '#');
  MB.rect(g, 0, 11, 2, 2, '.'); MB.rect(g, 36, 11, 2, 2, '.');
  MB.path(g, [[0, 11], [14, 11], [14, 9], [26, 9], [26, 11], [36, 11]], ',', 2);
  MB.blob(g, 26, 19, 4, 2, '~');
  MB.blob(g, 8, 4, 2, 1, '#'); MB.blob(g, 18, 20, 2, 1, '#'); MB.blob(g, 33, 4, 2, 1, '#'); MB.blob(g, 3, 20, 1, 1, '#');
  defMap('meadow', {
    name: 'Crayon Meadow', theme: 'meadow', bgm: 'meadow', dream: true, rows: MB.rows(g),
    props: [{ k: 'tree', x: 3, y: 4 }, { k: 'tree', x: 10, y: 15 }, { k: 'tree', x: 30, y: 15 }, { k: 'tree', x: 22, y: 3 }, { k: 'tree', x: 4, y: 16 },
      { k: 'pine', x: 12, y: 4 }, { k: 'pine', x: 34, y: 19 }, { k: 'pine', x: 16, y: 16 }, { k: 'pine', x: 28, y: 5 }, { k: 'bush', x: 6, y: 8 },
      { k: 'bush', x: 24, y: 6 }, { k: 'bush', x: 31, y: 7 }, { k: 'rock', x: 20, y: 14 }, { k: 'fence', x: 11, y: 13 }, { k: 'fence', x: 12, y: 13 },
      { k: 'sign', x: 13, y: 13 }, { k: 'rock', x: 7, y: 20 }, { k: 'bush', x: 33, y: 13 }],
    exits: [{ x: 0, y: 11, y2: 12, to: 'first_page', tx: 20, ty: 6, dir: 'left', sound: false, color: '#fbf6ea' },
      { x: 37, y: 11, y2: 12, to: 'village', tx: 1, ty: 11, dir: 'right', sound: false, color: '#fbf6ea' }],
    update: () => { if (!G.flag('button_joined') && !MapScene.busy && P().x >= 13 && !P().moving) MapScene.run(Story_button); },
    events: [
      bookmark('bm', 5, 13),
      thing('sign', 13, 13, () => narrate('The sign says, in wobbly crayon:{w:10} ← THE FIRST PAGE    CRAYON HOLLOW →')),
      thing('bush', 6, 8, async ev => { if (G.flag('m_cookie')) { await narrate('Just a bush. A very nice one, though.'); return; } G.set('m_cookie'); await narrate('Something is hidden in the bush...'); await give('cookie', 2); }),
      thing('rock', 20, 14, () => narrate('A big mossy rock, warm from the crayon sun. It seems pleased to see you.')),
      { id: 'b_button', char: 'button', x: 19, y: 8, h: 50, dir: 'left', cond: () => !G.flag('button_joined'), run: () => {} },
      { id: 'b_dust', enemy: 'tut', x: 21, y: 8, h: 44, still: true, noEncounter: true, cond: () => !G.flag('button_joined') },
      // (Worries show up once Button is with you, so Wren is never chased alone at level 1)
      worry('w1', 'dust2', 24, 14, { cond: () => G.flag('button_joined') }), worry('w2', 'tangle', 32, 9, { cond: () => G.flag('button_joined') }),
      worry('w3', 'tangledust', 9, 18, { cond: () => G.flag('button_joined') }), worry('w4', 'tangledust', 17, 13, { cond: () => G.flag('button_joined') }),
      worry('w5', 'dust2', 28, 3, { cond: () => G.flag('button_joined') }),
      { id: 'cloud', enemy: 'cloudboss', x: 26, y: 16, h: 64, still: true, boss: true, cond: () => G.flag('blue_quest') && !G.hasItem('bluecrayon'),
        after: async () => { await narrate('Where the Grumble Cloud was floating, something blue is lying in the grass.'); await give('bluecrayon'); await say('button:0', 'The BLUE one! That\'s the last crayon, right? Right?? Let\'s go tell the Mayor!'); } },
      thing('pondlook', 26, 16, async () => { if (!G.flag('blue_quest')) await narrate('A little pond. Crayon fish swim in circles, very seriously.'); }, { solid: false, cond: () => !G.flag('blue_quest') || G.hasItem('bluecrayon') }),
    ],
  });
})();

async function Story_button() {
  const p = P(); const btn = EV('b_button'), dust = EV('b_dust');
  Audio2.se('bell'); emote(btn, '!');
  await say('button:1', 'HEY! You! Back off, you dusty little...{w:10} little...{w:10} DUST THING!');
  await wait(10); face(p, 'right');
  await narrate('A knitted rabbit is standing between you and a shivering ball of fluff. The rabbit\'s fists are up.');
  await say('button:3', 'Huh? Who\'s there?{w:15} Whoa... a real kid! With a real lantern!');
  await say('button:0', 'Perfect timing! Help me out here, will ya? This Worry\'s been following me all morning!');
  G.set('button_joined');
  partyJoin('button');
  btn.visible = false; FOL('button').place(btn.x, btn.y, 'left');
  const res = await Battle.start('tut', { canRun: false, onStart: async B => {
    await B.log('A Worry! Worries are feelings that got lost. You can fight them... or comfort them.', 90, true);
    await B.log('FIGHT lowers their HP (red). COMFORT fills their CALM (pink). Either one makes them go away.', 90, true);
    await B.log('Each friend comforts differently. Different Worries need different comfort.', 80, true);
  } });
  dust.visible = false;
  await wait(20);
  await say('button:0', 'Phew! Nice job, partner!');
  if (G.s.soothed > 0) await say('button:0', 'You calmed it right down! Huh. I always just bonk \'em. Your way\'s kinda nicer.');
  else await say('button:0', 'Poof! Scattered it to scribbles! I didn\'t know you had it in you!');
  await say('button:0', 'I\'m Button! Knight of the Meadow Page! Well, knight-in-training. Well... I gave myself the title.');
  await say('button:3', 'What\'s your name?');
  await say('wren:1', '...');
  await say('button:3', '...');
  await say('button:0', 'Ohh, you\'re the quiet type! That\'s okay. I\'m the LOUD type. We\'ll balance out!');
  await say('button:3', 'Hey, wait. Mustard sweater... paper lantern...{w:20} You\'re the Lantern Child! From the Story!');
  await say('button:2', 'The Storyteller said you\'d come someday. But she left a long time ago, and the pages started going blank, and...');
  await say('button:1', 'And now there are Worries everywhere! But you\'re here now! So everything\'s gonna be fine!');
  await say('button:0', 'C\'mon, let\'s go to Crayon Hollow! The Mayor will know what to do. It\'s east, down the path!');
  // re-set the meadow (during the fade) so its Worries appear now that Button is here
  await FX.fadeOut(12); await MapScene.load('meadow', P().x, P().y, P().dir); await FX.fadeIn(12);
  Toast.add('BUTTON joined the party!');
}

// ------------------------------------------------------------ village: Crayon Hollow
(() => {
  const g = MB.grid(32, 24, '.'); MB.border(g, 2, '#');
  MB.rect(g, 0, 3, 32, 2, '~'); MB.rect(g, 15, 0, 2, 3, '.'); MB.rect(g, 15, 3, 2, 2, '=');
  MB.rect(g, 0, 11, 2, 2, '.');
  MB.path(g, [[0, 11], [15, 11], [15, 5]], ',', 2); MB.path(g, [[15, 11], [15, 20]], ',', 2); MB.path(g, [[16, 11], [24, 11], [24, 8]], ',', 2);
  MB.path(g, [[16, 16], [27, 16]], ',', 1);
  MB.blob(g, 27, 20, 2, 1, '~');
  defMap('village', {
    name: 'Crayon Hollow', theme: 'meadow', bgm: 'village', dream: true, rows: MB.rows(g),
    props: [{ k: 'mushhouse', x: 3, y: 6 }, { k: 'teahouse', x: 22, y: 5 }, { k: 'mushhouse', x: 5, y: 16, flip: true }, { k: 'well', x: 18, y: 13 },
      { k: 'mailbox', x: 9, y: 17 }, { k: 'lamppost', x: 12, y: 9 }, { k: 'lamppost', x: 19, y: 9 }, { k: 'tree', x: 28, y: 7 }, { k: 'tree', x: 2, y: 13 },
      { k: 'pine', x: 11, y: 20 }, { k: 'pine', x: 29, y: 12 }, { k: 'bush', x: 8, y: 9 }, { k: 'bush', x: 21, y: 19 }, { k: 'fence', x: 12, y: 6 },
      { k: 'fence', x: 18, y: 6 }, { k: 'sign', x: 13, y: 13 }, { k: 'rock', x: 26, y: 13 }, { k: 'bush', x: 29, y: 17 }],
    deco: [{ type: 'uncolored', x: 15, y: 3, w: 2, h: 2, done: () => G.flag('bridge') }, { type: 'bridge', x: 15, y: 3, w: 2, h: 2, cond: () => G.flag('bridge') }],
    block: (x, y) => !G.flag('bridge') && y >= 2 && y <= 4 && (x === 15 || x === 16),
    exits: [{ x: 0, y: 11, y2: 12, to: 'meadow', tx: 36, ty: 11, dir: 'left', sound: false },
      { x: 15, y: 0, x2: 16, to: 'forest', tx: 13, ty: 32, dir: 'up', sound: false }],
    events: [
      { id: 'enter', trigger: 'auto', once: true, x: 0, y: 0, run: async () => {
        await say('button:0', 'Welcome to Crayon Hollow! Best village on the whole Meadow Page! ...It\'s the only village on the Meadow Page.');
      } },
      bookmark('bm', 17, 12),
      thing('sign', 13, 13, () => narrate('CRAYON HOLLOW. Population: "a nice amount."')),
      thing('well', 18, 13, () => narrate('A wishing well. At the bottom, drawn in blue crayon, a tiny moon.')),
      thing('well2', 19, 13, () => narrate('Wren doesn\'t make a wish. Wishes are for things that can still happen.')),
      thing('mushhouse', 4, 7, () => narrate('The Sleepy Mushroom\'s house. Nobody\'s home. He fell asleep somewhere else again.')),
      thing('teahouse', 23, 6, () => narrate('A cottage shaped like a teacup. It smells like honey and warm milk.')),
      thing('post', 6, 17, () => narrate('A mushroom house with a mailbox out front: the Post Office. Open (slowly).')),
      thing('bridgeup', 15, 5, () => {}, { solid: false }),
      npc('mayor', 'mayor', 14, 6, Story_mayor, { h: 54 }),
      npc('snail', 'snail', 10, 18, Story_snail, { h: 44, dir: 'left' }),
      npc('mushroom', 'mushroom', 26, 15, Story_mushroom, { h: 48 }),
      npc('teacup', 'teacup', 23, 9, async () => {
        await say('teacup', G.flag('met_teacup') ? 'Back again, dearie? Something warm for the road?' : 'Oh! Visitors! I\'m the Teacup Lady. I sell things that make you feel better. Mostly tea.', { face: false });
        G.set('met_teacup');
        await shop(['cookie', 'tea', 'milk', 'candy', 'bandage']);
      }, { h: 50 }),
      npc('crane', 'crane', 27, 18, Story_crane, { h: 58, dir: 'left' }),
      npc('kitten', 'kitten', 18, 17, Story_kitten, { h: 38, wander: true }),
      npc('kid1', 'kitten', 8, 12, async () => { await say('kitten', 'I\'m not a kitten! I\'m a yarn ball! We just look alike.', { face: false, name: 'YARN BALL' }); await say('button:0', 'Hi, Skein!'); }, { h: 30, wander: true }),
    ],
  });
})();

async function Story_mayor(ev) {
  const nm = { name: 'PENCIL MAYOR', face: false };
  if (G.flag('bridge')) { await say('mayor', 'The bridge is so colorful! Thank you, Lantern Child. The Lamplit Wood is dark, but so are closets, and those turn out fine.', nm); return; }
  if (!G.flag('mayor_met')) {
    await say('mayor', 'Hm? Hmm! A visitor! I am the Mayor of Crayon Hollow. Very important. Very pointy.', nm);
    await say('button:0', 'Mayor! Look! It\'s the Lantern Child! From the Story!');
    await say('mayor', 'Goodness gracious. Mustard sweater. Paper lantern. Quiet as a Sunday. It IS you.', nm);
    await say('mayor', 'You\'ve arrived at a bad time, I\'m afraid. The Storyteller hasn\'t visited in a very long time. And without her...', nm);
    await say('mayor', 'Things are starting to lose their color. The bridge to the Lamplit Wood went blank only yesterday!', nm);
    await say('mayor', 'And past the Wood, there\'s the Eraser. It rubs out everything it touches. It says it\'s "helping."', nm);
    await say('mayor', 'If only we could color the bridge back in. I need three crayons: {c:#d8574f}RED{/c}, {c:#c99a1c}YELLOW{/c}, and {c:#5a86c9}BLUE{/c}.', nm);
    await say('mayor', 'They\'ve all wandered off, as crayons do. Ask around the village. Somebody always knows something.', nm);
    await say('button:1', 'Leave it to us! Right, partner?');
    await say('wren:0', '...');
    G.set('mayor_met'); Toast.add('Find the three crayons');
    return;
  }
  const have = ['redcrayon', 'yellowcrayon', 'bluecrayon'].filter(c => G.hasItem(c));
  if (have.length < 3) {
    await say('mayor', `You have ${have.length} of 3 crayons. ` + ['The Postmaster may know about red. He knows about everything. Eventually.', 'Yellow? The Mushroom said something about yellow, before he fell asleep. Four days ago.', 'Blue... the little yarn ones play by the pond. Try them.'][!G.hasItem('redcrayon') ? 0 : !G.hasItem('yellowcrayon') ? 1 : 2], nm);
    return;
  }
  await say('mayor', 'All three! Splendid! Stand back, everyone. I\'m going to do some coloring.', nm);
  for (const c of ['redcrayon', 'yellowcrayon', 'bluecrayon']) G.removeItem(c);
  Audio2.se('shimmer'); FX.doFlash('#fff2c0', 0.8);
  await wait(30); G.set('bridge'); Audio2.se('sparkle');
  await narrate('Red for the railings. Yellow for the planks. Blue for the water underneath.{w:20} The bridge fills in, line by line.');
  await say('mayor', 'There! The way to the Lamplit Wood is open.', nm);
  await say('mayor', 'Take care in there. Hold that lantern high. The dark is only scary until something lights it up.', nm);
  await say('button:3', 'The Wood... People say it\'s full of Worries. And that something lives under the big blue mushroom...');
  await say('button:1', 'Not that I\'m scared! I\'m NEVER scared! Let\'s GO!');
}

async function Story_snail() {
  const nm = { name: 'POSTMASTER SNAIL', face: false };
  if (G.hasItem('redcrayon') || G.flag('letter_done')) { await say('snail', 'Mail... goes... out... on... Tuesdays...', nm); return; }
  if (G.hasItem('letter')) { await say('snail', 'The... letter... is for... the Paper Crane... by the pond...', nm); return; }
  await say('snail', 'Oh... hello... there...', nm);
  await say('button:0', 'Postmaster! Do you know where the red crayon went?');
  await say('snail', 'Red... crayon...{w:40} I... have... a... letter...{w:30} for... the Paper Crane...', nm);
  await say('snail', 'I\'ve been... delivering it... for... eleven... days...{w:30} It\'s... right... over... there...', nm);
  await say('button:3', 'The pond is, like, twenty steps away.');
  await say('snail', 'Would you... take it...? The Crane... always... knows... about... colors...', nm);
  await give('letter');
}

async function Story_crane() {
  const nm = { name: 'PAPER CRANE', face: false };
  if (G.flag('letter_done')) { await say('crane', 'Every fold is a memory. That\'s what she used to say.', nm); return; }
  if (!G.hasItem('letter')) { await say('crane', 'Hello, little one. I\'m waiting for a letter. Letters are slow here. Everything is slow when you\'re waiting.', nm); return; }
  await say('crane', 'Is that... a letter? For me?', nm);
  G.removeItem('letter'); Audio2.se('page');
  await narrate('The Crane unfolds the letter with its beak. Its eyes get shiny.');
  await say('crane', '"Dear Crane. Thank you for keeping my colors safe. Please give the red one to whoever needs it most. — S."', nm);
  await say('crane', 'S... the Storyteller. She wrote this so long ago. I always wondered why she stopped visiting.', nm);
  await say('crane', 'Well. You need it most, I think. You\'re carrying something heavy, aren\'t you, little one? I can tell.', nm);
  await give('redcrayon'); G.set('letter_done');
  await say('crane', 'Red is for scarves and strawberries. And for the part of your heart that\'s still warm.', nm);
}

async function Story_mushroom() {
  const nm = { name: 'SLEEPY MUSHROOM', face: false };
  if (G.hasItem('yellowcrayon') || G.flag('mush_done')) { await say('mushroom', 'Zzz... five more minutes... zzz...', nm); return; }
  await say('mushroom', 'Zzzzz... zzz... mnnh... zzz...', nm);
  await narrate('He\'s fast asleep. And under him, something bright yellow is sticking out.');
  await say('button:3', 'Is he sleeping ON the yellow crayon?!');
  await say('button:0', 'Leave this to me, partner. I\'m a professional.');
  await wait(20);
  await say('button:1', '{b}{s}WAAAAAKE UUUUUP!!!{/s}{/b}');
  FX.doShake(8); Audio2.se('bell');
  const m = EV('mushroom'); emote(m, '!');
  await say('mushroom', 'WHA-- is it Tuesday? Did I miss Tuesday?', nm);
  await say('mushroom', 'Oh. A crayon. I was sleeping on that. I thought it was a very lumpy pillow.', nm);
  await say('mushroom', 'Take it. Everything\'s easier to sleep on when you\'re not worrying about it.', nm);
  await give('yellowcrayon'); G.set('mush_done');
  await say('mushroom', 'Yellow is for sweaters... and sunlight... and... zzz...', nm);
}

async function Story_kitten() {
  const nm = { name: 'YARN BALL', face: false };
  if (!G.flag('mayor_met')) { await say('kitten', 'Mrrp! I\'m made of yarn! Wanna play?', nm); return; }
  if (G.hasItem('bluecrayon')) { await say('kitten', 'You got the blue crayon! The cloud must be so happy to go to bed!', nm); return; }
  await say('kitten', 'The blue crayon? It rolled all the way to the meadow pond! I was gonna get it, but...', nm);
  await say('kitten', 'A big grumpy Grumble Cloud is sitting right on top of it. It rains on anyone who comes close!', nm);
  await say('button:1', 'A Grumble Cloud, huh? Leave it to us!');
  if (!G.flag('blue_quest')) { G.set('blue_quest'); Toast.add('The Grumble Cloud is at the meadow pond'); }
}

// ------------------------------------------------------------ Lamplit Wood
(() => {
  const g = MB.grid(28, 34, '#');
  MB.blob(g, 14, 30, 5, 2, '.'); MB.path(g, [[13, 33], [13, 1]], ',', 2); MB.rect(g, 13, 0, 2, 1, ',');
  MB.blob(g, 10, 26, 3, 2, '.');
  MB.blob(g, 14, 20, 4, 2, '.'); MB.path(g, [[15, 19], [21, 19]], ',', 1); MB.blob(g, 22, 18, 3, 2, '.');
  MB.blob(g, 13, 11, 5, 2, '.'); MB.path(g, [[12, 10], [6, 10]], ',', 1); MB.blob(g, 6, 9, 2, 2, '.');
  MB.blob(g, 14, 3, 3, 1, '.');
  const lit = n => G.flag('lamp' + n);
  defMap('forest', {
    name: 'The Lamplit Wood', theme: 'forest', bgm: 'forest', dream: true, rows: MB.rows(g),
    dark: () => 0.9 - ['lamp1', 'lamp2', 'lamp3'].filter(f => G.flag(f)).length * 0.06,
    lights: () => [{ x: 9, y: 23, r: 80 }, { x: 18, y: 19, r: 70 }, { x: 17, y: 12, r: 70 }],
    props: [{ k: 'darktree', x: 9, y: 30 }, { k: 'darktree', x: 17, y: 30 }, { k: 'lanterntree', x: 8, y: 23 }, { k: 'darktree', x: 16, y: 26 },
      { k: 'lanterntree', x: 16, y: 17 }, { k: 'darktree', x: 10, y: 19 }, { k: 'bluemush', x: 23, y: 17 }, { k: 'darktree', x: 9, y: 13 },
      { k: 'lanterntree', x: 16, y: 12 }, { k: 'darktree', x: 16, y: 3 }, { k: 'darktree', x: 10, y: 3 }, { k: 'stump', x: 12, y: 27 },
      { k: 'bluemush', x: 5, y: 8 }, { k: 'stump', x: 17, y: 21 }, { k: 'bluemush', x: 11, y: 29 }],
    deco: [{ type: 'thorns', x: 13, y: 24, w: 2, gone: () => lit(1) }, { type: 'thorns', x: 13, y: 15, w: 2, gone: () => lit(2) }, { type: 'thorns', x: 13, y: 6, w: 2, gone: () => lit(3) }],
    block: (x, y) => (x === 13 || x === 14) && ((y === 24 && !lit(1)) || (y === 15 && !lit(2)) || (y === 6 && !lit(3))),
    exits: [{ x: 13, y: 33, x2: 14, to: 'village', tx: 15, ty: 1, dir: 'down', sound: false }, { x: 13, y: 0, x2: 14, to: 'clearing', tx: 9, ty: 14, dir: 'up', sound: false }],
    events: [
      { id: 'enter', trigger: 'auto', once: true, x: 0, y: 0, run: async () => {
        await say('button:3', 'It\'s so dark... Good thing you\'ve got that lantern.');
        await narrate('Black thorns block the path ahead. They seem to shrink back from the lantern\'s light.');
        await say('button:0', 'Look, there\'s an old lamp post! Maybe if we light it...');
      } },
      bookmark('bm', 17, 32),
      { id: 'L1', prop: 'lamppost', x: 9, y: 26, light: 150, lightCond: () => lit(1), run: () => lightLamp(1) },
      { id: 'L2', prop: 'lamppost', x: 22, y: 17, light: 150, lightCond: () => lit(2), run: () => lightLamp(2) },
      { id: 'L3', prop: 'lamppost', x: 6, y: 8, light: 150, lightCond: () => lit(3), run: () => lightLamp(3) },
      { id: 'moth', char: 'moth', x: 23, y: 19, h: 46, dir: 'left', cond: () => !G.flag('moth_joined'), run: Story_moth },
      worry('w1', 'crow', 11, 28), worry('w2', 'crowmitten', 16, 21), worry('w3', 'mitten', 20, 18),
      worry('w4', 'clock', 15, 12), worry('w5', 'clock2', 7, 11), worry('w6', 'crowmitten', 14, 3), worry('w7', 'clock', 11, 20),
    ],
  });
})();

async function lightLamp(n) {
  if (G.flag('lamp' + n)) { await narrate('The lamp burns warm and steady.'); return; }
  if (n === 2 && !G.flag('moth_joined')) { await narrate('An old lamp post. Someone is hiding behind the mushroom next to it, trembling.'); return; }
  await narrate('An old lamp post, cold and dark. Wren holds the lantern up to it...');
  Audio2.se('light'); FX.doFlash('#ffe7a8', 0.5); G.set('lamp' + n);
  await wait(20);
  Audio2.se('shimmer');
  await narrate('The lamp flickers on. Somewhere nearby, the thorns creak and pull back.');
  if (n === 3) await say('moth:2', 'All three... It\'s so bright. I\'ve never seen the Wood like this.');
}

async function Story_moth() {
  const m = EV('moth');
  await narrate('Behind the big blue mushroom, a small paper moth is curled up, shaking.');
  await say('moth:1', 'P-please... Don\'t hurt me... I\'m only made of paper... I\'ll tear...');
  await say('button:0', 'Hey, hey. We\'re not Worries. I\'m Button! This is the Lantern Child!');
  await say('moth:1', 'The... Lantern Child?');
  await narrate('Wren holds the lantern a little closer. The moth\'s wings stop shaking.');
  await say('moth:0', '...Oh. It\'s warm.');
  await say('moth:0', 'I\'m Moth. I live here. I think. I got lost when the lamps went out, and it got so dark, and...');
  await say('moth:3', 'And I was scared, and I stayed here for... I don\'t know how long. It\'s hard to count in the dark.');
  await say('button:2', '...That sounds really lonely.');
  await say('moth:0', 'It was. But I\'m okay now. It\'s funny... the light doesn\'t make the dark go away. It just makes it smaller.');
  await say('moth:2', 'Can I come with you? I\'m not very strong. But I\'m good at listening. And I know how to mend things.');
  await say('button:0', 'Of course! The more the merrier! Right, partner?');
  const c = await choose('Let Moth come along?', ['(Nod)', '(Nod, smiling)'], 0, 'wren:2');
  await say('moth:2', c === 1 ? '...Thank you. You have a very nice smile. You should use it more.' : '...Thank you. Thank you so much.');
  m.visible = false; G.set('moth_joined'); partyJoin('moth'); FOL('moth').place(m.x, m.y, 'left');
  Toast.add('MOTH joined the party!');
  await say('moth:0', 'Let\'s light the lamp. I\'ve wanted to see it lit for so long.');
  await lightLamp(2);
}

// ------------------------------------------------------------ Eraser clearing
(() => {
  const g = MB.grid(20, 16, '.'); MB.border(g, 1, '#'); MB.rect(g, 9, 15, 2, 1, '.');
  MB.path(g, [[9, 15], [9, 8]], ',', 2);
  defMap('clearing', {
    name: 'The Eraser\'s Clearing', theme: 'meadow', bgm: () => G.flag('eraser_done') ? 'meadow' : 'forest', dream: true, rows: MB.rows(g),
    props: [{ k: 'tree', x: 2, y: 3 }, { k: 'tree', x: 15, y: 3 }, { k: 'pine', x: 17, y: 10 }, { k: 'pine', x: 2, y: 10 }, { k: 'eraserblock', x: 5, y: 6 }, { k: 'rock', x: 14, y: 12 }],
    deco: [{ type: 'erased', x: 6, y: 4, r: 50 }, { type: 'erased', x: 14, y: 8, r: 40 }, { type: 'erased', x: 4, y: 12, r: 30 }, { type: 'erased', x: 12, y: 3, r: 36 }, { type: 'erased', x: 10, y: 6, r: 60, cond: () => G.flag('eraser_done') }],
    exits: [{ x: 9, y: 15, x2: 10, to: 'forest', tx: 13, ty: 1, dir: 'down', sound: false, cond: () => !G.flag('eraser_done') }],
    update: () => { if (!G.flag('eraser_done') && !MapScene.busy && P().y <= 9 && !P().moving) MapScene.run(Story_eraser); },
    events: [
      bookmark('bm', 3, 13),
      { id: 'eraser', enemy: 'eraser', x: 9, y: 5, h: 96, still: true, boss: true, noEncounter: true, cond: () => !G.flag('eraser_done') },
      thing('eraserblock', 5, 6, () => narrate('A chunk of pink rubber, worn smooth. Bits of drawings are stuck to it. A flower. Half a smile.')),
      thing('hole', 10, 6, () => G.flag('eraser_done') && Story_hole(), { solid: false, trigger: 'touch' }),
      thing('hole2', 9, 6, () => G.flag('eraser_done') && Story_hole(), { solid: false, trigger: 'touch' }),
    ],
  });
})();

async function Story_eraser() {
  if (G.flag('eraser_done')) return;
  const e = EV('eraser'); Audio2.stopBgm(40);
  await narrate('The trees around the clearing are half gone, rubbed out into blank paper.');
  await narrate('In the middle stands a huge, worn-down pink shape.');
  await wait(20); emote(e, '...');
  await say('eraser', '...More of you. Coming to fill in what I cleaned.', { name: 'THE ERASER', face: false, blip: 'blip_hush' });
  await say('button:1', 'You\'re the one who\'s been erasing the Book! Knock it off!');
  await say('eraser', 'You don\'t understand. Some pages HURT. The sad ones. The ones about goodbye.', { name: 'THE ERASER', face: false, blip: 'blip_hush' });
  await say('eraser', 'If I rub them out, nobody has to read them. Nobody has to cry. Isn\'t that kinder?', { name: 'THE ERASER', face: false, blip: 'blip_hush' });
  await say('moth:1', 'But... if you erase the sad pages... the happy ones before them stop making sense...');
  await say('eraser', 'I am SO tired. I have rubbed and rubbed and there is always another sad page.', { name: 'THE ERASER', face: false, blip: 'blip_hush' });
  await say('eraser', 'Let me rub out yours, Lantern Child. Then you won\'t have to feel it anymore.', { name: 'THE ERASER', face: false, blip: 'blip_hush' });
  await say('wren:1', '...');
  const res = await Battle.start('eraser', { canRun: false, onStart: async B => {
    await B.log('The Eraser looks exhausted. Maybe fighting isn\'t the only way. (Try ILLUMINATE, then comfort.)', 80, true);
  } });
  const soothed = Battle.enemies[0].gone === 'soothed';
  G.set('eraser_done'); G.set('eraser_soothed', soothed); e.visible = false;
  Audio2.bgm('meadow', 60);
  if (soothed) {
    await narrate('The Eraser sinks into the grass. It looks very small now.');
    await say('eraser', 'I thought... if I forgot... it would stop hurting.', { name: 'THE ERASER', face: false, blip: 'blip_hush' });
    await say('eraser', 'But the hurting is just the remembering, isn\'t it. And I don\'t want to forget her.', { name: 'THE ERASER', face: false, blip: 'blip_hush' });
    await say('moth:2', 'You can rest now. You don\'t have to carry all the sad pages by yourself.');
    await narrate('The Eraser closes its eyes and fades gently away, like a pencil line smudged by a thumb.');
  } else {
    await narrate('The Eraser crumbles into a pile of pink crumbs.');
    await say('eraser', 'You\'ll see... Some pages... are too heavy...', { name: 'THE ERASER', face: false, blip: 'blip_hush' });
  }
  await wait(20);
  Audio2.se('whoosh'); FX.doShake(4);
  await narrate('Where the Eraser stood, there\'s a hole in the page. Not dark, just... empty. White all the way down.');
  await say('button:3', 'Whoa. That\'s where it rubbed too hard. It went right through the paper!');
  await say('moth:1', 'Lantern Child? Don\'t stand too close to the edge...');
}

async function Story_hole() {
  const c = await choose('Look into the hole in the page?', ['Look closer', 'Step back'], 1);
  if (c === 1) return;
  await narrate('Through the hole, far below, there\'s a room. A dark kitchen. A phone cord. A voice.');
  await narrate('...Mom?');
  await say('button:3', 'Partner?! WAIT--');
  Audio2.se('whoosh'); FX.doFlash('#fff', 1);
  Audio2.stopBgm(30);
  await FX.fadeOut(50, '#fbf6ea');
  await wait(60);
  await Story_toNight();
}
