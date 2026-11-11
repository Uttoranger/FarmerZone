Nachtlauf 34 · Abschnitt G – Rest: Browser-Test der Kasse, kleine Wege der Kundschaft, tägliche Mail (nach dem Live-Tag)
Ort: wie im Rahmen (Cloud-Sitzung auf Linux, alles Prüfen lokal im Container). Kein Claude in Chrome.
Basis: integration/lauf34g – von main, wenn der Sammel-PR von F gemergt ist; sonst vom Stand von integration/lauf34f (Rahmen §1 3.2).
Berührt (Sperrzonen): Recht-Wortlaut: nein (301: der Wortlaut des Cookie-Hinweises bleibt; er weicht der Kaufleiste nur mit Startsatz, Pflicht-Gegenlesen „Recht“; Datenschutzerklärung ohne Diff) · Kasse: kein Diff unter src/ durch 307 (der Browser-Test bedient die Kasse nur, gegen eine Wegwerf-DB auf localhost); 301 Teil (c) ändert nur die Lage des Cookie-Hinweises über Warenkorb-Leiste und Kaufknopf · /api/**: nur neu src/app/api/cron/braucht-dich/route.ts (304b, nur mit Startsatz; `cronBerechtigt`, kein Schreiben außer Mail-Aufträgen) · Webhook: nein · Stripe-Beträge und Geldberechnung: nein · Auth: nein · Fristen: nein · Schema: nein · Pakete: nein (307 ergänzt in package.json nur das Skript `pruefen:kasse`; kein Playwright) · neue Variablen: nein · vercel.json: ein Cron-Eintrag (304b, nur mit Startsatz) · CI: ein neuer Job „kasse“ ohne Secrets (307) · Werte in Entwicklungs- oder Produktionsdatenbank: nein · Board-Dateien: nein · externe Dienste: nein (kein Stripe, keine echte Mail; der Browser-Test nie gegen Vorschau, test.agrilo.at oder eine gehostete Datenbank)

Diese Datei gilt nur zusammen mit dem Rahmen (docs/nachtlauf/berichte/a013-lauf34-rahmen.md): Dort stehen die Regeln für Startsätze, Pakete, Migrationen, Dateien mit mehreren Nummern, Vorprüfung (§0a), Haltepunkt (§1), Abnahme, Bericht und Morgenbericht. Die Sitzung liest den Rahmen ganz und diese Datei ganz, sonst keine Abschnittsdatei (Ausnahme: Rahmen §1 3.5).

══════════════════════════════════════════════════════════════════════
START UND ABBRUCH
══════════════════════════════════════════════════════════════════════
Start nur, wenn:
- Die Startnachricht lautet „Nachtlauf 34 fortsetzen“, in einer neuen Sitzung; Haltepunkt F ist laut Zeitbuch erreicht.
- Der Sammel-PR von F ist per Merge-Commit gemergt – oder noch offen: Dann setzt G auf dem Stand von integration/lauf34f auf (Rahmen §1 3.2). Per Squash gemergt: STOPP.
- Kein anderer Lauf oder Auftrag arbeitet am Repo; die Basis ist grün.
Schritt 0 des Dirigenten (vor der ersten Nummer):
- Rahmen §0a (ohne 1.2), dann der Doku-Schritt: diese Datei wörtlich als „### 38.6 Abschnitt G“ an §38 anhängen (Rahmen §1 3.3).
- Erwartet im Stand prüfen (Liste unten) und die Anker der drei Nummern (Rahmen §0a 1.9).
- 307 Tor T2: die Aufrufe von scripts/pruefung/sperre-cli.ts, pruef-env.sh, pruef-seed.ts und fotograf.sh gegen den Stand prüfen (Lauf 33 Nr. 262c hat das Prüfwerkzeug zuletzt geändert; am Stand main efc52874b nur neue Modi `tabelle-aus`/`tabelle-an` in fotograf.sh und db-schalter.ts, `fotograf.sh start` unverändert).
Startsätze dieses Abschnitts (gelten nur als eigene Zeile der Startnachricht dieses Abschnitts; Rahmen „Startsätze“):
- „Tägliche Mail Braucht dich freigegeben“ → 304b, ganze Nummer. Fehlt er: 304b wird nicht gebaut.
- „Cookie-Hinweis weicht der Kaufleiste freigegeben“ → 301, Teil (c2). Fehlt er: Der Hinweis wird am Handy nur flacher (c1).
Plan (Wanduhr ab Start, zwei Plätze; Budget je Nummer ist ihre Zeile „Zeit“):
- Vorprüfung und Doku-Schritt 0–0,25 h.
- Platz 1: 307 0,25–5,75 h. Platz 2: 301 0,25–3,25 h → 304b 3,25–8,75 h (nur mit Startsatz; 304b Tor T3: nach Stunde 3,5 nicht begonnen → entfällt).
- Merges zusammen 0,5 h → gegen 9,25 h; Sammel-PR, Aufräumen und Morgenbericht 1,5 h → Haltepunkt G gegen 10,75 h. Ohne 304b: Haltepunkt gegen 8 h. Streichfolge bei Zeitnot: zuerst 304b, dann 307.
Abbruch und Unterbrechung: STOPP des Abschnitts nur nach Rahmen §0a 1.11 und docs/nachtlauf.md §5. Trifft der Lauf das Wochenlimit der API oder stürzt die Sitzung ab: sichern nach Rahmen §1 3.7, fortsetzen mit „Nachtlauf 34 fortsetzen“.

══════════════════════════════════════════════════════════════════════
AUSGANGSLAGE DES ABSCHNITTS
══════════════════════════════════════════════════════════════════════
Erwartet im Stand aus den Abschnitten A bis F (fehlt etwas, gilt Rahmen §1 3.5 und das Tor der Nummer):
- 285: .nvmrc und `node-version-file` in .github/workflows/ci.yml; 294a: `vercel-build` beginnt mit scripts/vorschau-db-wache.mjs; 306: Schritt „Kein Hof-Code im Paket der Hofseite“ in ci.yml (307 hängt seinen Job dahinter an).
- 287: Die Kasse legt Bar-Bestellungen mit Token im selben Schreiben an (307 setzt im Test einen eigenen Token, Schritt h).
- 304: `QUELLE_NAME` in src/lib/admin-aufgaben.ts (304b Tor T1); 303: src/lib/zustellung.ts mit dem Satz „je Unterhaltung und Stunde“.
- 288, 296, 297: Einträge in src/schemas/mail-auftrag.ts, tests/mail-vorschau.test.ts und (296, 297) tests/mail-wege-wache.test.ts; 297 auch in src/server/mail-arten/index.ts (304b hängt seine Art an).
- Kamen seit 304 neue Aufgaben-Quellen dazu (291, 292a, 292b), stehen sie in `QUELLE_NAME`; ebenso 'hof_online_haengt' aus A012. 304b nimmt die Namen von dort.

══════════════════════════════════════════════════════════════════════
ENTSCHIEDEN (Rangfolge und Startbedingungen)
══════════════════════════════════════════════════════════════════════
- Rangfolge G: (am Haltepunkt F gesicherte Nummern, dann aus F verschobene) → 307 → 301 → 304b ‖ HALTEPUNKT G (Ende des Laufs)
- Startbedingungen: 307 nach 306 (C; ci.yml) und 294a (B; package.json). 301 jederzeit. 304b nach 304 und 303 (C) und nach 297 (E; Mail-Register), nur mit Startsatz.
- Platz 1 (307) und Platz 2 (301 → 304b) teilen keine Datei.
- 301 Tor T2 (Messung zuerst): Die Höfe-Liste bei 1440 × 900 im Prüf-Bau ansehen, bevor Teil (b) gebaut wird.
- Bilder: 301 (Höfe-Liste 1440 mit abgeschaltetem JavaScript und nach dem Laden; Hofseite und Kasse 390 mit Ware im Warenkorb und unbestätigtem Hinweis), 304b (Vorschau der Mail in Admin › Betrieb › E-Mails; Einstellungen › Benachrichtigungen mit der neuen Zeile). 307 ohne Bild (bei Fehler ein Bildschirmfoto unter .nachtlauf/).

══════════════════════════════════════════════════════════════════════
UMSETZUNG – die Nummern dieses Abschnitts (Reihenfolge der Beschreibung, nicht die Rangfolge)
══════════════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────────────
307 Ein Browser-Test für die Kasse (bar), lokal und in der CI – Opus, gezielt, Pflicht-Gegenlesen „Sicherheit“ (Sperre, kein fremder Host, keine Dienst-Schlüssel), Migration: nein, stapelt auf 306 (ci.yml, Abschnitt C) und 294a (package.json, Abschnitt B)
Hebt: Tests (3,5) → 4. Nicht 5: ein einziger Fall, die Online-Zahlung bleibt ohne Browser-Test, rund ein Drittel der Tests liest weiter Quelltext.
Startsatz: keiner (kein neues Paket). „Paket Playwright freigegeben“ wird nicht gebraucht.
Tore (trifft eines zu: Folge steht je Tor dabei, im Bericht melden):
- T1 Der Test bräuchte ein neues Paket, eine neue Variable in Vercel oder einen echten Dienst → nicht bauen, melden.
- T2 scripts/pruefung/sperre-cli.ts, pruef-env.sh, pruef-seed.ts oder fotograf.sh fehlen oder haben andere Aufrufe als unter „Ausgangslage“ → an den Stand anpassen; fehlt die Sperre: Nummer überspringen.
- T3 Der Prüf-Seed erlaubt am Pilothof keine Bar-Bestellung mehr (PRUEF_BESTELLUNGEN ohne offene Bar-Bestellung) → melden, nicht den Seed ändern.
- T4 Der Test ist nach drei Läufen in Folge nicht jedes Mal grün → nicht in die CI aufnehmen; Skript bleibt, Befund in den Bericht.
Dateigrenze: neu scripts/pruefung/kasse-bar.ts und scripts/pruefung/cdp.ts, scripts/pruefung/pruef-browser.sh (nur die Suche nach dem Browser), package.json (nur ein Skript „pruefen:kasse“; teilt mit 284, 285 und 294a – alle vorher), .github/workflows/ci.yml (ein neuer Job; teilt mit 285 und 306 – beide vorher), tests/workflows-wache.test.ts (nur: die erwartete Liste der Jobs in ci.yml, :146, um `'kasse'` ergänzen und eine Gegenprobe `'Zeitgrenze des Jobs kasse fehlt': (t) => t.replace('    timeout-minutes: 25\n', '')` – mit 25 statt 20, weil die vorhandenen Gegenproben das erste Vorkommen von „timeout-minutes: 20“ ersetzen (:159, :161) und sonst die Zeitgrenze des Jobs ci träfen; teilt mit 285 – vorher), tests/pruefung-skripte.test.ts (der Fall „startet Chromium aus /opt/pw-browsers“, :41–48, sagt heute „bricht ab, statt einen anderen Browser zu nehmen“ – genau das ändert Schritt 3; er wird deterministisch, nicht schwächer: mit `PRUEF_CHROME` auf eine ausführbare Attrappe → erste Zeile genau dieser Pfad; mit nicht ausführbarem `PRUEF_CHROME`, ohne /opt/pw-browsers-Treffer und mit einem PATH ohne Browser → Ausgang 1 mit einer Meldung, die alle durchsuchten Orte nennt; der Fall der Flags bleibt unverändert), docs/ai/TESTING_GUIDELINES.md (ein Abschnitt), scripts/README.md, Tests zu den reinen Teilen. Kein src/.
Ausgangslage (geprüft 10.11.2026, main efc52874b):
- Kein Browser-Test, kein Playwright in package.json. Das Prüfwerkzeug hat: pruef-env.sh (feste Umgebung, `env -i`), sperre.ts/sperre-cli.ts (Loopback-Sperre: DATABASE_URL = DIRECT_URL, nur localhost/127.0.0.1, kein gehosteter Benutzer, keine .env-Datei, keine Dienst-Schlüssel), pruef-seed.ts (Seed in eine Wegwerf-DB, Stichtag in der Vergangenheit = Hofpreis-Modell, offene Bar-Bestellung am Pilothof), fotograf.sh start (kopiert .next, startet `next start` auf 127.0.0.1 unter `env -i`), pruef-browser.sh (Chromium aus /opt/pw-browsers, DevTools nur auf 127.0.0.1), passkey-browser.mjs (DevTools-Protokoll über den eingebauten WebSocket von Node).
- Der Bestätigungs-Token steht nur in der Mail; gespeichert ist der Hash (checkout/route.ts, Anker „data: { confirmationToken: confirmationHash }“; src/lib/bar-bestaetigung.ts: neuerBarToken, barTokenHash). Ohne RESEND_API_KEY wird die Mail nicht verschickt und ihr Inhalt nicht geloggt.
- Bestätigen ist ein Knopf (Server Action) auf /<hof>/bestaetigen/<token>; er setzt bedingt auf CONFIRMED, löscht den Token und stellt zwei Mail-Aufträge ein (src/server/actions/bar-bestaetigung.ts:158-166).
- Feste Griffe in der Oberfläche: `aria-label="<Produktname> in den Korb legen"` (src/components/hofseite/produkt-karte.tsx:136), Felder `#customerEmail`, `#customerName`, `#customerPhone` (checkout-form.tsx), Link „Zur Kasse“ (cart-sheet.tsx).
- CI: Job „integration“ hat schon einen Postgres-Dienst (postgres:17) und läuft rund 4 Minuten.
Entschieden:
- Nur die Bar-Strecke; kein Stripe im Lauf (Rahmen Lauf 34).
- Nie gegen eine fremde Datenbank: Sperre zuerst, Server und Browser startet das Skript selbst (Technik).
Umsetzung:
1. cdp.ts (nur eingebaute Module von Node ab 22, kein Paket): verbinden über http://127.0.0.1:<port>/json, `auswerten(ausdruck)`, `warteAuf(bedingung, { ms: 15000 })`, `klick(selektor)`, `tippe(selektor, text)` (Fokus, dann Input.insertText), `gehe(url)`. Jede Adresse wird vor dem Aufruf geprüft: nur http://localhost:<port> bzw. 127.0.0.1; sonst Abbruch.
2. kasse-bar.ts (über tsx, unter `env -i` mit der Liste aus pruef-env.sh): a) `sperre-cli.ts --db` als erster Schritt, Abbruch bei Exit ≠ 0. b) Der Port muss frei sein (kein fremder Server wird übernommen); Server über `fotograf.sh start`, Browser über `pruef-browser.sh start`; beides wird im `finally` gestoppt. c) Hofseite des Pilothofs aus dem Prüf-Seed öffnen; zwei Produkte in den Warenkorb, sodass der Warenwert mindestens der Mindestbestellwert ist (Produktnamen aus den Seed-Daten importiert, nie abgetippt). d) Warenkorb → „Zur Kasse“. e) Abholtermin wählen, „Bar bei Abholung“ wählen, Name, E-Mail (`kundin+<Laufnummer>@example.com`) und Telefon (+43 660 000 0000) eintragen, Pflichtkästchen setzen, absenden. f) Warten auf die Bestätigungsseite; die Bestell-ID aus der Adresse. g) Datenbank lesen: Status PENDING_CONFIRMATION, Zahlart ONSITE_CASH, Vorrat der zwei Produkte um die Mengen gesunken. h) Eigenen Token setzen: `neuerBarToken()`, dann `updateMany({ where: { id, status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH' }, data: { confirmationToken: hash } })` – count muss 1 sein. i) /<hof>/bestaetigen/<token> öffnen, den Knopf zum Bestätigen klicken (Text aus der Konstante der Seite). j) Datenbank: Status CONFIRMED, confirmedAt gesetzt, confirmationToken null, Aufträge 'bestellung-bestaetigung' und 'bar-bestaetigt-hof' eingestellt. Ausgabe je Schritt eine Zeile; bei Fehler ein Bildschirmfoto nach .nachtlauf/ und Exit 1. Keine Adresse, kein Token in der Ausgabe.
3. pruef-browser.sh: Browser-Suche in dieser Reihenfolge: `$PRUEF_CHROME` (wenn gesetzt und ausführbar), /opt/pw-browsers (wie heute), `google-chrome`, `chromium`, `chromium-browser` im PATH. Flags unverändert.
4. package.json: `"pruefen:kasse": "tsx scripts/pruefung/kasse-bar.ts"`.
5. ci.yml: neuer Job „kasse“ am Ende der Datei, nach „integration“ (eigener Job, bricht die schnelle Suite nie ab; `timeout-minutes: 25`, Höchstwert der Wache 30, tests/workflows-wache.test.ts:99; nach „integration“, weil tests/pruefung-leistung.test.ts:60 den Job ci zwischen „ci:“ und „integration:“ ausschneidet) mit Postgres-Dienst wie „integration“ (eigene leere Datenbank), Schritte: checkout, pnpm, Node aus `.nvmrc` über `node-version-file` wie die anderen Jobs nach 285 (ohne 285: dieselbe Angabe wie die anderen Jobs am Stand), install, prisma generate, `pruef-env.sh neu` (PGUSER/PGPASSWORD des Dienstes), `prisma migrate deploy` gegen die lokale Adresse, Prüf-Seed und Build unter `env -i` wie im Schluss-Durchgang (docs/nachtlauf.md „Prüfwerkzeug“), `pnpm pruefen:kasse`. Bei Fehler das Bildschirmfoto als Artefakt (actions/upload-artifact, nur aus .nachtlauf/kasse/). Keine Secrets im Job.
6. TESTING_GUIDELINES.md: Abschnitt „Browser-Test der Kasse“ – was er beweist, was nicht (die Mail und ihr Link, Online-Zahlung), wie man ihn lokal startet.
Tests (zuerst schreiben, rot sehen, dann bauen):
- Rein: Die Adressprüfung aus cdp.ts lässt http://localhost:3101/x und http://127.0.0.1:3101/x durch und wirft bei jedem anderen Host, bei https und bei einer Adresse mit Benutzer.
- Rein: pruef-browser.sh flags … gibt mit gesetztem PRUEF_CHROME dieses Programm aus (bestehender Test der Flags erweitert).
- Gegenprobe der Sperre: kasse-bar.ts mit DATABASE_URL auf einen anderen Host endet vor jedem Verbindungsaufbau mit Exit 1 (Test ruft das Skript mit erfundener Adresse; kein Netz).
- Der Lauf selbst: dreimal in Folge grün im Container (T4), vor jedem der drei Läufe Prüf-Seed neu in eine frische Wegwerf-DB (wie Schritt b; sonst bremsen die Zähler aus 287 – je IP 10 neue Bar-Bestellungen je Stunde, je Adresse 3 unbestätigte – spätere Läufe aus); Dauer je Lauf im Bericht.
Nicht:
- Keine Online-Zahlung, kein Stripe, keine echte Mail. Kein `data-testid` und keine andere Änderung unter src/.
- Nie gegen Vorschau, test.agrilo.at, Entwicklungs- oder Produktionsdatenbank. Nie ein schon laufender Server.
- Kein zweiter Fall (Storno, Verfall) in dieser Nummer.
Fertig, wenn:
- `pnpm pruefen:kasse` läuft im Container gegen die Wegwerf-DB dreimal in Folge grün und in der CI des PR einmal grün; Dauer des Jobs im PR-Text.
- Pflicht-Gegenlesen „Sicherheit“ wörtlich im PR-Text: Sperre vor jeder Verbindung, nur Loopback, Server und Browser vom Skript gestartet und beendet, keine Dienst-Schlüssel.
Zeit: 5,5 h

──────────────────────────────────────────────────────────────────────
301 Kundschaft: Ladepunkt, Höfe-Liste vor dem Hydrieren, Cookie-Hinweis – Opus, gezielt, Migration: nein, zweigt vom Zwischenstand von Abschnitt G ab (erste Nummer auf Platz 2, vor 304b; teilt mit 307 keine Datei)
Hebt: „Hof finden“ von 4 auf 4,5 (Rückmeldung beim Tippen auf einen Hof; am Computer von der ersten Sekunde an die Form des Boards) und „Kasse online“/„Hofseite, Produkt“ am Handy (unten liegt nichts mehr über Warenkorb-Leiste und Kaufknopf); ehrlich nicht 5: Filter am Handy und die Reihenfolge der Hofseite brauchen ein Board bzw. eine Entscheidung.
Startsatz: „Cookie-Hinweis weicht der Kaufleiste freigegeben“ – gilt für Teil (c2). Die Teile (a), (b) und (c1) brauchen keinen.
Tore (trifft eines zu: Teil überspringen, im Bericht melden):
- T1 Teil (a): Hofkarte oder Produktzeile tragen schon `<LadePunkt` → für diese Stelle überspringen.
- T2 Teil (b), Messung zuerst: Prüf-Bau, `/hoefe` bei 1440 × 900, nach dem Laden `document.querySelector('[data-ansicht="split"]')`. Vorhanden → Teil (b) bauen. Nicht vorhanden → nichts bauen; Konsolenmeldungen und Bild in den Bericht („Splitscreen erscheint nicht – eigener Fehler, Ursache offen“).
- T3 Teil (c): `src/components/cookie-banner.tsx` rechnet die Lage nicht mehr über `cookieHinweisUnten` → nicht bauen, melden.
- T4 Teil (c2): Der Cookie-Hinweis holt eine Einwilligung ein (`src/components/cookie-banner.tsx` hat mehr als ein `<button`, etwa eine Wahl oder „Ablehnen“; am geprüften Stand genau eines), oder `KASSE_ZAHLARTEN` in `src/lib/kasse.ts` enthält `'link'` (heute `['card', 'eps']`), oder `git grep -n -e "document.cookie" -e "posthog" -e "gtag" -e "plausible" -- src` findet einen Treffer (am geprüften Stand keiner) → (c2) nicht bauen, nur (c1), melden. Grund: Recht gibt (c2) nur frei, solange nichts Einwilligungspflichtiges läuft (R-Prüfung Teil 3, 301; R2 Teil 3, 301).
Dateigrenze: (a) `src/components/hoefe/entdecken-teile.tsx`, `src/components/hoefe/hof-kurzkarte.tsx`, `src/components/startseite/hoefe-in-der-naehe.tsx`, `src/components/hofseite/produkt-karte.tsx` (je nur `<LadePunkt />` im bestehenden Link und `relative` am Link, wo es fehlt). (b) `src/components/hoefe/hoefe-client.tsx` (nur der letzte `return`, die schmale Liste), `src/app/(public)/hoefe/loading.tsx`. (c) `src/lib/cookie-hinweis.ts`, `src/components/cookie-banner.tsx`, `tests/cookie-hinweis.test.ts`. Tests; DESIGN_SYSTEM (Absätze zu Ladeansicht und Cookie-Hinweis). Die Dateien unter `hoefe/**`, `hofseite/**`, `startseite/**` hat Lauf 33 Nr. 271 zuletzt geändert (vor dem Start gemergt); 306 (Abschnitt C) hat `hofseite-kunde.tsx` geändert, nicht `produkt-karte.tsx`. In `produkt-karte.tsx` bleibt das `aria-label` „<Produktname> in den Korb legen“ Zeichen für Zeichen (Griff des Browser-Tests aus 307).
Ausgangslage (geprüft 10.11.2026, main efc52874b):
- Hofseite und Produktseite zeigen ein Skelett, aber erst nach einer ersten Prüfung auf dem Server (`src/app/(public)/[farmSlug]/page.tsx`:159, Anker „<Suspense fallback={<HofseiteSkelett />}>“; `hofseite-skelett.tsx`, Kommentar „Seit Nr. 117 keine `loading.tsx` mehr“). Bis dahin bleibt nach dem Tipp die alte Seite ohne Rückmeldung stehen. Der Baustein dafür ist `LadePunkt` (`src/components/ui/lade-punkt.tsx`, nutzt `useLinkStatus`); Hofkarten und Produktzeilen nutzen ihn nicht (kein Treffer in `src/components/hoefe`, `hofseite`, `startseite`).
- Höfe-Liste am Computer: Das Board w1-hoefe Bild 1 zeigt Liste links und Karte rechts. Der Code baut das, aber erst nach dem Hydrieren (`src/components/hoefe/hoefe-client.tsx`:79, Anker „function useIstBreit(): boolean“; :90 „() => false“; :613 „<div data-ansicht="split">“ mit „grid-cols-[minmax(0,480px)_minmax(0,1fr)]“). Vorher – und ohne JavaScript – steht die schmale Form in voller Breite: eine Spalte, Karten bis 1098 px (:700, Anker „<div className="mx-auto mt-4 flex max-w-[1146px] flex-col gap-3 px-4 pb-10 md:px-6">“). Das ist das Bild aus der Sichtprobe (F052 Hürde 14). Die Abnahme Lauf 33 hat bei 1440 keinen fehlenden Splitscreen gemeldet. Ob die Sichtprobe nur den Augenblick vor dem Hydrieren sah oder ob das Hydrieren in der Vorschau scheitert, ist nicht geprüft → Tor T2.
- Cookie-Hinweis: steht seit Nr. 46 über der höchsten festen Leiste (`src/lib/cookie-hinweis.ts`:52, Anker „export function cookieHinweisUnten(“; `src/components/cookie-banner.tsx`:100, Anker „className="fixed right-4 z-50 w-[calc(100vw-2rem)] sm:w-80"“). Am Handy stapeln sich damit Unterleiste (mit erhobenem Knopf rund 84 px), Warenkorb-Leiste (rund 56 px) und Hinweis (bei 390 px rund 105 px, weil der Text neben dem Knopf nur etwa 210 px breit läuft): zusammen rund 270 px, ein Drittel bis 40 % des sichtbaren Fensters. In der Kasse liegt er über dem Kaufknopf mit seinen Pflichtsätzen. Der Hinweis informiert nur (nur technisch nötige Cookies); er holt keine Einwilligung ein.
Entschieden:
- (a) Ladepunkt statt `loading.tsx` (Nr. 117 bleibt: echte 404).
- (b) Die schmale Form zeigt ab 1024 px schon die Spalten des Boards; nach dem Hydrieren übernimmt der Splitscreen ohne Sprung.
- (c1) Am Handy wird der Hinweis flacher, Wortlaut unverändert.
- (c2) Am Handy weicht der Hinweis, solange eine Kauf-Leiste über der Unterleiste steht oder eine feste Leiste höher als 120 px ist; er kommt zurück, sobald sie weg ist, bis „Verstanden“ getippt wurde (Startsatz).
Umsetzung:
1. Teil (a): In den Links, die zur Hofseite führen (Hofkarte der Liste und der Startseite, Kurzkarte der Karte: „Zum Hof“ bzw. die ganze Karte), und im Link der Produktzeile zur Produktseite ein `<LadePunkt />`; der Link bekommt `relative`, wo es fehlt. Lage des Punkts über `className` so, dass er nichts verdeckt (oben rechts in der Karte, `top-3 right-3 translate-y-0`). Keine weitere Änderung an Karten und Zeilen.
2. Teil (b): Im letzten `return` von `HoefeClient` (Liste unter 1024 px) bekommt die Hülle ab `lg` dasselbe Raster wie der Splitscreen: `lg:grid lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:px-6 lg:pb-12`; links `reihenfolgeHinweis` und `ergebnisse(false)` wie bisher, rechts `hidden lg:block` eine Fläche in der Höhe der Karte (`sticky top-20 h-[calc(100dvh-6rem)] min-h-[420px]`) mit dem vorhandenen `KarteLaedt` (`src/components/karte/karte-laedt`). `src/app/(public)/hoefe/loading.tsx` bekommt dasselbe Raster. Nach dem Hydrieren rendert `istBreit` wie heute den echten Splitscreen. Der Satz in DESIGN_SYSTEM „Die serverseitige Gestalt zeigen …“ bekommt die Ergänzung: ab `lg` trägt die schmale Form die Spalten des Splitscreens.
3. Teil (c1): Im Hinweis unter 640 px: Polster `p-2.5`, Text `text-[12.5px] leading-[1.3]`, Knopf `px-3` (Höhe 44 px bleibt). Wortlaut und Link „Mehr erfahren“ unverändert.
4. Teil (c2), nur mit Startsatz: `src/lib/cookie-hinweis.ts` bekommt `COOKIE_HINWEIS_WEICHT_AB_PX = 120` und die reine Funktion `cookieHinweisWeicht(leisten: readonly LeistenMass[], fensterHoehe: number, fensterBreite: number): boolean` – wahr, wenn `fensterBreite < 640` und die höchste belegte Höhe (dieselbe Rechnung wie `cookieHinweisUnten`) über 120 px liegt. `cookie-banner.tsx` misst wie heute und rendert bei `true` weder Hinweis noch Platzhalter (der Zustand „bestätigt“ wird nicht gesetzt). Die Unterleiste allein (rund 84 px) lässt den Hinweis stehen.
Tests (zuerst schreiben, rot sehen, dann bauen):
- (a) Render der Hofkarte und der Produktzeile mit gemocktem `useLinkStatus` (`pending: true`): `data-slot="lade-punkt"` steht im Link; Gegenprobe mit `pending: false`.
- (b) `tests/hydrieren.test.ts`: Fall „Höfe-Liste bei 1440“ – der Server-Teil enthält die Platzhalter-Fläche der Karte und keine Karte in voller Breite als einziges Kind; nach dem Hydrieren mit `matchMedia` „breit“ steht `data-ansicht="split"`, ohne Hydrationsfehler. Gegenprobe: alter letzter `return` → rot.
- (c) `cookieHinweisWeicht`: Unterleiste 68 px bei 390 → nein; Unterleiste plus Korb-Leiste (148 px) bei 390 → ja; Kaufknopf 130 px bei 390 → ja; dieselben Leisten bei 1024 → nein; ohne Leiste → nein. `cookieHinweisUnten` und seine Tests bleiben unverändert grün.
Nicht:
- Kein `loading.tsx` unter `[farmSlug]`; keine Änderung an `pruefeHofseiteGeteilt`, am Skelett, an `notFound()`.
- Keine Änderung am Splitscreen selbst, an Filtern, Chips, Karteninhalt oder an der Reihenfolge der Hofseite.
- Kein anderer Wortlaut im Cookie-Hinweis, keine Änderung an der Datenschutzerklärung, kein Entfernen des Hinweises.
- „Anmelden“ bleibt, wie es ist (Register N1).
Fertig, wenn:
- Bilder: `/hoefe` 1440 mit abgeschaltetem JavaScript (zwei Spalten, rechts die Platzhalter-Fläche) und nach dem Laden (Splitscreen); Hofseite 390 mit Ware im Warenkorb und unbestätigtem Hinweis (ohne Startsatz: Hinweis flacher über der Leiste; mit Startsatz: kein Hinweis, auf `/hoefe` wieder da); Kasse 390 ebenso.
- Messung: Höhe des Hinweises bei 390 px vorher und nachher im Bericht.
- `loading-filter-wache`, `hydrieren`, `cookie-hinweis` grün.
- Nur mit Teil (c2), „Für dich zu tun“: (c2) gilt nur, solange Stripe Link und Vercel Web Analytics aus sind (R2 Betriebsregel 3; Analytics ist im Code eingebunden, `src/app/layout.tsx:141`, ob es läuft, entscheidet die Einstellung bei Vercel). Schaltest du eins davon ein, vorher Recht fragen; dann kommt (c2) zurück.
Zeit: 3 h

──────────────────────────────────────────────────────────────────────
304b Tägliche Mail „Braucht dich“ – Opus, voller Durchgang (Sicherheits- oder Datenpfad: neue Betreiber-Mail, Zustellung, neuer Ablauf), Pflicht-Gegenlesen „Sicherheit“ (keine Personendaten, kein Fremdtext in der Mail), Migration: nein, stapelt auf 304 (Abschnitt C); nur mit Startsatz und nur, wenn Zeit
Hebt: Bedienbarkeit „Admin“ – der Schritt von 4 auf 4,5 (Fristen von 1 bis 24 Stunden erreichen den Betreiber auch ohne Blick in den Admin). F047 „Überblick“ → 5.
Startsatz: „Tägliche Mail Braucht dich freigegeben“ (beantwortet E-030: um 7 Uhr, nur wenn etwas offen ist, nur Zahlen und Namen der Quellen, abschaltbar). Fehlt er: Nummer nicht bauen.
Tore (trifft eines zu: Folge steht je Tor dabei, im Bericht melden):
- T1 Startsatz fehlt, oder 304 ist nicht im Zwischenstand (QUELLE_NAME fehlt).
- T2 Die Umsetzung bräuchte eine Migration, ein Paket oder eine Variable → nicht bauen, melden. (Geprüft: MailAuftrag.art ist Text, die Zustellregeln sind Json – es geht ohne.)
- T3 Nach Stunde 3,5 von Abschnitt G noch nicht begonnen → entfällt, „Lauf 35“ im Bericht (erste Streichkandidatin des Laufs).
Dateigrenze: src/lib/zustellung.ts (teilt mit 303 – vorher), src/schemas/postfach.ts (nur `brauchtDich` in `zustellRegelnSpeichernSchema`; das Schema ist mit `satisfies z.ZodType<Record<SchaltbareArt, boolean>>` an `SCHALTBARE_ARTEN` gebunden, sonst scheitert der Typecheck), tests/integration/postfach-eingang.int.test.ts (nur `brauchtDich: false` in den zwei Aufrufen von `speichereZustellRegeln`, :293 und :315 – Vorbereitung; das strenge Schema verlangt jede schaltbare Art, :315 erwartet `{ ok: true }`), src/schemas/mail-auftrag.ts (288, 296, 297 – vorher), src/server/mail-arten/betreiber.ts, src/server/mail-arten/index.ts (ein Eintrag in `RENDERER`; 297 – vorher), src/server/mail-arten/beispiele.ts (ein Beispiel), src/lib/betrieb-mails.ts (Name, Gruppe Betrieb, Eintrag in `NOCHMAL_NIE`, und das Beispiel in `MAIL_BEISPIELE`, Gruppe „betrieb“; 296, 297 – vorher), tests/mail-beispiele.test.ts (nur die Zahl :89 von 30 auf 31 und der Kommentar darüber: ein Beispiel ohne Board), tests/mail-wege-wache.test.ts (nur die Baufunktion in `WICHTIG`; 296, 297 – vorher), tests/mail-vorschau.test.ts (ein Fall in `FAELLE`; in `FUSS_JE_VORLAGE`, :695, der Eintrag `'braucht-dich.tsx': ['betrieb']`; 288, 296, 297 – vorher), tests/fixtures/mail-rechtsbloecke-280.json (nur die neuen Schlüssel des Falls und des Beispiels, `vorschau:…` und `beispiel:…`; Rahmen „Konflikte und Reihenfolge“; 288, 296, 297 – vorher), tests/zustellung.test.ts (nur die erwartete Vorgabe :30 um `brauchtDich: true` und `ALLES_AUS` :24 um `brauchtDich: false` ergänzen; sonst rot und der Typecheck scheitert), tests/cron-verwaiste-bestellungen.test.ts (nur `'/api/cron/braucht-dich'` in der Liste der Crons, :215–223), neu src/emails/braucht-dich.tsx, src/lib/email.ts (genau eine Baufunktion `baueBrauchtDich`, nach dem Muster `baueBriefkastenZusammenfassung`, :1174; keine `send…`-Funktion – den Versand macht der Worker über den Renderer; tests/mail-wege-wache.test.ts, Prüfung 1 und 2), neu src/app/api/cron/braucht-dich/route.ts, vercel.json (ein Eintrag), src/lib/betrieb.ts (ABLAEUFE ein Eintrag direkt vor `von-aussen` – tests/betrieb.test.ts:185–188 greift über `ABLAEUFE[0]` und `ABLAEUFE[3]` zu –, `AblaufName` um `'braucht-dich'`, und `wannText` für eine Liste von Stunden; 303 – vorher), tests/vercel-ignore.test.ts (nur: in der erwarteten Liste der Crons, :108–118, den Eintrag `{ path: '/api/cron/braucht-dich', schedule: '0 5,6 * * *' }` an der Stelle ergänzen, an der er in vercel.json steht; Titel des Falls um „und die tägliche Mail Braucht dich (Nr. 304b)“ ergänzen), tests/lebenszeichen.test.ts (nur: ein Lauf `lauf('braucht-dich', 2)` in `ALLE_PUENKTLICH` und in jeder Liste, die ein Fall aus einzelnen Läufen baut, :92, :118, :133–135 über `ohneMails`, :144, :167; in der erwarteten Liste des Falls „gar keine Zeile“, :128, `'braucht-dich'` an der Stelle aus ABLAEUFE; ein neuer täglicher Ablauf ohne Zeile fehlt sonst in jedem Fall, fail-closed), src/components/admin/postfach-zustellung.tsx (nur falls die neue Zeile nicht von selbst aus den Listen entsteht), docs/ai/ARCHITECTURE.md (Abläufe, Alarm-Matrix), Tests.
Ausgangslage (geprüft 10.11.2026, main efc52874b):
- Per Mail kommen sechs Arten (src/lib/zustellung.ts:24, Anker „export const ZUSTELL_ARTEN = [“); Aufgaben wie „Lastschrift zurückgebucht“ (1 h) kommen nicht per Mail.
- Muster vorhanden: Wochenlage (src/app/api/cron/briefkasten/route.ts: cronBerechtigt, mitHerzschlag, betreiberKennungen, betreiberAuftraege mit Tag im Schlüssel; Renderer zählt beim Versand frisch).
- Aufgaben-Titel können Fremdtext tragen (meldungTitel nimmt die erste Zeile einer Meldung, admin-aufgaben.ts:351-355) und Hofnamen (bezug.text).
- Crons laufen in UTC (vercel.json); 7 Uhr in Wien ist 05:00 oder 06:00 UTC.
Entschieden (mit dem Startsatz):
- E-030: täglich um 7 Uhr Wiener Zeit, nur wenn etwas offen oder überfällig ist, an die Empfänger der Betriebs-Mails, nur Zahlen und Namen der Quellen, abschaltbar wie die Wochenlage.
Umsetzung:
1. zustellung.ts: neue schaltbare Art 'brauchtDich' (Standard an) in ZUSTELL_ARTEN, SCHALTBARE_ARTEN, zustellRegelnSchema (auch im `.catch`-Ersatz, :44), ZUSTELL_STANDARD, ZUSTELL_REGEL_REIHENFOLGE (ans Ende), ZUSTELL_REGEL_TEXT: „Braucht dich – täglich um 7 Uhr, nur wenn etwas offen ist“. src/schemas/postfach.ts: `brauchtDich: z.boolean(ZUSTELLUNG_FEHLER.eingabe)` in `zustellRegelnSpeichernSchema`. Eine alte gespeicherte Regel ohne das Feld ergibt „an“ (wie bei den anderen Feldern über .default/.catch).
2. Mail-Art 'braucht-dich' (Weg „Wichtig“), Bezug nur `{ empfaengerId, tag }`. Der Renderer lädt beim Versand `ladeAdminAufgaben(jetzt, { mitBetrieb: true })` und baut je Quelle eine Zeile `${Anzahl} × ${QUELLE_NAME[quelle]}`, dazu „davon überfällig: n“; nie `aufgabe.titel`, nie `aufgabe.bezug`, nie `aufgabe.satz`. Ist beim Versand nichts mehr offen: verwerfen (`{ verworfen: 'nichts_offen' }`, Muster rendereAbholbereit). Betreff: `Braucht dich: ${mitAnzahl(n, 'Aufgabe', 'Aufgaben')}` (`mitAnzahl` aus `src/lib/format.ts:319`; `n` = Zahl der offenen Aufgaben, wie sie Heute zählt); die Zeile „davon überfällig: n“ nur bei n > 0 (`frist.ueberfaellig`, `src/lib/admin-aufgaben.ts:248`). Ein Knopf „Heute öffnen“ auf /admin. Vorlage im bestehenden Mail-Rahmen (src/emails/_layout.tsx), Aufbau wie betrieb-warnung.tsx. Der Renderer holt `baueBrauchtDich` mit `await import('@/lib/email')` wie `betreiber.ts:130` (Wache schwere-module).
3. Route /api/cron/braucht-dich: cronBerechtigt, mitHerzschlag('braucht-dich', …). `wannText` (src/lib/betrieb.ts) kann heute nur eine Stunde: Aus `0 5,6 * * *` würde `new Date('…T5,6:00…')` ein ungültiges Datum, `uhrzeitInWien` wirft, und Admin › Betrieb, Admin › Heute (`ablaufZeilen`) und die Warn-Mail brächen (tests/betrieb.test.ts:360 ruft `ablaufZeilen` über alle Abläufe). Deshalb nennt `wannText` bei einer Liste von Stunden jede Startzeit in Wiener Zeit, „täglich ab 06:00 und 07:00“ (Jänner) bzw. „täglich ab 07:00 und 08:00“ (Juli); eine Stunde allein wie heute. Sie stellt nur ein, wenn die Wiener Stunde 7 ist und mindestens eine Aufgabe offen ist; Schlüssel `braucht-dich:<Wiener Kalendertag>:<empfaengerId>` (höchstens eine Mail je Tag und Empfänger, auch bei zwei Läufen). vercel.json: `0 5,6 * * *`. ABLAEUFE: ein Eintrag mit Rhythmus täglich.
4. Ein Beispiel für Admin › Betrieb › E-Mails (beispiele.ts), erfundene Zahlen.
Tests (zuerst schreiben, rot sehen, dann bauen):
- Renderer: Stand mit einer Meldung, deren erste Zeile „Ruf mich an 0660 …“ lautet, und einem Hof mit Namen → das HTML enthält weder die Zeile noch den Hofnamen, aber „1 × Neue Meldung“; nichts offen → verworfen.
- Route: 05:00 UTC im Juli → eingestellt; 05:00 UTC im Jänner → nichts; 06:00 UTC im Jänner → eingestellt; zweiter Lauf am selben Tag → kein zweiter Auftrag; Regel aus → keine Empfänger; ohne Secret → 401.
- zustellRegelnAus({}) und zustellRegelnAus({ wochenbericht: false }) liefern brauchtDich true. `speichereZustellRegeln` ohne `brauchtDich` → Fehler (strenges Schema); mit allen fünf Werten → `{ ok: true }` (tests/integration/postfach-eingang.int.test.ts, die zwei Aufrufe um `brauchtDich: false` ergänzt).
- `wannText({ zeitplan: '0 5,6 * * *', rhythmus: 'taeglich' }, …)`: im Jänner „täglich ab 06:00 und 07:00“, im Juli „täglich ab 07:00 und 08:00“; `ablaufZeilen` über alle Abläufe wirft nicht; die übrigen Texte von `wannText` unverändert.
- Integration: Auftrag wird eingestellt und vom Worker gerendert (Resend gemockt).
- Wachen mail-beispiele, mail-wege, die Liste der Abläufe gegen vercel.json grün.
Nicht:
- Kein Push, keine SMS. Keine Mail ohne offene Aufgabe. Kein Name, keine Adresse, kein Text einer Meldung, kein Betrag.
- Keine Änderung an der Wochenlage und an „Erstattung offen“.
Fertig, wenn:
- „Für dich zu tun“: Bis zum ersten Lauf nach dem Deploy (05:00 UTC) meldet /api/lebenszeichen den Ablauf „braucht-dich“ als fehlend (fail-closed, Nr. 184) – eine GitHub-Mail „Lebenszeichen“ in dieser Zeit ist erwartet; am besten kurz vor 05:00 UTC mergen (im Winter 06:00 in Wien), dann ist die Lücke kurz.
- Im Prüf-Lauf (lokale DB, ohne Resend-Schlüssel) entsteht bei offener Aufgabe genau ein Auftrag je Empfänger und Tag; die Vorschau in Admin › Betrieb › E-Mails zeigt das Beispiel; Einstellungen › Benachrichtigungen hat die neue Zeile mit Schalter.
Zeit: 5,5 h

══════════════════════════════════════════════════════════════════════
NICHT (zusätzlich zum Rahmen und zu den Punkten „Nicht“ jeder Nummer)
══════════════════════════════════════════════════════════════════════
- Keine Online-Zahlung im Browser-Test, kein Stripe, keine echte Mail, kein `data-testid` und keine andere Änderung unter src/ durch 307.
- Kein `loading.tsx` unter `[farmSlug]`; keine Änderung am Splitscreen, an Filtern oder an der Reihenfolge der Hofseite; „Anmelden“ bleibt (Register N1).
- Kein Push, keine SMS; in der täglichen Mail kein Name, keine Adresse, kein Text einer Meldung, kein Betrag.
- Keine Migration, kein Paket, keine Variable.

══════════════════════════════════════════════════════════════════════
FERTIG, WENN
══════════════════════════════════════════════════════════════════════
- Rahmen „Fertig, wenn“ für die drei Nummern.
- 307: `pnpm pruefen:kasse` läuft im Container gegen die Wegwerf-DB dreimal in Folge grün und in der CI des PRs einmal grün (sonst Tor T4: nicht in die CI).
- 301: Wachen loading-filter-wache, hydrieren, cookie-hinweis grün; Höhe des Hinweises bei 390 px vorher und nachher im Bericht.
- 304b (falls gebaut): höchstens ein Auftrag je Empfänger und Tag; die Mail enthält weder Hofnamen noch Fremdtext (Test).
- `git diff --name-only <Basis>...integration/lauf34g -- prisma/ pnpm-lock.yaml .env.example src/lib/rechtstexte/ src/lib/widerruf.ts docs/recht/` leer.
- Morgenbericht des Laufs docs/nachtlauf/morgenbericht-<datum>-lauf34-g.md: zusätzlich zur Liste im Rahmen eine Tabelle über alle Abschnitte A bis G (je Nummer: fertig, Entwurf, entfallen mit Tor, nicht gebaut mangels Startsatz, nicht begonnen), je Bereich aus F052 der Stand vorher und nachher mit dem Satz aus „Hebt“ der gebauten Nummern (ehrlich: nur, was gebaut und gemergt ist), und die offenen Entscheidungen aus dem Rahmen („Nicht“).
Woran die Projektleitung den Erfolg erkennt: In der CI läuft ein Job „kasse“, der eine Bar-Bestellung im echten Browser durchspielt. Auf /hoefe steht am Computer von der ersten Sekunde an links die Liste und rechts die Fläche der Karte. Mit dem Startsatz kommt um 7 Uhr eine Mail „Braucht dich“, wenn in Heute etwas offen ist – nur mit Zahlen und Namen der Quellen.

Haltepunkt G: Rahmen §1 3.4; Ende des Laufs. „Für dich zu tun“ nennt mindestens: Sammel-PR G per Merge-Commit mergen; alle Einzel-PRs von Lauf 34 schließen; nicht gebaute Teile mit ihrem Startsatz für Lauf 35; die offenen Entscheidungen; die Ergänzungsliste an die Design-Gruppe.
