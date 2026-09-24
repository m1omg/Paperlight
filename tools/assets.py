# Asset prompt list for PAPERLIGHT. Each entry: name -> (size, bg, prompt)
# size: "square" 1024x1024, "wide" 1536x1024, "tall" 1024x1536
# bg: "white" | "green" | "full" (full illustration, no cutout)

STYLE = ("Soft hand-drawn children's picture-book illustration, colored pencil and wax crayon texture, "
         "gentle pastel palette, thin wobbly dark-brown outlines, cute rounded simple shapes, cozy but a little "
         "melancholic. Absolutely no text, no letters, no numbers, no watermark, no signature.")
REAL = ("Real-world scene palette: muted, slightly desaturated, soft gray-blue and beige tones, but same hand-drawn "
        "colored pencil style.")
WHITE = ("Isolated on a plain flat pure white background (#FFFFFF), no ground shadow, no border, no frame, "
         "subject fully inside the image with generous empty margin around it.")
GREEN = ("Isolated on a plain flat solid pure chroma-key green background (#00FF00), no ground shadow, no border, "
         "subject fully inside the image with generous margin. The subject itself contains no green.")
TURN = ("Character turnaround sheet: exactly 4 full-body poses of the SAME character in one horizontal row, evenly "
        "spaced with wide empty white gaps between them, none touching: (1) facing the viewer, (2) walking toward the "
        "LEFT in side profile, (3) walking toward the RIGHT in side profile, (4) back view facing away. Chibi RPG "
        "proportions (big head, small body, about 2.5 heads tall), identical size, colors and design in all 4 poses.")
FACES = ("Four head-and-shoulders portraits of the SAME character arranged in a strict 2x2 grid, each portrait centered "
         "in its own quadrant with wide empty white gutters, identical framing and size in all four. Expressions: "
         "top-left: {a}; top-right: {b}; bottom-left: {c}; bottom-right: {d}.")
STICKERS = ("A sticker sheet of exactly 9 separate objects arranged in a 3x3 grid with wide empty white space between "
            "them; no object touches another or the image edge. Each object drawn complete in a slight top-down 3/4 "
            "view like furniture in a 2D RPG game. Reading order (left-to-right, top-to-bottom): {items}.")
TEX = ("A seamless tileable texture filling the entire square image edge to edge, flat top-down view, evenly lit, "
       "no objects, no perspective, no vignette: {what}.")

WREN = ("Wren, a quiet 10-year-old child with messy short dark-brown hair covering the ears, pale skin, sleepy "
        "sad eyes, wearing an oversized mustard-yellow hand-knitted sweater with long sleeves covering the hands, "
        "dark gray shorts, cream knee socks, small brown shoes; androgynous")
BUTTON = ("Button, a small hand-knitted plush rabbit made of cream-white yarn, long floppy ears with one ear patched "
          "with a small blue square of fabric, one big black sewn-on button eye and one stitched cross eye, a red "
          "knitted scarf, stubby arms, standing upright on two feet, brave little expression")
MOTH = ("Moth, a small round fluffy moth creature made of soft fur and folded paper, pale lilac and cream colors, big "
        "round dark shiny eyes, feathery antennae, four rounded paper wings with faint pencil patterns, standing "
        "upright on tiny legs, shy gentle expression")
MOM = ("Mom, a tired woman in her late 30s with long dark-brown hair in a loose low ponytail, gray cardigan over a "
       "white shirt, blue jeans, house slippers, gentle but exhausted face")
OWL = ("the Storyteller, an old kind owl with round brown-and-cream feathers, small round spectacles, a knitted "
       "rose-pink shawl around the shoulders, holding a pencil in one wing, standing upright, warm wise smile")

A = {}
def add(name, size, bg, prompt):
    extra = {"white": WHITE, "green": GREEN, "full": ""}[bg]
    A[name] = (size, bg, f"{prompt} {STYLE} {extra}".strip())

# --- overworld characters (turnarounds) ---
add("char_wren", "wide", "white", f"{TURN} The character: {WREN}.")
add("char_button", "wide", "white", f"{TURN} The character: {BUTTON}.")
add("char_moth", "wide", "white", f"{TURN} The character: {MOTH}.")
add("char_mom", "wide", "white", f"{TURN} The character: {MOM}. {REAL}")
add("char_owl", "square", "white", f"Full-body front view of {OWL}, chibi RPG proportions.")
add("npcs", "wide", "white",
    "Six different cute storybook townsfolk characters, full body, front view, arranged in a 3x2 grid with wide empty "
    "white space between them, none touching. Reading order: (1) a snail postmaster with a tiny blue cap and a mail "
    "satchel; (2) a sleepy mushroom person with a red spotted cap and a striped nightcap on top, yawning; (3) a teacup "
    "lady — a porcelain teacup with a flowery pattern, little arms and a sunhat; (4) an origami paper crane with a "
    "kind face; (5) a pencil mayor — a short yellow pencil with a tiny top hat and a curly mustache; (6) a little "
    "yarn-ball kitten, round, made of pink yarn.")

# --- dialogue / battle portraits ---
add("face_wren", "square", "white", FACES.format(a="neutral quiet blank stare", b="sad, eyes looking down",
    c="small shy gentle smile", d="crying with tears streaming") + f" The character: {WREN}.")
add("face_button", "square", "white", FACES.format(a="big cheerful grin", b="determined and angry, ready to fight",
    c="sad with droopy ears", d="shocked surprised") + f" The character: {BUTTON}.")
add("face_moth", "square", "white", FACES.format(a="shy calm neutral", b="frightened and trembling",
    c="warm happy smile", d="crying softly") + f" The character: {MOTH}.")
add("face_mom", "square", "white", FACES.format(a="tired neutral", b="sad and worried",
    c="gentle warm smile", d="crying") + f" The character: {MOM}. {REAL}")
add("face_owl", "square", "white", f"A single head-and-shoulders portrait of {OWL}, centered.")

# --- enemies (Worries) ---
E = "A cute but slightly eerie creature called a Worry, full body, front-facing, in a JRPG battle pose: "
add("en_dustbunny", "square", "white", E + "a fluffy gray dust-ball bunny made of lint and dust, anxious wobbly eyes, tiny trembling paws, little bits of fluff floating around it.")
add("en_tangle", "square", "white", E + "a creature made of a tangled knot of black and dark-red crayon scribble lines, two round white glaring eyes and a jagged little mouth, scribble arms.")
add("en_crow", "square", "white", E + "a crow made of folded gray paper with long thin legs, holding a sealed blank envelope in its beak, droopy lonely eyes.")
add("en_cloud", "square", "white", E + "a small sleepy dark-blue rain cloud with stubby arms and heavy half-closed eyelids, drizzling a little rain beneath it.")
add("en_mitten", "square", "white", E + "a single lost red knitted mitten with sad button eyes and a loose dangling yarn thread, looking for its pair.")
add("en_clock", "square", "white", E + "a small round alarm clock with two bells, frantic spiral eyes, skinny legs and arms, sweating, its hands spinning.")
add("en_blot", "square", "white", E + "a spilled black ink blot creature with several small white eyes and dripping edges, sulking.")
add("en_sketchling", "square", "white", E + "an unfinished creature drawn only in faint gray pencil outlines, half of its body not yet drawn, lonely hollow eyes, construction lines visible.")
add("boss_eraser", "square", "white", "A big boss monster, full body, front-facing: The Eraser, a giant worn pink rubber eraser with crumbling edges, heavy tired stern eyes, tiny pencil-stub arms, pink eraser crumbs flying around it. Cute but imposing.")
add("boss_hush", "tall", "green", "A towering final boss, full body, front-facing: Hush, a huge silent shape made of blank white paper with torn edges and faint gray pencil shading, no mouth, one large closed eye, its silhouette vaguely like a child hugging their knees, loose paper scraps floating around it. Quiet, sad and eerie.")

# --- battle backgrounds ---
BB = "A wide background scene for a 2D JRPG battle, no characters, no creatures, soft focus, empty ground in the center: "
add("bb_meadow", "wide", "full", BB + "a gentle crayon-drawn flower meadow under a pale yellow-blue sky with paper-cut clouds.")
add("bb_forest", "wide", "full", BB + "a dark forest at night drawn in colored pencil, deep blue and violet trees, small paper lanterns glowing in the branches.")
add("bb_eraser", "wide", "full", BB + "a crayon meadow clearing where large patches of the drawing have been rubbed out into blank white paper, smudges and eraser crumbs everywhere.")
add("bb_unfinished", "wide", "full", BB + "an unfinished world of blank off-white paper with faint gray pencil sketch lines of half-drawn houses and trees, construction lines, very pale.")
add("bb_hush", "wide", "full", BB + "a quiet endless void of soft gray paper, faint pencil-drawn stars, loose pages drifting slowly, melancholic.")

# --- title & CGs ---
add("title", "wide", "full", "Title-screen illustration: a small child in an oversized mustard-yellow knitted sweater holding a glowing paper lantern, sitting on a giant open picture book at night; the book's pages turn into a colorful crayon meadow on the left and fade into blank white paper on the right; a knitted rabbit with a red scarf and a small lilac paper moth sit beside the child. Leave calm empty night sky in the upper third.")
add("cg_fall", "wide", "full", "A child in an oversized mustard-yellow knitted sweater falling gently through swirling pages of a picture book, crayon drawings of flowers and stars on the pages, dreamy, soft light.")
add("cg_owl", "wide", "full", f"A warm room built of stacked giant books and paper pages lit by a soft lamp; {OWL} sits in an armchair, smiling kindly at the viewer, a half-finished drawing on an easel beside her.")
add("cg_ending", "wide", "full", "Morning in a sunlit kitchen with cardboard moving boxes; a child in an oversized mustard-yellow knitted sweater hugs their tired mother with a long dark-brown ponytail and a gray cardigan; both crying but smiling; an open picture book with a drawing of an owl lies on the table. " + REAL.replace("muted, slightly desaturated", "warm, gently glowing"))
add("cg_photo", "square", "full", "An old slightly faded family photograph: a smiling elderly grandmother with a gray bun and round glasses holding a small toddler in a mustard-yellow sweater on her lap, sitting in a garden. Photo has a white border.")

# --- textures ---
add("tex_wood", "square", "full", TEX.format(what="old warm wooden floorboards running horizontally, muted brown, hand-drawn colored pencil"))
add("tex_wall", "square", "full", TEX.format(what="faded vintage wallpaper with small pale flowers on dusty blue-gray, hand-drawn colored pencil"))
add("tex_attic", "square", "full", TEX.format(what="plain dusty gray-brown wooden floor planks running horizontally, like an old attic floor, hand-drawn colored pencil; only planks, no wallpaper, no flowers, no pattern, no objects"))
add("tex_grass", "square", "full", TEX.format(what="soft crayon-drawn green grass meadow with a few tiny white and yellow flowers, gentle strokes"))
add("tex_path", "square", "full", TEX.format(what="warm sandy dirt path drawn in crayon with little pebbles"))
add("tex_forest", "square", "full", TEX.format(what="dark blue-green mossy forest floor at night drawn in colored pencil, tiny dark leaves"))
add("tex_paper", "square", "full", TEX.format(what="completely blank off-white sketchbook paper with only very faint light-gray pencil hatching; empty, no drawings, no animals, no plants, no objects, no pattern"))
add("tex_water", "square", "full", TEX.format(what="calm crayon-drawn blue water with light ripples"))
add("tex_tile", "square", "full", TEX.format(what="old checkered kitchen floor tiles in muted cream and pale sage green, hand-drawn colored pencil"))

# --- props (sticker sheets) ---
add("props_house1", "square", "white", STICKERS.format(items="a single wooden bed with a patchwork quilt seen from above; a tall wooden wardrobe; a closed cardboard moving box; a stack of three cardboard boxes; an old upright piano; a grandfather clock; a bookshelf full of books; a floral armchair; a small side table with a lamp") + " " + REAL)
add("props_house2", "square", "white", STICKERS.format(items="a kitchen counter with a sink; an old white stove; a small round wooden dining table; a potted leafy plant; a wooden chair; an oval braided rug seen from above; a wooden attic ladder; a dusty old trunk chest; an artist's drawing desk covered with papers and pencils") + " " + REAL)
add("props_house3", "square", "white", STICKERS.format(items="a plain wooden kitchen counter with drawers and NO sink, with a small honey jar and two mugs standing on top; a small wooden side table with a framed family photograph standing on it; a bedside nightstand with a glass of water and a folded paper note on top; an old white kitchen stove with a pot of soup on top and a little steam rising; a white refrigerator with a child's crayon drawing of an owl held on its door by a magnet; an old wooden trunk with a closed sketchbook lying on top of it; a painter's easel holding a child's crayon drawing of an owl wearing glasses; an open cardboard box full of handmade paper Christmas ornaments; a small telephone table with an old rotary telephone on it") + " " + REAL)
GRID9 = ("A sticker sheet of exactly 9 separate objects arranged in a strict 3x3 grid with wide empty white space between "
         "them; no object touches another or the image edge. Reading order (left-to-right, top-to-bottom): {items}.")
add("deco_house", "square", "white", GRID9.format(items=
    "a closed wooden interior door with a brass knob, seen straight from the front; "
    "an open doorway seen straight from the front, dark shadowy room beyond, door swung inward; "
    "an open doorway seen straight from the front with warm golden lamplight glowing from inside; "
    "a rectangular house window with a white cross-shaped frame seen straight on, gray rainy daytime sky and raindrops on the glass; "
    "the same window at night, deep blue sky, rain on the glass; "
    "the same window in the morning, clear warm golden sunrise sky, no rain; "
    "a small framed painting of a lighthouse by the sea; "
    "a small framed colored-pencil drawing of a single pink rose; "
    "a small framed photograph of a blue sea, slightly blurry") + " " + REAL)
add("deco_house2", "square", "white", GRID9.format(items=
    "a small frame holding a pressed dandelion gone to seed; "
    "a small framed child's crayon drawing of a child holding a lantern; "
    "a round attic window with rain on the glass seen straight on; "
    "a short wooden staircase going up, seen from above at a slight angle, about twice as wide as tall; "
    "a short wooden staircase going down to the right, seen from above, taller than wide; "
    "a small doormat; "
    "a wall-mounted coat hook with a raincoat; "
    "a small wall clock; "
    "a light switch with a little drawing taped next to it") + " " + REAL)
add("deco_dream", "square", "white", GRID9.format(items=
    "a wide low wall of tangled black thorny brambles, seen from above at a slight angle, wider than tall; "
    "a small colorful wooden footbridge seen from directly above, running from top to bottom, red railings and yellow planks; "
    "the exact same footbridge drawn only as faint gray pencil outlines on blank white paper, completely uncolored; "
    "a wooden easel holding a finished colored-pencil painting of a garden with red tomatoes; "
    "a wooden easel holding a finished colored-pencil painting of two mugs of tea by a rainy window; "
    "a wooden easel holding a finished colored-pencil painting of a night sky with a crescent moon and floating music notes; "
    "a round fluffy green hedge bush drawn in crayon; "
    "a round dark blue-violet night bush drawn in colored pencil; "
    "a round bush drawn only in gray pencil sketch lines, uncolored"))
add("deco_dream2", "square", "white", GRID9.format(items=
    "an irregular patch where a crayon drawing of grass was rubbed out by an eraser, showing blank white paper with pink eraser crumbs, seen from above; "
    "a small pencil doodle of a smiling sun; "
    "a small pencil doodle of a little house; "
    "a small pencil doodle of a cloud and a bird; "
    "a small pencil doodle of a star and a flower; "
    "a small pencil doodle of a paper boat; "
    "a large pencil doodle of a winding path with arrows; "
    "a small pencil doodle of a cat; "
    "a small pencil doodle of a tree"))
add("props_dream1", "square", "white", STICKERS.format(items="a round fluffy crayon tree; a tall pine tree; a flowering bush; a small cottage shaped like a red mushroom; a blank wooden signpost; a paper lantern on a wooden post; a round mossy stone; a small stone well; a wooden fence segment"))
add("props_dream2", "square", "white", STICKERS.format(items="a dark blue forest tree; a tree with glowing paper lanterns hanging from it; a big glowing blue mushroom; a cottage shaped like a teacup; a tree stump; a giant red ribbon bookmark stuck upright in the ground, glowing softly; a mailbox; a painter's easel with a blank canvas; a tall stack of old books"))
add("props_dream3", "square", "white", STICKERS.format(items="a tree drawn only in gray pencil sketch lines; a small house drawn only in gray pencil sketch lines; an empty wooden picture frame on an easel; a crumpled paper ball; a giant yellow pencil standing upright; a pink eraser block; a sketched lamp post in pencil; a glass ink bottle; a gray paper gate arch drawn in pencil"))
add("icons", "square", "white", STICKERS.format(items="a red wax crayon; a yellow wax crayon; a blue wax crayon; a glowing paper lantern; a chocolate chip cookie; a cup of warm tea; an old brass key; a folded letter in an envelope; a colorful wrapped candy"))
