"""Download the public dialogue datasets used to train Pip's neural parts.

Only datasets are downloaded (no pretrained models). Files land in training/data/raw/
(ignored by git). Needs: pip install requests pyarrow
"""
import os, sys, requests

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "raw")
HF = "https://huggingface.co/datasets/{repo}/resolve/refs%2Fconvert%2Fparquet/{path}"

# name -> (hub repo, [parquet paths inside the auto-converted parquet branch])
SOURCES = {
    "soda": ("allenai/soda", ["default/train/0000.parquet", "default/train/0001.parquet",
                              "default/train/0002.parquet", "default/validation/0000.parquet"]),
    "dailydialog": ("roskoN/dailydialog", ["full/train/0000.parquet", "full/validation/0000.parquet"]),
    "empathetic": ("facebook/empathetic_dialogues", ["default/train/0000.parquet", "default/validation/0000.parquet"]),
    "personachat": ("bavard/personachat_truecased", ["full/train/0000.parquet", "full/validation/0000.parquet"]),
    "bst": ("ParlAI/blended_skill_talk", ["default/train/0000.parquet", "default/validation/0000.parquet"]),
}

def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        print("  have", dest); return
    tmp = dest + ".part"
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    os.replace(tmp, dest)
    print("  got ", dest, os.path.getsize(dest) // 1024, "KB")

def main(names):
    for name in names or SOURCES:
        repo, paths = SOURCES[name]
        print(name)
        os.makedirs(os.path.join(RAW, name), exist_ok=True)
        for p in paths:
            fetch(HF.format(repo=repo, path=p), os.path.join(RAW, name, p.replace("/", "_")))

if __name__ == "__main__":
    main(sys.argv[1:])
