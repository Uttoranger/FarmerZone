# Skill-Audit, September 2026

Stand: 2026-09-25 · Branch `docs/skills-audit` · Basis `c232bf3`

Drei Prüfungen, jede gegen einen Hersteller-Skill als Maßstab, alle **nur lesend**.
Es wurde kein Code geändert, kein Paket installiert, nichts umgebaut.

| | Bereich | Maßstab |
|---|---|---|
| A | Barrierefreiheit und Bedienbarkeit | `.claude/skills/web-design-guidelines/` |
| B | Tempo | `.claude/skills/vercel-react-best-practices/` |
| C | Datenbank | `.claude/skills/supabase-postgres-best-practices/`, `.claude/skills/prisma-client-api/` |

Alle vier Skill-Dateien waren vorhanden und wurden direkt als Datei gelesen.
`web-design-guidelines` kam mit #121 dazu.

**Was diese Prüfung nicht konnte.** Die Sitzung lief in der Cloud ohne Datenbank und
ohne Browser: kein `pnpm build`, kein `pnpm start`, keine Messung am Gerät, kein
`EXPLAIN`. Jeder Befund stützt sich allein auf gelesene Codezeilen. Wo eine
Größenordnung behauptet wird — Bundle-Kilobyte, LCP-Kandidat, Kontrastwert —, ist das
gerechnet oder abgeschätzt, nicht gemessen. Vor dem Umbau einer Stelle gehört die
Messung davor, nicht danach.

**Regelvorrang.** Widerspricht eine Skill-Empfehlung einer Regel in `docs/ai/`, gilt
`docs/ai/`. Solche Befunde stehen trotzdem hier, mit dem Vermerk „Konflikt".

---

## Die zehn lohnendsten

Nur **neue** Befunde, sortiert nach Wirkung geteilt durch Aufwand. Bei Platz 1 ist das
Fehlerbild schon einmal behoben worden, nur an einer anderen Stelle — die Fundstelle ist
neu, das Muster nicht. Es steht trotzdem vorn, weil es im Geldweg liegt und klein zu
beheben ist.

1. **`src/components/sales/sale-dialog.tsx:226`** — Der Betrag im Verkaufsdialog ist `type="number"` mit `valueAsNumber`; eine Eingabe mit Komma kommt je nach Browser still als `NaN` an. `CODING_STANDARDS.md:286` verlangt für Dezimalwerte ausdrücklich `DezimalFeld`, das es unter `src/components/shared/dezimal-feld.tsx` längst gibt. **Geld · klein** — *das Muster ist bekannt: `DEVELOPMENT.md:928` beschreibt genau diesen Fehler und seine Behebung im Produktformular. Neu ist nur, dass der Verkaufsdialog damals nicht mitgezogen wurde.*
2. **`src/server/queries/admin.ts:92`** — Die Monatsabrechnung liest ein Kalendermonat-Fenster über `Order.createdAt`, für das kein Index existiert: Seq Scan über eine Tabelle, die sieben Jahre aufbewahrt wird. **Geld · klein**
3. **`src/server/queries/manual-sales.ts:80`** — Alle Umsatzabfragen filtern `farmId` + `status` + `pickedUpAt`-Fenster. `farmId` und `status` sind einzeln indiziert, `pickedUpAt` gar nicht, und einen zusammengesetzten Index gibt es nicht. Fünf weitere Stellen mit derselben Kombination. **Geld · klein**
4. **`src/components/farm/cart-sheet.tsx:72`** — Minus, Plus und Papierkorb im Warenkorb sind 28 × 28 px und haben keinen `aria-label`. Das ist der Weg zum Kauf. **Geld · klein**
5. **`src/components/checkout/checkout-form.tsx:524`** — Der Fehler zum Abholtermin ist mit der Radiogruppe nicht verbunden und wird ohne Live-Region eingeblendet; wer nicht sieht, erfährt nicht, warum das Absenden nicht weitergeht. **Geld · klein**
6. **`src/components/farm/product-grid.tsx:741`** — Der klebende Warenkorb-Knopf sitzt `bottom-6` ohne `env(safe-area-inset-bottom)` und rutscht auf Geräten mit Home-Indikator unter die Kante. Das Produktdetail macht es zwei Dateien weiter schon richtig. **Geld · klein**
7. **`src/app/(public)/[farmSlug]/page.tsx:15`** — `getPublicFarm` läuft je Seitenaufruf zweimal (`generateMetadata` und Seite), ohne `cache()` aus React. Die Abfrage zieht alle Produkte samt Futter-Kennzeichnung. **Tempo · klein**
8. **`src/app/api/checkout/route.ts:145`** — Der Checkout lädt den Hof mit `include` statt `select` und dazu ein `owner.name`, das im ganzen Handler nie gelesen wird; mitgeschleppt werden `description`, `aboutText` (`@db.Text`) und `sectionsConfig`. **Tempo · klein**
9. **`src/components/products/product-list.tsx:320`** — Die drei Symbolknöpfe der Aktionsspalte tragen nur `title`, keinen `aria-label`, sind 40 px breit, und Löschen grenzt direkt an Bearbeiten. Das 44-px-Mindestmaß ist keine Skill-Empfehlung, sondern Hausregel (`DEVELOPMENT.md:476`). **Bedienbarkeit · klein**
10. **`src/app/globals.css:180`** — `--app-ink-faint` erreicht im hellen Modus rund 2,4:1 gegen die Seitenfarbe und trägt dort Fußzeilen-Links und inaktive Reiter der Hofseite. `CODING_STANDARDS.md:270` verlangt 4,5:1 in beiden Modi. **Vertrauen · mittel**

Neun von zehn sind kleine Eingriffe. Drei davon (1, 4, 5) liegen im Geldweg.

---

## A — Barrierefreiheit und Bedienbarkeit

Format je Zeile: Nr · Datei:Zeile · Befund · Wirkung · Aufwand · Regel aus dem Skill · Konflikt mit `docs/ai/` · neu/bekannt

1 · `src/components/products/product-list.tsx:320` · Die drei Symbolknöpfe der Aktionsspalte tragen nur `title`, keinen `aria-label`, sind mit `w-10` schmaler als 44 px, und Löschen grenzt unmittelbar an Bearbeiten · Bedienbarkeit · klein · Accessibility, „Icon-only buttons need `aria-label`" · nein · neu

2 · `src/components/farm/cart-sheet.tsx:72` · Minus, Plus und Papierkorb im Warenkorb-Sheet haben keinen `aria-label` und sind 28 × 28 px · Geld · klein · Accessibility, „Icon-only buttons need `aria-label`" + Touch-Mindestmaß (`DEVELOPMENT.md:476`) · nein · neu an dieser Stelle

3 · `src/components/ui/sheet.tsx:69` · Der Schließknopf jedes Sheets ist mit `size="icon-sm"` 28 px groß und heißt für Vorleseprogramme englisch „Close" (ebenso `dialog.tsx:69` und `:75`) · Bedienbarkeit · klein · Touch & Interaction (`DEVELOPMENT.md:476`) + Wortlautregel CLAUDE.md §5 · nein · neu an dieser Stelle

4 · `src/components/sales/sale-dialog.tsx:226` · Betrag und Menge sind `type="number"` mit `valueAsNumber`, sodass eine Eingabe mit Komma still als `NaN` ankommt, statt `DezimalFeld` zu benutzen · Geld · klein · Forms, „Use correct `type` and `inputmode`" · **nein** — die Hausregel `CODING_STANDARDS.md:286` verlangt dasselbe, nur strenger; die Stelle verstößt gegen beide · Muster **bekannt** (`DEVELOPMENT.md:928`, Produktformular), diese Stelle neu

5 · `src/app/globals.css:180` · `--app-ink-faint` (#9AA08F) erreicht im hellen Modus rund 2,4:1 gegen `--app-page` und 2,7:1 gegen `--card` und trägt dort Fußzeilen-Links (`farm-page-view.tsx:1355`) und inaktive Reiter (`farm-page-view.tsx:1085`) · Vertrauen · mittel · Dark Mode & Theming; verbindlich `CODING_STANDARDS.md:270` · nein · neu

6 · `src/components/checkout/checkout-form.tsx:524` · Die Fehlermeldung zum Abholtermin hat keine `id`, kein `aria-describedby`/`aria-invalid` an der Radiogruppe und keine Live-Region; die übrigen Checkout-Fehler erscheinen ebenfalls ohne `aria-live`, anders als auf den Anmeldeseiten · Geld · klein · Accessibility, „Async updates need `aria-live='polite'`" · nein · neu

7 · `src/components/farm/product-grid.tsx:741` · Der klebende Warenkorb-Knopf sitzt mit `fixed bottom-6` nur 24 px über der Kante und ragt in die Safe Area, während das Produktdetail dafür schon `env(safe-area-inset-bottom)` nutzt · Geld · klein · Safe Areas & Layout · nein · neu

8 · `src/components/products/stock-dialog.tsx:120` · „Direkt setzen auf" ist ein `<Label>` ohne `htmlFor` und umschließt das Feld nicht, sodass das Bestandsfeld (Zeile 124) unbenannt bleibt · Bedienbarkeit · klein · Forms, „Form controls need `<label>` or `aria-label`" · nein · neu

9 · `src/components/orders/order-status.ts:22` · Die Statusmarken erreichen im hellen Modus nur etwa 2,3:1 (#E8854A auf #FBEEE3, dasselbe Paar in Zeile 24; #9AA08F auf #F0EDE5 in den Zeilen 26, 27 und 29) bei `text-xs` · Bedienbarkeit · klein · Dark Mode & Theming; verbindlich `CODING_STANDARDS.md:270` · nein · neu — betrifft ausschließlich den HELLEN Modus, denn jeder Zweig dieser Datei trägt eine `dark:`-Entsprechung

10 · `src/components/farmer/segment-control.tsx:26` · Das aktive Segment ist nur über die Hintergrundfarbe erkennbar, ohne `aria-pressed`, `aria-current` oder Tab-Semantik, und die Knöpfe sind mit `min-h-[38px]` unter 44 px — betrifft die Filter in Bestellungen und Verkäufen · Bedienbarkeit · klein · Accessibility, „Use semantic HTML before ARIA" + Touch-Mindestmaß (`DEVELOPMENT.md:476`) · nein · neu an dieser Stelle

**Nicht als eigene Befunde geführt, weil klein und gleichartig:** `product-dialog.tsx:829` und
`sale-dialog.tsx:173` zeigen mit `htmlFor` auf eine ID, die es nicht gibt.

**Ohne Befund geblieben:** die Hofübersicht `/hoefe` samt Liste, Facetten-Sheet,
Umkreissuche und Fotostreifen (durchgehend `aria-label`, `aria-pressed`, `role="status"`,
`min-h-11`, Safe Area im Sheet-Fuß), das Produktdetail der Hofseite, die Startseite samt
Navigationsleiste (Fokusrückgabe, Escape, `prefers-reduced-motion` für den Hero-Loop) und
die Bestell-Aktionen im Bauernbereich (`min-h-[52px]`, Bestätigungsdialoge,
Rückgängig-Fenster). Der Checkout ist bis auf Befund 6 vorbildlich: `autoComplete`,
`inputMode`, `aria-invalid`, `aria-describedby` und der Sprung zum ersten Fehler sind da.
`globals.css` pflegt `color-scheme` in beiden Modi und für jeden Bedeutungswert eine
`dark:`-Entsprechung.

---

## B — Tempo

1 · `src/app/(public)/[farmSlug]/page.tsx:15` · `getPublicFarm` läuft je Aufruf zweimal (Zeile 15 in `generateMetadata`, Zeile 53 in der Seite) und `src/server/queries/` importiert `cache` aus React nirgends · Tempo · klein · `server-cache-react` · nein · neu

2 · `src/app/page.tsx:298` · Das `poster`-Attribut des Hero-Loops holt `hero-poster.jpg` unoptimiert ein zweites Mal, obwohl `next/image` dasselbe Bild in Zeile 273 schon als Basis darunterlegt · Tempo · klein · `rendering-resource-hints` · nein · neu

3 · `src/components/hoefe/hoefe-client.tsx:56` · `HoefeKarussell` ist hart importiert, obwohl es nur im Karten-Reiter gerendert wird — die Karte daneben kommt korrekt über `next/dynamic` mit `ssr: false` (Zeile 64) · Tempo · klein · `bundle-dynamic-imports` · nein · neu

4 · `src/components/hoefe/hoefe-fotostreifen.tsx:88` · Jedes Streifenfoto trägt fest `loading="lazy"`, auch das erste Foto der obersten Hofkarte, das auf `/hoefe` über dem Falz steht · Tempo · klein · `rendering-resource-hints` · nein · neu

5 · `src/components/farm/farm-page-view.tsx:16` · `@dnd-kit/sortable` und `@dnd-kit/utilities` sind hart importiert und `ReorderContext` wird auch mit `enabled={false}` gerendert (Zeile 284), ebenso in `product-grid.tsx:7` — Kundinnen laden die Sortierbibliothek, die nur der Hofbetreiber braucht · Tempo · mittel · `bundle-dynamic-imports` · nein · neu

6 · `src/components/farm/cart-sheet.tsx:52` · Das Warenkorb-Vorschaubild ist ein rohes `<img>` mit abgeschalteter ESLint-Regel und lädt die Original-Blob-Datei in voller Größe in ein 56 × 56-px-Feld · Tempo · klein · `rendering-resource-hints` (keine eigene Bildregel im Skill) · nein · neu

7 · `src/app/(public)/[farmSlug]/page.tsx:9` · Die Seite ist `force-dynamic`, wartet alle Abfragen vor dem ersten JSX ab und hat weder `loading.tsx` noch eine `Suspense`-Grenze, sodass bis zur fertigen Antwort nichts gestreamt wird · Tempo · mittel · `async-suspense-boundaries` · nein · neu

8 · `src/app/page.tsx:347` · Der Chevron der Startseite wird direkt am `<svg>` animiert statt an einem Wrapper-Element · Tempo · klein · `rendering-animate-svg-wrapper` · nein · neu — **geringe Wirkung:** `animate-pulse` bewegt nur `opacity`, das bleibt auch am `<svg>` compositor-fähig; hier geht es um Regelkonformität, nicht um messbares Tempo

9 · `src/app/(public)/[farmSlug]/page.tsx:58` · `getActiveStatusPost` und `loadReorderItems` werden nacheinander abgewartet, obwohl beide nur `farm.id` brauchen — wirksam allerdings nur, wenn ein Nachbestell-Link im Spiel ist, sonst entfällt die zweite Abfrage ganz · Tempo · klein · `async-parallel` · nein · neu

10 · `src/components/landing/landing-nav.tsx:98` · Die klebende Startseiten-Leiste schaltet beim Scrollen `backdrop-blur-[8px]` zu, und `globals.css` enthält keine einzige `prefers-reduced-motion`-Regel (nur zwei `motion-safe:`-Stellen in ganz `src/`) · Tempo · klein · `js-batch-dom-css` · nein · **bekannt** (Bug-Report Befund 29, Restbestand)

**Zu Befund 29:** Der Bug-Report liegt NICHT im Repository — weder der Begriff noch
die Zahl „über 200 animierte Elemente" ist in `DEVELOPMENT.md` oder im Code dokumentiert.
Die Einordnung als bekannt stützt sich allein auf die Aufgabenstellung dieses Audits. Das
ist selbst ein Befund: Ein Bug-Report, auf den sich mehrere Sprints berufen, gehört
nachlesbar ins Repo. Im Code sind es heute 44 `animate-`-Stellen, 17-mal `transition-all`
und drei `backdrop-blur` — nicht mehr „über 200 animierte Elemente". Offen bleibt davon
die Weichzeichnung der klebenden Leiste und die fehlende globale Reduced-Motion-Regel.
Die Animationen selbst sind durchweg mit `motion-safe:` versehen; was fehlt, ist die
Regel für alles, was das Präfix nicht trägt.

**Ohne Befund geblieben:** `getOeffentlicheHoefe` startet die Produktzeilen-Abfrage vor
der Hof-Abfrage und wartet sie erst später ab — kein Wasserfall, kein N+1. Leaflet kommt
korrekt über `next/dynamic` mit `ssr: false`. Recharts liegt nur in
`analytics-dashboard.tsx` und damit in keiner der drei geprüften Seiten. Hof-Banner und
Hero-Standbild tragen `priority` und passende `sizes`, die Editorial-Bilder bewusst nicht.
`lucide-react` steht in Next 16 ohnehin in der Standardliste von `optimizePackageImports` —
dort ist nichts zu tun.

---

## C — Datenbank

1 · `src/server/queries/manual-sales.ts:80` · Die Umsatzabfragen filtern `farmId` + `status='PICKED_UP'` + `pickedUpAt`-Fenster; `farmId` und `status` haben je einen Einzelindex, `pickedUpAt` keinen, und einen zusammengesetzten gibt es nicht; fehlt: `(farmId, status, pickedUpAt)` — dieselbe Kombination in `dashboard.ts:73`, `:90`, `analytics.ts:86`, `:209`, `manual-sales.ts:88` · Geld · klein · `query-composite-indexes` · nein · neu

2 · `src/server/queries/orders.ts:44` · Die Bestellliste filtert `farmId` und sortiert nach `pickupDate, pickupTimeStart`; fehlt: `(farmId, pickupDate)` — dasselbe Muster in `dashboard.ts:49` · Bedienbarkeit · klein · `query-composite-indexes` · nein · neu

3 · `src/server/queries/admin.ts:92` · Die Monatsabrechnung gruppiert alle Bestellungen eines Kalendermonats über ein `createdAt`-Fenster, für das kein Index existiert; fehlt: `(createdAt)` bzw. `(farmId, createdAt)` — letzteres auch für `dashboard.ts:106` und `customers.ts:70` · Geld · klein · `query-missing-indexes` · nein · neu

4 · `src/server/queries/dashboard.ts:112` · Für die einzige Kennzahl „Kunden gesamt" lädt die Übersicht `customerEmail` jeder Bestellung des Hofs und lässt Prisma `distinct` anwenden, statt in der Datenbank zu zählen · Tempo · klein · `model-queries` (`groupBy`/`count` statt `findMany` + `distinct`) · nein · neu

5 · `src/server/queries/customers.ts:59` · Die Kundenliste lädt ungedeckelt jede Bestellung des Hofs samt Positionen und aggregiert in Node — ohne `take`, `cursor` oder `groupBy` wächst die Seite linear mit der Historie · Bedienbarkeit · mittel · `data-pagination` · nein · neu

6 · `src/server/queries/customers.ts:177` · Der Vergleich von `customerEmail` mit `mode: 'insensitive'` macht den B-Tree-Index `Order_customerEmail_idx` unbenutzbar; nötig wäre ein Ausdrucksindex auf `lower("customerEmail")` — gleiche Stelle in `customers.ts:196` · Tempo · mittel · `query-missing-indexes` · nein · neu

7 · `src/app/api/checkout/route.ts:145` · Der Checkout lädt den Hof mit `include` statt `select` und zieht `description` und `aboutText` (beide `@db.Text`) sowie `sectionsConfig` mit, dazu einen Join auf `owner.name`, der nie gelesen wird (verwendet wird `farm.ownerName`) · Tempo · klein · `query-options` (`select` statt `include`) · nein · neu

8 · `src/app/api/checkout/route.ts:313` · Der Bestandsabzug schickt je Warenkorbposition ein eigenes `updateMany` in einer Schleife (die Gutschrift in `route.ts:77` ebenso), also N Rundreisen im Antwortpfad · Tempo · mittel · `data-n-plus-one` · **ja, Konflikt mit CLAUDE.md §2** — die Einzelabfrage ist die erzwungene Form: nur so lässt sich `res.count === 0` je Position auswerten und der schon gebuchte Rest ausgleichen; Zusammenfassen würde die Geldregel brechen, der Befund bleibt notiert, umsetzbar ist er nicht · neu

9 · `src/app/api/checkout/route.ts:409` · Vor dem `upsert` der Newsletter-Zustimmung steht ein `findUnique` auf denselben eindeutigen Schlüssel, dessen Ergebnis nichts entscheidet — ein im `update` nicht gesetztes Feld bleibt ohnehin unverändert · Tempo · klein · `data-upsert` · nein · neu

10 · `prisma/migrations/20260804091431_enable_rls/migration.sql:30` · RLS ist auf allen Tabellen aktiv, aber in keiner Migration gibt es eine `CREATE POLICY`; da die App als Eigentümerrolle verbindet und kein `FORCE ROW LEVEL SECURITY` gesetzt ist, sperrt das praktisch nur `anon`/`authenticated` der Supabase-Daten-API aus · Vertrauen · groß · `security-rls-basics` · nein — bewusste Entscheidung, in `DEVELOPMENT.md` begründet · **bekannt**

**Was das zu RLS heißt, ohne Beschönigung und ohne Dramatik:** Es ist kein Datenleck,
solange die Supabase-Daten-API ungenutzt bleibt und niemand einen Schlüssel für `anon`
ausgibt. Es ist aber auch kein Schutz gegen einen Fehler in der App selbst: Eine Abfrage,
die den `farmId`-Filter vergisst, sieht weiterhin alles. Der Schutz dagegen sind heute die
Ownership-Prüfungen in den Server-Actions, nicht die Datenbank.

**Tabellen ohne Policy** (alle, in keiner Migration existiert eine): User, Session,
Account, Verification, Farm, Product, FutterKennzeichnung, PickupSlot, Order, OrderItem,
ManualSale, StockReservation, WebhookEvent, CustomerFarmSubscription, StatusPost,
FarmValue, FarmPhoto, Meldung und `_prisma_migrations` (Migration Zeile 46). Die
RLS-Migration hat keine Tabelle übersehen: Die beiden
danach angelegten (`FutterKennzeichnung`, `Meldung`) bringen ihr `ENABLE ROW LEVEL
SECURITY` in der eigenen Migration mit.

**Ohne Befund geblieben:** `appearance.ts`, `status-posts.ts` und `meldung.ts` (schmale
`select`-Listen, `take`-Deckel, passende Indizes), keine echten N+1-Schleifen in `farm.ts`,
und kein Verstoß gegen die Geldregeln — `Decimal` bleibt bis zur Berechnung `Decimal`,
gewandelt wird erst an der Client-Grenze. Zu geringfügig für eigene Zeilen: `route.ts:300`
liest zur Kollisionsprüfung die ganze Bestellzeile statt nur `id`, und `products.ts:84`
holt die Futter-Kennzeichnung per `include: { futter: true }` mitsamt `id`, `productId`,
`createdAt`, `updatedAt`. Außerhalb des Auftrags aufgefallen: `orders.ts:41` lädt jede
Bestellung eines Hofs ohne `take`, und `src/components/ui/form.tsx:51` prüft `!fieldContext`
gegen einen Default von `{}` — die Schutzabfrage greift also nie, wodurch die beiden
`htmlFor`-Stellen aus Abschnitt A unbemerkt bleiben konnten.

---

## Bewusste Entscheidungen, die kein Befund sind

Beim Nachprüfen der Prüferberichte habe ich vier Stellen korrigiert. Sie stehen hier,
damit sie nicht beim nächsten Audit wieder als neu auftauchen.

1. **Der Hero-Loop lädt auf allen Breiten — mit Absicht.** Prüfer B hat die fehlende
   Breiten-Bedingung an der `<source>` als Befund geführt. Sie wurde im Sprint
   `landing-video-mobil` bewusst entfernt, damit die Schleife auch auf dem Telefon läuft;
   die Begründung steht im Kommentar bei `src/app/page.tsx:281`, und `preload="none"` hält
   das Standbild als LCP-Kandidat frei. Übrig blieb davon nur das doppelt geholte
   `poster` (B, Befund 2).
2. **Filtern im Browser ist Hausregel, keine Nachlässigkeit.** Prüfer B hat die große
   Client-Insel von `/hoefe` als Konflikt mit `ARCHITECTURE.md` markiert. Der Konflikt
   besteht, aber er ist entschieden: `ARCHITECTURE.md:122` verlangt Filter in der URL ohne
   Server-Roundtrip je Tastendruck.
3. **Der ungedeckelte Payload der Hofübersicht ist begründet.** Prüfer B hat `angebot`
   und `suchNamen` je Hof als Befund geführt. Beide Felder tragen im Schema-Kommentar
   ihre Begründung: `farm.ts:562` sagt ausdrücklich „UNGEDECKELT", weil ein Hof, dessen
   gesuchtes Produkt erst an Platz neun steht, sonst ein falsches Negativ wäre; `:545`
   nennt `angebot` als Grundlage für Bereich, Facetten, Karte und Kilopreis-Sortierung im
   Browser. Das ist der Preis der Entscheidung aus Punkt 2, kein Versehen. **Zu beobachten,
   nicht zu beheben:** Der Payload wächst mit der Zahl der Produkte je Hof — bei einem
   Pilothof unkritisch, bei fünfzig Höfen mit je hundert Produkten die erste Stelle, an
   der man nachmessen sollte.
4. **`DezimalFeld` ist kein Konflikt, sondern dieselbe Regel.** Prüfer A hat den
   Zahlenfeld-Befund als „Konflikt mit `CODING_STANDARDS.md`" markiert. Das Gegenteil
   trifft zu: Die Hausregel verlangt genau das, was der Skill empfiehlt, nur strenger. Die
   Stelle verstößt gegen beide — deshalb steht sie jetzt auf Platz 1.

---

## Was die Gegenprüfung ergeben hat

Ein vierter Durchgang hat die Stellenangaben nachgelesen — sie sind das, wovon ein Audit
lebt. Geprüft wurden über dreißig `Datei:Zeile`-Angaben; elf Stellen mussten korrigiert
werden, und sie sind oben schon eingearbeitet:

- Zwei **falsche Zeilennummern**: das `pickedUpAt`-Fenster steht in `manual-sales.ts:80`,
  nicht `:88`, und das zweite Farbpaar der Statusmarken in `order-status.ts:24`, nicht `:26`.
- Eine **falsche Behauptung**: `order-status.ts` trägt in *jedem* Zweig eine
  `dark:`-Entsprechung — die Kontrastschwäche betrifft allein den hellen Modus.
- Eine **falsch gesetzte Konfliktspalte**: die Schleife aus Einzel-`updateMany` im Checkout
  (C 8) ist die von `CLAUDE.md` §2 erzwungene Form, kein behebbarer Befund.
- Eine **zu starke Formulierung**: nur `farmId` sei indiziert (C 1) — `status` ist es auch,
  der Befund ist schwächer als zuerst geschrieben.
- Eine **übertriebene Wirkung**: der animierte Chevron (B 8) bewegt nur `opacity` und ist
  damit kein Tempoproblem, sondern eine Regelfrage.
- Zwei **Einordnungen von „neu" zu „bekannt"**: das Zahlenfeld-Muster (`DEVELOPMENT.md:928`)
  und das 44-px-Mindestmaß (`DEVELOPMENT.md:476`) sind beides Hausregeln, an denen einzelne
  Stellen noch nicht nachgezogen wurden.
- Drei **Ungenauigkeiten**: 44 statt 43 `animate-`-Stellen, `description` ist ebenfalls
  `@db.Text`, und `_prisma_migrations` fehlte in der Tabellenliste.

Was dabei nicht zu beanstanden war: keine echten Namen, Adressen, Telefonnummern,
E-Mails, Schlüssel oder Datenbankadressen im Bericht, und die Trennung aus `CLAUDE.md` §3
hält — dieser Bericht ist weder Regel noch Tagebuch, verweist für Regeln auf `docs/ai/`
statt sie zu wiederholen, und lässt `docs/ai/` wie `DEVELOPMENT.md` unverändert.

## Was dieser Bericht nicht ist

Keine Aufgabenliste und keine Freigabe. Neun der zehn lohnendsten Befunde sind kleine
Eingriffe, aber drei davon liegen im Geldweg (Verkaufsbetrag, Warenkorb, Checkout-Fehler)
und gehören damit unter `TESTING_GUIDELINES.md` §2 — „jeder Geldweg" braucht einen Test,
bevor daran geschraubt wird. Die Indexbefunde (C 1–3, 6) sind Schema-Änderungen und
brauchen nach `CLAUDE.md` §2 eine Freigabe sowie eine Migration, die im Deploy-Fenster
hält; ein Index lässt sich in Postgres mit `CREATE INDEX CONCURRENTLY` ohne Sperre
anlegen, was Prisma nicht von selbst tut.

Was als nächstes gebaut wird, entscheidet der Mensch.
