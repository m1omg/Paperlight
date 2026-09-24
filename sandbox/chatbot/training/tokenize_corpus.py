"""Train the byte-level BPE tokenizer and encode the corpus for the GPT.

Text is lowercased (the small model learns faster; the chat engine re-capitalizes output).
A dialogue becomes:  <|a|> turn one<|b|> turn two<|a|> turn three ...<|end|>
The starting role is random, so neither tag means "the one who speaks first".
Writes data/bpe.json, data/train.bin, data/val.bin (uint16 token ids).
"""
import json, os, random
import numpy as np
from tokenizers import Tokenizer, models, pre_tokenizers, decoders, trainers

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
SPECIALS = ["<|end|>", "<|a|>", "<|b|>", "<|me|>", "<|you|>"]
VOCAB = 4096
UPSAMPLE = {"dailydialog": 4, "empathetic": 4, "personachat": 4, "bst": 4, "soda": 1}


def render(turns, rng):
    roles = ["<|a|>", "<|b|>"] if rng.random() < 0.5 else ["<|b|>", "<|a|>"]
    return "".join(f"{roles[i % 2]} {t.lower()}" for i, t in enumerate(turns)) + "<|end|>"


def main():
    rng = random.Random(7)
    dialogs = [json.loads(l) for l in open(os.path.join(DATA, "dialogs.jsonl"))]
    rng.shuffle(dialogs)
    n_val = len(dialogs) // 100
    splits = {"val": dialogs[:n_val], "train": dialogs[n_val:]}

    tok = Tokenizer(models.BPE())
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()
    trainer = trainers.BpeTrainer(vocab_size=VOCAB, special_tokens=SPECIALS, min_frequency=5,
                                  initial_alphabet=pre_tokenizers.ByteLevel.alphabet())
    sample = [render(d["turns"], rng) for d in splits["train"][:150000]]
    tok.train_from_iterator(sample, trainer)
    tok.save(os.path.join(DATA, "bpe.json"))
    print("vocab", tok.get_vocab_size())

    for name, ds in splits.items():
        texts = []
        for d in ds:
            for _ in range(UPSAMPLE[d["src"]] if name == "train" else 1):
                texts.append(render(d["turns"], rng))
        rng.shuffle(texts)
        ids = []
        for i in range(0, len(texts), 20000):
            for enc in tok.encode_batch(texts[i:i + 20000]):
                ids.extend(enc.ids)
        arr = np.array(ids, dtype=np.uint16)
        arr.tofile(os.path.join(DATA, f"{name}.bin"))
        words = sum(len(t.split()) for t in texts)
        print(name, len(texts), "dialogs", len(arr), "tokens", f"{len(arr)/words:.2f} tok/word")

    ex = render(["Hi <|you|>! How are you doing today?", "I'm great, thanks. I just got back from hiking."], rng)
    enc = tok.encode(ex)
    print(enc.tokens)
    print(tok.decode(enc.ids, skip_special_tokens=False))


if __name__ == "__main__":
    main()
