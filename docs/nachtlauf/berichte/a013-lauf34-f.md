Nachtlauf 34 · Abschnitt F – Abrechnung und Bestellung verknüpfen, Hof einrichten, CSV, Tempo (nach dem Live-Tag)
Ort: wie im Rahmen (Cloud-Sitzung auf Linux, alles Prüfen lokal im Container). Kein Claude in Chrome.
Basis: integration/lauf34f – von main, wenn der Sammel-PR von E gemergt ist; sonst vom Stand von integration/lauf34e (Rahmen §1 3.2).
Berührt (Sperrzonen): Recht-Wortlaut: nein (293 schreibt einen Fehlersatz für den Hof im Wortlaut von Recht, 298 und 299 Ergänzungen ohne Board; `ONLINE_ZAHLUNG_EINRICHTEN_SATZ` bleibt wörtlich; src/lib/rechtstexte/**, src/lib/widerruf.ts, docs/recht/** ohne Diff) · Kasse: nein (src/app/api/checkout/**, /api/reserve, /api/warenkorb/pruefen ohne Diff; 305 Tor T3) · /api/**: nein – 299 baut einen Route Handler im Hofbereich (src/app/(hof)/analytics/export/route.ts, Hof nur aus der Sitzung), keinen unter /api · Webhook: nein · Stripe-Beträge und Geldberechnung: 293 (keine Bestellung kommt auf die Rechnung einer zweiten Abrechnung; Beträge je Rechnung unverändert), 298 Teil (b) (Kontoanlage bei Stripe ohne `business_type`; Auszahlung, Gebühr und Händler-Rolle unverändert), 299 (nur gespeicherte Beträge, keine Umsatz-Aussage), 305 Teil B (Abbruch eines verfallenen Zahlungsvorgangs bei Stripe nach der Antwort der Hofseite; nie wird mehr Vorrat gezeigt, als da ist) · Auth: nein · Fristen (src/lib/fristen.ts): ohne Diff · Schema: 293 – eine Spalte `Order.monatsabrechnungId` mit Index und Fremdschlüssel (ON DELETE RESTRICT), nur mit Startsatz eine zweite Spalte `Order.abgerechnetCents`; kein Backfill (Rahmen „Freigegebene Migrationen“) · Pakete: nein · neue Variablen: nein · Werte in Entwicklungs- oder Produktionsdatenbank: nein (die Migration läuft über den Vorschau-Build in die Entwicklungsdatenbank, über den Merge in die Produktion) · Board-Dateien: nein · externe Dienste: nein

Diese Datei gilt nur zusammen mit dem Rahmen (docs/nachtlauf/berichte/a013-lauf34-rahmen.md): Dort stehen die Regeln für Startsätze, Pakete, Migrationen, Dateien mit mehreren Nummern, Vorprüfung (§0a), Haltepunkt (§1), Abnahme, Bericht und Morgenbericht. Die Sitzung liest den Rahmen ganz und diese Datei ganz, sonst keine Abschnittsdatei (Ausnahme: Rahmen §1 3.5).

══════════════════════════════════════════════════════════════════════
START UND ABBRUCH
══════════════════════════════════════════════════════════════════════
Start nur, wenn:
- Die Startnachricht lautet „Nachtlauf 34 fortsetzen“, in einer neuen Sitzung; Haltepunkt E ist laut Zeitbuch erreicht.
- Der Sammel-PR von E ist per Merge-Commit gemergt – oder noch offen: Dann setzt F auf dem Stand von integration/lauf34e auf (Rahmen §1 3.2). Per Squash gemergt: STOPP.
- Kein anderer Lauf oder Auftrag arbeitet am Repo; die Basis ist grün.
- Die Migration von 293 ist mit diesem Auftrag freigegeben (docs/nachtlauf.md §2 Regel 3): Ihr Wortlaut steht in 293 und im Rahmen unter „Freigegebene Migrationen“; das Vorwort an die Projektleitung nennt sie ausdrücklich. Die zweite Spalte gibt es nur mit ihrem Startsatz.
Schritt 0 des Dirigenten (vor der ersten Nummer):
- Rahmen §0a (ohne 1.2), dann der Doku-Schritt: diese Datei wörtlich als „### 38.5 Abschnitt F“ an §38 anhängen (Rahmen §1 3.3).
- Erwartet im Stand prüfen (Liste unten) und die Anker der vier Nummern (Rahmen §0a 1.9).
- 293: Vergleichsbasis der Migration festlegen (Rahmen „Freigegebene Migrationen“, Punkt 3) und ins Zeitbuch schreiben: `origin/main`, wenn dort alle früheren Migrationen des Laufs liegen; sonst das Schema des Integrationszweigs vor 293.
Startsätze dieses Abschnitts (gelten nur als eigene Zeile der Startnachricht dieses Abschnitts; Rahmen „Startsätze“):
- „Rückweg nach Abrechnung gesperrt freigegeben“ → 293, Schritt 6. Fehlt er: Der Rückweg bleibt wie heute.
- „Spalte abgerechnete Cent freigegeben“ → 293, zweite Spalte. Fehlt er: genau eine Spalte.
- „Rechtsform bei Stripe wählbar freigegeben“ → 298, Teil (b). Fehlt er: nur Teil (a).
- „Hofseite: Stripe-Abbruch nach der Antwort freigegeben“ → 305, Teil B. Fehlt er: nur Teil A.
Plan (Wanduhr ab Start, zwei Plätze; Budget je Nummer ist ihre Zeile „Zeit“):
- Vorprüfung und Doku-Schritt 0–0,25 h.
- Platz 1: 293 0,25–5,25 h → 298 5,25–7,25 h. Platz 2: 299 0,25–2,75 h → 305 2,75–6,75 h.
- Merges zusammen 0,5 h → gegen 7,75 h; Sammel-PR (mit Migrationsfolge auf frischer Wegwerf-DB), Aufräumen und Zwischen-Morgenbericht 1,5 h → Haltepunkt F gegen 9,25 h.
Abbruch und Unterbrechung: STOPP des Abschnitts nur nach Rahmen §0a 1.11 und docs/nachtlauf.md §5. Trifft der Lauf das Wochenlimit der API oder stürzt die Sitzung ab: sichern nach Rahmen §1 3.7, fortsetzen mit „Nachtlauf 34 fortsetzen“.

══════════════════════════════════════════════════════════════════════
AUSGANGSLAGE DES ABSCHNITTS
══════════════════════════════════════════════════════════════════════
Erwartet im Stand aus den Abschnitten A bis E (fehlt etwas, gilt Rahmen §1 3.5 und das Tor der Nummer):
- Kette der Monatsabrechnung: 290 ('geklaert'), 291 ('kleinbetrag'; fehlt es: 293 ohne Schritt 5), 292a (`ladeFehlendeMonate`, `ladeBestellungenFuerAbrechnung` in src/server/queries/plattformgebuehr.ts; fehlt es: 293 ändert die Funktion im Abrechnungs-Modul), 292b (`ohneTestzahlungenWhere` bzw. `abLiveTagWhere` im Lader).
- 296: Spalte `barErinnertAm` an `Order`, falls Teil (b) gebaut wurde (dann liegt schon eine Migration dieses Laufs vor).
- 297: `nichtAbgeholtMailAuftrag` bzw. `NICHT_ABGEHOLT_TEXT` (293 ändert in src/server/actions/orders.ts nur `revertPickedUp` und `revertOrderStatus`).
- A012 (vor Lauf 34 auf main): `src/lib/stripe-konto.ts` und `src/server/actions/stripe-connect.ts` sind geändert (Bereit-Regel mit EPS, Anzeige-Stand). 298 hängt in stripe-konto.ts nur eine Konstante an und ändert in `createConnectAccount` nur die eine Zeile; ihre Anker prüft Schritt 0 neu.
- 295 und 300: src/lib/nachladen.ts, src/components/hof-bestellungen/bestell-liste.tsx (305 Teil A).
- 302: Kapitel „## Monatsabrechnung der Plattformgebühr“ im Handbuch (293 Schritt 7).

══════════════════════════════════════════════════════════════════════
ENTSCHIEDEN (Rangfolge und Startbedingungen)
══════════════════════════════════════════════════════════════════════
- Rangfolge F: (am Haltepunkt E gesicherte Nummern, dann aus E verschobene) → 293 → 299 → 305 → 298 ‖ HALTEPUNKT F
- Startbedingungen: 293 nach 292b (bzw. dem letzten gebauten Glied der Kette), nach 296 (prisma/schema.prisma) und nach 297 (src/server/actions/orders.ts). 298 nach 293 auf Platz 1 (src/lib/stripe-konto.ts hat vor dem Lauf A012 geändert, keine Nummer des Laufs). 299 jederzeit. 305 Teil A nach 295 und 300 (D), Teil B nach 288 (B).
- Platz 1 (293 → 298) und Platz 2 (299 → 305) teilen keine Code-Datei (293 ändert src/server/actions/orders.ts, 305 ändert src/server/queries/orders.ts – zwei verschiedene Dateien). docs/ai/ARCHITECTURE.md ändern 293, 299 und 305 je in einem eigenen Absatz (mechanisch).
- Bilder: 298 (/settings/payments für „nicht verbunden“ und „Einrichtung nicht fertig“), 299 (Auswertung, Zeitraum Monat, mit dem Abschnitt „Für deine Buchhaltung“), 305 Teil A (Liste „Erledigt“ mit dem Hinweis, im Prüf-Bau mit kleiner Grenze); je 390 und 1440 px, hell und dunkel; Abnahme als „Ergänzung ohne Board“. 293 ohne Bild.

══════════════════════════════════════════════════════════════════════
UMSETZUNG – die Nummern dieses Abschnitts (Reihenfolge der Beschreibung, nicht die Rangfolge)
══════════════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────────────
293 Abrechnung und Bestellung verknüpfen (Migration), Rückweg nach der Abrechnung – Opus, voller Durchgang (Migration), Migration: ja, stapelt auf 292b (bzw. auf dem letzten gebauten Glied der Kette 290 → 291 → 292c → 292a → 292b); nach 296 (Migration) und 297 (orders.ts), beide Abschnitt E
Hebt: „Monatsabrechnung (SEPA, Bargebühr)“ und „Datenmodell, Migrationen“ 4, Befund H6 und Top-Risiko 1 aus Anhang T – eine Bestellung kann nicht mehr zweimal auf eine Rechnung kommen. Nicht 5: Korrekturen nach der Abrechnung bleiben Handarbeit (AGB 19.3); das ist eine offene Entscheidung (Vorwort, „Gebühr nach der Abrechnung“).
Startsatz: „Rückweg nach Abrechnung gesperrt freigegeben“ → nur Schritt 6. Ohne Satz: Markieren und „nie doppelt abrechnen“ werden gebaut, der Rückweg bleibt wie heute. · „Spalte abgerechnete Cent freigegeben“ → nur die zweite Spalte `Order.abgerechnetCents` (Schritte 1, 2 und 4, je der Zusatz). Ohne Satz: genau eine Spalte.
Tore (trifft eines zu: Folge steht je Tor dabei, im Bericht melden):
- T1 Die Freigabe nennt die Migration nicht (Regel 3) → überspringen.
- T2 `Order` hat schon eine Spalte, die auf die Abrechnung zeigt → nur das Fehlende, keine zweite Migration.
- T3 `prisma migrate diff` erzeugt mehr als die Anweisungen unten (drei; mit dem Startsatz „Spalte abgerechnete Cent freigegeben“ vier) → STOPP dieser Nummer, melden. Achtung Basis: Ist der Sammel-PR von Abschnitt E noch nicht auf main und hat 296 Teil (b) die Spalte `barErinnertAm` gebaut, zeigt der Vergleich gegen `origin/main` auch diese Spalte. Dann gilt Rahmen „Freigegebene Migrationen“, Punkt 3: Vergleichsbasis ist das Schema des Integrationszweigs vor 293; die Basis steht im Bericht.
Dateigrenze: `prisma/schema.prisma` (`Order`, `Monatsabrechnung`), neu `prisma/migrations/<Tag des Laufs, später als jede vorhandene, auch als die aus 296>_bestellung_monatsabrechnung/migration.sql`, `src/server/plattformgebuehr-abrechnung.ts` (`rechneHofAb`), `src/server/queries/plattformgebuehr.ts` (`ladeBestellungenFuerAbrechnung`; die Funktion steht nach 292a bzw. 292b in `src/server/queries/plattformgebuehr.ts`; nur wenn beide übersprungen sind, im Abrechnungs-Modul, dann ohne die Regel der Testzahlungen), nur mit Startsatz `src/lib/plattformgebuehr.ts` (eine Regel) und `src/server/actions/orders.ts` (`revertPickedUp`, `revertOrderStatus`). Tests: `tests/plattformgebuehr-abrechnung.test.ts`, `tests/plattformgebuehr.test.ts`, `tests/order-revert.test.ts`, `tests/rueckweg-zahlung.test.ts`, `tests/schema-expand.test.ts` (falls es Spalten zählt), `tests/integration/monatsabrechnung.int.test.ts`, `tests/integration/rueckweg-zahlung.int.test.ts`. Doku: `ARCHITECTURE.md`, `DEVELOPMENT.md`, `handbuch.md`. Teilt `src/server/actions/orders.ts` mit 288 (Abschnitt B, `lasseServicegebuehrEntfallen`) und 297 (Abschnitt E, `markAsNotPickedUp`) – beide vorher; `prisma/schema.prisma` mit 296 (Abschnitt E, vorher). In Abschnitt F arbeitet keine andere Nummer an diesen Dateien. `tests/handbuch.test.ts` nur, falls Schritt 7 ihn rot macht.
Ausgangslage (geprüft 10.11.2026, main efc52874b):
- Die Abrechnung wählt Barbestellungen nur über `pickedUpAt` im Monat (`src/server/plattformgebuehr-abrechnung.ts:174`, Anker „pickedUpAt: { gte: von, lt: bis }“). An der Bestellung steht nicht, dass sie abgerechnet ist (`prisma/schema.prisma:893–1013`); `Monatsabrechnung` hat keinen Bezug zu Bestellungen (:1285–1313).
- „Abholung rückgängig“ geht ohne Frist und leert `pickedUpAt` (`src/server/actions/orders.ts:265–296`, Anker „data: { status: 'READY', pickedUpAt: null“; ebenso `revertOrderStatus` :298–344). Neues „Abgeholt“ setzt den Zeitpunkt auf jetzt (:163–166). Folge: Rückweg nach der Rechnung und „Abgeholt“ im Folgemonat → dieselbe Gebühr steht ein zweites Mal auf der Lastschrift.
- Positionen der Rechnung tragen die Bestell-Kennung als `metadata.schluessel` (:205, :324); über 200 Zeilen eine Sammelzeile `sammel` (:207). `vorhandenePositionen` liest sie (:215–227).
- Der Stand wird erst nach dem Finalisieren gesetzt (:436). Bricht der Lauf dazwischen ab, findet der nächste die Rechnung als `open`/`paid` (:293–295) und rechnet die Summen neu – die Bestellungen können sich inzwischen geändert haben.
- Storno geht nicht aus „abgeholt“ (`src/server/stornieren.ts:137–143`, `ABHOLUNG_ERLEDIGT`), „Artikel fehlt“ und „nicht abgeholt“ auch nicht (`ARTIKEL_FEHLT_STATUS`, `orders.ts:486–490`). Der Rückweg ist also die einzige Tür, durch die eine abgerechnete Barbestellung wieder änderbar wird. Der Rücktritt nach der Abholung senkt die Gebühr ohne Rückweg (`src/server/widerruf.ts:525–533`).
- Fehler des Rückwegs zeigt der Dialog des Hofs schon an (`src/components/hof-bestellungen/bestell-detail.tsx:172–176`).
- Aufräumen der Integrationstests löscht Bestellungen vor den Abrechnungen (`tests/integration/setup/basis.ts:358`, :373). Kein Code unter `src/` löscht eine Abrechnung.
- Produktion: laut A007 (lesend 05.11.2026) 0 Abrechnungen; bis zum Stichtag gibt es dort keine `hofpreis`-Bestellung.
Entschieden:
- Spalte `Order.monatsabrechnungId` (Text, nullbar; Name wie `farmId`, `customerId`), Index, **Fremdschlüssel mit ON DELETE RESTRICT** auf `Monatsabrechnung.id`. Begründung: `SET NULL` würde beim Löschen einer Abrechnung still entmarkieren – die Bestellungen würden wieder abgerechnet. Ohne Fremdschlüssel bliebe ein Zeiger ins Leere möglich. `RESTRICT` passt zur Regel am Modell („Kein Löschen …: Aufbewahrungspflicht“). Die Spalte ist neu und überall null, die Prüfung des Schlüssels ist sofort fertig.
- Kein Backfill: In der Produktion gibt es keine Abrechnung. Abrechnungen aus Tests in der Entwicklungsdatenbank bleiben unmarkiert (wie heute). Ist beim Merge doch schon eine Abrechnung der Produktion finalisiert, kommt der Backfill als eigener Auftrag (aus den Positionen bei Stripe) – „Für dich zu tun“.
- Markiert werden genau die Bestellungen, deren Position an einer **finalisierten** Rechnung hängt (bar und online), und – wenn es den Stand gibt – die Bar-Zeilen eines Monats im Stand `kleinbetrag` (er ist für diesen Monat erledigt, E-021: kein Vortrag). Nicht markiert: erlassene, nicht abgeholte, stornierte.
- Eine markierte Bestellung kommt nie auf die Rechnung einer **anderen** Abrechnung.
- Mit Startsatz: „Abholung rückgängig“ lehnt bei einer markierten Bestellung mit Zahlung vor Ort ab. Online-Bestellungen bleiben frei (ihre Abrechnung hängt an der Zahlung, nicht an der Abholung; sonst wäre ein Storno über die App versperrt). Satz für den Hof, wörtlich (Wortlaut von Recht, R-Prüfung Teil 3, 293: Der Satz nennt den Weg, den AGB 19.3 zusagt): „Diese Bestellung steht schon auf einer Monatsabrechnung. Die Abholung lässt sich deshalb hier nicht mehr zurücknehmen. Stimmt etwas nicht – etwa weil die Ware doch nicht abgeholt wurde –, schreib uns über „Problem melden“. Wir prüfen es und schreiben dir die Gebühr gut, wenn sie nicht angefallen ist.“
- RLS: keine neue Tabelle; `Order` behält seine Regeln, eine Spalte braucht nichts.
- Nur mit dem Startsatz „Spalte abgerechnete Cent freigegeben“ (Koordinator, 09.11.2026, nach dem Vorschlag des Entwurfs): zweite Spalte `Order.abgerechnetCents` (Int, nullbar, ohne Vorgabe, ohne Index, kein Backfill) – die Cent, mit denen die Bestellung auf der Rechnung ihrer Abrechnung steht; bei einem Monat im Stand `kleinbetrag` 0. Gesetzt wird sie im selben Schreiben wie `monatsabrechnungId`, nie später geändert. In diesem Lauf liest sie niemand; sie bereitet die offene Entscheidung „Gebühr nach der Abrechnung“ vor (sonst kostet es später eine zweite Migration).
Umsetzung:
1. Schema: an `Order` `monatsabrechnungId String?`, `monatsabrechnung Monatsabrechnung? @relation(fields: [monatsabrechnungId], references: [id], onDelete: Restrict)`, `@@index([monatsabrechnungId])` mit Kommentar (wofür, kein Backfill); an `Monatsabrechnung` `bestellungen Order[]`. Nur mit dem Startsatz zur zweiten Spalte zusätzlich an `Order`: `abgerechnetCents Int?` mit Kommentar (wofür, kein Leser in Lauf 34).
2. Migration ohne Datenbank nach Regel 3 (`--from-schema` = die Vergleichsbasis, die Schritt 0 des Abschnitts ins Zeitbuch geschrieben hat: `git show origin/main:prisma/schema.prisma` oder das Schema des Integrationszweigs vor 293, Rahmen „Freigegebene Migrationen“ Punkt 3; `prisma migrate diff … --script`). Die Datei enthält nach dem Kopfkommentar (Zweck, „NUR ADDITIV“, Deploy-Fenster: alter Code kennt die Spalte nicht und schreibt unverändert) genau:
   ```sql
   SET lock_timeout = '5s';
   ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "monatsabrechnungId" TEXT;
   CREATE INDEX IF NOT EXISTS "Order_monatsabrechnungId_idx" ON "Order"("monatsabrechnungId");
   DO $$ BEGIN
     ALTER TABLE "Order" ADD CONSTRAINT "Order_monatsabrechnungId_fkey" FOREIGN KEY ("monatsabrechnungId") REFERENCES "Monatsabrechnung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;
   ```
   Nur mit dem Startsatz zur zweiten Spalte steht nach der Zeile mit `"monatsabrechnungId" TEXT` zusätzlich: `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "abgerechnetCents" INTEGER;`
   Prüfen: `pnpm test:integration` (lokale Test-Datenbank), danach `migrate deploy` auf einer frischen lokalen Wegwerf-Datenbank und `migrate diff --from-config-datasource … --exit-code` ohne Unterschied; die Migration zweimal ausführen (zweites Mal ohne Fehler).
3. Lader: `ladeBestellungenFuerAbrechnung(farmId, von, bis, abrechnungId: string | null, …)` nimmt nur Bestellungen mit `monatsabrechnungId` null oder gleich `abrechnungId`. Die Bedingung wird ein `AND` aus den drei Zweigen (`OR`), der Markierung (`OR`) und – falls 292b sie eingebaut hat – der Regel der Testzahlungen als drittem Element (nicht als Spread daneben: Die Wache verbietet ein eigenes `AND` neben dem Spread). `rechneHofAb` gibt `vorher?.id ?? null` mit.
4. Markieren, eine Hilfsfunktion `markiereAbgerechnet(abrechnungId, farmId, rechnung, zeilen)`: war die Rechnung in diesem Lauf `draft` und wurde jetzt finalisiert → Kennungen aus `zeilen`; war sie beim Eintritt schon `open`/`paid` (Abbruch davor) → Kennungen aus `vorhandenePositionen(rechnung.id)`, bei `sammel` aus `zeilen`. Dann `prisma.order.updateMany({ where: { id: { in }, farmId, monatsabrechnungId: null }, data: { monatsabrechnungId: abrechnungId } })`. Aufruf: nach dem Finalisieren (und „bezahlt außerhalb“ bzw. Gegenbuchung) der Rechnung online; nach Finalisieren und Senden der Rechnung bar, **vor** dem Setzen des Stands `offen` (:436). Wirft das Markieren, bleibt die Abrechnung im Entwurf; der nächste Lauf markiert über die Positionen und setzt dann den Stand. Wirft das Markieren: zusätzlich `warnung('Monatsabrechnung: Bestellungen nicht markiert', 'markieren', { farmId, monat })`. Der Bericht nennt den Restfall: Setzt ein Webhook den Stand vor dem nächsten Lauf auf „bezahlt“ oder „gescheitert“ (`behandleRechnungBezahlt` bzw. `behandleRechnungGescheitert` auch aus `entwurf`), bleibt die Abrechnung unmarkiert – kein Code-Weg holt das nach; dann von Hand nachmarkieren (Auftrag). Nur mit dem Startsatz zur zweiten Spalte: Im selben Schreiben bekommt jede Bestellung `abgerechnetCents` = die Cent ihrer Position (aus `zeilen`; war die Rechnung schon `open` oder `paid`, aus dem Betrag der Position bei Stripe; bei der Sammelzeile aus `zeilen`). Weil `updateMany` nur einen Wert je Aufruf setzt: je Betrag ein bedingtes `updateMany` (gleiche Bedingung wie oben), alle in einer Transaktion.
5. Gibt es den Stand `kleinbetrag` (291 gebaut): im selben Schritt wie der Standwechsel die Bar-Zeilen markieren (in einer Transaktion mit dem bedingten `updateMany` des Stands); mit dem Startsatz zur zweiten Spalte dabei `abgerechnetCents: 0`.
6. Nur mit Startsatz: `src/lib/plattformgebuehr.ts`, rein: `abholungRueckwegGesperrt(b: { monatsabrechnungId: string | null; paymentMethod: string })` = markiert und nicht `ONLINE`. `revertPickedUp` und `revertOrderStatus` (nur der Weg aus `PICKED_UP`): `monatsabrechnungId` mitlesen; gesperrt → `{ error: <Satz> }`, nichts schreiben. Zusätzlich im bedingten `updateMany` `monatsabrechnungId: null` bzw. den gelesenen Wert als Bedingung, damit ein Lauf zwischen Lesen und Schreiben nicht überholt wird.
7. Doku: `ARCHITECTURE.md` (Bezug Bestellung ↔ Abrechnung, wann markiert wird, warum `RESTRICT`), `DEVELOPMENT.md` (Fachregel; kein Backfill und warum), `handbuch.md` im Kapitel „Monatsabrechnung der Plattformgebühr“ (aus 302; fehlt es: unter „Monatsende (Geld)“): „Gebühr nach der Abrechnung falsch → Gutschrift von Hand bei Stripe zur Rechnung, AGB 19.3; nie über den Kundensaldo“.
Tests (zuerst schreiben, rot sehen, dann bauen):
- Lauf: (a) nach dem Finalisieren tragen genau die Bar- und Online-Zeilen die Kennung der Abrechnung; erlassene, nicht abgeholte nicht. (b) Rückweg, neues „Abgeholt“ im Folgemonat → die Bestellung fehlt auf der Rechnung des Folgemonats (Lader bekommt sie nicht). (c) Entwurf, zweiter Lauf: die schon markierten Bestellungen derselben Abrechnung zählen weiter mit. (d) Abbruch nach dem Finalisieren (Rechnung `open`, Stand `entwurf`, nichts markiert), eine Bestellung inzwischen zurückgenommen → markiert wird nach den Positionen der Rechnung, auch die zurückgenommene. (e) Markieren wirft → Stand bleibt `entwurf`, kein Protokoll „erstellt“. (f) bar 0, online 120 → nur die Online-Zeilen markiert, Stand `nichts`. (g) mit 291: `kleinbetrag` markiert die Bar-Zeilen. (h) nur mit dem Startsatz zur zweiten Spalte: Jede markierte Bestellung trägt die Cent ihrer Position; die Summe je Rechnung ist deren `total`; `kleinbetrag`-Zeilen tragen 0; ein zweiter Lauf ändert keinen Wert. Ohne den Startsatz gibt es die Spalte nicht (Test am Schema).
- Regel: `abholungRueckwegGesperrt` – bar markiert → true; online markiert → false; unmarkiert → false.
- Mit Startsatz, Actions: markierte Barbestellung → Satz, kein `updateMany`; markierte Online-Bestellung → Rückweg wie heute; unmarkiert → wie heute; fremder Hof → wie heute „inzwischen geändert“. Ohne Startsatz: diese Tests entfallen, die bestehenden bleiben grün.
- Integration (echtes Postgres): Februar abrechnen → Spalte gesetzt; eine Abrechnung mit markierter Bestellung lässt sich nicht löschen (Fremdschlüssel); Aufräumen der Tests läuft durch.
- Wachen: `migrationen-wache`, `schema-expand`, `testzahlung-wache`, `geld-number`, `decrement` grün.
Nicht:
- Kein Backfill, kein Daten-Update. Ohne den Startsatz „Spalte abgerechnete Cent freigegeben“ keine zweite Spalte (abgerechneter Betrag); in keinem Fall eine Gutschrift oder eine Korrekturzeile im Folgemonat (offene Entscheidung, Vorwort). Nichts an `widerruf.ts`, `stornieren.ts`, `artikel-fehlt.ts`. Kein Verstecken des Knopfs „Abholung rückgängig“ (kein Umbau der Oberfläche). Die gepushte Migrationsdatei wird nie mehr geändert.
Fertig, wenn:
- Alle Tests grün, voller Lauf und Integration grün, Migrationsfolge auf frischer Datenbank ohne Unterschied, PR offen mit „enthält Migration: ja“ und dem SQL im PR-Text.
- „Für dich zu tun“: vor dem Merge lesend bestätigen, dass die Produktion keine Abrechnung außerhalb von `entwurf` hat (sonst Backfill-Auftrag); erscheint in Sentry „Bestellungen nicht markiert“, die Abrechnung prüfen und das Nachmarkieren beauftragen; die offene Entscheidung „Gebühr nach der Abrechnung“ (Vorwort). Migration beim Merge beobachten: Greift `lock_timeout` (5 s), bricht `vercel-build` ab, und der alte Code läuft weiter. Dann `prisma migrate resolve --rolled-back <Ordnername der Migration>` und erneut deployen; ein zweiter Lauf ist durch `IF NOT EXISTS` und den `DO`-Block gefahrlos. Gestapelt (E nicht gemergt, F schon): zuerst E mergen und beobachten, dann F.
- Register-Vorschlag im Bericht, wörtlich (den Wortlaut gibt die Projektleitung frei; der Lauf trägt ihn nicht ein): „Jede Bestellung steht höchstens auf einer Monatsabrechnung.“ Mit dem Startsatz zum Rückweg dazu: „Die Abholung einer Barbestellung, die auf einer Monatsabrechnung steht, lässt sich nicht mehr zurücknehmen.“
Zeit: 5 Stunden.

──────────────────────────────────────────────────────────────────────
298 Vor dem Stripe-Schritt: „Das brauchst du“ und Rechtsform bei Stripe – Opus, Teil (a) gezielt, Teil (b) voller Durchgang (Sicherheits- oder Datenpfad: Kontoanlage bei Stripe), Migration: nein, zweigt vom Zwischenstand von Abschnitt F ab (nach 293 auf Platz 1; keine gemeinsame Datei mit 293, 299, 305)
Hebt: „Hof einrichten“ von 3 auf 3,5, der Stripe-Schritt von 2 auf 3 – der Hof weiß vorher, was er bereithält, und eine Gesellschaft kann sich richtig anmelden; ehrlich nicht 5, weil Pflicht und Kür weiter gemischt sind und die Abholzeit kein eigener Schritt ist (beides braucht ein Board).
Startsatz: „Rechtsform bei Stripe wählbar freigegeben“ – gilt für Teil (b). Teil (a) braucht keinen.
Tore (trifft eines zu: Teil überspringen, im Bericht melden):
- T1 Teil (a): Auf `/settings/payments` steht schon eine Liste mit „IBAN“ oder „Ausweis“ → (a) überspringen. Am Stand main efc52874b nicht zutreffend: Lauf 33 Nr. 278 hat die Seite umgebaut, aber keine solche Liste gebaut.
- T2 Teil (a): Die Karte „Online-Zahlung (Stripe)“ gibt es nicht mehr an dieser Stelle (Anker „<h2 id="online-titel"“ fehlt in `src/app/(hof)/settings/payments/page.tsx`) → Stelle per `git grep "PaymentsActions"` suchen; die Karte steht direkt über dem Aufruf.
- T3 Teil (b): Startsatz fehlt, oder die Zeile „business_type: 'individual',“ steht nicht mehr in `createConnectAccount` → nicht bauen bzw. melden.
Dateigrenze: `src/lib/stripe-konto.ts` (neue Text-Konstante), `src/app/(hof)/settings/payments/page.tsx` (nur das Einhängen der Karte), `src/server/actions/stripe-connect.ts` (nur die eine Zeile, nur mit Startsatz), Tests. `page.tsx` hat Lauf 33 Nr. 278 zuletzt geändert (vor dem Start gemergt). `src/lib/stripe-konto.ts` und `src/server/actions/stripe-connect.ts` hat Auftrag A012 vor dem Lauf geändert (Bereit-Regel, Anzeige-Stand); die neue Konstante kommt ans Ende von stripe-konto.ts, in `createConnectAccount` ändert 298 nur die eine Zeile (Anker neu prüfen).
Ausgangslage (geprüft 10.11.2026, main efc52874b):
- Vor dem Knopf steht nur „Dauert etwa 10 Minuten.“ (`src/lib/konditionen.ts`:321, Anker „export const ONLINE_ZAHLUNG_EINRICHTEN_SATZ“, wörtlich aus freigabe.md §10 – bleibt). Kein Wort zu IBAN oder Ausweis (kein Treffer in `src/`). Seit Lauf 33 Nr. 278 stehen die offenen Hinweise der Seite als `Hinweiskasten` (G3, Warnton, ohne Symbol) über der Karte „Online-Zahlung (Stripe)“ (Anker „<section aria-labelledby="online-titel"“); „Dauert etwa 10 Minuten.“ steht im Kasten mit dem Titel `ONLINE_ZAHLUNG_EINRICHTEN_TITEL`. Die Karte „Das brauchst du“ ist keine Warnung und bleibt `Hinweiskarte ton="neutral"` (`src/components/ui/hinweiskarte.tsx`, Ton `neutral` vorhanden).
- Einrichten und Heute führen zum Knopf auf `/settings/payments` (`src/lib/einrichten.ts`:186, Anker „label: 'Mit Stripe einrichten'“; `src/app/(hof)/settings/payments/payments-actions.tsx`:167). Nach einem Abbruch steht „Die Einrichtung bei Stripe ist noch nicht ganz fertig. Bitte setz sie fort.“
- Das Konto wird fest als Einzelperson angelegt (`src/server/actions/stripe-connect.ts`:91, Anker „business_type: 'individual',“; :102 „mcc: '5499'“; :103 `product_description`).
- Stripe-Doku (gelesen 09.11.2026, „Using Express connected accounts“): Das Formular fragt nicht nach Angaben, die die Plattform vorbelegt hat; es lässt sie nur bestätigen. Mit der festen Vorbelegung kann eine GesbR, KG oder GmbH also nicht als Unternehmen anmelden. Ohne Vorbelegung fragt Stripe die Art des Unternehmens selbst ab.
- Boards: s2-/w2-hofdaten-zahlung Bild 5 zeigt keine Liste „Das brauchst du“; s2-/w2-registrieren zeigt fünf Schritte, „Hofseite einrichten 2 von 5 – es fehlen Fotos, Abholzeiten und Über uns“, keine getrennte Abholzeit.
Entschieden:
- Karte „Das brauchst du“ als Ergänzung ohne Board, an genau einer Stelle: auf `/settings/payments`, solange Stripe nicht fertig ist.
- `ONLINE_ZAHLUNG_EINRICHTEN_SATZ` bleibt wörtlich (Register vor Board, freigabe.md §37).
- Rechtsform nicht vorbelegen, Stripe fragt selbst (Startsatz). Branche (`mcc`) und Beschreibung bleiben vorbelegt – sonst kämen zwei weitere Fragen dazu. Bestehende Konten bleiben, wie sie sind.
- Teil (c) des Auftrags (Pflicht und Kür trennen, Abholzeit als eigener Schritt) wird nicht gebaut: Das Board zeigt es nicht.
- `punkte[1]` im Wortlaut von Recht (R-Prüfung Teil 3, 298 a): kein „Führerschein“ – ob Stripe in Österreich einen Führerschein annimmt, ist nicht geprüft; die Karte verspricht nichts, was Stripe ablehnt.
Umsetzung:
1. `src/lib/stripe-konto.ts`: `STRIPE_VORBEREITUNG = { titel: 'Das brauchst du', punkte: ['die IBAN des Kontos, auf das dein Geld kommen soll', 'einen amtlichen Lichtbildausweis (etwa Reisepass oder Personalausweis) – manchmal will Stripe ein Foto davon', 'dein Handy für einen Code per SMS'], rechtsform: 'Stripe fragt auch, ob du den Hof allein oder als Gesellschaft führst.', unterbrechen: 'Du kannst unterbrechen und später hier weitermachen.', warum: 'Stripe wickelt die Zahlungen ab und muss dafür wissen, wer das Geld bekommt – dazu ist Stripe gesetzlich verpflichtet. Ausweis und Kontodaten gibst du direkt bei Stripe ein.' } as const`.
2. `settings/payments/page.tsx`: in der Karte „Online-Zahlung (Stripe)“ direkt über `<PaymentsActions …>` – nur wenn `!farm.stripeAccountReady` – eine `Hinweiskarte ton="neutral"` mit `titel`, den Punkten als `<ul>`, darunter `unterbrechen` und `warum` als Absätze (13 px). Der Satz `rechtsform` steht als vierter Punkt nur, wenn Teil (b) gebaut ist (Konstante `RECHTSFORM_WAEHLBAR` in `stripe-konto.ts`, von Teil (b) auf `true` gesetzt). Keine Dauer in der Karte: „Dauert etwa 10 Minuten.“ steht auf derselben Seite schon im Hinweis darüber.
3. Teil (b): in `createConnectAccount` die Zeile `business_type: 'individual',` entfernen; sonst nichts (Typ `express`, Land, E-Mail, die drei Fähigkeiten, `mcc`, `product_description`, Idempotenz-Schlüssel beim Ersetzen unverändert). `RECHTSFORM_WAEHLBAR = true`. Kommentar an der Stelle: warum nicht vorbelegt (Stripe fragt selbst; Quelle Stripe-Doku „Create an Express connected account and prefill information“).
4. DEVELOPMENT.md: Notiz „Konto-Anlage ohne Rechtsform seit Nr. 298; Konten davor sind Einzelperson“.
Tests (zuerst schreiben, rot sehen, dann bauen):
- Seite (`renderToStaticMarkup`): ohne Konto und bei „Einrichtung nicht fertig“ steht „Das brauchst du“ mit „IBAN“ und „Lichtbildausweis“, aber nicht „Führerschein“; bei fertigem Konto nicht. Gegenprobe mit `stripeAccountReady: true`.
- Teil (b), `stripe.accounts.create` gemockt: Der Aufruf trägt kein `business_type`; `type`, `country`, `capabilities` (Karte, Überweisung, EPS), `business_profile.mcc` und der Idempotenz-Schlüssel beim Ersetzen sind gleich wie vorher (Vorher-nachher-Vergleich der Parameter). Vorher rot: Test „kein business_type“.
- `tests/stripe-pflicht.test.ts` bleibt grün (Satz unverändert).
Nicht:
- Kein eigenes Feld „Rechtsform“ in Agrilo, kein Umstellen bestehender Konten, kein Aufruf an Stripe in Tests oder im Lauf (nur gemockt).
- Keine Änderung an Einrichten-Schritten, an `src/lib/einrichten.ts`, am Balken, an `ONLINE_ZAHLUNG_EINRICHTEN_SATZ`.
- Kein Satz, der verspricht, was Stripe prüft oder wie lange es dauert.
Fertig, wenn:
- Pflicht-Gegenlesen „Recht“ für Teil (a) wörtlich im PR-Text: `punkte[1]` Zeichen für Zeichen wie oben.
- Pflicht-Gegenlesen „Geld“ und „Sicherheit“ für Teil (b) wörtlich im PR-Text (Aussage: Nur die Vorbelegung fällt weg; Auszahlung, Gebühr und Händler-Rolle ändern sich nicht).
- Bild `/settings/payments` 390 und 1440, hell und dunkel, für „nicht verbunden“ und „Einrichtung nicht fertig“.
- Im Morgenbericht unter „Für dich zu tun“: die drei Punkte der Karte im Probelauf gegen das echte Stripe-Formular (Testmodus) prüfen; mit Teil (b) einmal als Einzelperson und einmal als Gesellschaft durchklicken.
Zeit: 2 h (Teil a 1 h, Teil b 1 h)

──────────────────────────────────────────────────────────────────────
299 Monat als CSV für den Hof – Opus, voller Durchgang (Sicherheits- oder Datenpfad: neue Route mit Besitzprüfung), Migration: nein, zweigt vom Zwischenstand von Abschnitt F ab
Hebt: „Geld, Einstellungen“ von 3 auf 3,5 – der Hof hat zum Monatsende eine Liste für Buchhaltung und Steuerberatung, ohne den Betreiber zu fragen; ehrlich nicht höher, weil Gebührenwörter und „Wann kommt mein Geld“ offen bleiben.
Startsatz: keiner (Export der eigenen Bestelldaten des Hofs, ohne Kundendaten; kein Geld bewegt)
Tore (trifft eines zu: Nummer überspringen, im Bericht melden):
- T1 Es gibt schon eine `route.ts` unter `src/app/(hof)` oder einen Export-Knopf auf Auswertung oder Verkäufe (Lauf 33) → nicht bauen, melden.
- T2 `/analytics` liest den Zeitraum nicht mehr aus `?periode=` und `?zurueck=` (Anker „leseAuswertungZeitraum(await searchParams)“ fehlt in `src/app/(hof)/analytics/page.tsx`) → den Link trotzdem bauen, mit dem Monat aus der dort geltenden Quelle; geht das nicht eindeutig: nur Route und Tests, Link weglassen, melden.
Dateigrenze: neu `src/app/(hof)/analytics/export/route.ts`; neu `src/lib/hof-export.ts`; neu `src/server/queries/hof-export.ts`; `src/app/(hof)/analytics/page.tsx` (nur ein Link am Ende der Seite, nur bei Zeitraum „Monat“); neu `tests/hof-routen-wache.test.ts`; `tests/ladeansichten.test.ts` (nur die eine Ausnahme aus Schritt 5, falls die Wache den Ordner meldet); `docs/ai/ARCHITECTURE.md` (ein Satz, Schritt 6); Tests. Liest (ohne Änderung) `csvFeld` aus `src/lib/finanzen.ts`, `csvBetrag` aus `src/lib/format.ts`.
Ausgangslage (geprüft 10.11.2026, main efc52874b):
- CSV gibt es nur im Admin; Vorbild `src/app/admin/finanzen/export/route.ts` (Anker „const KOPF = { 'Cache-Control': 'no-store' } as const“): eigene Prüfung im Handler, `no-store`, `attachment`, BOM, Semikolon, CRLF.
- Schutz gegen Formeln und das Zahlenformat gibt es: `csvFeld` (`src/lib/finanzen.ts`:1027) und `csvBetrag` (`src/lib/format.ts`:104).
- Im Hofbereich gibt es heute keinen Route Handler; die Wache `tests/hof-seiten-wache.test.ts` prüft nur `page.tsx`. Der Proxy schützt `/analytics/**` über `FARMER_PATHS` (`src/lib/hof-pfade.ts`), die Seiten prüfen zusätzlich selbst mit `verlangeHofDerSitzung` (Hof aus der Sitzung, nie aus der Adresse; `src/server/hofbereich.ts`).
- Die Umsatzregel des Hofs zählt abgeholte Bestellungen nach `pickedUpAt` und nimmt Testzahlungen aus (`src/lib/umsatz.ts`:188, Anker „export function umsatzBestellungWhere(“; `ohneTestzahlungenWhere`).
- Beträge: Warenpreis `totalAmount` (Decimal), Gebühr `serviceFeeCents` (Cent), entfallen über `gebuehrEntfallen`; Wörter über `zahlartText`, `bestellMarke`, `gebuehrBezeichnungFuer`.
- Kein Board zeigt einen Export (s2-/w2-auswertung, s2-/w2-verkaeufe gelesen).
Entschieden:
- Ort: Auswertung, Zeitraum „Monat“ – der Hof blättert dort schon durch die Monate. Ergänzung ohne Board.
- Zeilen: alle Bestellungen des eigenen Hofs mit Abholtermin im Monat (Wiener Zeit), außer nie gültig gewordenen (`PENDING_CONFIRMATION`; storniert mit Grund `GRUND_NICHT_BESTAETIGT` oder `GRUND_ZAHLUNG_VERFALLEN`) und außer Testzahlungen (Register Z4). Eine vollständige Liste mit Stand, keine Umsatz-Aussage.
- Spalten ohne Kundendaten: kein Name, keine E-Mail, kein Telefon, keine Notiz, keine Betriebsnummer.
- Keine Spalte heißt „Umsatz“: Was steuerlich Umsatz ist, hängt am Gebührenmodell und ist Sache der Steuerberatung.
Umsetzung:
1. `src/lib/hof-export.ts` (rein): `EXPORT_MAX_ZEILEN = 5000`; `exportMonatAus(wert: string | null, jetzt: Date): Monatsschluessel` (gültig nur `JJJJ-MM` über `istMonatsschluessel` und nicht nach dem laufenden Monat; sonst der Vormonat); `bestellungenAlsCsv(zeilen): string` – `﻿`, `;`, `\r\n`; Kopf: `Abholtermin;Bestellnummer;Stand;Zahlart;Warenwert;Gebühr;Art der Gebühr;Gesamt;Erstattet;Abgeholt am`; jeder Text durch `csvFeld`, jeder Betrag durch `csvBetrag`. Werte: Abholtermin und „Abgeholt am“ als `TT.MM.JJJJ` in Wiener Zeit; Stand = `bestellMarke(status).text`; Zahlart = `zahlartText(…)`; Warenwert = `alsCents(totalAmount)`; Gebühr = 0, wenn `gebuehrEntfallen`, sonst `serviceFeeCents`; Art der Gebühr = `gebuehrBezeichnungFuer(…)`, leer bei Gebühr 0; Gesamt = Warenwert + Gebühr; Erstattet = `erstattetCents`.
2. `src/server/queries/hof-export.ts`: `ladeBestellungenFuerExport(farmId, monat, stripeLiveAb = STRIPE_LIVE_AB)` – `where: { farmId, pickupDate in [von, bis) aus monatsgrenzenWienFuer(monat), Ausschlüsse wie oben, ...ohneTestzahlungenWhere(stripeLiveAb) }`, `select` nur die Felder aus Schritt 1, `orderBy: [{ pickupDate: 'asc' }, { orderNumber: 'asc' }]`, `take: EXPORT_MAX_ZEILEN + 1`.
3. `src/app/(hof)/analytics/export/route.ts` (`GET`): zuerst `const { farmId } = await verlangeHofDerSitzung()`; Monat aus `?monat=` über `exportMonatAus`; mehr als `EXPORT_MAX_ZEILEN` Zeilen → 413 mit dem Text „Zu viele Zeilen für eine Datei. Bitte melde dich bei uns.“; sonst 200 mit `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="bestellungen-<JJJJ-MM>.csv"`, `Cache-Control: no-store`. Kein anderer Parameter wird gelesen; eine Hof-Kennung in der Adresse hat keine Wirkung.
4. `analytics/page.tsx`: bei `periode === 'monat'` am Ende der Seite ein Abschnitt mit Kicker „Für deine Buchhaltung“, dem Link (Umriss-Knopf `KNOPF_RAHMEN`, `<a href={`/analytics/export?monat=${monat}`} download>`) „Monat als CSV laden“ mit `aria-label="Bestellungen {Monat Jahr} als CSV laden"` und dem Satz: „Alle Bestellungen mit Abholtermin im {Monat Jahr} – ohne Namen und Kontaktdaten. Verkäufe, die du selbst eingetragen hast, stehen nicht darin.“ `monat` ist der Monat des gezeigten Fensters (`pf`), nie ein freier Wert.
5. `tests/hof-routen-wache.test.ts`: Jede `route.ts` unter `src/app/(hof)` ruft `verlangeHofDerSitzung` vor jeder Datenbank-Abfrage und setzt `no-store`; mit Gegenprobe (Schnipsel ohne Wache wird gefunden). Meldet `tests/ladeansichten.test.ts` den neuen Ordner: Ausnahme mit dem Grund „Route Handler, keine Seite“.
6. ARCHITECTURE.md: ein Satz „Route Handler im Hofbereich“ (Wache im Handler, Hof aus der Sitzung, `no-store`).
Tests (zuerst schreiben, rot sehen, dann bauen):
- `bestellungenAlsCsv`: Kopfzeile wörtlich; eine Bestellnummer, die mit `=` beginnt, ist entschärft; Beträge mit Komma („12,50“); entfallene Gebühr → 0 und leere Art; BOM am Anfang, CRLF am Ende.
- `exportMonatAus`: „2026-10“ bleibt; „2026-13“, „../x“, leer und ein künftiger Monat → Vormonat.
- Route (Sitzung gemockt): ohne Sitzung und mit einer Rolle ohne Hof leitet sie um und fragt die Datenbank nicht; mit Sitzung von Hof A geht `farmId` von A in die Abfrage, auch wenn `?hof=` oder `?farmId=` von B in der Adresse steht.
- Integration (lokales Postgres): zwei Höfe mit Bestellungen im selben Monat → die Datei von A enthält nur die Bestellnummern von A; kein Name, keine E-Mail, kein Telefon und keine Notiz der Seed-Kundschaft kommt im Text vor (Suche nach den Werten, mit Gegenprobe an der vollen Bestellung); verfallene und unbestätigte fehlen; Monatsgrenze 31.10. 23:30 und 1.11. 00:30 Wiener Zeit landet im richtigen Monat.
Nicht:
- Kein Export manueller Verkäufe, keine Kundenliste, kein PDF, kein Jahres-Export, kein Beleg mit Mehrwertsteuer (F052 L19).
- Keine neue Rechnung von Geld: nur gespeicherte Werte, Summe „Gesamt“ = Warenwert + Gebühr.
- `src/lib/finanzen.ts`, `src/lib/umsatz.ts`, der Admin-Export bleiben ohne Diff.
Fertig, wenn:
- Pflicht-Gegenlesen „Daten“ (keine Kundendaten, nur eigener Hof) und „Geld“ (nur gespeicherte Beträge, keine Umsatz-Aussage) wörtlich im PR-Text.
- Die Datei öffnet sich in einer Tabellenkalkulation mit zehn Spalten und Zahlen als Zahlen (Bild oder Beschreibung im Bericht).
- `hof-routen-wache`, `proxy-pfade`, `geld-number-wache` grün.
Zeit: 2,5 h

──────────────────────────────────────────────────────────────────────
305 Tempo: Bestellliste des Hofs lädt nur, was sie zeigt; Hofseite wartet nicht auf Stripe – Opus, voller Durchgang (Sicherheits- oder Datenpfad; Teil B: Fristfreigabe mit Stripe-Abbruch, Pflicht-Gegenlesen „Geld“), Migration: nein, zweigt vom Zwischenstand von Abschnitt F ab; Teil A nach 295 und 300 (Abschnitt D), Teil B nach 288 (Abschnitt B)
Hebt: Performance (3) → 3,5 mit Teil A, 4 mit Teil A und B. Nicht 5: Die Hofseite rechnet weiter bei jedem Aufruf (kein Zwischenspeicher – Vorrat muss frisch sein), die Kundenliste lädt weiter alles, zwei Riesen-Komponenten bleiben.
Startsatz: Teil A keiner. Teil B: „Hofseite: Stripe-Abbruch nach der Antwort freigegeben“ (ändert eine Regel in docs/ai/ARCHITECTURE.md). Fehlt der Satz: nur Teil A bauen, B melden.
Tore (trifft eines zu: Folge steht je Tor dabei, im Bericht melden):
- T1 Teil A: Anker „const zeilen = await prisma.order.findMany({ where: { farmId }, select: LISTE_AUSWAHL })“ fehlt in src/server/queries/orders.ts → Teil A überspringen (295 oder 300 hat die Abfrage umgebaut), melden.
- T2 Teil B: Anker „await gibVerwaisteFreiFuerSlug(farmSlug)“ fehlt in src/server/hofseite-vorschau.ts → Teil B überspringen.
- T3 Teil B bräuchte eine Änderung an src/lib/fristen.ts, an storniereUnbezahlteBestellung, an /api/reserve, /api/checkout oder /api/warenkorb/pruefen → nicht bauen, melden.
Dateigrenze: Teil A: src/server/queries/orders.ts (nur getBestellungenSeite, eine Konstante), src/lib/hof-bestellungen.ts (ein Hinweistext, eine Konstante), src/components/hof-bestellungen/bestellungen-ansicht.tsx (nur die Hinweiszeile unter der Liste „Erledigt“; nach 300 liegt die Liste selbst in bestell-liste.tsx – der Hinweis steht in bestellungen-ansicht.tsx unter dem Aufruf von `<BestellListe>`, bestell-liste.tsx bleibt ohne Diff), Tests. Teilt queries/orders.ts und bestellungen-ansicht.tsx mit 295 und 300 (Abschnitt D, vorher), hof-bestellungen.ts mit 300 und 297 (vorher), verwaiste-bestellungen.ts mit 288 (vorher, nur `export` an `brichZahlungAb`). Teil B: src/server/verwaiste-bestellungen.ts, src/server/hofseite-vorschau.ts, docs/ai/ARCHITECTURE.md (der Absatz „Eine offene Bestellung hat eine Frist“), Tests. Nie src/app/api/**, src/lib/fristen.ts, src/server/unbezahlte-bestellung.ts, src/server/queries/customers.ts.
Ausgangslage (geprüft 10.11.2026, main efc52874b):
- /orders lädt bei jedem Aufruf alle Bestellungen des Hofs samt Positionen und filtert im Speicher (orders.ts:273). Kopfzeile und Chips zählen nur offene Bestellungen (src/lib/hof-bestellungen.ts: bestellKopfzeile, filterChips; „Erledigt“ hat keine Zahl). Offen = OPEN_STATUSES, erledigt = ABHOLUNG_ERLEDIGT; zusammen alle Stände.
- Einen Baustein „Mehr laden“ oder Blättern gibt es nicht (grep über src und docs/ai/BAUSTEINE.md ohne Treffer).
- Hof- und Produktseite sind force-dynamic und rufen in ladeHofseite zuerst die Fristfreigabe (hofseite-vorschau.ts, Anker oben). Die liest alle offenen Bestellungen des Hofs; für jede überfällige Online-Bestellung mit PaymentIntent fragt sie Stripe (abrufen, abbrechen; je 5 s Zeitlimit, nacheinander; nach „bezahlt/in Bearbeitung“ oder Fehler 5 Minuten Pause je Instanz – verwaiste-bestellungen.ts:65, :96-113, :154-177). Bar-Bestellungen brauchen kein Stripe.
- Das Konto des Hofs fragt die Hofseite nie bei Stripe an; `stripeAccountReady` kommt aus der Datenbank.
- Regel heute (ARCHITECTURE.md:333): „Nicht nach der Antwort (after()/nachDerAntwort), solange die Seite Bestellungen oder Vorrat zeigt — sie zeigte sonst Verfallenes.“
- nachDerAntwort existiert (src/lib/nach-der-antwort.ts) und fällt ohne Request-Kontext auf sofortiges Starten zurück.
Entschieden:
- Listen: feste Grenze mit Hinweis, weil es keinen Baustein zum Nachladen gibt (Koordinator, Rahmen Lauf 34).
- Kein Zwischenspeichern von Vorrat; Kasse, Reservieren und Warenkorb-Prüfung bleiben unverändert (Koordinator).
- Teil B nur mit Startsatz: Die Projektleitung nimmt in Kauf, dass die öffentliche Hof- und Produktseite Vorrat, den eine verfallene Online-Bestellung hält, einen Aufruf länger als vergeben zeigt. Nie wird mehr Vorrat gezeigt, als da ist.
Umsetzung:
Teil A – Bestellliste
1. getBestellungenSeite lädt (a) die offenen Bestellungen (`status in OPEN_STATUSES`) mit LISTE_AUSWAHL – daraus Kopfzeile, Chips und die Gruppen für „Noch offen“ und „Heute abholen“ mit den bestehenden reinen Funktionen; (b) nur beim Filter „Erledigt“ die erledigten (`status in ABHOLUNG_ERLEDIGT`), neueste zuerst (pickupDate, pickupTimeStart absteigend, dann id), `take: ERLEDIGT_GRENZE + 1` mit ERLEDIGT_GRENZE = 500; (c) `hatBestellungen` = offene vorhanden oder erledigte geladen, sonst eine Abfrage `findFirst({ where: { farmId }, select: { id: true } })`.
2. Kommen 501 zurück: auf 500 kürzen und das älteste, angeschnittene Abholfenster ganz weglassen (jede gezeigte Gruppe ist vollständig, die Zahl im Gruppentitel stimmt); `mehrAeltere: true` an die Seite.
3. Mit `mehrAeltere` steht unter der Liste „Erledigt“ ein Satz in leiser Schrift: „Hier stehen die 500 neuesten erledigten Bestellungen. Suchst du eine ältere, schreib uns über „Problem melden“.“ (Zahl aus der Konstante.) Die Suche aus Nr. 300 sucht nur in den geladenen Zeilen; der Satz gilt damit auch für sie.
Teil B – Hofseite (nur mit Startsatz)
4. gibVerwaisteBestellungenFrei bekommt eine Option `ohneStripe`. Mit ihr werden überfällige Online-Bestellungen mit PaymentIntent nicht angefasst, sondern gezählt (`fuerSpaeter`); alles andere läuft wie heute (bar; online ohne PaymentIntent).
5. gibVerwaisteFreiFuerSlug ruft mit `ohneStripe` und startet bei `fuerSpaeter > 0` den vollen Lauf über `nachDerAntwort(() => gibVerwaisteFreiOhneRisiko(hof.id))`. Alle anderen Aufrufer (Reservieren, Warenkorb prüfen, Kasse, Bestätigen, die Seiten des Hofbereichs, der tägliche Ablauf) bleiben beim vollen, wartenden Lauf.
6. Idempotenz und Nebenläufigkeit unverändert: Storniert wird nur über storniereUnbezahlteBestellung (bedingter Statuswechsel, Rückbuchung des Vorrats in derselben Transaktion); zwei gleichzeitige Läufe buchen einmal zurück.
7. ARCHITECTURE.md: den Satz „Nicht nach der Antwort …“ ersetzen durch die neue Regel mit Datum und Startsatz: Ausnahme nur für den Stripe-Abbruch auf der öffentlichen Hof- und Produktseite; Bar-Bestellungen und alle Wege zum Kauf geben weiter vor dem Lesen frei.
Tests (zuerst schreiben, rot sehen, dann bauen):
- Teil A, Integration (echtes Postgres): Hof mit 3 offenen und 4 erledigten Bestellungen → Filter „Noch offen“, „Heute abholen“, „Erledigt“ liefern dieselben Gruppen, Titel, Chips und dieselbe Kopfzeile wie die reinen Funktionen über alle Bestellungen (Referenz im Test berechnet). Mit ERLEDIGT_GRENZE 5 (als Parameter der Abfrage für den Test) und 7 erledigten in drei Fenstern → höchstens 5 Zeilen, kein angeschnittenes Fenster, `mehrAeltere` true. Fremder Hof → leer.
- Teil A, Rendertest: mit `mehrAeltere` steht der Hinweis da, sonst nicht.
- Teil B (Stripe gemockt, `@/lib/nach-der-antwort` gemockt, sodass die Aufgabe gefangen wird): Hof mit einer überfälligen Bar- und einer überfälligen Online-Bestellung → nach ladeHofseite ist die Bar-Bestellung storniert und ihr Vorrat zurück, die Stripe-Attrappe wurde nicht gerufen; nach dem Ausführen der gefangenen Aufgabe wurde der PaymentIntent abgebrochen, die Online-Bestellung ist storniert, ihr Vorrat zurück. Ohne überfällige Online-Bestellung wird keine Aufgabe geplant. Stripe wirft → die Seite antwortet trotzdem, nichts ist storniert.
- Bestehende Tests zu verwaisten Bestellungen (tests/verwaiste-ohne-risiko.test.ts, tests/integration/verwaiste-bestellungen.int.test.ts, tests/hofseite-vorschau-laden.test.ts) bleiben grün; geänderte Erwartungen nur dort, wo sie die Hofseite betreffen.
- Wachen geld-number, geld-fliesskomma, decrement grün.
Nicht:
- Kein Umbau der Kasse, kein Zwischenspeicher für Hofseite, Preise oder Vorrat, kein neuer Takt für den täglichen Ablauf.
- Kundenliste (/customers) nicht – siehe „Bewusst weggelassen“.
- Keine Suche (das ist Nr. 300) und kein Blättern in den Bestellungen.
Fertig, wenn:
- /orders in den Filtern „Noch offen“ und „Heute abholen“ lädt keine erledigte Bestellung mehr (im Integrationstest belegt: Ein Spion auf prisma.order.findMany sieht für diese Filter keinen Aufruf ohne Bedingung auf den Status, und höchstens eine Zeile aus findFirst).
- Mit Startsatz: Der Test „Stripe-Attrappe nicht gerufen, bevor die Seite antwortet“ ist grün; ARCHITECTURE.md nennt die neue Regel.
- Pflicht-Gegenlesen „Geld“ zu Teil B wörtlich im PR-Text.
Zeit: 2 h Teil A, 2 h Teil B

══════════════════════════════════════════════════════════════════════
NICHT (zusätzlich zum Rahmen und zu den Punkten „Nicht“ jeder Nummer)
══════════════════════════════════════════════════════════════════════
- Kein Backfill, kein Daten-Update, keine zweite Migration. Die gepushte Migrationsdatei wird nie mehr geändert.
- Keine Gutschrift, keine Korrekturzeile im Folgemonat. Nichts an src/server/widerruf.ts, src/server/stornieren.ts, src/server/artikel-fehlt.ts.
- Kein eigenes Feld „Rechtsform“, kein Umstellen bestehender Stripe-Konten, kein Aufruf an Stripe im Lauf.
- Kein Export von Kundendaten, kein PDF, kein Beleg mit Mehrwertsteuer.
- Kein Zwischenspeicher für Hofseite, Preise oder Vorrat; Kasse, Reservieren und Warenkorb-Prüfung geben weiter vor dem Lesen frei.

══════════════════════════════════════════════════════════════════════
FERTIG, WENN
══════════════════════════════════════════════════════════════════════
- Rahmen „Fertig, wenn“ für die vier Nummern; Zwischen-Morgenbericht docs/nachtlauf/morgenbericht-<datum>-lauf34-f.md.
- 293: Migrationsfolge auf frischer lokaler DB ohne Unterschied; die Migration läuft zweimal ohne Fehler; PR mit „enthält Migration: ja“ und dem SQL; Wachen migrationen-wache, schema-expand, testzahlung-wache, geld-number, decrement grün.
- 298: tests/stripe-pflicht.test.ts grün (Satz unverändert); mit Teil (b) trägt `stripe.accounts.create` kein `business_type`.
- 299: Die Datei von Hof A enthält nur Bestellungen von Hof A und keinen Namen, keine E-Mail, kein Telefon, keine Notiz (Integrationstest); neue Wache hof-routen-wache grün.
- 305: Die Filter „Noch offen“ und „Heute abholen“ laden keine erledigte Bestellung mehr; mit Startsatz ist der Test „Stripe-Attrappe nicht gerufen, bevor die Seite antwortet“ grün.
- `git diff --name-only <Basis>...integration/lauf34f -- pnpm-lock.yaml .env.example src/lib/rechtstexte/ src/lib/widerruf.ts docs/recht/ src/app/api/ src/lib/fristen.ts` leer; unter prisma/ nur schema.prisma und der eine neue Migrationsordner.
Woran die Projektleitung den Erfolg erkennt: Nach einer Monatsabrechnung in der Testumgebung tragen die abgerechneten Bestellungen die Kennung ihrer Abrechnung (lesend in der Entwicklungsdatenbank zu sehen); eine Bestellung, deren Abholung zurückgenommen und im Folgemonat neu vermerkt wird, steht nicht ein zweites Mal auf der Lastschrift. Der Hof lädt in der Auswertung „Monat als CSV“; über dem Stripe-Knopf steht „Das brauchst du“.

Haltepunkt F: Rahmen §1 3.4. „Für dich zu tun“ nennt mindestens: vor dem Merge von Sammel-PR F lesend bestätigen, dass die Produktion keine Abrechnung außerhalb von „entwurf“ hat (sonst Backfill-Auftrag); Sammel-PR F per Merge-Commit mergen (gestapelt: zuerst E mergen und beobachten, dann F) und danach im Build-Log der Produktion die Migration ansehen – greift `lock_timeout` (5 s), bricht `vercel-build` ab, und der alte Code läuft weiter; dann `prisma migrate resolve --rolled-back <Ordnername der Migration>` und erneut deployen (ein zweiter Lauf ist durch `IF NOT EXISTS` und den `DO`-Block gefahrlos); die Karte „Das brauchst du“ im Probelauf gegen das echte Stripe-Formular prüfen; die offene Entscheidung „Gebühr nach der Abrechnung“; „Nachtlauf 34 fortsetzen“ für Abschnitt G mit den Startsätzen von G, je als eigene Zeile.
