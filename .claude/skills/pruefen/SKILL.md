---
description: Den eigenen uncommitteten Stand gegen die FarmerZone-Regeln prüfen, bevor committet oder ein PR geöffnet wird. Nutze das nach jeder Codeänderung und immer, wenn der Mensch "prüf das", "review" oder "passt das so" sagt.
---

# Prüfen

## Der Stand

Geänderte Dateien: !`git status --porcelain`

Diff: !`git diff HEAD --stat`

## Auftrag

Lies `docs/ai/CODING_STANDARDS.md` und prüfe den **tatsächlichen Diff** dagegen —
Datei für Datei, nicht aus der Erinnerung an das, was du schreiben wolltest.

Gehe diese Liste durch und beantworte jeden Punkt mit Fundstelle oder "sauber":

### Typisierung
- [ ] `any`, `as any`, `@ts-ignore` oder unbegründetes `!` im Diff?
- [ ] Exportierte Funktionen mit explizitem Rückgabetyp?
- [ ] Typen aus Zod abgeleitet statt doppelt geschrieben?

### Systemgrenzen
- [ ] Jede neue API-Route, Server Action, jeder Webhook und URL-Parameter mit Zod validiert?
- [ ] `localStorage`-Inhalte beim Lesen validiert?

### Berechtigung
- [ ] Jede schreibende Server Action prüft Session **und** Besitz?
- [ ] Besitz in der `WHERE`-Klausel, nicht in einem vorgelagerten `if`?
- [ ] Neue öffentliche Abfrage: archivierte, pausierte, nicht freigegebene Höfe ausgeschlossen?

### Geld und Bestand
- [ ] Beträge über `order-totals.ts` / `servicegebuehr.ts` gerechnet, nicht als `number`?
- [ ] Anzeige über `format.ts` — kein eigenes Preisformat, kein `toFixed(2) + ' €'`?
- [ ] Bestandsabzug bedingt (`updateMany` mit `stock >= Menge`), nie blind `decrement`?

### Fehler und Antwortzeit
- [ ] Fehlerbehandlung vorhanden, kein leeres `catch {}`?
- [ ] Fehlermeldungen deutsch, geduzt, ohne Fachjargon, mit Ausweg?
- [ ] Keine internen Details nach außen (Stacktrace, SQL, Prisma-Text)?
- [ ] Nichts Langsames im Antwortpfad — Mailversand über `nachDerAntwort()`?

### Next und React
- [ ] `revalidatePath` für jede betroffene Route?
- [ ] `Decimal` und `Date` nicht roh an Client-Komponenten?
- [ ] `'use client'` so tief wie möglich, nicht auf einem Layout?

### Öffentliches Repo
- [ ] Keine echten Namen, Adressen, Telefonnummern, E-Mails oder Keys im Diff — auch nicht in Tests, Seed oder Kommentaren?

### Tests
- [ ] Neue Fachregel hat einen Test?
- [ ] Kein Test gelöscht oder mit `.skip` stillgelegt?
- [ ] Keine Fachregel gemockt, deren Ergebnis die Aussage des Tests ist?

### Dokumentation
- [ ] Neues Muster oder geänderte Konvention → `docs/ai/` angepasst?
- [ ] Neue Abhängigkeit → `TECH_STACK.md`?
- [ ] Widerspricht der Code einer bestehenden Regel? Dann **melden**, nicht heimlich abweichen.

## Ausgabe

Kurze Liste der Verstöße mit Datei und Zeile. Keine Prosa, keine Lobrede.
Ist alles sauber: ein Satz.

Behebe danach, was du selbst verursacht hast. Altlasten, die schon vorher da
waren, meldest du nur — ohne zu fragen räumst du sie nicht auf.
