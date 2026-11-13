# Zwischen-Morgenbericht Lauf 34, Abschnitt C (13.11.2026) · Admin im Regelbetrieb

**Ergebnis Abschnitt C:** Alle fünf Nummern sind fertig, geprüft und gepusht: 303 (Admin-Texte: Eingriffe sagen ihre Folgen, keine Kürzel; mit Gruppe B), 304a (Bestellung über die Nummer immer auffindbar, Adresse der Kundin in der Meldung gekürzt), 306 (Hofseite lädt keinen Hof-Code mehr, −23 % Bytes), 304 (drei stille Ereignisse werden Aufgaben in Heute, Stichtag in „Kommt“ aus der Einstellung) und 308 (eigene Antwort im Postfach nach dem Senden ganz sichtbar). Alle liegen im Zwischenstand `integration/lauf34c`; der Sammel-PR [#544](https://github.com/Uttoranger/FarmerZone/pull/544) steht auf „bereit“. Keine Migration, kein Paket, keine neue Variable.

**Ordnungsgemäß beendet:** ja (Rahmen „Fertig, wenn“: jede Nummer fertig, voller Lauf und Integration ganz auf dem Sammelstand grün, Sammel-PR bereit, Aufräumen bestätigt, dieser Bericht). **Ziel erreicht:** ja, mit Einschränkungen: Zwei Teile sind nach ihren Toren nicht gebaut (303 A6 nach T2 – gewollt; 303 A7 zweiter Teil nach T5 ohne Startsatz → /fix), 304 Umsetzung 1 und 2 entfallen nach T3 (A012 protokolliert schon). Die CI liegt für 303, 306, 304 und 308 nur am Sammel-PR vor (Einzel-PRs mit Doku-Konflikt zur Basis, siehe „Stabilität“). Das gelungene Ersetzen des Titelbilds (306) ist lokal ohne Speicherdienst nicht prüfbar.

## Für dich zu tun

- [ ] **Merge:** Sammel-PR [#544](https://github.com/Uttoranger/FarmerZone/pull/544) `integration/lauf34c` → main nach Durchsicht per **Merge-Commit** (nicht Squash). Die Einzel-PRs [#545](https://github.com/Uttoranger/FarmerZone/pull/545) (304a), [#546](https://github.com/Uttoranger/FarmerZone/pull/546) (303), [#547](https://github.com/Uttoranger/FarmerZone/pull/547) (306), [#548](https://github.com/Uttoranger/FarmerZone/pull/548) (304) und [#549](https://github.com/Uttoranger/FarmerZone/pull/549) (308) führt GitHub nach dem Push des Zwischenstands als „merged“ (ihr Kopf steckt darin); sonst nach dem Merge schließen.
- [ ] **303 A7 zweiter Teil als /fix:** Ohne den Startsatz „Auskunft ohne IP von Recht bestätigt“ bleibt `auskunftKundin.satz` wie bisher (Tor T5). Nach der Bestätigung durch Recht den Wortlaut der Fassung für T5 (a013-lauf34-c.md, 303 A7) als eigenen /fix einbauen. **Frage an die Projektleitung (T5):** IP-Adressen der Sitzungen in die Auskunftsdatei aufnehmen oder im Admin zeigen? Beides wäre eine eigene Nummer mit Gegenlesen „Daten“ und „Recht“; danach passt Recht den Satz an. Offene Frage aus B dazu: Soll „unter Meldungen“ in die Aufzählung der Orte?
- [ ] **303, Frage aus dem Gegenlesen „Geld“:** Der Satz aus A5 („bar fällt keine an“) stimmt nur, solange der Stichtag „Hofpreis-Modell ab“ nicht nach dem 1.2.2027 (`BAR_SERVICEGEBUEHR_AB`) liegt. Keine Regel begrenzt den Stichtag; liegt er später, tragen Barbestellungen im bisherigen Modell ab dem 1.2.2027 die Servicegebühr, und die zieht niemand ein. Stichtag auf höchstens den 1.2.2027 begrenzen oder den Satz anpassen (eigene Nummer). Heute (Stichtag leer bzw. bis 1.2.2027) stimmt der Satz.
- [ ] **304:** Die Fristen der drei neuen Aufgaben (Lastschrift beendet 3 Tage, AGB offen 7 Tage, Konto-Frist um 7 Tage) sind ein Vorschlag der Technik – bestätigen oder ändern.
- [ ] **304, zur Kenntnis:** Umsetzung 1 und 2 (Protokoll je Wechsel des Stripe-Kontos) entfallen nach Tor T3: A012 schreibt den Eintrag schon in der zentralen Funktion (`online_zahlung_pausiert` bzw. `online_zahlung_aktiv`). Ein pausierter, aber seit 30 Tagen geschlossener Hof erscheint in „Konto seit 30 Tagen geschlossen“ (Auftrag 3d „Hof (kein Testhof)“; der Integrationstest im Auftrag sagte „pausierter Hof in keiner Quelle“ – Widerspruch im Auftrag, der Umsetzer folgt 3d).
- [ ] **306:** In der Vorschau einmal in Mein Hof das Titelbild ersetzen (lokal ohne Speicherdienst nicht prüfbar; vorher und nachher scheitert es lokal gleich). Vorschlag für den Auftrag „Abhängigkeiten“: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` aus package.json entfernen (unter src/ importiert sie niemand mehr).
- [ ] **308:** In der Vorschau am Handy im Postfach eines Hofs antworten – die eigene Antwort ist danach ganz zu sehen.
- [ ] **303 Gruppe B, zur Kenntnis:** Die Admin-Boards zeigen weiter den alten Wortlaut (Startsatz „Admin-Wortlaut nach F047 freigegeben“, Abweichung freigegeben; Zeilen in der Ergänzungsliste, Entsch. „C“ = Board wird korrigiert).
- [ ] **Nach dem Merge am echten Stand prüfen** (Daten- und Sicherheitsänderungen), in der Vorschau bzw. auf test.agrilo.at: Admin › Bestellungen eine alte Bestellnummer (älter als 90 Tage) bei Zeitraum „7 Tage“ suchen → erscheint (304a); Admin › Postfach, Meldung mit Kundenadresse → nur gekürzt (304a); Admin › Einstellungen „Stichtag speichern“ → Rückfrage, „Abbrechen“ ändert nichts (303); Admin › Heute „Kommt“ zeigt „Plattformgebühr im Preis beginnt“ am eingestellten Tag (304); Build-Log: Schritt „Kein Hof-Code im Paket der Hofseite“ grün (306, in der CI).
- [ ] **Abschnitt D starten**, in einer neuen Sitzung, mit dieser Nachricht (jede Zeile einzeln; die Startsätze von D nur, wenn du sie freigibst):

Nachtlauf 34 fortsetzen

Stripe-Probe Kleinbetrag bestanden

Auslöser Testumgebung freigegeben

## Nummern

| Nr | Inhalt | Status | PR | Vorschau | Migration | Weggelassen / offen |
|---|---|---|---|---|---|---|
| 304a | Bestellung über die Nummer immer auffindbar; Adresse der Kundin in der Meldung gekürzt (N32, N33) | fertig (0 Runden) | [#545](https://github.com/Uttoranger/FarmerZone/pull/545) | Vercel-Vorschau des Zweigs; CI des Sammel-PR grün (Einzel-PR: Wackler, siehe „Stabilität“) | nein | Nacharbeit: Detail-Test ohne `ohneZeitgrenze`; Zählung derselben Adresse im Detail weiter 90 Tage |
| 303 | Admin-Texte: Eingriffe sagen ihre Folgen, keine Kürzel, keine Technikwörter | fertig (0 Runden) | [#546](https://github.com/Uttoranger/FarmerZone/pull/546) | Vorschau des Zweigs; CI über #544 | nein | A6 nicht gebaut (T2, es gilt der Satz aus 290); A7 zweiter Teil nicht gebaut (T5, Startsatz fehlt) → /fix; Nacharbeit: B9/B13 ohne wörtlichen Test, dienste.ts:59 „Webhook“, admin-ansichten.test.ts:218 |
| 306 | Kundschaft lädt keinen Hof-Code: toter Bearbeitungsmodus weg, Titelbild-Knopf in eigene Datei | fertig (0 Runden) | [#547](https://github.com/Uttoranger/FarmerZone/pull/547) | Vorschau des Zweigs; CI über #544 | nein | Paket der Hofseite 22 → 20 Chunks, 832407 → 640932 Bytes roh (−23 %); Nacharbeit: Testanker `korbErlaubt`, Meldung bei fehlendem Chunk |
| 304 | Stille Ereignisse werden Aufgaben; Stichtag in „Kommt“ aus der Einstellung | fertig (0 Runden) | [#548](https://github.com/Uttoranger/FarmerZone/pull/548) | Vorschau des Zweigs; CI über #544 | nein | Umsetzung 1 und 2 nicht gebaut (T3); Nacharbeit: Reihenfolge der Abfragen ab 200 Höfen, Testfall „pausiert und geschlossen“ |
| 308 | Postfach: eigene Antwort nicht von der Leiste verdeckt | fertig (0 Runden) | [#549](https://github.com/Uttoranger/FarmerZone/pull/549) | Vorschau des Zweigs; CI über #544 | nein | T1 griff nicht (vorher 133 bis 221 px verdeckt, nachher 20 px darüber); Nacharbeit: doppelte Funktion zu `scrollVerhalten`, Prüfstand ohne `startTransition` |

Vorher rot (Namen und Ausgaben in den PR-Texten): 304a bestellung-auffindbar.int (2 Fälle, `expected [] to deeply equal [ id ]`), meldung-adresse-gekuerzt; 303 admin-texte (24 Fälle), hofpreis-rueckfrage (`Keine Rückfrage (BestellDialog) im Baum`, Gegenprobe 4 von 5 rot), admin-kuerzel-wache (6 Dateien); 306 paket-hofseite (`Cannot find module`), Rendertest Gegenprobe; 304 admin-aufgaben (15 Fälle, `ADMIN_AUFGABEN[f.quelle] is not a function`), konto-schliessen-satz (3 Fälle); 308 Messung im Prüf-Bau (133 bis 221 px unter dem Formular) und Prüfstand-Gegenprobe.

**Nicht gebaut – Startsatz fehlt:** 303 A7 zweiter Teil (Fassung für Tor T5) – Satz „Auskunft ohne IP von Recht bestätigt“; nach der Tabelle im Rahmen entfällt der Teil (nicht verschoben) und kommt als /fix (oben). **Nach Tor nicht gebaut:** 303 A6 (T2), 304 Umsetzung 1 und 2 (T3). **Verschoben:** keine Nummer. Rahmen §1 3.5 (eine Nummer aus D vorziehen) nicht genutzt: Platz 1 war ab Stunde 1,4 frei; der Sammel-PR C bleibt klein und kann vor dem Live-Schlüssel gemergt werden (wie in A und B begründet).

## Merge-Reihenfolge

Sammel-PR `integration/lauf34c` → main per **Merge-Commit** (nicht Squash). Der Zwischenstand liegt auf main 2a851653484d (nach #541), in dieser Reihenfolge per `--no-ff` gemergt: 304a (#545), 303 (#546), 306 (#547), 304 (#548), 308 (#549); dazu die Doku-Commits des Dirigenten. Konflikte nur in DEVELOPMENT.md (alle Abschnitte behalten); `pnpm bausteine` nach jedem Merge ohne Änderung. Abschnitt D legt danach `integration/lauf34d` von main an; ist #544 noch nicht gemergt, stapelt D auf `integration/lauf34c` (Rahmen §1 3.2).

## Geld

- Kein Betrag, keine Stripe-Anfrage, keine Geldberechnung geändert (303 nur Texte und eine Rückfrage vor der unveränderten Action; 304 nur Anzeige; 304a, 306, 308 ohne Geld).
- **303, Gegenlesen „Geld“:** kein Blocker. A1 (Abweichung = Datenbank − Stripe; offene Abweichung sperrt den Monatsabschluss), B1 (Stichtag schaltet Gebührenmodell, AGB-Fassung und Monatsabrechnung; nach Erreichen fest) und B2 (Satz je Hof als Snapshot; Erlass vor Einzug; Lastschrift-Pflicht; Sperre nach Frist) stimmen mit dem Code. A6 unverändert (Byte-Vergleich). Ein Sollte an die Projektleitung: A5 bei einem Stichtag nach dem 1.2.2027 (oben).
- Register-Vorschläge der Nummern: keine.

## Recht

- Geändert (Wortlaute von Recht, je Zeichen für Zeichen gegengelesen): 303 B2 (Hilfssatz „Satz in %“ und der Satz unter dem Knopf in der Akte: Ankündigung 30 bzw. 15 Tage, AGB 19.9 und 32.3, Postfach und E-Mail, Verzicht in Textform) und A7 erster Teil (`auskunft.satz`); 304 Punkt 6 (zwei Sätze zur Schließung in der Akte, ohne „Name“) und die Sätze der drei neuen Aufgaben (mit „AGB 29.3“).
- Gegenlesen „Recht“ 303: ohne Befund (Byte-Vergleich; A7: gebaut ist die Fassung „unverändert“, weil T5 greift und der Startsatz fehlt). 304: ohne Befund (Datenschutzerklärung :556 widerspricht den neuen Admin-Sätzen nicht).
- `git diff --name-only origin/main...integration/lauf34c -- prisma/ pnpm-lock.yaml .env.example src/lib/rechtstexte/ src/lib/widerruf.ts docs/recht/ docs/betrieb/handbuch.md` ist leer.

## Abnahme

- 303: B1 (Karte „Hofpreis-Modell ab“, Rückfrage, Abbrechen ohne DB-Änderung, Speichern mit Passkey) und B2 (Akte, Karte „Plattformgebühr“) bei 390 und 1440, hell und dunkel, als „Ergänzung ohne Board“ bestanden; alle Messpunkte in 17 Messungen; ein Sollte (Passkey-Bestätigung über der offenen Rückfrage). Zwei Zeilen in der Ergänzungsliste (s3/w3-admin-einstellungen, s3/w3-admin-akte; C).
- 304: Heute mit den drei Aufgaben und „Kommt“ bei 390 und 1440, hell und dunkel, als „Ergänzung ohne Board“ bestanden; jede Aufgabe verschwindet nach Entfernen der Ursache, „Kommt“ folgt der Einstellung. Zeile in der Ergänzungsliste (s3/w3-admin-heute; C).
- 306: Hofseite (Übersicht, Produkte, Korb-Blatt, Korb-Leiste) bei 390 und 1440 hell vorher und nachher pixelgleich; Mein Hof „Titelbild ersetzen“ gleich. Keine Zeile in der Ergänzungsliste.
- 308: Fadenseite bei 390 und 1440, hell und dunkel, vor und nach dem Senden, gegen Board s2-/w2-postfach Bild 2 bestanden (eigene Antwort 20 px über dem Feld). Keine Zeile in der Ergänzungsliste.
- 304a ohne Oberfläche: Abnahme über Tests, pruefer, Gegenlesen „Sicherheit“ (ohne Befund), Integration. Einzelheiten in `docs/nachtlauf/berichte/abnahme-lauf34.md`.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Admin-Texte ohne Kürzel und Technikwörter** (303): In DESIGN_SYSTEM „Wortliste“ festhalten, dass Admin-Texte keine Register-Kürzel (K1, M1 …) und keine Technikwörter (Deployment, Webhook, Destination Charges) nennen; die Wache tests/admin-kuerzel-wache.test.ts wächst mit jeder Nummer, die Admin-Texte ändert, um deren Dateien (304 hat admin-aufgaben.ts schon aufgenommen).
2. **Prüfung einer Build-Ausgabe endet bei unlesbarer Eingabe rot** (306): Muster scripts/pruefung/paket-hofseite.mjs; nie still grün.
3. **Zustand nach dem `await` einer Action in `startTransition` setzen**, wenn ein Effekt am neu geladenen Inhalt darauf hört (308; sonst rollt die Seite, bevor die Nachricht im Faden steht). Kandidat für CODING_STANDARDS; Prüfung: Prüfstand zählt die Übergänge.
4. **Wackler „Unhandled Error“ aus Zeitgebern nach Testende** (Dirigent): Die CI am Einzel-PR #545 war rot, obwohl alle Tests grün waren – ein Zeitgeber von `sonner` feuerte nach dem Ende von tests/hydrieren.test.ts (`window is not defined`). Vorschlag: im Test die Zeitgeber aufräumen (`vi.useFakeTimers` bzw. Toaster abbauen) als eigene kleine Nummer; Prüfung: die Datei 20-mal hintereinander ohne Fehler.
5. **Uhrzeiten im Zeitbuch** (Dirigent): Ende eines Prüfers ist oft nur als Spanne zwischen zwei Commits belegbar; der Dirigent hat geschätzte Zeiten auf Commit-Zeiten berichtigt. Vorschlag: Das Skript des Dirigenten schreibt `date -u` beim Eintreffen jeder Rückmeldung in eine Datei unter .nachtlauf/dirigent/.

## Nacharbeit (gesammelt aus den Berichten)

- 304a: Detail-Test prüft `{ ohneZeitgrenze: true }` nicht; Zählung derselben Adresse im Detail weiter über 90 Tage.
- 303: Kommentar über `marke` (B6) umgeschrieben; B9 und B13 ohne wörtliche Erwartung; src/app/admin/betrieb/dienste.ts:59 „über den Webhook“; tests/admin-ansichten.test.ts:218 prüft seit B3 immer wahr; Kommentare mit dem alten A5-Titel (admin-shell.tsx:132, admin/layout.tsx:31); Handbuch (Montags-Routine B7) zieht 302 nach.
- 306: tests/hofseite-vorschau.test.ts prüft den Aufruf `korbErlaubt({ isEditMode: false, kaufen })` nicht mehr am Quelltext; paket-hofseite.mjs meldet einen fehlenden Chunk nur als Stacktrace; Kommentare in src/server/bild-loeschen.ts:15, tests/reorder-actions.test.ts, tests/hofseite-vorschau.test.ts:9.
- 304: Abfrage „Lastschrift beendet“ ab 200 Höfen in der Geschichte (Reihenfolge umdrehen); Testkommentar und Fall „pausiert und geschlossen“; Kopfkommentar admin-kuerzel-wache; Stufe 2 rechnet mit `lt`, die neue Quelle mit `lte`.
- 308: `rollVerhalten` doppelt zu `scrollVerhalten` (src/lib/hofseite-kunde.ts:488); Prüfstand erkennt das `startTransition` nicht; wirft `antworteAlsHof`, erscheint keine Meldung (vorbestehend).

## Stabilität

- Rechner: 4 Kerne, 15 GB, neuer Container. Node v22.23.4, Unicode 17.0. Start 13.11.2026 12:53 UTC, Haltepunkt C 14:41 UTC (Stunde 1,8).
- Volle Läufe n = 1 unter `schwer.lock`, 3 Worker, 388–592 s je Lauf (mit Warten); im Sammelstand mit Integration 709 s (773 Dateien, 14292 Tests; Integration 109 Dateien, 867 Tests). Keine Unterbrechung, kein Neustart, keine Runde (alle Nummern 0 Runden).
- **CI:** Der Sammel-PR #544 wurde gleich nach dem Doku-Schritt als Entwurf geöffnet (Regelvorschlag 2 aus B); seine CI lief auf jedem gepushten Zwischenstand grün (Läufe 928, 931 bis 935 und 937; abgebrochene Läufe nur durch einen neueren Push; der Lauf auf dem Haltepunkt-Commit steht am PR). Die Einzel-PRs #546 bis #549 hatten beim Öffnen einen Doku-Konflikt (DEVELOPMENT.md) mit dem Zwischenstand, GitHub startete dort keine CI; die CI des Sammel-PR deckt sie ab. **Einzel-PR #545 (304a): CI rot** – alle 767 Dateien und 14221 Tests grün, aber ein „Unhandled Error“ aus einem Zeitgeber von `sonner` nach dem Ende von tests/hydrieren.test.ts (Datei nicht von 304a berührt); derselbe Code lief im Sammel-PR grün. Gewertet als Wackler; den roten Job hat der Dirigent einmal neu angestoßen (kein leerer Commit, nichts abgeschwächt): Versuch 2 grün (ci mit Build und Paketprüfung, integration). Regelvorschlag 4.
- Budgets (Plan der Abschnittsdatei, Wanduhr ab 12:53): alle eingehalten (304a fertig 13:13 statt bis 14:38; 303 fertig 13:27 statt bis 16:38; 306 fertig 13:39 statt bis 18:08; 304 fertig 14:08 statt bis 20:08; 308 fertig 14:20 statt bis 19:08).
- Abweichungen: Ein Doku-Commit (0c50463fdee8) hat den Entwurf dieses Berichts mit Platzhaltern mitgepusht; der Haltepunkt-Commit stellt ihn fertig. Die Doku-Wachen liefen beim ersten Push erst danach (im Haupt-Klon fehlte `pnpm install`; Wiederholung grün). Der Dirigent hat mehrmals eine geschätzte Uhrzeit eingetragen und danach auf die Commit-Zeit berichtigt (im Zeitbuch so vermerkt; Regelvorschlag 5).

## Aufräumen

Bestätigt um 14:41 UTC (Zeitbuch): Die Fotografen haben je ihren dev-Fotografen, Prüf-Browser und Passkey-Browser beendet, ihre Prüf-DBs, Kopien und Wegwerf-Rollen gelöscht, pruef-env, Links und Protokolle entfernt und ihre Foto-Worktrees gelöscht; Port 3000 frei, $HOME/nachtlauf-dev nicht vorhanden. Der Dirigent hat die Integrations-DBs `fz_int_*` (sechs) gelöscht, `.env.test` und `.next` in allen Worktrees entfernt und die Worktrees /home/user/wt/basis und /home/user/wt/zw gelöscht; laeufe/ leer. Die Worktrees der Nummern unter /home/user/wt/ bleiben bis zum Ende der Sitzung (nur lokal, alles gepusht). Im Scratchpad der Sitzung liegen Hilfsdateien des Fotografen 304 ohne Geheimnisse (der Hook blockt `rm -rf`); sie verschwinden mit dem Container.

## Bilder

Im Container unter `/home/user/FarmerZone/.nachtlauf/screens/`: `0a-c/` (Probe agent-browser), `303/r1/` (Einstellungen-Karte, Rückfrage, Passkey, Akte; 390 und 1440, hell und dunkel), `304/r1/` (Heute mit Aufgaben, „Kommt“, Verschwinden-Belege), `306/r1/` (Hofseite und Mein Hof vorher und nachher, 390 und 1440 hell) und `308/r1/` (Faden vor und nach dem Senden, vorher und nachher, Board-Figuren). Nicht committet.

## Wiederaufnahme (für D)

- Zwischenstand `integration/lauf34c` (gepusht), Sammel-PR [#544](https://github.com/Uttoranger/FarmerZone/pull/544) (bereit). Keine WIP-Stände, keine verschobenen Nummern.
- D beginnt mit „Nachtlauf 34 fortsetzen“ in einer neuen Sitzung: Zeitbuch und status.md lesen, §0a (ohne 1.2), Doku-Schritt 3.3 („### 38.3 Abschnitt D“), Postgres starten und dem Benutzer postgres ein lokales Passwort setzen, im Haupt-Klon zuerst `pnpm install --frozen-lockfile` (sonst laufen die Doku-Wachen nicht), Worktrees neu anlegen, je Worktree `pnpm install --frozen-lockfile` und `pnpm exec prisma generate`.
- Branch-Namen in D weiter `nacht/2026-11-11/<nr>-<kurz>` (Datum des Starts von A).
