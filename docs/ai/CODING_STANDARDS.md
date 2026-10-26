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
| Funktion | `camelCase`; Verb zuerst bei Aktionen, Handlern und Hooks, Lese- und Rechenfunktionen nach ihrem Ergebnis (Inventur 12, Morgenbericht 20 §3, freigegeben 21.10.2026) | `pruefeWarenkorb`, `centsAlsEuro`, `kilopreisNetto` |
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
- Der Rückgabetyp ist **Pflicht** für exportierte Funktionen in `src/lib`, `src/server` und `src/schemas`; React-Komponenten sind ausgenommen (Inventur 7, Morgenbericht 20 §3, freigegeben 21.10.2026).
- Keine nicht-null-Assertion `!`, außer mit der Begründung als Kommentar in derselben Zeile (Inventur 7, Morgenbericht 20 §3, freigegeben 21.10.2026).
- Typen aus Prisma ableiten, nicht abschreiben: `Prisma.OrderGetPayload<…>`.
- Keine Typduplikate: Zod-Schema ist die Quelle → `type X = z.infer<typeof xSchema>`.
- Kein `updateMany` mit berechnetem Spaltenschlüssel (`{ [spalte]: wert }`) – je Spalte ausschreiben; sonst läuft tsc an den Speicher. (Regelvorschlag Dirigent, Morgenbericht 24, freigegeben 25.10.2026)

### Geld
- Prisma speichert Preise als `Decimal(10,2)`.
- **Nie** `Number(decimal)` für Rechnungen, die addiert oder multipliziert werden. Rundungsfehler landen auf der Rechnung des Hofs (`tests/geld-number-wache.test.ts` meldet `Number()` auf Geldnamen unter `src/`).
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
- Rechnen in den vorhandenen Helfern: `src/lib/order-totals.ts`, `src/lib/servicegebuehr.ts`, `src/lib/finanzen.ts`. Auch reine Anzeige im Browser (Korbsumme, Zeilensumme) und der Paketpreis im Produktformular (Einheitspreis × Gebindegröße) rechnen in Cent über `calcLineTotal` → `decimalZuCents` (Vorbild `korbBetraege` in `src/lib/hofseite-kunde.ts`), nie `price * quantity` (`tests/geld-fliesskomma-wache.test.ts` meldet Geld × Nicht-Zahl unter `src/`), nie `Math.round(x * 100) / 100`.
- **Die Servicegebühr entsteht nur in `berechneServicegebuehr`** — immer aufgerundet auf den nächsten Cent, ganzzahlig in Hundertstel-Prozent gerechnet. Wer sie anzeigt, bildet den Warenpreis auf demselben Weg wie `/api/checkout` (`calcTotalAmount` → `decimalZuCents`); nach dem Bestellen gilt nur noch der Snapshot `Order.serviceFeeCents` (`bestellSummen`), nie eine Neuberechnung aus der Hofeinstellung. Den Satz für neue Höfe nehmen `SERVICEGEBUEHR_STANDARD_PROZENT`/`_MIND_CENTS`, nie eine Zahl im Code. Die Zahlungsart ist Pflichtparameter (Register B1): bar vor `BAR_SERVICEGEBUEHR_AB` kostet nichts. Wer fragt, ob eine Barbestellung Gebühr trägt oder der Plattform etwas einbringt, fragt `barOhneServicegebuehr` (Bestellzeitpunkt, Wiener Mitternacht; Texte `vorBarStichtag`) — nie ein eigener Datumsvergleich; die Zahlungsart ist dabei das Prisma-Enum (`Zahlungsart`), nie `string`; einzige Ausnahme ist rohes SQL (Admin-Hofliste), das dieselbe Bedingung mit der Konstante schreibt.
- **Umsatz und Servicegebühr ohne Testzahlungen (Register Z4).** Wer Bestellungen zu Umsatz oder Gebühr summiert, geht über `umsatzBestellungWhere` bzw. `topfVonBestellung` oder nimmt die Regel aus `src/lib/testzahlung.ts` (`istTestzahlung`, `ohneTestzahlungenWhere`, `ohneTestzahlungenSql`) — nie ein eigener Vergleich mit dem Stichtag, nie `null` statt des Stichtags, nie ein eigenes `AND` neben der gespreizten Regel (die Bedingung kommt als Element in die eigene `AND`-Liste); reine Funktionen bekommen den Stichtag als Pflichtparameter `stripeLiveAb: Date | null`. Auch eine Bestellzahl zählt Testzahlungen nicht mit, und welche Töpfe eine Zahl zählt, steht nur als Konstante (`GEZAEHLTE_TOEPFE` und die Konstanten daneben), nie als zweite Liste. Die ausführliche Regel (Töpfe, Bestellzahl mit der Ausnahme `alleBestellungen`, Hinweis zu Testzahlungen) steht in `ARCHITECTURE.md` §5 „Zahlungen“, die Regel selbst im Kopf von `src/lib/testzahlung.ts`, und `tests/testzahlung-wache.test.ts` hält sie mit einer Gegenprobe je Leckweg fest (Inventur 2, Morgenbericht 20 §3, freigegeben 21.10.2026).
- Anzeigen ausschließlich über `src/lib/format.ts` (`formatEuro`, `formatMenge`, `formatPosition`, `formatGrundpreis`).
- **Preis-Semantik:** `price` ist der Preis je Gebinde, `unitSize` die Gebindegröße. Mit Gebinde schreibt die Anzeige „€ 50,00 für 2 kg" (nie „/ 2 kg"), darunter die Grundpreis-Zeile „€ 25,00 / kg" über `<GrundpreisZeile>` aus `src/components/shared/`. Bei Stück und Paket gibt es keine Grundpreis-Zeile. `grundpreisJeEinheit` ist nur Anzeige, nie Abrechnung.
- Nie ein eigenes Preisformat erfinden. Nie `toFixed(2) + ' €'`.

### Tage und Wochen
- Der Tag und die Woche eines Hofs sind **Wiener** Tag und Woche, nie Serverzeit (Vercel rechnet in UTC — um 0:30 Uhr stünde der Hof sonst im Gestern).
- Werkzeuge: `wienKalendertag`, `tagVersetzt`, `wienWochenMontag`, `wienWochenbeginn` (`src/lib/kalender.ts`), `wienerMitternacht` (`src/lib/wiener-tag.ts`, auch über `servicegebuehr.ts` erreichbar), `abholtage` und `wochenfenster` (`src/lib/heute.ts`).
- Verboten unter `src/`: `setHours(0, …)`, `getHours()`, `startOfWeek` aus `date-fns` und jede Datumsausgabe (`toLocaleDateString`, `toLocaleTimeString`, `toLocaleString` bei Datumswerten) ohne `timeZone: 'Europe/Vienna'`; `toLocaleString` für Zahlen bleibt erlaubt. ESLint meldet sie (`no-restricted-syntax`: `DATUM_SELEKTOREN` und `DATUM_ORT_SELEKTOREN` in `eslint.config.mjs`, Gegenprobe `tests/datums-regeln.test.ts`); einen Bestand ohne `timeZone` gibt es seit Nr. 118 nicht mehr — `DATUM_ORT_BESTAND` ist leer und bleibt es (Inventur 10, Morgenbericht 20 §3, freigegeben 21.10.2026).
- Bestellungen eines Abholtags: `abholWhere(farmId, tag)` — dieselbe Bedingung für „Heute abholen", die nächste Abholung und die Packliste. Wie ein künftiger Tag im Hofbereich heißt („Morgen", Wochentag, Wochentag mit Datum), sagt `abholtagName`; ein Abholtermin für Kundinnen (Kasse, Hofseite) steht immer mit Wochentag und Datum über `formatTagKurz` („Sa, 10. Okt", `src/lib/format.ts`, aus dem Kalendertag JJJJ-MM-TT, seit Nr. 46) — nie ein eigenes Datumsformat daneben. Der Kalendertag ist immer der Wiener: `kalendertagInWien` (`src/lib/wiener-tag.ts`), `tagVersetzt`, `wochentagVon` (`src/lib/kalender.ts`) und für „jetzt" `uhrzeitInWien` — in Kasse (`angeboteneAbholfenster`) und Hofseite (`nextPickupDays`, seit Nr. 46, Runde 1) dieselben Helfer, nie `getDay()`/`getHours()` der Uhr, auf der der Code gerade läuft. Kurze Monatsnamen schreibt neuer Code fest (`MONAT_KURZ` in `format.ts`, auch für Achsen wie `monatOhneJahr`), nie über Intl `month: 'short'` — dessen Kürzel schwanken je nach ICU-Stand („Sep"/„Sep.", „Jul"/„Juli"); `monatKurz` (lange Achse der Finanzen, „Sep. 26") nimmt noch Intl.

### Serialisierung an Client-Komponenten
- `Decimal` und `Date` nicht roh übergeben.
- `Decimal` → in der Query in `string` oder bereits formatiert wandeln.
- `Date` → `toISOString()` oder fertig formatiert.
- **Was eine Seite nicht zeigen darf, geht nicht an eine Client-Komponente** — auch nicht ungezeigt: Props stehen in den Seitendaten. Die Server-Seite entfernt solche Felder vorher und typisiert die Komponente ohne sie, nie die gemeinsame Abfrage (Vorbild: Telefon und E-Mail des Hofs auf Hofseite und Produktseite, `entferneKontaktdaten` und `HofseiteHof`, Nr. 60 und 70). Der Typ allein hält das nicht: Der volle Hof ist an `HofseiteHof` zuweisbar, ein vergessenes `entferneKontaktdaten` meldet der Typecheck nicht — darum prüft je öffentlicher Seite ein Test die Props ihrer Client-Komponente (→ `TESTING_GUIDELINES.md` §2).
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
- **In `tags`, `extra`, eigenen Kontexten und eigenen Span-Attributen nur Kennungen, Codes, Zahlen und feste Wörter** — nie Adresse, Token, IP oder Fremdtext. `bereinigeEreignis` filtert Span-Attribute nur nach IP, url, path, target und query; alle übrigen gehen ungefiltert hinaus. Ein neuer technischer SDK-Kontext (ohne Freitext) gehört in `UNBEDENKLICHE_KONTEXTE`, sonst wird er bereinigt. Der Filter ist das Netz, nicht der Plan (Inventur 1, Morgenbericht 20 §3, freigegeben 21.10.2026).
- **Eine neue Vorab-Regel (Wert hinter Leerraum, „token: …“) nur über `ersetzeVorab`, nie ein eigenes `replace` davor oder danach.** Ein Mehrfund einer Regel läuft zuletzt (Nachlese), nie mitten im Ablauf, und jedes Muster in `sentry-hygiene.ts` läuft linear: Der Filter läuft synchron in `beforeSend`, das SDK kürzt vorher nichts. Ein neues Muster ist ein Fall im Test, bei einer Änderung am Filter bestehen Vergleich und Wachstumstest. Bewusst konservativ (sichere Richtung): Ein Datum mit Uhrzeit (`01.09.2026 08:00`) und eine Dezimalzahl mit 0 und mindestens acht Nachkommastellen gelten noch als Nummer. Die Mechanik (Fehlertext, Freitext, Adressen, Zuweisungen, Lesarten, Nummernreste) steht im JSDoc der Funktionen in `src/lib/sentry-hygiene.ts` (`bereinigeFehlertext`, `bereinigeFreitext`, `ersetzeVorab`, `ersetzeZuweisungen`, `bereinigeLesarten`, `findeNummernReste`); geprüft wird sie in `tests/sentry-hygiene-felder.test.ts` (Fälle und Laufzeit), `-sdk` (echter Client), `-vergleich` (neu fängt mindestens, was main fängt) und `-wachstum` (t(4N)/t(N) < 8) (Inventur 1, Morgenbericht 20 §3, freigegeben 21.10.2026).
- **Ein sichtbarer Fehlerzustand geht getrennt vom Fehler nach Sentry (seit Nr. 56, /hoefe):** fester Satz, Tag `sichtbar=ja`, höchstens einmal je Instanz und Abstand (Regel rein in `src/lib/`, Zustand als optionaler letzter Parameter wie bei der Bremse) und ohne Anfrage-Daten — `ohneAnfrage` (`sentry-hygiene.ts`) als Event-Prozessor im `captureContext`; er läuft nach den Integrationen, die die Anfrage anhängen. Grund: Die URL-Regel lässt Suchwörter in der Adresse stehen (`?q=…`). Gemeldet wird dort, wo die Seite den Zustand rendert, nie im Lesepfad (der läuft auch beim Neubau im Hintergrund).
- **Sentry bekommt nie eine IP-Adresse:** Jedes `Sentry.init` setzt `sendDefaultPii: false` und `beforeSend` wie `beforeSendTransaction` auf `bereinigeEreignis`, nie `dataCollection` (schon ein leeres Objekt schaltet im SDK alle Vorgaben auf „sammeln“), und ein neuer IP-Träger kommt in `IP_HEADER` bzw. `IP_SPAN_ATTRIBUTE`, nie als Sonderfall an die Aufrufstelle — `tests/beobachtbarkeit.test.ts` prüft jeden init-Aufruf statisch (Inventur 1, Morgenbericht 20 §3, freigegeben 21.10.2026).

### Nutzertexte
- Deutsch, geduzt, ohne Fachjargon, mit Ausweg.
- ✅ "Deine Reservierung ist abgelaufen. Wir haben die Verfügbarkeit neu geprüft."
- ❌ "Reservation expired", "Fehler 500", "Constraint violation".

### Konsistenz bei Teilfehlschlag
- Mehrere Schreibvorgänge, die zusammengehören → `prisma.$transaction`.
- **In einer interaktiven Transaktion läuft alles nacheinander** — nie `Promise.all`/`allSettled` mit dem Transaktions-Client, auch nicht über eine vorher gebaute Liste von Aufrufen oder einen Helfer, der den Client bindet. Eine Verbindung, eine Abfrage zur Zeit; ab pg@9 ist alles andere ein Fehler (Wache `tests/transaktion-nacheinander.test.ts`, Nr. 47; Inventur 9, Morgenbericht 20 §3, freigegeben 21.10.2026).
- **Eine Liste in einer Array-Spalte (`text[]`) ändert EINE Anweisung auf der Zeile** — `array_append`/`array_remove` per `$queryRaw` mit Parametern, Besitz in derselben WHERE-Klausel, die neue Liste per `RETURNING` zurück —, nie Lesen-dann-Schreiben: Zwei Tabs überschrieben sich sonst gegenseitig ihre Einträge. Ein Zähler daneben wird in derselben Anweisung aus der neuen Liste gerechnet (`cardinality`), nie hochgezählt (Vorbild `setzeWhatsAppGetippt`, Nr. 66).
- **Eine Zeile als Sperre braucht ein echtes UPDATE.** Mit leerem `data` setzt Prisma kein UPDATE ab (geprüft mit Prisma 7.8: `updatedAt` bleibt stehen), die Zeile bleibt ungesperrt. Wer Felder nur bedingt schreibt (`...(x !== undefined && { x })`) und sich in derselben Transaktion auf die Sperre verlässt — etwa Kindzeilen löschen und neu anlegen —, schreibt `updatedAt: new Date()` immer mit (Vorbild `saveAppearanceAction`).
- Geht das nicht (externer Dienst dazwischen): Kompensation schreiben, wie beim Bestandsabzug.
- Nichts Langsames im Antwortpfad → `nachDerAntwort()`.
- **Keine Schleife über Mails in Actions oder Routen** (Register N26, Regelvorschlag 149): Massenversand nur über `stelleMailEin` (`src/server/mail-warteschlange.ts`) — EIN Aufruf für alle Empfänger, der Worker verschickt. Jede Mail nennt ihre Art (`sendRaw(…, { art })`, der Typ erzwingt sie). Eine neue Mail-Art bekommt einen Eintrag in `MAIL_ARTEN` und `MAIL_WEG`; Sofort (Code, Einmal-Link, Bestätigungslink) heißt `send…` und geht über `sendRaw`, Wichtig und Kann warten heißen `baue…`, bauen nur und haben einen Renderer in `RENDERER` (Wache `tests/mail-wege-wache.test.ts`, Nr. 159).
- Ein Betrag, der beim Ereignis feststand, geht als Cent-Ziffern unter `…Cents` in den Bezug eines Mail-Auftrags (nie neu gerechnet). Eine neue Mail-Art steht im selben Commit in genau einer der Listen `NOCHMAL_ERLAUBT` oder `NOCHMAL_NIE`. (Regelvorschlag Dirigent, Morgenbericht 24, freigegeben 25.10.2026)
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
- **Keine Farbe hart in eine Komponente schreiben** — kein Hexwert, kein `rgb()`/`hsl()`/`oklch()`, kein
  `bg-slate-700`, kein `style={{ color: '…' }}` mit einem Farbwert. Farben kommen aus Tokens in
  `src/app/globals.css` (`:root` = hell, `[data-theme="dark"]` = dunkel), geschrieben in **oklch**, der Hexwert als
  Kommentar daneben. Farbliterale meldet ESLint (`FARBLITERAL_SELEKTOREN` in `eslint.config.mjs`); die Tokens in
  beiden Modi, oklch gegen Hexwert und die benannten Hex-Ausnahmen (je mit Grund) hält `tests/design-tokens.test.ts`
  fest (Inventur 11, Morgenbericht 20 §3, freigegeben 21.10.2026).
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

### Bedeutungsfarben (Register G5)
Die vier Zustände einer Marke — tun, läuft, erledigt, abgebrochen — haben je ein
Text- und ein Flächen-Token in beiden Modi (`--fz-zustand-<art>`,
`--fz-zustand-<art>-grund`; Utilities `text-zustand-<art>`,
`bg-zustand-<art>-grund`). Gezeichnet werden sie nur vom Baustein `Marke`
(`src/components/ui/marke.tsx`). Welche Art ein Zustand hat, liefert die Fachregel
als `MarkeArt` (`src/lib/marke-art.ts`), nie als Klassen:

```tsx
// ❌ BAD — Farbe je Datei, Hexwert mit eigener dark:-Kopie
<span className="bg-[#FBEEE3] text-[#9C4D20] dark:bg-[#3A2519]">Zum Packen</span>

// ✅ GOOD — Art aus der Fachregel, Farbe aus dem Token
<Marke art={art}>Zum Packen</Marke>
```

Bedeutung ohne Marke (Hinweiskasten „Achtung", Fehlerfläche) nimmt `destructive`
oder die Hinweis-Tokens (`notice`, `notice-line`, `notice-ink`); Palette-Klassen
(`bg-amber-50`, `text-slate-700`) sind verboten, weil jede ihre eigene
`dark:`-Kopie braucht — `tests/palette-klassen-wache.test.ts` meldet jede neue,
der Bestand steht dort mit Grund und darf nur schrumpfen:

```tsx
// ✅ GOOD — Token, folgt dem Thema von selbst
<div className="rounded-lg border border-notice-line bg-notice text-notice-ink">
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
  der Lese-Stufe (`pruefeLesbarkeit`), bevor der Transfer beginnt. Dieselbe
  Erkennung liefert den Typ für den Bildspeicher (`uploadInhaltsTyp`) und das Tor
  vor sharp auf dem Server (`formatFuerSharp`) — es gibt nur die eine.
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

Die Checkliste steht in `/pruefen` (`.claude/skills/pruefen/SKILL.md`), Punkt für Punkt gegen den Diff — hier nicht
doppelt gepflegt (Inventur 8, Morgenbericht 20 §3, freigegeben 21.10.2026). Was `/pruefen` nicht nennt, bleibt hier:

- [ ] Keine harte Farbe im Bauteil; in beiden Modi angesehen (→ Abschnitt 7)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` grün
