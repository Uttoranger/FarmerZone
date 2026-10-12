---
description: Standard-Arbeitsablauf für eine beauftragte Änderung an FarmerZone — Kontext laden, Branch, TASK.md, umsetzen, selbst prüfen, PR, Bericht. Nutze das bei jeder Aufgabe, die mehr als eine Datei betrifft, und immer wenn der Mensch "Sprint", "baue", "implementiere" oder "setze um" sagt.
---

# Sprint

Auftrag des Menschen: $ARGUMENTS

## Lage

Branch: !`git rev-parse --abbrev-ref HEAD`
Offene Änderungen: !`git status --porcelain | head -20`

## Ablauf

Arbeite diese Schritte der Reihe nach ab. Überspringe keinen.

### 1. Kontext laden — vor der ersten Codezeile

Lies jetzt, nicht aus dem Gedächtnis:

- `docs/ai/CODING_STANDARDS.md` — immer
- `docs/ai/ARCHITECTURE.md` — wenn neue Dateien, Routen, Actions oder State betroffen sind
- `docs/ai/TECH_STACK.md` — wenn eine Bibliothek oder eine Version im Spiel ist
- `docs/ai/TESTING_GUIDELINES.md` — wenn Tests entstehen oder sich ändern
- bestehenden Code im betroffenen Bereich, um sein Muster zu übernehmen
- `docs/ai/BAUSTEINE.md` — das Bausteinverzeichnis (erzeugt, nicht am Stück lesen): nach dem Stichwort der Aufgabe durchsuchen (`grep -i`), bevor eine neue Datei, Komponente oder Funktion entsteht. Was dort steht, wird benutzt oder additiv erweitert; bei „Altbestand → Ersatz" gilt der Ersatz.

Widerspricht der Auftrag einer Regel: **stopp, frag nach.** Nicht stillschweigend entscheiden.

### 2. Branch

Bist du auf `main`, lege von dort einen Branch an: `feature/<kurz>` oder `fix/<kurz>`.
Bist du schon auf einem Feature-Branch und gehört die Aufgabe dazu, bleib dort.
Gehört sie nicht dazu: sag es und frag.

### 3. Plan

Betrifft die Aufgabe mehr als zwei Dateien, lege `TASK.md` im Root an:

```markdown
# <Aufgabe>
Ziel: <ein Satz>
Branch: <name>

## Betroffen
- src/... — was

## Wiederverwendet / Neu, weil
- Wiederverwendet: <Treffer aus BAUSTEINE.md> — wofür
- Neu, weil: <neue Datei oder Funktion> — warum kein Treffer passt

## Schritte
- [ ] 1. ...
- [ ] 2. ...

## Offene Fragen
- ...
```

Nach jedem Schritt abhaken. Am Ende löschen — der Abschnitt „Wiederverwendet / Neu, weil" kommt vorher als eine Zeile „Wiederverwendet: … / Neu, weil: …" in den PR-Text (auch bei höchstens zwei Dateien, wo es keine `TASK.md` gibt).
Bei offenen Fragen, die den Bau blockieren: **erst fragen, dann bauen.**

### 4. Umsetzen

Ein Schritt nach dem anderen. Nach jedem Schritt den Subagenten `tester` mit den
betroffenen Testdateien aufrufen, nicht erst am Ende alles.

Neue Fachregel → Test im selben Schritt, nicht später.

### 5. Selbst prüfen

Rufe den Subagenten `pruefer` auf. Behebe, was dort auffällt, bevor du weitermachst.

### 6. Abschließen

`pnpm typecheck && pnpm lint && pnpm test` müssen grün sein.
(Der Stop-Hook lässt dich sonst ohnehin nicht fertig werden.)

Dann committen, pushen, PR öffnen. Commit-Message deutsch mit Präfix.

Behebt die Änderung eine Meldung aus dem Briefkasten: direkt nach dem Öffnen des PR
`pnpm briefkasten geplant <id> --pr <nr>` (die Nummer gibt es erst mit dem PR), im PR-Body je
Meldung die Zeile `Behebt Meldung: <id>`. Nur Art FEHLER. ERLEDIGT setzt das Deployment, nie ein Agent.
Einzige Ausnahme: Hat der Mensch einen Wunsch selbst im Admin auf „Geplant" gesetzt und den Bau
beauftragt, gehört auch dessen Zeile `Behebt Meldung: <id>` in den PR — `geplant` setzt dann niemand.

### 7. Dokumentation nachziehen — im selben Arbeitsgang

- neues Muster oder geänderte Konvention → passende Datei in `docs/ai/`
- neue Abhängigkeit → `TECH_STACK.md`
- abgeschlossener Sprint, Fachregel, Entscheidung → `DEVELOPMENT.md`
- Datei, Komponente oder Export unter `src/components`, `src/lib` oder `src/server` hinzugefügt, umbenannt oder entfernt, oder ein Kopfkommentar geändert → `pnpm bausteine` ausführen und `docs/ai/BAUSTEINE.md` mitcommitten (sonst schlägt `tests/bausteine-verzeichnis.test.ts` an)

Nicht "später". Jetzt.

### 8. Bericht und STOPP

Dann anhalten und berichten:

1. Was geändert wurde — ein Satz je Datei
2. Was **nicht** gelöst wurde und warum
3. Welche Annahme du getroffen hast, falls etwas unklar war
4. Wie der Mensch es testet: konkrete URL, konkrete Schritte, konkrete Erwartung
5. Welche `.md` du mit angepasst hast
6. Regelvorschlag, nur wenn dir eine Regel fehlte, dich behinderte oder ein Fehler wiederkommen kann: Ursache, Gegenmaßnahme, Ort. Vorrang hat eine Prüfung (Test, Lint, Hook) vor einer Textregel; eine Textregel gehört an den passenden Ort. Eingetragen wird erst nach Freigabe durch den Menschen, mit Herkunft und Datum.

Danach warte auf Antwort. Beginne keine neue Aufgabe von selbst.
