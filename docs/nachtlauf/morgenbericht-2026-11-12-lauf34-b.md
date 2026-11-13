# Zwischen-Morgenbericht Lauf 34, Abschnitt B (12.11.2026) · Geldpfad, Wachen, Rücklastschrift, Kaufknopf

**Ergebnis Abschnitt B:** Alle sechs Nummern sind fertig, geprüft und gepusht: 285 (Wachen und CI), 288 (Fehler im Geldpfad sichtbar), 290 (Rücklastschrift: Nachforderung und Notweg; ohne Schritt 3a wegen Tor T4), 294b (nur Teil A: Bild-Abruf nur aus dem eigenen Speicher; Teil B ohne Startsatz), 309 (Kaufknopf ohne Betrag) und 294a (Vorschau-Build bricht ab, wenn er auf die Produktions-Datenbank zeigt). Alle liegen im Zwischenstand `integration/lauf34b`; der Sammel-PR [#541](https://github.com/Uttoranger/FarmerZone/pull/541) steht auf „bereit“. Keine Migration, kein Paket, keine neue Variable.

**Ordnungsgemäß beendet:** ja (Rahmen „Fertig, wenn“: jede Nummer fertig, voller Lauf und Integration ganz auf dem Sammelstand grün, Sammel-PR bereit, Aufräumen bestätigt, dieser Bericht). **Ziel erreicht:** ja, mit einer Einschränkung: Für 290, 294b, 309 und 294a liegt die CI-Bestätigung am Sammel-PR #541, nicht am Einzel-PR (siehe „Stabilität“); der Zahlungsschritt online von 309 war lokal ohne Stripe nicht zu fotografieren (siehe „Abnahme“). Die Prüfungen am echten Stand in „Für dich zu tun“ kann der Container nicht machen.

## Für dich zu tun

- [ ] **Merge:** Sammel-PR [#541](https://github.com/Uttoranger/FarmerZone/pull/541) `integration/lauf34b` → main nach Durchsicht per **Merge-Commit** (nicht Squash). Die Einzel-PRs [#537](https://github.com/Uttoranger/FarmerZone/pull/537) (285), [#538](https://github.com/Uttoranger/FarmerZone/pull/538) (288), [#539](https://github.com/Uttoranger/FarmerZone/pull/539) (290), [#540](https://github.com/Uttoranger/FarmerZone/pull/540) (294b), [#542](https://github.com/Uttoranger/FarmerZone/pull/542) (309) und [#543](https://github.com/Uttoranger/FarmerZone/pull/543) (294a) führt GitHub schon als „merged“ (ihr Kopf steckt im gepushten Zwischenstand); zu schließen ist nichts.
- [ ] **Nach dem Merge:** Im Build-Log der Produktion steht kein „Abbruch“ (294a), und die Zeile mit der Node-Fassung zeigt 24.x (285).
- [ ] **Sentry-Regel** „webhook · verarbeitung_fehlgeschlagen“ mit Mail anlegen (288).
- [ ] **Build-Log der Vercel-Vorschau** des Zweigs von 294a ansehen: „vorschau-db-wache: keine Vorschau auf die Produktions-Datenbank, es wird gebaut.“ und Build grün (Beleg, dass die Wache die Entwicklungsdatenbank durchlässt).
- [ ] **GitHub › Actions › „Sicherheitsmeldungen“ › „Run workflow“** einmal von Hand starten; Erwartung grün (285; lokal 0 kritische Meldungen).
- [ ] **Recht sieht die Vorschau beider Kassenschritte** (Formular bar, Zahlungsschritt online) vor dem Live-Schlüssel (309; R2 Teil 9, Startbedingung 4). Den Zahlungsschritt online konnte der Container ohne Stripe nicht zeigen. Die Frage „Betrag auf dem Knopf“ kommt als Ergänzung zu C1 ins Anwältin-Paket.
- [ ] **Vorbestehend, vor dem Live-Schlüssel:** In der Kasse liegt bei 390 px der Fußlink „Vertrag widerrufen“ unter der festen Knopfleiste (nicht sichtbar, nicht anklickbar; Fund des Fotografen von 309, nicht durch 309). Der Link ist rechtlich nötig → eigener /fix.
- [ ] **290, Tor T4:** Recht gibt einen Satz frei, der auf das Postfach verweist (statt „antworte auf diese Mail“); danach Schritt 3a als eigener /fix. Bis dahin bleibt die Mail zur Sperre vor dem ersten Hof ohne Gründungsplatz offen (Recht, Gegenlesen Fund 9). Der Startsatz „Sperre nach Rückbuchung auch per E-Mail freigegeben“ hat deshalb nichts bewirkt.
- [ ] **290:** Wortlaut „gesperrt“ statt „pausiert“ zur Kenntnis (Vorwort; Register N38, Ergänzung 5.11.2026). Vor dem Live-Schlüssel den Ablauf mit der SEPA-Test-IBAN für Rückbuchungen einmal durchspielen (Ablauf in #539). Steht in Sentry eine Warnung `nachforderung-betrag`, legt die App keine Nachforderung an: Fall mit dem Notweg klären.
- [ ] **294b Teil B** kommt nur mit dem Startsatz „Secrets je Umgebung getrennt“ (nicht in diesem Lauf; Rahmen: entfällt, nicht verschoben).
- [ ] **294a entscheiden:** Allowlist „Vorschau nur auf die Entwicklungsdatenbank“ statt der Sperrliste? (Die Wache erkennt die Produktion an der Referenz; eine bewusst gebaute Adresse über IP oder eigenen Namen fiele durch.)
- [ ] **Nach dem Merge am echten Stand prüfen** (Geld- und Sicherheitsänderungen), in der Vorschau bzw. auf test.agrilo.at (Stripe-Testmodus):
  - Rücklastschrift (290): Lastschrift mit der Rückbuchungs-Test-IBAN → Heute, Postfach und „Jetzt bezahlen“ in Deine Konditionen; Kasse bar gesperrt; Rechnung in Stripe als bezahlt markieren → frei; Notweg in der Akte → „geklärt“, Nachricht an den Hof.
  - Kasse (309): bar „Zahlungspflichtig bestellen“ ohne Betrag, Gesamt in der Zusammenfassung darüber; online „Jetzt bezahlen“ ohne Betrag.
  - Fehler im Geldpfad (288): „Nicht abgeholt“ bei einer online bezahlten Testbestellung, deren Gebühr-Erstattung scheitert, wird Aufgabe „Erstattung offen“ mit dem Betrag der Gebühr.
  - Bilder (294b): Produktfoto und Startseiten-Bild hochladen → erscheinen wie bisher.
- [ ] **Vor dem Start von C:** Recht bestätigt den Wortlaut von 303 A7 für den Fall Tor T5 (Abschnitt C, 303); Frage an Recht dazu: Soll „unter Meldungen“ (eigene Seite Admin › Meldungen, src/app/admin/meldungen) in die Aufzählung der Orte?
- [ ] **Abschnitt C starten**, in einer neuen Sitzung, mit dieser Nachricht (jede Zeile einzeln; die Startsätze von C nur, wenn du sie freigibst – den zweiten nur nach Bestätigung durch Recht):

Nachtlauf 34 fortsetzen

Admin-Wortlaut nach F047 freigegeben

Auskunft ohne IP von Recht bestätigt

## Nummern

| Nr | Inhalt | Status | PR | Vorschau | Migration | Weggelassen / offen |
|---|---|---|---|---|---|---|
| 285 | Wachen und CI: Emoji-Wache ohne Unicode-Abhängigkeit, Node aus .nvmrc, Lint blockierend, Audit wöchentlich | fertig (0 Runden) | [#537](https://github.com/Uttoranger/FarmerZone/pull/537) | Vercel „Deployment has completed“; CI grün mit Node 24 | nein | Nacharbeit: drei `\p{…}`-Stellen in Tests; engines ab 22.12 gegen jsdom 22.22.2 |
| 290 | Rücklastschrift: Nachforderung und Notweg (A007) | fertig (1 Runde) | [#539](https://github.com/Uttoranger/FarmerZone/pull/539) | Vorschau des Zweigs; CI über #541 | nein | Schritt 3a nicht gebaut (Tor T4); Schritt 9 gebaut (Startsatz); Datenschutz-Satz ersetzt (T3 griff nicht) |
| 288 | Fehler im Geldpfad sichtbar machen | fertig (0 Runden) | [#538](https://github.com/Uttoranger/FarmerZone/pull/538) | Vorschau des Zweigs; CI grün | nein | Nacharbeit: Marke und Listentitel in admin/bestellungen/page.tsx |
| 294b | Bild-Abruf nur aus dem eigenen Speicher (N7) | fertig, nur Teil A (0 Runden) | [#540](https://github.com/Uttoranger/FarmerZone/pull/540) | Vorschau des Zweigs; CI über #541 | nein | Teil B nicht gebaut – Startsatz fehlt; Nacharbeit: Port in der Adresse, Weiterleitungen beim Abruf |
| 309 | Kaufknopf ohne Betrag (§ 8 Abs. 2 FAGG) | fertig (0 Runden; Bericht nachgetragen) | [#542](https://github.com/Uttoranger/FarmerZone/pull/542) | Vorschau des Zweigs; CI über #541 | nein | Zahlungsschritt online nicht fotografierbar ohne Stripe; Nacharbeit: Wache für JSX-Kinder, Probelauf-Checkliste |
| 294a | Vorschau-Build bricht ab, wenn er auf die Produktions-Datenbank zeigt (M7) | fertig (0 Runden) | [#543](https://github.com/Uttoranger/FarmerZone/pull/543) | Vorschau des Zweigs (Beleg „läuft durch“); CI über #541 | nein | Entscheidung Allowlist offen |

Vorher rot (Namen und Ausgaben in den PR-Texten): 285 keine-emojis (Gegenprobe ohne ☐; Fundstelle Druckseite), druckseite-kaestchen, workflows-wache (5 Fälle); 290 plattformgebuehr-abrechnung und fünf weitere Dateien (26 Fälle), Runde 1 (a2) mit täglichem Lauf; 288 fehler-art, nicht-abgeholt-gebuehr-offen, gebuehr-erstattung-schliessen, storno-zahlung-abbrechen u. a. (19 Fälle) und integration/webhook-fehler (3 Fälle); 294b upload-url-guard (9 Fälle); 309 kaufknopf-ohne-betrag (13 von 19); 294a vorschau-db-wache (5 von 12).

**Nicht gebaut – Startsatz fehlt:** 294b Teil B (Mindestlänge `BETTER_AUTH_SECRET`) – Satz „Secrets je Umgebung getrennt“; nach der Tabelle im Rahmen entfällt der Teil (nicht verschoben). **Trotz Startsatz nicht gebaut:** 290 Schritt 3a (Tor T4). **Verschoben:** keine Nummer. Rahmen §1 3.5 (eine Nummer aus C vorziehen) nicht genutzt: Alle Nummern von B waren bei Stunde 2,4 fertig; 304a wäre ohne Startsatz startbar, bleibt aber in C, damit der Sammel-PR B klein bleibt und vor dem Live-Schlüssel gemergt werden kann (wie in A begründet).

## Merge-Reihenfolge

Sammel-PR `integration/lauf34b` → main per **Merge-Commit** (nicht Squash). Der Zwischenstand liegt auf main f3c2a22b6b66 (nach #536), in dieser Reihenfolge per `--no-ff` gemergt: 285 (#537), 288 (#538), 290 (#539), 294b (#540), 309 (#542), 294a (#543); dazu die Doku-Commits des Dirigenten. Konflikte nur in DEVELOPMENT.md (alle Abschnitte behalten) und docs/nachtlauf/berichte/lauf34-ergaenzungen.md (beide Zeilen behalten); `pnpm bausteine` nach jedem Merge ohne Änderung. Abschnitt C legt danach `integration/lauf34c` von main an; ist #541 noch nicht gemergt, stapelt C auf `integration/lauf34b` (Rahmen §1 3.2).

## Geld

- **290 (A007, E-012 (6)):** Nach einer SEPA-Rückbuchung der Monatsrechnung bar geht eine Rechnung zur Überweisung über genau `summeCents` an den Hof, ohne Kosten der Rücklastschrift; sie wird nur angelegt, wenn der zurückgebuchte Betrag (aus dem Webhook oder nur lesend bei Stripe: Rechnung → Zahlung → Streitfall) und der Betrag der Rechnung bar beide genau `summeCents` sind – sonst Warnung, nichts gebucht (Runde 1, Blocker aus dem Gegenlesen „Geld“). Bezahlt der Hof sie, wird der Stand bedingt „bezahlt“; der Notweg (Recht Geld, Passkey, Grund) setzt „geklärt“, ruft Stripe nicht auf und storniert nichts. Gegenlesen „Geld“ Runde 1: kein Blocker; zwei Sollte (Status des Streitfalls, `has_more`) als Nacharbeit.
- **288:** Kein Betrag ändert sich, kein neues Geld bewegt. Scheitert bei „Nicht abgeholt“ die Erstattung der Gebühr, wird es Aufgabe „Erstattung offen“ mit genau `serviceFeeCents` (kein automatischer zweiter Versuch). „Außerhalb erstattet“ bzw. eine erfolgreiche Erstattung setzen im Gebühr-Fall `serviceFeeRefundedAt`; danach zählt die Gebühr nicht mehr als Einnahme. Der Storno einer unbezahlten Online-Bestellung bricht den Zahlungsvorgang ab (kein Geld bewegt). Gegenlesen „Geld“: kein Blocker.
- **309:** Nur Anzeige; `gesamtAnzeige` ist die alte Rechnung (drei Fälle vorher-nachher), der Betrag in der Zusammenfassung ist derselbe wie in der Übersicht und wie bei Stripe. Gegenlesen „Geld“: kein Blocker.
- Register-Vorschläge der Nummern (wörtlich, der Lauf trägt sie nicht ein):
  - 290, Ergänzung zu N38: „Nach einer Rückbuchung geht eine Rechnung zur Überweisung über den zurückgebuchten Betrag an den Hof, ohne Kosten der Rücklastschrift; mit ihrer Zahlung ist der Hof von selbst wieder frei. Das Team kann die Sperre mit Recht ‚Geld‘, Passkey und Grund aufheben (Stand ‚geklärt‘).“
  - 309, Ergänzung zu N2/O4: „Die verbindlichen Knöpfe tragen nur ihr Wort (‚Zahlungspflichtig bestellen‘, ‚Jetzt bezahlen‘, ‚Erneut bezahlen‘), ohne Betrag; der Gesamtpreis steht in der Zusammenfassung unmittelbar darüber. Eine klebende Leiste davor ist nur Navigation.“ (Den ersten Satz baut 309; der zweite gilt erst mit dem Umbau nach Board k5.)

## Recht

- Geändert (Wortlaute von Recht bzw. der Projektleitung, je Zeichen für Zeichen gegengelesen): `LASTSCHRIFT_TEXT.zurueckgebuchtSatz` mit „gesperrt“ (src/lib/konditionen.ts); in der Datenschutzerklärung allein der Satz „Bucht deine Bank eine Lastschrift zurück …“ durch den Wortlaut von Recht ersetzt (T3 griff nicht, weil A006b den alten Satz schon eingetragen hatte); auf /konditionen im Hofpreis-Modell der Satz zum Kleinbetrag (E-021, Startsatz). Kaufknöpfe ohne Betrag, Reihenfolge Mitteilung → Zusammenfassung → Knopf in beiden Schritten; Sätze unter dem Knopf unverändert (309).
- `git diff --name-only origin/main...integration/lauf34b -- prisma/ src/lib/rechtstexte/ src/lib/widerruf.ts docs/recht/` ist leer.
- Gegenlesen „Recht“ 290: kein Befund. 309: kein Befund. 288 (neuer Rechtsblock-Schlüssel `vorschau:erstattung-offen-gebuehr`, interne Mail an den Betreiber): kein Befund; bestehende Schlüssel byteweise gleich.

## Abnahme

- 285: Packliste bei 1440 hell gegen Board w2-druck bestanden (Kästchen-Symbol vor jeder Position); Messpunkte erfüllt; vorbestehend axe moderate „landmark-one-main“, „region“.
- 290: Admin-Akte (Knopf und Dialog „Sperre nach Rückbuchung aufheben“) und Hof › Deine Konditionen („Jetzt bezahlen“) bei 390 und 1440, hell und dunkel, als „Ergänzung ohne Board“ bestanden; alle sechs Messpunkte in zwölf Messungen; ein Sollte (Umbruch „Oktober 2026“ bei 1440 in Deine Konditionen). Zeile in der Ergänzungsliste (admin-akte, einstellungen; C).
- 309: Kasse Formular bar und online, Privat, bei 390 und 1440, hell und dunkel, als „Ergänzung ohne Board“ bestanden (Knopfwörter, Reihenfolge, Gesamt gleich der Übersicht; alle Messpunkte). Zahlungsschritt online nicht prüfbar ohne Stripe. Zeile in der Ergänzungsliste (w1-kasse; C).
- 288, 294b, 294a ohne Oberfläche: Abnahme über Tests, pruefer, Gegenlesen (Rahmen 4.1). Einzelheiten in `docs/nachtlauf/berichte/abnahme-lauf34.md`.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Migration der Prüf-DB ohne Passwort im Befehl** (Fotografen 285, 290, 309): Der Hook verlangt beim Einspielen der Migrationen beide Adressen wörtlich im Befehl; mit dem Benutzer postgres stünde das lokale Passwort im Befehlstext. Die Fotografen haben je eine Wegwerf-Rolle mit nicht geheimem Passwort angelegt und danach gelöscht. Vorschlag: ein Unterbefehl `pruef-env.sh migriere --db <name>`, der das genau so macht; Prüfung: Test im Stil von tests/pruefwerkzeug-*.
2. **Einzel-PR erst nach Hereinholen des Zwischenstands öffnen** (290, 294b, 309, 294a): Ein PR mit Konflikt zur Basis (hier immer DEVELOPMENT.md) bekommt bei GitHub keine CI. Vorschlag: Der Dirigent merged den Zwischenstand in den Nummern-Zweig, bevor er pusht und den PR öffnet (nur Doku-Konflikte, mechanisch), oder der Sammel-PR wird gleich nach dem Doku-Schritt als Entwurf geöffnet (so ab 22:29 gemacht). Prüfung: Zeitbuch-Zeile „CI am PR gestartet“ je Nummer.
3. **Prüfskripte behalten die Namen roter Fälle** (Dirigent, 22:18): Das Protokoll des vollen Laufs behielt nur das Ende der Ausgabe; ein roter Integrationsfall blieb ohne Namen. Das Skript filtert jetzt auf „FAIL“ und „AssertionError“. Vorschlag als Regel für alle Prüfbefehle des Dirigenten und der tester.
4. **Zeitbuch-Zeilen mit dem Wort der Migration über eine Datei anhängen** (Dirigent): Der Hook liest auch den Text eines Heredocs; eine Zeitbuch-Zeile, die den Befehl nur erwähnt, wird geblockt. Kein Fix am Hook nötig; Hinweis für die Arbeitsanweisung der Dirigenten.

## Nacharbeit (gesammelt aus den Berichten)

- 285: `\p{Extended_Pictographic}` noch in tests/mail-vorlagen.test.ts, tests/ladeansichten.test.ts, tests/anmelden-seite.test.ts; engines ab 22.12.0 gegen jsdom 22.22.2; Gegenprobe der Listenprüfung als gemeinsame Funktion; `BILDZEICHEN` im Rendertest nicht kopieren.
- 288: src/app/admin/bestellungen/page.tsx (Marke im Detail, Listentitel beim Gebühr-Fall; vor oder mit 303/304a); BAUSTEINE-Eintrag fehler-art.ts; Kommentar `ErstattungAufgabeRoh.bezahltCents`.
- 290: `invoicePayments.list` mit `status: 'paid'` und `has_more`; Status des Streitfalls; Tests für zwei PaymentIntents und einen Wurf von `disputes.list`; Handbuch-Satz zur Rechnung von Hand; zwei fast gleiche Knopf-Komponenten; Umbruch „Oktober 2026“ bei 1440.
- 294b: Port in der Adresse ablehnen; `redirect: 'error'` beim Abruf; eigener https-Fall im Test.
- 294a: Gut-Zeile mit `VERCEL_ENV`; Gleichlauf-Test mit `postgres://`, Abfrageteil, Session-Pooler.
- 309: Wache auch für JSX-Kinder mit Platzhalter; docs/nachtlauf/probelauf-checkliste.md nennt die Knöpfe noch mit Betrag.
- Vorbestehend (Fotograf 309): „Vertrag widerrufen“ bei 390 px unter der festen Knopfleiste (oben unter „Für dich zu tun“).

## Stabilität

- Rechner: 4 Kerne, 15 GB, neuer Container. Node v22.23.4, Unicode 17.0. Start 12.11.2026 20:32 UTC, Haltepunkt B 23:05 UTC (Stunde 2,6).
- Volle Läufe n = 1 unter `schwer.lock`, 3 Worker, 244–302 s je Lauf; im Zwischenstand mit Integration 776–924 s (mit Wartezeit). Keine Unterbrechung, kein Neustart.
- **Ein Wackler:** Nach dem Merge von 294b war in der Integration ganz ein Fall rot (1 von 858); der Name fehlte im Protokoll. Die Wiederholung ohne Änderung war grün (107 Dateien, 858 Tests). Kein Wiederholungsschalter, kein Test abgeschwächt (Regelvorschlag 3).
- **CI:** #537 und #538 grün am Einzel-PR; #541 grün auf dem Stand 81f42755c21c (285, 288, 290, 294b, 309); die CI des letzten Stands mit 294a läuft beim Haltepunkt (ein Doku-Commit danach startet sie neu). #539, #540, #542, #543 hatten beim Öffnen einen Doku-Konflikt mit dem Zwischenstand, GitHub startete dort keine CI; die CI des Sammel-PR #541 deckt sie ab (Regelvorschlag 2).
- Budgets (Plan der Abschnittsdatei, Wanduhr ab 20:32): alle eingehalten (285 fertig 20:55 statt bis 22:47; 290 ohne Schritt 3a mit einer Runde fertig 21:44 statt bis 02:17; 288 fertig 21:26 statt bis 02:47; 294b fertig 22:03 statt bis 03:02; 309 fertig 22:38 statt bis 04:17; 294a fertig 22:53 statt bis 05:17).
- Abweichung: Der Dirigent hat zweimal eine Uhrzeit vor dem `date -u` eingetragen und danach auf die Commit-Zeit berichtigt (im Zeitbuch so vermerkt).

## Aufräumen

Bestätigt um 23:05 UTC (Zeitbuch): kein Prüf-Server, kein Prüf- oder Passkey-Browser, kein dev-Worktree, Port 3000 frei; Prüf-DBs, Kopien und Wegwerf-Rollen der Fotografen gelöscht; Integrations-DBs `fz_int_*` gelöscht. Die Worktrees unter /home/user/wt/ bleiben bis zum Ende der Sitzung (nur lokal, alles gepusht).

## Bilder

Im Container unter `/home/user/FarmerZone/.nachtlauf/screens/`: `0a-b/` (Probe agent-browser), `285/r1/` (Packliste 1440 hell, Board-Bilder), `290/r1/` (Akte, Dialog, Deine Konditionen; 390 und 1440, hell und dunkel, mit Messung, axe und Fokus) und `309/r1/` (Kasse Formular bar und online; 390 und 1440, hell und dunkel, mit Messung, axe, Reihenfolge und Fokus). Nicht committet.

## Wiederaufnahme (für C)

- Zwischenstand `integration/lauf34b` (gepusht), Sammel-PR [#541](https://github.com/Uttoranger/FarmerZone/pull/541) (bereit). Keine WIP-Stände, keine verschobenen Nummern.
- C beginnt mit „Nachtlauf 34 fortsetzen“ in einer neuen Sitzung: Zeitbuch und status.md lesen, §0a (ohne 1.2), Doku-Schritt 3.3 („### 38.2 Abschnitt C“), Postgres starten und dem Benutzer postgres ein lokales Passwort setzen, Worktrees neu anlegen, je Worktree `pnpm install --frozen-lockfile` und `pnpm exec prisma generate`.
- Branch-Namen in C weiter `nacht/2026-11-11/<nr>-<kurz>` (Datum des Starts von A).
