# Zwischen-Morgenbericht Lauf 34, Abschnitt A (11.11.2026) · Kasse und Rückbuchung

**Ergebnis Abschnitt A:** Alle fünf Nummern sind fertig, geprüft und gepusht: 283 (Doku), 286 (Hofpreis-Modell ohne Provision, Servicegebühr ab Stichtag gesperrt), 284 (Sicherheits-Updates), 287 (Kasse: Transaktion, Abgleich des Gesamtbetrags, Bremse für Bar-Bestellungen) und 289 (Rückbuchung einer Kundenzahlung). Alle liegen im Zwischenstand `integration/lauf34`; der Sammel-PR [#536](https://github.com/Uttoranger/FarmerZone/pull/536) steht auf „bereit“. Keine Migration, kein neues Paket außer den freigegebenen Sicherheits-Updates aus 284, keine neue Variable.

**Ordnungsgemäß beendet:** ja (Rahmen „Fertig, wenn“: jede Nummer fertig mit CI grün bzw. Build-Beleg, voller Lauf und Integration ganz auf dem Sammelstand grün, Sammel-PR bereit, Aufräumen bestätigt, dieser Bericht). **Ziel erreicht:** ja – alle fünf Nummern fertig, alle Punkte „Fertig, wenn“ erfüllt. Die Vorschau-Prüfungen in „Für dich zu tun“ kann der Container nicht machen.

## Für dich zu tun

- [ ] **Merge:** Sammel-PR [#536](https://github.com/Uttoranger/FarmerZone/pull/536) `integration/lauf34` → main nach Durchsicht per **Merge-Commit** (nicht Squash). Danach die Einzel-PRs schließen (Inhalt dann auf main): [#531](https://github.com/Uttoranger/FarmerZone/pull/531) (283), [#532](https://github.com/Uttoranger/FarmerZone/pull/532) (286), [#533](https://github.com/Uttoranger/FarmerZone/pull/533) (284), [#534](https://github.com/Uttoranger/FarmerZone/pull/534) (287), [#535](https://github.com/Uttoranger/FarmerZone/pull/535) (289).
- [ ] **`charge.dispute.closed` am Stripe-Endpunkt der Plattform einschalten** (Test, später Live). Ohne das Ereignis bleibt eine Aufgabe „Rückbuchung einer Kundenzahlung“ in Heute stehen, bis der tägliche Geld-Abgleich sie abräumt.
- [ ] **Build-Log der Vercel-Vorschau nach dem Paket-Update ansehen** (284: @sentry/nextjs 10.75.2, better-auth und Passkey 1.7.7, zod 4.6.6, nanoid 5.1.16). Die Vorschau zu #533 meldete „Deployment has completed“; Warnungen im Log sieht nur das Vercel-Konto.
- [ ] **Nach dem Merge am echten Stand prüfen** (Geld- und Sicherheitsänderungen): in der Vorschau bzw. auf test.agrilo.at (Stripe-Testmodus):
  - Hofpreis-Modell: Online-Testbestellung bei einem Hof mit Provision > 0; im Stripe-Testmodus ist die Anwendungsgebühr genau die Plattformgebühr, die Bestellung trägt Provision 0,00 (286).
  - Hof mit Passwort, Kundin mit Code, Admin mit Passkey anmelden (284).
  - Kasse: eine vierte unbestätigte Bar-Bestellung mit derselben Adresse wird mit „Bar bestellen geht gerade nicht. …“ abgelehnt (287; die Bremse greift nur in einem Produktions-Bau, also in der Vorschau und auf test.agrilo.at, nicht unter `next dev`).
  - Rückbuchung im Testmodus: Karte 4000 0000 0000 0259 (Streitfall) → Admin › Betrieb › Protokoll „Kundenzahlung zurückgebucht“, Admin › Heute (Geld) „Rückbuchung einer Kundenzahlung“ mit Frist; Karte 4000 0000 0000 1976 (Rückfrage) → „Rückfrage zu einer Kundenzahlung“ / „In Stripe vor der Frist antworten.“; nach Antwort mit `winning_evidence` bzw. `losing_evidence` und `closed`: Protokoll „… · gewonnen“ bzw. „… · verloren“ (Rückfrage: „ohne Rückbuchung beendet (warning_closed)“), Aufgabe weg (289).
- [ ] **Entscheiden (284, Gegenlesen „Sicherheit“):** Soll `createSession` bei `/passkey/verify-registration` serverseitig abgelehnt werden? better-auth 1.7 lässt den Browser beim Einrichten eines Passkeys eine zusätzliche Sitzung ohne Anmeldeart anlegen; sie ist schwächer als die vorhandene (kommt nicht in den Admin). Vorschlag: eigener Auftrag mit Integrationsfall.
- [ ] **Abschnitt B starten**, in einer neuen Sitzung, mit dieser Nachricht (jede Zeile einzeln; die Startsätze von B als eigene Zeilen, nur die, die du freigibst):

Nachtlauf 34 fortsetzen

Konditionen-Satz Kleinbetrag vor Tag T freigegeben

Secrets je Umgebung getrennt

Kaufknopf ohne Betrag freigegeben

Sperre nach Rückbuchung auch per E-Mail freigegeben

  Zum letzten Satz: Er bewirkt nur etwas, wenn die Datei von Abschnitt B (a013-lauf34-b.md, 290 Schritt 3a) schon den von Recht freigegebenen Satz mit Postfach-Verweis trägt. Am geprüften Stand greift 290 Tor T4 (Satz von Recht mit „antworte auf diese Mail“ gegen die Fußzeile der Postfach-Mail) – dann entfällt 3a auch mit dem Satz (Rahmen, Tabelle „Startsätze“). Die Datei von B hat diese Sitzung nach dem Auftrag nicht gelesen. Ohne „Kaufknopf ohne Betrag freigegeben“ entfällt 309 in Lauf 34 ganz; dann gehört der Kaufknopf als eigener /fix vor den Live-Schlüssel.
- [ ] **Board-Korrektur für die Design-Gruppe:** eine Zeile in `docs/nachtlauf/berichte/lauf34-ergaenzungen.md` (Board „kasse“: Hinweis „Der Gesamtbetrag hat sich geändert …“ unter dem Korb, Entsch. C).

## Nummern

| Nr | Inhalt | Status | PR | Vorschau | Migration | Weggelassen / offen |
|---|---|---|---|---|---|---|
| 283 | Doku: Freigabe §38, Register N50 und F027, Warteschlange, Zeitbuch, Ergänzungsliste | fertig | [#531](https://github.com/Uttoranger/FarmerZone/pull/531) | Vercel-Vorschau des PR | nein | – (Kennung F = N50, weil A012 N49 belegt hat) |
| 286 | Hofpreis-Modell ohne Provision, Servicegebühr ab Stichtag gesperrt (E-023) | fertig | [#532](https://github.com/Uttoranger/FarmerZone/pull/532) | Vercel-Vorschau des PR („Deployment has completed“) | nein | – |
| 284 | Sicherheits-Updates @sentry/nextjs, better-auth mit Passkey, zod, nanoid | fertig | [#533](https://github.com/Uttoranger/FarmerZone/pull/533) | Vercel-Vorschau des PR („Deployment has completed“) | nein (Pakete: genau die fünf freigegebenen Versionen) | hohe Treffer in Unterpaketen bleiben (laut Auftrag); `createSession` (oben) |
| 287 | Kasse: Vorrat und Bestellung in einer Transaktion, Abgleich des Gesamtbetrags, Bremse für Bar-Bestellungen | fertig (2 Runden) | [#534](https://github.com/Uttoranger/FarmerZone/pull/534) | Vercel-Vorschau des PR („Deployment has completed“) | nein | Startsatz „Bremse je Hof“: **ja**, Teilschritt 9 gebaut; bekannte Lücke: Zählung je Adresse und Hof ohne Sperre (Bericht) |
| 289 | Rückbuchung einer Kundenzahlung sichtbar machen (E-022) | fertig (1 Runde) | [#535](https://github.com/Uttoranger/FarmerZone/pull/535) | Vercel-Vorschau des PR | nein | Nacharbeit: Rückfrage wird Rückbuchung, `under_review`, Fälle älter als 120 Tage (Bericht) |

Vorher rot (Namen und Ausgaben in den PR-Texten): 286 `tests/servicegebuehr-admin.test.ts`, `tests/plattformgebuehr-checkout.test.ts`, `tests/hof-einstellungen-lauf30.test.ts`, `tests/integration/provision-hofpreis.int.test.ts`; 284 `pnpm audit --prod --audit-level critical` (2 kritisch) und `tests/leistung-196.test.ts` nach zod; 287 `tests/integration/kasse-transaktion.int.test.ts` (Vorrat schon gebucht, während die Bestellung an der Sperre wartet) und `tests/kasse-gesamtbetrag.test.ts`; 289 `tests/plattformgebuehr-abrechnung.test.ts` (23 Fälle).

**Nicht gebaut – Startsatz fehlt:** nichts. Der einzige Startsatz von A („Bremse je Hof für Bar-Bestellungen freigegeben“) stand als eigene Zeile in der Startnachricht. **Verschoben:** keine Nummer. Rahmen §1 3.5 (eine Nummer aus B vorziehen) ist nicht genutzt: 290 und 309 brauchen Startsätze; 285 wäre startbar gewesen, bleibt aber in B, damit der Sammel-PR A klein bleibt und vor dem Live-Schlüssel gemergt werden kann.

## Merge-Reihenfolge

Sammel-PR `integration/lauf34` → main per **Merge-Commit** (nicht Squash). Im Zwischenstand sind in dieser Reihenfolge per `--no-ff` gemergt: 286 (#532), 284 (#533), 287 (#534), 289 (#535); 283 (#531, `docs/lauf34`) ist die Basis. #532 und #533 sind auf `docs/lauf34` gestapelt, #534 und #535 auf `integration/lauf34`. Nach dem Merge des Sammel-PR die fünf Einzel-PRs schließen. Abschnitt B legt danach `integration/lauf34b` von main an; ist der Sammel-PR A noch nicht gemergt, stapelt B auf `integration/lauf34` (Rahmen §1 3.2).

## Geld

- **286 (E-023):** Im Hofpreis-Modell ist die Provision immer 0 (`Order.platformFeeAmount` 0,00), `application_fee_amount` ist allein die Plattformgebühr; was die Kundin zahlt, ändert sich nicht. Modell „bisher“ unverändert. `setServiceFeeAction` lehnt ab dem Stichtag ab: „Ab dem Stichtag gilt die Plattformgebühr. Den Satz änderst du in der Karte ‚Plattformgebühr‘.“ Alle Leser von `platformFeeAmount` lesen den Snapshot. Gegenlesen „Geld“: kein Blocker.
- **287 (N10):** Kein Betrag ändert sich; der Abgleich lehnt nur ab (409 `GESAMT_GEAENDERT`, nichts gebucht) und die Kasse zeigt danach den Betrag des Servers, den der nächste Klick schickt. Vorrat und Bestellung stehen in einer Transaktion; Vorrat ohne Bestellung kann nicht mehr entstehen. Gegenlesen „Geld“: kein Blocker; „Sicherheit“: 1 Blocker (Grenze je Hof ohne `Retry-After`) – in Runde 1 behoben.
- **289 (E-022):** Die App bewegt kein Geld (kein Refund, kein Rückholen des Transfers, kein Schreiben an Stripe, keine Änderung an der Bestellung); der Rechnungszweig (SEPA) ist Zeichen für Zeichen gleich. Gegenlesen „Geld“: kein Blocker.
- **284:** kein Geldpfad berührt; das E-Mail-Muster der Kasse ist Zods neuer Ausdruck mit gleicher Wirkung (300 000 bzw. 19 Mio. Vergleichsadressen ohne Abweichung).
- Register-Vorschläge der Nummern: keine (die Nummern haben nichts für das Register vorgeschlagen).

## Recht

- Kein Recht-Wortlaut geändert: `git diff --name-only origin/main...integration/lauf34 -- prisma/ src/lib/rechtstexte/ src/lib/widerruf.ts docs/recht/ src/lib/konditionen.ts` ist leer. Kaufknopf und Kaufknopf-Sätze unverändert (309 kommt in B). Kein Pflicht-Gegenlesen „Recht“ in Abschnitt A.

## Abnahme

- 287 als „Ergänzung ohne Board“ (`docs/nachtlauf/berichte/abnahme-lauf34.md`): Kasse nach `GESAMT_GEAENDERT` bei 390 und 1440 px, hell und dunkel, mit dem Prüfwerkzeug auf einer lokalen Wegwerf-DB. Bestanden: Hinweis unter dem Korb, Übersicht und Knopf mit dem Betrag des Servers, keine Bestellung; alle sechs Messpunkte erfüllt, axe 0 Verstöße. Zeile in der Ergänzungsliste (Board „kasse“, C).
- 283, 284, 286, 289 ohne Oberfläche: Abnahme über Tests, pruefer, Gegenlesen und Integration (Rahmen 4.1).

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Zeile vor Protokoll bei Webhook-Aufgaben** (289): Der Wortlaut verlangte „erst Protokoll, dann Zeile“. Scheitert die Zeile danach, wiederholt Stripe und das Protokoll steht doppelt; umgekehrt (Zeile zuerst, `protokolliere` wirft nie) gäbe es keinen doppelten Eintrag. Vorschlag: In künftigen Aufträgen „Zeile zuerst, Protokoll nur bei `count === 1`“ vorgeben (wie der Rechnungszweig). Prüfung: ein Test je Webhook-Zweig „gleiches Ereignis zweimal → ein Protokolleintrag“.
2. **Prisma-Attrappe für Routen mit Transaktion** (287): `$transaction: vi.fn(async (f) => f((await import('@/lib/prisma')).prisma))` als eine Zeile in einer gemeinsamen Testhilfe, statt in zehn Dateien von Hand. Ort: tests/fabrik/ oder TESTING_GUIDELINES.
3. **Lange Prüfbefehle nicht mit eigenem `timeout` hinter `flock`** (Dirigent, 289): Ein voller Lauf, der vor `flock` mit `timeout 595` startet, läuft beim Warten auf die Sperre in die Grenze und gilt als rot. Vorschlag: `timeout` innerhalb von `flock` (nur die Laufzeit begrenzen) oder ohne `timeout`.

## Nacharbeit (gesammelt aus den Berichten)

- 284: `createSession` (oben); im Fall „falsches Passwort“ auch die Set-Cookie-Namen vergleichen; `get`/`set` in `AUTH_BREMSE_SPEICHER` sind seit better-auth 1.7 tot (streichen ändert eine Erwartung → eigener Auftrag); nanoid unter postcss 3.3.12 → 3.3.16 durch `pnpm add` (vom Dirigenten angenommen).
- 286: docs/ai/ARCHITECTURE.md „Ladungstypen“ und der Kopfkommentar von `intentParameter` nennen „+ Provision“ ohne „nur im Modell bisher“.
- 287: docs/ai/CODING_STANDARDS.md:148 („Kompensation … wie beim Bestandsabzug“) stimmt nicht mehr.
- 289: Frist-Konstante „+ 7 Tage“ doppelt (src/server/geld-abgleich.ts, plattformgebuehr-abrechnung.ts); Rückfrage, die zur Rückbuchung wird (`charge.dispute.updated`), behält Art und Frist; `under_review` löscht die Zeile vor `closed`; Fälle älter als 120 Tage melden täglich `streit-unbekannt`. Altlast: `WebhookEvent` wird für alle Ereignisse erst nach der Verarbeitung geschrieben.

## Stabilität

- Rechner: 4 Kerne, 15 GB. Node v22.23.4, Unicode 17.0 (die Emoji-Wache war lokal und in der CI grün; die Ausnahme aus §0a 1.7 wurde nicht gebraucht). Start 11.11.2026 18:42 UTC, Haltepunkt A 22:21 UTC (Stunde 3,7).
- Volle Läufe n = 1 unter `schwer.lock`, 3 Worker, 227–362 s je Lauf, mit Integration 683–737 s. Keine Unterbrechung, kein Neustart des Containers.
- Budgets: alle eingehalten (283 bis 18:55; 286 fertig 19:51 statt bis 20:42; 284 fertig 20:05 statt bis 21:42; 287 mit zwei Runden fertig 21:39 statt bis 02:12; 289 mit einer Runde fertig 22:07 statt bis 02:42).
- Abweichungen: 286 hing nach seinem ersten WIP-Commit etwa 40 Minuten ohne laufenden Prozess („wartet auf Hintergrundarbeit“), bis der Dirigent ihn anstieß. Der Dirigent hat eine Uhrzeit im Zeitbuch zuerst geschätzt statt aus `date -u` genommen; im Zeitbuch berichtigt. Zeitweise liefen tester und pruefer zweier Nummern gleichzeitig (auf dem Platz ihrer Nummer, schwere Befehle unter der Sperre).

## Aufräumen

Bestätigt um 22:20 UTC: kein Prüf-Server, kein Prüf-Browser, kein Passkey-Browser, kein dev-Worktree (`$HOME/nachtlauf-dev` weg), Port 3000 frei; Prüf-DBs (`pruef287`, `kopie_1_pruef287`) und alle Integrations-DBs (`fz_int_*`) gelöscht; `.nachtlauf/pruef-env`, `pruef-links.json`, `admin-passkey.json` und Serverprotokolle gelöscht. Die Worktrees unter /home/user/wt/ bleiben bis zum Ende der Sitzung (nur lokal, alles gepusht).

## Bilder

Im Container unter `/home/user/FarmerZone/.nachtlauf/screens/`: `0a/` (Probe agent-browser) und `287/r1/` (Kasse nach `GESAMT_GEAENDERT`, 390 und 1440, hell und dunkel, je mit Messung und axe als JSON, dazu ein Fokus-Belegbild). Nicht committet.

## Wiederaufnahme (für B)

- Zwischenstand `integration/lauf34` (gepusht), Sammel-PR [#536](https://github.com/Uttoranger/FarmerZone/pull/536) (bereit). Keine WIP-Stände, keine verschobenen Nummern.
- B beginnt mit „Nachtlauf 34 fortsetzen“ in einer neuen Sitzung: Zeitbuch und status.md lesen, §0a (ohne 1.2), Doku-Schritt 3.3 („### 38.1 Abschnitt B“), Postgres starten und dem Benutzer postgres ein lokales Passwort setzen, Worktrees neu anlegen, je Worktree `pnpm install --frozen-lockfile` und `pnpm exec prisma generate`.
- Branch-Namen in B weiter `nacht/2026-11-11/<nr>-<kurz>` (Datum des Starts von A).
