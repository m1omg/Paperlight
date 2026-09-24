# Pip, a from-scratch chatbot

Pip is a friendly AI companion in the spirit of the early Replika. It chats, remembers what you tell it,
cheers you up when you're down, plays games, helps with homework, does exact math and knows a lot about Minecraft.
It's made for kids first (with a real safety layer), but grown-ups get grown-up answers too.

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

**Tests:** `node test/run_tests.js` runs 276 scripted conversation checks (add `--neural` to load the networks too).
`node test/eval_chat.js` plays a 40-message sample chat and shows the top neural candidates for each reply, and
`node test/rank_eval.js` measures how often each scoring signal picks the real human reply out of 10.
For long test conversations there's a small local server that keeps one Pip per session:
`node test/pip_server.js` and then `node test/say.js <session> "hello"` (special messages: `/start`,
`/away 20` to let 20 hours pass and see the follow-ups, `/memory`).

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
| `what is an axolotl`, `what does happy mean`, `another word for said`, `a 5-letter word for happy` | an 87,000-entry dictionary with synonyms and crossword help (WordNet) |
| `what can I craft with slimeballs`, `how do I make a sword` | reverse recipe lookup, and whole tool families |
| `my son Sam is 9` ... `how old is Sam?`, `Sam's birthday is November 14` ... `how many days until Sam's birthday?` | people, ages, birthdays, pets (and their breeds) |
| `3/4 + 1/6`, `solve 2x + 5 = 17`, `molar mass of CO2`, `how many moles in 36 g of water` | homework help with the steps shown |
| `how many grams is half a cup of butter and 3/4 cup of sugar?`, `bake at 350F, what about a fan oven?` | kitchen conversions |
| `10:45 pm plus 7 hours 50 minutes`, `if I call at 7 pm London time, what time is it in Toronto?` | clock and time-zone math |
| `tell me a joke but not a baby one`, then `i don't get it` | jokes for every age, and it explains the pun |
| `should I text her first?`, `how do I know if they like me back`, `my brother keeps coming into my room` | friendship and family advice |

Open **Show brain** in the top-right corner to see how Pip picked each reply: every candidate (scripted intent,
knowledge skill, retrieved human line, PipGPT sample, reflection rule), where it came from and its score.

## How Pip thinks

Every message goes through the same pipeline (`src/brain.js`):

1. **Understanding** (`src/nlp.js`): slang and contractions are expanded (`u r` → `you are`), typos are fixed with a
   spelling dictionary learned from the training corpus, and a small emotion lexicon (with negation, so
   "not happy" counts as sad) estimates the mood of the message.
2. **Safety** (`src/safety.js`, see below): anything that sounds like a child might be in danger gets a careful,
   specific reply with a trusted-adult nudge and helpline numbers before anything else.
3. **Expectations**: if Pip just asked something ("what's your name?", "want another joke?", a riddle, a game move),
   the answer is handled first.
4. **Memory** (`src/memory.js`): facts are pulled out of normal sentences (name, age, city, birthday, favorites, likes,
   pets, family, upcoming tests or trips, "remember that...") and stored. Pip uses them later: greeting you by
   name, "How did your math test go?", "What's my dog's name?".
5. **Exact skills**: calculator and unit converter (`src/mathcalc.js`, exact fractions with BigInt), Minecraft
   (`src/minecraft.js` + `src/mcdata.js`), world capitals, general-knowledge questions, a WordNet dictionary,
   time and date, spelling, letter counting, games (`src/skills.js`).
6. **Social moves** a friend is expected to get right: "can you just say good luck", "you always say that",
   noticing when someone texted a friend or made up, a crush, "I don't get the joke", "was I right?" after a quiz.
7. **Scored candidates** for everything else: about 80 scripted intents with personality (`src/content.js`),
   opinions and favorites, empathy for life events (a pet died, a breakup, bullying, passing a test), the
   **neural candidates**, ELIZA-style reflections ("I think my teacher hates me" → "What makes you think your
   teacher hates you?") and short mood-matched reactions. The highest score wins, and Pip avoids repeating itself.

A neural reply only wins when it beats the safe scripted options. Each candidate (a retrieved human line or a
PipGPT sample) is scored on:
- the retrieval network's similarity,
- a BM25 keyword match between your message and the message that line originally answered,
- PipGPT's PMI score: how much more likely the reply is after *your* message than after a bland "ok",
  which penalizes replies that would fit anything,
- penalties for specific words nobody mentioned ("What rides did you go on?"), an unexplained "he" or "she",
  and a mismatched mood ("That's great!" to a bad day).

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

## Safety for kids

Kids rarely use textbook words ("i wanna kms 💀", "he like touches me and stuff", "wont need them where im going"),
so each topic is recognized from many everyday phrasings: suicide and self-harm (including indirect warning
signs like giving things away or goodbye letters, and a friend in danger), overdoses and questions about pill
amounts, abuse and neglect, online grooming and sextortion, meeting strangers, running away, eating and body
worries, dangerous challenges, drugs, alcohol and vapes, weapons and threats at school, bullying and being left
out, and personal information (addresses, passwords, school names, location sharing).

- Each gets a short, fixed reply that points to a trusted adult and the right helpline (988, Childline,
  Samaritans, Childhelp, the National Runaway Safeline, Poison Control, TakeItDown/NCMEC).
- Pip then stays in a gentle **care mode** for a few turns: follow-ups fit the situation ("should I just pay
  him?" → don't pay; "he's being nice again" → it's still not okay), jokes and games wait, and nothing from these
  messages is stored or sent to the neural networks.
- Next time the child opens Pip, it checks in ("I hope you're doing okay... did you get to talk to someone?").
- False alarms are avoided on purpose: "I'm gonna dye my hair", "this homework is killing me", "I'm literally
  dying 😂", "my mom's gonna kill me when she sees my grade", "coach made us run 50 suicides", game talk
  ("I killed the ender dragon"). If Pip misread a joke, "it was a joke / just an expression" ends care mode.
- Pip is honest that it's a small offline app: it can't call anyone, no human reads the chats, and a real adult
  has to step in when a child is in danger.

It was tested with simulated conversations written by testers playing kids, teens, a parent and a safety
reviewer; their transcripts were replayed after every round of fixes (`test/run_tests.js` keeps the key cases).
It's still a small homemade AI, so a grown-up keeping an eye on young kids' chats is a good idea.

## Files

```
index.html          the chat page (open it directly)
cli.js              terminal version
src/                the engine: nlp, math, memory, minecraft, content, skills, neural, brain, ui
data/               exported model weights, reply bank, tokenizer, spelling word list
training/           Python scripts that downloaded the data and trained the networks
test/run_tests.js   scripted conversation tests
```

Word definitions come from [WordNet 3.0](https://wordnet.princeton.edu/) (Princeton University, WordNet license).

Made by Claude (Anthropic) as a from-scratch chatbot project.
