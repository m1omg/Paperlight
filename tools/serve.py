#!/usr/bin/env python3
"""PAPERLIGHT local server: serves game/ and stores saves as files in saves/ (port-independent, survives
browser data clearing). Endpoints:
  GET  /api/save/<slot>   -> the save JSON (falls back to the backup if the main file is damaged), 404 if none
  PUT  /api/save/<slot>   -> write a save (atomic write; the previous save is kept as <slot>.prev.json)
Usage: python3 tools/serve.py [port]
"""
import json, os, re, sys, tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / "game"
SAVES = ROOT / "saves"
MAX_BYTES = 2_000_000
SLOT_RE = re.compile(r"^/api/save/([0-9]{1,2})$")


def read_json(p):
    try:
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
        return d if isinstance(d, dict) else None
    except (OSError, ValueError):
        return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(GAME), **k)

    def log_message(self, *a):  # keep the terminal quiet
        pass

    def end_headers(self):
        # always serve fresh files so an updated game is picked up on reload
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        m = SLOT_RE.match(self.path.split("?")[0])
        if not m:
            return super().do_GET()
        slot = m.group(1)
        for name in (f"slot{slot}.json", f"slot{slot}.prev.json"):
            d = read_json(SAVES / name)
            if d is not None:
                return self._json(200, d)
        return self._json(404, {"error": "no save"})

    def do_PUT(self):
        m = SLOT_RE.match(self.path.split("?")[0])
        if not m:
            return self._json(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._json(413, {"error": "bad size"})
        raw = self.rfile.read(n)
        try:
            d = json.loads(raw)
            assert isinstance(d, dict) and "actors" in d and "map" in d
        except Exception:
            return self._json(400, {"error": "invalid save"})
        SAVES.mkdir(exist_ok=True)
        main, prev = SAVES / f"slot{m.group(1)}.json", SAVES / f"slot{m.group(1)}.prev.json"
        if read_json(main) is not None:
            os.replace(main, prev)  # keep the last good save as a backup
        fd, tmp = tempfile.mkstemp(dir=SAVES, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(d, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, main)
        return self._json(200, {"ok": True})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8642
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
