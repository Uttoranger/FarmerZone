# Bericht A011 · Probelauf-Checkliste neu gefasst

Auftrag der Projektleitung vom 10.11.2026 (/fix, nur Dokumente). Geschrieben gegen `main` 260f8cf9 (nach #508 Lauf 33 und #448 Impressum). Branch `claude/peaceful-shannon-oqu0hx`, PR #528 gegen `main`, nicht gemergt.

## 1. Was geändert wurde

- `docs/nachtlauf/probelauf-checkliste.md`: neu geschrieben (gleicher Pfad). Kopf mit „Wozu“, „Was du brauchst“, Testkarten und Test-IBANs, Grundregeln, Aufteilung auf drei Sitzungen und „Beträge auf einen Blick“ mit Rechenweg in Cent für beide Modelle; dann Teil A (vor dem Umschalten, A0–A6), Teil B (Tag danach, B1–B6), Teil C (Monatsabrechnung und was weiter gilt, C1–C5), Ergebnis-Tabelle mit eigenen Zeilen für Abnahme 197, Abnahme 198 und Generalprobe 259. Jeder Abschnitt hat eine geschätzte Dauer. Nur noch `test.agrilo.at` und `agrilo.at`.
- `docs/betrieb/stripe-live.md`: §2 nennt jetzt `card_payments`, `transfers` und `eps_payments` (wie `src/server/actions/stripe-connect.ts`); §9 „Zuerst EIN Hof“ hat den Satz, im Stripe-Dashboard auch die aktiven EPS-Zahlungen zu prüfen. Sonst nichts in der Datei.
- `DEVELOPMENT.md`: ein Eintrag (Was, Warum, drei Teile, Dev-DB bleibt im neuen Modell, Monatsabrechnung ohne Auslöser in der Testumgebung).
- `docs/nachtlauf/status.md`: Zeile A011 mit „PR offen“.
- Dieser Bericht.

Kein Code, kein Test, keine Migration, kein Paket, keine Variable, nichts an Vercel, Stripe oder der Datenbank.

## 2. Kästchen

| | alt | neu |
|---|---|---|
| Kästchen (`- [ ]`) | 233 | 125 |
| Zeilen | 741 | 521 |

Die Ergebnis-Tabelle hat keine Kästchen mehr (früher je Ablauf drei: bestanden / Fehler / ausgelassen – allein das waren 54).

## 3. Weggefallen oder zusammengelegt – Grund

| Alt | Neu | Grund |
|---|---|---|
| §1 „Ein Test-Schlüssel für Vorschau und Produktion“, Webhook der Testumgebung einrichten | A0 (Webhook nur ansehen), C5 | Die Testumgebung ist seit 30.10.2026 eingerichtet (`testumgebung.md`); einrichten ist nicht mehr Teil des Probelaufs. |
| §2 Testhof aus Seed-Konto vorbereiten | A1 neuer Testhof ab Registrierung | Auftrag: neuer Hof von der Registrierung bis zur Freischaltung; alte Test-Konten haben ggf. keine EPS-Fähigkeit. |
| §2 Admin › Finanzen „S“ und „V“ notieren, §3 Finanzen-Unterschiede | entfallen | Die volle Gebührenprüfung des alten Modells entfällt (Register N40); nach dem Stichtag entsteht keine neue Bestellung darin. Das Geld neu prüft B3/B6 an Stripe und C2 an Admin › Geld. |
| §2 `STRIPE_LIVE_AB` nur für Production | entfallen | Testzahlungen-Stichtag (Nr. 55) ist eine Einstellung der Produktion, kein Probelauf-Schritt; `stripe-live.md` §10 behandelt ihn. |
| §3 Beträge alt (A–G) | „Beträge auf einen Blick“, beide Modelle | Altes Modell nur noch für V1–V5 (Anzeige, Abholen, Storno, Artikel fehlt, Mail-Anhang 0.9, „Erneut bezahlen“). |
| Abläufe 1–3 (Karte, 3-D Secure, Wallet, EPS) | B3 H1–H3 | Im neuen Modell geprüft; Wallet entfällt als eigener Ablauf (hängt an Gerät und Apple-Pay-Domain, kein Geld- oder Rechtsunterschied zur Karte). |
| Ablauf 4 (bar ohne Servicegebühr) | A3 V3, B2, B3 H4 | B1-Regel nur noch für Altbestellungen; neu: bar mit demselben Endpreis. |
| Ablauf 5 (bar verfällt) | C4 | gekürzt. |
| Ablauf 6 (Futter) | A1, B4, C4 | Futter trägt jetzt auch „Abholung nach Absprache“ und Rücksendekosten. |
| Ablauf 7, 8, 9 (Artikel fehlt, Storno, Abgeholt, Nicht abgeholt) | B2 (alt), B6 (neu) | je Modell einmal. |
| „Heute eingenommen“ | entfallen | Kennzahl ohne Geld- oder Rechtsfolge; Auswertung ist durch die Boards (Lauf 33) geprüft. |
| Ablauf 10 (Bestellungen per Code) | C4 | gekürzt. |
| Ablauf 11, 12 (Produkt am Handy, Teilen, QR) | C4 | gekürzt, Wörter an Lauf 33 angepasst. |
| §5 Hof-Anmeldung am Handy, Startbildschirm-Installation | C4 (Anmeldung, Unterleiste) | Installation auf den Startbildschirm entfällt: ohne Geld, Recht oder Sicherheit. |
| §6 Rückweg | entfallen | reine Navigation, durch die Boards (Lauf 33) abgelöst. |
| §7 Unbekanntes Hof-Konto | C4 | Schritt, auf den `stripe-live.md` §0 verweist; SQL nur Dev-DB. |
| §8 Testbetrieb-Hinweise | C4 | nur ansehen. |
| §9 Kasse, Neuigkeiten, Cookie-Hinweis, `/hoefe`-Suche | B4, C4 | Cookie-Hinweis und Suche auf `/hoefe` entfallen: ohne Geld, Recht oder Sicherheit. |
| §9a Hofbereich, Hofseite, Karte am Handy (Nr. 49–55) | entfallen bis auf C4 | Oberfläche durch Lauf 33 neu gebaut und dort abgenommen. |
| §10 Abschluss | C5 | |
| – | neu: A4 Notbremse, A5/A6/B1 Generalprobe, B4 Kasse und Recht, B5 Rücktritt, C1–C3 Monatsabrechnung | Nr. 189, 197, 198, 200, 202, 207, 211, 214, 215, 256, 257, 259. |

Keine Prüfung zu Geld, Recht oder Sicherheit ist weggefallen: Geldwege beider Modelle (Zahlung, Teilerstattung, Storno, nicht abgeholt) mit Stripe-Blick, Banner-Haken vor jedem Geldschritt, Rechtssätze und Belehrung, Rücktritt, unbekanntes Konto, Testbetrieb-Hinweise, Webhooks und Sentry sind drin.

## 4. Abweichungen des Codes vom Auftrag (es gilt der Code)

Belegstellen aus „Ausgangslage“ am Stand 260f8cf9 geprüft. Inhaltlich stimmen alle; verschoben sind:

- `pruefeHofpreisStichtag` steht in `src/lib/plattform-einstellung.ts:421` (Auftrag: :395).
- `ZAHLUNGSFRIST_ONLINE_MINUTEN` steht in `src/lib/fristen.ts:34` (Auftrag: :33).
- `mindestbestellwertHinweis` steht in `src/lib/plattformgebuehr.ts:500` (Auftrag: :490).
- `ladePlattformEinstellung` mit `unstable_cache` ohne Ablauf: `src/server/queries/plattform-einstellung.ts:60–61` (wie im Auftrag).
- Recht und Passkey des Stichtags in der Action: `src/server/actions/plattform-einstellung.ts:115` (`verlangeAdminAktion({ frisch: true, recht: 'geld' })`).

Abweichungen im Verhalten, die die Liste berücksichtigt:

1. **Testhof ohne Gründungsplatz.** „Als Testhof markieren“ nimmt den Hof aus der Gründungs-Vergabe. Ohne „Einzug ab“ beginnt sein Einzug am Stichtag; ohne Lastschrift gäbe es dort ab dem ersten Tag kein Bar. Die Liste stellt den Einzugsbeginn in B3 deshalb selbst ein (erst in einem Monat → „erlassen“, dann heute → bar nur mit Lastschrift).
2. **Seed-Höfe** sind meist Gründungshöfe: Für C2 braucht der Seed-Hof „Einzug ab“ = heute, sonst wird seine Bargebühr erlassen und nicht abgerechnet.
3. **„Abholung nach Absprache“ gibt es nur bei Futtermitteln** (Chip im Abschnitt „Abholung“); die Liste setzt sie auf Test-Heu.
4. **„Kein Rücktritt“ ist bei Eiern vorbelegt**; Test-Eier sind deshalb das Produkt mit Rücktrittsausnahme, Rundballen das mit Rücksendekosten.
5. **AGB-Karte:** Nach „Ich stimme den AGB zu“ lädt die Seite neu, es gibt keinen Toast (der Text `gespeichert` ist nicht in Gebrauch).
6. **`/konditionen`** hat in beiden Modellen keine „Entwurf“-Marke mehr (`entwurf: null`); der Punkt in B1 prüft nur, dass das so bleibt.
7. **A6, Link `/agb/0.9`:** Der Snapshot der Bestellung bestimmt die AGB-Fassung nur auf dem Weg „Erneut versuchen“ von der Bestätigungsseite. Nach einer abgelehnten Karte bleibt die Kasse auf demselben Seitenstand; ihr „Erneut bezahlen“ zeigt die Sätze vom Zeitpunkt des Seitenaufbaus. A6 nimmt deshalb eine gescheiterte EPS-Zahlung, die auf die Bestätigungsseite zurückführt.
8. **„Zurückgebucht“ hebt sich nicht von selbst auf.** `invoice.paid` ändert nur „offen“, „gescheitert“ und „in Arbeit“; einen Admin-Weg, der „zurückgebucht“ zurücksetzt, gibt es nicht. „Nach der Zahlung von selbst wieder frei“ gilt also nur nach gescheiterter oder offener Rechnung. C3 sagt das ausdrücklich.
9. **Rechnung per Lastschrift nimmt nur SEPA** (`payment_settings.payment_method_types: ['sepa_debit']`): „Jetzt bezahlen“ auf Stripes Rechnungsseite geht nur mit einer IBAN, nicht mit Karte.
10. **Monatsabrechnung:** Es gibt weiterhin keinen Auslöser im Admin; einziger Aufrufer von `rechneMonatsabrechnungen` ist `src/app/api/cron/monatsabrechnung/route.ts` (täglich 05:30 UTC laut `vercel.json`). Der Lauf rechnet nur Höfe mit heutigem Abrechnungstag und nur den Vormonat, Bar nach `pickedUpAt` (Wiener Monatsgrenzen). Er verschickt dabei auch die Ankündigungen an alle Höfe, deren Einzug in höchstens 28 Tagen beginnt. C2 beschreibt den Notweg (eigenes `CRON_SECRET` nur für `staging`).
11. **Testbetrieb-Hinweise** gibt es weiterhin, alle drei (`src/lib/stripe-modus.ts`).

## 5. Ungeprüft

- **Stripe-Testseite nicht erreichbar:** `docs.stripe.com` ist aus dieser Sitzung gesperrt, die Stripe-Doku-Suche lieferte die Tabelle der SEPA-Test-IBANs nicht. Die IBANs `AT321904300235473204` (gelingt nach etwa drei Minuten) und `AT861904300235473202` (scheitert) stammen aus dem Auftrag (dort am 09.11.2026 geprüft), `AT611904300234573201` aus der alten Liste. **Die Rückbuchungs-IBAN ist nicht aufgenommen**; die Liste sagt „von der Stripe-Testseite nehmen“.
- **Stripe-Verhalten und Wartezeiten:** wann ein scheiternder Lastschrift-Einzug im Testmodus `invoice.payment_failed` auslöst und ob Stripe es im Testmodus erneut versucht (hängt an den Einstellungen „Smart Retries“ im Dashboard); ob Stripe zur Rechnung eine Mail schickt (Dashboard-Einstellung, nicht im Repo); die Beschriftungen auf Stripes EPS-Testseite (Bestätigen/Scheitern lassen) und im 3-D-Secure-Fenster („Complete“); die Anzeige „im Namen von“ / „on behalf of“ im Dashboard.
- **Vercel:** dass die Kopfzeile `x-vercel-protection-bypass` beim Aufruf der Cron-Route die Sperre öffnet (laut Vercel-Doku so vorgesehen, hier nicht ausprobiert); ob für Preview bereits ein `CRON_SECRET` gesetzt ist.
- **Seed-Daten:** ob der verwendete Seed-Hof noch keine Zustimmung zu 1.0 hat (B1) und ob er Gründungshof ist (C1 setzt „Einzug ab“ deshalb immer).
- Nichts davon im Browser ausprobiert; die Liste ist aus dem Code geschrieben.

## 6. Nur die Projektleitung kann klären

- **Notbremse am echten Abend vor T** (Bericht 259) und **A6** schließen sich aus: Mit gesetzter Notbremse über Mitternacht entsteht keine Bestellung, die A6 prüfen könnte. In der Generalprobe wird die Notbremse deshalb in A4 geübt und vor A6 gelöst. Bitte bestätigen, dass das so gewollt ist.
- **Auslöser für die Monatsabrechnung** in der Testumgebung (eigener Auftrag): Bis dahin gilt der Notweg in C2 mit eigenem `CRON_SECRET` für `staging`.
- **Rückbuchung (`zurueckgebucht`)**: kein Weg zurück in der App – soll es einen Admin-Weg geben?
- **Hofseite „Zahlung & Kontakt“** sagt „Online bezahlen oder bar bei Abholung.“, auch wenn bar beim Hof gerade nicht geht (kein Mandat, Sperre). Die Kasse ist richtig. Befund, nicht behoben.
- **Bestätigungsseite** zeigt die Positionen mit dem Warenpreis und die Gebühr als eigene Zeile, die Kasse davor mit Endpreisen. Rechnerisch gleich; ob das so gewollt ist (N38 „Gebühr steckt im Preis“), entscheidet die Projektleitung.
- **Testhof-Hinweis** steht nicht in Mails – gewollt?

## 7. Veraltetes in Dateien, die dieser Auftrag nicht ändern darf

- `docs/betrieb/testumgebung.md` Z. 9 und `docs/betrieb/stripe-live.md` §0 nennen die Liste „Nr. 48“; sie ist jetzt A011. Der Pfad stimmt.
- `docs/betrieb/stripe-live.md` Kopf „Heute (Stand 08.10.2026)“ und §0 „Nr. 48 übernimmt den Schritt in die Probelauf-Checkliste“ – der Schritt steht jetzt in C4 (nicht geändert, der Auftrag erlaubt in dieser Datei nur §2 und §9).

## 8. Prüfungen

- Voller Lauf vor dem Commit: `pnpm typecheck` grün, `pnpm lint` grün (nur Warnungen), `pnpm test` grün mit 753 Testdateien und 13 892 Tests. Im frischen Container musste vorher `prisma generate` laufen (ohne Datenbank, keine Datei im Repo geändert), und `tsc` brauchte `NODE_OPTIONS=--max-old-space-size=8192`, sonst lief es aus dem Speicher.
- `tests/telefonnummern-wache.test.ts` (liest `docs/`) grün mit der neuen Liste.
- Bekannt und keine Folge dieses Auftrags: `tests/keine-emojis.test.ts` ist unter Node mit Unicode unter 17 an der Druckseite rot. In dieser Sitzung lief Node 22.23 mit Unicode 17.0; dort ist der Test grün.

## 9. Wie du es prüfst

- `docs/nachtlauf/probelauf-checkliste.md` lesen: Teile A, B, C in dieser Reihenfolge, „Was du brauchst“, Sitzungstabelle, Dauer je Abschnitt.
- `grep -c -- "- \[ \]" docs/nachtlauf/probelauf-checkliste.md` ergibt 125.
- `grep -n farmerzone docs/nachtlauf/probelauf-checkliste.md` ergibt nichts.
- Beträge: jede Zeile der Tabellen gegen `gebuehrJeStueckCents`/`bestellGebuehr` (6 % = 600 Hundertstel) bzw. `berechneServicegebuehr` (5 %, mind. 50 Cent) rechnen.
