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

## Schritte
- [ ] 1. ...
- [ ] 2. ...

## Offene Fragen
- ...
```

Nach jedem Schritt abhaken. Am Ende löschen.
Bei offenen Fragen, die den Bau blockieren: **erst fragen, dann bauen.**

### 4. Umsetzen

Ein Schritt nach dem anderen. Nach jedem Schritt die betroffenen Tests laufen lassen
(`pnpm vitest run tests/<datei>.test.ts`), nicht erst am Ende alles.

Neue Fachregel → Test im selben Schritt, nicht später.

### 5. Selbst prüfen

Rufe `/pruefen` auf. Behebe, was dort auffällt, bevor du weitermachst.

### 6. Abschließen

`pnpm typecheck && pnpm lint && pnpm test` müssen grün sein.
(Der Stop-Hook lässt dich sonst ohnehin nicht fertig werden.)

Dann committen, pushen, PR öffnen. Commit-Message deutsch mit Präfix.

### 7. Dokumentation nachziehen — im selben Arbeitsgang

- neues Muster oder geänderte Konvention → passende Datei in `docs/ai/`
- neue Abhängigkeit → `TECH_STACK.md`
- abgeschlossener Sprint, Fachregel, Entscheidung → `DEVELOPMENT.md`

Nicht "später". Jetzt.

### 8. Bericht und STOPP

Dann anhalten und berichten:

1. Was geändert wurde — ein Satz je Datei
2. Was **nicht** gelöst wurde und warum
3. Welche Annahme du getroffen hast, falls etwas unklar war
4. Wie der Mensch es testet: konkrete URL, konkrete Schritte, konkrete Erwartung
5. Welche `.md` du mit angepasst hast

Danach warte auf Antwort. Beginne keine neue Aufgabe von selbst.
