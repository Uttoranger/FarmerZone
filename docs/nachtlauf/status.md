# Status Nachtlauf

Vom Dirigenten gepflegt. Eine Zeile je Nummer aus `docs/nachtlauf.md`. Status: offen · läuft · fertig · übersprungen · gestoppt.

| Nr | Gate | Status | Branch | PR | Basis | Weggelassen / offen | Datum |
|---|---|---|---|---|---|---|---|
| 01 | H1 Abholtermin | fertig | (von Hand) | #163 | main | – | Okt 2026 |
| 02 | H4 Signatur Bestätigung | fertig | (von Hand) | #164 | main | – | Okt 2026 |
| 03 | H3 Bar-Bestätigung | fertig | nacht/2026-10-02/03-bar-bestaetigung | #166 | main | Mail-Text „48 Stunden" im selben PR korrigiert; Mockup-Abweichungen (Untertitel-Grau, Handy-Kopf bis Gate 2, Knopf 44 px) freigegeben | 05.10.2026 |
| 04 | Servicegebühr | fertig | `nacht/2026-10-02/04-servicegebuehr` | #167 | 03 (#166) | Spalten-Default `@default(4.9)` bleibt (Migration nicht freigegeben); Pilothof-Satz im Admin auf 5 % stellen | 05.10.2026 |
| 05 | Bausteine und Shells | fertig | `nacht/2026-10-02/05-bausteine-shells` | #168 | 04 (#167) | Vor Merge: Slug `intern` in Produktion prüfen; Cookie-Hinweis-Änderung und Mockup-Abweichungen freigeben; vorläufige Ziele „Bestellungen“/„Region“ | 05.10.2026 |
| 06 | Schema-Expand | fertig | `nacht/2026-10-02/06-schema-expand` | #169 | 05 (#168) | Geldfelder Variante A, Migrationsweg `prisma migrate diff` freigegeben (freigabe.md §6) | 05.10.2026 |
| 06b | Reservierte Slugs vollständig | fertig | `nacht/2026-10-05/06b-reservierte-slugs` | #170 | main | – | 05.10.2026 |
| 07 | Startseite | fertig | `nacht/2026-10-05/07-startseite` | #171 | 06b (#170) | Lighthouse vom Menschen messen; PLZ-Übergabe an `/hoefe` offen; 13 Mockup-Abweichungen zur Freigabe | 05.10.2026 |
| 08 | Anmelden | fertig | `nacht/2026-10-05/08-anmelden` | #172 | 07 (#171) | 2 Sicherheitsbefunde behoben; Fehler-Token (Kontrast 4,22:1) entscheiden; Konto beim Code-Login, für Nr. 14 eigener Weg | 05.10.2026 |
| 09 | Entdecken | fertig | `nacht/2026-10-05/09-entdecken` | #173 | 08 (#172) | PLZ in URL weggelassen (Regel #130); 9 Mockup-Abweichungen; Startseite-Overlay noch `from-black` | 05.10.2026 |
| 10 | Hofseite | fertig | `nacht/2026-10-05/10-hofseite` | #174 | 09 (#173) | Geld-Blocker und JSON-LD-XSS behoben; Reiter „Beiträge“ bestätigen; Mockup-Abweichungen | 05.10.2026 |
| 11 | Produktdetail | fertig | `nacht/2026-10-05/11-produktdetail` | #175 | 10 (#174) | Grundpreis eine Rundungsstelle; Produktkarten verlinken die Produktseite (Blatt gelöscht); Gate-6-Teile weggelassen | 05.10.2026 |
| 12 | Checkout | fertig | `nacht/2026-10-05/12-checkout` | #176 | 11 (#175) | E5 umgesetzt; E8: Checkout legt weiter ruhendes Konto an (→ 17a); EPS/Wallets im Stripe-Dashboard | 05.10.2026 |
| 13 | Bestätigungen und E-Mails | fertig | `nacht/2026-10-05/13-bestaetigungen` | #177 | 12 (#176) | „Nochmal bestellen“ in Abholbereit-Mail entscheiden; Opt-in ohne Double-Opt-in; Kalender-Route-Altlasten | 05.10.2026 |
| 14 | Konto und Meine Höfe | fertig | `nacht/2026-10-05/14-bestellungen-finden` | #178 | 13 (#177) | laut Freigabe ersetzt durch „Bestellungen finden“ per Code (kein Konto) + /account im neuen Design; Slug `bestellungen` in Produktion prüfen | 05.10.2026 |
| 15 | Für Höfe, Registrieren, Einrichten | fertig | `nacht/2026-10-06/15-fuer-hoefe` | #179 | 14 (#178) | Konditionen entschieden (Register K1 → 17d); S3 freigegeben (→ 17b) | 06.10.2026 |
| 16 | Mein Hof | fertig | `nacht/2026-10-06/16-mein-hof` | #180 | 15 (#179) | erste Route in HofShell (`(hof)`); Handy: Bearbeiten unter Checkliste entscheiden | 06.10.2026 |
| 17 | Heute | fertig | `nacht/2026-10-06/17-heute` | #181 | 16 (#180) | Stripe-Hinweis: Bestandsregel mit Konto statt wörtlicher Gate-Bedingung entscheiden; Teilen abschaltbar → Gate 7 | 06.10.2026 |
| 17a | E8 – Checkout ohne Kundenkonto | fertig | `nacht/2026-10-06/17a-checkout-ohne-konto` | #183 | main | Altlast-Sperre beim Ablehnen; „/account" auf Abos umgedeutet; Name/Telefon nach fremder Registrierung (Vorschlag) | 06.10.2026 |
| 17b | E-Mail-Bestätigung für neue Höfe (S3) | fertig | `nacht/2026-10-06/17b-email-bestaetigung` | #184 | 17a (#183) | Stichtag vor Merge auf Deploy-Tag setzen; Pre-Hijacking-Blocker behoben (HTTP-Registrierung gesperrt) | 06.10.2026 |
| 17c | Slug-Prüfung absichern | fertig | `nacht/2026-10-06/17c-slug-pruefung` | #185 | 17b (#184) | – | 06.10.2026 |
| 17d | Konditionen-Übergang (K1) | fertig | `nacht/2026-10-06/17d-konditionen-uebergang` | #186 | 17c (#185) | Bar-Gebühren vor Stichtag entschieden (B1 → 19a); Satz zweimal auf /fuer-hoefe bestätigen | 06.10.2026 |
| 18 | Produkte | fertig | `nacht/2026-10-06/18-produkte` | #187 | 17d (#186) | Bestandsfehler im Bearbeiten-Dialog mitbehoben; „Verkauf eintragen" mit /sales; Entwurf vs. „Nicht im Shop" | 06.10.2026 |
| 19 | Bestellungen | fertig | `nacht/2026-10-06/19-bestellungen` | #188 | 18 (#187) | 4 Geldpfad-Punkte offen → 19c; `maxDuration` mit Vercel-Plan abgleichen | 06.10.2026 |
| 19c | Geldpfad „Artikel fehlt" nachziehen | fertig | `nacht/2026-10-06/19c-geldpfad` | #191 | main | Stripe-Abo `refund.failed`/`charge.refund.updated` setzen; gescheiterter Voll-Storno nur gemeldet | 06.10.2026 |
| 19a | B1 – keine Bargebühr bis zum Stichtag | fertig | `nacht/2026-10-06/19a-bargebuehr` | #192 | 19c (#191) | Mockup-Abweichungen Kasse/Startseite freigeben | 06.10.2026 |
| 19b | Sicherheits-Altlasten aus Lauf 4 | fertig | `nacht/2026-10-06/19b-sicherheit` | #193 | 19a (#192) | Foto-Upload nach Deploy prüfen; Registrierung: Aufzählung nicht ganz geschlossen | 06.10.2026 |
| 20 | Futter und Brennmaterial | gemergt (#211) | `nacht/2026-10-06/20-futter-brennmaterial` | #198 | 22e (#197) | Entwurf bis E10-Texte gegengelesen; (a)–(d) entscheiden; Sperr-Umgehung per Kategoriewechsel behoben | 07.10.2026 |
| 21 | Teilen | gemergt (#211) | `nacht/2026-10-06/21-teilen` | #199 | 20 (#198) | Entwurf bis sessionStorage (§ 165 TKG) und Farbwerte im Teilen-Bild freigegeben; Momente „gespeichert"/Abschaltung fehlen (kein Feld) | 07.10.2026 |
| 22a | Kunden und Kundendetail | fertig | `nacht/2026-10-06/22a-kunden` | #194 | 19b (#193) | Marken-Farben freigeben; ILIKE-Altlast customers.ts erledigt | 06.10.2026 |
| 22b | Verkäufe und „Verkauf eintragen" | fertig | `nacht/2026-10-06/22b-verkaeufe` | #195 | 22a (#194) | „Gesamt"-Wort und Vorrat bei Direktverkauf entscheiden | 06.10.2026 |
| 22c | Auswertung und Region | gemergt (#211) | `nacht/2026-10-06/22c-auswertung-region` | #200 | 21 (#199) | Entwurf bis Slug `region` in Produktion geprüft; Vorbelegung „Betrieb" offen | 07.10.2026 |
| 22d | Einstellungen | fertig | `nacht/2026-10-06/22d-einstellungen` | #196 | 22b (#195) | Mockup-Abweichungen der Übersicht vor Merge freigeben | 07.10.2026 |
| 22e | Beiträge, Hilfe, Meine Meldungen | fertig | `nacht/2026-10-06/22e-beitraege-hilfe` | #197 | 22d (#196) | E12-Lesart „bleibt und leitet um" bestätigen; Anzeigen der alten Beitragskarte (E-Mail-Zahl) entscheiden | 07.10.2026 |
| 22f | Admin in der AdminShell | ersetzt | `nacht/2026-10-06/22f-admin` | #201 (geschlossen) | 22c (#200) | Code übernommen in Nr. 24 (#203); Lesart „Bar-Höfe freischaltbar" nach Z1 verworfen | 07.10.2026 |
| 23 | Nachtrag Futter (#198) | gemergt (#211) | `nacht/2026-10-06/20-futter-brennmaterial` | #198 | main | Entwurf aufgehoben; genaue BAES-Unterseite eintragen; Abgrenzung neue Bestätigung (Sichtbarkeit/Foto frei, MwSt nicht) bestätigen | 07.10.2026 |
| 24 | Stripe-Pflicht und Admin auf main | gemergt (#211) | `nacht/2026-10-07/24-stripe-pflicht` | #203 | main | ersetzt #201 (geschlossen); Sackgasse für Höfe mit acceptsOnline=false behoben; Höfe ohne Stripe nach Merge ansprechen | 07.10.2026 |
| 25 | Teilen nach T1 (#199) | gemergt (#211) | `nacht/2026-10-06/21-teilen` | #199 | 20 (#198) | Entwurf aufgehoben; kein Browser-Speicher, keine Bestell-Zuordnung | 07.10.2026 |
| 26 | Auswertung und Region nach T1 (#200) | gemergt (#211) | `nacht/2026-10-06/22c-auswertung-region` | #200 | 21 (#199) | Entwurf aufgehoben; Teilen-Karte nur Besuche; Slug `region` frei | 07.10.2026 |
| 27 | Konto und Geld, klein | gemergt (#211) | `nacht/2026-10-07/27-konto-geld` | #204 | main | Neuer Ablauf nach „Konto erstellen" (Postfach-Hinweis, Anmelden über /login); B3 nur bei fremdem Passwort | 07.10.2026 |
| 28 | Oberfläche und Wortwahl | gemergt (#211) | `nacht/2026-10-07/28-oberflaeche` | #205 | main | Fehler-Rot hell deutlich dunkler (O1, auch auf Tönung ≥ 4,5:1) | 07.10.2026 |
| 29 | „Betrieb" bei Futter kaufen | gemergt (#211) | `nacht/2026-10-07/29-futter-betrieb` | #206 | 26 (#200) | Vorbelegung nur über die Adresse; Server prüft weiter | 07.10.2026 |
| 30 | Teilen-Momente und Abschalten | gemergt (#211) | `nacht/2026-10-07/30-teilen-momente` | #207 | 25 (#199) | **Enthält Migration** (Expand: `Farm.teilenMomenteAus` mit Default false) | 07.10.2026 |
| 31 | Tab-Wechsel beschleunigen | gemergt (#211) | `nacht/2026-10-07/31-tab-wechsel` | #208 | main | /orders −12 % Server-JS, „[E-Mail] Init" weg; Admin-/Auswertungs-Ladeansichten kommen mit #203/#200; #204 dafür angepasst (433c546) | 07.10.2026 |
| 32 | Altlasten Lauf 5 | gemergt (#211) | `nacht/2026-10-07/32-altlasten` | #209 | 24 (#203) | gestapelt auf #203 (Servicegebühr-Dialog); Server nimmt Mindestgebühr nur noch als ganze Cent | 07.10.2026 |
| 33 | Datenschutzerklärung | fertig (Entwurf) | `nacht/2026-10-07/33-datenschutz` | #210 | main | Haltepunkt Lauf 6; Entwurf bis rechtliche Prüfung der Tabelle in Bericht 33 | 07.10.2026 |
| 34 | Automatischer Probelauf (Gate 9a) | übersprungen | – | – | main | **Vorbedingung nicht erfüllt:** `STRIPE_SECRET_KEY` ist bei Vercel eine gemeinsame Variable für Vorschau und Produktion (Typ sensitive, Präfix nicht prüfbar) → Vorschau nutzt sehr wahrscheinlich den Live-Schlüssel; Vorschau aus dem Container nicht erreichbar. Keine Zahlung ausgeführt. **Korrektur 08.10.2026:** Das Banner der Vorschau zeigt ‚Stripe Test'; die Annahme ‚sehr wahrscheinlich Live' war falsch. Die Produktion nutzt dieselbe Variable und läuft ebenfalls im Testmodus. (Nachholung als Nr. 48.) | 07.10.2026 |
| 35 | Altlasten aus Lauf 6 | gemergt (#219) | `nacht/2026-10-07/35-altlasten` | #213 | main | Geldpfad, Nachprüfung ohne Befund; keine Migration | 07.10.2026 |
| 36 | BAES-Angaben | gemergt (#219) | `nacht/2026-10-07/36-baes` | #214 | main | Textänderung zum Gegenlesen (§ 8 Abs. 7 FMV); keine Migration | 07.10.2026 |
| 37 | Sentry ohne IP-Adressen | gemergt (#219) | `nacht/2026-10-07/37-sentry-ip` | #215 | main | Sicherheitspfad, zwei Runden, Nachprüfung; Dashboard-Einstellung prüft der Mensch; keine Migration | 07.10.2026 |
| 38 | Double-Opt-in (S11) | gemergt (#219) | `nacht/2026-10-07/38-double-opt-in` | #217 | main | **Migration: ja (Expand)**; Sicherheitspfad, zwei Runden, zwei Nachprüfungen; ein „Sollte" offen (Rückgabetyp); Abonnentenzahl ermittelt der Mensch | 07.10.2026 |
| 39 | Direktverkauf senkt den Vorrat (D1) | gemergt (#219) | `nacht/2026-10-07/39-direktverkauf-vorrat` | #216 | main | Annahmen zur Freigabe (Grundeinheit, auf 0, Aufrunden); keine Migration | 07.10.2026 |
| 40 | Rate-Limit über die Datenbank (R1) | gemergt (#219) | `nacht/2026-10-07/40-rate-limit-db` | #218 | main | **Migration: ja (Expand, neue Tabelle + RLS)**; nach #217 mergen; Datenschutzsatz offen | 07.10.2026 |
| Sammel 7 | Sammel-PR Lauf 7 | gemergt (#219) | `integration/lauf7` | #219 | main | #212–#218 zusammengeführt, keine Code-Konflikte; Gesamtstand grün (5456 Tests, Integration 328); Morgenbericht `morgenbericht-2026-10-07-lauf7.md` | 07.10.2026 |
| 41 | Hof-Anmeldung am Handy und „Mein Hof" (N1) | fertig (PR #221) | `nacht/2026-10-08/41-hof-anmeldung` | #221 | main | Admin ohne Hof: Plakette ohne Link (Freigabe); Mockup-Abweichungen mit Bild; keine Migration | 08.10.2026 |
| 42 | Stripe-Testbetrieb und Modus-Wache (Z2) | fertig (PR #223) | `nacht/2026-10-08/42-stripe-wache` | #223 | main | Geld/Sicherheit: zwei Runden, zwei Nachprüfungen, Doku-Nachzug des Dirigenten; Wache fail-closed (Freigabe); keine Migration | 08.10.2026 |
| 43 | Testumgebung test.farmerzone.at (Z3) | läuft (Nachbesserung Runde 2) | `nacht/2026-10-08/43-testumgebung` | | 42 | Runde 1 (b834f81): Post-Sperre fail-closed; Nachprüfung 1 ohne Blocker/Sollte, ein Sicherheitshinweis (Punkt am Ende der Adresse) → Runde 2 | 08.10.2026 |
| 44 | Rückweg im Hofbereich (N1) | fertig (PR #222) | `nacht/2026-10-08/44-rueckweg` | #222 | main | Schalter mit sofortiger Wirkung bleiben auf der Seite (Freigabe); Doppelung /fehler-melden laut §12; keine Migration | 08.10.2026 |
| 45 | Hofbereich kinderleicht | läuft (Nachbesserung Runde 1) | `nacht/2026-10-08/45-hofbereich` | | main | tester grün; pruefer: 1 Blocker (Satz zur Umsatzgrenze passt nicht zum Code), 4 „Sollte" | 08.10.2026 |
| 46 | Kundensicht kinderleicht (N2) | läuft | `nacht/2026-10-08/46-kundensicht` | | main | | 08.10.2026 |
| 47 | Altlasten aus Lauf 7 und Laufzeit-Befunde | fertig (PR #224) | `nacht/2026-10-08/47-altlasten` | #224 | main | Sicherheitspfad: zwei Runden, zwei Nachprüfungen, Nachzug des Dirigenten (Doku und Tests); E-Mail-Muster im Sentry-Filter mit erneuert (Freigabe); keine Migration | 08.10.2026 |
| 48 | Probelauf (Nachholung von 34) | erledigt (Checkliste), PR #225 — Runde 2 (Teil zu 46) folgt | `nacht/2026-10-08/48-probelauf` | #225 | main | Vorbedingung B nicht erfüllt (Vorschau und api.stripe.com gesperrt, CONNECT 403) → Checkliste; Webhook: unbekannte Bestellung → 200, keine Fehlerflut, kein 48a | 08.10.2026 |
| Sammel 8 | Sammel-PR Lauf 8 | offen | `integration/lauf8` | | main | | |
