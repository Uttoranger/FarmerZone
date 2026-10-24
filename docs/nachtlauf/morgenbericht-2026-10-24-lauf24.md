# Morgenbericht Lauf 24 (24.10.2026)

**Ausgangslage je Nummer am Code bestätigt:** 158 ja · 159 ja · 160 ja · 161 ja · 162 ja · 163 ja · 164 ja · 165 ja · 166 ja, mit einer kleinen Abweichung (nur `bestell-link.ts` hatte ein Zweck-Präfix) · 167 ja. **Migration angewandt (Regel 3):** genau eine, `20261024100000_mail_auftrag` (Expand, Tabelle `MailAuftrag`). Auf frischer DB laufen 35 Migrationen durch, `migrate diff --exit-code` zeigt keinen Unterschied. **Mockups:** alle fünf lagen auf main (e0e258f7), `admin-betrieb-mails` in Fassung 3. Keine Nummer gestoppt oder übersprungen. Kein neues Paket. Zwei neue, optionale Variablen: `RESEND_WEBHOOK_SECRET` (160), `LINK_SECRET` (166). Haltepunkt: Sammel-PR `integration/lauf24`.

Wie in Lauf 23: agent-browser fehlt im Cloud-Container; das einzige Bild des Laufs (165) entstand mit dem vorinstallierten Playwright. Admin-Bilder (161, 162, 167) macht nach der neuen Regel die Projektleitung in der Vorschau.

## PRs

| Nr | PR | Basis | Runden |
|---|---|---|---|
| Doku | [#373](https://github.com/Uttoranger/FarmerZone/pull/373) | main | – |
| 162 | [#374](https://github.com/Uttoranger/FarmerZone/pull/374) | `docs/lauf24` | 0 |
| 163 | [#375](https://github.com/Uttoranger/FarmerZone/pull/375) | `docs/lauf24` | 0 |
| 165 | [#376](https://github.com/Uttoranger/FarmerZone/pull/376) | `docs/lauf24` | 1 |
| 164 | [#377](https://github.com/Uttoranger/FarmerZone/pull/377) | `docs/lauf24` | 2 (Runde 2 vom Dirigenten) |
| 158 | [#378](https://github.com/Uttoranger/FarmerZone/pull/378) | `docs/lauf24` | 2 (Runde 2 vom Dirigenten) |
| 160 | [#379](https://github.com/Uttoranger/FarmerZone/pull/379) | `integration/lauf24` | 0 |
| 161 | [#380](https://github.com/Uttoranger/FarmerZone/pull/380) | `integration/lauf24` | 1 |
| 159 | [#381](https://github.com/Uttoranger/FarmerZone/pull/381) | `integration/lauf24` | 1 |
| 167 | [#382](https://github.com/Uttoranger/FarmerZone/pull/382) | `nacht/2026-10-24/167-basis` (= Zwischenstand e735bcd8) | 0 |
| 166 | [#383](https://github.com/Uttoranger/FarmerZone/pull/383) | `integration/lauf24` | 0 |
| Sammel 24 | Sammel-PR `integration/lauf24` → main (Link im Chat) | main | – |

**Sammel-PR:** `integration/lauf24` = `docs/lauf24` + 162, 165, 163, 164, 158, 160, 161, 159, 167, 166, je `--no-ff`.
- **Konflikte:**
  - `DEVELOPMENT.md`: beide Seiten behalten.
  - `src/lib/betrieb.ts`: 162 machte `GRENZ_TEXT` zur Funktion `grenzTexte(tarife)`; der Eintrag „hofliste“ aus 163 zieht dorthin, Kommentare zusammengeführt.
  - `src/server/aufraeumen.ts`: beide Schritte (Klartext-Token leeren, Mail-Protokoll) und beide Felder behalten.
  - `docs/ai/ARCHITECTURE.md`, Abschnitt „Mails“: alle Absätze aus 159 und 160 behalten.
  - `BAUSTEINE.md` je über `pnpm bausteine`.
- **Dirigent-Fixes am Zwischenstand:**
  - `tests/klartext-token-leeren.test.ts` (164) bekam eine Attrappe für `mailAuftrag` (158). Nur der Test.
  - `tests/integration/verwaiste-bestellungen.int.test.ts` speicherte den Bar-Token im Klartext, den 164 nicht mehr annimmt: Runde 2 von 164, im PR #377.
  - Ein veralteter Kommentar zum Abrechnungszeitraum in `mail-warteschlange.ts`: Seit 162 zählt `summeImMonat` den Zeitraum ab dem 17. schon richtig.
- **Sammelstand:** voll typecheck grün, lint 0 Fehler (5 Warnungen), 564 / 10739 Tests; Integration ganz 81 / 688.
- **CI:** #373–#380, #382 und #383 grün (`ci`, `integration`, Vercel). Bei #381 (159) startete der Workflow `ci`/`integration` nicht (nur Vercel und „erledigt“); 159 ist lokal voll und mit Integration ganz geprüft und läuft in der CI des Sammel-PR mit.

## Bitte entscheiden

1. **Zahlung und Mail-Auftrag in einer Transaktion (159).** Die Freigabe verlangt, den Auftrag in derselben Transaktion einzustellen (Webhook `payment_intent.succeeded`, Bar-Bestätigung). Scheitert das Einstellen deterministisch, z. B. an einer Schema-Prüfung, bleibt eine bezahlte Bestellung bei jeder Stripe-Wiederholung auf PENDING_CONFIRMATION. Das steht in Spannung zu CLAUDE.md §2 („Niemals eine gültige Bestellung wegen eines fehlgeschlagenen Nachlaufs zurückrollen“). **Vorschlag:** den Bezug vor der Transaktion prüfen; bei einem Prüffehler die Zahlung verbuchen und nur Sentry melden.
2. **Beträge im Bezug (159):** Storno, Artikel fehlt und Zahlung zu spät tragen den von Stripe erstatteten Betrag als Cent-Ziffern, Storno zusätzlich den Stand `erstattung`. N26 und die Freigabe sagen „nur Kennungen“, aber ohne Betrag müsste die Mail neu rechnen.
3. **`betreiber-bestaetigung` bleibt Sofort (159),** obwohl die Freigabe sie unter Wichtig nennt. Ihr Token liegt nur als Hash vor, deshalb kann ein Renderer den Link nicht neu bauen.
4. **Nochmal schicken auch bei `ohne_schluessel`, `gesperrt` und `verworfen` (167).** N27 sagt „nur für eine Mail, die schon hinausging“. In der Vorschau steht aber jede Mail als `ohne_schluessel`, und die Abnahme ginge sonst nicht.
5. **/verify, Punkt 2 von 164:** Umgesetzt ist der Fehlerzustand der Bestätigungskarte. Der Zustand „abgemeldet ohne Token“ in `verify/page.tsx` (~Z. 88) ist unverändert, denn die Seite weiß dort nicht, ob die Adresse bestätigt ist. War dieser gemeint, ist es ein kleiner Folgepunkt.
6. **Hofliste aufteilen (163),** nach den Messwerten unten.
7. **Leerer Korb ohne Grund (165, Fund):** Fällt durch die Prüfung alles aus dem Korb, zeigt die Kasse nur „Dein Korb ist leer“, ohne den Grund. Bei „alles ausverkauft“ ist es heute genauso. Vorschlag für eine eigene Nummer: `korbHinweis` auch im leeren Zustand zeigen.

## Zu einzelnen Nummern

**158 – Warteschlange.**
- `batch.send` (resend 6.12.4) nimmt `headers` je Mail und einen Idempotenz-Schlüssel je Anfrage. Gewählt ist strikte Prüfung; bei 4xx auf den Stapel gehen die Mails einzeln.
- Lasttest (echtes Postgres, Resend-Attrappe): 5.020 Mails in 10,2 s (≈ 494 Mails/s), alle 20 wichtigen im ersten Stapel, keine doppelt, keine verloren.
- Grenze des Workers: 100 je Stapel × 5 Anfragen/s = 500 Mails/s bzw. 30.000/min. Die echte Grenze ist das Kontingent (Resend Free 100/Tag, 3.000 im Abrechnungszeitraum).
- Runde 2 (Dirigent):
  - Ergebnisse werden nur mit der eigenen Belegung geschrieben; vor jeder Anfrage an Resend müssen noch 30 s übrig sein.
  - Ein abgebrochener Lauf geht mit dem Stapel-Schlüssel seines ersten Versuchs.
  - Seltene Doppelversand-Fälle bleiben, sie wären nur mit einer Schema-Änderung zu schließen: Teilung durch das Seitenlimit, weggefallene Mail beim neuen Rendern, 409 bei gleichem Schlüssel mit anderem Inhalt, zwei Abbrüche nacheinander.
- Cron jede Minute bei Vercel Pro: Die Tarif-Tabelle war von hier nicht abrufbar. Nach dem Deploy in Vercel › Cron Jobs prüfen.

**159 – Mail-Arten und Wege:**

| Weg | Arten | `bestellungId` |
|---|---|---|
| Sofort (direkt, nur Protokoll) | anmeldecode, bestellcode, login-link, passwort-link, email-bestaetigung, registrierungs-hinweis, admin-sicherheit, neue-anmeldung, zu-viele-versuche, betrieb-warnung, testmail, betreiber-bestaetigung | nein |
| Sofort | bar-bestaetigungslink | ja |
| Wichtig, zu Bestellungen | bestellung-bestaetigung, bestellung-bezahlt-hof, bar-bestaetigt-hof, abholbereit, nicht-abholbereit, storniert, artikel-fehlt, verfallen, zahlung-zu-spaet | ja |
| Wichtig, an Betreiber/Höfe | erstattung-offen (mit Bestellung, wo bekannt), neuer-hof, freischaltung, meldung, wochenbericht, postfach, antwort-an-team, betreiber-testmail, abo-bestaetigung | nein |
| Kann warten | beitrag, rundschreiben, bescheid | nein |

**161 – Abweichungen vom Mockup:**
- Nochmal-Knöpfe und der Link „Alle Mails · 90 Tage“ kamen erst mit 167.
- Ein Teilfehler steht als orange Hinweiskarte statt `AdminFehler`, weil `AdminFehler` eine zweite h1 bringt.
- Zahlen im Hausformat, Wortlaut der Regel-Zeile, Kopf am Handy.
- `src/app/admin/betrieb/loading.tsx` ist gelöscht: Die `loading-filter-wache` verbietet ein Skelett auf Seiten mit Filtern in der Adresse.

**162:** Supabase Pro (8 GB, „kostet ab dann extra“), Abrechnungszeitraum der Mails ab dem 17., 0 Uhr UTC (Tabelle der Grenzen im PR), Vercel-Karte in drei Fällen. Resend Pro ist vorbereitet (`mailsTag: null`); das Umschalten ist eine Zeile.

**163 – Hofliste** (erfundene Höfe mit je 20 Produkten und Foto): 50 Höfe 595.736 B (≈ 0,6 MB), 200 Höfe 2.391.054 B (≈ 2,4 MB), 500 Höfe 5.987.965 B (≈ 6,0 MB).
- Das sind ≈ 12 KB je Hof; **2 MB sind ab ≈ 167 Höfen erreicht.** Next prüft am verpackten Eintrag, die echte Reserve ist also kleiner.
- **Vorschlag „Hofliste aufteilen“:** ein schlanker Eintrag „Höfe“ (Karte, Abholzeile, bis zu drei Vorschau-Produkte), die Produktzeilen je Region oder je Hof als eigene Einträge. Dann erneuert eine Bestellung nur ihren Hof.
- Abweichung vom Mockup: Die fünfte Kachel „Hofliste“ bricht ab 1024 px in eine zweite Reihe.

**164 – Klartext-Token:** In der lokalen Bilder-DB trifft das Aufräumen 0 von 20 Bestellungen. Die Produktion ist nicht gezählt, siehe „Für dich zu tun“.

**165 – Reihenfolge der Prüfungen:**
- `/api/reserve`: Speicher je IP → Parsen → Speicher je Sitzung → `reserveIp` → Fristfreigabe → Aufräumen → Produkt → Prüfkette (Stilllegung → Freischaltung → Pause → Kaufsperre) → Bestand → `upsert`.
- `/api/warenkorb/pruefen`: Speicher je IP → Parsen (mit `MAX_MENGE`) → `reserveIp` → Fristfreigabe → Prüfkette je Hof → Abgleich → Erneuern/Löschen.
- Bild: `docs/nachtlauf/berichte/bilder/165/korb-blatt-pausiert-390-hell.jpg`, in der Kasse aufgenommen; das Korb-Blatt ruft die Prüfung nicht auf.

**166:** Alte Links gelten mit und ohne `LINK_SECRET` (feste Altwerte im Test). Die neuen Signaturen tragen die Kennung `2.` und ein Präfix je Zweck. Bremsen-Schlüssel und Bar-Token-Hash sind unverändert. Der Tausch mit Kennung 3 steht in ARCHITECTURE.

**167 – Nochmal-Listen:**

| nochmal erlaubt | nie |
|---|---|
| bestellung-bestaetigung, abholbereit, nicht-abholbereit, storniert, artikel-fehlt, verfallen, zahlung-zu-spaet, bestellung-bezahlt-hof, bar-bestaetigt-hof, freischaltung, bar-bestaetigungslink (neuer Token) | anmeldecode, bestellcode, login-link, passwort-link, email-bestaetigung, abo-bestaetigung, registrierungs-hinweis, admin-sicherheit, neue-anmeldung, zu-viele-versuche, betrieb-warnung, betreiber-bestaetigung, testmail, betreiber-testmail, erstattung-offen, neuer-hof, meldung, wochenbericht, postfach, antwort-an-team, beitrag, rundschreiben, bescheid |

Abweichungen von der Beschreibung:
- „Erstattung“ an die Kundin hat keine eigene Art.
- Nicht genannte Arten stehen unter „nie“.
- Stände: siehe Entscheidung 4.
- „Kann warten“ steht als eigene Summen-Karte.
- Die Filter sind `select`-Felder in einem GET-Formular.
- Die Vorschau öffnet erst auf Knopfdruck.

## Grenzen erweitert (Dirigent)
- **163:** `abholfenster.ts` (Export `belegung`), `betrieb-teile.tsx` (Symbol der Kachel), `src/server/betrieb.ts` (`grenzStand`/`trendFuer`).
- **165:** `tests/kaufsperre-wache.test.ts` (zählt `kaufSperre(` in der reserve-Route).
- **164:** `src/server/queries/farm.ts` (`country`), `pickup-slot-rules.ts`, `laender.ts`, `bestaetigen-karte.tsx`, `hof-anmeldung.tsx`, Kommentare der Barbestätigung.
- **158:** `src/lib/email.ts` (`versendeStapel`, `hatResendSchluessel`, `baueBeitragMail`), `src/server/beitrag-vorname.ts` mit `status-posts.ts` (Vorname an einer Stelle).
- **160:** `src/schemas/resend-ereignis.ts`.
- **161:** `loading.tsx` gelöscht; `src/lib/betrieb.ts`, `src/server/betrieb.ts`, `src/server/queries/betrieb.ts`, Cron-Route, `betrieb-teile.tsx`, `src/schemas/betrieb-mails.ts`.
- **159:** `src/schemas/mail-auftrag.ts`, `src/lib/erstattung-offen.ts`, drei Lese-Abfragen für „n per E-Mail“, `cron/briefkasten`.
- **167:** `src/lib/email.ts` (`onsiteConfirmationInhalt`, `farmId` im Bar-Link-Protokoll), `src/schemas/betrieb-mails.ts`, ein Export in `mail-arten/bestellung.ts`.
- **166:** `src/schemas/bestaetigung.ts` und `src/schemas/abo.ts` (`sig` mit `2.`).
- **Sammel-PR** (docs: Commit): ARCHITECTURE-Satz zu signierten Links auf die drei Links eingeschränkt; offener Rest ist der Double-Opt-in-Link.

## Regelvorschläge
- **Dirigent:** Ändert eine Nummer einen gemeinsamen Schutz (Bar-Token, Aufräumen, Prüfkette), läuft die ganze Integrationssuite, nicht nur die eigene Datei. In Lauf 24 hielt zweimal ein Test aus 164 den Zwischenstand auf. Ort: docs/nachtlauf.md 4a Punkt 3.
- **Dirigent:** Den PR einer gestapelten Nummer immer vor dem Push des Zwischenstands öffnen, sonst braucht er einen eigenen Basis-Branch (167). Ort: 4a Punkt 9.
- **158/160:** Ein `updateMany` mit berechnetem Spaltenschlüssel ließ tsc an den Speicher laufen; je Spalte ausschreiben (CODING_STANDARDS).
- **159:** Ein Betrag, der beim Ereignis feststand, geht als Cent-Ziffern unter `…Cents` in den Bezug (siehe Entscheidung 2).
- **161:** Erweitert eine Nummer eine Admin-Seite um Parameter in der Adresse, gehört deren `loading.tsx` in die Grenze.
- **166:** Ändert eine Nummer das Format eines Werts in der Adresse, gehören die Zod-Schemas dieses Parameters in die Grenze.
- **167:** Eine neue Mail-Art nennt ihre Nochmal-Liste im selben Commit (CODING_STANDARDS §4).

## Nicht begonnen
Keine. Alle Nummern aus §1 sind gelaufen.

## Nacharbeit („Sollte“)
- **158:** Das Aufräumen setzt abgelaufene „in Arbeit“ auf offen und löscht damit das Abbruch-Kennzeichen (streichen oder erst nach einer Stunde); `zaehleMail` ohne Menge; Kommentar in `betrieb-zaehler.ts`.
- **159:** „Artikel fehlt“ stellt nach dem Schreiben ein (Transaktion in `artikel-fehlt.ts`); „Erstattung offen“ wird nach der Antwort eingestellt; `ladeMailEmpfaenger`/`ladeAntwortFuerTeam` ohne Aufrufer; nach 90 Tagen fällt „n per E-Mail“ auf die Zahl der Aufträge zurück.
- **160:** `leseBegrenzt` doppelt; `.env.example` ohne `RESEND_WEBHOOK_SECRET` und `LINK_SECRET`; Abmelden hängt an „`aboId` im Bezug“; jedes `email.bounced` gilt als hart.
- **161:** In der Cron-Route `pruefeAblaeufe` und `pruefeMailWarnungen` je für sich absichern; „Jetzt schicken“ in der Warnkarte nur bei offen/gescheitert; das n auf „Alle n …“.
- **162:** `grenzStandText('mailsMonat')` sagt noch „in diesem Monat“; Tests für `FUSS_MAILS_MONAT` und den Satz zur Ablaufregel; ARCHITECTURE Abschnitt Betrieb ohne Abrechnungszeitraum.
- **164:** Den Satz zum Stripe-Land auch bei „neu einrichten“ zeigen.
- **165:** `erneuereHalte` schreibt per `upsert` ohne Bestandsbedingung (Altlast).
- **166:** Der Double-Opt-in-Link signiert noch mit `BETTER_AUTH_SECRET`; Testlücke beim Nachbestell-Token ohne `LINK_SECRET`.
- **167:** Kasse und „Erneut senden“ erzeugen den Bar-Token weiter selbst statt über `neuerBarToken()`; die 3-mal-Grenze beim Bar-Link zählt über eine Protokollzeile (fail-open); „Alle nochmal schicken“ mit bis zu 300 Abfragen; `AlleMailsFilter` von Hand statt `z.infer`.

## Zeitbuch
`docs/nachtlauf/berichte/zeitbuch-lauf24.md` (4 Kerne; je Nummer volle Läufe mit n und Workern, Integration, Runden; drei Sätze).

## Für dich zu tun
- [ ] **Abnahmen in der Vorschau** (ohne Mail-Versand, dort fehlt `RESEND_API_KEY`):
  - 159: Barbestellung und Beitrag → Aufträge als `ohne_schluessel` in Admin › Betrieb › E-Mails.
  - 165: Hof im zweiten Tab pausieren → „Verfügbarkeit neu prüfen“ gibt die Ware frei.
  - 167: Bestellnummer suchen, Vorschau mit unkenntlichen Links, „Nochmal schicken“ → Zeile „vom Support“.
  - 162: Datenbank-Kachel „von 8 GB“, Vercel-Karte „Noch keine Meldung …“.
  - 163: fünfte Kachel.
- [ ] **Admin-Bilder** 161, 162, 167 bei 1440 und 390 px, hell und dunkel, in die PRs.
- [ ] **160:** Webhook bei Resend anlegen (`https://agrilo.at/api/webhooks/resend`; `email.delivered`, `email.bounced`, `email.complained`) und `RESEND_WEBHOOK_SECRET` in Vercel nur für Production setzen. Bis dahin antwortet der Endpunkt 503.
- [ ] **166:** `LINK_SECRET` erst in Preview setzen (eigener Wert, ≥ 32 Zeichen), eine Bestellung durchspielen, dann Production mit eigenem Wert.
- [ ] **164:** In der Produktion nur lesend zählen, wie viele Klartext-Token das Aufräumen leert: `SELECT count(*) FROM "Order" WHERE "confirmationToken" IS NOT NULL AND "confirmationToken" NOT LIKE 'h1:%';`
- [ ] **162:** Resend Pro buchen, dann `TARIFE.resend` umschalten lassen (eine Zeile).
- [ ] **158:** Nach dem Deploy in Vercel › Cron Jobs prüfen, dass `/api/cron/mails` jede Minute läuft.
- [ ] **Merge:** den Sammel-PR per Merge-Commit (nicht Squash). Die Migration geht dabei über `vercel-build` in die Produktion. Danach in der Produktion: Admin › Betrieb › E-Mails ansehen, eine Testbestellung mit Stripe im Testmodus aufgeben, ihre Bestellnummer in der Suche → Mails gesendet und zugestellt.
- [ ] **Entscheidungen** 1–7 oben, die Regelvorschläge, und ob die Nacharbeit eine eigene Nummer bekommt.
