# Morgenbericht Lauf 26 (26./27.10.2026) · Admin im Regelbetrieb

Alle 15 Nummern (184–198) sind gebaut, geprüft und im Sammel-PR. Nicht begonnen: keine. Die Ausgangslage war bei jeder Nummer am Code bestätigt (je Bericht Zeile 3). **Migration:** genau eine, `20261026100000_regelbetrieb` (Nr. 188, nur Expand); Regel 3 auf frischer Wegwerf-DB ohne Unterschied. Kein neues Paket, keine neue Variable (`VERCEL_GIT_COMMIT_SHA` setzt Vercel selbst, Nr. 184).

Besonderheit dieser Nacht: Der Container wurde dreimal neu gestartet (zuletzt auf einem anderen Rechner). Verloren ging nur Rechenzeit; alle Umsetzer sichern seitdem Zwischenstände als `WIP:`-Commit. Zwei Nummern (189, 190) sind deshalb in mehreren Anläufen entstanden.

## PRs

| Nr. | PR | Basis | Runden | Kurz |
|---|---|---|---|---|
| Doku | #403 | main | – | Freigabe §30, Register N32–N38, Status, Mockups, Handbuch-Gerüst |
| 184 | #404 | main | 0 | `/api/gesund`, Lebenszeichen */15, Sentry-Lärm NEXTJS-7 beseitigt, Alarm-Matrix |
| 195 | #405 | main | 0 | Netzsatz „unsicher“, Zurück-Knopf im Titelbild, 11 px unter 360 px, Lint 12 → 2 |
| 194 | #406 | main | 1 | Hof-E-Mail fällt auf die Anmelde-Adresse zurück (`hofKontaktEmail`) |
| 188 | #407 | main | 2 | Schema, `protokolliere`, Rechte je Person, 45 Admin-Actions mit Recht |
| 196 | #408 | main | 0 | Kein Zod im Browser der Kundenseiten; Teilen-Bild aus der Hofseiten-Abfrage |
| 192 | #409 | main | 0 | Betriebshandbuch, Wochenlage per Mail |
| 185 | #410 | integration/lauf26 | 1 | Admin › Heute mit „Braucht dich“ |
| 186 | #411 | integration/lauf26 | 0 | Admin › Bestellungen, Notfall-Storno |
| 187 | #412 | integration/lauf26 | 2 | Höfe-Liste, Hof-Akte, Admin-Sperre |
| 189 | #413 | integration/lauf26 | 0 + Nachbau | Notbremse „Bestellungen anhalten“ |
| 191 | #414 | integration/lauf26 | 0 | Geld: Abgleich mit Stripe, Monatsabschluss |
| 197 | #415 | integration/lauf26 | 1 + Nachbesserung | Plattformgebühr im Hofpreis (Geld) |
| 190 | #416 | integration/lauf26 | 1 | Konto-Anfragen, Team mit Rechten |
| 198 | #417 | integration/lauf26 | 1 + Nachbesserung | SEPA-Monatsabrechnung (Geld) |
| 193 | #418 | integration/lauf26 | 0 | Admin-Navigation, Umzüge, Postfach nur Gespräche |
| Sammel 26 | (dieser PR) | main | – | alles oben per `--no-ff`, Reihenfolge im Zeitbuch |

Dirigent-Eingriffe (Sollte → Blocker oder kleine Korrektur selbst): 192 Wochenlage jede Woche · 186 Hof-Nachricht nennt den echten Geldausgang · 187 Mein Hof zeigt die Sperre · 189 Cache beim Freigeben immer leeren · 191 abgeschnittene Saldo-Liste schreibt keine Tagesgebühr · 193 Akte-Hinweis bricht das Postfach nicht · 197 und 198 je eine Geld-Nachbesserung als eigene Runde. Im Zwischenstand: Aufgaben je Hof führen in die Akte (187 × 185), Notbremse-Leser robust gegen Attrappen und Ladungstyp-Wache liest `stornieren.ts` (189/186 × 197), Plattformgebühr-Mails über `hofSichtbar` (190 × 198).

## Bitte entscheiden

1. **187 Satz für die Kundschaft bei einer Sperre:** Gebaut ist der feste neutrale Satz („Bestellen ist bei diesem Hof gerade nicht möglich.“). Ein eigener Satz je Sperre bräuchte eine Spalte (zweite Migration, in diesem Lauf nicht erlaubt). Weg 1 so lassen (Vorschlag) oder Weg 2 in einem späteren Lauf (nullable Spalte, Expand)?
2. **190 Notfallzugang:** STOPP – bräuchte `AdminErsatzcode.zweck` (Expand) und eine Zeile im Ersatzcode-Endpunkt. Eigene Nummer?
3. **190 Geschlossener Hof:** Behält er seinen Gründungsplatz und bleibt er in den Admin-Signalen? (Heute: ja, nur Kundenwege lesen `hofSichtbar`.)
4. **188 Passkey und Ersatzcodes nur mit Recht `notfallzugang`:** Ein Nicht-Inhaber kann so keinen zweiten Passkey anlegen. Lockern auf „eigene Geräte immer“?
5. **188 Auslegung „live wirkend“:** `setzeBuendelStand`, `antworteAlsTeam`, `sendeTestmail` laufen ohne frische Bestätigung. So lassen?
6. **186 WebhookEvent im Verlauf der Bestellung:** STOPP (kein Bezug zur Bestellung). Vorschlag `WebhookEvent.bestellungId` nullable als Expand in einem späteren Lauf.
7. **189 Farbe:** „Bestellungen anhalten …“ und „Mit Passkey anhalten“ sind Orange-Umriss (DESIGN_SYSTEM „Zerstörendes als Orange-Umriss“), das Mockup zeigt Rot. Bestätigen?
8. **197 Fließkomma-Wache:** Drei neue Bestandseinträge (Menge × Cent, ganze Zahlen). Der Bestand soll nur schrumpfen – bestätigen oder eine Hilfsfunktion verlangen?
9. **197 Stichtag und Vorschau-Abnahme:** Der Stichtag ist nur in die Zukunft änderbar; die Abnahme braucht ihn in der Vergangenheit. Weg: morgen setzen und übermorgen prüfen, oder in der Entwicklungsdatenbank direkt setzen und zurückstellen.
10. **198 Kleinstbeträge:** Rechnungen unter dem Stripe-Mindestbetrag (Beispiel April: 0,48 €) zieht Stripe nicht ein, sondern bucht sie ins Kundensaldo; `invoice.paid` setzt trotzdem „bezahlt“. Sammeln bis zum Mindestbetrag oder so lassen?
11. **198 Rückweg nach einer Rückbuchung:** Heute hebt nur das Team die Sperre auf (`charge.dispute.closed` ist nicht abgedeckt). So lassen oder eigener Punkt?
12. **185 „Woche: n“** zählt abgeholte Bestellungen (Umsatzregel), nicht eingegangene; **„Auszahlung Do“** steht nicht da (keine Quelle). Beides so?
13. **193** „Konto und Sicherheit“ im Blatt „Mehr“ nur mit eigenem Hof; Protokoll-CSV ohne eigenen Protokolleintrag (Geld-Export hat `finanzen_export`). So?

## Zu einzelnen Nummern

**188 – Action → Recht → frisch → Protokoll-Art** (vollständig in `docs/nachtlauf/berichte/188.md`, 45 Actions beim Start, 63 nach dem Lauf):

| Action | Recht | frisch | Protokoll-Art |
|---|---|---|---|
| approveFarm, revokeFarmApproval, rejectFarm, setServiceFee, setzeGruendungBis | hoefe_freischalten | ja | hof_freigeschaltet / … / servicegebuehr_geaendert / … |
| nimmAusGruendung, nimmWiederAuf, schreibeZusagenFest, Testhof an/aus | hoefe_freischalten | ja | gruendung_… / testhof_… |
| speichereGruendungEinstellung | hoefe_freischalten | ja (neu) | gruendung_einstellung_geaendert |
| sendeRundschreiben | hoefe_freischalten | ja | rundschreiben_gesendet |
| triageMeldung, fasseZusammen, trenneDuplikat, setzeBuendelStand | ansehen | nein | meldung_triagiert / meldung_buendel_stand |
| legeMeldungAb | ansehen | ja (neu) | meldung_abgelegt |
| antworteAlsTeam, messeJetzt | ansehen | nein | team_antwort / betrieb_gemessen |
| Mails jetzt/verwerfen/nochmal/Art nochmal | mails_nochmal | ja | mail_… |
| Kostenposten anlegen/ändern/beenden/löschen | geld | ja (neu) | kostenposten_… |
| Empfänger, Zustellregeln | benachrichtigungen | ja | empfaenger_… / zustellregeln_geaendert |
| sendeTestmail | benachrichtigungen | nein | testmail_gesendet |
| Startseite veröffentlichen/zurückziehen/Block löschen | startseite_veroeffentlichen | ja | startseite_… |
| Ersatzcodes, Passkey entfernen | notfallzugang (Inhaber) | ja | ersatzcodes_erstellt / passkey_entfernt |
| dazu in diesem Lauf: Notfall-Storno, Adresse anzeigen, Erstattung außerhalb (186); Hof sperren/aufheben (187); Notbremse an/aus (189); E-Mail ändern, Auskunft, Konto schließen/öffnen, Team (190); Monatsabschluss (191); Stichtag (197); Plattformgebühr je Hof (198) | je eigenes Recht | ja | je eigene Art |

**184 – Ursache JAVASCRIPT-NEXTJS-7:** `meldeUmgebungsWarnungen` (src/lib/umgebung-server.ts), aufgerufen vom `UmgebungsBanner` im Root-Layout, also bei jedem Seitenaufbau. Der Merker war ein Modul-Wert: jede neue Vercel-Instanz meldete von vorn – 1 553 Ereignisse vom 2. bis 26.10. (rund 65 am Tag). Jetzt höchstens einmal je UTC-Tag und Deploy über eine Zeile in `BetriebMessung`. **Uptime-Dienst:** siehe „Für dich zu tun“.

**185 – Aufgabenquellen mit Frist:** Hof wartet 48 h · Erstattung offen 24 h · Mail gescheitert 1 h · wichtige Mail hängt 1 h · neue Meldung 7 Tage · Warnung des Betriebs 1 h bzw. 7 Tage · Uptime still 12 h · Hof ohne Abholzeit nächste Woche (bis Wochenbeginn) · seit 14 Tagen ohne Bestellung 7 Tage. Dazu aus späteren Nummern: Notbremse aktiv (ganz oben, Frist = bis, 189), Abweichung beim Geld 24 h (191), Einzug gescheitert 3 Tage, Rückbuchung sofort, Rechnungsangaben fehlen, Quote „nicht abgeholt“ auffällig (198).

**186 – Notfall-Storno geht in:** PENDING_CONFIRMATION, PAID, CONFIRMED, IN_PREPARATION, READY. Gesperrt bei PICKED_UP, NOT_PICKED_UP, CANCELLED (dieselbe Liste wie beim Hof; dieselbe innere Funktion `storniere`, jetzt in `src/server/stornieren.ts`).

**190 – `ENDGUELTIG_LOESCHEN` für die Anwältin** (Stufe 2 läuft nie, solange `ENDGUELTIG_FREIGEGEBEN = false`):

| Feld / Ablage | warum | bleibt / weg |
|---|---|---|
| Farm.name, ownerName, slug | Name des Hofs und der Person | weg (Platzhalter „Geschlossener Hof“, `geschlossen-<id>`) |
| Farm.description, aboutText, tagline, foundedYear, pauseMessage, adminSperrGrund | Texte des Hofs | weg |
| Farm.address, postalCode, city, Koordinaten, phone, email, betriebsnummer | Kontakt und Lage | weg (Land bleibt) |
| Logo, Titelbild, Ausschnitte, Abschnitte | Bilder des Hofs | weg |
| FarmPhoto, FarmValue, StatusPost, Abos, Postfach-Fäden und Nachrichten, Meldungen samt Bildschirmfoto | Inhalte und Kontakte | weg |
| Product.description, imageUrl, Bildausschnitt | Inhalte | weg (Produktname bleibt für Bestellungen) |
| User email, name, phone, image; Sitzungen, Konten, Passkeys, Geräte, Einmal-Links, Ersatzcodes | Person | weg (Adresse wird `…@geschlossen.invalid`) |
| Ablage `originals/<farmId>/`, `farms/<farmId>/` | Bilddateien | weg |
| Bestellungen, Positionen, Beträge, Monatsabrechnungen, manuelle Verkäufe | Aufbewahrungspflicht | **bleibt** |

**191 – Abgleichszahlen:** Die Vorschau ist nicht gelaufen; aus den Tests: Bestellung 25,73 € gleich bei Stripe → keine Abweichung; Stripe-Gebühr 1,00 € statt 1,23 € → +23 Cent; Stripe erstattet 5,00 €, Datenbank nichts → −500 Cent; Zahlung fehlt bei Stripe → +2 573 Cent. Stripe-Gebühren je Monat: Summe der Saldo-Buchungen je Tag, in Geld als Kachel „Kosten“ und erste Zeile der Kostenliste (Mockup-Monat: 189,00 + 46,50 = 235,50 €; Servicegebühr 321,40 € → Ergebnis 85,90 €).

**194 – Leser der Hof-E-Mail:** mit Rückfall: Bestellmails an den Hof (bezahlt, bar bestätigt), „Nochmal schicken“, Stripe-Konto anlegen. Bewusst ohne Rückfall (öffentlich oder für die Kundin): Bestellseite, Bestätigung, Angaben zum Hof, Profil-Startwert. Liste in `berichte/194.md`.

**196 – Bündel (Client-Chunks):** / 658 660 → 514 267 B (−21,9 %) · /hoefe 719 868 → 569 692 B (−20,9 %) · Hofseite 950 022 → 804 582 B (−15,3 %) · Kasse 581 245 → 422 426 B (−27,3 %). SQL je Hofseite 14 → 11.

**197 – Preis-Anzeigen** (alle mit Endpreis im Modell hofpreis): Hofseite (Karte, Raster, „Aktuell vom Hof“, Seitenspalte, Korb), Produktseite, Entdecken/Startseite, Futter kaufen, Teilen-Bild, Kasse (Korb, Übersicht, Zahlungsschritt), Bestätigung/Bestellseite, Mails (Bestätigung, Vor-Ort, Hof, „Artikel fehlt“). **Drei Körbe (online = bar, vom pruefer von Hand):** 3 × 4,00 € → 12,00 + 0,72 = 12,72 € · 10 × 1,01 € → 10,10 + 0,70 = 10,80 € (6,06 ct je Stück aufgerundet auf 7) · Eier 2 × 4,50 € + Brot 5,80 € → 14,80 + 0,89 = 15,69 € (Brot fehlt → Gebühr −0,35 €, Erstattung 6,15 €). **Vorschau-Bestellungen:** nicht gelaufen (Stichtag, Entscheidung 9).

**198 – Ablauf eines Monats (Testzahlen aus den Tests, Abrechnungstag 3.):** 28 Tage vor dem Einzug Ankündigung (Postfach + Mail, einmal) → am 3. März Abrechnung Februar: bar 72 + 270 = 342 ct (nicht abgeholt, storniert, erlassen zählen nicht), online 72 + 48 = 120 ct → Rechnung online „bezahlt außerhalb“, Rechnung bar per Lastschrift → `invoice.paid` „bezahlt“ · gescheitert → Postfach + Mail, nach `barSperreNachTagen` nur noch online · Rückbuchung → sofort nur online · nach Zahlung wieder frei. März: online 300 ct, bar 0 → nur online. April: bar 48 ct. **Testeinzug, Fehlschlag, Freigabe:** nicht gelaufen – STOPP, solange die Webhook-Ereignisse nicht eingeschaltet sind. **Stripe-Kosten je Rechnung:** bewusst nicht geschätzt; bitte in der aktuellen Preisliste nachsehen (Stripe Invoicing und SEPA-Lastschrift, stripe.com/at/pricing).

Weitere Punkte, kurz:
- 195: „Bestellungen“ in der Hof-Unterleiste bei 320 px abgeschnitten; zwei Lint-Warnungen (`form.watch`) bleiben.
- 197/198: Text „So rechnen wir ab“ auf Deine Konditionen spricht noch von Servicegebühr und Grundgebühr (zur Nacharbeit mit den Rechtstexten).
- 189: Mini-Warenkorb der Seitenspalte zeigt während der Notbremse „Zur Kasse“ (der Server lehnt ab).
- 193: alte Listenlogik aus 187 ohne Aufrufer (`admin-hoefe.ts`, `admin-hoefe-seite.ts`, `admin-reiter.ts`) als eigener Aufräum-Punkt.
- Laufzeit-Test `tests/bild-format.test.ts` (< 500 ms) war unter paralleler Last dreimal rot (583–619 ms), einzeln immer grün. Nicht gelockert; Vorschlag unten.
- Altlast: Die Stripe-Webhook-Route prüft das Ereignis nicht mit Zod und gibt die Meldung der Signaturprüfung im 400-Text heraus.

## Sterne nach Lauf 26 · Admin im Regelbetrieb

Die 16 Kriterien stehen im Projekt-Doc `claude/regelbetrieb-vorschlag-2026-10-26.md`, Abschnitt 9; dieses Doc liegt nicht im Repository und war im Lauf nicht lesbar. Statt Kriterien zu erraten, hier die gebauten Bereiche mit Beleg – bitte die Sterne-Spalte gegen die 16 Kriterien eintragen oder das Doc für den nächsten Lauf beilegen.

| Bereich | gebaut in Lauf 26 | Beleg |
|---|---|---|
| Ein Ort für „was ist zu tun“ | Heute mit 15 Quellen, Fristen, Ziel | 185, 189, 191, 198 |
| Jede Admin-Aktion nachvollziehbar | Protokoll für alle 63 Actions, 5 Jahre, Betrieb › Protokoll mit CSV | 188, 193 |
| Rechte je Person | 8 Rechte, Vorlagen, Inhaber, Einladen | 188, 190 |
| Eingreifen im Notfall | Notfall-Storno, Hof sperren, Notbremse ≤ 72 h | 186, 187, 189 |
| Kundinnen-Anfragen | E-Mail ändern, Auskunft, Konto schließen (Stufe 1) | 190 |
| Geld stimmt | täglicher Abgleich mit Stripe, Monatsabschluss | 191 |
| Plattformgebühr | Hofpreis-Modell, SEPA-Monatsabrechnung, Sperre | 197, 198 (Vorschau-Abnahme offen) |
| Merkt, wenn etwas still steht | `/api/gesund`, Lebenszeichen */15, Alarm-Matrix | 184 (Uptime-Dienst einrichten: offen) |
| Ruhe statt Lärm | Sentry-Lärm NEXTJS-7 weg | 184 |
| Handbuch | Routinen, zehn Notfälle, Wochenlage | 192 |
| Navigation am Handy | Leiste unten, Blatt „Mehr“ | 193 |

## Für dich zu tun

- **Abnahmen in der Vorschau:** Heute; Bestellungen mit Notfall-Storno; Akte mit Sperre; Notbremse auf einer Hofseite; Team einladen; E-Mail ändern; Konto schließen und wieder öffnen; Geld.
- **Admin-Bilder** (alle Admin-Seiten dieses Laufs, 1440 und 390, hell und dunkel).
- **Uptime-Dienst einrichten** (Nr. 184): UptimeRobot → „Add New Monitor“, HTTP(s), `https://agrilo.at/api/gesund`, 5 Minuten; zweiter Monitor `https://agrilo.at/`; App aufs Handy und als Push-Kontakt bei beiden ankreuzen; danach steht in Admin › Betrieb beim Uptime-Dienst „ok“.
- **Liste `ENDGUELTIG_LOESCHEN`** (Tabelle oben) an die Anwältin; erst nach ihrer Freigabe wird Stufe 2 eingeschaltet.
- **Plattformgebühr:**
  - in Stripe (Test, später Live) am Webhook einschalten: `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`, `setup_intent.succeeded`, `mandate.updated`;
  - Rechnungsangaben von Agrilo im Stripe-Dashboard hinterlegen (Firma, UID, Steuer, Fußtext);
  - Hof-AGB-Klausel, Ankündigung an die Höfe und Kundentexte mit der Anwältin klären (vor dem Stichtag 1.2.2027);
  - Steuerfrage für Agrilo (UID, Kleinunternehmer) mit der Steuerberatung klären;
  - Stripe-Kosten je Rechnung in der aktuellen Preisliste nachsehen.
- **Nach dem Merge:** in Admin › Einstellungen › Team prüfen, wer Inhaber ist (2 Admin-Konten in Produktion); den Ablauf `geld-abgleich` einmal von Hand auslösen (sonst meldet das Lebenszeichen ihn bis zum ersten Lauf als fehlend).
- **Merge per Merge-Commit**; danach eine Testbestellung, in Heute und Bestellungen nachsehen.

## Vorschläge für eigene Nummern

- Notfallzugang (`AdminErsatzcode.zweck`, Expand) und WebhookEvent mit Bezug zur Bestellung (Expand) – beide brauchen eine Migration.
- Aufräumen: alte Höfe-Listenlogik (187), tote Postfach-Texte, `zaehleRundschreibenImMonat` (193); Aufgaben-Stand auf /admin nur einmal laden (185).
- Jahr und CSV in Geld mit Stripe-Gebühren (191); Build-Zeit in Betrieb › Version (184).
- Hof-E-Mail-Wache und Profiltexte nachziehen (194, Sollte); „Bestellungen“ bei 320 px (195).
- Bündel-Budget als CI-Schritt (196, Werte im Bericht).

## Regelvorschläge

- Meldungen an Sentry aus Seitenaufbau oder Layout nie „je Instanz“ drosseln, sondern über eine Zeile je Tag (Muster `erstmalsHeute`; Bericht 184).
- Eine Wache, die Bündel betrifft, prüft den Importgraph ab dem ersten `'use client'` (Bericht 196).
- Eine Nummer, die eine Seite umzieht, nennt in ihrer Grenze auch die Stellen, die die Adresse der Seite schreiben, und ihre `loading.tsx` (Bericht 185).
- Laufzeit-Prüfungen in Tests messen relativ (z. B. gegen eine Vergleichsschleife im selben Test) statt mit einer festen Grenze in Millisekunden – sonst sind sie unter Last rot (dreimal in diesem Lauf).
- Geld-Nummern: Pflichtfelder für Beträge je Position statt optionaler Felder mit `?? 0` (Ursache des Blockers in 197).
