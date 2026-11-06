# Morgenbericht Lauf 31 (5./6.11.2026) · Redesign November 2026 – Nacharbeit nach der Abnahme

**Ergebnis:** Alle Nummern 233–242 sind gebaut, geprüft, gepusht und im Zwischenstand `integration/lauf31` (690992e9) zusammengeführt. Der volle Lauf ist dort grün (686 Dateien, 12896 Tests), ebenso die Integrationstests (95 Dateien, 780 Tests). **Das Fertig-Kriterium der Freigabe ist nicht erfüllt:**
- Im Schluss-Durchgang von Gate A erreicht kein Board in allen Fassungen 5 Sterne.
- Gegenüber Gate A sind 23 von 49 Boards besser, 25 gleich, eines schlechter (auswertung).
- Am weitesten kamen kasse (5·5·5·4), mehr-neu (5·5·4·3), neuigkeiten (4·4·4·4), bestellung-link (4·4·4·3) und hofseite (3·3·4·4).
- Die Admin-Boards sind nicht abgenommen: Der Admin ist ohne Passkey nicht erreichbar (Präzisierung 2).

Tabelle und Mängel je Board: `docs/nachtlauf/berichte/abnahme-lauf31.md`, Abschnitt „Schluss-Durchgang“. Verlauf der Nacht: `docs/nachtlauf/berichte/zeitbuch-lauf31.md`.

## Nummern

| Nr. | Inhalt | PR | Vorschau | Migration | Weggelassen und warum |
|---|---|---|---|---|---|
| 233a | Doku: Freigabe §35, Gate A | [#466](https://github.com/Uttoranger/FarmerZone/pull/466) | [docs-lauf31](https://farmer-zone-git-docs-lauf31-bierbaron.vercel.app) | nein | – |
| 233 | Hof-Shell, Balken N42 e, Seitenleiste, Schrift in ui/ | [#467](https://github.com/Uttoranger/FarmerZone/pull/467) | [233](https://farmer-zone-git-nacht-2026-11-05233-hof-shell-bierbaron.vercel.app) | nein | Kürzel „HM“ statt „M“ (Rückfrage). Nach 4 UI-Runden Schluss. |
| 236 | Kauf: Korb, Kasse, Bestätigung, Bestellseite, Meine Bestellungen | [#468](https://github.com/Uttoranger/FarmerZone/pull/468) | [236](https://farmer-zone-git-nacht-2026-11-05236-kauf-bierbaron.vercel.app) | nein | Gewährleistungs-Grafik dunkel (Recht). Satz „Höchstens zweimal im Monat“ ohne Beleg. |
| 235 | Hofseite, Produktseite | [#469](https://github.com/Uttoranger/FarmerZone/pull/469) | [235](https://farmer-zone-git-nacht-2026-11-05235-hofseite-bierbaron.vercel.app) | nein | Größenkachel, Brennholz-Wörter, Rücktrittszeile (src/lib/ui, dann Recht) |
| 237 | Hof-Alltag: Heute, Bestellungen, Bestellung, Druck, Produkte | [#470](https://github.com/Uttoranger/FarmerZone/pull/470) | [237](https://farmer-zone-git-nacht-2026-11-05237-hof-alltag-bierbaron.vercel.app) | nein | Packliste mit Uhrzeit und vollem Namen (Rückfrage) |
| 238 | Mein Hof, Einstellungen, Region, Hof-Werkzeuge | [#471](https://github.com/Uttoranger/FarmerZone/pull/471) | [238](https://farmer-zone-git-nacht-2026-11-05238-mein-hof-bierbaron.vercel.app) | nein | Aus Zeitgründen: Hofdaten/Zahlung, Konto, WhatsApp/Plakat, Beiträge, Region-Liste |
| 239 | Anmelden, Konto, Systemseiten, Rechtsrahmen, Fehlerseiten | [#472](https://github.com/Uttoranger/FarmerZone/pull/472) | [239](https://farmer-zone-git-nacht-2026-11-05239-anmelden-bierbaron.vercel.app) | nein | Passwort-Auge bleibt, „Willkommen, &lt;Vorname&gt;“ bleibt (Rückfragen) |
| 241 | E-Mails | [#473](https://github.com/Uttoranger/FarmerZone/pull/473) | [241](https://farmer-zone-git-nacht-2026-11-05241-mails-bierbaron.vercel.app) | nein | Sätze in neun `src/lib`-Dateien und Daten aus `server/mail-arten` lagen außerhalb der Grenze |
| 234 | Finden: Startseite (A1), Höfe entdecken | [#474](https://github.com/Uttoranger/FarmerZone/pull/474) | [234](https://farmer-zone-git-nacht-2026-11-05234-finden-bierbaron.vercel.app) | nein | Übrige Abschnitte der Startseite, Kartenmodus am Handy (nicht beauftragt). Video bleibt (A1). |
| 240 | Admin: nur Geld-Kachel nach `createdAt` | [#475](https://github.com/Uttoranger/FarmerZone/pull/475) | [240](https://farmer-zone-git-nacht-2026-11-05240-admin-geld-bierbaron.vercel.app) | nein | Alle anderen Admin-Mängel (Präzisierung 2) |
| 242 | Nacharbeit: Bausteine in ui/, Texte, tote Teile, Robustheit, Zeitgrenzen | [#476](https://github.com/Uttoranger/FarmerZone/pull/476) (nur Durchsicht) | – | nein | Fester Handy-Kopf, ProduktKurzliste, Stepper, Größenkachel, Toast (Zeit) |
| Sammel 31 | `integration/lauf31` → main | [#477](https://github.com/Uttoranger/FarmerZone/pull/477) | [integration](https://farmer-zone-git-integration-lauf31-bierbaron.vercel.app) | **nein** | – |

**Zu den Links:**
- Die Vorschau-Adressen folgen dem Muster der Vercel-Kommentare; bei #471 ist die Adresse bestätigt.
- #470–#475 zeigt GitHub als „merged“, weil ihre Commits im Zwischenstand liegen.
- #466–#469 und #476 sind offen, ihr Inhalt steckt vollständig im Sammel-PR.

**Geld:** Es wurde keine Geldberechnung geändert.
- Die Zeilenbeträge der Hof-Mail kommen aus dem unveränderten `mailPositionen`.
- Die Geld-Kachel ändert nur die Anzeige (Register N32).
- Geld-Tests haben keine geänderte Erwartung. Nur die Zeitgrenze der Gegenprobe in `geld-fliesskomma-wache` wurde angehoben.

## Merge-Reihenfolge

**Gestapelte PRs per Merge-Commit mergen, nicht per Squash.** Sonst gibt es Konflikte in den darauf gestapelten Branches.

1. Den **Sammel-PR [#477](https://github.com/Uttoranger/FarmerZone/pull/477) `integration/lauf31` → main** per Merge-Commit mergen. Er enthält alles: den Doku-PR #466, #467–#469 und den Zwischenstand mit #470–#476.
2. Danach #466, #467, #468, #469 und #476 schließen. Ihr Inhalt ist dann auf main.
3. Die Hilfs-Marke `nacht/2026-11-05/242-basis` kann gelöscht werden.

Wer lieber Stück für Stück mergt, geht so vor:
1. #466 → main
2. #467, #469, #468 → `docs/lauf31`
3. Dann der Sammel-PR

Jeweils per Merge-Commit.

## Für dich zu tun

- [ ] **Sammel-PR prüfen und per Merge-Commit mergen.** Vorher die Vorschau des Zwischenstands bei 390 und 1440 ansehen, hell und dunkel. Vor allem dort, wo der Container nicht prüfen konnte:
  - /konditionen und das Beispiel der Startseite sollen ab dem Stichtag „Plattformgebühr“ zeigen. Im Prüf-Container waren sie mit Daten vor dem Stichtag vorgerendert.
  - Meine Bestellungen mit Mail-Code
  - Abmelde- und Bestätigungs-Links aus Mails
  - Kasse mit abgelehnter Zahlung
- [ ] **Entscheidungen:**
  1. **Geld-Kachel Admin › Heute:** Eine Bestellung, die in Woche W bestellt und in W+1 abgeholt wird, steht jetzt in keiner laufenden Woche, weil der Status „abgeholt“ bleibt.
     - Alternative: alle nicht stornierten Bestellungen der Woche zählen.
     - Soll außerdem die Zahl „Woche: n“ in „Bestellungen heute“ mitziehen?
  2. **Packliste:** Uhrzeit je Bestellung und voller Name statt `kurzname`? Das Board zeigt „15:00 Anna Berger“, der Code begründet die Kurzform mit „mehr steht auf dem Handy nicht offen herum“.
  3. **Passwort-Auge:** Bleibt es, wie es `PasswordInput` vorgibt, oder fällt es wie im Board weg?
  4. **Begrüßung im Onboarding:** „Willkommen, &lt;Vorname&gt;“ wie bisher oder „Willkommen“ wie im Board?
  5. **Kürzel des Hofs** in der Seitenleiste: „HM“ (heute) oder „M“ (Board)?
  6. **Sicherheits-Mail:** Das Board sagt „7 Tage“, Mail und Geschäftsregel sagen „24 Stunden“. Welche Frist gilt?
  7. **„Neue Bestellung bar“ an den Hof:** Soll der Hof diese Mail bekommen? Heute gibt es keinen Versandweg, nur die Vorschau.
  8. **Abholbereit-Mail:** Bleibt „Dieselbe Bestellung nochmal aufgeben“ (offene Ausnahme S11)?
  9. **Register N9:** Genügt der Leerzustand ohne Symbol, wie die Boards ihn zeigen? Heute behält die Startseite das Symbol, das Konto ist ohne.
  10. **/fehler-melden:** Die Bot-Bremse zeigt in den ersten 3 Sekunden einen stillen Scheinerfolg. Ist das so gewollt?
  11. **Neuigkeiten-Karte der Bestätigung:** Den Satz „Höchstens zweimal im Monat“ belegt keine Regel. Soll er bleiben?
- [ ] **Recht (Anwältin):**
  - Gewährleistungs-Grafik der Kasse ist im Dunkeln ein heller Fleck.
  - Board-Wortlaut des Gebührensatzes in Mails: „… (darin € 1,12). Den Kaufvertrag schließt du mit Hof Müller.“
  - Kurzfassung des Satzes zur Reihenfolge der Höfe (§ 4a FAGG).
  - Rücktrittszeile auf der Produktseite.
  - Hinweis „Bei schnell verderblicher Ware gilt das Rücktrittsrecht meist nicht“ in der Storno-Mail.
  - Anbieterzeile der Mails (A001).
  - Gebührensatz auch in der Bar-Bestätigung (N38).
  - Impressum-Rahmen (PR #448, unberührt).
- [ ] **Admin abnehmen:** braucht einen Weg mit Passkey. Die Idee eines virtuellen WebAuthn-Authenticators im Prüf-Browser nur für die lokale Seed-DB ist nicht gebaut. Sie bräuchte deine Freigabe.
- [ ] **Bestätigung bei Bar, Befund seit main, nicht aus diesem Lauf:** Bei gesetztem `serviceFeeRefundedAt` steht „Plattformgebühr (entfällt)“ durchgestrichen, „Gesamt“ zählt den Betrag aber mit. Das ist eine Geldanzeige, darum nicht geändert, bitte entscheiden.
- [ ] **Nächster Lauf (Freigabe):** Die Mängel aus dem Schluss-Durchgang. Am meisten Wirkung haben:
  - fester Handy-Kopf als Baustein in ui/ (trägt meldungen, einstellungen, beitraege, kunden, verkaeufe und weitere)
  - die aus Zeitgründen offenen Seiten von 238
  - Grenze um die Mail-Texte in `src/lib` und `src/server/mail-arten` (nur Anzeige)
  - Größenkachel und Stepper-Beschriftung
  - Kunden-Shell: Kopf angemeldet im Web, Knopf „Anmelden“ am Handy

## Antwort zu A2 Punkt 9 (nur geprüft, nichts geändert)

`setServiceFeeAction` wirkt im Hofpreis-Modell nicht mehr auf neue Bestellungen:
- Ab dem Stichtag rechnet die Kasse mit `Farm.plattformgebuehrProzent` (`src/app/api/checkout/route.ts`, Schritt 5c).
- `Farm.serviceFee*` gilt nur im Modell `bisher`, also vor dem Stichtag.
- Das deckt sich mit dem Register (docs/entscheidungen.md, Ergänzung zu Punkt 9): Die Akte zeigt den Knopf ab dem Stichtag nicht mehr.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

| Herkunft | Ursache | Gegenmaßnahme | Ort |
|---|---|---|---|
| Dirigent | Doku-Commits ohne vollen Lauf ließen die Telefonnummern-Wache im Zwischenstand rot werden | Vor jedem Push reiner Doku-Commits laufen die Doku-Wachen (`telefonnummern-wache`, `doku-doppelte-absaetze`, `wortliste`); als Hook vor `git push` | `docs/nachtlauf.md` §4, `.claude/hooks` |
| Dirigent | Zwei Container-Neustarts, vermutlich Speicher (bis zu vier Typechecks gleichzeitig mit je 6 GB) | Volle Läufe und Typechecks nur unter einer gemeinsamen Sperre (`flock`); Umsetzer machen früh WIP-Commits | `docs/nachtlauf.md` §4 |
| Dirigent | Alle Abnahme-Server teilten den Next-Cache eines Baus: Stichtag-Stand und Höfe einer Gruppe galten für alle; vorgerenderte Seiten zeigten den Stand der Bau-DB | Je Fotograf eine eigene Kopie von `.next` (oder `cache` leeren), Bau gegen die DB mit dem geprüften Stichtag | Auftrag Fotograf / `docs/nachtlauf.md` (Abnahme) |
| 233, 236 | `rounded-xl/2xl` wachsen mit `--radius` auf 22/29 px statt der 12/16 px der Boards | Rundungen von Karten und Feldern in Pixeln nach Board; als Wache | DESIGN_SYSTEM „Typografie und Form“, TESTING_GUIDELINES §2 |
| 234, 235 | CODING_STANDARDS §7 nennt Kacheln und Regionskarte noch als „hell“; Illustrationen im Dunkeln über `brightness` blieben helle Flecken | §7 anpassen: gedämpft über `ui/bild-dunkel.ts` (multiplizieren) | CODING_STANDARDS §7 |
| 234 | Konstanten aus `'use client'`-Modulen kamen in Server-Komponenten nur als Verweis an | Wache über den Importgraphen | TESTING_GUIDELINES §2 |
| 235 | Tests prüften Abwesenheit am Wort | Abwesenheit am Kennzeichen (`id`, `data-…`) prüfen | TESTING_GUIDELINES §2 |
| 237 | Knopf mit Ziel je Breite | Zwei Links mit `lg:hidden`/`hidden lg:flex`, nie per Skript umleiten | ARCHITECTURE oder DESIGN_SYSTEM |
| 238 | Jede Hof-Werkzeugseite baut ihren Kopf selbst | Baustein „Werkzeug-Kopf“ in ui/ | DESIGN_SYSTEM „Komponenten“ |
| 239 | Startfokus bei Löschen musste je Dialog nachgezogen werden | Wache: `DialogMitte`/`SheetBlatt` mit orangem Hauptknopf setzen `initialFocus` auf „Abbrechen“ | TESTING_GUIDELINES §2 |
| 240 | Eine Kachel zeigt zwei Zahlen aus verschiedenen Zählregeln | Die Regel je Feld am Typ nennen | CODING_STANDARDS |
| 241 | Mail-Sätze verteilt auf neun `src/lib`-Dateien | Mail-Texte in die Vorlage oder in EINE Textdatei je Mail | ARCHITECTURE / DESIGN_SYSTEM „E-Mails“ |
| 242 | Seiten bauten ui/-Bausteine per `[&>…]`-Selektor um | Wache: `className` mit `[&>` an ui/-Bausteinen nur mit Bestandsliste | TESTING_GUIDELINES §2 |

## Abweichungen vom Ablauf (zur Kenntnis)

- **G10 bei 237 und 238:** Der volle Lauf war bis auf das veraltete Bausteinverzeichnis grün. Danach `pnpm bausteine` und die Bausteine-Tests einzeln grün, der volle Lauf aber nicht wiederholt. Steht in beiden PRs, beide sind im grünen Zwischenstand enthalten.
- **Eigene Nachaufnahmen:** Wegen der Container-Neustarts hatten nur 233, 235 und 236 eigene Nachaufnahmen mit pruefer-ui-Runden. Die übrigen Nummern bewertet der Schluss-Durchgang.
- **Nr. 242:** kein PR gegen den Zwischenstand, weil schon gemergt. Siehe #476 mit der Marke als Basis.

## Bilder

Im Container, nicht committet (Präzisierung 1):
- **Gate A:** `.nachtlauf/screens/abnahme/<board>/`
- **Schluss-Durchgang:** `.nachtlauf/screens/schluss/<board>/`, je mit `*-board.png`, App-Bild, `manifest.json` (Messung, axe) und `bewertung.md`
- **Nachaufnahmen der Nummern:** `.nachtlauf/screens/<nr>/r<runde>/`
- **Mails:** `/home/user/wt/241/.nachtlauf/screens/241/{vorher,nachher}/`
- **Ladezeit der Hofseite:** `.nachtlauf/screens/schluss/hofseite/ladezeit.json` (FCP 244 ms, LCP 548 ms)
