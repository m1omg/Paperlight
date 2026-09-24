#!/usr/bin/env python3
"""Generate raw art through Codex (GPT Image). Skips files that already exist.
Usage: python3 tools/gen_images.py [--only name1,name2] [--batch 3] [--jobs 5]
"""
import argparse, subprocess, sys, os, concurrent.futures as cf
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art_source" / "raw"
LOG = ROOT / "tools" / "logs"
sys.path.insert(0, str(ROOT / "tools"))
from assets import A

SIZES = {"square": "square 1:1", "wide": "landscape 3:2", "tall": "portrait 2:3"}

LIMIT = {"hit": False}

def run_batch(idx, names):
    if LIMIT["hit"]:
        return names, [], "skipped (usage limit)"
    lines = []
    for n in names:
        size, bg, prompt = A[n]
        lines.append(f"- File `art_source/raw/{n}.png`. Prompt:\n  \"\"\"{prompt} Image format: {SIZES[size]}.\"\"\"")
    task = ("You are an art-generation helper. For EACH item below, call your built-in image generation tool exactly "
            "once with the given prompt verbatim, then copy the resulting PNG (unmodified) to "
            "the given path relative to the current directory. Do not edit, resize or post-process images. Do not "
            "create any other files. Stay inside the current directory: do not read, list or search any other directories "
            "except the generated-images folder your tool writes to. When done, list the saved files.\n\n" + "\n".join(lines))
    LOG.mkdir(parents=True, exist_ok=True)
    with open(LOG / f"batch_{idx}_{names[0]}.log", "w") as f:
        p = subprocess.run(["codex", "exec", "--skip-git-repo-check", "-s", "workspace-write",
                            "-m", "gpt-5.6-luna", "-c", "model_reasoning_effort=\"low\"", task],
                           cwd=ROOT, stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    if "usage_limit_reached" in open(LOG / f"batch_{idx}_{names[0]}.log").read():
        LIMIT["hit"] = True
    # Codex sometimes copies the same generated file twice: drop any new file identical to another one
    import hashlib
    digests = {}
    for f in sorted(RAW.glob("*.png"), key=lambda p: p.stat().st_mtime):
        h = hashlib.md5(f.read_bytes()).hexdigest()
        if h in digests and f.stem in names:
            f.unlink()
        else:
            digests.setdefault(h, f.stem)
    ok = [n for n in names if (RAW / f"{n}.png").exists()]
    return names, ok, p.returncode

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--batch", type=int, default=3)
    ap.add_argument("--jobs", type=int, default=5)
    a = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    names = [n for n in (a.only.split(",") if a.only else A) if n and not (RAW / f"{n}.png").exists()]
    batches = [names[i:i + a.batch] for i in range(0, len(names), a.batch)]
    print(f"{len(names)} images in {len(batches)} batches", flush=True)
    with cf.ThreadPoolExecutor(a.jobs) as ex:
        futs = [ex.submit(run_batch, i, b) for i, b in enumerate(batches)]
        for fu in cf.as_completed(futs):
            names_, ok, rc = fu.result()
            print(f"rc={rc} done {ok} missing {[n for n in names_ if n not in ok]}", flush=True)
    missing = [n for n in A if not (RAW / f"{n}.png").exists()]
    print("STILL MISSING:", missing, flush=True)

if __name__ == "__main__":
    main()
