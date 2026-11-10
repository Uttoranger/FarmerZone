#!/usr/bin/env bash
# Ein App-Bild mit Messung (freigabe.md §36; „So gemessen“ wie Lauf 31) über
# agent-browser an der Prüf-Instanz (DevTools-Port, nur 127.0.0.1).
#
#   seiten-bild.sh --session <name> <port> <url> <ziel ohne Endung> <390|1440> <hell|dunkel>
#
# --session ist Pflicht (Nr. 262): je Fotograf eine eigene agent-browser-Sitzung,
# sonst teilen sich zwei Fotografen Tab und Cookies. Ohne Namen Abbruch mit Exit 1.
#
# Schreibt <ziel>.png (ganze Seite), <ziel>.messung.json (messung.js) und
# <ziel>.axe.json (agent-browser a11y, axe-core). Nur Adressen auf localhost.
set -euo pipefail
WT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ "${1:-}" != "--session" ] || ! [[ "${2:-}" =~ ^[a-z0-9-]+$ ]]; then
  echo "$(basename "$0"): --session <name> fehlt (Name nur a-z, 0-9, -); je Fotograf eine eigene Sitzung" >&2
  exit 1
fi
SITZUNG="$2"
shift 2
PORT="$1"; URL="$2"; BREITE="$4"; THEMA="$5"
# Absolut: agent-browser liest „.nachtlauf/…“ als CSS-Klasse, nicht als Pfad.
ZIEL="$(realpath -m "$3")"
[[ "$URL" =~ ^http://(localhost|127\.0\.0\.1):[0-9]+/ ]] || { echo "seiten-bild.sh: nur localhost" >&2; exit 1; }
case "$BREITE" in 390) HOEHE=844 ;; 1440) HOEHE=900 ;; *) echo "Breite 390 oder 1440" >&2; exit 1 ;; esac
case "$THEMA" in hell) MEDIA=light ;; dunkel) MEDIA=dark ;; *) echo "Thema hell oder dunkel" >&2; exit 1 ;; esac
AB=(agent-browser --session "$SITZUNG" --cdp "$PORT")
mkdir -p "$(dirname "$ZIEL")"
"${AB[@]}" set viewport "$BREITE" "$HOEHE" > /dev/null
"${AB[@]}" set media "$MEDIA" > /dev/null
"${AB[@]}" open "$URL" > /dev/null
"${AB[@]}" wait 2500 > /dev/null
"${AB[@]}" screenshot --full "$ZIEL.png" > /dev/null
"${AB[@]}" eval "$(cat "$WT/scripts/pruefung/messung.js")" > "$ZIEL.messung.json"
"${AB[@]}" a11y --json > "$ZIEL.axe.json" 2>/dev/null || echo '{"fehler":"a11y nicht gelaufen"}' > "$ZIEL.axe.json"
echo "$ZIEL.png"
