# Morgenbericht Lauf 28 (31.10.2026) · Kasse rechtssicher, Nacharbeit aus Lauf 27

Fünf von sechs Nummern (208, 210, 212, 213, 214) sind gebaut, geprüft und im Sammel-PR. **Nicht begonnen: 211** – die Datei `public/recht/gewaehrleistung-mitteilung-de.png` (bzw. `.svg`) lag beim Start weder auf main noch im Arbeitsverzeichnis (Freigabe „Stand“). **Ausgangslage:** bei jeder gebauten Nummer am Code bestätigt (je Bericht). **Migration:** genau eine, `20261031200000_ruecktritt_je_produkt` (Nr. 214, nur Expand); Regel 3 auf frischer Wegwerf-DB ohne Unterschied. Kein neues Paket, keine neue Variable.

## PRs

| Nr. | PR | Basis | Runden | Kurz |
|---|---|---|---|---|
| Doku | #433 | main | – | Freigabe §32, Register-Ergänzungen N17/G8/N2-E5/N39, Vormerkung 209, Status |
| 210 | #434 | main | 0 | Zusammenfassung unmittelbar über jedem Kaufknopf (§ 8 Abs. 1 FAGG) |
| 208 | #435 | main | 0 | Zod ohne eval-Probe im Browser; asn1.js geprüft |
| 212 | #436 | main | 0 + Nachbesserung | Hof-E-Mail Pflicht für aktive Höfe |
| 213 | #437 | main | 1 | Nacharbeit aus Morgenbericht 27 (Protokoll vor der Erstattung u. a.) |
| 214 | #438 | integration/lauf28 | 0 | Je Produkt „kein Rücktritt“ und geschätzte Rücksendekosten (Migration) |
| Sammel 28 | (dieser PR) | main | – | alles oben per `--no-ff`, Reihenfolge im Zeitbuch |

Dirigent-Eingriffe: 212 Vorbelegung mit der Anmelde-Adresse zum Blocker hochgestuft (sonst stünde sie fest gespeichert wieder in der Belehrung) → Feld leer, Pflicht auch serverseitig, Sperre in der Warteliste, Profil ohne „freiwillig“ · 213 `utcTag` wiederverwendet, Sentry-Merkmal `notfallStorno` · GRENZE bestätigt bei 210, 213, 214 (Datenweg der Mails).

## Zu den einzelnen Nummern

### 208
- `config({ jitless: true })` steht einmal in `src/instrumentation-client.ts` (läuft vor jedem Schema-Modul, am Build belegt).
- **asn1.js:** nicht im Abhängigkeitsbaum. Vorhanden ist nur `asn1js` 3.0.10 über @peculiar/* und @simplewebauthn/server (von @better-auth/passkey) – nur serverseitig in `src/lib/auth.ts`; in keinem Browser-Chunk (auch Admin). Kein Austausch nötig.
- **zodResolver:** 7 Dateien, 5 rufen ihn auf (Registrierung, Hof anlegen, Abschnitt-Formulare, Produktdialog, Profil), 2 nur im Kommentar.

### 210
- Bilder: `docs/nachtlauf/berichte/bilder/210/zahlungsschritt-{390,1440}-{hell,dunkel}.jpg` und `bar-…` (Stripe lädt lokal nicht, das Zahlungsfeld ist im Bild leer).
- Aus der Fußzeile unter „Jetzt bezahlen“: die Abholung zog in die Zusammenfassung über den Knopf; „Bezahlung sicher über Stripe“ entfiel (steht schon in der Karte „Bezahlen“).
- Am Handy steht die Übersicht im Zahlungsschritt jetzt am Ende, direkt über dem Knopf (Mockup: unter dem Korb) – zur Abnahme.

### 211
Nicht begonnen (Datei fehlte). Quelle, Abrufdatum und Dateigröße der Grafik: –.

### 212
Freigeschaltete Höfe ohne Hof-E-Mail in der Produktion (lesend gezählt): **0 von 4**.

### 214
- **Vorbelegung des Hakens (nur beim Anlegen):** gesetzt bei Milch, Eier, Fleisch, Fisch, Gemüse, Obst, Brot; nicht gesetzt bei Honig, Getränke, Futtermittel, Heu & Stroh, Getreide & Körner, Mischfutter, Ergänzungsfutter, Brennholz, Sonstiges.
- **Offene Rechtsfragen (Anwältin):**
  1. Der kurze Hinweis „Kein Rücktritt: verdirbt schnell“ sagt nicht „nach Angabe des Hofs“ (das steht nur auf /widerruf).
  2. Gemüse und Obst sind vorbelegt, obwohl Lagerware (Erdäpfel, Äpfel) kaum schnell verdirbt.
  3. „Rücksendung geschätzt ca. € X“ vor dem Kauf, aber „Die Kosten werden auf höchstens etwa X EUR geschätzt.“ in der Belehrung.
  4. Summe der Schätzungen über alle Positionen – oder der Höchstwert je Ware?
  5. Wie passt die Schätzung zum Hinweis „Waren, die du am Hof abgeholt hast, kannst du dort auch zurückgeben; dann entstehen dir keine Rücksendekosten“?
  6. Der 5-b-Satz steht nur in der Mail, nicht in der Belehrung auf /widerruf.

## Bitte entscheiden

1. **210 – AGB- und Rücktrittssatz unter „Jetzt bezahlen“:** Beide stehen nur unter „Weiter zur Zahlung“, nicht unter „Jetzt bezahlen“, wo die Online-Bestellung verbindlich wird (N2). Die Freigabe sagte „unverändert“. Ergänzen?
2. **210 – Handy-Reihenfolge im Zahlungsschritt** (Übersicht am Ende statt unter dem Korb, Reservierungsfrist rückt mit nach unten): so abnehmen?
3. **214 – Fließkomma-Wache:** ein Bestandseintrag mehr (Int-Cent × Menge, mit Grund), obwohl der Bestand nur schrumpfen soll. Bestätigen oder eine Ausnahme für Int × Int als Regel?

## Nacharbeit (Vorschläge, nicht gebaut)
- 214: die zwei Felder im Familien-Formular (neues Futter, Brennholz mit Verkaufsgrößen); bis dahin über „Bearbeiten“.
- 214: `hinweisRuecksendung` setzt das geschützte Leerzeichen per `replace` nach `formatEuro` – als Option in `format.ts` lösen.
- 210: Abholtermin steht im Formular doppelt (Zusammenfassung und Zeile unter dem Knopf); Bausteine-Vorschau zeigt `KaufZusammenfassung` noch nicht.
- 212: Profil bleibt mit leerem Feld speicherbar (kein Lockout) – Pflicht dort nach dem Go-live?
- 213: Umfangszeile, wenn bei einem offenen Widerruf schon alle gewählten Positionen gestrichen sind; Seiten-Tests mocken noch das entfernte `reorderPhotosAction`.

## Für dich zu tun

1. **Abnahme in der Testumgebung test.agrilo.at** (nach dem Merge):
   - Zahlungsschritt online und Bar-Kasse: Zusammenfassung (Ware, Gesamt, Abholung, „Dein Vertragspartner“) direkt über dem Knopf, als Privat und als Betrieb; am Handy die neue Reihenfolge.
   - Bestätigungsmail einer Bestellung mit einem Produkt mit Rücksendekosten: 5-b-Satz in der Belehrung mit Betrag; ohne solches Produkt fehlt er.
   - Produkt mit beiden Feldern anlegen (Haken, Schätzung) und in Produktseite, Kasse und /widerruf (über den Link aus der Mail) sehen.
   - Freischalten eines Hofs ohne Hof-E-Mail → Fehler; Heute-Karte bei leerem Feld; „Hof einrichten“ mit leerem Pflichtfeld.
   - CSP-Bericht in Sentry nach dem Deploy: keine `script-src eval`-Meldungen mehr.
2. **Grafik für 211** ablegen (`public/recht/gewaehrleistung-mitteilung-de.png` oder `.svg`, amtliche Fassung, unverändert) samt Quelle und Abrufdatum – dann ist 211 ein eigener Auftrag.
3. **Rundschreiben an die Höfe** (Vorschlag aus Bericht 214): „Neu im Produktformular unter Details › Rücktritt: Hak an, wenn deine Ware schnell verdirbt (z. B. frisches Fleisch, Milch, Brot) – dann sieht die Kundin vor dem Bestellen, dass kein Rücktritt möglich ist. Verkaufst du sperrige Ware wie Brennholz, Heu oder Großgebinde, trag ein, was eine Rücksendung ungefähr kostet. Ohne Angabe bleibt alles wie bisher. Bitte schau deine Produkte einmal durch.“
4. **Texte aus 214 an die Anwältin** (Rechtsfragen 1–6 oben).
5. **Merge per Merge-Commit:** zuerst Doku-PR #433, dann der Sammel-PR. Die Migration spielt `vercel-build` beim Merge auf main ein.
