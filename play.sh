#!/usr/bin/env bash
# PAPERLIGHT launcher: starts a tiny local web server and opens the game in your browser.
# Works from a terminal or by double-clicking (it reopens itself in a terminal window if needed).
# If anything fails, it falls back to opening game/index.html directly (the game also runs that way).

DIR="$(cd "$(dirname "$0")" && pwd)"
GAME="$DIR/game"

# Double-clicked from a file manager? Reopen inside a terminal so the server can be stopped with Ctrl+C.
if [ ! -t 1 ] && [ -z "$PAPERLIGHT_IN_TERM" ]; then
  for term in x-terminal-emulator gnome-terminal konsole xfce4-terminal mate-terminal tilix alacritty kitty xterm; do
    if command -v "$term" >/dev/null 2>&1; then
      case "$term" in
        gnome-terminal) PAPERLIGHT_IN_TERM=1 exec "$term" -- "$0" ;;
        *) PAPERLIGHT_IN_TERM=1 exec "$term" -e "$0" ;;
      esac
    fi
  done
fi

open_url() {
  local url="$1"
  if [ "$(uname)" = "Darwin" ]; then open "$url" && return 0; fi
  for opener in xdg-open gio sensible-browser x-www-browser firefox chromium google-chrome vivaldi-stable; do
    if command -v "$opener" >/dev/null 2>&1; then
      if [ "$opener" = "gio" ]; then gio open "$url" && return 0
      else "$opener" "$url" >/dev/null 2>&1 & disown; return 0; fi
    fi
  done
  return 1
}

pause_if_needed() { if [ -n "$PAPERLIGHT_IN_TERM" ]; then echo; read -r -p "Press Enter to close this window..." _; fi; }

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found, so opening the game file directly instead."
  open_url "$GAME/index.html" || echo "Please open this file in your browser: $GAME/index.html"
  pause_if_needed; exit 0
fi

# pick a free port (8765, or the next free one)
PORT="${PORT:-8642}"
while python3 -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1',$PORT)) == 0 else 1)"; do
  PORT=$((PORT + 1))
done
URL="http://127.0.0.1:$PORT/index.html"

[ -d "$GAME" ] || { echo "Can't find the game folder: $GAME"; pause_if_needed; exit 1; }
python3 "$DIR/tools/serve.py" "$PORT" >/dev/null 2>"$DIR/.server.log" &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT TERM

# wait until the server answers (max ~5 s)
for _ in $(seq 1 50); do
  if python3 -c "import urllib.request; urllib.request.urlopen('$URL', timeout=0.5)" 2>/dev/null; then READY=1; break; fi
  if ! kill -0 "$SERVER" 2>/dev/null; then break; fi
  sleep 0.1
done

if [ -z "$READY" ]; then
  echo "The local server didn't start:"; cat "$DIR/.server.log"
  echo "Opening the game file directly instead (music loops may have a tiny gap)."
  open_url "$GAME/index.html" || echo "Please open this file in your browser: $GAME/index.html"
  pause_if_needed; exit 1
fi

echo "PAPERLIGHT is running at: $URL"
if open_url "$URL"; then
  echo "(If no browser window appeared, open the address above yourself.)"
else
  echo "Couldn't find a browser to open automatically. Open the address above in your browser."
fi
echo "Keep this window open while you play. Press Ctrl+C to stop."
wait "$SERVER"
