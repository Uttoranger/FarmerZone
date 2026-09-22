# Konzept: Umfeld — was andere Höfe in der Nähe anbieten

Stand: 2026-09-22 · Status: **freigegeben** · Voraussetzung: Bereiche 1 gemerged
Verbindliche Quelle für den Sprint „Umfeld".

---

## 1. Ziel und Nicht-Ziele

**Ziel.** Ein Bauer sieht, welche Produkte andere Höfe im Umkreis gerade anbieten und in welcher Preisspanne — zur Orientierung bei Preis und Sortiment. Beispiel: „Wiesenheu in 25 km: 5 Höfe, 0,12–0,18 €/kg, Mitte 0,15." Daneben sein eigenes: „Deins: 0,14 €/kg".

**Nicht-Ziele.**
- Kein Preisvergleich Hof gegen Hof als Voreinstellung. Erst die Spanne, der Hof beim Antippen.
- Keine Benachrichtigungen, keine Historie, kein Export.
- Keine Preisänderung aus dieser Ansicht heraus.
- Keine Daten, die nicht auch auf `/hoefe` stehen.

**Warum so.** Die Plattform bringt regionale Höfe zusammen. Eine Spanne lädt zum Einordnen ein, eine Rangliste zum Unterbieten. Beides ist öffentliche Information — die Darstellung entscheidet, wozu sie einlädt.

---

## 2. Datenbasis — exakt die öffentliche Sicht

- Nur Höfe, die auf `/hoefe` sichtbar sind: freigegeben, aktiv, nicht archiviert, nicht pausiert (Invariante `ARCHITECTURE.md` §5). Dieselbe Query-Grundlage wie `getOeffentlicheHoefe`, keine zweite Sichtbarkeitslogik.
- Nur verfügbare Produkte (`isAvailable`, Bestand > 0).
- Der eigene Hof ist ausgeschlossen.
- Entfernung aus `Farm.latitude/longitude` mit der Rechnung aus `src/lib/hofuebersicht.ts`. Kein PLZ-Präfix — an der Landesgrenze unbrauchbar.
- Höfe **ohne Koordinaten** können nicht platziert werden und fehlen im Umfeld. Der Reiter nennt die Zahl in einer Zeile: „2 Höfe ohne Standort nicht berücksichtigt." Die Geokodierung fällt bei Weiler-Adressen auf die Postleitzahl zurück; diese Ungenauigkeit ist für den Pilotbetrieb hinnehmbar und wird nicht gesondert angezeigt.
- Umkreis serverseitig in zwei Schritten: Bounding-Box (Breiten- und Längengrad-Bereich) in der `WHERE`-Klausel als indexfähiger Vorfilter, danach die exakte Entfernung in der reinen Funktion. Die Box ist nie das Endergebnis.
- Ohne eigene Koordinaten: kein Ergebnis, sondern Hinweis „Trag deine Adresse ein, dann zeigen wir dir Höfe in der Nähe" mit Link zu den Einstellungen.

---

## 3. Architektur

- **Server Component** im Bauern-Bereich, Query in `src/server/queries/umfeld.ts`. **Keine API-Route** (`ARCHITECTURE.md` §3).
- Auth wie überall im Bauern-Bereich; die Query bekommt `farmId` des eingeloggten Hofs, nichts aus dem Client.
- Reine Logik in `src/lib/umfeld.ts` mit Tests: Gruppierung nach Bereich → L1 → L2, Spanne, Median, Grundpreis.
- Grundpreis über `formatGrundpreis`-Logik: €/kg bzw. €/L aus `price`, `unit`, `unitSize`; im Bereich Futtermittel aus `price ÷ nettoMenge`. Produkte ohne berechenbaren Grundpreis (Stück, Paket ohne Nettomenge) werden **gezählt, aber nicht bepreist**.
- Kein Caching in diesem Sprint; Ergebnis ist klein.

---

## 4. UI

**Ort.** Reiter **„Umfeld"** in der Auswertung. Kein neuer Nav-Eintrag.

**Kopf.**
- Umschalter Bereich: Lebensmittel | Futtermittel (`bereichVon`).
- Umkreis: 10 / 25 / 50 km, Standard 25. In der URL (`?km=25&bereich=futter`), damit Reload und Zurück funktionieren.

**Liste.** Je Unterkategorie (ohne L2: je Kategorie) **eine Zeile**:

| Wiesenheu | 5 Höfe | 120 – 180 €/t · Mitte 150 | Deins: 140 €/t |
|---|---|---|---|

- **Anzeigeeinheit je Kategorie**, intern immer €/kg bzw. €/L: Heu & Stroh → €/t; Getreide & Körner, Mischfutter, Ergänzungsfutter → €/dt (100 kg); Lebensmittel → €/kg bzw. €/L. Tabelle in `taxonomie.ts`, Skalierung in `lib/umfeld.ts`, nie in der Komponente.
- **Teilung nach Gebindeklasse:** Kommen in einer Zeile Klein- und Großgebinde vor (Schwelle `GROSSGEBINDE_AB_KG`), zeigt die Zeile zwei Spannen untereinander — „Kleingebinde 180 – 240 €/t" und „Großgebinde 120 – 150 €/t". Nur eine Klasse: eine Spanne, kein Klassenlabel. Das verhindert, dass ein 5-kg-Sack den Median der Big Bags verzerrt.
- Zeilen ohne eigenes Produkt: rechte Spalte leer, kein Hinweis.
- Zeilen mit Anzahl, aber ohne Grundpreis: „5 Höfe · Preis je Stück, nicht vergleichbar".
- Sortierung: Zeilen mit eigenem Produkt zuerst, dann nach Anzahl Höfe.

**Aufklappen einer Zeile.** Die Höfe: Name, Entfernung, Produktname, Grundpreis, Link zur öffentlichen Hofseite. Sortiert nach Entfernung, nicht nach Preis. Darunter zwei Aktionen: „n weitere Höfe" und **„Auf der Karte zeigen"** — öffnet `/hoefe` in Kartenansicht mit Bereich, Unterkategorie und Umkreis als URL-Parameter vorbelegt (setzt Bereiche 2 voraus; bis dahin Link ohne Vorbelegung). Keine zweite Karte in dieser Ansicht. Ein Hinweissatz: „Kaufen geht über die Hofseite" — der Kauf bleibt dort, mit der Vorbelegung aus `bereiche.md` 6.4.

**Leer.** „Im Umkreis von 25 km bietet gerade niemand Heu an." — kein leeres Raster. Vorschlag „Umkreis auf 50 km" als Link.

**Mobil (375 px).** Zeile zweizeilig: oben L2 + Anzahl, unten Spanne; „Deins" als Chip. Keine Tabelle, die seitlich scrollt.

---

## 5. Invarianten
- Sichtbarkeit identisch mit `/hoefe`. Wer dort nicht erscheint, erscheint hier nicht.
- Keine hofübergreifende Sicht auf **nicht-öffentliche** Daten: kein Bestand, keine Bestellungen, keine Kontaktdaten außer denen der öffentlichen Hofseite.
- Der eigene Hof ist nie in der Fremdliste.

---

## 6. Bewusst offen, mit Standard
- Median vs. Mittelwert → **Median** (robust gegen einen Ausreißer bei drei Höfen).
- Ab wie vielen Höfen eine Spanne gezeigt wird → **ab 1**, aber bei 1 Hof steht „1 Hof · 0,15 €/kg" statt einer Spanne.
- Regionalgrenze → nur Umkreis, keine Ländergrenze; Grenzhöfe sind Absicht der Plattform.
