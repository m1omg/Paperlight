"""Train Pip's small GPT chat model from scratch on CPU.

  python3 train_gpt.py --hours 5

The learning-rate schedule runs on wall-clock time (warmup, then cosine decay over --hours),
so training always finishes on time even if the machine is busy with other work.
Checkpoints: runs/gpt/ckpt.pt (resumable), runs/gpt/log.txt
"""
import argparse, math, os, time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from tokenizers import Tokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


class Config:
    vocab = 4096
    ctx = 256
    d = 256
    layers = 8
    heads = 4


class Block(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.ln1, self.ln2 = nn.LayerNorm(c.d), nn.LayerNorm(c.d)
        self.qkv = nn.Linear(c.d, 3 * c.d)
        self.proj = nn.Linear(c.d, c.d)
        self.fc = nn.Linear(c.d, 4 * c.d)
        self.out = nn.Linear(4 * c.d, c.d)
        self.heads = c.heads

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.qkv(self.ln1(x)).split(C, dim=2)
        q, k, v = (t.view(B, T, self.heads, C // self.heads).transpose(1, 2) for t in (q, k, v))
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        x = x + self.proj(y.transpose(1, 2).reshape(B, T, C))
        return x + self.out(F.gelu(self.fc(self.ln2(x)), approximate="tanh"))


class GPT(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.c = c
        self.tok = nn.Embedding(c.vocab, c.d)
        self.pos = nn.Embedding(c.ctx, c.d)
        self.blocks = nn.ModuleList(Block(c) for _ in range(c.layers))
        self.ln = nn.LayerNorm(c.d)
        self.apply(self._init)
        for b in self.blocks:  # scaled init of residual projections (GPT-2)
            nn.init.normal_(b.proj.weight, std=0.02 / math.sqrt(2 * c.layers))
            nn.init.normal_(b.out.weight, std=0.02 / math.sqrt(2 * c.layers))

    @staticmethod
    def _init(m):
        if isinstance(m, nn.Linear):
            nn.init.normal_(m.weight, std=0.02); nn.init.zeros_(m.bias)
        elif isinstance(m, nn.Embedding):
            nn.init.normal_(m.weight, std=0.02)

    def forward(self, idx):
        x = self.tok(idx) + self.pos(torch.arange(idx.shape[1]))
        for b in self.blocks:
            x = b(x)
        return self.ln(x) @ self.tok.weight.T  # tied output head


def batches(path, B, T, rng):
    data = np.memmap(path, dtype=np.uint16, mode="r")
    while True:
        ix = rng.integers(0, len(data) - T - 1, B)
        x = np.stack([data[i:i + T + 1] for i in ix]).astype(np.int64)
        x = np.ascontiguousarray(x)
        yield torch.from_numpy(x[:, :-1].copy()), torch.from_numpy(x[:, 1:].copy())


@torch.no_grad()
def evaluate(model, path, B, T, n=40):
    model.eval()
    rng = np.random.default_rng(123)
    it = batches(path, B, T, rng)
    tot = 0.0
    for _ in range(n):
        x, y = next(it)
        tot += F.cross_entropy(model(x).view(-1, model.c.vocab), y.reshape(-1)).item()
    model.train()
    return tot / n


@torch.no_grad()
def sample(model, tok, prompt, n_tokens=40, temp=0.8, top_p=0.9):
    model.eval()
    ids = tok.encode(prompt).ids
    stop = {tok.token_to_id("<|a|>"), tok.token_to_id("<|b|>"), tok.token_to_id("<|end|>")}
    out = []
    for _ in range(n_tokens):
        x = torch.tensor([ids[-model.c.ctx:]])
        logits = model(x)[0, -1] / temp
        probs = F.softmax(logits, -1)
        sp, si = probs.sort(descending=True)
        keep = (sp.cumsum(0) - sp) < top_p
        sp = sp * keep
        nxt = si[torch.multinomial(sp / sp.sum(), 1)].item()
        if nxt in stop:
            break
        ids.append(nxt); out.append(nxt)
    model.train()
    return tok.decode(out)


PROMPTS = [
    "<|a|> hi! how are you today?<|b|>",
    "<|a|> i had a really bad day at school.<|b|>",
    "<|a|> i just got a new puppy!<|b|>",
    "<|a|> what do you like to do for fun?<|b|>",
    "<|a|> i'm so bored<|b|>",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=5.0)
    ap.add_argument("--lr", type=float, default=1.5e-3)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--out", default=os.path.join(HERE, "runs", "gpt"))
    args = ap.parse_args()

    torch.set_num_threads(args.threads)
    torch.set_flush_denormal(True)  # tiny gradients otherwise make CPU matmuls ~100x slower
    torch.manual_seed(0)
    os.makedirs(args.out, exist_ok=True)
    c = Config()
    model = GPT(c)
    decay = [p for n, p in model.named_parameters() if p.dim() >= 2 and "pos" not in n]
    no_decay = [p for n, p in model.named_parameters() if not (p.dim() >= 2 and "pos" not in n)]
    opt = torch.optim.AdamW([{"params": decay, "weight_decay": 0.1},
                             {"params": no_decay, "weight_decay": 0.0}], lr=args.lr, betas=(0.9, 0.95))
    ckpt_path = os.path.join(args.out, "ckpt.pt")
    step, elapsed_before = 0, 0.0
    if os.path.exists(ckpt_path):
        ck = torch.load(ckpt_path)
        model.load_state_dict(ck["model"]); opt.load_state_dict(ck["opt"])
        step, elapsed_before = ck["step"], ck["elapsed"]
        print("resumed at step", step)
    tok = Tokenizer.from_file(os.path.join(DATA, "bpe.json"))
    n_params = sum(p.numel() for p in model.parameters())
    log = open(os.path.join(args.out, "log.txt"), "a")

    def say(*a):
        s = " ".join(str(x) for x in a)
        print(s, flush=True); log.write(s + "\n"); log.flush()

    say(f"params {n_params/1e6:.2f}M, budget {args.hours}h")
    budget = args.hours * 3600
    warmup = 0.02 * budget
    it = batches(os.path.join(DATA, "train.bin"), args.batch, c.ctx, np.random.default_rng(step + 1))
    t0 = time.time()
    tokens = 0
    last_eval = time.time()
    while True:
        elapsed = elapsed_before + time.time() - t0
        frac = elapsed / budget
        if frac >= 1:
            break
        lr = args.lr * (elapsed / warmup if elapsed < warmup else
                        0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * (elapsed - warmup) / (budget - warmup))))
        for g in opt.param_groups:
            g["lr"] = lr
        x, y = next(it)
        loss = F.cross_entropy(model(x).view(-1, c.vocab), y.reshape(-1))
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        step += 1
        tokens += x.numel()
        if step % 50 == 0:
            say(f"step {step} loss {loss.item():.3f} lr {lr:.2e} {tokens/(time.time()-t0):.0f} tok/s "
                f"elapsed {elapsed/3600:.2f}h")
        if time.time() - last_eval > 1200:  # every 20 minutes
            last_eval = time.time()
            say(f"EVAL step {step} val_loss {evaluate(model, os.path.join(DATA, 'val.bin'), 16, c.ctx):.3f}")
            for p in PROMPTS[:3]:
                say("  ", p.split("|>")[1].split("<|")[0].strip(), "->", sample(model, tok, p))
            torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "step": step,
                        "elapsed": elapsed_before + time.time() - t0}, ckpt_path)
    say(f"FINAL step {step} val_loss {evaluate(model, os.path.join(DATA, 'val.bin'), 16, c.ctx, n=100):.3f}")
    for p in PROMPTS:
        for _ in range(2):
            say("  ", p.split("|>")[1].split("<|")[0].strip(), "->", sample(model, tok, p))
    torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "step": step,
                "elapsed": elapsed_before + time.time() - t0}, ckpt_path)
    torch.save(model.state_dict(), os.path.join(args.out, "final.pt"))
    say("done")


if __name__ == "__main__":
    main()
