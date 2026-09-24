"""Export the word-frequency list used by Pip's spell checker: ../data/words.js
(the 30k most common words of the dialogue corpus, most frequent first)."""
import collections, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
cnt = collections.Counter()
for i, line in enumerate(open(os.path.join(HERE, "data", "dialogs.jsonl"))):
    if i % 3:  # a third of the corpus is plenty for frequencies
        continue
    for t in json.loads(line)["turns"]:
        cnt.update(re.findall(r"[a-z]+", t.lower().replace("<|me|>", "").replace("<|you|>", "")))
words = [w for w, c in cnt.most_common(30000) if c >= 5 and (len(w) > 1 or w in "ai")]
with open(os.path.join(HERE, "..", "data", "words.js"), "w") as f:
    f.write("/* word list (most frequent first) from the training dialogues; used for spelling correction */\n")
    f.write("(typeof window !== 'undefined' ? window : global).Pip.data = (typeof window !== 'undefined' ? window : global).Pip.data || {};\n")
    f.write("(typeof window !== 'undefined' ? window : global).Pip.data.words = " + json.dumps(" ".join(words)) + ";\n")
print(len(words), "words;", os.path.getsize(os.path.join(HERE, "..", "data", "words.js")) // 1024, "KB")
