// PAPERLIGHT — Prologue & real world (Nana's house)
'use strict';

// ------------------------------------------------------------ shared layouts
const GUEST_ROWS = [
  '#############',
  '#############',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '######.######',
];
const HALL_ROWS = [
  '####################',
  '###.################',
  '#..................,',
  '#..................,',
  '####################',
];
const DOWN_ROWS = [
  '########################',
  '##..####################',
  '#..........#:::::::::::#',
  '#..........#:::::::::::#',
  '#..........#:::::::::::#',
  '#..........::::::::::::#',
  '#..........::::::::::::#',
  '#..........::::::::::::#',
  '#..........#:::::::::::#',
  '#..........#:::::::::::#',
  '#..........#:::::::::::#',
  '#..........#:::::::::::#',
  '########################',
];
const GUEST_PROPS = [{ k: 'bed', x: 1, y: 2 }, { k: 'nightstand', x: 3, y: 2 }, { k: 'boxes', x: 5, y: 2 }, { k: 'wardrobe', x: 10, y: 2 },
  { k: 'box', x: 1, y: 7 }, { k: 'box', x: 2, y: 7 }, { k: 'plant', x: 11, y: 7 }, { k: 'rug', x: 4, y: 4 }];
const DOWN_PROPS = [{ k: 'piano', x: 5, y: 2 }, { k: 'gclock', x: 9, y: 2 }, { k: 'bookshelf', x: 1, y: 9 }, { k: 'armchair', x: 3, y: 6 },
  { k: 'rug', x: 4, y: 6 }, { k: 'phototable', x: 8, y: 9 }, { k: 'boxes', x: 10, y: 11 }, { k: 'box', x: 9, y: 11 }, { k: 'box', x: 1, y: 11 },
  { k: 'counter', x: 12, y: 2 }, { k: 'counter2', x: 14, y: 2 }, { k: 'soupstove', x: 16, y: 2 }, { k: 'table', x: 16, y: 6 },
  { k: 'fridge', x: 21, y: 2 }, { k: 'phonetable', x: 20, y: 2 },
  { k: 'chair', x: 15, y: 6 }, { k: 'chair', x: 18, y: 6 }, { k: 'plant', x: 22, y: 11 }, { k: 'boxes', x: 12, y: 11 }];
const DOWN_DECO = [{ type: 'stairs', x: 2, y: 1, w: 2 }, { type: 'window', x: 5, y: 1, w: 2 }, { type: 'window', x: 18, y: 1, w: 2 },
  { type: 'picture', x: 7, y: 1, pic: 'rose', col: '#c9a0a0' },
  { type: 'wallimg', x: 13, y: 1, img: 'wallclock' }, { type: 'wallimg', x: 10, y: 1, img: 'coathook' }, { type: 'floorimg', x: 5, y: 11, img: 'doormat' }];

// ------------------------------------------------------------ PROLOGUE: guest room
defMap('guest_room', {
  name: 'Guest Room', theme: 'house', bgm: 'house', rows: GUEST_ROWS, props: GUEST_PROPS,
  deco: [{ type: 'window', x: 7, y: 1, w: 2 }, { type: 'picture', x: 4, y: 1, pic: 'lighthouse' }],
  exits: [{ x: 6, y: 8, to: 'hallway', tx: 3, ty: 2, dir: 'down' }],
  events: [
    { id: 'intro', trigger: 'auto', once: true, x: 0, y: 0, run: Story_intro },
    thing('bed', 1, 3, () => restInBed('The guest bed. The sheets smell like Nana\'s lavender soap.{w:20} Wren didn\'t sleep much.'), { solid: false }),
    thing('bed2', 2, 3, () => restInBed('The guest bed. The sheets smell like Nana\'s lavender soap.{w:20} Wren didn\'t sleep much.'), { solid: false }),
    thing('table', 3, 2, () => narrate('A glass of water Mom left last night. And a note: "Breakfast downstairs. Love you."')),
    thing('boxes', 5, 2, () => narrate('Boxes in Mom\'s handwriting. KITCHEN. DONATE. KEEP?{w:20}\nThe question mark was added later, in a different pen.')),
    thing('wardrobe', 10, 2, () => narrate('Nana\'s sweaters hang in a neat row. Each one is a different color.{w:20} There\'s an empty hanger where the mustard one used to be.')),
    thing('wardrobe2', 11, 2, () => narrate('Wren is wearing the mustard one.')),
    thing('window', 7, 1, () => narrate('Rain. It\'s been raining since the funeral.')),
    thing('window2', 8, 1, () => narrate('Rain. It\'s been raining since the funeral.')),
    thing('pic', 4, 1,() => narrate('A small painting of a lighthouse. Nana painted it the summer Wren was born.')),
    thing('box1', 1, 7, () => narrate('This box says WREN\'S DRAWINGS. Nana kept every single one.')),
    thing('box2', 2, 7, () => narrate('Empty. Waiting to be filled with something.')),
    thing('plant', 11, 7, () => narrate('A spider plant. Mom keeps forgetting to water it.{w:20} Wren waters it with the glass from the nightstand.')),
  ],
});

// the real world's save point: Wren's bed
async function restInBed(text) {
  await narrate(text);
  const c = await choose('Sit on the bed for a moment? (Save your progress)', ['Save', 'Not now'], 1);
  if (c !== 0) return;
  const ok = await G.save(); Audio2.se(ok ? 'page' : 'buzzer');
  await narrate(ok ? 'Wren sits for a while and listens to the rain. (Saved)' : 'Saving failed: your browser blocked storage and the local server isn\'t reachable.');
}

async function Story_intro() {
  const p = P(); p.visible = true;
  FX.fade = 1; await wait(40);
  await Game.card('Prologue', 'Saturday');
  await FX.fadeIn(80);
  await narrate('...');
  await narrate('It\'s the third Saturday since Nana died.');
  await narrate('Mom says this is the last weekend in Nana\'s house. On Sunday, the people with the truck will come.');
  await say('wren:1', '...');
  await narrate('Wren hasn\'t said a word in three weeks.{w:20} Not at the funeral. Not in the car. Not to anyone.');
  await narrate('It isn\'t that there\'s nothing to say.{w:15} It\'s that everything is too big to fit through a mouth.');
  Toast.add('Arrows: move · Z: talk/check · X: menu · Shift: run');
}

// ------------------------------------------------------------ hallway (day)
defMap('hallway', {
  name: 'Upstairs Hallway', theme: 'house', bgm: 'house', rows: HALL_ROWS,
  props: [{ k: 'plant', x: 1, y: 2 }, { k: 'bookshelf', x: 12, y: 2 }],
  deco: [{ type: 'door', x: 3, y: 1, open: true }, { type: 'door', x: 9, y: 1 }, { type: 'door', x: 15, y: 1 }, { type: 'vstairs', x: 19, y: 2, h: 2 },
    { type: 'picture', x: 6, y: 1, pic: 'sea', col: '#a0b8d0' }, { type: 'picture', x: 17, y: 1, pic: 'dandelion', col: '#d8c38a' },
    { type: 'wallimg', x: 4, y: 1, img: 'switch' }],
  exits: [{ x: 3, y: 1, to: 'guest_room', tx: 6, ty: 7, dir: 'up' }, { x: 19, y: 2, y2: 3, to: 'downstairs', tx: 3, ty: 2, dir: 'down', fixed: true }],
  events: [
    thing('study', 9, 1, async () => { await narrate('Nana\'s study. The door is locked.'); await narrate('Mom locked it on the first day. She said she wasn\'t ready yet.'); }),
    thing('bath', 15, 1, () => narrate('The bathroom. Nana\'s toothbrush is still in the cup by the sink. Nobody has moved it.')),
    thing('switch', 4, 1, () => narrate('A light switch. Someone taped a drawing of a rain cloud next to it, with a heart underneath. Wren drew it a long time ago.')),
    thing('pic1', 6, 1,() => narrate('A photo of the sea. Blue and a bit blurry, like it was taken from a moving car.')),
    thing('pic2', 17, 1, () => narrate('A pressed flower in a frame. A dandelion, gone to seed. One seed is missing.')),
    thing('shelf', 12, 2, () => narrate('Picture books. Every single one has "illustrated by M. Hale" on the cover.{w:20} Nana drew them all.')),
    thing('shelf2', 13, 2, () => narrate('"The Moon Who Wanted a Hat." "Pip and the Paper Boat." "Where the Quiet Things Go."')),
    { id: 'ladder', prop: 'ladder', x: 7, y: 2, h: 60, run: async () => {
      if (!G.flag('mom_box')) { await narrate('The attic ladder. It\'s already pulled down.'); await narrate('Mom went up there yesterday and came back down with red eyes.'); return; }
      Audio2.se('step'); await MapScene.transfer('attic', 6, 5, 'up');
    } },
  ],
});

// ------------------------------------------------------------ downstairs (day)
defMap('downstairs', {
  name: 'Living Room & Kitchen', theme: 'house', bgm: 'house', rows: DOWN_ROWS, props: DOWN_PROPS, deco: DOWN_DECO,
  exits: [{ x: 2, y: 1, x2: 3, to: 'hallway', tx: 18, ty: 2, dir: 'left', fixed: true }],
  events: [
    npc('mom', 'mom', 17, 4, Story_momDay, { h: 76, dir: 'left' }),
    thing('piano', 5, 2, () => narrate('Nana\'s piano. There\'s sheet music on the stand, written by hand. No title. Just "for W." at the top.')),
    thing('piano2', 6, 2, () => narrate('Wren presses a key. It\'s out of tune. It sounds like it\'s asking a question.')),
    thing('clock', 9, 2, () => narrate('The grandfather clock stopped at 4:10. Nobody has wound it since.')),
    thing('photo', 8, 9, async () => {
      await narrate('A framed photo on the side table: a day at the beach, years ago. Mom looks so young in it. Tucked into the corner of the frame is an older, smaller one.');
      await Game.showCG('cg_photo', 30); await narrate('Nana in her garden, with little Wren on her lap.{w:20} Wren is wearing the mustard sweater. It was way too big back then too.'); await Game.hideCG(30); }),
    thing('shelf', 1, 9, () => narrate('Cookbooks, garden books, and a whole shelf of sketchbooks, numbered 1 to 46.')),
    thing('shelf2', 2, 9, () => narrate('Sketchbook 47 is missing.')),
    thing('boxes', 10, 11, () => narrate('DONATE. Nana\'s coats. They still have tissues in the pockets.')),
    thing('box', 9, 11, () => narrate('KEEP. Mom packed the teacups in newspaper, one by one.')),
    thing('box2', 1, 11, () => narrate('An empty box. Wren doesn\'t want to fill it.')),
    thing('armchair', 3, 6, () => narrate('Nana\'s armchair. There\'s still a dent in the cushion where she always sat.')),
    thing('door', 5, 12, () => narrate('The front door. It\'s pouring outside. Mom says nobody\'s going anywhere today.')),
    thing('fridge', 21, 2, () => narrate('On the fridge: a crayon drawing of an owl wearing glasses. Wren drew it at five years old.{w:20} Underneath, in Nana\'s writing: "Self-portrait, by my grandchild."')),
    thing('wallclock', 13, 1, () => narrate('The kitchen clock. It\'s still ticking. It\'s the only clock in the house that is.')),
    thing('coat', 10, 1, () => narrate('Nana\'s yellow raincoat on its hook. The pockets are full of seed packets.')),
    thing('doormat', 5, 11, () => narrate('A doormat with a little house on it. Mom still wipes her feet on it, out of habit, even though nobody goes out.'), { solid: false, trigger: 'act' }),
    thing('phone', 20, 2,() => narrate('An old phone with a dial. It rang a lot that first week. Now it\'s quiet.')),
    thing('stove', 16, 2, () => narrate('A pot of soup. Mom made it, but it doesn\'t smell like Nana\'s.')),
    thing('counter', 12, 2, () => narrate('The sink. Mom washed the same plate three times this morning.')),
    thing('counter1b', 13, 2, () => narrate('The sink. Mom washed the same plate three times this morning.')),
    thing('counter2', 14, 2, () => narrate('Two mugs and a jar of honey, almost empty. One mug says WORLD\'S OKAYEST GRANDMA. It was a joke. Nana loved it.')),
    thing('counter2b', 15, 2, () => narrate('Two mugs and a jar of honey, almost empty. One mug says WORLD\'S OKAYEST GRANDMA. It was a joke. Nana loved it.')),
    thing('clockpic', 7, 1, () => narrate('A drawing of a rose, in colored pencil. Signed "M.H." in the corner.')),
    thing('window', 5, 1, () => narrate('The garden. Tomato plants, bent over in the rain.')),
    thing('window2', 18, 1, () => narrate('Rain against the glass.')),
  ],
});

async function Story_momDay(ev) {
  const mom = ev;
  if (!G.flag('mom_box')) {
    await say('mom:0', 'Oh, good morning, sweetheart.{w:15} Did you sleep okay?');
    await say('wren:1', '...');
    await say('mom:1', '...Right. That\'s okay. You don\'t have to answer.');
    await say('mom:0', 'There\'s toast, if you want some. I burned it a little. Nana would have laughed at me.');
    await say('mom:0', 'Hey, could you do me a favor? There\'s a box up in the attic that says CHRISTMAS on it.');
    await say('mom:1', 'I tried to bring it down yesterday, but I...{w:20} I got a bit distracted up there.');
    await say('mom:2', 'Would you grab it for me? The ladder\'s already down, in the hallway. Be careful.');
    G.set('mom_box');
    return;
  }
  if (G.hasItem('christmasbox')) {
    await say('mom:2', 'Oh, you found it! Thank you, sweetheart.');
    G.removeItem('christmasbox'); G.set('box_given'); Audio2.se('item');
    await narrate('Mom opens the box. Inside, wrapped in tissue, are paper ornaments. Stars, moons, a little lantern, all folded by hand.');
    await say('mom:1', 'She made new ones every year. Every single year. I told her to just buy some.{w:20} She said store ones don\'t have any fingerprints on them.');
    await narrate('Mom lifts out a paper owl with tiny drawn-on glasses. She holds it for a long time.');
    await say('mom:3', '...');
    await say('mom:0', 'Wren... when I was up in the attic yesterday, I saw something on the old trunk. It has your name on it.');
    await say('mom:1', 'I couldn\'t bring myself to open it. I think it should be you, anyway.{w:20} When you\'re ready. No rush.');
    return;
  }
  if (!G.flag('book_found')) {
    if (G.flag('box_given')) await say('mom:0', $.pick(['The trunk in the attic. It\'s okay. Take your time.', 'I\'ll be right here, with the soup.', 'I\'m going to hang the paper owl somewhere. Somewhere we\'ll see it.']));
    else await say('mom:0', $.pick(['The CHRISTMAS box. It\'s in the attic, sweetheart.', 'Careful on the ladder, okay?', 'I\'ll be right here, with the soup.']));
    return;
  }
}

// ------------------------------------------------------------ attic
defMap('attic', {
  name: 'Attic', theme: 'attic', bgm: 'house', rows: [
    '##############',
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '##############',
  ], dark: 0.45, lights: () => [{ x: 6.5, y: 2.2, r: 150 }, { x: 9.5, y: 2.5, r: G.flag('book_found') ? 0 : 60 }],
  props: [{ k: 'booktrunk', x: 9, y: 2 }, { k: 'boxes', x: 1, y: 2 }, { k: 'box', x: 2, y: 2 }, { k: 'easel', x: 12, y: 3 },
    { k: 'xmasbox', x: 2, y: 5, cond: () => !G.hasItem('christmasbox') && !G.flag('box_given') },
    { k: 'bookstack', x: 12, y: 6 }, { k: 'boxes', x: 1, y: 6 }],
  deco: [{ type: 'window', x: 6, y: 1, w: 1 }],
  events: [
    { id: 'down', prop: 'ladder', x: 6, y: 6, solid: true, h: 60, run: async () => {
      if (G.flag('book_found')) return;
      Audio2.se('step'); await MapScene.transfer('hallway', 7, 3, 'down');
    } },
    thing('xmas', 2, 5, async () => {
      if (G.hasItem('christmasbox') || G.flag('box_given')) { await narrate('Just dust, where the box used to be.'); return; }
      await narrate('A box that says CHRISTMAS in Nana\'s big loopy handwriting.');
      MapScene.removeProp('xmasbox');
      await give('christmasbox');
      await narrate('It\'s light. Something inside rattles, like paper ornaments.');
    }),
    thing('boxes', 1, 2, () => narrate('Old boxes. BOOKS. FABRIC. "MISC (IMPORTANT)".')),
    thing('box', 2, 2, () => narrate('A box marked YARN. Inside: every color, some of it still attached to half-finished scarves.')),
    thing('easel', 12, 3, () => narrate('An easel with a blank sheet of paper clipped to it. Nana never left a page blank. Except this one.')),
    thing('books', 12, 6, () => narrate('A stack of Nana\'s old sketchbooks, taped at the spines.')),
    thing('boxes2', 1, 6, () => narrate('WINTER CLOTHES. It smells like cedar.')),
    thing('window', 6, 1, () => narrate('A round window. The rain sounds louder up here, like the house is humming.')),
    { id: 'book', x: 9, y: 2, run: Story_book, light: 50, lightCond: () => !G.flag('book_found') },
    thing('trunk2', 10, 2, () => MapScene.ev('book').def.run()),
  ],
});

async function Story_book() {
  if (!G.hasItem('christmasbox') && !G.flag('box_given')) {
    await narrate('An old trunk. On top of it, something is glowing, very faintly.{w:20}\n...Maybe get the box for Mom first.');
    return;
  }
  await narrate('On the trunk, there\'s a sketchbook. The number 47 is written on the spine.');
  await narrate('The cover says:{w:20} {c:#b0761a}THE LANTERN CHILD{/c}.{w:20} And underneath, smaller:{w:10} "for Wren."');
  const c = await choose('Open it?', ['Open the book', 'Not yet'], 1);
  if (c === 1) { await narrate('Wren\'s hands are shaking a little.'); return; }
  Audio2.se('page');
  await narrate('The first page shows a meadow in crayon, a little village, a forest with lanterns in the trees...');
  await narrate('Then the drawings stop. The rest of the pages are pencil sketches. Then just lines.{w:20} Then nothing at all.');
  await narrate('On the very last page, Nana wrote only one line:');
  await narrate('{c:#8a6a5a}"I don\'t know how this one ends, little light."{/c}');
  G.set('book_found');
  G.removeItem('christmasbox'); // left on the attic floor
  Audio2.stopBgm(90);
  await wait(40);
  await narrate('The page is warm.{w:30} The page is{w:20} {v}getting closer{/v}...');
  Audio2.se('whoosh'); FX.doFlash('#fff8e0', 1);
  await FX.fadeOut(40, '#fbf6ea');
  await Game.showCG('cg_fall', 1); FX.fade = 0;
  Audio2.bgm('title', 60);
  await wait(60);
  await narrate('Wren falls.{w:30} Not down, exactly.{w:20} {v}In.{/v}');
  await wait(30);
  FX.fadeColor = '#fbf6ea'; await tween(FX, { fade: 1 }, 50);
  await Game.hideCG(1);
  G.s.chapter = 1;
  await MapScene.load('first_page', 3, 7, 'right');
  await Game.card('Chapter One', 'The Meadow Page');
  await FX.fadeIn(60);
  MapScene.checkAuto();
}
