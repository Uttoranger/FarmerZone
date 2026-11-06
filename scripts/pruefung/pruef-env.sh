#!/usr/bin/env bash
# Die feste Umgebung jedes Prüf-Befehls (freigabe.md §36, „Prüf-Umgebung“).
#
#   pruef-env.sh neu   [--datei <pfad>]
#       Legt die Datei (Vorgabe .nachtlauf/pruef-env, chmod 600) neu an:
#       BETTER_AUTH_SECRET und LINK_SECRET je Lauf neu aus `openssl rand -hex 32`,
#       Stripe nur als Platzhalter, die Basis der Prüf-DB aus PGUSER/PGPASSWORD
#       (Host fest localhost:5432). Prüft vorher, dass der Worktree keine
#       .env-Datei hat.
#   pruef-env.sh liste --db <name> --port <port> [--datei <pfad>]
#       Gibt die Liste für `env -i` aus, eine Zuweisung je Zeile:
#         mapfile -t L < <(scripts/pruefung/pruef-env.sh liste --db fz_p243_a --port 3101)
#         env -i "${L[@]}" pnpm exec next start …
#
# Weggelassen, mit Absicht: RESEND_API_KEY, RESEND_WEBHOOK_SECRET,
# NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, jede VERCEL*-Variable, jeder echte
# Stripe-Schlüssel. Ohne RESEND_API_KEY schreibt `next dev` Codes ins Terminal
# statt sie zu senden; mit `env -i` kommt nichts aus der Sitzung mit.
# Die Werte stehen nur in der Datei, nie im Zeitbuch, nie in einem Bericht.
set -euo pipefail

WT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATEI="$WT/.nachtlauf/pruef-env"
BEFEHL="${1:-}"
shift || true
DB=""
PORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --datei) DATEI="$2"; shift 2 ;;
    --db) DB="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    *) echo "pruef-env.sh: unbekannte Angabe $1" >&2; exit 1 ;;
  esac
done

case "$BEFEHL" in
  neu)
    "$WT/node_modules/.bin/tsx" "$WT/scripts/pruefung/sperre-cli.ts" --ordner "$WT"
    : "${PGPASSWORD:?PGPASSWORD fehlt (Passwort der lokalen Prüf-DB)}"
    mkdir -p "$(dirname "$DATEI")"
    umask 077
    {
      echo "PATH=$PATH"
      echo "HOME=$HOME"
      echo "NODE_OPTIONS=--max-old-space-size=4096"
      echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
      echo "LINK_SECRET=$(openssl rand -hex 32)"
      echo "STRIPE_SECRET_KEY=sk_test_pruefung"
      echo "STRIPE_WEBHOOK_SECRET=whsec_pruefung"
      echo "PRUEF_PG_BASIS=postgresql://${PGUSER:-postgres}:${PGPASSWORD}@localhost:5432"
    } > "$DATEI"
    chmod 600 "$DATEI"
    echo "Prüf-Umgebung neu angelegt (localhost:5432)."
    ;;
  liste)
    [ -f "$DATEI" ] || { echo "pruef-env.sh: erst 'neu' aufrufen" >&2; exit 1; }
    [[ "$DB" =~ ^[a-z0-9_]+$ ]] || { echo "pruef-env.sh: --db <name> (nur a-z, 0-9, _)" >&2; exit 1; }
    [[ "$PORT" =~ ^[0-9]+$ ]] || { echo "pruef-env.sh: --port <zahl>" >&2; exit 1; }
    BASIS=""
    while IFS= read -r zeile; do
      case "$zeile" in
        PRUEF_PG_BASIS=*) BASIS="${zeile#PRUEF_PG_BASIS=}" ;;
        PATH=*|HOME=*|NODE_OPTIONS=*|BETTER_AUTH_SECRET=*|LINK_SECRET=*|STRIPE_SECRET_KEY=*|STRIPE_WEBHOOK_SECRET=*) echo "$zeile" ;;
      esac
    done < "$DATEI"
    echo "DATABASE_URL=$BASIS/$DB"
    echo "DIRECT_URL=$BASIS/$DB"
    echo "BETTER_AUTH_URL=http://localhost:$PORT"
    echo "NEXT_PUBLIC_APP_URL=http://localhost:$PORT"
    ;;
  *)
    echo "Aufruf: pruef-env.sh neu | liste --db <name> --port <port>" >&2
    exit 1
    ;;
esac
