// PAPERLIGHT — Interlude (real world at night), Chapter 2, Finale, Ending
'use strict';

// ------------------------------------------------------------ INTERLUDE: the house at night
const HALL_N_ROWS = HALL_ROWS.map((r, i) => i === 1 ? r.slice(0, 9) + '.' + r.slice(10) : r);

defMap('guest_room_n', {
  name: 'Guest Room', theme: 'night', bgm: 'house_night', rows: GUEST_ROWS, props: GUEST_PROPS, dark: 0.5,
  lights: () => [{ x: 7.5, y: 2, r: 130 }],
  deco: [{ type: 'window', x: 7, y: 1, w: 2, night: true }, { type: 'picture', x: 4, y: 1, pic: 'lighthouse' }],
  exits: [{ x: 6, y: 8, to: 'hallway_n', tx: 3, ty: 2, dir: 'down' }],
  events: [
    thing('bed', 1, 3, () => restInBed('The sheets are tangled. Wren\'s heart is still beating fast.')),
    thing('bed2', 2, 3, () => restInBed('The sheets are tangled. Wren\'s heart is still beating fast.')),
    thing('window', 7, 1, () => narrate('Still raining. The streetlight makes the raindrops look like falling sparks.')),
    thing('wardrobe', 10, 2, () => narrate('The sweaters, sleeping in a row.')),
    thing('table', 3, 2, () => narrate('The glass of water, half empty. Mom\'s note: "Breakfast downstairs. Love you."')),
    thing('box1', 1, 7, () => narrate('WREN\'S DRAWINGS. On top: an owl with glasses.')),
  ],
});
defMap('hallway_n', {
  name: 'Upstairs Hallway', theme: 'night', bgm: 'house_night', rows: HALL_N_ROWS, dark: 0.55,
  lights: () => G.flag('study_open') ? [{ x: 9, y: 1.5, r: 90 }] : [],
  props: [{ k: 'plant', x: 1, y: 2 }, { k: 'bookshelf', x: 12, y: 2 }, { k: 'ladder', x: 7, y: 2 }],
  deco: [{ type: 'door', x: 3, y: 1, open: true }, { type: 'door', x: 9, y: 1, cond: () => !G.flag('study_open') }, { type: 'door', x: 9, y: 1, open: true, glow: true, cond: () => G.flag('study_open') },
    { type: 'door', x: 15, y: 1 }, { type: 'vstairs', x: 19, y: 2, h: 2 }],
  block: (x, y) => x === 9 && y === 1 && !G.flag('study_open'),
  exits: [{ x: 3, y: 1, to: 'guest_room_n', tx: 6, ty: 7, dir: 'up' }, { x: 19, y: 2, y2: 3, to: 'downstairs_n', tx: 3, ty: 2, dir: 'down', fixed: true },
    { x: 9, y: 1, to: 'study_n', tx: 6, ty: 7, dir: 'up', cond: () => G.flag('study_open') }],
  events: [
    thing('study', 9, 1, () => narrate('Nana\'s study. Still locked. There\'s a thin line of light under the door... no. It\'s just the hallway lamp.'), { cond: () => !G.flag('study_open') }),
    thing('ladder', 7, 2, () => narrate('The attic ladder. Wren doesn\'t want to go up there again. Not yet.')),
  ],
});
defMap('downstairs_n', {
  name: 'Living Room & Kitchen', theme: 'night', bgm: 'house_night', rows: DOWN_ROWS, props: DOWN_PROPS, dark: 0.55,
  lights: () => [{ x: 17, y: 5, r: 150 }, { x: 5.5, y: 2, r: 70 }],
  deco: DOWN_DECO.map(d => d.type === 'window' ? { ...d, night: true } : d),
  exits: [{ x: 2, y: 1, x2: 3, to: 'hallway_n', tx: 18, ty: 2, dir: 'left', fixed: true }],
  events: [
    { id: 'call', trigger: 'auto', once: true, x: 0, y: 0, run: Story_phone },
    npc('mom', 'mom', 17, 5, Story_momNight, { h: 76, dir: 'left', cond: () => true }),
    thing('piano', 5, 2, () => memory('mem_song')), thing('piano2', 6, 2, () => memory('mem_song')),
    thing('counter2', 14, 2, () => memory('mem_tea')), thing('counter2b', 15, 2, () => memory('mem_tea')),
    thing('sink', 12, 2, () => narrate('The sink. A single drip, every few seconds.')), thing('stove', 16, 2, () => narrate('The soup pot, cold now.')),
    thing('photo', 8, 9, () => memory('mem_garden')),
    thing('clock', 9, 2, () => narrate('4:10. Still.')),
    thing('armchair', 3, 6, () => narrate('Wren sits in Nana\'s chair for a moment. It\'s too big. It\'s perfect.')),
    thing('fridge', 21, 2, () => narrate('The owl drawing. "Self-portrait, by my grandchild." Wren touches the corner of it.')),
    thing('door', 5, 12, () => narrate('Locked. The rain sounds like applause from very far away.')),
  ],
});

async function Story_toNight() {
  G.s.dreamParty = G.s.party.slice(); G.s.party = ['wren']; G.s.chapter = 1.5;
  G.removeItem('lantern'); // it stays in the Book
  await MapScene.load('guest_room_n', 2, 4, 'down');
  await Game.card('Interlude', 'Saturday Night');
  await FX.fadeIn(80);
  await narrate('Wren wakes up in the guest bed.{w:20} It\'s the middle of the night.');
  await narrate('Was it a dream? The lantern is gone. Button and Moth are gone.');
  await narrate('But there\'s pink eraser dust on the sleeve of the mustard sweater.');
  await say('wren:1', '...');
  await narrate('From downstairs, very quietly, comes Mom\'s voice.');
}

async function Story_phone() {
  const mom = EV('mom'); mom.place(19, 2, 'right');
  await narrate('Mom is standing at the phone in the dark kitchen. She doesn\'t notice Wren on the stairs.');
  const m = (i, t) => say('mom:' + i, t);
  await m(0, '...No, I\'m okay. I\'m fine.{w:30} ...No. I\'m not fine.');
  await m(1, 'Wren still hasn\'t said anything. Not one word, Anne. The doctor says give it time, but how much time?');
  await m(1, 'I keep thinking I should\'ve called her more. Visited more. She always said, "You\'re busy, it\'s fine." And I believed her.');
  await m(3, 'I went up to the attic yesterday. She was making a book for Wren. She never finished it.{w:30} I just sat there with it. For an hour.');
  await m(3, 'How am I supposed to help my kid when I can\'t even...');
  await wait(40);
  await m(0, '...Yeah. Yeah, I know. I love you too. Goodnight.');
  Audio2.se('thud', 0.4);
  await walk(mom, 'd d l l d');
  face(mom, 'left');
  await narrate('Mom sits down at the kitchen table and puts her face in her hands.');
  await say('wren:1', '...');
  Toast.add('Look around the house');
}

async function Story_momNight(ev) {
  if (G.flag('hugged_mom') || G.flag('mom_talked_n')) { await say('mom:0', 'Try to get some sleep, okay? ...Or don\'t. I\'m not either.'); return; }
  G.set('mom_talked_n');
  emote(ev, '!');
  await say('mom:1', 'Wren? Oh, honey... Did I wake you?');
  await say('mom:1', 'How long were you standing there?{w:20} ...Never mind. It doesn\'t matter.');
  await say('mom:0', 'Come here.');
  await say('mom:3', 'You don\'t have to say anything. I just...{w:20} I miss her. That\'s all.{w:20} It\'s okay if you do too. It\'s okay if you don\'t know how to say it.');
  const c = await choose('', ['(Hug Mom)', '(Stand still)'], 1, 'wren:1');
  if (c === 0) {
    G.set('hugged_mom');
    await narrate('Wren wraps both arms around Mom. Mom makes a small sound, like a laugh and a sob at the same time.');
    await say('mom:3', 'Okay.{w:20} Okay. Thank you, sweetheart. That\'s... that\'s plenty.');
  } else {
    await narrate('Wren stands very still. Mom reaches over and squeezes Wren\'s hand anyway.');
    await say('mom:2', 'That\'s okay too.');
  }
}

async function memory(id) {
  const texts = {
    mem_song: ['Wren touches the piano keys very softly, so Mom won\'t hear.', 'The notes on the sheet music "for W." ...Wren knows this one.',
      'It\'s the song Nana hummed at bedtime. The one without words. She said the words were "still on their way."'],
    mem_tea: ['Two mugs on the counter, next to the honey jar. Wren picks up the one that says WORLD\'S OKAYEST GRANDMA.',
      'Rainy afternoons. Nana\'s tea with far too much honey. "One spoon for every raindrop," she\'d say, and they\'d count the raindrops on the window.'],
    mem_garden: ['The photo of Nana in the garden.', 'The tomatoes never got red enough. Every summer, they tried. Every summer, Nana said: "Well! We\'ll try again next year."',
      'Wren only now realizes that there won\'t be a next year.'],
  }[id];
  if (G.hasItem(id)) { await narrate('Wren remembers.'); return; }
  if (id === 'mem_garden') await Game.showCG('cg_photo', 30);
  for (const t of texts) await narrate(t);
  if (id === 'mem_garden') await Game.hideCG(30);
  await give(id);
  if (['mem_song', 'mem_tea', 'mem_garden'].every(m => G.hasItem(m)) && !G.flag('study_open')) {
    await wait(30); Audio2.se('door', 0.5);
    await narrate('Upstairs, very softly, a door creaks open.');
    G.set('study_open');
  }
}

defMap('study_n', {
  name: 'Nana\'s Study', theme: 'night', bgm: 'house_night', rows: GUEST_ROWS, dark: 0.45,
  lights: () => [{ x: 5.5, y: 2.5, r: 140 }],
  props: [{ k: 'desk', x: 5, y: 2 }, { k: 'bookshelf', x: 1, y: 2 }, { k: 'owleasel', x: 10, y: 3 }, { k: 'boxes', x: 11, y: 6 }, { k: 'chair', x: 5, y: 3, walk: true },
    { k: 'bookstack', x: 9, y: 2 }, { k: 'rug', x: 4, y: 4 }, { k: 'plant', x: 1, y: 7 }],
  deco: [{ type: 'window', x: 3, y: 1, w: 1, night: true }, { type: 'picture', x: 8, y: 1, pic: 'lanternkid', col: '#e0c8a0' }],
  exits: [{ x: 6, y: 8, to: 'hallway_n', tx: 9, ty: 2, dir: 'down', cond: () => !G.hasItem('note') }],
  events: [
    { id: 'enter', trigger: 'auto', once: true, x: 0, y: 0, run: async () => { await narrate('Nana\'s study. It smells like pencil shavings and lavender.'); } },
    thing('desk', 5, 2, Story_note), thing('desk2', 6, 2, Story_note),
    thing('shelf', 1, 2, () => narrate('Sketchbooks 1 through 46. A whole life, drawn.')),
    thing('easel', 10, 3, () => narrate('On the easel: a big copy of the owl drawing. Nana redrew it carefully, like it was important.{w:20} Underneath: "The Storyteller — design by W."')),
    thing('books', 9, 2, () => narrate('Library books. Three weeks overdue.')),
    thing('boxes', 11, 6, () => narrate('Unopened boxes of colored pencils. She always bought too many.')),
    thing('window', 3, 1, () => narrate('The rain has almost stopped.')),
    thing('pic', 8, 1, () => narrate('A framed drawing of a lantern. No, of a child holding a lantern. A child in a very big sweater.')),
  ],
});

async function Story_note() {
  if (G.hasItem('note')) { await Story_pencil(); return; }
  await narrate('Nana\'s desk. Pencils worn down to stubs. A lamp. Loose pages of the Lantern Child book.');
  await narrate('Under the lamp there\'s a folded note, with Wren\'s name on it.');
  await give('note', 1, true);
  Audio2.bgm('owl', 60);
  const lines = [
    '{c:#6a5a8a}Wren —{/c}',
    '{c:#6a5a8a}I\'ve been trying to finish our book. I drew the meadow, and the village, and the wood with all its lanterns.{/c}',
    '{c:#6a5a8a}But every time I get to the last page, my hand stops.{/c}',
    '{c:#6a5a8a}I think it\'s because the ending isn\'t mine to draw.{/c}',
    '{c:#6a5a8a}Someday I won\'t be here to finish things. That\'s alright. That\'s how stories go.{/c}',
    '{c:#6a5a8a}But I hope you keep drawing. And talking. And being loud sometimes. Your voice was always my favorite sound.{/c}',
    '{c:#6a5a8a}The last page is yours, little light.{/c}',
    '{c:#6a5a8a}— Nana{/c}',
  ];
  for (const l of lines) await narrate(l);
  await wait(30);
  await say('wren:3', '...');
  await narrate('Wren\'s eyes sting. The note gets a little bit wet.');
  await narrate('On the desk, one pencil is still long and sharp. It looks like it\'s waiting.');
}

async function Story_pencil() {
  const c = await choose('Pick up the pencil?', ['Pick it up', 'Not yet'], 1);
  if (c === 1) return;
  Audio2.se('shimmer');
  await narrate('The moment Wren\'s fingers touch it, the loose pages on the desk start to rustle.');
  await narrate('The book. The book is calling.');
  Audio2.se('whoosh'); FX.doFlash('#fff', 1);
  await FX.fadeOut(40, '#fbf6ea');
  G.s.party = G.s.dreamParty || ['wren', 'button', 'moth']; G.s.chapter = 2;
  G.addItem('lantern');
  G.healAll();
  await MapScene.load('unfinished', 16, 22, 'up');
  await Game.card('Chapter Two', 'The Unfinished Pages');
  await FX.fadeIn(60);
  MapScene.checkAuto();
}

// ------------------------------------------------------------ CHAPTER 2: the unfinished pages
(() => {
  const g = MB.grid(32, 26, '.'); MB.border(g, 2, '#');
  MB.rect(g, 15, 0, 3, 2, '.');
  MB.path(g, [[16, 23], [16, 4]], ',', 1); MB.path(g, [[8, 14], [24, 14]], ',', 1);
  MB.blob(g, 5, 21, 2, 1, '#'); MB.blob(g, 27, 21, 2, 1, '#'); MB.blob(g, 27, 8, 1, 1, '#');
  const done = k => G.flag('frame_' + k);
  defMap('unfinished', {
    name: 'The Unfinished Pages', theme: 'paper', bgm: 'unfinished', dream: true, rows: MB.rows(g),
    props: [{ k: 'sketchtree', x: 4, y: 5 }, { k: 'sketchtree', x: 24, y: 17 }, { k: 'sketchhouse', x: 21, y: 4 }, { k: 'sketchhouse', x: 4, y: 16 },
      { k: 'sketchlamp', x: 13, y: 17 }, { k: 'sketchlamp', x: 19, y: 17 }, { k: 'paperball', x: 10, y: 20 }, { k: 'pencil', x: 26, y: 13 },
      { k: 'inkbottle', x: 6, y: 11 }, { k: 'paperball', x: 22, y: 9 }, { k: 'sketchtree', x: 9, y: 3 }, { k: 'eraserblock', x: 28, y: 18 },
      { k: 'gate', x: 15, y: 2, cond: () => !G.flag('gate_open') }],
    deco: [{ type: 'scribble', x: 3, y: 9, n: 14, img: 'doodle_tree' }, { type: 'scribble', x: 26, y: 5, n: 12, img: 'doodle_bird' }, { type: 'scribble', x: 12, y: 22, n: 12, img: 'doodle_path' },
      { type: 'text', x: 16, y: 25, text: '(everything past here is just pencil)' },
      { type: 'frameart', x: 8, y: 13, art: 'garden', cond: () => done('garden') }, { type: 'frameart', x: 16, y: 9, art: 'tea', cond: () => done('tea') },
      { type: 'frameart', x: 24, y: 13, art: 'song', cond: () => done('song') }],
    exits: [{ x: 15, y: 0, x2: 17, to: 'hush_hall', tx: 2, ty: 4, dir: 'right', sound: false, color: '#fbf6ea' }],
    events: [
      { id: 'reunion', trigger: 'auto', once: true, x: 0, y: 0, run: Story_reunion },
      bookmark('bm', 19, 22),
      { id: 'f_garden', prop: () => frameProp('garden'), x: 8, y: 13, run: () => galleryFrame('garden') },
      { id: 'f_tea', prop: () => frameProp('tea'), x: 16, y: 9, run: () => galleryFrame('tea') },
      { id: 'f_song', prop: () => frameProp('song'), x: 24, y: 13, run: () => galleryFrame('song') },
      thing('gate', 16, 2, () => narrate('A gate drawn in pencil. It won\'t open. Three empty frames stand in the gallery below it.'), { cond: () => !G.flag('gate_open') }),
      thing('house', 5, 16, () => narrate('A house drawn only in pencil. Nobody colored it in, so nobody ever moved in.')),
      thing('house2', 22, 4, () => narrate('Another pencil house. Next to it, a note in the margin: "fix roof?"')),
      thing('pencil', 26, 13, () => narrate('A pencil taller than Button. Button tries to lift it and falls over.')),
      worry('w1', 'blot', 9, 19), worry('w2', 'sketch', 24, 20), worry('w3', 'sketch2', 6, 7), worry('w4', 'blot2', 25, 9),
      worry('w5', 'sketch', 12, 10), worry('w6', 'blot', 19, 5),
    ],
  });
})();

async function Story_reunion() {
  await narrate('Back in the Book. But everything here is only pencil. No color at all.');
  const b = FOL('button'), m = FOL('moth');
  await say('button:3', 'PARTNER!! There you are!!');
  await say('button:2', 'You fell right through the page! We looked EVERYWHERE! Moth cried!');
  await say('moth:3', 'Button cried more.');
  await say('button:1', 'That\'s classified information!');
  await say('moth:0', '...Where did you go?');
  await narrate('Wren doesn\'t have words for it. Wren holds out the note instead.');
  await say('moth:0', '"Wren"... Is that your name? Wren.{w:20} It\'s a nice name. It\'s a little bird.');
  await say('moth:3', '"The last page is yours, little light."{w:20} ...Oh.');
  await say('button:3', 'So the Storyteller... she\'s...');
  await say('moth:2', 'She drew us. All of us. And then she couldn\'t anymore.');
  await say('button:2', '...');
  await say('button:0', 'Then we\'ll finish it FOR her! Right? The last page is somewhere past here, I bet!');
  await say('moth:0', 'That gate up north... It\'s locked. And those empty frames in the gallery... I think they\'re waiting for something.');
}

function frameProp(k) { return G.flag('frame_' + k) && Assets.get('p_art_' + k) ? 'art_' + k : 'frame'; }

async function galleryFrame(k) {
  const titles = { garden: '"The Summer We Tried"', tea: '"A Spoon for Each Raindrop"', song: '"The Song Without Words"' };
  const mem = { garden: 'mem_garden', tea: 'mem_tea', song: 'mem_song' };
  if (G.flag('frame_' + k)) { await narrate(`${titles[k]}. It\'s finished now. It\'s beautiful.`); return; }
  await narrate(`An empty frame on an easel. Underneath, in pencil, a title: ${titles[k]}.`);
  const mems = ['mem_garden', 'mem_tea', 'mem_song'].filter(m => G.hasItem(m));
  if (!mems.length) { await narrate('Nothing to put here.'); return; }
  const opts = mems.map(m => ITEMS[m].name).concat(['Leave it']);
  const c = await choose('Which memory belongs here?', opts, opts.length - 1);
  if (c === opts.length - 1) return;
  if (mems[c] !== mem[k]) { Audio2.se('buzzer'); await narrate('Wren holds the memory up to the frame. It doesn\'t fit. It\'s a different day.'); return; }
  G.removeItem(mems[c]); G.set('frame_' + k); Audio2.se('shimmer'); FX.doFlash('#fff2c0', 0.6);
  const easel = EV('f_' + k); if (easel) easel.key = frameProp(k); // the empty frame becomes the finished painting
  const voice = { garden: '"Well! We\'ll try again next year."', tea: '"One spoon for every raindrop. Count them with me, little light."', song: '"The words are still on their way. They\'ll get here. Words are slow, but they always come."' };
  await narrate('Color floods into the frame. For a moment, Wren hears Nana\'s voice, clear as anything:');
  await narrate('{c:#6a5a8a}' + voice[k] + '{/c}');
  if (['garden', 'tea', 'song'].every(x => G.flag('frame_' + x))) {
    await wait(20); Audio2.se('door'); FX.doShake(4);
    await narrate('Somewhere to the north, the pencil gate creaks open.');
    G.set('gate_open'); MapScene.removeProp('gate');
    const g = EV('gate'); if (g) g.visible = false, g.solid = false;
    await say('button:0', 'We did it! The gate\'s open!');
    await say('moth:1', 'Something\'s waiting past it. I can feel it. It\'s... very quiet.');
  }
}

// ------------------------------------------------------------ the quiet hall (chase)
(() => {
  const g = MB.grid(46, 9, '.'); MB.border(g, 1, '#');
  for (const [x, y, h] of [[8, 1, 4], [14, 4, 4], [20, 1, 4], [26, 4, 4], [32, 1, 4], [38, 4, 4]]) MB.rect(g, x, y, 1, h, '#');
  MB.rect(g, 45, 3, 1, 3, '.');
  defMap('hush_hall', {
    name: 'The Quiet Hall', theme: 'paper', bgm: 'hush', dream: true, rows: MB.rows(g), dark: 0.35,
    exits: [{ x: 45, y: 3, y2: 5, to: 'last_page', tx: 8, ty: 9, dir: 'up', fixed: true, sound: false, color: '#fbf6ea' }],
    deco: [{ type: 'text', x: 5, y: 7, text: 'shh', col: 'rgba(90,80,70,0.4)' }, { type: 'text', x: 23, y: 7, text: 'shhh', col: 'rgba(90,80,70,0.4)' }, { type: 'text', x: 41, y: 2, text: 'shhhhh', col: 'rgba(90,80,70,0.4)' }],
    events: [
      { id: 'start', trigger: 'auto', once: true, x: 0, y: 0, run: Story_chaseStart },
      { id: 'hush', enemy: 'hush',x: 1, y: 4, h: 110, still: true, noEncounter: true, solid: false, visible: false },
    ],
    update: hushChase,
  });
})();

async function Story_chaseStart() {
  const h = EV('hush'); h.visible = false;
  await narrate('A long, long hallway made of blank paper. It\'s so quiet that Wren can hear the pencil lines settling.');
  await say('moth:1', 'W-Wren... behind us...');
  h.visible = true; h.alpha = 0; await tween(h, { alpha: 1 }, 50);
  Audio2.se('heartbeat');
  await narrate('Something huge and white unfolds at the end of the hall. It has no mouth. It makes no sound at all.');
  await say('button:3', 'RUN!!');
  Toast.add('Hold Shift to run!');
  MapScene.chase = { on: true };
}

function hushChase(M) {
  const c = M.chase; if (!c || !c.on || M.busy) return;
  const h = M.ev('hush'), p = M.player;
  if (Math.abs(h.px - p.px) < 26 && Math.abs(h.py - p.py) < 26) {
    c.on = false;
    M.run(async () => {
      Audio2.se('whoosh'); await FX.fadeOut(30, '#ffffff');
      await narrate('{s}Everything goes quiet.{/s}{w:30} So quiet. Like cotton in your ears...');
      p.place(2, 4, 'right'); M.followersTo(2, 4); h.place(1, 4); h.moveT = 60;
      await FX.fadeIn(30);
      await say('button:1', 'No! Get UP, partner! Keep going!');
      c.on = true; c.grace = 60;
    });
    return;
  }
  if (c.grace > 0) { c.grace--; return; }
  if (h.moving) return;
  const dx = p.x - h.x, dy = p.y - h.y;
  const tryDir = d => { const [ax, ay] = DIRV[d]; if (!M.solid[h.y + ay][h.x + ax]) { h.startMove(d, 1.75); return true; } return false; };
  const hd = dx > 0 ? 'right' : dx < 0 ? 'left' : null, vd = dy > 0 ? 'down' : dy < 0 ? 'up' : null;
  if (hd && tryDir(hd)) return;
  if (vd && tryDir(vd)) return;
  // blocked: slide along the wall toward the open side
  if (!tryDir(h.y < 4 ? 'down' : 'up')) tryDir(h.y < 4 ? 'up' : 'down');
}

// ------------------------------------------------------------ the last page
defMap('last_page', {
  name: 'The Last Page', theme: 'attic', bgm: 'owl', dream: true, rows: [
    '################',
    '################',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '################',
  ],
  props: [{ k: 'bookstack', x: 1, y: 2 }, { k: 'bookstack', x: 2, y: 2 }, { k: 'bookshelf', x: 12, y: 2 }, { k: 'armchair', x: 7, y: 3 },
    { k: 'easel', x: 10, y: 3 }, { k: 'rug', x: 6, y: 5 }, { k: 'bookstack', x: 14, y: 8 }, { k: 'plant', x: 1, y: 8 }, { k: 'sidetable', x: 5, y: 3 }],
  lights: () => [{ x: 8, y: 4, r: 220 }], dark: 0.15,
  drawTop: (ctx) => { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,190,110,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore(); },
  deco: [{ type: 'window', x: 4, y: 1, w: 2, morning: true }, { type: 'window', x: 10, y: 1, w: 2, morning: true }],
  events: [
    { id: 'owl', char: 'owl', x: 8, y: 4, h: 58, run: () => {} },
    { id: 'hush', enemy: 'hush',x: 8, y: 8, h: 150, still: true, noEncounter: true, solid: false, visible: false },
    { id: 'scene', trigger: 'auto', once: true, x: 0, y: 0, run: Story_finale },
  ],
});

async function Story_finale() {
  const owl = EV('owl'), hush = EV('hush'), p = P();
  await walk(p, 'u u u', 1.5);
  await narrate('A warm little room at the very end of the book. It smells like pencil shavings and lavender.');
  await Game.showCG('cg_owl', 50);
  await say('owl', 'Hello, little light.');
  await say('button:3', 'STORYTELLER!! You\'re here! You came back!');
  await say('owl', 'Hello, Button. My, you\'ve gotten brave. And Moth... you found your light, didn\'t you?');
  await say('moth:3', '...I did.');
  await say('wren:3', '...');
  await say('owl', 'Oh, sweetheart. Come here. Let me look at you. You\'re wearing the sweater.');
  await say('owl', 'I should tell you the truth, because you deserve it. I\'m only a drawing, dear. The real me isn\'t here anymore.');
  await say('owl', 'But I drew myself into this book, as an owl, the way you drew me when you were five. I thought it might let me say a few things I didn\'t get to say.');
  await say('owl', 'I kept that drawing on my fridge for five years, you know. Glasses and everything. It was the best portrait anyone ever made of me.');
  await say('owl', 'I tried so hard to finish our story. But every time I reached this page, I didn\'t know what the Lantern Child would say at the end.');
  await say('owl', 'I think... it\'s because only you can say it.');
  await Game.hideCG(40);
  Audio2.stopBgm(80);
  await wait(40);
  await narrate('The room goes quiet. Then quieter. The lamp flickers.');
  hush.visible = true; hush.alpha = 0; tween(hush, { alpha: 1 }, 60);
  Audio2.se('heartbeat'); await wait(60); face(p, 'down'); for (const f of MapScene.followers) face(f, 'down');
  await say('moth:1', 'It\'s the thing from the hallway...!');
  await say('owl', 'That\'s Hush. It isn\'t evil, little light. Don\'t hate it.');
  await say('owl', 'It\'s the part of you that decided that if you never said anything, nothing else could go wrong.');
  await say('owl', 'It wrapped itself around your voice to keep it safe. But it\'s gotten so big that it\'s hurting you.');
  await say('owl', 'I can\'t fight it for you. That\'s the saddest thing about being a grandmother. Some things, you can only watch.');
  await say('owl', 'But you\'re not alone.');
  await say('button:1', 'Darn right! We\'re right here, partner!');
  await say('moth:0', 'We\'ll stay with you. However long it takes.');
  const res = await Battle.start('hush', { canRun: false, onStart: async B => {
    await B.log('Hush can\'t be hurt. It can only be understood.', 70, true);
    if (G.s.soothed > 0) await B.log(`The ${G.s.soothed} Worries you soothed are somewhere nearby. They remember your kindness.`, 70, true);
  } });
  await Story_ending();
}

async function Story_ending() {
  Game.scene = MapScene; const hush = EV('hush'), owl = EV('owl'), p = P();
  Audio2.bgm('owl', 60);
  FX.fade = 1; await FX.fadeIn(60);
  await narrate('The room is very still.');
  await narrate('Then, slowly, Hush unfolds. Layer after layer of blank paper, falling open like a flower.');
  await narrate('Inside, there\'s only a small child, hugging their knees.{w:20} It looks exactly like Wren.');
  await narrate('Wren kneels down and holds it. It\'s so light. It was always so light.');
  await tween(hush, { alpha: 0 }, 80); hush.visible = false;
  Audio2.se('page');
  await narrate('When Wren lets go, there\'s nothing left but a single blank page, floating down into Wren\'s hands.');
  face(p, 'up');
  await say('owl', 'There it is. The last page.');
  await say('owl', 'What will you draw, little light?');
  const c = await choose('', ['Nana, as an owl', 'Everyone, together', 'Home'], -1, 'wren:0');
  G.s.vars.lastPage = c;
  Audio2.se('shimmer');
  await narrate(['Wren draws an owl with round glasses and a rose-pink shawl. The owl is smiling. She\'s holding a small child\'s hand.',
    'Wren draws everyone. Button waving too hard. Moth, glowing. The Mayor, the Crane, the Mushroom asleep. Mom. Nana. And Wren, in the middle, mouth open, saying something.',
    'Wren draws the house. The garden, with bright red tomatoes. Two mugs on the windowsill. A light on in every single window.'][c]);
  await say('owl', 'Oh... That\'s a lovely ending. That\'s the loveliest ending I\'ve ever seen.');
  await say('owl', 'I have to go now, little light.');
  await say('wren:3', '{s}Nana...{/s}');
  await narrate('The word comes out cracked and small. It\'s the first thing Wren has said to her in three weeks.');
  await say('wren:3', '{s}Please don\'t go.{/s}');
  await say('owl', 'Oh, sweetheart. I already went. That\'s the hard part. That will always be the hard part.');
  await say('owl', 'But look. Everything I loved about you is still here. In your drawings. In your stubbornness. In the way you hold up a lantern for a scared little moth.');
  await say('owl', 'Go talk to your mother. She misses me too. You two will have to take turns being brave.');
  await say('owl', 'Goodbye, little light. I\'m so proud of you.');
  await say('wren:3', 'Goodbye, Nana.');
  Audio2.se('sparkle'); await tween(owl, { alpha: 0 }, 90); owl.visible = false;
  await wait(40);
  await say('button:2', '...Hey. Partner. You\'re going back, aren\'t you? To your mom.');
  await narrate('Wren nods.');
  await say('button:0', 'Then... come visit, okay? Just open the book. We\'ll be right here. I\'ll be the one yelling.');
  await say('moth:2', 'Thank you for the light, Wren. I\'ll keep it on for you. Always.');
  await say('wren:2', 'Thank you.{w:20} Both of you.');
  await say('button:3', 'Whoa, you TALK!{w:20} ...Your voice is really nice, partner.');
  Audio2.stopBgm(90);
  FX.fadeColor = '#fbf6ea'; await tween(FX, { fade: 1 }, 90);
  // ---- Sunday morning
  G.s.party = ['wren']; G.s.chapter = 3; G.removeItem('lantern');
  await MapScene.load('downstairs_e', 3, 2, 'down');
  await Game.card('Epilogue', 'Sunday');
  await FX.fadeIn(80);
  MapScene.checkAuto();
}

defMap('downstairs_e', {
  name: 'Sunday Morning', theme: 'house', bgm: 'ending', rows: DOWN_ROWS, props: DOWN_PROPS,
  deco: DOWN_DECO.map(d => d.type === 'window' ? { ...d, morning: true } : d),
  drawTop: (ctx) => { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,220,150,0.35)'; ctx.fillRect(0, 0, W, H); ctx.restore(); },
  events: [
    { id: 'intro', trigger: 'auto', once: true, x: 0, y: 0, run: async () => {
      await narrate('Sunday morning. The rain has stopped. Sunlight is coming in sideways through the kitchen window.');
      await narrate('Mom is in the kitchen, packing the last of the mugs.');
    } },
    npc('mom', 'mom', 15, 3, Story_final, { h: 76, dir: 'up' }),
    thing('piano', 5, 2, () => narrate('The song for W. Maybe Wren will learn to play it.')),
    thing('clock', 9, 2, () => narrate('Someone wound the clock. It\'s ticking again.')),
    thing('fridge', 21, 2, () => narrate('The owl drawing. Wren is going to take it home.')),
  ],
});

async function Story_final() {
  const mom = EV('mom');
  await say('mom:0', 'Morning, sweetheart. The truck comes at noon, so if there\'s anything you want to keep, now\'s the...');
  await say('wren:0', 'Mom.');
  emote(mom, '!'); Audio2.se('thud', 0.5);
  await narrate('Mom drops the mug. It doesn\'t break. It just rolls under the table.');
  await say('mom:1', '...Wren?');
  await Game.showCG('cg_ending', 60);
  await say('wren:3', 'I miss her.');
  await say('mom:3', 'Oh, honey.{w:30} Me too. Me too, so much.');
  await narrate('They stand in the kitchen for a long, long time.');
  await say('wren:3', 'Can we keep the book?');
  await say('mom:3', '...Of course we can. We\'ll keep it forever.');
  await say('mom:2', 'Will you... tell me about it? The book?');
  await say('wren:2', 'It\'s a long story.');
  await narrate('Mom laughs. It\'s wet and shaky and it\'s the best sound Wren has heard in three weeks.');
  if (G.flag('hugged_mom')) await say('mom:2', 'Thank you for last night, by the way. The hug. I needed it more than I could say.');
  await say('mom:2', 'I\'ve got time.');
  await wait(60);
  await Game.hideCG(80);
  await FX.fadeOut(80, '#fbf6ea');
  try { localStorage.setItem('paperlight_cleared', '1'); } catch (e) {}
  const s = G.s.soothed, sc = G.s.scattered;
  const verdict = s > sc * 2 ? 'You listened to almost every Worry. Some feelings only need someone to sit with them.'
    : sc > s * 2 ? 'You fought your way through. That\'s alright. Sometimes getting through is all you can do.'
    : 'Sometimes you fought. Sometimes you listened. That\'s how most people get through it.';
  Audio2.bgm('ending', 30, true);
  Game.cg = null; FX.fade = 0;
  await Credits.start([
    '#THE END', '', `Worries soothed: ${s}      Worries scattered: ${sc}`, verdict, '', '', '',
    '#PAPERLIGHT', 'a story about the pages we leave blank', '', '',
    '#Story, design, code', 'Claude (Anthropic)', '', '#Illustrations', 'generated with GPT Image through Codex', '',
    '#Music & sound', 'original compositions, synthesized from scratch', '', '#Fonts', 'Gaegu, by JIKJI SOFT (SIL Open Font License)', 'Patrick Hand, by Patrick Wagesreiter (SIL OFL)', '',
    '#With love to the games that taught us', 'that small stories can hold big feelings', 'OMORI · UNDERTALE · Ib · End Roll · Re:Kinder', '', '', '',
    'For everyone carrying a page', 'they aren\'t ready to turn yet.', '', 'Take your time.', 'Words are slow, but they always come.', '', '', '',
    '#Thank you for playing.',
  ]);
  Game.toTitle();
}
