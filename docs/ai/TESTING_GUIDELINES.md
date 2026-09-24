# TESTING_GUIDELINES

Stand 2026-09-24: 93 Testdateien / ~1.515 Tests in `tests/` (Unit),
5 Dateien / 15 Tests in `tests/integration/` (Integration).

---

## 1. Setup

- Runner: **Vitest 4**. Zwei Konfigurationen: `vitest.config.ts` (Unit),
  `vitest.integration.config.ts` (Integration).
- Umgebung: **`node`** — kein jsdom, kein happy-dom.
- Alias `@/` → `src/`.
- `BETTER_AUTH_SECRET` wird von der Config gesetzt; Token-Tests brauchen nichts weiter.

### Ordner: einer je Schicht, innerhalb flach

| Ordner | Schicht | Suffix |
|---|---|---|
| `tests/` | Unit | `.test.ts` |
| `tests/integration/` | Integration | `.int.test.ts` |
| `e2e/` | E2E (noch nicht vorhanden) | außerhalb von `tests/` |

Keine weiteren Unterordner, kein `.spec.ts`. Innerhalb eines Ordners bleibt es
flach; `tests/integration/setup/` enthält nur Hilfsmittel, keine Tests.

**Der `exclude` in `vitest.config.ts` ist Pflicht, keine Geschmacksfrage:**
`tests/**/*.test.ts` passt auch auf `tests/integration/*.int.test.ts`. Ohne
`exclude: ['**/node_modules/**', 'tests/integration/**']` zöge `pnpm test` — und
damit der Stop-Hook — die Integrationstests mit hinein und scheiterte ohne
laufendes Postgres. `exclude` **ersetzt** die Vorgabe von Vitest, deshalb muss
`**/node_modules/**` mit drin stehen bleiben.

### Was in welcher Schicht echt ist

| | Unit (`tests/`) | Integration (`tests/integration/`) |
|---|---|---|
| Postgres | gemockt (`vi.mock('@/lib/prisma')`) | **echt** — lokale Datenbank, Zustand nach dem Aufruf ist die Aussage |
| Better Auth | gemockt | **echt** — Anmeldung mit Passwort, Sitzung aus der Datenbank |
| Rate-Limit | aus | aus (siehe unten) |
| Resend, Stripe, Nominatim, Vercel Blob | gemockt | gemockt |
| Zeit | Parameter oder `vi.useFakeTimers()` | **Systemuhr** — siehe unten |
| Laufzeit | Millisekunden | Sekunden |

**Zeit in der Integrationsschicht: die einzige Ausnahme von Abschnitt 4.** Über die
Handler-Grenze ist `jetzt` nicht injizierbar — der Handler setzt seinen Zeitpunkt
selbst (`const now = new Date()`), und ein Request trägt keinen Parameter dafür.
Die Integrationstests hängen deshalb an der Systemuhr. Damit das nie zu Flackern
führt, gilt dort: **Fristen großzügig setzen, nie auf die Millisekunde prüfen.**
Wer eine Frist auf die Sekunde prüfen will, tut das an der reinen Funktion in
`src/lib/reservierung.ts` — dort ist `jetzt` ein Parameter. Für die Unit-Schicht
bleibt Abschnitt 4 unverändert in Kraft.

**Rate-Limit in beiden Schichten aus, und zwar nicht aus Bequemlichkeit:**
`enforceRateLimit` kehrt bei `NODE_ENV !== 'production'` sofort zurück, bevor ein
Zähler angefasst wird (`src/lib/rate-limit.ts`). In Tests ist der Limiter damit
untätig — es gibt nichts zurückzusetzen. Wer die Grenze selbst prüfen will,
nimmt `createRateLimiter()` und bekommt eine frische Instanz; das ist ein
Unit-Test der reinen Funktion, kein Integrationstest.

```bash
pnpm test                                    # Unit, alles
pnpm vitest run tests/reservierung.test.ts   # eine Datei
pnpm vitest run -t "verfallene Position"     # ein Testname
pnpm test:watch                              # Entwicklung
pnpm test:integration                        # Integration (braucht .env.test)
```

### Die Integrationsschicht

- **Wofür:** Aussagen, die nur die Datenbank beantworten kann — bedingte
  Bestandsbuchung unter Nebenläufigkeit, eindeutige Indizes, Transaktionsgrenzen,
  Snapshot-Spalten. Geprüft wird der **Zustand danach**, nicht der Aufruf.
- **Nicht dafür:** Fachregeln. Die gehören in `src/lib/` und in die schnelle Suite.
- **Sicherheitssperre:** `TEST_DATABASE_URL` muss gesetzt sein und auf
  `localhost`, `127.0.0.1` oder `postgres` zeigen. Dev- und Produktionsdatenbank
  werden namentlich abgelehnt. Fehlt die Variable, wird **abgebrochen**, nicht
  übersprungen (`tests/integration/setup/sicherheitssperre.ts`, Allowlists in
  `src/lib/umgebung.ts`).
- **Datentrennung ohne Rollback-Trick:** Jeder Test legt eigene Objekte mit
  `int-`-Präfix an und räumt sie in `afterEach` weg (`raeumeAuf()`). Kein „alles
  in eine Transaktion und zurückrollen" — die Transaktionsgrenzen sind selbst
  Prüfgegenstand. Seed-Daten werden nur **gelesen**.
- **Eine Datei zur Zeit** (`fileParallelism: false`). Nebenläufigkeit wird
  innerhalb eines Tests hergestellt, nicht zwischen Dateien.
- **Nebenläufigkeitstests sichern den ZUSTAND zu, nicht den WEG.** Welchen
  Zweig zwei gleichzeitige Anfragen nehmen, entscheidet die Maschine. Eine
  Zusicherung auf „genau dieser Fehlercode aus genau diesem Schritt" ist
  zeitabhängig und flackert irgendwann — erst in der CI, auf fremder Hardware.
  Richtig ist: Die Antwort muss EINER der gültigen Ausgänge sein, und darunter
  steht der Zustand, der in **allen** Verschränkungen gelten muss (Bestand,
  Anzahl Bestellungen, Anzahl Mails). Das ist auch die Zusicherung, die das Geld
  schützt.
- **Nicht in `pnpm test`, nicht im Stop-Hook.** Eigener CI-Job `integration` mit
  einem `postgres:17`-Dienst.

### Folge der Node-Umgebung
- **Kein Rendering-Test möglich.** Keine Testing-Library, kein `render()`, kein Snapshot von JSX.
- **Kein E2E vorhanden.** Kein Playwright, kein Cypress.
- Wer Verhalten testen will, muss die Entscheidung **aus der Komponente herausziehen** — genau der Grund für die Schichtung in `ARCHITECTURE.md`.
- Testing-Library oder Playwright **nicht eigenmächtig einführen**. Vorschlagen und fragen.

---

## 2. Was getestet wird

| Pflicht | Beispiel |
|---|---|
| Jede Fachregel in `src/lib/` | `reservierung.test.ts`, `format.test.ts` |
| Jede Zod-Schema-Datei | `register-schema.test.ts` |
| Jeder Geldweg | `checkout-totals.test.ts`, `servicegebuehr-checkout.test.ts` |
| Jede Berechtigungsentscheidung | `farm-approval.test.ts`, `bestellverfolgung-zugang.test.ts` |
| Jeder Token-/Signaturweg | `geheimnis.test.ts` |
| Jeder behobene Bug | ein Test, der ihn vorher gefangen hätte |
| Jede Migration gegen das Deploy-Fenster | `migrationen-wache.test.ts` |
| Jeder Geldweg, bei dem die Datenbank die Antwort gibt, **zusätzlich** in der Integrationsschicht | `checkout-bestand.int.test.ts`, `storno-nebenlaeufig.int.test.ts` |

Die **Migrationswache** ist ein normaler Unit-Test der Suite (reine Dateiarbeit,
ohne Datenbank) — sie läuft bei `pnpm test` und damit im Stop-Hook. Sie schlägt
bei `ADD COLUMN … NOT NULL` ohne `DEFAULT` an; begründete Ausnahmen tragen einen
`-- EXPAND-CONTRACT:`-Marker (Regel: `ARCHITECTURE.md` §5).

### Nicht testen
- Prisma selbst, Next.js selbst, Stripe selbst.
- Reine Darstellung (Klassennamen, Reihenfolge von JSX).
- Trivialen Code ohne Verzweigung.
- Keine Tests, die nur Mocks prüfen ("wurde `create` aufgerufen") ohne Aussage über Verhalten.

---

## 3. Mocking

### Gemockt werden darf — Infrastruktur
```ts
vi.mock('@/lib/prisma')      // 27 Dateien
vi.mock('@/lib/auth')        // 15
vi.mock('@/lib/email')       // 14
vi.mock('@/lib/stripe')      // 8
vi.mock('next/headers')      // 15
vi.mock('next/cache')        // 13
vi.mock('@vercel/blob')      // 3
```
Alles, was Netz, DB oder Request-Kontext braucht.

### Niemals gemockt werden — die zu prüfende Aussage
- **Nie** das Modul mocken, das gerade getestet wird.
- **Nie** eine Fachregel aus `src/lib/` mocken, wenn ihr Ergebnis die Aussage des Tests ist.
- **Nie** Zod-Validierung mocken oder umgehen. Ungültige Eingabe muss echt durchs Schema.
- **Nie** Geldrechnung mocken. Beträge echt durchrechnen lassen.
- **Nie** die Zeit implizit lassen: `jetzt` als Parameter übergeben oder `vi.useFakeTimers()`. Kein Test darf von der Systemuhr abhängen. (Einzige Ausnahme: die Integrationsschicht, wo `jetzt` über die Handler-Grenze nicht injizierbar ist — Abschnitt 1 nennt die Bedingung dafür.)
- **Nie** eine Berechtigungsprüfung wegmocken, um "an die eigentliche Logik zu kommen". Genau die Prüfung ist die Logik.

### Regel
Reine Funktionen (`src/lib/<fachregel>.ts`) werden **ohne jeden Mock** getestet. Braucht ein Test Mocks, um eine Fachregel zu prüfen, sitzt die Regel an der falschen Stelle → in `src/lib/` ziehen.

### In der Integrationsschicht sind Mocks Prüfstellen
Postgres ist dort echt, Resend und Stripe nicht. Was gemockt ist, wird deshalb
**mitgeprüft** statt nur stillgelegt — das ist kein Widerspruch zu „keine Tests,
die nur Mocks prüfen" (Abschnitt 2), weil die Aussage über das Verhalten daneben
steht:

- Storno → `sendOrderCancelled` **genau einmal**, dazu Status und Bestand in der DB.
- Abgelehnter Checkout (Betriebsnachweis fehlt) → **keine** Mail, **kein**
  Stripe-Aufruf, dazu: keine Bestellung und unveränderter Bestand.

Der Nachlauf läuft außerhalb des Requests (`src/lib/nach-der-antwort.ts`), also
`await vi.waitFor(...)` statt sofort behaupten.

Zweite Sicherung neben den Mocks: `vitest.integration.config.ts` setzt
`STRIPE_SECRET_KEY` und `RESEND_API_KEY` **unbedingt** auf Platzhalter — auch
gegen `.env.test`. Vergisst ein künftiger Test sein `vi.mock`, läuft der Aufruf
in einen ungültigen Schlüssel statt in echtes Geld.

---

## 4. Aufbau

- Deutsche Testnamen, die das **Verhalten** beschreiben, nicht die Funktion.
  - ✅ `'lässt eine abgelaufene Position nicht durch den Checkout'`
  - ❌ `'pruefeWarenkorb works'`
- `describe` je Funktion oder Szenario, `it` je Verhalten.
- Arrange – Act – Assert, sichtbar getrennt.
- Ein Verhalten je Test. Keine Testdatei, die einen Ablauf über zehn `it` hinweg aufbaut.
- Keine gemeinsame veränderliche Variable zwischen Tests. `beforeEach` zum Zurücksetzen (`vi.clearAllMocks()`).
- Reihenfolge-Unabhängigkeit: Jeder Test muss allein laufen.

### Immer mitprüfen
- Grenzfälle: 0, leer, `null`, exakt an der Frist, ein Millisekunde davor und danach.
- Der Fehlerweg, nicht nur der Erfolgsweg.
- Nebenläufigkeit, wo Bestand oder Geld betroffen ist: zwei gleichzeitige Zugriffe.
  In der Integrationsschicht dabei den Zustand zusichern, nicht den Zweig
  (Abschnitt 1).

---

## 5. Testdaten

- **Keine echten personenbezogenen Daten.** Das Repo ist öffentlich.
- Namen: `Hof Test`, `Max Mustermann`. E-Mails: `@example.com` oder `@example.org`.
- Telefon: `+43 660 0000000`.
- Keine echten Stripe-IDs, keine echten Tokens — auch keine abgelaufenen.
- Faktoren für Testobjekte lokal in der Testdatei halten, keine geteilte Fixture-Datei ohne Not.
- **Integrationsschicht: alles trägt das Präfix `int-`** — Hof-Slug, Produkt-ID,
  Sitzungs-ID, E-Mail-Adresse. Das Präfix ist die Sicherung, an der `raeumeAuf()`
  hängt; wer daran vorbei anlegt, lässt Daten stehen. Faktoren dafür in
  `tests/integration/setup/basis.ts`, weil sie über Dateien hinweg gleich sein
  müssen.

---

## 6. Pflicht bei Codeänderungen

- Neue Fachregel → Test im selben Commit. Kein "Tests kommen später".
- Bugfix → zuerst der Test, der den Bug reproduziert, dann der Fix.
- Geänderte Fachregel → bestehende Tests anpassen, **nicht löschen**. Wer einen Test löscht, begründet das im Bericht.
- Roter Test wird **nie** mit `.skip` stillgelegt. Entweder reparieren oder melden.
- `pnpm test` muss vor jedem Commit grün sein.

### Bekannte Umgebungsfallen
- `prisma generate` braucht Netzzugriff auf `binaries.prisma.sh`. Ist er blockiert, scheitern vier Testdateien mit `Cannot find module '.prisma/client/default'`. Das ist **kein** Codefehler — vor der Fehlersuche `pnpm db:generate` prüfen.
- `pnpm test:integration` braucht ein laufendes Postgres **und** `.env.test`
  (Vorlage: `.env.test.example`). Fehlt die Datei, meldet dotenv-cli sie; fehlt
  `TEST_DATABASE_URL`, bricht die Sicherheitssperre mit Hinweis ab. Beides ist
  kein Codefehler.
- `tests/email-sendraw.test.ts` und `tests/password-reset-email.test.ts` flackern gelegentlich im Gesamtlauf: Ihr erster Fall importiert `@/lib/email` kalt (`vi.resetModules()`), und unter Parallellast läuft das ins 5-Sekunden-Limit. Allein laufen sie grün. Vor einem Fix des eigenen Codes die beiden Dateien einzeln starten.
