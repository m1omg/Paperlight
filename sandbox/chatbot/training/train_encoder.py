"""Train Pip's retrieval model: a small bidirectional transformer dual encoder.

Context  = "<|b|> {previous bot line} <|a|> {user line}"  (older line dropped sometimes)
Response = "{reply}"
Both go through one shared 2-layer transformer; separate heads map the mean-pooled states
into a 128-d space where cosine similarity says "this reply fits this context".
Trained with in-batch negatives (InfoNCE). Also builds the curated reply bank.

  python3 train_encoder.py --hours 1.5 --threads 2
Outputs runs/enc/final.pt and data/bank.json
"""
import argparse, json, math, os, random, re, time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from tokenizers import Tokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
MAXLEN = 48

# things an AI companion must not claim about itself (it has no job, spouse, body, past weekend...)
PERSONA = re.compile(
    r"\b(my (wife|husband|girlfriend|boyfriend|son|daughter|kids?|children|mom|mum|mother|dad|father|parents|"
    r"brothers?|sisters?|siblings?|job|boss|co-?workers?|family|grand(ma|mother|pa|father|parents|kids?)|aunt|uncle|"
    r"cousins?|niece|nephew|baby|babies|car|truck|house|home|apartment|dog|dogs|cat|cats|pets?|puppy|kitten|teacher|"
    r"class|classes|school|college|university|major|degree|fianc[ée]e?|team|church|husband's|wife's|"
    r"neighbou?rs?|roommate|best friend|friends|birthday|hometown|town|city|country|farm|garden|body|hair|eyes|"
    r"legs?|arms?|back|stomach|head|doctor|therapist|landlord|dogs?|horse|bike|phone|room|bed|kitchen|office)|"
    r"i('m| am) (a |an )?(\d+|teacher|nurse|doctor|student|mom|dad|mother|father|lawyer|chef|waitress|waiter|"
    r"cashier|farmer|vegan|vegetarian|married|single|divorced|pregnant|retired|christian|muslim|jewish|atheist|"
    r"engaged|widow\w*|senior|junior|freshman|sophomore|parent|grandmother|grandfather|writer|artist|musician|"
    r"singer|dancer|engineer|programmer|accountant|police|cop|firefighter|soldier|veteran|pilot|mechanic|"
    r"in (school|college|high school|the army|the military|the navy)|from|going to (school|college|work)|"
    r"at work|home|on my way|driving|allergic|tall|short|blonde|older|younger|an only child|a twin)|"
    r"i (work|worked|live|lived|study|studied|teach|taught|drive|drove|grew up|was born|go to (school|college|church|work)|"
    r"own|owned|moved|graduated|retired|married|divorced|broke up|got (married|divorced|fired|hired|promoted)|"
    r"just got back|went to|visited|traveled|travelled|bought|ate|cooked|slept|woke up|played (in|on) a)\b|"
    r"i (have|had|got) (a |an |two |three |four |five |\d+ )?(kids?|children|sons?|daughters?|dogs?|cats?|brothers?|"
    r"sisters?|husband|wife|boyfriend|girlfriend|job|car|house|degree|pets?|horses?|birds?|fish|siblings?|twins?|"
    r"baby|test|exam|surgery|cancer|diabetes|headache|cold|flu)|"
    r"years? old|my name|call me|when i was (a kid|a child|young|little|younger|in|\d+)|i'm from|i am from|"
    r"(last|this) (week|night|year|month|weekend|morning|summer|winter)|yesterday|tonight i|tomorrow i|"
    r"today i|in my (free|spare) time|at my (house|place|work|job|school)|our (house|family|kids|dog|cat)|"
    r"we (went|got|had|have|live|are going)|my (favorite|favourite) (band|singer|team|show|movie|book|food|color|colour|animal|season|sport)|"
    r"<\|me\|>)\b", re.I)


# first-person phrases a companion can say honestly; any other I/me/my means a self-story -> skip
FIRST_OK = re.compile(
    r"\b(i'?m (so |really |very |just |truly )?(sorry|glad|happy|proud|here|sure|not sure|curious|excited|impressed|"
    r"listening|all ears|jealous|rooting for you|with you|on your side)|i (really )?(hope|think|bet|understand|agree|see|guess|"
    r"believe|wish|mean|hear you|feel you|feel for you|know (what you mean|how you feel|that feeling|right|it|you can)|"
    r"can (imagine|tell|see|understand|relate)|can't (imagine|believe|wait)|don't (know|think|blame you|understand)|"
    r"(love|like|adore) (that|it|this|those|these|how|the way|your|you)|would (love|like|say|be)|'d (love|like|say|be)|"
    r"(was|am) (just )?(wondering|curious)|appreciate)|let me|tell me|with me|to me|for me|me too|me neither|trust me|"
    r"excuse me|remind me|like me|help me|about me|ask me|show me|teach me|talk to me)\b", re.I)
FIRST = re.compile(r"\b(i|me|my|mine|myself|i'm|im|i've|i'd|i'll|we|our|us)\b", re.I)


ALLOW_CAPS = {"I", "OK", "Okay", "God", "Christmas", "Halloween", "Thanksgiving", "Easter", "English", "Monday",
              "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March",
              "April", "May", "June", "July", "August", "September", "October", "November", "December", "Oh",
              "Wow", "Yes", "No", "Hi", "Hey", "Hello", "Thanks", "Thank", "Good", "Great", "Nice", "Congrats",
              "Congratulations", "Sorry", "Haha", "Lol", "Omg", "LOL", "Well", "So", "And", "But", "Aw", "Aww"}


def self_story(r):
    if FIRST.search(FIRST_OK.sub(" ", r)):
        return True
    for sent in re.split(r"(?<=[.!?])\s+", r):  # capitalized words mid-sentence are usually names
        for w in re.findall(r"[A-Za-z']+", sent)[1:]:
            if w[0].isupper() and w not in ALLOW_CAPS:
                return True
    return False


def encode_batch(tok, texts, left_trunc):
    out = np.zeros((len(texts), MAXLEN), dtype=np.int64)
    lens = np.zeros(len(texts), dtype=np.int64)
    for i, e in enumerate(tok.encode_batch(texts)):
        ids = e.ids[-MAXLEN:] if left_trunc else e.ids[:MAXLEN]
        out[i, :len(ids)] = ids
        lens[i] = max(1, len(ids))
    return out, lens


class Encoder(nn.Module):
    def __init__(self, vocab=4096, d=256, layers=2, heads=4, out=128):
        super().__init__()
        self.tok = nn.Embedding(vocab, d)
        self.pos = nn.Embedding(MAXLEN, d)
        self.layers = nn.ModuleList(nn.TransformerEncoderLayer(d, heads, 4 * d, dropout=0.0, activation="gelu",
                                                               batch_first=True, norm_first=True)
                                    for _ in range(layers))
        self.ln = nn.LayerNorm(d)
        self.ctx_head = nn.Sequential(nn.Linear(d, d), nn.GELU(), nn.Linear(d, out))
        self.resp_head = nn.Sequential(nn.Linear(d, d), nn.GELU(), nn.Linear(d, out))
        self.logit_scale = nn.Parameter(torch.tensor(math.log(20.0)))

    def pooled(self, ids, lens):
        mask = torch.arange(ids.shape[1])[None, :] < lens[:, None]
        x = self.tok(ids) + self.pos(torch.arange(ids.shape[1]))
        for layer in self.layers:
            x = layer(x, src_key_padding_mask=~mask)
        x = self.ln(x)
        m = mask.unsqueeze(-1).float()
        return (x * m).sum(1) / m.sum(1)

    def ctx(self, ids, lens):
        return F.normalize(self.ctx_head(self.pooled(ids, lens)), dim=-1)

    def resp(self, ids, lens):
        return F.normalize(self.resp_head(self.pooled(ids, lens)), dim=-1)


def make_pairs(rng, soda_dialogs=250000):
    pairs = []
    human, soda = [], []
    for line in open(os.path.join(DATA, "dialogs.jsonl")):
        d = json.loads(line)
        (soda if d["src"] == "soda" else human).append(d)
    rng.shuffle(soda)
    for d in human + soda[:soda_dialogs]:
        t = d["turns"]
        for i in range(1, len(t)):
            prev2 = t[i - 2] if i >= 2 and rng.random() < 0.7 else None
            ctx = (f"<|b|> {prev2.lower()} " if prev2 else "") + f"<|a|> {t[i-1].lower()}"
            pairs.append((ctx, t[i].lower(), d["src"], t[i]))
    rng.shuffle(pairs)
    return pairs, human, soda


def build_bank(human, soda, rng, size=60000):
    """Pick well-formed, persona-free replies that could come from Pip."""
    quotas = {"empathetic": 17000, "personachat": 9000, "bst": 7000, "dailydialog": 5000, "soda": 22000}
    by_src = {k: [] for k in quotas}
    seen = set()
    for d in human + soda[:300000]:
        t = d["turns"]
        for i in range(1, len(t)):
            r = t[i].strip()
            w = r.split()
            if not (2 <= len(w) <= 24) or len(r) > 140:
                continue
            if PERSONA.search(r) or self_story(r) or "<|" in r.replace("<|you|>", ""):
                continue
            if not r[0].isupper() or r[-1] not in ".!?":
                continue
            if re.search(r"\d{3,}|\$|%|\b(sir|madam|ma'am|mr|mrs|ms)\b|@|#", r, re.I):
                continue
            key = re.sub(r"[^a-z ]", "", r.lower())
            if key in seen:
                continue
            seen.add(key)
            by_src[d["src"]].append(r)
    bank, srcs = [], []
    for src, q in quotas.items():
        items = by_src[src]
        rng.shuffle(items)
        bank += items[:q]
        srcs += [src] * len(items[:q])
        print("bank", src, min(q, len(items)), "of", len(items))
    json.dump(srcs[:size], open(os.path.join(DATA, "bank_src.json"), "w"))
    return bank[:size]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=1.5)
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--batch", type=int, default=384)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--out", default=os.path.join(HERE, "runs", "enc"))
    ap.add_argument("--resume", action="store_true", help="continue from runs/enc/final.pt with a fresh schedule")
    ap.add_argument("--human_x", type=int, default=1, help="repeat pairs from the human-written (non-SODA) datasets this many times")
    args = ap.parse_args()
    torch.set_num_threads(args.threads)
    torch.set_flush_denormal(True)
    torch.manual_seed(0)
    rng = random.Random(3)
    os.makedirs(args.out, exist_ok=True)
    log = open(os.path.join(args.out, "log.txt"), "a")

    def say(*a):
        s = " ".join(str(x) for x in a)
        print(s, flush=True); log.write(s + "\n"); log.flush()

    pairs, human, soda = make_pairs(rng)
    bank = build_bank(human, soda, rng)
    if not args.resume:  # keep the exported bank untouched when continuing
        json.dump(bank, open(os.path.join(DATA, "bank.json"), "w"))
    val, pairs = pairs[:4096], pairs[4096:]   # same split as the first run, so accuracy stays comparable
    if args.human_x > 1:
        pairs += [p for p in pairs if p[2] != "soda"] * (args.human_x - 1)
        rng.shuffle(pairs)
    say("pairs", len(pairs), "bank", len(bank))
    tok = Tokenizer.from_file(os.path.join(DATA, "bpe.json"))
    model = Encoder()
    if args.resume:
        model.load_state_dict(torch.load(os.path.join(args.out, "final.pt")))
        say("resumed from", os.path.join(args.out, "final.pt"))
    say(f"params {sum(p.numel() for p in model.parameters())/1e6:.2f}M")
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    budget = args.hours * 3600
    warm = 0.03 * budget

    def loss_on(batch):
        c, cl = encode_batch(tok, [p[0] for p in batch], True)
        r, rl = encode_batch(tok, [p[1] for p in batch], False)
        ce = model.ctx(torch.from_numpy(c), torch.from_numpy(cl))
        re_ = model.resp(torch.from_numpy(r), torch.from_numpy(rl))
        logits = model.logit_scale.exp().clamp(max=100) * ce @ re_.T
        # identical replies in one batch ("Thank you!") are not really negatives
        same = torch.tensor([[a[1] == b[1] for b in batch] for a in batch])
        logits = logits.masked_fill(same & ~torch.eye(len(batch), dtype=torch.bool), -1e4)
        lab = torch.arange(len(batch))
        acc = (logits.argmax(1) == lab).float().mean().item()
        return (F.cross_entropy(logits, lab) + F.cross_entropy(logits.T, lab)) / 2, acc

    t0 = time.time(); step = 0; pos = 0
    while time.time() - t0 < budget:
        el = time.time() - t0
        lr = args.lr * (el / warm if el < warm else 0.05 + 0.95 * 0.5 * (1 + math.cos(math.pi * (el - warm) / (budget - warm))))
        for g in opt.param_groups:
            g["lr"] = lr
        if pos + args.batch > len(pairs):
            rng.shuffle(pairs); pos = 0
        batch = pairs[pos:pos + args.batch]; pos += args.batch
        loss, acc = loss_on(batch)
        opt.zero_grad(set_to_none=True); loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
        step += 1
        if step % 50 == 0:
            say(f"step {step} loss {loss.item():.3f} acc@{args.batch} {acc:.3f} lr {lr:.2e} "
                f"pairs {step*args.batch} elapsed {el/3600:.2f}h")
        if step % 500 == 0:
            model.eval()
            with torch.no_grad():
                vl, va = zip(*[loss_on(val[i:i + 512]) for i in range(0, len(val), 512)])
            model.train()
            say(f"VAL step {step} loss {np.mean([v.item() for v in vl]):.3f} acc@512 {np.mean(va):.3f}")
            torch.save(model.state_dict(), os.path.join(args.out, "final.pt"))
    torch.save(model.state_dict(), os.path.join(args.out, "final.pt"))
    say("done")


if __name__ == "__main__":
    main()
