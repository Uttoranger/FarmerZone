#!/usr/bin/env bash
# Board-Bilder wie Lauf 31: jedes `figure` des Board-HTML einzeln, mit
# Fenster = ganze Board-Fläche (abnahme-lauf31.md „So gemessen“).
#
#   board-bilder.sh <port> <board.html> <ziel-ordner> <390|1440> <hell|dunkel>
#
# Schreibt <ziel-ordner>/<n>-<breite>-<thema>-board.png je Figur.
set -euo pipefail
PORT="$1"; BOARD="$(realpath "$2")"; ZIEL="$(realpath -m "$3")"; BREITE="$4"; THEMA="$5"
AB=(agent-browser --cdp "$PORT")
mkdir -p "$ZIEL"
"${AB[@]}" set media light > /dev/null
"${AB[@]}" set viewport 1600 1000 > /dev/null
"${AB[@]}" open "file://$BOARD" > /dev/null
"${AB[@]}" wait 1500 > /dev/null
GROESSE="$("${AB[@]}" eval '(() => { document.querySelectorAll("figure").forEach((f, i) => f.setAttribute("data-fig", String(i + 1))); const d = document.documentElement; return [Math.ceil(d.scrollWidth), Math.ceil(d.scrollHeight), document.querySelectorAll("figure").length].join(" ") })()' | tr -d '"')"
read -r W H N <<< "$GROESSE"
"${AB[@]}" set viewport "$W" "$H" > /dev/null
"${AB[@]}" wait 800 > /dev/null
for i in $(seq 1 "$N"); do
  "${AB[@]}" screenshot "[data-fig=\"$i\"]" "$ZIEL/$i-$BREITE-$THEMA-board.png" > /dev/null
done
echo "$N Figuren aus $(basename "$BOARD")"
