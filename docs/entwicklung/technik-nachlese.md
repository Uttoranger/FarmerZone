# Technik-Nachlese (2026-09-29)

Branch `chore/technik-nachlese`. Drei kleine Baustellen aus der Review-Nachlese.

## 1. Sentry-Quelltextkarten

Fehler kamen in Sentry mit gepresstem Code an (`05xmbivsovo4b.js:2:64187`).
Zwei Ursachen:

- `next.config.ts` verließ sich darauf, dass das Sentry-Build-Werkzeug
  `SENTRY_ORG` und `SENTRY_PROJECT` selbst liest. Die Variablen gab es in Vercel
  nie. Organisation und Projekt stehen jetzt fest in der Konfiguration, geheim
  bleibt nur `SENTRY_AUTH_TOKEN`.
- `@sentry/cli` durfte sein Einrichtungs-Skript nicht ausführen, im Build fehlte
  also das Programm, das hochlädt. `pnpm ignored-builds` meldete es.

Geprüft in der installierten Version statt aus dem Gedächtnis:

- Optionsnamen: `org`, `project`, `authToken`, `sourcemaps.deleteSourcemapsAfterUpload`
  (`@sentry/nextjs` 10.66, `build/types/config/types.d.ts`).
- EU-Region: Das Build-Werkzeug gibt sentry-cli immer `https://sentry.io` mit.
  sentry-cli nimmt bei einem Organisations-Token (`sntrys_…`) trotzdem die im
  Token eingebettete Adresse und warnt nur (`src/config.rs` in sentry-cli
  2.58). Eine `SENTRY_URL` braucht es nicht.
- Löschen nach dem Upload: Unter Turbopack schaltet `withSentryConfig`
  `productionBrowserSourceMaps` ein und setzt das Löschen als Standard. Es steht
  trotzdem ausdrücklich in der Konfiguration. Gelöscht wird auch ohne Token.

### pnpm: eine Liste statt zwei

`allowBuilds` und `onlyBuiltDependencies` standen nebeneinander und waren
auseinandergelaufen: `@prisma/client` stand nur in der einen Liste, esbuild,
msw und `@prisma/engines` nur in der anderen. pnpm 10.33 las `allowBuilds`.
Jetzt gibt es nur noch `allowBuilds`, mit allen Einträgen aus beiden Listen und
dazu `@sentry/cli`. Beweis: `pnpm install --frozen-lockfile` läuft durch,
`pnpm-lock.yaml` bleibt unverändert, und `pnpm ignored-builds` meldet „None“.

## 2. Server-Kleinkram

- `/api/reserve`: Die Menge ist auf höchstens 10.000 begrenzt. Darüber kommt 400
  mit „Bitte eine Menge bis 10.000.“
- `zuProduktDto()` (`src/lib/produkt-dto.ts`) ersetzt die vier Abbildungen
  `price: Number(p.price)` / `unitSize: … Number(p.unitSize)` in
  `src/server/queries/products.ts` und `farm.ts`. Die Ausgabe bleibt gleich. Liest
  eine Abfrage keine Gebindegröße (die Angebotszeilen), fügt die Funktion auch
  keine hinzu.
- `/api/checkout`: Vor jeder 409-Antwort schaut `konflikt()` noch einmal nach, ob
  zu diesem Idempotenz-Schlüssel inzwischen eine Bestellung steht. Wenn ja, gibt
  es 200 mit genau dieser Bestellung. Schritt 0, der Index-Konflikt in Schritt 9
  und `konflikt()` nutzen dieselbe Funktion `antwortFuerBestehendeBestellung()`.
  Anlass: Kommen zwei Anfragen gleichzeitig, kann die zweite erst eintreffen,
  nachdem die erste die Halte der Sitzung gelöscht hat. Bisher bekam sie dann
  „Reservierung abgelaufen“, obwohl ihre Bestellung schon angelegt war. Der
  Integrationstest verlangt jetzt: beide 200, eine Bestellung.
- Onboarding: Preis und Bestand sind jetzt `DezimalFeld`, der Preis-Platzhalter
  ist „3,50“. Der Bestand muss eine ganze Zahl sein, sonst erscheint ein Hinweis
  am Feld. Ein Bestand von 0 bleibt jetzt 0; bisher wurde daraus still 50.

## 3. Branches auf origin

Gelöscht wurden 27 Branches. Bei allen stand der letzte Commit-Titel in `main`
(mit oder ohne angehängtes „(#n)“ vom Squash-Merge), dazu kamen ohne Prüfung
`feature/preis-semantik` und `chore/testdaten-braunau`.

Stehen geblieben:

| Branch | Grund |
|---|---|
| `main` | Hauptzweig |
| `claude/foto-upload-fixes-6hly2v` | Präfix `claude/` |
| `claude/hof-stilllegen-miiihi` | Präfix `claude/` |
| `feature/sichtbarkeits-schalter` | Titel nicht in `main` |
| `fix/produktformular-feinschliff` | Titel nicht in `main` |
| `nachlese-4` | letzter Commit ist ein Merge, Titel nicht in `main` |
| `nachlese-5` | Titel nicht in `main` |
| `sprint-20-fix` | Titel nicht in `main` |

Keiner der geschützten Namen (`feature/kunden-navigation-handy`,
`feature/bauern-nachschliff`, `feature/verkauf-auswertung`) lag zum Zeitpunkt
der Prüfung auf origin. Keiner hatte einen Commit aus den letzten 48 Stunden.
