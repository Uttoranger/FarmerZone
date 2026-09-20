Du führst die wöchentliche Triage des Fehlerbriefkastens durch. Du arbeitest NUR LESEND: keine Datenbank-Schreibzugriffe, keine Commits, keine Dateien im Repository anlegen — Meldungen enthalten personenbezogene Daten und dürfen nie ins öffentliche Repo gelangen. Deine Ausgabe ist ausschließlich ein Bericht im Terminal.

SCHRITT 1 — LADEN
Führe `pnpm briefkasten export` aus. Bricht es mit „TRIAGE_DATABASE_URL fehlt" oder einem Verbindungsfehler ab: Melde das wörtlich und STOPP.

SCHRITT 2 — REGELN
Lies den Abschnitt „Triage" in DEVELOPMENT.md und wende ihn wörtlich an:
- Ein FEHLER ist eine Abweichung vom BEABSICHTIGTEN Verhalten. Referenz sind die Sprint-Prompts und PR-Berichte (git log, PR-Beschreibungen), nicht die Erwartung der meldenden Person.
- WÜNSCHE werden gebündelt und gezählt, nie zu Prompts.
- Ein einzelner, nicht reproduzierbarer Bericht ist ein Signal, kein Auftrag.
- Ein Prompt entsteht NUR, wenn der Fehler im Code nachvollziehbar ist ODER ein kritischer Pfad betroffen ist (Bezahlung, Bestellung, Upload).

SCHRITT 3 — JEDE MELDUNG PRÜFEN
Für jede Meldung mit Status NEU oder GEPRUEFT:
a) Einstufung: FEHLER_BESTAETIGT / KEIN_FEHLER / DUPLIKAT von <Kurznummer> / WUNSCH / FRAGE / UNKLAR.
b) Bei FEHLER-Meldungen: Suche die zuständige Stelle im Code (Datei:Zeile), prüfe, ob das gemeldete Verhalten dort tatsächlich entsteht, und ob es dem beabsichtigten Verhalten widerspricht. Nutze Kennung ([L71], [S71] …), Seite, Browser und Viewport aus dem Kontext.
c) Duplikate erkennst du am gleichen Sachverhalt, nicht am gleichen Wortlaut. Schlage einen clusterKey vor (kurz, kebab-case).
d) Formuliere je Meldung EINEN Satz als antwortAnMelder — freundlich, in der Du-Form, ohne Technik, ohne Versprechen einer Frist.

SCHRITT 4 — BERICHT (genau dieses Format)
1. Übersicht: Anzahl je Einstufung; die drei größten Cluster.
2. Tabelle je Meldung: Kurznummer | Art | Einstufung | clusterKey | Begründung (mit Datei:Zeile bei Fehlern) | antwortAnMelder.
3. Wunschliste: Cluster mit Anzahl der Höfe, absteigend — ohne Bewertung, ohne Empfehlung.
4. Für jeden bestätigten Fehler-Cluster: ein vollständiger Sprint-Prompt im Hausstil des Projekts (Arbeitsregeln, Phase 0 mit Datei:Zeile-Belegen, Umsetzung, BEWUSST NICHT, Tests, Mobil-Pflicht, Abschluss mit PR-ohne-Merge). Der Prompt darf NICHT ausgeführt werden — nur ausgegeben.
5. Vorschlags-SQL: für jede Meldung ein UPDATE auf "Meldung" mit status, clusterKey, triageNotiz, duplikatVonId, antwortAnMelder, triagedAt = now(). Ausdrücklich beschriftet: „NICHT AUSFÜHREN — Vorschlag für den Betreiber". Notizen sachlich, ohne personenbezogene Daten.

ABSCHLUSS
Beende mit dem Satz: „Triage abgeschlossen — nichts wurde geschrieben, nichts wurde gestartet. Entscheidung liegt beim Betreiber."