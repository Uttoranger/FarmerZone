#!/usr/bin/env bash
# ignoreCommand in vercel.json (Register G7): Vercel baut keine Vorschau für einen
# Commit, dessen Betreff mit "WIP:" beginnt. Zwischenstände sichern den Stand,
# brauchen aber weder eine Vorschau noch eine Migration in der Entwicklungsdatenbank.
#
# Ausgang für Vercel: 0 = Build überspringen, 1 = bauen.
# Im Zweifel wird gebaut: Ein Fehler hier darf nie eine Auslieferung verhindern.
set -u

# Die Produktion baut immer. Ein leeres VERCEL_ENV (lokal, unbekannte Umgebung)
# zählt wie Produktion.
umgebung="${VERCEL_ENV:-}"
if [ -z "$umgebung" ] || [ "$umgebung" = "production" ]; then
  echo "vercel-ignore: Umgebung '${umgebung:-leer}', es wird gebaut."
  exit 1
fi

# Betreff = erste Zeile der Commit-Nachricht. Vercel setzt die Variable; fehlt
# sie, fragt das Skript git. Fehlt auch das, gibt es keinen Betreff: bauen.
nachricht="${VERCEL_GIT_COMMIT_MESSAGE:-}"
if [ -z "$nachricht" ]; then
  nachricht="$(git log -1 --pretty=%s 2>/dev/null)" || nachricht=""
fi
betreff="${nachricht%%$'\n'*}"

if [ -z "$betreff" ]; then
  echo "vercel-ignore: kein Betreff gefunden, es wird gebaut."
  exit 1
fi

case "$betreff" in
  "WIP:"*)
    echo "vercel-ignore: Zwischenstand (WIP), keine Vorschau."
    exit 0
    ;;
esac

echo "vercel-ignore: kein WIP-Commit, es wird gebaut."
exit 1
