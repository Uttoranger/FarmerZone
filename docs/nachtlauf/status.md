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
| 09 | Entdecken | läuft | `nacht/2026-10-05/09-entdecken` | | 08 (#172) | | 05.10.2026 |
| 10 | Hofseite | offen | | | | | |
| 11 | Produktdetail | offen | | | | | |
| 12 | Checkout | offen | | | | | |
| 13 | Bestätigungen und E-Mails | offen | | | | | |
| 14 | Konto und Meine Höfe | offen | | | | | |
| 15 | Für Höfe, Registrieren, Einrichten | offen | | | | | |
| 16 | Mein Hof | offen | | | | | |
| 17 | Heute | offen | | | | | |
| 18 | Produkte | offen | | | | | |
| 19 | Bestellungen | offen | | | | | |
| 20 | Futter und Brennmaterial | offen | | | | | |
| 21 | Teilen | offen | | | | | |
| 22 | Auswerten, Region, Einstellungen, Hilfe, Admin | offen | | | | | |
