# TESTING_GUIDELINES

Stand 2026-09-22: 77 Testdateien, ~1.100 Tests, alle in `tests/`.

---

## 1. Setup

- Runner: **Vitest 4**, Konfiguration in `vitest.config.ts`.
- Umgebung: **`node`** — kein jsdom, kein happy-dom.
- Muster: `tests/**/*.test.ts` — flach, keine Unterordner, `.test.ts` (nicht `.spec.ts`).
- Alias `@/` → `src/`.
- `BETTER_AUTH_SECRET` wird von der Config gesetzt; Token-Tests brauchen nichts weiter.

```bash
pnpm test                                 # alles
pnpm vitest run tests/reservierung.test.ts   # eine Datei
pnpm vitest run -t "verfallene Position"     # ein Testname
pnpm test:watch                           # Entwicklung
```

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
- **Nie** die Zeit implizit lassen: `jetzt` als Parameter übergeben oder `vi.useFakeTimers()`. Kein Test darf von der Systemuhr abhängen.
- **Nie** eine Berechtigungsprüfung wegmocken, um "an die eigentliche Logik zu kommen". Genau die Prüfung ist die Logik.

### Regel
Reine Funktionen (`src/lib/<fachregel>.ts`) werden **ohne jeden Mock** getestet. Braucht ein Test Mocks, um eine Fachregel zu prüfen, sitzt die Regel an der falschen Stelle → in `src/lib/` ziehen.

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

---

## 5. Testdaten

- **Keine echten personenbezogenen Daten.** Das Repo ist öffentlich.
- Namen: `Hof Test`, `Max Mustermann`. E-Mails: `@example.com` oder `@example.org`.
- Telefon: `+43 660 0000000`.
- Keine echten Stripe-IDs, keine echten Tokens — auch keine abgelaufenen.
- Faktoren für Testobjekte lokal in der Testdatei halten, keine geteilte Fixture-Datei ohne Not.

---

## 6. Pflicht bei Codeänderungen

- Neue Fachregel → Test im selben Commit. Kein "Tests kommen später".
- Bugfix → zuerst der Test, der den Bug reproduziert, dann der Fix.
- Geänderte Fachregel → bestehende Tests anpassen, **nicht löschen**. Wer einen Test löscht, begründet das im Bericht.
- Roter Test wird **nie** mit `.skip` stillgelegt. Entweder reparieren oder melden.
- `pnpm test` muss vor jedem Commit grün sein.

### Bekannte Umgebungsfallen
- `prisma generate` braucht Netzzugriff auf `binaries.prisma.sh`. Ist er blockiert, scheitern vier Testdateien mit `Cannot find module '.prisma/client/default'`. Das ist **kein** Codefehler — vor der Fehlersuche `pnpm db:generate` prüfen.
- `tests/email-sendraw.test.ts` und `tests/password-reset-email.test.ts` flackern gelegentlich im Gesamtlauf: Ihr erster Fall importiert `@/lib/email` kalt (`vi.resetModules()`), und unter Parallellast läuft das ins 5-Sekunden-Limit. Allein laufen sie grün. Vor einem Fix des eigenen Codes die beiden Dateien einzeln starten.
