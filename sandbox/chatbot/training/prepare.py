"""Clean the raw dialogue datasets into one corpus: data/dialogs.jsonl

Each line: {"src": <dataset>, "turns": [utterance, ...]}
Names of the two speakers (SODA) are replaced by the placeholders <|me|> (the speaker's own name)
and <|you|> (the listener's name), so the models learn to address "whoever they are talking to"
instead of inventing names. At chat time <|you|> becomes the user's name (or is dropped).
"""
import collections, glob, json, os, random, re, unicodedata
import pyarrow.parquet as pq

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
OUT = os.path.join(HERE, "data", "dialogs.jsonl")

ME, YOU = "<|me|>", "<|you|>"

# speaker labels that describe a relationship we don't want the companion to role-play
SKIP_ROLES = {
    "boss", "clerk", "cashier", "police officer", "officer", "customer", "salesperson", "interviewer",
    "librarian", "doctor", "teacher", "coach", "waiter", "waitress", "receptionist", "manager",
    "employee", "judge", "nurse", "agent", "bartender", "driver", "landlord", "pharmacist", "professor",
    "therapist", "stranger", "wife", "husband", "girlfriend", "boyfriend", "mother", "mom", "father",
    "dad", "parent", "parents", "son", "daughter", "grandmother", "grandfather", "grandma", "grandpa",
    "priest", "pastor", "counselor", "principal", "student", "students", "child", "children", "kid",
    "baby", "man", "woman", "person", "other person", "character", "friends", "guard", "soldier",
    "captain", "king", "queen", "god", "dog", "cat", "people", "group", "crowd", "audience", "team",
    "mechanic", "security guard", "server", "host", "owner", "shopkeeper", "vendor", "seller", "buyer",
    "client", "patient", "lawyer", "attorney", "detective", "reporter", "journalist", "neighbor",
    "roommate", "coworker", "co-worker", "colleague", "classmate", "sister", "brother", "aunt", "uncle",
    "cousin", "family", "date", "ex", "fiance", "fiancee", "partner", "lover", "crush", "enemy",
}
FRIENDLY_ROLES = {"friend", "best friend", "buddy"}

BAD = re.compile(r"\b(fuck\w*|shit\w*|bitch\w*|cunt|nigg\w*|fag\w*|retard\w*|slut\w*|whore\w*|dick\w*|"
                 r"cock\w*|pussy|porn\w*|rape\w*|raping|sex\w*|nazi\w*|kill yourself|kys)\b", re.I)
URL = re.compile(r"https?://|www\.|\.com\b", re.I)


def norm_text(s):
    s = unicodedata.normalize("NFKC", s)
    s = (s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
          .replace("…", "...").replace("—", " - ").replace("–", " - ").replace("`", "'"))
    s = s.replace("_comma_", ",")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def detok(s):
    """Undo the space-before-punctuation tokenization used by DailyDialog."""
    s = re.sub(r" ([,.!?;:%)\]}])", r"\1", s)
    s = re.sub(r"([(\[{$]) ", r"\1", s)
    s = re.sub(r" ?' ?(s|m|re|ve|ll|d|t)\b", r"'\1", s)
    s = re.sub(r"\bn ' t\b", "n't", s)
    s = re.sub(r"([a-z])\.([A-Z])", r"\1. \2", s)       # "right.But" -> "right. But"
    s = re.sub(r"([,!?])([A-Za-z])", r"\1 \2", s)
    s = re.sub(r'" (.*?) "', r'"\1"', s)
    return s.strip()


def ok_turn(t):
    if not t or len(t) > 400 or len(t.split()) > 70:
        return False
    if URL.search(t) or BAD.search(t):
        return False
    return True


def clean_dialog(turns):
    turns = [norm_text(t) for t in turns]
    if not all(ok_turn(t) for t in turns):
        return None
    return turns if len(turns) >= 2 else None


def load_dailydialog():
    for f in glob.glob(os.path.join(RAW, "dailydialog", "*.parquet")):
        for utts in pq.read_table(f, columns=["utterances"]).column("utterances").to_pylist():
            d = clean_dialog([detok(norm_text(u)) for u in utts])
            if d: yield "dailydialog", d


def load_empathetic():
    for f in glob.glob(os.path.join(RAW, "empathetic", "*.parquet")):
        rows = pq.read_table(f, columns=["conv_id", "utterance_idx", "utterance"]).to_pylist()
        convs = collections.defaultdict(list)
        for r in rows:
            convs[r["conv_id"]].append((r["utterance_idx"], r["utterance"]))
        for utts in convs.values():
            d = clean_dialog([u for _, u in sorted(utts)])
            if d: yield "empathetic", d


def load_personachat():
    for f in glob.glob(os.path.join(RAW, "personachat", "*.parquet")):
        last = {}
        for r in pq.read_table(f, columns=["conv_id", "utterance_idx", "history", "candidates"]).to_pylist():
            if r["conv_id"] not in last or r["utterance_idx"] > last[r["conv_id"]][0]:
                last[r["conv_id"]] = (r["utterance_idx"], r["history"] + [r["candidates"][-1]])
        for _, utts in last.values():
            d = clean_dialog(utts)
            if d: yield "personachat", d


def load_bst():
    for f in glob.glob(os.path.join(RAW, "bst", "*.parquet")):
        for r in pq.read_table(f, columns=["previous_utterance", "free_messages", "guided_messages"]).to_pylist():
            utts = list(r["previous_utterance"])
            for a, b in zip(r["free_messages"], r["guided_messages"]):
                utts += [a, b]
            d = clean_dialog(utts)
            if d: yield "bst", d


def role_ok(label, names):
    low = label.lower().strip()
    if low in FRIENDLY_ROLES:
        return True
    if low in SKIP_ROLES or " " in low:
        return False
    return label in names or (label[:1].isupper() and label.isalpha())


def load_soda():
    for f in sorted(glob.glob(os.path.join(RAW, "soda", "*.parquet"))):
        cols = ["dialogue", "speakers", "PersonX", "PersonY", "PersonZ"]
        for r in pq.read_table(f, columns=cols).to_pylist():
            spk = r["speakers"]
            uniq = list(dict.fromkeys(spk))
            if len(uniq) != 2 or len(spk) != len(r["dialogue"]):
                continue
            names = {r["PersonX"], r["PersonY"], r["PersonZ"]} - {""}
            if not all(role_ok(s, names) for s in uniq):
                continue
            pats = {s: re.compile(r"\b" + re.escape(s) + r"\b") for s in uniq}
            turns = []
            for who, utt in zip(spk, r["dialogue"]):
                other = uniq[1] if who == uniq[0] else uniq[0]
                utt = pats[who].sub(ME, utt)
                utt = pats[other].sub(YOU, utt)
                turns.append(utt)
            d = clean_dialog(turns)
            if d: yield "soda", d


def main():
    random.seed(1)
    counts = collections.Counter()
    seen = set()
    with open(OUT, "w") as out:
        for loader in (load_dailydialog, load_empathetic, load_personachat, load_bst, load_soda):
            for src, turns in loader():
                key = hash(" ".join(turns[:3]).lower())
                if key in seen:
                    continue
                seen.add(key)
                counts[src] += 1
                counts[src + "_words"] += sum(len(t.split()) for t in turns)
                out.write(json.dumps({"src": src, "turns": turns}) + "\n")
            print(loader.__name__, dict(counts), flush=True)
    print("done", dict(counts))


if __name__ == "__main__":
    main()
