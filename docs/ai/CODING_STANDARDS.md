# CODING_STANDARDS

Bei **jeder** Codeänderung lesen.

---

## 1. Namen

| Gegenstand | Konvention | Beispiel |
|---|---|---|
| Datei | `kebab-case.ts` | `order-totals.ts` |
| React-Komponente (Datei) | `kebab-case.tsx` | `cart-sheet.tsx` |
| React-Komponente (Name) | `PascalCase` | `CartSheet` |
| Hook | `use-*.ts` / `useX` | `use-cart.ts` |
| Funktion | `camelCase`, Verb zuerst | `pruefeWarenkorb` |
| Typ / Interface | `PascalCase`, kein `I`-Präfix | `WarenkorbPosition` |
| Konstante | `SCREAMING_SNAKE_CASE` | `RESERVIERUNG_TTL_MS` |
| Zod-Schema | `*Schema` | `checkoutSchema` |
| Test | `<thema>.test.ts` | `reservierung.test.ts` |

### Sprache in Bezeichnern
- **Fachbegriffe deutsch**, wenn die Domäne deutsch ist: `reservierung`, `warenkorb`, `hof`, `abholung`, `servicegebuehr`. Das ist die gewachsene Konvention der neueren Dateien — fortführen.
- **Technische Begriffe englisch**: `route`, `handler`, `schema`, `token`, `client`.
- **Prisma-Modelle und -Felder bleiben englisch** (`Order`, `stock`, `expiresAt`). Nicht umbenennen.
- **Nie mischen innerhalb eines Bezeichners**: `pruefeWarenkorb` ✅, `checkWarenkorb` ❌.
- Umlaute in Dateinamen und Bezeichnern ausschreiben: `servicegebuehr`, nicht `servicegebühr`.

---

## 2. Typisierung

- `any` ist **verboten**. Auch `as any`, `@ts-ignore`, `@ts-expect-error` ohne Begründungskommentar.
- Unbekanntes ist `unknown` + Zod-Parse, nie `any`.
- Rückgabetyp bei exportierten Funktionen **explizit** annotieren.
- Keine nicht-null-Assertion `!`, außer mit Kommentar, warum es sicher ist.
- Typen aus Prisma ableiten, nicht abschreiben: `Prisma.OrderGetPayload<…>`.
- Keine Typduplikate: Zod-Schema ist die Quelle → `type X = z.infer<typeof xSchema>`.

### Geld
- Prisma speichert Preise als `Decimal(10,2)`.
- **Nie** `Number(decimal)` für Rechnungen, die addiert oder multipliziert werden. Rundungsfehler landen auf der Rechnung des Hofs.
- **In reinen Funktionen wird Geld in ganzen Cent (Int) gerechnet; `Decimal` ↔ Cent nur an der Servergrenze, über Decimal-Methoden.**
  Ein Modul in `src/lib/` darf `prisma` nicht importieren (→ `ARCHITECTURE.md` §1),
  und `Prisma.Decimal` käme genau von dort. Also: die Servergrenze wandelt einmal
  (`betrag.mul(100).toNumber()` — **nie** `Number(betrag) * 100`, aus 19,99 €
  würde sonst 1998,9999999999998), die Fachregel rechnet in Cent, die Anzeige
  geht über `centsAlsEuro` + `formatEuro`. Vorbild: `src/lib/finanzen.ts`.
- **Einen Betrag auf Teile verteilen heißt exakt verteilen, nicht n-mal runden.**
  Rest = Betrag mod Anzahl; die ersten `Rest` Teile bekommen einen Cent mehr.
  Zwölfmal kaufmännisch gerundet ergäbe aus 100 € im Jahr 99,96 € — und die vier
  Cent stünden in keinem Monat (`kostenImMonat`).
- **Ausnahme Grundpreis-Vergleich:** Kilo-, Liter-, Tonnen- und Doppelzentnerpreise zum Vergleichen (Kilopreis-Sortierung auf /hoefe, Umfeld) rechnen als Zahl — `Decimal` → Zahl an der Servergrenze, dann `kilopreisNetto` bzw. `grundpreisJeKg`, Spanne und Median. Sie sind nur Anzeige, werden gerundet gezeigt und fließen **nie** in eine Abrechnung, einen Warenkorb oder einen Stripe-Betrag. Jeder gezeigte Grundpreis — Grundpreis-Zeile, Kilopreis auf Hof- und Produktseite, Produkttreffer und „ab €" auf /hoefe (`formatGrundpreisZeile`, `formatGrundpreisNetto`, `formatKilopreis`, `formatAbGrundpreis`, `grundpreisJeEinheit`) — rundet an EINER Stelle centgenau in ganzen Zahlen aus Preis und Menge (`grundpreisCents` in `format.ts`) — nie `Math.round(preis / menge * 100)` und nie die ungerundete Vergleichszahl (`kilopreisNetto`, `Grundpreis.wert`) selbst runden: € 2,01 für 2 kg ergäbe sonst € 1,00 statt € 1,01 / kg. Preis 0 hat keinen Grundpreis (null).
- **Getippte Euro-Beträge** (Admin-Felder wie die Mindestgebühr) werden über `euroEingabeZuCent` (`src/lib/format.ts`) zu ganzen Cent — über die Ziffern, Komma oder Punkt, höchstens zwei Nachkommastellen, sonst `null` und ein Satz an der Oberfläche (Mindestgebühr: `mindestgebuehrCent` in `admin-hoefe.ts`, leer = 0 €). Nie `Math.round(Number(text) * 100)`, nie Rohtext an den Server: Die Action nimmt nur die Cent-Zahl (Zod ohne `coerce`). Dasselbe für den Prozentsatz der Servicegebühr: `prozentsatzEingabe` (`admin-hoefe.ts`) macht aus dem Text die Zahl, das Schema nimmt nur `number`, nie `z.coerce`.
- **Decimal aus der Datenbank → Cent** nur über `alsCents`/`decimalZuCents` (`order-totals.ts`), auch in reinen Anzeige-Helfern wie `bestellSummen` — nie `Math.round(Zahl * 100)`.
- Rechnen in den vorhandenen Helfern: `src/lib/order-totals.ts`, `src/lib/servicegebuehr.ts`, `src/lib/finanzen.ts`. Auch reine Anzeige im Browser (Korbsumme, Zeilensumme) rechnet in Cent über `calcLineTotal` → `decimalZuCents` (Vorbild `korbBetraege` in `src/lib/hofseite-kunde.ts`), nie `price * quantity`.
- **Die Servicegebühr entsteht nur in `berechneServicegebuehr`** — immer aufgerundet auf den nächsten Cent, ganzzahlig in Hundertstel-Prozent gerechnet. Wer sie anzeigt, bildet den Warenpreis auf demselben Weg wie `/api/checkout` (`calcTotalAmount` → `decimalZuCents`); nach dem Bestellen gilt nur noch der Snapshot `Order.serviceFeeCents` (`bestellSummen`), nie eine Neuberechnung aus der Hofeinstellung. Den Satz für neue Höfe nehmen `SERVICEGEBUEHR_STANDARD_PROZENT`/`_MIND_CENTS`, nie eine Zahl im Code. Die Zahlungsart ist Pflichtparameter (Register B1): bar vor `BAR_SERVICEGEBUEHR_AB` kostet nichts. Wer fragt, ob eine Barbestellung Gebühr trägt oder der Plattform etwas einbringt, fragt `barOhneServicegebuehr` (Bestellzeitpunkt, Wiener Mitternacht; Texte `vorBarStichtag`) — nie ein eigener Datumsvergleich; die Zahlungsart ist dabei das Prisma-Enum (`Zahlungsart`), nie `string`; einzige Ausnahme ist rohes SQL (Admin-Hofliste), das dieselbe Bedingung mit der Konstante schreibt.
- **Umsatz und Servicegebühr ohne Testzahlungen (Register Z4).** Wer Bestellungen zu Umsatz oder Gebühr summiert, geht über `umsatzBestellungWhere` bzw. `topfVonBestellung` oder nimmt die Regel aus `src/lib/testzahlung.ts` (`istTestzahlung`, `ohneTestzahlungenWhere`, `ohneTestzahlungenSql`) — nie ein eigener Vergleich mit dem Stichtag, nie `null` statt des Stichtags. Die Prisma-Form steckt im `AND` (`{ AND: [{ NOT: … }] }`): Ein eigenes `NOT` daneben ist sicher, ein eigenes `AND` neben `...umsatzBestellungWhere(…)` ersetzte die Regel — dann die Bedingung als Element der eigenen `AND`-Liste nehmen. Welche Töpfe eine Zahl zählt, steht als Konstante (`GEZAEHLTE_TOEPFE`, `TOEPFE_IM_GEWAEHLTEN_MONAT`, `SERVICEGEBUEHREN_TOEPFE`); die Hinweiszeile nimmt dieselbe, nie eine zweite Liste. Die Anzeige zählt `GEZAEHLTE_TOEPFE` über die Konstante (`einnahmenImMonat`), „erwartet“ und die Zeilen der Servicegebühren über feste Felder — wer dort einen Topf ergänzt, zieht die Konstante mit. Reine Funktionen bekommen ihn als Pflichtparameter `stripeLiveAb: Date | null`; die Abfrage reicht ihn durch (Standard `STRIPE_LIVE_AB` aus `src/lib/umgebung-server.ts`, ARCHITECTURE §5 „Zahlungen“). `STRIPE_LIVE_AB` bindet nur `src/server/queries` ein, die Regel (`@/lib/testzahlung`) nur `src/lib` und `src/server/queries`. Auch eine Bestellzahl zählt Testzahlungen nicht mit (Z4, Ergänzung: Auswertung, Admin-Hofliste und Kunden zählen gleich). Ausnahme ist nur der Rest einer Liste, die alle Bestellungen zeigt (`alleBestellungen` für „N weitere …“ im Kundendetail) — er ist keine Kennzahl.
- Anzeigen ausschließlich über `src/lib/format.ts` (`formatEuro`, `formatMenge`, `formatPosition`, `formatGrundpreis`).
- **Preis-Semantik:** `price` ist der Preis je Gebinde, `unitSize` die Gebindegröße. Mit Gebinde schreibt die Anzeige „€ 50,00 für 2 kg" (nie „/ 2 kg"), darunter die Grundpreis-Zeile „€ 25,00 / kg" über `<GrundpreisZeile>` aus `src/components/shared/`. Bei Stück und Paket gibt es keine Grundpreis-Zeile. `grundpreisJeEinheit` ist nur Anzeige, nie Abrechnung.
- Nie ein eigenes Preisformat erfinden. Nie `toFixed(2) + ' €'`.

### Tage und Wochen
- Der Tag und die Woche eines Hofs sind **Wiener** Tag und Woche, nie Serverzeit (Vercel rechnet in UTC — um 0:30 Uhr stünde der Hof sonst im Gestern).
- Werkzeuge: `wienKalendertag`, `tagVersetzt`, `wienWochenMontag`, `wienWochenbeginn` (`src/lib/kalender.ts`), `wienerMitternacht` (`src/lib/wiener-tag.ts`, auch über `servicegebuehr.ts` erreichbar), `abholtage` und `wochenfenster` (`src/lib/heute.ts`).
- Verboten für neue Abfragen: `setHours(0, 0, 0, 0)`, `getHours()`, `startOfWeek` aus `date-fns` auf einem Serverzeitpunkt, `toLocaleDateString` ohne `timeZone: 'Europe/Vienna'`.
- Bestellungen eines Abholtags: `abholWhere(farmId, tag)` — dieselbe Bedingung für „Heute abholen", die nächste Abholung und die Packliste. Wie ein künftiger Tag im Hofbereich heißt („Morgen", Wochentag, Wochentag mit Datum), sagt `abholtagName`; ein Abholtermin für Kundinnen (Kasse, Hofseite) steht immer mit Wochentag und Datum über `formatTagKurz` („Sa, 10. Okt", `src/lib/format.ts`, aus dem Kalendertag JJJJ-MM-TT, seit Nr. 46) — nie ein eigenes Datumsformat daneben. Der Kalendertag ist immer der Wiener: `kalendertagInWien` (`src/lib/wiener-tag.ts`), `tagVersetzt`, `wochentagVon` (`src/lib/kalender.ts`) und für „jetzt" `uhrzeitInWien` — in Kasse (`angeboteneAbholfenster`) und Hofseite (`nextPickupDays`, seit Nr. 46, Runde 1) dieselben Helfer, nie `getDay()`/`getHours()` der Uhr, auf der der Code gerade läuft. Kurze Monatsnamen schreibt neuer Code fest (`MONAT_KURZ` in `format.ts`, auch für Achsen wie `monatOhneJahr`), nie über Intl `month: 'short'` — dessen Kürzel schwanken je nach ICU-Stand („Sep"/„Sep.", „Jul"/„Juli"); `monatKurz` (lange Achse der Finanzen, „Sep. 26") nimmt noch Intl.

### Serialisierung an Client-Komponenten
- `Decimal` und `Date` nicht roh übergeben.
- `Decimal` → in der Query in `string` oder bereits formatiert wandeln.
- `Date` → `toISOString()` oder fertig formatiert.
- **Was eine Seite nicht zeigen darf, geht nicht an eine Client-Komponente** — auch nicht ungezeigt: Props stehen in den Seitendaten. Die Server-Seite entfernt solche Felder vorher und typisiert die Komponente ohne sie, nie die gemeinsame Abfrage (Vorbild: Telefon und E-Mail des Hofs auf der Hofseite, `entferneKontaktdaten` und `HofseiteHof`, Nr. 60).
- **Kein `Date.now()`/`new Date()` beim Rendern einer Client-Komponente**, deren Ausgabe davon abhängt („vor 3 Stunden", Gebührensatz ab Stichtag, Abholtage): Die Seite bestimmt den Zeitpunkt einmal auf dem Server und reicht ihn als ISO-Text durch (`jetzt`, Vorbild `/[farmSlug]/page.tsx` → `HofseiteKunde`) — sonst weichen Server und Browser ab (Hydration-Fehler).

---

## 3. Validierung an Systemgrenzen

Systemgrenze = API-Route, Server Action, Webhook, URL-Parameter, `localStorage`, externe Antwort.

- **Jede** Systemgrenze validiert mit Zod. Ohne Ausnahme.
- Schemas liegen in `src/schemas/` und werden von Client **und** Server benutzt.
- Clientseitige Validierung ist Komfort, nie Schutz. Serverseitig immer erneut prüfen.
- In API-Routen `safeParse` (Antwort bauen), in Server Actions `parse` oder `safeParse` mit `{ error }`.
- `localStorage`-Inhalte (Warenkorb!) sind Fremddaten: parsen, validieren, bei Bruch verwerfen. Der Warenkorb nur über `leseWarenkorb`/`schreibeWarenkorb` (`src/lib/warenkorb-speicher.ts`), nie mit eigenem Schlüssel oder nacktem `JSON.parse`.

### Strukturierte Daten (JSON-LD)
`<script type="application/ld+json">` nur mit `dangerouslySetInnerHTML={{ __html: jsonLdSicher(daten) }}` (`src/lib/json-ld.ts`), nie mit `JSON.stringify` allein: Hofname oder Beschreibung mit `</script>` beendeten sonst den Block, und der Rest liefe als Skript.

### Nutzertext als Systemgrenze
Text, den ein Nutzer geschrieben hat (Meldung, Hofname, Browserangabe, PR-Text), ist auch dann Fremdtext, wenn er schon in der Datenbank liegt. Wo er in den Kontext eines Agenten gerät — Export, CLI, Log, Action —, geht er durch `src/lib/fremdtext.ts`:
- Mehrzeiliger Text als Block zwischen `<<<FREMDTEXT meldung=…>>>` und `<<<ENDE FREMDTEXT>>>` (`fremdtextBlock`): Steuer-, Richtungs- und unsichtbare Zeichen entfernt, Markierungen im Text entschärft, jede Zeile eingerückt, gekürzt.
- Einzeilige Felder über `einzeiligerFremdtext` mit Längengrenze; Adressen über `seitenPfad` (nur der Pfad).
- Was der Agent nicht braucht, verlässt die App nicht: keine E-Mail, keine Screenshot-Adresse, keine Query-Parameter.
- Aus einem PR-Text werden nur IDs übernommen, die dem ID-Muster entsprechen (`parseMeldungsVerweise`); nie steht er in einer `run:`-Zeile eines Workflows.

---

## 4. Fehlerbehandlung

### Server Action
```ts
export async function tuWas(input: unknown): Promise<{ ok: true } | { error: string }>
```
- Erwartbarer Fehler → `return { error: 'Verständlicher deutscher Satz.' }`
- Zod-Fehler: Nur Meldungen zurückgeben, die im Schema als eigener deutscher Satz stehen; für jedes andere Feld ein fester Satz je Feld (Vorbild `setServiceFeeAction`, `publishStatusPost`). Bei falschem Typ liefert Zod sonst seinen englischen Standardtext.
- Unerwarteter Fehler → werfen lassen, Sentry fängt ihn.
- **Nie** `catch {}` ohne Behandlung. **Nie** einen Fehler verschlucken und `{ ok: true }` zurückgeben.

### API-Route
```ts
// Fehler
NextResponse.json({ error: 'Deutscher Satz.', code: 'MASCHINENLESBAR' }, { status: 4xx })
// Erfolg
NextResponse.json({ ok: true, …daten })
```
- `code` setzen, wenn der Browser zwischen Fällen unterscheiden muss (Vorbild: `RESERVIERUNG_ABGELAUFEN`).
- Statuscodes: 400 Validierung, 401 nicht angemeldet, 403 kein Zugriff, 404 nicht gefunden, 409 Konflikt, 429 Rate-Limit, 500 unerwartet.
- **Nie** interne Details nach außen geben: kein Stacktrace, kein SQL, kein Prisma-Fehlertext, keine ID fremder Datensätze.

### Fremde Fehler nach Sentry
- Den Originalfehler nicht durch einen Nutzertext ersetzen und damit verlieren: Klasse, Nachricht und, wo vorhanden, HTTP-Status gehen als Kontext mit (Vorbild: `src/lib/upload-diagnose.ts`, `onDiagnose` in `ladeFotoHoch`).
- Kein leeres `catch` auf einem Weg, der am Ende nach Sentry meldet: Ausgang, Klasse, Nachricht und Dauer festhalten, den Ablauf eines Zeitwächters getrennt vom Fehler (Vorbild: `leseVersuch` und `onLesen` in `image-upload.tsx`).
- Fehlertexte aus SDKs und `fetch` gehen nur bereinigt nach Sentry (`bereinigeFehlerText`): Sie können Pfade, Dateinamen und Adressen tragen.
- Wer einen Wurf fängt, damit er nicht an die Fehlergrenze geht (Satz im Formular statt Fehlerseite), meldet ihn selbst — sonst tat es `app/error.tsx`. Fester Text, die Klasse als Name, die Nachricht bereinigt, nie Formularwerte; ein Netzabbruch (`istNetzfehler`) nur als Brotkrume. Vorbild: `speichernOhneWurf` (`components/mein-hof/abschnitt-speichern.ts`).
- **Nie** `cause` mit dem Rohfehler setzen. Sentry schickt verkettete Fehler mit, am Kontext vorbei.
- Kontexte flach halten (ein Kontext je Anlauf statt einer Liste) — Sentry kürzt ab der dritten Ebene.
- **In `tags`, `extra` und eigene Kontexte nur Kennungen, Codes, Zahlen und feste Wörter** — nie Adresse, Token, IP oder Fremdtext. `bereinigeEreignis` filtert dort seit Nr. 47 zusätzlich (heikle Schlüssel wie `email`, `token`, `ip`, `cookie` fallen weg; Texte gehen durch `bereinigeFreitext`, auch IP-Adressen und lange Kennungen ab 32 Zeichen), ebenso `logentry`, die Nachrichten (`event.message`, `message` der Brotkrumen) und die Daten der Brotkrumen; Texte unter Schlüsseln mit „query" nur dann als Query-String (heikle Parameter weg, Namen und Werte dekodiert bereinigt), wenn sie so aussehen, sonst als Freitext; `frame.vars` fallen ganz weg. IP-Adressen fallen in diesen Freitext-Feldern; der Fehlertext (`exception.value`, Adresse des Datenbank-Servers, Nr. 37), die Adressen der Anfrage (`request.url`, `query_string`) und bei den Spans die Beschreibung und die Attribute mit „url“, „path“, „target“ oder „query“ im Namen behalten sie — dort gilt die Regel des Pfads (E-Mail, Telefon, Code; in der Query heikle Parameter nach Namen, die Werte dekodiert). IP-Attribute der Spans fallen nach `IP_SPAN_ATTRIBUTE` weg; alle übrigen Span-Attribute gehen ungefiltert hinaus — in eigene Span-Attribute deshalb nur Kennungen, Codes und Zahlen. Jedes Muster in `sentry-hygiene.ts` läuft linear: Der Filter läuft synchron in `beforeSend`, und das SDK kürzt vorher nichts — ein neues Muster bekommt einen Fall in den Laufzeit-Tests (`tests/sentry-hygiene-felder.test.ts`). Das ist das Netz, nicht der Plan. Ein neuer technischer Kontext des SDK (ohne Freitext) kommt in `UNBEDENKLICHE_KONTEXTE`, sonst wird er bereinigt.
- **Fehlertext und E-Mail-Muster (seit Nr. 56):** Im Fehlertext (`exception.value`, auch im Minimalereignis) gilt die URL-Regel für Adressen im Text — absolut (auch groß geschrieben) und relativ ab „/", nur nie direkt nach Buchstabe oder Ziffer jeder Schrift oder nach `_ / . ~ % -` („und/oder", „3/4", „localhost:3000/…" sind keine Adresse) —, dazu „token=…" und „Bearer …" (`bereinigeFehlertext`); in Nachricht, Brotkrume und extra gilt dieselbe Regel für relative Adressen, eine absolute reicht dort bis zum Leerraum wie in Span-Beschreibungen, auch wenn sie in einer relativen steckt (`bereinigeFreitext`; „]", „)" und Anführungszeichen stehen in Adressen, `?f[a]=1&reorder=…`). Geheimnisse, deren Wert hinter Leerraum steht (`Bearer …`, `token: …`, `code: 123456`), fallen in Freitext und Fehlertext vor den Adressen (`ersetzeVorab`) — eine Adresse, die ihr Schlüsselwort mitliest, kodiert es, und die Regeln danach sähen es nicht mehr. Dabei fällt nur der Wert, nie ein Schlüssel: Alle Vorab-Regeln lesen den unveränderten Text, ihre Bereiche werden danach zusammengelegt; Schlüssel und Schlüsselwörter zählen auch direkt hinter Ziffern. Der Bereich eines Werts wächst, bis nichts mehr dazukommt, und wird dabei nie kürzer: Beginnt im Wert eine Adresse, fällt das ganze Wort bis zum Leerraum (keine Adresse reicht darüber); beginnt dort eine Telefonnummer, fällt sie bis zu ihrem Ende, ebenso Ziffern direkt hinter dem Wert eines Geheimnisses; klebt am Ende ein „/", fällt sein Wort mit (dahinter begänne sonst eine Adresse, die vorher keine war). Geht eine Nummer (Telefon-Regel oder Nachlese) aus einer Adresse hinter ihr weiter, fällt ihr Rest (`findeNummernReste`, seit Nr. 64 auch in der Span-Beschreibung und auch, wenn sie erst in einer dekodierten Lesart der Adresse beginnt: mit „+" als Leerzeichen Telefon-Regel, Nachlese und Zuweisungs-Regel samt Nummer im Wert, mit „+" als Plus die Plus-Lesart; der Rest liest nur Ziffern und Trenner bis zur nächsten Adresse), außer eine der beiden Regeln nimmt sie danach von der bereinigten Adresse aus über deren Grenze oder der Wert einer Zuweisung aus ihr reicht darüber (Fehlertext und Freitext lesen ihn danach über ein „)" am Adressende hinweg) — geprüft an bereinigter Adresse samt Rest, so zählt auch ein neu kodierter Anfang (`?q=(0043 664 …` → `%28[telefon entfernt]`), und „über die Grenze" genügt, weil eine Lesart mit „+" als Trenner die Nummer oft weiter liest als die Regel am Schluss; im Freitext fällt eine lange Kennung, die der Rest anschneidet, mit ihm, so weit sie nach E-Mail- und Telefon-Regel noch steht (Bereiche vereinigt); Zeichen allein zu vergleichen genügt nicht (`?a=106&s=06 64 …`); reicht eine E-Mail-Adresse in den Rest, zählt er nur bis zu ihrem Anfang (ab dort nimmt ihn die E-Mail-Regel vor der Telefon-Regel). Eine E-Mail-Adresse oder Telefonnummer als ganzer Wert bleibt für deren Regel. Eine neue Vorab-Regel liefert einen Bereich ab dem Wert und geht durch dieselbe Verlängerung (`wert` in `ersetzeVorab`), nie ein eigenes `replace` davor oder danach. IP-Adressen bleiben im Fehlertext (Datenbank-Server), ebenso lange Kennungen ohne Schlüssel — außer den Ziffern einer Hex-Kennung mit „0" und acht Ziffern am Stück (Server-Action- und Trace-Kennungen, Commit-Hashes, Chunk-Namen: `page-f0123456789abcde.js` → `page-f[telefon entfernt]abcde.js`): Die nimmt die Telefon-Regel bzw. die Nachlese als Nummer, seit Nr. 64 auch an Buchstaben (sichere Richtung; nur cuid und UUID erkennt sie an der Form). In der URL-Regel wird ein Abfragewert vorher weiter dekodiert, solange er sich ändert (höchstens `MAX_ADRESS_TIEFE`-mal, fehlertolerant: `dekodiereFehlertolerant`; ändert er sich danach noch, fällt er ganz); ist er dann selbst eine Adresse, gilt für ihn wieder die URL-Regel (bis zur Tiefe `MAX_ADRESS_TIEFE`, tiefer `[adresse entfernt]`), und im dekodierten Wert fallen „token=…" und „Bearer …". Adressen mit @ und Nummern mit „+" vorn liest jede Abfrage in mehreren Lesarten desselben unveränderten Namens bzw. Werts (`bereinigeLesarten`, seit Nr. 64): roh wie vor der Zerlegung (erst Adressen, dann Nummern; „+" ist ein Plus, eine Nummer nur mit freiem linken Rand, weitere „+" als Trenner), dekodiert mit „+" als Plus (nur Nummern; `%20` und `%2F` sind dort Trenner) und so, wie danach die Regel des Werts liest („+" ist ein Leerzeichen, ein Wert voll dekodiert, ein Name einmal). Die Bereiche werden vereinigt, nie nacheinander ersetzt (sonst blieb von `Abholung%3A+2026-10-10+0664%2F9876543` `%2F9876543`), für einen Wert samt den Bereichen der Zuweisungs-Regel auf seiner voll dekodierten Lesart, in der jeder Bereich der Lesarten als ein Wort ohne Trenner gilt (`findeWerteUmLesarten`: ein Platzhalter beendete sonst den Wert von `token:` an seinem Leerzeichen, der unveränderte Text am „+" einer Adresse der Plus-Lesart); von der Telefon-Regel zählen dabei nur Nummern, die ein Bereich der Plus-Lesarten anschneidet, samt Adressen, in die sie reichen — alles andere nimmt die Regel des Werts in ihrer Reihenfolge. Dekodiert wird wie von URLSearchParams nach WHATWG, mit Rückweg jeder Stelle in den rohen Text (nach außen gerundet). So fallen „+43…", „0664+1234567", „+43+664+1234567" und „+43%20664%20…"; „Artikel+12345678" bleibt. Ob ein Parametername heikel ist, entscheidet auch die unveränderte Zerlegung. Ein Anker mit „=" — auch kodiert als `%3D` — fällt wie eine Query, und auch der Pfad geht durch die Zuweisungs-Regel (`;token=…`). Die Zuweisungs-Regel (`ersetzeZuweisungen`, seit Nr. 64 samt „Bearer …": beide lesen den unveränderten Text, die Bereiche werden zusammengelegt, es fällt nur ein Wert, nie ein Schlüssel; ein Schlüssel zählt nicht, wenn sein Wert im Wert einer Zuweisung davor beginnt, sonst immer — auch hinter einem Wert, wenn sein Trenner Leerraum trägt, und in einem Bearer-Token; beginnt in einem Wert eine Nummer, fällt sie bis zu ihrem Ende, auch mit „+" als Trenner, wie eine Abfrage den Wert danach liest (`NUMMER_IM_WERT`); ein Bearer-Token mit „@" nimmt das Wort bis zum Leerraum) zählt ein geheimes Wort als ganzen Teil des Schlüssels (getrennt an `_`, `-`, am Wechsel zu einem Großbuchstaben und von Ziffern zu Buchstaben: `access_token`, `resetToken`, `oauth2token` ja, `tokenizer` nein), ein Prozent-Escape davor ist eine Grenze (`%20token=`), sie nimmt Anführungszeichen um Schlüssel und Wert (`token: "…"`, `"access_token":"…"`, keine Backticks) und lässt nur einen eigenen Platzhalter als ganzen Wert stehen („[code entfernt]"). Die E-Mail-Muster erkennen Buchstaben und Ziffern jeder Schrift (`\p{L}\p{N}\p{M}`; in der Domain auch kodierte Bytes `%80`–`%FF`, auch mehrfach kodiert wie `%25C3`, nie `%40`/`%2540`/`%2E`) und mehrfach kodierte Adressen (`%(25)*40`). Die Telefon-Regel setzt mit 0 vorn nie mitten in einer Zahl an (ein Prozent-Escape links, auch mehrfach kodiert wie `%2520`, ist eine freie Grenze wie ein Leerzeichen) und nie in einer cuid (`c` und 24 Kleinbuchstaben oder Ziffern) oder UUID (8-4-4-4-12 Hex) — die erkennt sie seit Nr. 64 an der Form, nicht an den Rändern; endet eine Kennung auf eine Ziffer und geht dahinter eine Nummer weiter, zählt sie nicht als Kennung. Im Ablauf zählt eine Ziffernfolge, die links an Buchstabe, `_` oder `-` klebt, nur, wenn sie rechts frei endet; Nummern an einem Wort und mit „+" hinter einer Ziffer (`Telefon0664…Adresse`, `Hof_0664…_foto.jpg`, `10:30+43…`) nimmt die Nachlese (`ersetzeNummernAmWort`) zum Schluss des äußersten Durchgangs — eine Adresse in einem Text liest sie nicht selbst, außer Namen und Werte ihrer Abfrage (und den Pfad einer Adresse, die selbst ein Wert ist): Die kodiert URLSearchParams danach neu, und eine Nummer mit „/", Leerraum, „+" oder Klammer verlöre dabei ihre Trenner — solche Nummern fallen dort vorher (`ersetzeNummernVorKodierung`), die übrigen stehen neu kodiert unverändert und bleiben der Nachlese am Schluss. So bleiben ISO-Zeitstempel (`2026-10-10 20:02:00`), cuid und UUID stehen; als Nummer gelten weiterhin ein Datum mit Uhrzeit (`01.09.2026 08:00` → `[telefon entfernt]:00`), eine Dezimalzahl mit 0 und mindestens acht Nachkommastellen (`0.012345678`) und andere Kennungen mit „0" und acht Ziffern am Stück (Hex-Hashes fallen teilweise).
- **Ein Mehrfund zerteilt kein Wort (seit Nr. 64):** Findet eine Regel in `sentry-hygiene.ts` mehr als bisher, läuft der Mehrfund als letzter Schritt des äußersten Durchgangs (Nachlese), nie mitten im Ablauf — sein Platzhalter zerteilte sonst ein Wort, das eine spätere Regel ganz nimmt (lange Kennung, Kennungs-Segment, Wert einer Zuweisung). Einzige Ausnahme: Nummern, deren Trenner ein späteres Neukodieren zerstört, fallen davor (`ersetzeNummernVorKodierung`) — sie tragen ein Zeichen, das in keiner langen Kennung steht. Im Freitext bestimmen lange Kennung und Nachlese ihre Bereiche auf demselben Text und werden vereinigt (nacheinander nahm die Kennung das Ende einer Nummer mit, `<uuid>+43 (664) 987-6543<Kennung>`). Lesarten und Regeln, die sich gegenseitig schneiden können, bestimmen ihre Bereiche auf dem unveränderten Text und werden vereinigt. Jede Änderung am Filter besteht den Vergleich „neu fängt mindestens, was main fängt" (`tests/sentry-hygiene-vergleich.test.ts`, eingefrorene Muster, fester Startwert) und den Wachstumstest (`tests/sentry-hygiene-wachstum.test.ts`, t(4N)/t(N) < 8 bei 50 000 und 200 000 Zeichen, Median aus drei Läufen, bei einem Ausreißer bis zu drei Versuche); ein neues Muster bekommt dort einen Fall, der es an vielen Stellen ansetzen lässt.
- **Ein sichtbarer Fehlerzustand geht getrennt vom Fehler nach Sentry (seit Nr. 56, /hoefe):** fester Satz, Tag `sichtbar=ja`, höchstens einmal je Instanz und Abstand (Regel rein in `src/lib/`, Zustand als optionaler letzter Parameter wie bei der Bremse) und ohne Anfrage-Daten — `ohneAnfrage` (`sentry-hygiene.ts`) als Event-Prozessor im `captureContext`; er läuft nach den Integrationen, die die Anfrage anhängen. Grund: Die URL-Regel lässt Suchwörter in der Adresse stehen (`?q=…`). Gemeldet wird dort, wo die Seite den Zustand rendert, nie im Lesepfad (der läuft auch beim Neubau im Hintergrund).
- **Sentry bekommt nie eine IP-Adresse.** Jedes `Sentry.init` setzt `sendDefaultPii: false` und `beforeSend` wie `beforeSendTransaction` auf `bereinigeEreignis` (`src/lib/sentry-hygiene.ts`); nie `dataCollection` setzen — schon ein leeres Objekt schaltet im SDK alle Vorgaben auf „sammeln“, auch die IP. Ein neuer IP-Träger (Proxy-Header, Span-Attribut) kommt in `IP_HEADER` bzw. `IP_SPAN_ATTRIBUTE`, nie als Sonderfall an der Aufrufstelle. `bereinigeEreignis` wirft nie: Ein Fehler in `beforeSend` verwirft das Ereignis. Was sich nicht sichten lässt, fällt weg, im Notfall bleibt ein Minimalereignis, nie das Rohereignis. Wache: `tests/beobachtbarkeit.test.ts` (prüft jeden init-Aufruf statisch, gleich unter welchem Namen).

### Nutzertexte
- Deutsch, geduzt, ohne Fachjargon, mit Ausweg.
- ✅ "Deine Reservierung ist abgelaufen. Wir haben die Verfügbarkeit neu geprüft."
- ❌ "Reservation expired", "Fehler 500", "Constraint violation".

### Konsistenz bei Teilfehlschlag
- Mehrere Schreibvorgänge, die zusammengehören → `prisma.$transaction`.
- **In einer interaktiven Transaktion läuft alles nacheinander** — nie `Promise.all`/`allSettled` mit dem Transaktions-Client (Rückruf-Parameter oder `Prisma.TransactionClient`), auch nicht über eine vorher gebaute Liste von Aufrufen (`const s = [tx.a(), tx.b()]`) oder einen Helfer, der den Client bindet. Eine Verbindung, eine Abfrage zur Zeit; ab pg@9 ist alles andere ein Fehler (`tests/transaktion-nacheinander.test.ts`, Nr. 47).
- **Eine Liste in einer Array-Spalte (`text[]`) ändert EINE Anweisung auf der Zeile** — `array_append`/`array_remove` per `$queryRaw` mit Parametern, Besitz in derselben WHERE-Klausel, die neue Liste per `RETURNING` zurück —, nie Lesen-dann-Schreiben: Zwei Tabs überschrieben sich sonst gegenseitig ihre Einträge. Ein Zähler daneben wird in derselben Anweisung aus der neuen Liste gerechnet (`cardinality`), nie hochgezählt (Vorbild `setzeWhatsAppGetippt`, Nr. 66).
- **Eine Zeile als Sperre braucht ein echtes UPDATE.** Mit leerem `data` setzt Prisma kein UPDATE ab (geprüft mit Prisma 7.8: `updatedAt` bleibt stehen), die Zeile bleibt ungesperrt. Wer Felder nur bedingt schreibt (`...(x !== undefined && { x })`) und sich in derselben Transaktion auf die Sperre verlässt — etwa Kindzeilen löschen und neu anlegen —, schreibt `updatedAt: new Date()` immer mit (Vorbild `saveAppearanceAction`).
- Geht das nicht (externer Dienst dazwischen): Kompensation schreiben, wie beim Bestandsabzug.
- Nichts Langsames im Antwortpfad → `nachDerAntwort()`.
- **Wiederholt wird nur ein öffentlicher Lesepfad**, nur bei einem Verbindungsabbruch (08006/`EAUTHTIMEOUT`) und genau einmal: `leseOeffentlichMitWiederholung` (`src/server/oeffentlich-lesen.ts`). Nie ein Schreibweg, nie in einer Transaktion — ein wiederholtes Schreiben könnte doppelt buchen. Eine neue Stelle braucht einen Eintrag in der Liste von `tests/oeffentlich-lesen.test.ts`.

---

## 5. Kommentare

- Deutsch. Erklären **warum**, nie was.
- Pflicht bei: nicht offensichtlicher Fachregel, bewusster Abweichung, bekannter Einschränkung, Sicherheitsentscheidung.
- Verboten: auskommentierter Code, `TODO` ohne Namen und Datum, Kommentare, die den Code wiederholen.

---

## 6. Bad vs. Good

### Beispiel 1 — Geld und Formatierung

```ts
// ❌ BAD
const gesamt = Number(order.totalAmount) * 1.049          // Rundungsfehler, Gebühr hart verdrahtet
return <span>{gesamt.toFixed(2)} €</span>                 // eigenes Format, falsche Reihenfolge
```

```ts
// ✅ GOOD
import { berechneServicegebuehr } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { calcTotalAmount, decimalZuCents } from '@/lib/order-totals'

const warenpreisCents = decimalZuCents(calcTotalAmount(positionen))
const { gebuehrCents } = berechneServicegebuehr(warenpreisCents, farm, new Date())
return <span>{formatEuro((warenpreisCents + gebuehrCents) / 100)}</span>   // € 10,50
```

### Beispiel 2 — Server Action ohne Besitzprüfung

```ts
// ❌ BAD
'use server'
export async function updateStock(productId: string, stock: number) {
  await prisma.product.update({ where: { id: productId }, data: { stock } })
}
// Nicht eingeloggt? Egal. Fremdes Produkt? Egal. Eingabe ungeprüft. Kein revalidate.
```

```ts
// ✅ GOOD
'use server'
export async function updateStock(
  input: unknown
): Promise<{ ok: true } | { error: string }> {
  const v = updateStockSchema.safeParse(input)
  if (!v.success) return { error: 'Ungültige Eingabe.' }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }

  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  // Besitz in der WHERE-Klausel, nicht in einem vorherigen if — sonst
  // besteht zwischen Prüfung und Schreiben eine Lücke.
  const { count } = await prisma.product.updateMany({
    where: { id: v.data.productId, farmId: farm.id },
    data: { stock: v.data.stock },
  })
  if (count === 0) return { error: 'Produkt nicht gefunden.' }

  revalidatePath('/products')
  revalidatePath(`/${farm.slug}`)
  return { ok: true }
}
```

### Beispiel 3 — Fachregel in der Komponente

```tsx
// ❌ BAD — Frist lebt im JSX, nicht testbar, nur im Browser wirksam
{Date.now() - new Date(res.createdAt).getTime() < 900_000 && (
  <span>Reserviert</span>
)}
```

```ts
// ✅ GOOD — Entscheidung in src/lib/reservierung.ts, rein und testbar
export function istGueltig(reservierung: EigeneReservierung, jetzt: Date): boolean {
  return reservierung.expiresAt.getTime() > jetzt.getTime()
}
```
```tsx
// Komponente zeigt nur an, was der Server entschieden hat
{position.zustand === 'ok' && <span>Reserviert</span>}
```

---

## 7. Farben

Es gibt **zwei Modi**: hell und dunkel (`next-themes`, `data-theme="light|dark"` am
`<html>`, gesetzt vor der Hydration). Jede Farbe muss in beiden funktionieren.

**Neues Design (Redesign, `docs/ai/DESIGN_SYSTEM.md`):** Innerhalb einer Route, deren
Shell `data-design="neu"` trägt, gelten die Tokens und Farbrollen des Design-Systems —
`primary` ist dort Orange (Hofbereich), `accent` Grün (Kundenaktion), die Werte
kommen aus `--fz-*`. Die Tabelle unten beschreibt den Bestand außerhalb dieses
Geltungsbereichs; beim Umzug einer Route gilt das Design-System.

### Grundregel
- **Keine Farbe hart in eine Komponente schreiben.** Kein `#2D5F3F`, kein
  `bg-slate-700`, kein `style={{ color: '…' }}`. Farben kommen aus Tokens in
  `src/app/globals.css` (`:root` = hell, `[data-theme="dark"]` = dunkel).
- Tokens werden in **oklch** geschrieben, nie in Hex. Der Hex-Wert darf als
  Kommentar danebenstehen.
- Beim Ersetzen einer alten Hex-Farbe: das Token nehmen, das im **hellen** Modus
  denselben Wert hat. `bg-white` auf einer Karte wird `bg-card`, **nicht**
  `bg-background`. Passt kein Token: **fragen**, nicht raten.

### Welches Token wofür

| Zweck | Token |
|---|---|
| Seitengrund | `background` |
| Fläche einer Karte, eines Dialogs | `card` / `popover` |
| Fließtext | `foreground`, leiser: `muted-foreground` |
| Hauptknopf (Fläche) | `primary` + `primary-foreground` |
| **Markenfarbe für Text und Symbole** | **`brand-text`** |
| Handlungsknopf (CTA, max. 1× pro Seite) | `accent` + `accent-foreground`, Hover `accent-hover` |
| Rahmen, Trennlinien | `border`, Eingabefelder `input` |
| Fokusring | `ring` |

Hofseite, Produktraster und Bauern-Bereich tragen zusätzlich die gewachsene
Palette `--app-*` (`app-page`, `app-ink`, `app-ink-soft`, `app-ink-faint`,
`app-chip`, `app-chip-ink`, `app-chip-green`, `app-line-firm`, `app-button`,
`app-bar`, `app-trough`) und den Hinweis-Kasten `--notice*`. Wer dort etwas neu
baut, nimmt diese Tokens — nicht `foreground`/`card`, sonst stehen zwei
Grautöne nebeneinander. Begründung in `DEVELOPMENT.md`.

`app-ink-faint` ist nur für Symbole und Trenner, nie für Lesetext — auch nicht
für Hinweise, Bildunterschriften oder Gruppenüberschriften: Auf den Flächen
liegt der Kontrast unter 4,5:1 (Axe `color-contrast`). Leiser Lesetext nimmt
`app-ink-soft`.

**`--brand-text` ist neu und nicht dasselbe wie `--primary`.** `--primary` ist die
*Fläche* des Hauptknopfs und wird im Dunkeln hell (heller Salbei, damit dunkle
Schrift darauf sitzt). Markentext braucht den umgekehrten Weg: hell ist er das
dunkle Waldgrün, dunkel ist er ein helles Salbeigrün. Im **hellen** Modus sind
beide Werte identisch — der Unterschied entsteht erst im Dunkeln. Also:
`text-brand-text` für Überschriften, Wortmarke, Symbole; `bg-primary` für Flächen.

### Tiefe
Im Dunkeln trägt der **Rahmen**, nicht der Schatten: Ein Schatten auf fast
schwarzem Grund ist unsichtbar. Karten bekommen dort `dark:ring-1 dark:ring-border`.

### Bedeutungsfarben (grün/bernstein/rot)
Für „erledigt", „Achtung", „schiefgegangen" gibt es außer `destructive` **kein**
Token. Hier bleibt der helle Wert stehen und bekommt eine `dark:`-Entsprechung:

```tsx
// ✅ GOOD — heller Wert unverändert, dunkler Wert ergänzt
<div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200">
```

Keine neuen Bedeutungs-Tokens erfinden, ohne zu fragen — das wäre ein neues
Farbschema.

### Was dem Modus NICHT folgt
Fotos und Hof-Banner werden nicht abgedunkelt. Schleier über Fotos, weiße
Schrift auf Fotos, Kartenkacheln samt Pins und Gruppen-Pins (siehe `hoefe-karte.tsx`), die Karte der Region auf der Startseite (`RegionsKarte`, nur Tokens, die im neuen Design in beiden Themes gleich sind), die
Bildmarke und fremde Markenfarben (WhatsApp-Grün, Stripes Eingabemaske) bleiben,
wie sie sind. Wo das so ist, gehört ein Kommentar daneben, der es begründet.
Ausnahme: Die Kategorie-Illustrationen (`public/categories/`) sind keine Fotos,
ihr heller Crème-Grund würde nachts als Fläche leuchten. Jede NEUE Stelle, die
eine Illustration zeigt, dämpft sie im Dunkeln (`dark:brightness-[…]
dark:saturate-[…]`) und rahmt sie statt eines Schattens — Vorbild
`Illustration` in `src/components/startseite/startseite-abschnitte.tsx`. Ältere Stellen gibt es seit Nr. 18 nicht mehr (die Produktliste war die letzte).

### Diagramme
Recharts schreibt Farben als SVG-Attribute — `var(--token)` greift dort **nicht**.
Farbsätze je Modus in JavaScript halten und über `resolvedTheme` (next-themes)
umschalten. Nur `contentStyle`/`labelStyle`/`itemStyle` des Tooltips sind
React-Style-Objekte; dort gehören die Tokens hin.

### Kontrast
Fließtext ≥ 4,5:1, große Schrift und Symbole ≥ 3:1 — **in beiden Modi** messen,
gegen `background` **und** gegen `card`.

---

## 8. Formulare

- **Optionale Zahlenfelder in react-hook-form: Leer ist `null`, nie `undefined`.**
  `undefined` heißt für RHF „Ausgangswert wiederherstellen". Beim Tippen von
  „0," ist ein Feld kurz leer; wer dann `undefined` übergibt, bekommt bei einem
  Bestandsprodukt den gespeicherten Wert zurück, und aus „0,5" wird „15".
  Gilt für `field.onChange`, `setValue`, `defaultValues` und die
  Bearbeiten-Vorbelegung. Das Zod-Schema gibt `null` weiter (`.nullable()`),
  die Server Action macht daraus die Datenbank-`null`.
- Dasselbe für optionale Objekte (z. B. die Futter-Kennzeichnung): leeren mit
  `null`, prüfen mit `== null`.
- Zahlen tippt der Mensch mit Komma oder Punkt: `DezimalFeld` aus
  `src/components/shared/`, nie `type="number"` für Dezimalwerte.
- **Select (Base UI) braucht einen Formatierer.** `<SelectValue>` zeigt im
  geschlossenen Zustand sonst den Rohwert („KG", „3"). Immer die
  Kinder-Funktion mitgeben: `{(v) => auswahlLabel(OPTIONEN, v) ?? 'Platzhalter'}`
  (`auswahlLabel` in `src/components/products/produkt-abschnitte.ts`).
- **Anlegen strenger als Bearbeiten → zwei Schemas.** Ein eigenes
  `*AnlegenSchema` für die neue Pflicht; `create*` prüft damit, `update*` mit
  dem alten. Bestandsdaten müssen speicherbar bleiben, ohne sie erst umzubauen.
  Vorbild: `productAnlegenSchema`.
- **Obergrenzen für Text stehen in `src/lib/eingabegrenzen.ts`** (Hofname 80,
  Personenname 80, Telefon 30, Notiz 500, E-Mail 254, Produktname 100) samt
  Meldung mit Ausweg (`ZU_LANG`). Schema und Formular nehmen dieselbe
  Konstante. Das Formular zeigt den Zähler (`FeldZaehler` für react-hook-form,
  sonst `ZeichenZaehler`, `src/components/shared/zeichen-zaehler.tsx`) — er
  erscheint ab 80 % Füllung und sagt über der Grenze „Bitte kürzen", als
  Hinweis, nicht als Fehler. Nie `maxLength` am Feld: Eingefügtes würde stumm
  abgeschnitten.
- **Eine nachträgliche Obergrenze sperrt keinen Bestand.** Beim Bearbeiten
  prüft ein Schema mit dem gespeicherten Stand: Ein Altwert über der Grenze
  darf unverändert bleiben, jeder geänderte Wert hält sie ein
  (`passtInGrenze`). Server und Formular bauen es aus derselben Funktion —
  der Server mit dem Stand aus der Datenbank. Vorbild: `profilBearbeitenSchema`.
- **E-Mail immer über `emailSchema`** (`src/schemas/email.ts`): ohne Ränder,
  klein geschrieben, höchstens 254 Zeichen. Postgres vergleicht genau, Better
  Auth speichert klein — eine roh gespeicherte Adresse ergibt einen zweiten
  Kunden, den der Anmeldelink nie findet. Nachgeordnete Aufrufe (Better Auth,
  Prisma) bekommen den geprüften Wert, nie die rohe Eingabe.
- **Case-insensitiv vergleichen nur mit maskiertem Muster.** Prisma macht aus
  `equals` mit `mode: 'insensitive'` ein ILIKE ohne Maskierung: `_` und `%`
  im Wert sind Platzhalter und treffen fremde Zeilen. Den Wert immer durch
  `genauesIlikeMuster` (`src/lib/ilike-muster.ts`) schicken. Hängt an dem
  Ergebnis eine Berechtigung, zählen ALLE Treffer (`findMany`), nie der erste
  beliebige (`findFirst`) — Vorbild `rolleZurAdresse` in `src/lib/auth.ts`.
- **Pflichtfelder am Feld, nicht in `superRefine`.** Zod 4 überspringt
  Querprüfungen, solange ein anderes Feld ungültig ist. Was sofort zählen soll
  (Fehlerzähler im Button, Markierung beim ersten Absenden), gehört als
  `.refine` an das Feld selbst (`.extend({ feld: … .refine(…) })`).
- **Zähler „Noch n Angaben fehlen"** rechnet mit demselben Schema wie das
  Absenden (`fehlendeAngaben`), je Feld gezählt — nie eine zweite Liste von
  Pflichtfeldern pflegen.
- **Ein Datei-Feld wird nie angefasst, solange seine Datei noch gebraucht wird.**
  Kein `value = ''`, kein wechselnder `key` darüber, kein Aushängen (bedingtes
  Rendern, zugeklapptes Akkordeon — Base UI hängt einen geschlossenen Abschnitt
  standardmäßig aus) zwischen Auswahl und fertigem Upload. Android-Chrome
  entzieht der Datei-Referenz dabei die Leseerlaubnis; die Datei ist danach
  stumm (`NotReadableError`), obwohl das `File`-Objekt weiterlebt. Geleert wird
  im `onClick` der Eingabe, bevor der Auswahldialog aufgeht — beide Griffe
  stehen als reine Funktionen in `src/lib/foto-feld.ts`. Gilt auch, wo erst
  später hochgeladen wird (Produktdialog: beim Absenden).
- **Fotos kommen über `useFotoQuellen`** (`src/components/shared/foto-quellen.tsx`):
  zwei Knöpfe („Foto wählen", „Foto aufnehmen") über drei verborgenen Eingaben —
  Galerie (`accept="image/*"` ohne `capture`), Dateien-App (breites `accept`),
  Kamera. Nie eine vierte Eingabe daneben, nie ein eigenes `accept`. Welchen Weg
  „Foto wählen" öffnet (`ersterWeg`: Android die Dateien-App, sonst die Galerie,
  ein gemerkter Weg sticht), was der Ausweg der Karte ist (`auswegFuer`) und wann
  der Weg gemerkt oder vergessen wird (`merkerNachErgebnis`), entscheidet
  `src/lib/foto-wege.ts`; die Komponente führt nur aus. Wer `onFiles` bekommt,
  meldet das Ergebnis jeder Auswahl über `meldeErgebnis` zurück.
- **Das Bildformat wird an den ersten Bytes entschieden** (`bildFormat`), nie am
  MIME-Typ oder Dateinamen. HEIC wird nie hochgeladen (`BildFehler('heic')`, ohne
  Fachwort für den Bauern); über die Dateien-App muss es ein Bild sein. Beides in
  der Lese-Stufe (`pruefeLesbarkeit`), bevor der Transfer beginnt.
- **Übertragen wird nur die Kopie, nie die Datei vom Gerät.** `pruefeLesbarkeit`
  liest das Foto nach der Probe einmal ganz und gibt es als `File` im Speicher
  zurück; Formatprüfung und Upload nehmen nur diese Kopie. Ein Aufrufer, der die
  Kopie schon hat, übergibt sie mit `bereitsKopiert: true` an `ladeFotoHoch` —
  nie eine Datei direkt aus der Eingabe. Mehrere Fotos nacheinander, nie alle
  Kopien auf einmal im Speicher.
- **Wer erst später hochlädt, prüft die Datei bei der Auswahl** (`pruefeLesbarkeit`
  mit `weg`), behält die Kopie statt der Datei samt der Lese-Diagnose für Sentry
  und gibt sie beim Schließen frei — damit die Karte bei der Auswahl erscheint
  und nicht mitten im Speichern.
- **Suchvorschläge erst beim Tippen, als Liste unter dem Feld** — nie als
  Knopfreihe ohne Eingabe, die wie ein Filter aussieht und die Filter
  verdrängt. Muster: Combobox (`role="combobox"` am Feld, `role="listbox"`,
  Pfeiltasten, Enter, Escape, schließt beim Verlassen des Felds), Liste im
  Fluss statt als Overlay, Markierung über den Namen. Die Tastenlogik rein in
  `src/lib/` (Vorbild: `tasteInVorschlaegen` für die Produktsuche auf `/hoefe`).

---

## 9. Checkliste vor dem Bericht

- [ ] Optionale Formularwerte leer = `null`, nie `undefined` (→ Abschnitt 8)

- [ ] Kein `any`, kein `@ts-ignore`, keine unbegründete `!`-Assertion
- [ ] Zod an jeder neuen Systemgrenze
- [ ] Auth **und** Besitzprüfung in jeder schreibenden Server Action
- [ ] Besitz in der `WHERE`-Klausel, nicht in einem vorgelagerten `if`
- [ ] Geld über die Helfer, Anzeige über `format.ts`
- [ ] Fehlermeldungen deutsch, geduzt, mit Ausweg
- [ ] `revalidatePath` für jede betroffene Route
- [ ] Nichts Langsames im Antwortpfad
- [ ] `Decimal`/`Date` nicht roh an Client-Komponenten
- [ ] Keine harte Farbe im Bauteil; in beiden Modi angesehen (→ Abschnitt 7)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` grün
