# PAPERLIGHT

*a story about the pages we leave blank*

A short JRPG in the RPG Maker style (about 45–60 minutes), made with HTML5 canvas and plain JavaScript.
Wren is 10 and hasn't spoken since Nana died. Wren falls into Nana's unfinished picture book and makes
two friends there: a knitted rabbit and a paper moth. Worries walk the pages as scribbled creatures, and
you can fight them or comfort them.

## Play
- **In your browser:** https://m1omg.github.io/Paperlight/ (the online version keeps its save in your browser).
- **Locally:** run `./play.sh`. It starts a tiny local server and opens the game in your browser.
- Or open `game/index.html` directly. Everything works, but music loops can have a tiny gap.
- Or serve the `game/` folder with any static web server.

**Controls**

| Key | Action |
|---|---|
| Arrows / WASD | move |
| Z / Enter / Space | talk, check, confirm |
| X / Esc | back; opens the menu on the map |
| Shift | run |
| C / M | menu |
| F4 | fullscreen |

Save at the glowing **ribbon bookmarks** inside the Book (resting there also heals the party), or by sitting on
Wren's bed in the real world. **Options** (from the title or the in-game menu): music and sound volume, text speed
(Normal/Fast/Instant) and fullscreen.

**Where saves live:** when you play through `./play.sh`, every save is written to `saves/slot1.json` in this folder,
with the previous save kept as `saves/slot1.prev.json`. The game also keeps a copy in the browser. When loading, it
uses the newest copy that isn't damaged, so saves survive a different port, cleared browser data or a damaged file.
Opening `game/index.html` directly can only save inside that browser.

## Battles: "Lantern & Hearts"
- **FIGHT** lowers a Worry's HP. **COMFORT** fills its pink **CALM** meter. Either one clears it.
- Every Worry has a hidden feeling: *Scared*, *Lonely*, *Tired* or *Sore*. Each friend comforts in a different way:
  - Button **Cheers**: good for tired or lonely Worries.
  - Moth **Listens**: good for scared or lonely Worries.
  - Wren **Holds**: works on any feeling, and best once the feeling is known.
- **Illuminate** (Wren's skill, costs Light) reveals a Worry's feeling and its next move.
- Big attacks are announced a turn ahead ("…is winding itself tight"). **GUARD** halves them.
- A full **LIGHT** meter unlocks **TOGETHER**, a party move: *Paper Storm* or *Lullaby*.
- The Worries you soothe come back to help at the end.

## Project layout
- `game/`: the playable game (index.html, js/, img/, audio/, fonts/).
- `tools/`: art pipeline (GPT Image via Codex: `assets.py` prompts, `gen_images.py`, `process_images.py`, `contact.py`), the music synth (`tools/music/`) and `dev_harness.js`, a scripted-playtest helper that is not loaded by the game.
- `art_source/raw/`: the original full-size generated images (not needed to play, not included in the repository).
- `.github/workflows/pages.yml`: publishes the `game/` folder to GitHub Pages on every push to `main`.
- `DESIGN.md`: design notes.

## Credits
- Story, design and code: Claude (Anthropic)
- Illustrations: generated with GPT Image through Codex
- Music and sound: original compositions, synthesized in Python with numpy
- Fonts: Gaegu (JIKJI SOFT) and Patrick Hand (Patrick Wagesreiter), both under the SIL Open Font License (see `game/fonts/`)
- Inspired by the *feeling* of OMORI, UNDERTALE, Ib, End Roll and Re:Kinder. No assets, characters or music from them are used.
