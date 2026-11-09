#!/usr/bin/env bash
# Der Prüf-Browser (Nr. 262; docs/nachtlauf.md „Prüfwerkzeug“ Punkt 4): ein
# Chromium aus /opt/pw-browsers mit festen Flags, eigenem Profil-Ordner unter
# .nachtlauf/ und DevTools nur auf 127.0.0.1. agent-browser dockt mit
# `--session <name> --cdp <port>` an; je Fotograf ein eigener Browser.
#
#   pruef-browser.sh start <name> <port>   startet im Hintergrund (Ausgabe und PID unter .nachtlauf/browser/<name>/)
#   pruef-browser.sh stopp <name>          beendet ihn und löscht den Profil-Ordner
#   pruef-browser.sh flags <name> <port>   gibt Programm und Flags aus, eine Angabe je Zeile (für Tests)
#
# Feste Flags: --remote-debugging-address=127.0.0.1, --host-resolver-rules
# „MAP localhost 127.0.0.1“ (Cookies und rpId auf localhost), --no-proxy-server,
# --hide-scrollbars --enable-features=OverlayScrollbar (die App setzt
# scrollbar-gutter: stable; ohne überlagernde Leiste rechnet die Seite mit 375
# statt 390 px), --lang=de-AT (Datums- und Zahlformat wie bei den Höfen).
# Dazu, ohne die kein Start im Container geht: --headless=new, der Port, der
# Profil-Ordner und als root --no-sandbox. Keine weitere Angabe, keine Umgebung lenkt das um.
set -euo pipefail

WT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BEFEHL="${1:-}"
NAME="${2:-}"
[[ "$NAME" =~ ^[a-z0-9-]+$ ]] || { echo "Aufruf: pruef-browser.sh start|stopp|flags <name> [<port>] (Name nur a-z, 0-9, -)" >&2; exit 1; }
ORDNER="$WT/.nachtlauf/browser/$NAME"

chromium() {
  local treffer
  treffer="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | sort | tail -n 1 || true)"
  [ -n "$treffer" ] || { echo "pruef-browser.sh: kein Chromium unter /opt/pw-browsers" >&2; exit 1; }
  echo "$treffer"
}

flags() {
  local port="$1"
  printf '%s\n' \
    "--headless=new" \
    "--remote-debugging-address=127.0.0.1" \
    "--remote-debugging-port=$port" \
    "--host-resolver-rules=MAP localhost 127.0.0.1" \
    "--no-proxy-server" \
    "--hide-scrollbars" \
    "--enable-features=OverlayScrollbar" \
    "--lang=de-AT" \
    "--user-data-dir=$ORDNER/profil"
  # Als root (Container) startet Chromium nur ohne Sandbox; sonst bleibt sie an.
  if [ "$(id -u)" = 0 ]; then echo "--no-sandbox"; fi
}

case "$BEFEHL" in
  flags|start)
    PORT="${3:-}"
    [[ "$PORT" =~ ^[0-9]+$ ]] || { echo "pruef-browser.sh: Port fehlt" >&2; exit 1; }
    if [ "$BEFEHL" = flags ]; then
      chromium
      flags "$PORT"
      exit 0
    fi
    PROGRAMM="$(chromium)"
    mapfile -t F < <(flags "$PORT")
    mkdir -p "$ORDNER"
    nohup "$PROGRAMM" "${F[@]}" about:blank > "$ORDNER/browser.log" 2>&1 &
    echo $! > "$ORDNER/browser.pid"
    echo "Prüf-Browser $NAME: DevTools auf 127.0.0.1:$PORT (agent-browser --session $NAME --cdp $PORT)"
    ;;
  stopp)
    if [ -f "$ORDNER/browser.pid" ]; then
      PID="$(cat "$ORDNER/browser.pid")"
      kill "$PID" 2>/dev/null || true
      # Erst löschen, wenn Chromium weg ist — sonst schreibt er noch ins Profil.
      for _ in $(seq 1 50); do kill -0 "$PID" 2>/dev/null || break; sleep 0.1; done
    fi
    rm -rf "$ORDNER"
    echo "Prüf-Browser $NAME beendet."
    ;;
  *)
    echo "Aufruf: pruef-browser.sh start|stopp|flags <name> [<port>]" >&2
    exit 1
    ;;
esac
