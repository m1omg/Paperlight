"""Persona-tune PipGPT: teach the pretrained model to answer like Pip, a curious and caring listener.

Examples are (up to 4 previous turns) -> reply, where the reply passes the same filters as the reply bank
(no claims about a human life, no self-stories, no names). The loss only counts the reply tokens.

  python3 finetune_gpt.py --minutes 40
Reads runs/gpt/final.pt, writes runs/gpt/persona.pt and runs/gpt/finetune_log.txt
"""
import argparse, json, math, os, random, re, time
import numpy as np
import torch
import torch.nn.functional as F
from tokenizers import Tokenizer
from train_gpt import GPT, Config, PROMPTS, sample
from train_encoder import PERSONA, self_story

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
MAXLEN = 192


def good_reply(r):
    w = r.split()
    if not (2 <= len(w) <= 30) or len(r) > 180:
        return False
    if PERSONA.search(r) or self_story(r) or "<|me|>" in r:
        return False
    return not re.search(r"\d{3,}|\$|%|\b(sir|madam|ma'am|mr|mrs|ms)\b|@|#|https?:", r, re.I)


def build(tok, rng, soda_dialogs):
    human, soda = [], []
    for line in open(os.path.join(DATA, "dialogs.jsonl")):
        d = json.loads(line)
        (soda if d["src"] == "soda" else human).append(d)
    rng.shuffle(soda)
    tag = {0: "<|b|>", 1: "<|a|>"}
    exs = []
    for d in human + soda[:soda_dialogs]:
        t = d["turns"]
        for i in range(1, len(t)):
            r = t[i].strip()
            # EmpatheticDialogues: odd turns are the listener's, the ones we want most
            if d["src"] == "empathetic" and i % 2 == 0:
                continue
            if not good_reply(r):
                continue
            ctx = t[max(0, i - 4):i]
            # the reply is Pip's (<|b|>); going backwards the speakers alternate
            text = "".join(f"{tag[(len(ctx) - j) % 2]} {c.lower()}" for j, c in enumerate(ctx))
            exs.append((text + "<|b|>", " " + r.lower() + "<|a|>", d["src"]))
    rng.shuffle(exs)
    return exs


def encode(tok, exs):
    out = []
    for i in range(0, len(exs), 20000):
        chunk = exs[i:i + 20000]
        ctx_ids = tok.encode_batch([c for c, _, _ in chunk])
        rep_ids = tok.encode_batch([r for _, r, _ in chunk])
        for c, r in zip(ctx_ids, rep_ids):
            r = r.ids
            if len(r) > 64:
                continue
            c = c.ids[-(MAXLEN - len(r)):]
            out.append((c, r))
    return out


def batches(data, bs, rng):
    idx = sorted(range(len(data)), key=lambda i: len(data[i][0]) + len(data[i][1]))
    groups = [idx[i:i + bs] for i in range(0, len(idx), bs)]
    while True:
        rng.shuffle(groups)
        for g in groups:
            L = max(len(data[i][0]) + len(data[i][1]) for i in g)
            x = np.zeros((len(g), L), dtype=np.int64)
            y = np.full((len(g), L), -100, dtype=np.int64)
            for k, i in enumerate(g):
                c, r = data[i]
                seq = c + r
                x[k, :len(seq) - 1] = seq[:-1]
                # predict only the reply tokens (and the closing <|a|>)
                y[k, len(c) - 1:len(seq) - 1] = r
            yield torch.from_numpy(x), torch.from_numpy(y)


@torch.no_grad()
def val_loss(model, data, bs=32):
    model.eval()
    tot, n = 0.0, 0
    it = batches(data, bs, random.Random(0))
    for _ in range(max(1, len(data) // bs)):
        x, y = next(it)
        lg = model(x)
        tot += F.cross_entropy(lg.view(-1, lg.shape[-1]), y.reshape(-1), ignore_index=-100, reduction="sum").item()
        n += (y != -100).sum().item()
    model.train()
    return tot / n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=40)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--batch", type=int, default=24)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--soda_dialogs", type=int, default=120000)
    ap.add_argument("--init", default=os.path.join(HERE, "runs", "gpt", "final.pt"))
    ap.add_argument("--out", default=os.path.join(HERE, "runs", "gpt", "persona.pt"))
    args = ap.parse_args()
    torch.set_num_threads(args.threads)
    torch.set_flush_denormal(True)
    torch.manual_seed(1)
    rng = random.Random(11)
    log = open(os.path.join(HERE, "runs", "gpt", "finetune_log.txt"), "a")

    def say(*a):
        s = " ".join(str(x) for x in a)
        print(s, flush=True); log.write(s + "\n"); log.flush()

    tok = Tokenizer.from_file(os.path.join(DATA, "bpe.json"))
    exs = build(tok, rng, args.soda_dialogs)
    say("examples", len(exs), {k: sum(1 for e in exs if e[2] == k) for k in ("empathetic", "dailydialog", "personachat", "bst", "soda")})
    data = encode(tok, exs)
    val, train = data[:1500], data[1500:]
    model = GPT(Config())
    ck = torch.load(args.init)
    model.load_state_dict(ck["model"] if "model" in ck else ck)
    say(f"start: reply val loss {val_loss(model, val):.3f}")
    for p in PROMPTS[:5]:
        say("   before:", p.split("|>")[1].split("<|")[0].strip(), "->", sample(model, tok, p))
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, betas=(0.9, 0.95), weight_decay=0.01)
    budget = args.minutes * 60
    it = batches(train, args.batch, rng)
    t0 = time.time(); step = 0; seen = 0
    while time.time() - t0 < budget:
        frac = (time.time() - t0) / budget
        lr = args.lr * (min(1.0, frac / 0.03) if frac < 0.03 else 0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * frac)))
        for g in opt.param_groups:
            g["lr"] = lr
        x, y = next(it)
        lg = model(x)
        loss = F.cross_entropy(lg.view(-1, lg.shape[-1]), y.reshape(-1), ignore_index=-100)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        step += 1; seen += x.shape[0]
        if step % 50 == 0:
            say(f"step {step} loss {loss.item():.3f} lr {lr:.2e} examples {seen} min {(time.time()-t0)/60:.1f}")
        if step % 600 == 0:
            say(f"VAL step {step} reply loss {val_loss(model, val):.3f}")
            torch.save(model.state_dict(), args.out)
    say(f"FINAL reply val loss {val_loss(model, val):.3f}")
    for p in PROMPTS[:5]:
        for _ in range(2):
            say("   after:", p.split("|>")[1].split("<|")[0].strip(), "->", sample(model, tok, p))
    torch.save(model.state_dict(), args.out)
    say("done")


if __name__ == "__main__":
    main()
