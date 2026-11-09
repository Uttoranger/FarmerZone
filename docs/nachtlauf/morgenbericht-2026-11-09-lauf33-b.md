# Zwischen-Morgenbericht Lauf 33, Abschnitt B (9.11.2026) · Boards Teil 1

**Ergebnis Abschnitt B:** Fertig, geprüft und gepusht sind 267 und 269 (aus A fortgesetzt), 265, 270, 268, 262b (aus A verschoben), 271, 272, 273, 274, 275, 276, 279 und – nach Auftrag 3.3 vorgezogen – 277. Alle liegen im Zwischenstand `integration/lauf33` (080fe1fd). Der volle Lauf darauf ist grün (745 Dateien, 13806 Tests), die Integrationstests ganz auch (101 Dateien, 810 Tests). Keine Migration, kein Paket, keine neue Variable. Haltepunkt B um 15:16 UTC (Stunde 7,2 von B). Zwischen-Durchgang B: 33 Boards bewertet, keines mit 5 Sternen; besser als Schluss Lauf 32 auf 13 Boards, gleich auf 17, schlechter in einzelnen Fassungen auf 4 (Abschnitt „Ergebnis“). Der Sammel-PR bleibt **Entwurf**: [#508](https://github.com/Uttoranger/FarmerZone/pull/508).

**Ordnungsgemäß beendet:** ja – Haltepunkt B, Zwischen-Durchgang, Aufräumen bestätigt, Sammel-PR als Entwurf fortgeschrieben. **Ziel erreicht (5 Sterne):** nein, in B noch nicht; Restmängel stehen je Board in docs/nachtlauf/berichte/abnahme-lauf33.md „Zwischen-Durchgang B“ und gehen an C bzw. an die Design-Gruppe.

## Für dich zu tun

- [ ] **Für die Projektleitung am Tag T** (unverändert aus A005, nicht optional – die Notbremse am Vorabend sichert Bestellungen rund um Mitternacht ab, an denen Kassensatz (0.9) und Snapshot (1.0) auseinanderfallen könnten):
  - Generalprobe auf test.agrilo.at: Den Stichtag dort auf morgen setzen; der Admin erlaubt nur Tage in der Zukunft. Am Tag danach prüfen: /agb zeigt 1.0, eine Testbestellung hängt agb-<marke>-1.0.html an und verlinkt /agb/1.0, „Erneut bezahlen“ einer älteren Bestellung zeigt den alten Satz.
  - Vor T in der Produktion:
    - Stichtag im Admin setzen; er ist frei verschiebbar, bis er erreicht ist.
    - „Monate ohne Grundgebühr“ = 12 speichern und festschreiben.
    - Keinen echten Hof ohne Zustimmung zu 1.0 freischalten. Keinen um Zustimmung bitten, bevor er die Ankündigung per E-Mail mit 1.0 im Anhang hat.
  - Am Abend vor T: Admin › Notbremse von Hand setzen, spätestens um 23:29 Uhr (Wien), „bis“ 00:10 Uhr, Grund „Wartung“, Satz „Bestellen ist gerade kurz nicht möglich. Bitte versuch es nach Mitternacht wieder.“ Die Notbremse beginnt immer beim Speichern; einen späteren Start gibt es nicht. Wirkung: Bis Mitternacht verfällt jede vorher angelegte Online-Bestellung, die noch nicht bezahlt ist (30-Minuten-Frist). Über Mitternacht entsteht keine neue Bestellung. Bar angelegte Bestellungen bleiben im Modell bisher und bekommen 0.9, das ist richtig.
  - Nach 00:10 Uhr: /agb zweimal laden; es zeigt „Fassung 1.0 – gilt ab <T>“. Dazu /agb/0.9, /agb/1.0 und /konditionen (Stichtag, keine „Entwurf“-Marke).
  - In der Produktion keine Testbestellung, die als „abgeholt“ markiert wird (sonst zieht die Monatsabrechnung 6 % per echter Lastschrift ein). Wird doch eine gemacht: stornieren oder „nicht abgeholt“.
- [ ] **Gründungsplätze in Produktion auf 100 stellen** (Admin › Einstellungen › Gründungshöfe; „Plätze nur erhöhen“ lässt 12 → 100 zu), bevor eine Seite in Produktion eine Platzzahl nennt und vor jeder Werbung mit einer Zahl (sonst entsteht nachträglich künstliche Knappheit), spätestens vor dem ersten Festschreiben.
- [ ] **Die Gründungszusagen vor dem 1.1.2028 festschreiben**, sonst beginnt der Bar-Einzug der Gründungshöfe am 1.1.2028 statt am 1.2.2028 (K2/N44).
- [ ] **Musternummer:** Die Entwicklungsdatenbank trägt die alte Musternummer des Pilothof-Inhabers bis zum nächsten Seed. Bitte lesend prüfen, ob die alte Musternummer auch in Produktion steht (der Lauf ändert nichts).
- [ ] **„Nachtlauf 33 fortsetzen“** für Abschnitt C (in einer neuen Sitzung): 278, 280, 281, Sammel-PR, Schluss-Durchgang.
- [ ] **Merge:** erst am Ende von C (Sammel-PR per **Merge-Commit**, nicht Squash). Bis dahin bleiben die Einzel-PRs offen: #503–#507 (A) und #509–#522 (B). Nach dem Merge die PRs aus Lauf 32 (laut Morgenbericht 32 B: #466–#469, #476, #479–#489, #491–#500, Zweig nacht/2026-11-05/242-basis) und aus Lauf 33 schließen.
- [ ] **Board-Korrekturen für die Design-Gruppe** (zusätzlich zur Ergänzungsliste docs/nachtlauf/berichte/lauf33-ergaenzungen.md):
  - ONLINE_ZAHLUNG_EINRICHTEN_SATZ: Board an den Code angleichen (deine Antwort 1, 9.11.2026; heute Bild 4, registrieren Bild 5).
  - **Illustration im Dunkeln (F041):** Boards zeigen die Illustration im Dunkeln mit der Fläche multipliziert; neu gilt „wie ein Foto, gedämpft und gerahmt“ (§37.1, Ergänzungsliste).
  - Quelle der Regionskarte auf der Startseite: „Kartendaten: Natural Earth“ statt „© OpenStreetMap“ (das SVG ist Natural Earth; Bericht 271).
  - Druck: Abholzettel und Packliste sagen „Gesamt inkl. Plattformgebühr.“ (je Bestellung, wo das Gesamt die Gebühr enthält) statt „Preise inkl. …“ (Antwort 4, Auftrag Z. 112).
  - Kasse: Karte „Deine Bestellung“ bleibt (deine Antwort 2); das Board zeigt sie nicht.
  - Hof-Kürzel in mehr-neu (aus A, unverändert offen).
- [ ] **Prüfungen in der Vorschau**, die der Container nicht kann: „[TEST]“ im Seitentitel der 500 (der Prüf-Bau läuft als Produktion und zeigt keinen Vorsatz), Admin-Mail-Vorschau mail-sicherheit (270).
- [ ] **P1 an die Anwältin** samt Hof-Mail zum Rücktritt (unverändert) und die Fragen „Recht“ unten.

## Entscheidungen und Fragen

- **/widerruf (Recht, Regel Z. 169):** (a) Feld „Deine E-Mail-Adresse“ mit Bestell-Link und Zeile „Eingangsbestätigung an …“ (Board Bild 3/6; keine B-/C-Zeile) – Feld nachtragen oder Adresse aus der Bestellung nehmen? (b) Anschrift des Hofs in Schritt 1/2 (Identität des Unternehmers?) – dann als R nachtragen. (c) Neu ist eine reine Anzeige der Positionen mit Häkchen unter „Die ganze Bestellung“ (nicht abwählbar) – missverständlich? 279 hat nichts davon gebaut; Wortlaut und Felder unverändert.
- **„[TEST]“ auf global-error (Antwort 4):** global-error ersetzt das Wurzel-Layout; ohne neue `NEXT_PUBLIC_*`-Variable kennt der Browser die Umgebung dort nicht. Neue Variable erlauben oder so lassen? (Die normale Fehlerseite trägt den Vorsatz.)
- **Grundpreis bei Gramm und Milliliter:** Hofseite, Produktseite und jetzt auch der Korb zeigen „€ … / g“ bzw. „/ ml“ (gemeinsame Hilfe), das Board „€ 26,32 / kg“. Hilfe auf kg/L umstellen (eine Stelle, wirkt überall) oder Board korrigieren?
- **registrieren:** Die App sagt „bis 31. Dezember 2027 keine Grundgebühr“, das Board „12 Monate keine Grundgebühr“. Vermutlich Register K2 (fester Stichtag) – bitte bestätigen, dann Board-Korrektur.
- **Kasse:** Leistensatz („Wähl noch, wann du abholst · bar am Hof · Bestätigung per E-Mail“ statt „Mit dem Klick bestellst du verbindlich …“) und der Reservierungskasten haben keine Zeile in der Liste. Board oder Code?
- **bestellung-link:** Marke „Bestätigt“ statt „Bezahlt“ bei einer online bezahlten Bestellung (Board). Board oder Code?
- **Rückweg-Kreis /meldungen ↔ /fehler-melden** (pruefer zu 269): gewollt?
- **Toast-Token:** bleibt draußen (unverändert aus A).

## Nummern

| Nr | Inhalt | Status | PR | Vorschau | Migration | Weggelassen / offen |
|---|---|---|---|---|---|---|
| 265 | Gründungsplätze aus der Einstellung, eine Zählregel | fertig | [#511](https://github.com/Uttoranger/FarmerZone/pull/511) | Vercel-Vorschau des PR | nein | 4 Sollte → Nacharbeit |
| 267 | Kunden-Bausteine G11, G10 | fertig | [#509](https://github.com/Uttoranger/FarmerZone/pull/509) | Vercel-Vorschau des PR | nein | „Abstand Inhalt → Fuß“ einheitlich (Querschnitt) → C |
| 268 | Meldungen | fertig | [#514](https://github.com/Uttoranger/FarmerZone/pull/514) | Vercel-Vorschau des PR | nein | Liste Z. 573, 576 offen (meldungen 3 Sterne) |
| 269 | Hof-Bausteine und Kästchen-Baustein | fertig | [#510](https://github.com/Uttoranger/FarmerZone/pull/510) | Vercel-Vorschau des PR | nein | `mb-4` in ui/werkzeug-kopf.tsx (Abstand Hinweis → Karte); Konstante für ein angezeigtes Häkchen |
| 270 | Mail-Vorschau mit Beispieldaten | fertig | [#512](https://github.com/Uttoranger/FarmerZone/pull/512) | Vercel-Vorschau des PR | nein | Board mail-sicherheit nicht aufgenommen (Admin) |
| 262b | Werkzeug-Nacharbeit | fertig | [#513](https://github.com/Uttoranger/FarmerZone/pull/513) | Vercel-Vorschau des PR | nein | 3 Sollte |
| 271 | Finden (startseite, hoefe, hofseite, produkt) und F041 | fertig | [#516](https://github.com/Uttoranger/FarmerZone/pull/516) | Vercel-Vorschau des PR | nein | F041 15.5.3 nicht ganz (helles Quadrat im Dunkeln); G8, G11 |
| 272 | Region und Verkäufe | fertig | [#515](https://github.com/Uttoranger/FarmerZone/pull/515) | Vercel-Vorschau des PR | nein | – |
| 273 | Kunden und Auswertung | fertig | [#517](https://github.com/Uttoranger/FarmerZone/pull/517) | Vercel-Vorschau des PR | nein | Ladefehler nicht prüfbar (500) |
| 274 | Mein Hof und Postfach | fertig | [#518](https://github.com/Uttoranger/FarmerZone/pull/518) | Vercel-Vorschau des PR | nein | Hinweis über Kopf/Reitern (Produkte), Postfach-Zähler |
| 275 | Konto und Einrichten | fertig | [#519](https://github.com/Uttoranger/FarmerZone/pull/519) | Vercel-Vorschau des PR | nein | /onboarding G1-Rückweg, G13 |
| 276 | Kauf (korb, kasse, bestaetigung, bestellung-link) | fertig | [#520](https://github.com/Uttoranger/FarmerZone/pull/520) | Vercel-Vorschau des PR | nein | Futter-Grundpreis je Einheit im Korb; kaeuferArt-Kästchen nicht umgestellt; Zeitformat |
| 277 | Hof-Alltag (heute, bestellungen, bestellung, druck, produkte, produkt-neu) | fertig | [#522](https://github.com/Uttoranger/FarmerZone/pull/522) | Vercel-Vorschau des PR | nein | Schleier im Web (ui/dialog), Vorrat-Felder nur aria-label |
| 279 | System (neuigkeiten, abmelden, systemseiten, widerruf, fehlerseiten, rechtstexte) | fertig | [#521](https://github.com/Uttoranger/FarmerZone/pull/521) | Vercel-Vorschau des PR | nein | „[TEST]“ auf global-error; „Zu Hof Müller“ auf der Produkt-404; Fragen „Recht“ |
| 278, 280, 281 | Einstellungen und Teilen, Mails, Admin | offen (Abschnitt C) | – | – | – | 278 nach 3.3 nicht in B |

Echte Fehler mit vorher rotem Test (Namen und Ausgaben in den PR-Texten): 265 `tests/gruendung-vergeben-265.test.ts`; 268 `tests/meldung-268.test.ts`; 262b `tests/pruefung-messung.test.ts`; 272 `tests/verkauf-doppelt-absenden.test.ts` (Doppelbuchung bei Doppeltipp); 276 `tests/korb-hinweis.test.ts` › „Wortgrenze …“; 277 `tests/hof-alltag-gebuehr.test.ts` (Packliste) und `tests/hof-alltag-277.test.ts` (Erklärsatz geöffnet).

## Merge-Reihenfolge

Sammel-PR `integration/lauf33` → main am Ende von C per **Merge-Commit** (nicht Squash). In B sind per `--no-ff` gemergt: 267 (#509), 269 (#510), 265 (#511), 270 (#512), 262b (#513), 268 (#514), 272 (#515), 271 (#516), 273 (#517), 274 (#518), 275 (#519), 276 (#520), 279 (#521), 277 (#522); nach jedem Merge voller Lauf grün, Integration ganz nach 274, 279 und 277. Konflikte nur in DEVELOPMENT.md und DESIGN_SYSTEM.md (angehängte Abschnitte, beide behalten; Doppelabsatz-Wache grün), BAUSTEINE.md neu erzeugt.

## Ergebnis (Zwischen-Durchgang B, schlechtestes Bild je Fassung: 390 hell · 390 dunkel · 1440 hell · 1440 dunkel)

| Board | Nr. | Schluss Lauf 32 | Zwischen-Durchgang B |
|---|---|---|---|
| startseite | 271 | 3·3·3·3 | 4·4·3·3 |
| hoefe | 271 | 2·2·3·3 | 4·3·3·3 |
| hofseite | 271 | 3·3·4·4 | 3·3·4·3 |
| produkt | 271 | 2·2·3·2 | 3·3·3·3 |
| region | 272 | 2·2·2·2 | 3·3·3·3 |
| verkaeufe | 272 | 2·2·2·2 | 4·4·4·4 |
| kunden | 273 | 3·3·3·3 | 4·4·4·4 |
| auswertung | 273 | 3·3·3·3 | 3·3·3·3 |
| mein-hof | 274 | 3·3·2·2 | 3·3·3·3 |
| postfach | 274 | 3·3·4·4 | 3·3·3·3 |
| registrieren | 275 | 3·3·3·3 | 3·3·3·3 |
| meine-bestellungen | 275 | 3·3·3·3 | 4·4·4·4 |
| kundenkonto, anmelden, passwort | 275 | 4·4·4·4 | 4·4·4·4 |
| korb | 276 | 3·3·5·5 | 4·4·4·4 |
| kasse, bestaetigung, bestellung-link | 276 | 4·4·4·4 | 4·4·4·4 |
| heute, bestellungen, bestellung | 277 | 4·4·4·4 | 4·4·4·4 |
| druck (nur hell) | 277 | 4·4 | 4·4 |
| produkte | 277 | 3·3·4·4 | 4·4·4·4 |
| produkt-neu | 277 | 3·3·3·3 | 3·3·3·3 |
| neuigkeiten | 279 | 3·3·3·3 | 4·4·4·4 |
| abmelden, rechtstexte | 279 | 4·4·4·4 | 4·4·4·4 |
| systemseiten | 279 | 5·5·4·4 | 4·4·4·4 |
| widerruf | 279 | 3·3·3·3 | 4·4·4·4 |
| fehlerseiten | 279 | 3·3·3·3 | 3·3·4·4 |
| problem-melden | 268 | 2·2·2·2 | 4·4·4·4 |
| meldungen | 268 | 3·3·3·3 | 3·3·3·3 |
| mail-sicherheit | 270 | nicht prüfbar | nicht aufgenommen (Admin) |
| hofdaten-zahlung, beitraege | 269 → 278 | – | 3·3·3·3 je Board (pruefer-ui zu 269 in B; Seiten von 278 in C) |

Querschnitt (Einzelheiten in abnahme-lauf33.md): F041 15.5.3 nicht ganz erreicht (helles Quadrat bzw. Rechteck im Dunkeln auf hoefe 390, hofseite-Produkte 1440, produkt); G8 Kartenradien 20–24 px auf den Finden-Boards; G11 Fuß im Web breiter als die Inhaltsspalte; G3 Abstand Hinweis → Karte 32–36 statt 12 px; Zeitformat „09:00“/„15:00–18:00 Uhr“; Zeilenabstand im Fließtext; Ladefehler-Bilder zeigen die 500 (Werkzeug).

## Geld

- **276:** Korbzeile „Name, Menge“ und eine Zeile Grundpreis je Einheit über die gemeinsame Hilfe `preisZeilen` (Runde 1: keine eigene Fließkomma-Rechnung mehr); Endpreis, Reservierung, Kasse und API unverändert (Diff von reservierung.ts, warenkorb.ts, kasse.ts und src/app/api/ leer). Gegenlesen „Geld“ und Rundendiff ohne Blocker (PR #520). Futter im Korb zeigt den Grundpreis je Einheit, nicht je kg (schon vor 276 so; Nacharbeit).
- **277:** Packliste: „Gesamt inkl. Plattformgebühr.“ je Bestellung nur, wo dieses Gesamt die Gebühr enthält (Antwort 4); `druckKasse` und `druckGesamtHinweis` unverändert nach src/lib/hof-bestellungen.ts verschoben; Beträge und Berechnung unverändert. Gegenlesen „Geld“ ohne Blocker (PR #522).
- **265, 271, 273:** Gegenlesen „Geld“ ohne Blocker (Zählregel der Gründungsplätze; Beispiel-Rechnung der Startseite; Gebühren in Kunden/Auswertung).
- **272:** echter Fehler behoben – ein Doppeltipp auf „Eintragen“ im Verkaufs-Blatt konnte zwei Buchungen anlegen (Ref-Sperre, Test vorher rot).

## Recht

- 279: `src/lib/widerruf.ts`, `src/lib/rechtstexte/`, `src/lib/konditionen.ts` und `docs/recht/` ohne Diff; nur Rahmen und Darstellung; /widerruf-Kästchen auf den Baustein mit Vorher-nachher-Test. Gegenlesen „Recht“ ohne Blocker (PR #521). Offene Fragen siehe oben.
- `git diff --name-only origin/main...integration/lauf33 -- src/lib/widerruf.ts src/lib/rechtstexte/ docs/recht/`: leer.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Prüf-Ordner aus Lint und Doku-Wache ausnehmen** (mehrfach in B: Läuft Fotograf oder Prüf-Browser im Worktree, wird der volle Lauf rot – eslint prüft die `.next`-Kopie unter `.nachtlauf/fotograf/`, die Doku-Pfad-Wache stolpert über einen toten Link im Browser-Profil). Prüfung: `.nachtlauf/**` in die eslint-Ignorierliste und in die Ausnahmen von tests/docs-pfade-wache.test.ts; Test, dass beide den Ordner überspringen. Ort: eslint-Konfiguration, tests/docs-pfade-wache.test.ts.
2. **Teilausfall statt ganzer DB für Ladefehler** (seit 262 bekannt, in B auf kunden, auswertung, postfach wieder nur die 500): `db-schalter.ts` um eine Sperre einzelner Tabellen (z. B. `REVOKE SELECT` auf einer Kopie) erweitern, damit der Ladefehler-Kasten (G6) prüfbar wird. Ort: scripts/pruefung/db-schalter.ts, fotograf.sh.
3. **Startfokus per Tastatur aufnehmen** (Q3; in B auf keinem 1440-Bild sichtbar): `seiten-bild.sh --tab <n>` drückt n-mal Tab vor dem Bild. Ort: scripts/pruefung/seiten-bild.sh.
4. **Zustandsbilder ohne Neuladen** (Fotograf B: seiten-bild.sh lädt neu und schließt Dialoge): Schalter `--ohne-laden`. Ort: scripts/pruefung/seiten-bild.sh.
5. **pruefer im vollen Durchgang hält an der Zuggrenze** (277: Bericht erst nach Nachfrage): kein Textregel-Vorschlag; der Dirigent fragt den Bericht ab, wenn die Meldung „Zuggrenze“ kommt (so geschehen).

## Stabilität

- Start von B 08:02 UTC (9.11.2026), Haltepunkt B 15:16 UTC, Zwischen-Durchgang 15:17–15:25 UTC, Aufräumen bis 15:26 UTC. Kein Neustart des Containers, keine Unterbrechung durch die API.
- Volle Läufe unter `schwer.lock`, 3 Worker: Testdauer 254–451 s; Integration ganz etwa 6 min.
- Budgets: 265, 270, 268, 262b, 272, 273, 275, 276, 279, 277 innerhalb; 271 (10:00–12:36, Budget 2,5 h) und 274 (10:43–13:23, Budget 2 h) mit Runden und Merge knapp darüber. 277 nach 3.3 in B (Budget endete vor Stunde 9,5).
- Abweichungen: Zeitweise drei aktive Umsetzer-Aufrufe statt zwei: 10:00–10:45 (268 bzw. 262b in der Schlussphase neben 271, 272, 274) und 13:52–14:10 (Runde 1 von 276 neben 279 und 277). 279 ließ einmal `tsc --noEmit` kurz ohne Sperre laufen (selbst gemeldet). Uhrzeiten aus `date -u`; eine Merge-Uhrzeit im Zeitbuch stand zuerst eine Minute zu früh (14:11) und ist nach dem Commit berichtigt.

## Aufräumen

Bestätigt um 15:26 UTC: Fotograf b1 gestoppt und weggeräumt, Prüf-Browser zwb und boards gestoppt, keine `next`-, Chromium- oder Passkey-Prozesse; Prüf-DB `pruef33b`, Kopie `kopie_b1_pruef33b` und alle Integrations-DBs (`fz_int_*`) gelöscht; `.nachtlauf/pruef-env`, `pruef-links.json`, `admin-passkey.json` gelöscht; Prüf-Worktree `zwb` samt `.next` entfernt; leere Restordner `.nachtlauf/fotograf` und `.nachtlauf/browser` in den Worktrees 268, 277, 279 entfernt. Kein dev-Worktree (`$HOME/nachtlauf-dev` nicht vorhanden). Die Nummern-Worktrees unter /home/user/wt/ bleiben bis zum Ende der Sitzung; ihre Branches sind gepusht.

## Bilder

Im Container unter `/home/user/FarmerZone/.nachtlauf/screens/`: je Nummer `<nr>/r1/` (265–279; 276 zusätzlich `r2/`), `boards/` (Board-Bilder aller geprüften Boards), `zwischen-b/` (Gegenprobe des Zwischenstands, 40 Bilder mit INDEX.md). Nicht committet; in einer neuen Sitzung nicht mehr vorhanden.

## Wiederaufnahme (für C)

- Zwischenstand: `integration/lauf33` (gepusht), Stand im Zeitbuch. Sammel-PR als Entwurf: [#508](https://github.com/Uttoranger/FarmerZone/pull/508).
- Keine gesicherte WIP-Nummer. Rangfolge C nach Auftrag 3.4: 278 → 280 (nach 274, 275, 278, 279) → 281 (nach 263, 265, 270) → Sammel-PR → Schluss-Durchgang. 277 lief schon in B und entfällt in C.
- Nacharbeit für C (Sammelstand oder Folgenummer, nur mit Freigabe): F041 15.5.3 (helles Quadrat im Dunkeln, Grenze 271); G8/G11 auf den Finden-Boards; `mb-4` in ui/werkzeug-kopf.tsx (269); Schleier für `DialogContent` (ui/dialog); Vorrat-Felder mit sichtbarer Beschriftung (277); 276 Bericht §3 Annahme 3 überholt und Raummeter im Vergleichstest; 277 `aria-describedby` nur mit Meldungstext, `PFLICHT_KNOPF_RAHMEN` in produkte-ansicht.tsx; 267 „Abstand Inhalt → Fuß“ einheitlich.
- In der neuen Sitzung: Zeitbuch und status.md lesen, §0a ohne 1.2 und 1.3, Postgres starten (Passwort für postgres setzen), Worktrees neu anlegen, je Worktree `pnpm install --frozen-lockfile` und `pnpm exec prisma generate`; Integrations-DB `fz_int_zw` neu anlegen.
