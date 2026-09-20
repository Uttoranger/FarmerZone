# FarmerZone — Arbeitsanweisung für KI-Agenten

Regionale Bauern-Verkaufsplattform. Next.js 16 / React 19 / Prisma 7 / PostgreSQL.
Solo-Entwickler, ein Pilothof. **Produktivsystem mit echten Bestellungen und echtem Geld.**

---

## 1. Befehle

| Zweck | Befehl |
|---|---|
| Dev-Server | `pnpm dev` |
| Alle Tests | `pnpm test` |
| **Ein Test** | `pnpm vitest run tests/<name>.test.ts` |
| Test-Watch | `pnpm test:watch` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Build (lokal) | `pnpm build` |
| Migration erstellen | `pnpm db:migrate` |
| Seed | `pnpm db:seed` |
| Prisma Studio | `pnpm db:studio` |

- Paketmanager ist **pnpm 10.33.0**. Nie `npm` oder `yarn` benutzen.
- `db:*`-Skripte laden `.env.local` über `dotenv-cli`. Ohne diesen Vorsatz läuft Prisma gegen die falsche DB.

**Vor jedem Commit verpflichtend:** `pnpm typecheck && pnpm lint && pnpm test`.
Kein Commit mit rotem Typecheck oder roten Tests. Keine Ausnahme, auch nicht "nur ein Formatfehler".

---

## 2. Hard Constraints — niemals verletzen

### Geld und Bestellungen
- **Niemals** Bestandsabzug mit blindem `decrement`. Immer `updateMany` mit `stock >= Menge` als Bedingung, sonst läuft der Bestand ins Minus.
- **Niemals** eine gültige Bestellung wegen eines fehlgeschlagenen Nachlaufs (Mail, Sentry, Analytics) zurückrollen.
- **Niemals** eine Reservierung ohne Fristprüfung durchwinken. Frist gilt beim **Lesen**, nicht durch den Cron.
- **Niemals** Geldbeträge in `number` rechnen, wo `Decimal` gespeichert ist → `docs/ai/CODING_STANDARDS.md`.

### Sicherheit
- **Das Repository ist öffentlich.** Keine echten Namen, Adressen, Telefonnummern, E-Mails oder Keys in Code, Seed, Kommentaren, Tests oder Commit-Messages.
- **Niemals** `.env`, `.env.local` oder Dateien mit echten Werten committen.
- **Niemals** einen Workflow mit `pull_request_target` anlegen. Nur `pull_request`.
- **Niemals** Secrets, Tokens oder E-Mail-Adressen loggen oder an Sentry senden → `src/lib/sentry-hygiene.ts`.
- **Niemals** eine Ressource allein über eine ratbare ID absichern. Öffentliche Links brauchen ein signiertes Token.

### Datenbank
- **Niemals** `prisma db push` gegen Produktion. Nur Migrationen (`pnpm db:migrate`).
- **Niemals** eine Schema-Änderung ohne Rückfrage ausführen. Migration zeigen, auf Freigabe warten.
- **Niemals** destruktive Migrationen (Spalte löschen, Typ ändern) ohne ausdrückliche Zustimmung.

### Prozess
- **Niemals** direkt auf `main` committen. Immer Feature-Branch + PR.
- **Niemals** mehr als eine Aufgabe in einen Branch mischen.
- **Niemals** unaufgefordert Pakete installieren. Vorschlagen und fragen.
- **Niemals** Features bauen, die nicht beauftragt sind. Im Zweifel fragen.

---

## 3. Detaildateien

Vor Codeänderungen lesen — nicht raten:

| Datei | Wann lesen |
|---|---|
| `docs/ai/TECH_STACK.md` | Immer bei neuen Abhängigkeiten, Bibliotheks-APIs, Versionsfragen |
| `docs/ai/ARCHITECTURE.md` | Bei neuen Dateien, Routen, Server Actions, API-Routen, State |
| `docs/ai/CODING_STANDARDS.md` | Bei **jeder** Codeänderung |
| `docs/ai/TESTING_GUIDELINES.md` | Bei jedem Test, bei jeder Änderung an getestetem Code |
| `DEVELOPMENT.md` | Für Historie und Domänenwissen (siehe unten) |

### Abgrenzung `docs/ai/` vs. `DEVELOPMENT.md`

Strikt trennen, sonst driften beide auseinander:

- **`docs/ai/*`** = **Regeln.** Wie gebaut wird. Gegenwartsform, Imperativ. Gilt für neuen Code.
- **`DEVELOPMENT.md`** = **Tagebuch und Domänenwissen.** Was wann passiert ist, warum eine Entscheidung fiel, wie eine Fachregel funktioniert (z. B. Reservierungssemantik, Servicegebühr).
- Nie dieselbe Regel in beide Dateien schreiben. Regel → `docs/ai/`. Begründung und Verlauf → `DEVELOPMENT.md`.

---

## 4. Arbeitsabläufe

Diese Abläufe stehen als Befehle bereit. Lies sie nicht aus dem Gedächtnis — ruf sie auf:

| Anlass | Befehl |
|---|---|
| Beauftragte Änderung, Sprint, neues Feature | `/sprint <auftrag>` |
| Fehler beheben, Bugreport, Sentry-Issue | `/fix <beschreibung>` |
| Vor jedem Commit und vor jedem PR | `/pruefen` |

Sie liegen unter `.claude/skills/` und enthalten die verbindliche Reihenfolge:
Kontext aus `docs/ai/` laden → Branch → `TASK.md` bei mehr als zwei Dateien →
umsetzen → selbst prüfen → Doku nachziehen → Bericht → STOPP.

### Was immer gilt, auch ohne Befehl

**Vor der ersten Codezeile** die passenden Dateien aus Abschnitt 3 lesen.
Widerspricht der Auftrag einer Regel: stoppen und fragen, nicht stillschweigend entscheiden.

**Jede Aufgabe endet mit einem Bericht:**
1. Was geändert wurde — ein Satz je Datei
2. Was **nicht** gelöst wurde und warum
3. Welche Annahme getroffen wurde, falls etwas unklar war
4. Wie der Mensch es testet: konkrete URL, konkrete Schritte, konkrete Erwartung
5. Welche `.md` mit angepasst wurde

**Wartungspflicht Dokumentation, im selben Arbeitsgang, unaufgefordert:**
neues Muster oder geänderte Konvention → `docs/ai/`; neue Abhängigkeit →
`TECH_STACK.md`; abgeschlossener Sprint oder Fachregel → `DEVELOPMENT.md`.
Eine Regel hier widerlegt? **Nicht heimlich abweichen** — melden.

### Zwei Hooks setzen durch, was nicht verhandelbar ist

- **Gefährliche Befehle werden blockiert** (`prisma db push`, Force-Push,
  `.env` committen, Push auf `main`, `npm install`).
- **Ein Zug endet nicht bei rotem Typecheck oder roten Tests.**

Das ist Absicht. Nicht umgehen, sondern beheben. Konfiguration: `.claude/settings.json`.

## 5. Sprache

- **Nutzertexte, Fehlermeldungen, E-Mails:** Deutsch, geduzt, ohne Fachbegriffe. Zielgruppe ist ein Landwirt, keine Entwicklerin. "Wir konnten die Bestellung nicht speichern" statt "Transaction rollback".
- **Code-Kommentare:** Deutsch. Erklären **warum**, nicht was.
- **Commit-Messages:** Deutsch, Präfix `feat:` / `fix:` / `docs:` / `chore:` / `refactor:`.
