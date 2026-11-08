#!/usr/bin/env bash
# Startet einen Prüf-Server für Bilder (freigabe.md §36, „Stabilität“ und
# „Prüf-Umgebung und Admin-Abnahme“). Immer unter `env -i` mit der Liste aus
# pruef-env.sh, immer auf 127.0.0.1, immer gegen eine eigene DB-Kopie.
#
#   fotograf.sh start <n> <port> <db>
#       Nutzt den Bau dieses Worktrees (.next): legt .nachtlauf/fotograf/<n>/
#       mit einer Kopie von .next (cp -a) und Verweisen auf node_modules, public,
#       package.json, next.config.ts, tsconfig.json, src/ und prisma/ an und
#       startet `next start` darin.
#   fotograf.sh dev <db> [<commit>]
#       Der Admin- und Mail-Code-Fotograf: eigener git-Worktree unter
#       $HOME/nachtlauf-dev (fester, laufneutraler Pfad fürs Aufräumen, Nr. 262),
#       `next dev` auf Port 3000 (Herkunft http://localhost:3000, rpId localhost).
#   fotograf.sh stopp <n|dev>
#       Beendet den Server und räumt seinen Ordner weg: den dev-Worktree mit
#       `git worktree remove --force`, einen start-Ordner (kein git-Worktree)
#       mit seiner .next-Kopie und dem Serverprotokoll.
#   fotograf.sh db-aus <kopie> | db-an <kopie>
#       Sperrt bzw. öffnet NUR eine DB-Kopie eines Fotografen (Präfix kopie_,
#       nie die Prüf-Haupt-DB, nur localhost, Sperre zuerst; db-schalter.ts) —
#       so entstehen Ladefehler und „Speichern fehlgeschlagen“.
#
# Vor dem Start: Sperre (sperre-cli.ts --db) mit genau der Umgebung des
# Servers; Abbruch bei .env-Dateien im Worktree oder Fotograf-Ordner. Im
# Modus dev läuft die Sperre vor der Worktree-Anlage, Install und Generate
# laufen unter `env -i`, die .env-Prüfung des dev-Worktrees danach.
# Ausgabe des Servers nur unter .nachtlauf/ (gitignored, beim Aufräumen weg).
set -euo pipefail

WT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TSX="$WT/node_modules/.bin/tsx"
DEV_WT="$HOME/nachtlauf-dev"
MODUS="${1:-}"

sperre() {
  # $1 = DB, $2 = Port, Rest = Ordner ohne .env-Dateien
  local db="$1" port="$2"
  shift 2
  local ordner_args=()
  for o in "$@"; do ordner_args+=(--ordner "$o"); done
  mapfile -t L < <("$WT/scripts/pruefung/pruef-env.sh" liste --db "$db" --port "$port")
  env -i "${L[@]}" "$TSX" "$WT/scripts/pruefung/sperre-cli.ts" --db "${ordner_args[@]}"
}

case "$MODUS" in
  start)
    N="${2:?Nummer fehlt}"; PORT="${3:?Port fehlt}"; DB="${4:?DB fehlt}"
    [[ "$N" =~ ^[0-9a-z-]+$ ]] || { echo "fotograf.sh: Nummer nur a-z, 0-9, -" >&2; exit 1; }
    [ -d "$WT/.next" ] || { echo "fotograf.sh: erst bauen (.next fehlt)" >&2; exit 1; }
    ORDNER="$WT/.nachtlauf/fotograf/$N"
    rm -rf "$ORDNER"
    mkdir -p "$ORDNER"
    cp -a "$WT/.next" "$ORDNER/.next"
    for teil in node_modules public package.json next.config.ts tsconfig.json src prisma; do
      ln -s "$WT/$teil" "$ORDNER/$teil"
    done
    sperre "$DB" "$PORT" "$WT" "$ORDNER"
    mapfile -t L < <("$WT/scripts/pruefung/pruef-env.sh" liste --db "$DB" --port "$PORT")
    cd "$WT"
    nohup env -i "${L[@]}" "$WT/node_modules/.bin/next" start "$ORDNER" -H 127.0.0.1 -p "$PORT" > "$ORDNER/server.log" 2>&1 &
    echo $! > "$ORDNER/server.pid"
    echo "Fotograf $N: http://localhost:$PORT (DB localhost:5432/$DB)"
    ;;
  dev)
    DB="${2:?DB fehlt}"; COMMIT="${3:-HEAD}"
    # 1. Sperre zuerst (Adressen, Loopback, dieser Worktree) — vor Worktree,
    #    Install und Generate.
    sperre "$DB" 3000 "$WT"
    mapfile -t L < <("$WT/scripts/pruefung/pruef-env.sh" liste --db "$DB" --port 3000)
    if [ ! -d "$DEV_WT" ]; then
      git -C "$WT" worktree add --detach "$DEV_WT" "$COMMIT" > /dev/null
      # 2. Install und Generate nur unter env -i: prisma generate liest
      #    prisma.config.ts und damit DATABASE_URL — aus der Sitzung käme eine
      #    Adresse, die die Sperre nie gesehen hat.
      ( cd "$DEV_WT" && env -i "${L[@]}" pnpm install --frozen-lockfile --offline > /dev/null 2>&1 ) || {
        echo "fotograf.sh: Installation offline gescheitert – einmal mit Netz" >&2
        ( cd "$DEV_WT" && env -i "${L[@]}" pnpm install --frozen-lockfile > /dev/null )
      }
      git -C "$DEV_WT" diff --quiet -- pnpm-lock.yaml || { echo "fotograf.sh: pnpm-lock.yaml verändert" >&2; exit 1; }
      ( cd "$DEV_WT" && env -i "${L[@]}" pnpm exec prisma generate > /dev/null )
    fi
    # 3. Erst jetzt gibt es den dev-Worktree: keine .env-Datei darin.
    env -i "${L[@]}" "$TSX" "$WT/scripts/pruefung/sperre-cli.ts" --ordner "$DEV_WT"
    mkdir -p "$WT/.nachtlauf/fotograf/dev"
    cd "$DEV_WT"
    nohup env -i "${L[@]}" "$DEV_WT/node_modules/.bin/next" dev -H 127.0.0.1 -p 3000 > "$WT/.nachtlauf/fotograf/dev/server.log" 2>&1 &
    echo $! > "$WT/.nachtlauf/fotograf/dev/server.pid"
    echo "dev-Fotograf: http://localhost:3000 (DB localhost:5432/$DB)"
    ;;
  stopp)
    N="${2:?Nummer oder dev fehlt}"
    PID_DATEI="$WT/.nachtlauf/fotograf/$N/server.pid"
    if [ -f "$PID_DATEI" ]; then
      PID="$(cat "$PID_DATEI")"
      pkill -TERM -P "$PID" 2>/dev/null || true
      kill "$PID" 2>/dev/null || true
      rm -f "$PID_DATEI"
    fi
    if [ "$N" = dev ]; then
      if git -C "$WT" worktree list --porcelain | grep -qx "worktree $DEV_WT"; then
        git -C "$WT" worktree remove --force "$DEV_WT"
      fi
      rm -rf "$WT/.nachtlauf/fotograf/dev"
    else
      [[ "$N" =~ ^[0-9a-z-]+$ ]] || { echo "fotograf.sh: Nummer nur a-z, 0-9, -" >&2; exit 1; }
      rm -rf "$WT/.nachtlauf/fotograf/$N"
    fi
    echo "Fotograf $N beendet und weggeräumt."
    ;;
  db-aus|db-an)
    KOPIE="${2:?Kopie fehlt}"
    [ $# -eq 2 ] || { echo "fotograf.sh: $MODUS <kopie> — sonst nichts" >&2; exit 1; }
    # Die Liste für genau diese Kopie; db-schalter.ts prüft Name, Adressen und Server.
    mapfile -t L < <("$WT/scripts/pruefung/pruef-env.sh" liste --db "$KOPIE" --port 3000)
    env -i "${L[@]}" "$TSX" "$WT/scripts/pruefung/db-schalter.ts" "${MODUS#db-}" "$KOPIE"
    ;;
  *)
    echo "Aufruf: fotograf.sh start <n> <port> <db> | dev <db> [<commit>] | stopp <n|dev> | db-aus <kopie> | db-an <kopie>" >&2
    exit 1
    ;;
esac
