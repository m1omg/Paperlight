# Pip, a from-scratch chatbot

Pip is a friendly AI companion in the spirit of the early Replika. It chats, remembers what you tell it,
cheers you up when you're down, plays games, does exact math and knows a lot about Minecraft.

There is **no ChatGPT, no LLM API and no downloaded pretrained model** inside. Everything was written or trained
for this project:

- hand-written personality, rules and a dialogue manager (JavaScript)
- a Minecraft knowledge base (crafting grids, smelting, brewing, mobs, ores, enchantments, guides)
- two neural networks **trained from zero** on public conversation datasets:
  - a **retrieval network** (a small transformer "dual encoder") that picks fitting replies from about 60,000
    human-written lines and judges every candidate reply,
  - **PipGPT**, a 7.4-million-parameter GPT-style language model that writes its own replies.

It runs completely offline in your browser (or in a terminal with Node.js). No server, no account, no data leaves your device.

## Run it

**In a browser:** open `index.html` (double-click it). That's all. The neural networks load in the background
for a few seconds; Pip already works with rules and knowledge while they load.

**In a terminal** (Node.js 18 or newer):

```bash
node cli.js            # chat
node cli.js --debug    # also shows which part of the brain answered and how each candidate scored
node cli.js --fresh    # start with an empty memory
```

The terminal version keeps its memory in `~/.pip_memory.json` (change it with the `PIP_MEMORY` environment variable).

**Tests:** `node test/run_tests.js` runs 73 scripted conversation checks (add `--neural` to load the networks too).

## Things to try

| Say | What happens |
|---|---|
| `my name is Sam`, `I have a dog named Rex`, `my favorite color is blue` | Pip remembers it (see the **Memory** tab) |
| `what do you know about me?` | a summary of everything it learned |
| `how do I craft a diamond pickaxe?` then `what about iron?` then `and a sword?` | a crafting grid, and follow-ups keep the context |
| `where do I find diamonds`, `how do I beat the ender dragon`, `best enchantments for a bow` | Minecraft knowledge |
| `what's 0.1 + 0.2`, `-3 - -7`, `-2^2`, `10 divided by 3`, `convert 5 km to miles` | exact decimal math (no floating-point surprises) |
| `I'm so stressed about my exam` | empathy, and it asks how the exam went next time you come back |
| `let's play a game`, `tell me a riddle`, `quiz me`, `would you rather` | games with scores |
| `I'll call you Nova` | renames Pip |
| `how many r's are in strawberry` | counts letters properly |

Open **Show brain** in the top-right corner to see how Pip picked each reply: every candidate (scripted intent,
knowledge skill, retrieved human line, PipGPT sample, reflection rule), where it came from and its score.

## How Pip thinks

Every message goes through the same pipeline (`src/brain.js`):

1. **Understanding** (`src/nlp.js`): slang and contractions are expanded (`u r` → `you are`), typos are fixed with a
   spelling dictionary learned from the training corpus, and a small emotion lexicon (with negation, so
   "not happy" counts as sad) estimates the mood of the message.
2. **Safety**: messages about self-harm get a caring reply with helpline numbers before anything else.
3. **Expectations**: if Pip just asked something ("what's your name?", "want another joke?", a riddle, a game move),
   the answer is handled first.
4. **Memory** (`src/memory.js`): facts are pulled out of normal sentences (name, age, city, birthday, favorites, likes,
   pets, family, upcoming tests or trips, "remember that...") and stored. Pip uses them later: greeting you by
   name, "How did your math test go?", "What's my dog's name?".
5. **Exact skills**: calculator and unit converter (`src/mathcalc.js`, exact fractions with BigInt), Minecraft
   (`src/minecraft.js` + `src/mcdata.js`), world capitals, general-knowledge questions, time and date, spelling,
   letter counting, games (`src/skills.js`).
6. **Scored candidates** for everything else: about 80 scripted intents with personality (`src/content.js`),
   opinions and favorites, empathy for life events (a pet died, a breakup, bullying, passing a test), the
   **neural candidates** and ELIZA-style reflections ("I think my teacher hates me" → "What makes you think your
   teacher hates you?"). The highest score wins, and Pip avoids repeating itself.

### The neural networks (`src/neural.js`, trained with `training/`)

Both run in plain JavaScript that I wrote for this (no libraries): a byte-level BPE tokenizer, a transformer
forward pass with a key/value cache, and nucleus sampling.

| | Retrieval network | PipGPT |
|---|---|---|
| Architecture | 2-layer bidirectional transformer, d=256, two 128-d heads ("dual encoder") | 8-layer decoder-only transformer, d=256, 4 heads, 256-token context |
| Parameters | 2.8M | 7.4M |
| Trained on | 2.1M (context → reply) pairs, contrastive loss with in-batch negatives | ~60M tokens of dialogue, next-token prediction |
| Job | scores how well a reply fits the conversation; finds the best of ~60,000 human-written lines | writes new replies; 4 samples per turn, judged by the retrieval network |
| Size in the browser | 3 MB + 10 MB reply bank | 10 MB (int8 weights) |

Human-written replies were filtered so Pip doesn't claim a human life ("my wife", "I'm a nurse", "last weekend I..."):
it's an AI friend and says so.

Training ran on a 4-core CPU with no GPU: about 45 minutes for the retrieval network and 5 hours for PipGPT.
A tip if you retrain on CPU: `torch.set_flush_denormal(True)`. Without it, tiny gradient values made the matrix
multiplications about 150× slower on this machine.

### Retraining

```bash
cd training
pip install torch numpy pyarrow tokenizers requests
python3 download_data.py      # public datasets only, ~870 MB (not committed)
python3 prepare.py            # clean + merge into data/dialogs.jsonl
python3 tokenize_corpus.py    # train the BPE tokenizer, encode the corpus
python3 train_encoder.py --hours 0.75 --threads 4
python3 train_gpt.py --hours 5
python3 export_words.py
python3 export.py tokenizer && python3 export.py encoder && python3 export.py gpt
```

### Training data

Only datasets are downloaded, no models:
[SODA](https://huggingface.co/datasets/allenai/soda) (CC BY 4.0),
[DailyDialog](https://huggingface.co/datasets/roskoN/dailydialog) (CC BY-NC-SA 4.0),
[EmpatheticDialogues](https://huggingface.co/datasets/facebook/empathetic_dialogues) (CC BY-NC 4.0),
[PersonaChat](https://huggingface.co/datasets/bavard/personachat_truecased) and
[Blended Skill Talk](https://huggingface.co/datasets/ParlAI/blended_skill_talk) (research datasets from Facebook AI / ParlAI).
Several of these licenses are non-commercial, so this is a personal and educational project.

## Files

```
index.html          the chat page (open it directly)
cli.js              terminal version
src/                the engine: nlp, math, memory, minecraft, content, skills, neural, brain, ui
data/               exported model weights, reply bank, tokenizer, spelling word list
training/           Python scripts that downloaded the data and trained the networks
test/run_tests.js   scripted conversation tests
```

Made by Claude (Anthropic) as a from-scratch chatbot project.
