# PAPERLIGHT — design notes

*"a story about the pages we leave blank"*

An original JRPG/RPG-Maker-style adventure made with HTML5 canvas and plain JavaScript.
It draws on the *feel* of Omori, Undertale, Ib, End Roll and Re:Kinder: a cozy dream world with
something sad under it, battles you can win without hurting anyone, gallery-style puzzles and a
quiet real world. It does not reuse their characters, story, mechanics or music.

## Premise
**Wren** (10) hasn't said a word since Nana died three weeks ago. Wren and Mom are spending
one last weekend in Nana's house, packing it up. Nana illustrated children's books. In the attic Wren finds
her last, unfinished picture book, **"The Lantern Child"**, written for Wren. Wren falls into its pages.

The Book-world is drawn in crayon and colored pencil. Some of its pages were never finished, and
the unfinished white spreads. Worries walk around as scribbled creatures. Somewhere past the last
drawn page waits **the Storyteller**, an old owl in a knitted shawl. Nana drew herself as the owl.

Themes: grief, silence, wanting to forget vs. being afraid to forget, letting go and saying the thing out loud.

## Cast
- **Wren**: silent protagonist. Wears an oversized mustard sweater that Nana knitted. Carries a paper lantern in the Book.
- **Button**: a knitted rabbit with one button eye and a red scarf. Brave and loud, and scared of being forgotten. Party attacker.
- **Moth** (Mothwick): a soft paper moth who is afraid of the dark but loves light. Gentle, a listener. Party healer/support.
- **Mom**: tired and trying. Real world only.
- **The Storyteller**: an owl with round glasses and a shawl. Appears at the end.
- Book NPCs: Postmaster Snail, Sleepy Mushroom, Teacup Lady, Paper Crane, Pencil Mayor and others.

## Battle system — "Lantern & Hearts"
Party-based turn battles in the Omori/Earthbound style, with portrait boxes along the bottom.
- Each party member has **HEART** (HP) and **WAX** (skill points; wax crayons).
- The party shares one **LIGHT** meter (0–100). Most actions add a little; *Wren's* actions add a lot.
- Every Worry (enemy) has **HP** and a hidden **true feeling**: *Scared*, *Lonely*, *Tired* or *Sore* (hurt/angry).
- **FIGHT** lowers HP. **COMFORT** fills the enemy's **CALM** meter:
  - Button → *Cheer* (fits Tired, Lonely)
  - Moth → *Listen* (fits Scared, Lonely)
  - Wren → *Hold* (fits any feeling once it's revealed; costs Light)
  - A comfort that fits fills a lot. One that doesn't fills a little, and a Sore enemy gets angrier.
- **ILLUMINATE** (Wren, costs 20 Light; battles start with 20) reveals an enemy's true feeling and its next move.
- Enemies **telegraph** big attacks ("The Tangle is winding tight…"). **GUARD** halves the damage.
- **TOGETHER** (100 Light): a big party move, either *Paper Storm* (damage to all) or *Lullaby* (calm to all).
- A Worry whose CALM fills is **soothed**: it sighs, smiles and fades away. Soothing Worries earns more
  Memory Pages (an optional collectible) and changes the final battle and the ending text.
- A Worry whose HP runs out is **scattered**. That gives EXP too. Neither path is punished; both are remembered.

## Structure (~40–60 min)
0. **Prologue — Nana's House (real world, Saturday)**: guest room, hallway, living room and kitchen, attic → the book.
1. **Chapter 1 — The Meadow Page**: meet Button. Crayon Hollow village. Collect the 3 lost crayons to color the bridge.
   The Lamplit Wood is dark, so only the lantern shows the way. Meet Moth there. Boss: **The Eraser**
   (a Worry that wants to rub out every sad page).
2. **Interlude — Night (real world)**: Wren wakes, and Mom is on the phone in the kitchen. Nana's study is unlocked. Find the note.
3. **Chapter 2 — The Unfinished Pages**: sketch-only white rooms and a gallery puzzle
   (finish Nana's drawings with the right item). Hush follows you.
4. **Finale — The Last Page**: the Storyteller, then **Hush**, the big silence. It can't be beaten by fighting.
   Wren has to *SPEAK*.
5. **Ending**: Sunday morning. Wren talks to Mom.

## Tech
- `game/index.html` + classic `<script>`s. It runs from `file://` or any static server.
- 640×480 logical resolution, 32px tiles, scaled up to fit the window.
- Art is generated with GPT Image through Codex (`tools/gen_*.sh`). Backgrounds are cut out with `tools/process_images.py`.
- Music and SFX are original compositions rendered offline in Python/numpy (`tools/music/`) to `.ogg`.
