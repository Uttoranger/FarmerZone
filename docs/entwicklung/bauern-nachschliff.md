# Bauern-Nachschliff — Mein Hof am Desktop, Shop-Balken, Kleinkram

Stand 2026-09-29 · Branch `feature/bauern-nachschliff`

Diese Datei hält den Sprint fest, weil parallel drei andere Sprints laufen und
`DEVELOPMENT.md` sowie `docs/ai/*` in diesem Sprint nicht angefasst werden
durften. Beim nächsten ruhigen Moment gehören die Abschnitte „Regeln" nach
`docs/ai/` und „Verlauf" nach `DEVELOPMENT.md`; danach fällt diese Datei.

## Was sich geändert hat

### Mein Hof — Kopf
- Das Hofbild lag **hinter** dem Titelbild: Der Streifen ist positioniert (das
  Bild füllt ihn absolut), das Hofbild war es nicht — positionierte Elemente
  malen später. Jetzt `relative z-10`, halb über dem Streifen, Rand in der
  Kartenfarbe (`ring-card`), weil es auf der Karte sitzt.
- Streifen höher (`h-24`, ab md `h-28`), Ausschnitt mittig statt nach
  `bannerFocusY` — der Fokus ist für das hohe Titelbild der Hofseite gewählt.
- Zustand über `Schild` (`src/components/farmer/schild.tsx`) — dieselbe
  Komponente wie der Abholchip auf Heute und die Chips der Produktzeile.
- Reiter „Produkte · n". Auf `/products` zählt die Seite die geladene Liste,
  auf Hofseite und Beiträgen `zaehleProdukte` (`src/server/queries/mein-hof-zahl.ts`).

### Mein Hof — Produktliste
- Kein Chip „Aktiv" mehr. Chips nur bei Abweichung („Nicht im Shop" grau,
  „Ausverkauft" rot über `destructive`, „Wenig Bestand" bernstein) und für Bio (grün), Kühlung,
  Tiefkühlung (grau — Blau wäre eine neue Bedeutungsfarbe) als Wort. Entscheidung: `zeilenChips` in `src/lib/produkt-zeile.ts`.
  `markeText` aus `produkt-sichtbarkeit.ts` ist entfallen.
- Ganze Zeile öffnet die Bearbeitung. Karte: Name als Knopf mit `::after` über der
  Karte, Bedienelemente darüber mit `relative z-10`. Tabelle: `onClick` am `<tr>`, der
  Knöpfe und Portal-Klicks übergeht (`position: relative` am `<tr>` ist in WebKit unsicher).
- „⋯"-Menü (Base UI Menu): Bestand anpassen, Löschen (rot, mit Rückfrage).
  „Duplizieren" gibt es nicht — es gibt keine Aktion dafür.
- Bestand „− n +": ±1 über die bestehende Aktion `updateStock`; Tipp auf die
  Zahl öffnet `StockDialog` (Eintippen, +5/+10/+20). „−" bei 0 gesperrt,
  `bestandNach` klemmt auf 0, der Server ebenso.
- Der Bestand ist jetzt wie die Sichtbarkeit ein `useOptimistic`-Wert. Vorher
  hielt ein `useState` den Bestand aller Produkte ab dem ersten Laden fest —
  eine Änderung im Bearbeiten-Dialog erschien erst nach Neuladen.
- Der Knopf über der Liste heißt „Produkt".
- Ab `lg`: Tabelle Produkt · Preis · Bestand · Im Shop · ⋯ über die volle
  Inhaltsbreite (`lg:max-w-none` auf `/products`), darüber Filter-Chips
  „Alle · Hofladen · Futter · Nicht im Shop · Ausverkauft" mit Zahlen aus der
  geladenen Liste (`zaehleFilter`, `passtZuFilter`). Unter `lg` Karten ohne Filter.

### Shop-Balken
- `shop-link-banner.tsx` ist gelöscht. Adresse, Kopieren und Teilen stehen im
  Kopf von Mein Hof. Die Balken „wartet auf Freigabe" und „stillgelegt" bleiben.

### Kleinkram
- Geld über `formatEuro` statt `toFixed` auf Bestellseite, beiden Druckseiten,
  Kundenliste/-tabelle/-seite, Status-Werkstatt und `servicegebuehr-anzeige.tsx`
  (dort stand „€ 20.98" mit Punkt).
- Kundenseite `/customers/[kundeId]`: `kundeId` = die ersten 16 Zeichen
  base64url von HMAC-SHA256(`BETTER_AUTH_SECRET`, `kunde:<farmId>:<email klein>`)
  (`src/lib/kunden-id.ts`). Die Seite rechnet die Kennungen der Kundinnen des
  eigenen Hofs vorwärts (`findeKundenEmail`). Alte Adressen mit `@` → 308 auf
  die neue. Keine Schemaänderung.
- Pause-Seite: „Bestellungen pausieren", alle Texte ohne „Shop"; der Satz im
  pausierten Zustand sagt jetzt, dass die Hofseite sichtbar bleibt (so ist es
  laut ARCHITECTURE §5).
- Produktformular: eine Vorschauzeile „Kunden sehen: € 45,00 / Ballen ·
  € 0,15 / kg" (`kundenVorschau` mit Nettoangabe). `vergleichsKilopreis` ist entfallen.

## Regeln, die nach `docs/ai/` gehören

- ARCHITECTURE §4 „Bauern-Bereich: Navigation": Der Satz über
  `shop-link-banner.tsx` ist überholt (Datei gelöscht); `farm-page-client.tsx`
  kopiert als einziger Altbestand noch selbst.
- CODING_STANDARDS §7 oder ARCHITECTURE: Schilder im Bauern-Bereich nur über
  `Schild` (`components/farmer/schild.tsx`), Farben als `SchildFarbe`
  (`src/lib/mein-hof.ts`: gruen, bernstein, grau, rot).
- ARCHITECTURE: Ganze Karte als Tippfläche = Knopf mit `::after` + Bedienelemente
  `relative z-10`; Tabellenzeile mit `onClick`, das Portal-Klicks (`contains`) und Knöpfe übergeht.
- CODING_STANDARDS §3: Keine personenbezogenen Daten im Pfad — Kundenseite
  über `kundeIdFuer`.
- ARCHITECTURE §6: Die Zeile zu `preis-format.ts` bleibt; `servicegebuehr-anzeige.tsx`
  rechnet jetzt über `format.ts`.

## Offen

- Heute zeigt keine Adresse mit Kopieren — der Auftrag nahm das an; sie steht
  im Kopf von Mein Hof. Nicht nachgebaut, weil nicht beauftragt.
- `updateStock` liest und schreibt blind (kein bedingtes `updateMany`); zwei
  Tipps aus zwei Geräten gleichzeitig können einen verlieren. Die Liste sperrt
  den Stepper je Produkt, solange ein Tipp läuft. Umbau wäre ein eigener Fix.
