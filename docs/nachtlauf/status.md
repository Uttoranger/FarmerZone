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
| 20 | Futter und Brennmaterial | fertig (Entwurf) | `nacht/2026-10-06/20-futter-brennmaterial` | #198 | 22e (#197) | Entwurf bis E10-Texte gegengelesen; (a)–(d) entscheiden; Sperr-Umgehung per Kategoriewechsel behoben | 07.10.2026 |
| 21 | Teilen | fertig (Entwurf) | `nacht/2026-10-06/21-teilen` | #199 | 20 (#198) | Entwurf bis sessionStorage (§ 165 TKG) und Farbwerte im Teilen-Bild freigegeben; Momente „gespeichert"/Abschaltung fehlen (kein Feld) | 07.10.2026 |
| 22a | Kunden und Kundendetail | fertig | `nacht/2026-10-06/22a-kunden` | #194 | 19b (#193) | Marken-Farben freigeben; ILIKE-Altlast customers.ts erledigt | 06.10.2026 |
| 22b | Verkäufe und „Verkauf eintragen" | fertig | `nacht/2026-10-06/22b-verkaeufe` | #195 | 22a (#194) | „Gesamt"-Wort und Vorrat bei Direktverkauf entscheiden | 06.10.2026 |
| 22c | Auswertung und Region | fertig (Entwurf) | `nacht/2026-10-06/22c-auswertung-region` | #200 | 21 (#199) | Entwurf bis Slug `region` in Produktion geprüft; Vorbelegung „Betrieb" offen | 07.10.2026 |
| 22d | Einstellungen | fertig | `nacht/2026-10-06/22d-einstellungen` | #196 | 22b (#195) | Mockup-Abweichungen der Übersicht vor Merge freigeben | 07.10.2026 |
| 22e | Beiträge, Hilfe, Meine Meldungen | fertig | `nacht/2026-10-06/22e-beitraege-hilfe` | #197 | 22d (#196) | E12-Lesart „bleibt und leitet um" bestätigen; Anzeigen der alten Beitragskarte (E-Mail-Zahl) entscheiden | 07.10.2026 |
| 22f | Admin in der AdminShell | fertig (Entwurf) | `nacht/2026-10-06/22f-admin` | #201 | 22c (#200) | Haltepunkt Lauf 5; Entwurf bis „Freischalten ohne Stripe nur bei Online-Wunsch" bestätigt; Bar-Höfe-Blocker behoben | 07.10.2026 |
| 23 | Nachtrag Futter (#198) | läuft | `nacht/2026-10-06/20-futter-brennmaterial` | #198 | main | | 07.10.2026 |
| 24 | Stripe-Pflicht und Admin auf main | offen | | | | | |
| 25 | Teilen nach T1 (#199) | offen | | | | | |
| 26 | Auswertung und Region nach T1 (#200) | offen | | | | | |
| 27 | Konto und Geld, klein | offen | | | | | |
| 28 | Oberfläche und Wortwahl | offen | | | | | |
| 29 | „Betrieb" bei Futter kaufen | offen | | | | | |
| 30 | Teilen-Momente und Abschalten | offen | | | | | |
| 31 | Tab-Wechsel beschleunigen | offen | | | | | |
| 32 | Altlasten Lauf 5 | offen | | | | | |
| 33 | Datenschutzerklärung | offen | | | | | |
