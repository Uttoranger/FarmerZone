# Entscheidungsregister

Hier stehen alle Entscheidungen des Menschen zu Redesign, Geld und Ablauf. **Widerspricht ein anderes Dokument diesem Register, gilt das Register.** Das betrifft `CLAUDE.md`, `docs/umsetzungsprompt.md`, `docs/ai/*` und `docs/nachtlauf/freigabe.md`.

Pflege:
- Jede neue Entscheidung bekommt einen eigenen Eintrag mit Datum.
- Ein Eintrag wird nie stillschweigend überschrieben. Wird eine Entscheidung geändert, bekommt der alte Eintrag den Vermerk „ersetzt durch …".
- Agenten tragen nur ein, was der Mensch entschieden hat, und nennen dabei die Quelle (Chat, PR, Freigabe).
- Offene Punkte stehen am Ende. Sie sind **nicht** entschieden, und niemand baut sie ohne Auftrag.

Präfixe:
- **E** – Entscheidungen aus der Mockup-Runde (Umsetzungsprompt Abschnitt 3)
- **G** – technische Grundsätze
- **F** – Freigaben nach der Umsetzung
- **K** – Konditionen
- **B** – Bezahlung und Gebühren
- **S** – Sicherheitsanforderung aus Umsetzungsprompt Abschnitt 8
- **Z** – Zahlungswege der Höfe
- **T** – Teilen
- **W** – WhatsApp-Versand
- **D** – Direktverkauf
- **R** – Rate-Limit
- **N** – Nutzerführung (Navigation und Bedienung)
- **I** – Illustrationen
- **O** – offen

---

## E – Entscheidungen aus der Mockup-Runde

Alle E-Einträge hat uttoranger am **02.10.2026** in `docs/nachtlauf/freigabe.md` freigegeben (im Chat erteilt).

### E1 · Hofseite nach Kategorien (02.10.2026)
- **Entscheidung:** Die Hofseite hat Abschnitte je Kategorie auf einer Seite (Eier & Brot, Gemüse, Honig, Futtermittel, Brennmaterial) statt eines Umschalters Hofladen | Futtermittel. Der Bereich bleibt Datenmodell; `?bereich=futter` springt zum Futter-Abschnitt.
- **Begründung:** Wunsch „Ordne die Hofseiten wieder nach Kategorie an"; eine Seite ist für Kundinnen leichter zu überblicken.
- **Dateien:** `src/app/(public)/[farmSlug]/`, `src/components/hofseite/`, `src/lib/taxonomie.ts` (umgesetzt in #174).

### E2 · Futtermittel als Kategorie-Chip in Entdecken (02.10.2026)
- **Entscheidung:** Futtermittel steht als Chip in derselben Reihe wie die anderen Kategorien. Er setzt `bereich=futter` und blendet die Gebinde-Facette „Kleinmengen | Ballen & mehr" ein, die Grenze bleibt 25 kg.
- **Begründung:** Die Entdecken-Mockups sind so abgenommen („alles an einem Platz").
- **Dateien:** `src/app/(public)/hoefe/`, `src/components/hoefe/` (umgesetzt in #173).

### E3 · Verkaufsgrößen als Produktfamilie (02.10.2026)
- **Entscheidung:** Jede Verkaufsgröße ist ein eigenes Produkt einer Familie (`Product.familieId`), vom Sackerl bis zum Rundballen.
- **Begründung:** Das hält die Invarianten ein: ein Produkt = ein Gebinde, `stock` zählt Gebinde, Kennzeichnung je Gebinde.
- **Dateien:** `prisma/schema.prisma` (Expand in #169); Formulare und Größenwahl folgen mit Nr. 20 (Gate 6).
- **Stand:** Nr. 20 (07.10.2026): Formulare „Neues Futtermittel" und „Neues Brennmaterial" legen je Größe ein Produkt mit gemeinsamer `familieId` an (`src/server/actions/produktfamilie.ts`); bearbeitet wird je Größe. Bericht 20.

### E4 · Servicegebühr 5 %, immer aufrunden (02.10.2026)
- **Entscheidung:** **5 %** und mindestens € 0,50, **immer aufgerundet** auf den nächsten Cent. Gerechnet wird nur in `berechneServicegebuehr`. Gespeicherte Beträge alter Bestellungen werden nie neu berechnet.
- **Begründung:** Preismodell aus der Excel („Es wird aufgerundet").
- **Dateien:** `src/lib/servicegebuehr.ts` (#167). Den Satz der aktiven Höfe regelt F5. Ausnahme für Barzahlung bis zum SEPA-Start: B1.

### E5 · Keine „Karte bei Abholung" für neue Bestellungen (02.10.2026)
- **Entscheidung:** Neue Bestellungen kennen nur online und bar bei Abholung. Der Wert `ONSITE_CARD` bleibt im Enum, bis keine offene Bestellung ihn mehr nutzt (Expand/Contract).
- **Begründung:** Das Preismodell kennt nur diese zwei Zahlarten.
- **Dateien:** `src/app/api/checkout/route.ts`, `src/schemas/checkout.ts`, `src/components/checkout/` (#176).

### E6 · Preismodell mit Tarifen (02.10.2026)
- **Entscheidung:** Tarife Hoftor (€ 0) und Hofladen (€ 19 / Monat). Die Servicegebühr zahlt die Kundin, die Monatsabrechnung läuft per SEPA.
- **Begründung:** Preismodell aus der Excel.
- **Dateien:** `src/lib/konditionen.ts` (#179); Schema-Felder `Farm.tarif` und `Monatsabrechnung` (#169); die Abrechnung folgt mit Gate 8.
- **Übergang:** siehe K1. Bis die Abrechnung gebaut ist, gilt die Freischaltung im Admin weiter.
- **Ergänzung (12.10.2026, Freigabe Lauf 10):** Ohne Wahl gilt Hoftor. Hofladen gibt es nur nach aktiver Wahl mit SEPA-Mandat; keine automatische Umstellung, keine Abbuchung ohne Wahl. Der Tarif-Hinweis ist eine Statuszeile ohne Preis; der Preis steht nur auf „Deine Konditionen", nach dem Nutzen und mit Bedingungen.

### E7 · Kunden-Anmeldung mit Code (02.10.2026)
- **Entscheidung:** Kundinnen melden sich mit einem Code aus der E-Mail an (Better Auth `emailOTP`). Das gilt für die freiwillige Kunden-Anmeldung und für „Bestellungen finden". Höfe bleiben bei E-Mail und Passwort.
- **Begründung:** Der Code funktioniert auch, wenn die Mail am Handy ankommt und am Laptop eingekauft wird.
- **Dateien:** `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/anmeldecode.ts`, `src/components/anmelden/` (#172).

### E8 · Vorläufig kein Kundenkonto (02.10.2026)
- **Entscheidung:** Kundinnen bestellen als Gast.
  - Beim Checkout entsteht **kein** automatisches Konto, und der Checkout enthält keinen Satz dazu.
  - Jede Bestellung ist über den signierten Link aus der Bestätigungsmail erreichbar.
  - Unter „Bestellungen" findet die Kundin ihre Bestellungen mit E-Mail und Code, nur für diese Sitzung.
  - Nicht gebaut werden „Meine Höfe", eine Konto-Seite, „Neuigkeiten deiner Höfe" und „Merken". Die bestehenden Seiten unter `/account` bleiben und werden nur ins neue Design gezogen.
  - Handy-Unterleiste: Entdecken · [Warenkorb] · Bestellungen.
- **Begründung:** Weniger Personendaten und weniger Pflichten. Das Bestellen bleibt ohne Hürde.
- **Dateien:** `src/lib/kunden-navigation.ts` (#168), `src/lib/bestellungen-finden.ts` und `/bestellungen` (#178), `src/app/api/checkout/route.ts`.
- **Stand:** Umgesetzt mit 17a (06.10.2026): `/api/checkout` legt kein Konto mehr an und verknüpft keine Bestellung mit einem Konto (`customerId` bleibt null); `/account` zeigt Abos nur zur bestätigten Adresse. Ruhende Altkonten bleiben unangetastet.

### E9 · Keine Prüfung der Futtermittel-Nummer (02.10.2026)
- **Entscheidung:** Die Plattform prüft die Nummer nicht.
  - Der Hof bestätigt die Richtigkeit selbst (`bestaetigtAm`).
  - Das Schild beim Kunden erscheint sofort: „Futtermittelbetrieb · LFBIS <Nummer>". In der Kennzeichnung steht dazu „laut Angabe des Hofs".
  - Im Admin wird die Nummer nur angezeigt, einen Haken „geprüft" gibt es nicht.
- **Begründung:** So steht es im Konzept Bereiche (`docs/konzepte/bereiche.md`). Die Plattform kann die Nummer nicht verlässlich prüfen.
- **Dateien:** `src/lib/taxonomie.ts`, `src/lib/produktdetail.ts`, Admin-Freischaltung; das Feld `Farm.betriebsnummerGeprueftAm` entfällt. Die Umsetzung folgt mit Nr. 20 (Gate 6).
- **Stand:** Nr. 20 (07.10.2026): Schild und Zusatz „laut Angabe des Hofs" waren seit Nr. 11 da; das Futter-Formular zeigt das Schild in der Vorschau, prüft nichts und bestätigt die Nummer nur über das Hofprofil. Admin unberührt (22f).
- **Stand:** Nr. 22f (07.10.2026): Der Admin zeigt die Betriebsnummer in Freischaltung und Hofliste nur an, wie der Hof sie angibt — kein Haken, kein „geprüft" (Bericht 22f).

### E10 · Registrierungs-Fälle LFBIS / BAES (02.10.2026)
- **Entscheidung:** Eigene Ernte, lose oder in Ballen, braucht nur LFBIS. Abgepacktes Heimtierfutter mit Etikett, Zukauf und Mischen brauchen eine aktive BAES-Meldung.
- **Begründung:** Fachliche Klärung des Menschen. Die Texte lässt er vor dem Livegang gegenlesen (Umsetzungsprompt Abschnitt 10). — **Das Gegenlesen vor dem Livegang ist ersetzt durch E10a (07.10.2026).** Die Fälle selbst gelten weiter.
- **Dateien:** `Product.verpackung` (#169); Sperre je Gebinde mit Nr. 20 (Gate 6).
- **Stand:** Nr. 20 (07.10.2026): Sperre je Gebinde in `src/lib/futter-registrierung.ts`, serverseitig an allen Wegen in den Shop und vor dem Checkout (S7). Lesart: Mischfutter und Ergänzungsfutter brauchen als Mischung oder Zukauf immer die BAES-Meldung; Bestandsprodukte ohne Verpackung sperrt die Regel nicht. Texte vor dem Livegang gegenlesen lassen (Bericht 20).

### E10a · Futter geht ohne vorheriges Gegenlesen live (07.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 6):** Futter geht live, ohne dass die Erklärtexte vorher gegengelesen sind. Ausgleich:
  - Pflicht-Bestätigung des Hofs im Futter-Formular (Web und Handy), serverseitig erzwungen, Zeitpunkt in `FutterKennzeichnung.bestaetigtAm`; jede inhaltliche Änderung verlangt eine neue Bestätigung. Wortlaut: „Ich bestätige, dass meine Angaben zu Registrierung, Kennzeichnung und Verpackung richtig und vollständig sind. Für die Richtigkeit bin ich verantwortlich. Falsche Angaben können nach dem Futtermittelgesetz bestraft werden."
  - Erklärtexte als Orientierung gekennzeichnet: „Zur Orientierung, keine Rechtsberatung. Im Zweifel bei der Bezirkshauptmannschaft, beim BAES oder bei der Landwirtschaftskammer nachfragen." mit Link zur BAES-Seite für Futtermittelbetriebe.
  - Verantwortungs-Hinweis für Kunden bei jedem Futter: „Die Angaben zu Registrierung und Kennzeichnung stammen vom Hof. Der Hof ist für ihre Richtigkeit verantwortlich; FarmerZone vermittelt nur und prüft die Angaben nicht." Bei „nur an Betriebe" zusätzlich: „Als Betrieb bist du für den bestimmungsgemäßen Einsatz verantwortlich."
  - Der Mensch legt die Texte parallel der Landwirtschaftskammer vor.
- **Begründung:** Das Gegenlesen hätte den Livegang von Futter auf unbestimmte Zeit blockiert; die Verantwortung liegt ohnehin beim Hof (E9).
- **Verhältnis zu anderen Einträgen:** ersetzt in E10 nur den Satz zum Gegenlesen; E9 (keine Prüfung durch die Plattform) bleibt.
- **Dateien:** Futter-Formular, `src/lib/futter-registrierung.ts`, Produktdetail, Warenkorb; Umsetzung Nr. 23 (freigabe.md §10).
- **Futter-Entscheidungen aus Bericht 20 (07.10.2026, uttoranger):** (a) Misch- und Ergänzungsfutter brauchen immer BAES; (b) Futtermittel entstehen nur über das Futter-Formular; (c) Altbestand ohne Verpackung wird nie gesperrt; (d) die Verpackung je Größe ist Selbstauskunft des Hofs.

### E11 · Brennmaterial mit Raummeter und Schüttraummeter (02.10.2026)
- **Entscheidung:** Kategorie „Brennmaterial" mit den Arten Brennholz, Anzündholz und Hackschnitzel. Einheiten sind Raummeter und Schüttraummeter; M3 bleibt für Altdaten. Nur Abholung.
- **Begründung:** Holz war als Kategorie gewünscht und wurde um Hackschnitzel erweitert. M3 ist für Holz mehrdeutig.
- **Dateien:** `prisma/schema.prisma` (`ProductUnit`, `ProductSubcategory`, `BrennmaterialAngaben`, #169); Formular mit Nr. 20 (Gate 6).
- **Label (07.10.2026, uttoranger):** Die Kategorie heißt in der Oberfläche „Brennmaterial" statt „Brennholz" (Nr. 23).
- **Stand:** Nr. 20 (07.10.2026): Raummeter und Schüttraummeter wählbar (nur Brennmaterial), die drei Arten gehören zu Brennholz; Formular mit Holz-Angaben und Größen, Erklärbox rm/srm/fm auch auf der Produktseite. Bericht 20.

### E12 · Beiträge als Reiter in Mein Hof (02.10.2026)
- **Entscheidung:** Mein Hof hat die Reiter Hofseite | Beiträge. `/status` bleibt als Route und wird von dort verlinkt.
- **Begründung:** Mein-Hof-Umbau „mach es so".
- **Dateien:** `src/app/(hof)/farm-page/`, `src/components/mein-hof/` (#180).
- **Stand:** Nr. 22e (07.10.2026): Der Reiter „Beiträge" bietet alle Handlungen von `/status` (Deaktivieren, Löschen, Als Vorlage, WhatsApp fortsetzen); `/status` bleibt als Route und leitet auf den Reiter um (freigabe.md §9 „22e"; Lesart „bleibt und leitet um" am 07.10.2026 von uttoranger bestätigt), `/status/new` und WhatsApp fortsetzen liegen in der HofShell (Bericht 22e).
- **Vermerk (10.10.2026):** ergänzt durch N3 (Mein Hof in der Handy-Leiste mit den Reitern Produkte · Hofseite · Beiträge unter md).

### E13 · „Verkauf eintragen" bleibt im Neu-Menü (02.10.2026)
- **Entscheidung:** Die bestehende Funktion bleibt erhalten und steht im Neu-Menü. Das Formular wird nur ins neue Design gezogen.
- **Begründung:** Die Funktion wird genutzt und fehlte nur in den Mockups.
- **Dateien:** `src/lib/bauern-navigation.ts` (`HOF_NEU`), `src/components/produkte/was-legst-du-an.tsx`.
- **Stand:** Nr. 18 (06.10.2026): „Verkauf eintragen" steht im Neu-Menü der HofShell und im Dialog „Was legst du an?" und öffnet das vorhandene Formular auf `/sales`. Ins neue Design zieht das Formular mit der Route `/sales`, die nicht zu Nr. 18 gehört (Bericht 18, „Bitte entscheiden"). Nr. 22b (06.10.2026): Mit `/sales` in der HofShell ist auch das Formular im neuen Design (ab 768 px Dialog, darunter Blatt); das Neu-Menü führt weiter direkt hinein.

### E14 · „Artikel fehlt" (02.10.2026)
- **Entscheidung:** Der Vorschlag aus `docs/nachtlauf/freigabe.md` Abschnitt 1a gilt. Grundsatz: Die Servicegebühr gilt nur für das, was tatsächlich übergeben wird.
  - Sie wird auf den verbleibenden Warenwert neu berechnet, mit derselben Regel wie beim Bestellen (E4).
  - **Bar:** Der neue Barbetrag ist der verbleibende Warenwert plus die neu berechnete Gebühr.
  - **Online:** Die Kundin bekommt den Artikelpreis plus die Differenz der Gebühr zurück. Vom Hof wird über eine Rückbuchung mit festem Betrag **genau der Artikelpreis** zurückgeholt. Die Gebührendifferenz kommt aus der einbehaltenen Plattformgebühr.
  - Die Erstattung läuft mit Idempotenz-Schlüssel `teilstorno-<orderId>-<itemId>`.
  - Fehlt alles, ist es ein normaler Storno.
- **Begründung:** Der Hof verliert nie mehr als den Preis des fehlenden Artikels. Gebühr für nicht gelieferte Ware hätte nie anfallen sollen.
- **Dateien:** Teilstorno-Felder (`OrderItem.fehltSeit`, `Order.erstattetCents`, #169); `src/lib/artikel-fehlt.ts`, `src/server/artikel-fehlt.ts`, `src/server/teilerstattung.ts`, `/orders` (Nr. 19).
- **Stand:** Umgesetzt mit Nr. 19 (06.10.2026): Rechnung, Erstattung mit festem Betrag und Rückbuchung genau des Artikelpreises, Mail an die Kundin, Storno nach Teilerstattung mit festen Beträgen. Annahmen und Grenzen im Bericht 19. Nr. 19c (06.10.2026): Rest-Storno mit dem bezahlten Betrag aus Stripe (bei Abweichung nichts gebucht), Handbuchung je Weg, Betreiber-Mail statt Dashboard-Hinweis an den Hof, Webhook nimmt später gescheiterte Erstattungen zurück (Bericht 19c).

---

## G – Technische Grundsätze

### G1 · Geldfelder in Int-Cent (05.10.2026)
- **Entscheidung:** Variante A. Beträge, die Stripe betreffen (`Order.erstattetCents`, Beträge der `Monatsabrechnung`), werden wie `serviceFeeCents` als ganze Cent (`Int`) gespeichert.
- **Begründung:** Stripe rechnet in Cent, also entfällt jede Umrechnung. Eine spätere Umstellung auf `Decimal` wäre destruktiv.
- **Dateien:** `prisma/schema.prisma` (#169), Ausnahme in `docs/ai/ARCHITECTURE.md`, `docs/nachtlauf/freigabe.md` §6.

### G2 · Migrationen mit `prisma migrate diff` (05.10.2026)
- **Entscheidung:** Migrationen entstehen ohne Datenbank mit `pnpm exec prisma migrate diff --from-schema <main> --to-schema prisma/schema.prisma --script` (Regel 3 in `docs/nachtlauf.md`).
  - `migrate dev` (auch `--create-only`) und `pnpm db:migrate` sind nicht der Weg.
  - In die Produktion kommen Migrationen nur über `vercel-build` beim Merge auf `main`.
- **Begründung:** `migrate dev` scheitert an der Supabase-Schattendatenbank (P3006), und zwar für jede Migration.
- **Dateien:** `docs/nachtlauf.md` (Regel 3), `CLAUDE.md` (Befehle, Datenbank-Regeln), `docs/nachtlauf-start.txt`.

---

### G3 · Sammel-PR am Ende eines Laufs (Lehre aus Lauf 6, 07.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 7):** Am Ende jedes Nachtlaufs baut der Dirigent einen Sammel-PR: Branch `integration/lauf<n>` von `main`, alle fertigen PRs des Laufs per `git merge --no-ff` in Merge-Reihenfolge, Doku-Konflikte beide Seiten behalten, Code-Konflikte sauber zusammenführen und jede Auflösung im PR-Text begründen. Typecheck, Unit- und Integrationstests auf dem Gesamtstand grün. PRs mit offener Vorbedingung (Entwurf) kommen nicht hinein.
- **Begründung:** In Lauf 6 entstanden Code-Konflikte zwischen unabhängigen PRs, die erst beim Mergen sichtbar wurden; der Sammel-PR (#211) hat sie mit grünen Tests aufgelöst.
- **Dateien:** `docs/nachtlauf.md` Abschnitt 4.

### G4 · Bausteinverzeichnis und Regelvorschläge (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 10):** `docs/ai/BAUSTEINE.md` wird aus dem Code erzeugt (`pnpm bausteine`), nie von Hand geschrieben; ein Test hält es aktuell; vor jeder neuen Datei, Komponente oder Funktion wird es gelesen. Fehler, die wiederkommen können, werden bevorzugt durch eine Prüfung verhindert (Test, Lint, Hook), sonst durch eine Textregel am richtigen Ort. Agenten schlagen Regeln vor, der Mensch gibt frei; neue Regeln tragen Herkunft und Datum. Jeder fünfte Lauf (10, 15, …) beginnt mit einer Regel-Inventur: überholte, doppelte oder durch Tests abgedeckte Regeln werden zum Streichen vorgeschlagen, nicht selbst gestrichen.
- **Umsetzung:** Nr. 58 (freigabe.md §14).

## F – Freigaben nach der Umsetzung

### F1 · Mockup-Abweichungen Nr. 03, 05 und 07–17 (06.10.2026)
- **Entscheidung:** Die Mockup-Abweichungen, die die Berichte aufzählen, sind mit dem Merge der PRs freigegeben:
  - Nr. 03: #166
  - Nr. 05: #168
  - Nr. 07–14: #171–#178
  - Nr. 15–17: #179–#181
- **Begründung:** Der Mensch hat die PRs mit diesen Listen gemergt.
- **Dateien:** `docs/nachtlauf/berichte/03.md`, `05.md` und `07.md` bis `17.md`, Abschnitt „Mockup-Abweichungen".

### F2 · Öffentlicher Reiter „Beiträge" auf der Hofseite (06.10.2026)
- **Entscheidung:** Die Hofseite zeigt Kundinnen einen Reiter „Beiträge".
- **Begründung:** Er gehört zum Gate-4-Auftrag; offen war nur die Bestätigung (Morgenbericht 2026-10-05).
- **Dateien:** `src/app/(public)/[farmSlug]/`, `src/components/hofseite/` (#174).

### F3 · Produktseite ersetzt das alte Produkt-Blatt (06.10.2026)
- **Entscheidung:** Produktkarten verlinken die eigene Produktseite `/[farmSlug]/produkt/[id]`. Das alte Blatt mit Produktdetails entfällt.
- **Begründung:** Eine Quelle für Produktdetails; die Seite ist teilbar und funktioniert am Handy als Fokus-Seite.
- **Dateien:** `src/app/(public)/[farmSlug]/produkt/[id]/`, `src/lib/produktdetail.ts` (#175).

### F4 · Heute: Stripe-Hinweis nach Bestandsregel, drei Kennzahlen (06.10.2026)
- **Entscheidung:**
  - „Online-Zahlung ist pausiert" erscheint nach der Bestandsregel `onlineZahlungPausiert`: Online-Zahlung ist an, ein Stripe-Konto existiert, ist aber nicht fertig. Höfe ohne Konto sehen den Schritt „Online-Zahlung einrichten".
  - Heute zeigt drei Kennzahlen, ohne „Neue Kunden".
- **Begründung:** Die wörtliche Gate-Bedingung hätte jedem neuen Hof ab dem ersten Tag „pausiert" gezeigt. Für „Neue Kunden" gibt es keine Regel, was „neu heute" heißt.
- **Dateien:** `src/lib/stripe-konto.ts`, `src/server/queries/heute.ts`, `src/app/(hof)/dashboard/` (#181).
- **Vermerk (10.10.2026, Freigabe Lauf 9):** „Online-Zahlung einrichten" nur noch im Kasten (Nr. 53); Kennzahlen 2 + 1 bis 1024 px.

### F5 · Servicegebühr 5 % für die aktiven Höfe gesetzt (06.10.2026)
- **Entscheidung:** Der Mensch hat den Satz der aktiven Höfe im Admin auf 5 % gestellt (E4). Er gilt nur für neue Bestellungen.
- **Begründung:** Der Spalten-Default `@default(4.9)` blieb in #167 stehen, weil dafür keine Migration freigegeben war. Bestehende Höfe behielten ihren gespeicherten Satz.
- **Dateien:** keine Code-Änderung, nur Daten (Admin, Servicegebühr je Hof).

### F6 · Entscheidungen zum Morgenbericht Lauf 5 (07.10.2026)
- **Quelle:** uttoranger, Freigabe Lauf 6 (freigabe.md §10), zu Morgenbericht Lauf 5 §4.

| Punkt | Entscheidung | Umsetzung |
|---|---|---|
| 19c Vollerstattung | bekommt dieselben Merkmale (`metadata`) wie die Teilerstattung | Nr. 27 |
| 21 (b) Bestellung „über einen Link" | entfällt (T1) | Nr. 25 |
| 22c Servicegebühren dieses Monats | Zählregel wie `/admin/finanzen` (`topfVonBestellung`) | Nr. 26 |
| 22b Direktverkauf senkt Vorrat | Backlog | – |
| 19b Registrierung | immer dieselbe Antwort, dazu eine Mail an das bestehende Konto | Nr. 27 |
| Futter (a)–(d) | siehe E10a | Nr. 23 |
| E11 Label | „Brennmaterial" statt „Brennholz" | Nr. 23 |
| Teilen (a) | die Hofseite teilt das Teilen-Bild | bleibt (#199) |
| Teilen (c) | Teilen über das Handy-Menü zählt als „link" | bleibt (#199) |
| Teilen (d) | Teilen legt keinen Beitrag an | bleibt (#199) |
| Teilen (g) | `@types/qrcode` freigegeben | bleibt (#199) |
| 19a `/konditionen` | stündlich neu bauen | Nr. 28 |
| 22a Kunden | eine Sortierwahl für alle Breiten; Markenfarben wie vorgeschlagen | bleibt (#194) |
| 22b Verkäufe | „Dieses Jahr (für die Umsatzgrenze)" statt „Gesamt"; „Verkauf eintragen" auch am Handy oben | Nr. 28 |
| 22d Rechenbeispiel | mit den Sätzen des eigenen Hofs | bleibt (#196) |
| 22e Beiträge | `/status` bleibt und leitet um; Kurznummer in „Meine Meldungen"; „N per E-Mail" zurück in die Beitragszeile | Nr. 28 |
| 22c Futter kaufen | Käuferart „Betrieb" vorbelegen | Nr. 29 |
| 22c Teilen-Karte | Euro-Betrag weglassen (T1) | Nr. 26 |

### F7 · Mockup-Abweichungen aus Lauf 5 (07.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 6):** Alle Mockup-Abweichungen aus den Berichten zu #192–#201 sind freigegeben.
- **Dateien:** `docs/nachtlauf/berichte/19a.md` … `22f.md`.

### F8 · Hofseite: alle aktiven Beiträge (12.10.2026)
- **Kennung:** In der Freigabe Lauf 11 „F7"; F7 ist im Register vergeben (Mockup-Abweichungen aus Lauf 5), darum F8 (Zuordnung durch den Dirigenten nach dem Muster des Registers).
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Hofseite zeigt alle aktiven Beiträge, neuester zuerst mit „Aktuell", höchstens fünf; der Reiter heißt „Beiträge · n". Vorher: nur der neueste (ursprüngliches Konzept „ein Status je Hof").
- **Verhältnis zu anderen Einträgen:** ergänzt F2.
- **Umsetzung:** Nr. 68 (freigabe.md §15).

---

## K – Konditionen

### K1 · Konditionen-Übergang (06.10.2026)
- **Entscheidung:** Öffentlicher Text aus einer Quelle (`src/lib/konditionen.ts`): „In der Startphase kostenlos. Die Tarife gelten ab **1. Februar 2027**. Bereits freigeschaltete Höfe behalten ihre zugesagten Konditionen." Die Admin-Freischaltung (Gründungsplatz) bleibt, bis die Abrechnung gebaut ist (Gate 8).
- **Begründung:** Zwei Regeln widersprechen sich: Öffentlich standen die Tarife (E6), der Admin vergibt aber einen Gründungsplatz. Bereits zugesagte Konditionen (Pilothof) bleiben gültig.
- **Dateien:** `src/lib/konditionen.ts`, `/fuer-hoefe`, `/konditionen`, Registrieren-Link, `src/app/admin/admin-farm-list.tsx`, `src/lib/gruendungshof.ts`.
- **Datum:** **1. Februar 2027** (festgelegt am 06.10.2026, uttoranger im Chat). Damit ist 17d freigegeben (freigabe.md §8).
- **Stand:** umgesetzt in 17d.

### K2 · Gründungs-Enddatum je Hof (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 10):** Gründungshöfe gelten als Hofladen ohne Grundgebühr bis zu einem Enddatum; Standard 31.12.2027, je Hof im Admin änderbar, auch für die bestehenden Testhöfe. Danach gilt die normale Regel (E6-Ergänzung). Vor einer Änderung des Standards werden bestehende Zusagen je Hof festgeschrieben (eigene Migration mit Freigabe). Der Satz „danach dauerhaft 3 %" verschwindet aus jeder Anzeige.
- **Verhältnis zu anderen Einträgen:** entscheidet O7 (Variante b); ergänzt E6 und K1.
- **Migration (freigegeben, Wortlaut):** „Nr. 62 darf eine Expand-Migration anlegen: neue Spalte Farm.gruendungBis vom Typ DATE, nullable, ohne Default, ohne Backfill und ohne andere Schema-Änderung. Erzeugt mit prisma migrate diff; Produktion bekommt sie nur über vercel-build beim Merge."
- **Umsetzung:** Nr. 61 und 62 (freigabe.md §14).

---

## B – Bezahlung und Gebühren

### B1 · Keine Servicegebühr bei Barzahlung bis zum SEPA-Start (06.10.2026)
- **Entscheidung (uttoranger):**
  - Bis zum Start der SEPA-Monatsabrechnung fällt bei Barzahlung keine Servicegebühr an.
  - Online-Zahlungen behalten die Gebühr, weil Stripe sie direkt einbehält.
  - Stichtag ist die Konstante `BAR_SERVICEGEBUEHR_AB`. Sie steht standardmäßig auf `TARIFE_AB` (1. Februar 2027). Verschiebt sich die SEPA-Abrechnung, wird nur dieser Stichtag verschoben.
  - Bestehende Bestellungen behalten ihre gespeicherten Beträge.
- **Begründung:** Der Hof kassiert die Bargebühr, eingezogen wird sie mangels SEPA aber nicht. Eine Gebühr, die niemand einzieht, würde die Kundin bezahlen, ohne dass die Plattform sie bekommt.
- **Verhältnis zu anderen Einträgen:**
  - Ausnahme zu E4 für Barzahlung vor dem Stichtag.
  - E14 rechnet bei Barbestellungen vor dem Stichtag mit Gebühr 0.
  - Beantwortet die offene Frage aus 17d (#186): Gebühren aus Barbestellungen vor dem Stichtag werden nicht eingezogen.
- **Dateien:** `src/lib/servicegebuehr.ts` (`berechneServicegebuehr` bekommt die Zahlungsart), `src/lib/konditionen.ts` (Konstante neben `TARIFE_AB`), Checkout-Server, Kasse/Warenkorb, Artikel fehlt, Admin-Finanzen, Mail „Vor-Ort-Bestellung bestätigt", `/konditionen`, `/fuer-hoefe`, Startseiten-Beispiel. Umsetzung 19a (freigabe.md §9).
- **Stand:** umgesetzt in 19a (06.10.2026); maßgeblich ist der Bestellzeitpunkt, Annahmen im Bericht 19a.

Die folgenden Punkte hat der Mensch am 07.10.2026 unter dem Kürzel B nummeriert (Freigabe Lauf 6, „ältere offene Punkte").

### B2 · „Nicht im Shop" statt „Entwurf" (07.10.2026)
- **Entscheidung (uttoranger):** Produkte, die nicht im Shop stehen, heißen in der Oberfläche „Nicht im Shop" statt „Entwurf".
- **Dateien:** Produktliste, Marken, Formulare; Umsetzung Nr. 28.

### B3 · Name und Telefon aus fremden Alt-Registrierungen (07.10.2026)
- **Entscheidung (uttoranger):** Beim ersten Code-Login werden Name und Telefon geleert, die aus einer fremden Alt-Registrierung am Konto stehen (offener Punkt aus Bericht 17a, „Bitte entscheiden (c)").
- **Dateien:** Code-Anmeldung; Umsetzung Nr. 27.

### B4 · Ablehnungssperre für den Altbestand gestrichen (07.10.2026)
- **Entscheidung (uttoranger):** Die Ablehnungssperre für den Altbestand (Bericht 17a) entfällt.
- **Dateien:** Umsetzung Nr. 27.

---

## Z – Zahlungswege der Höfe

### Z1 · Stripe-Pflicht für Höfe (07.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 6):**
  - Jeder Hof muss Stripe einrichten, bevor er freigeschaltet wird bzw. online geht. Eine Wahl „nur bar" gibt es nicht mehr.
  - Bereits freigeschaltete Höfe ohne Stripe bleiben online und werden aufgefordert, die Online-Zahlung einzurichten. Keine Abschaltung.
  - Die technische Notbremse bleibt: Sperrt Stripe ein Konto nachträglich, verkauft der Hof vorübergehend nur bar („Online-Zahlung pausiert").
  - Die Lesart aus 22f (#201, „Sperre nur bei Online-Wunsch, Bar-Höfe freischaltbar") ist verworfen.
- **Begründung:** Kundinnen sollen bei jedem Hof mit Karte, Apple Pay oder EPS zahlen können.
- **Verhältnis zu anderen Einträgen:** ersetzt die Fachregel „Online-Zahlung ist ein Plus, kein Muss" (DEVELOPMENT.md, `src/lib/hof-einstellungen.ts`); Barzahlung durch Kundinnen bleibt möglich (B1 unverändert).
- **Dateien:** `src/lib/admin-hoefe.ts` (`freischaltSperre`), `src/server/actions/admin.ts`, Einstellungen „Zahlung", Einrichten, Heute, `/fuer-hoefe`, `/konditionen`, Registrieren (Texte aus `src/lib/konditionen.ts`); Umsetzung Nr. 24.

### Z2 · Stripe-Testbetrieb und Modus-Wache (08.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 8):**
  - Solange die Produktion mit Test-Schlüssel läuft, sagen Kasse, Admin und Zahlungs-Einstellungen das deutlich.
  - Vorschau und lokal laufen nie mit Live-Schlüssel (Client startet nicht).
  - Den Modus prüft man nur über das Umgebungsbanner bzw. `bestimmeUmgebung`, nie durch Entschlüsseln.
  - Die Live-Schaltung macht der Mensch als letzten Schritt nach `docs/betrieb/stripe-live.md`.
- **Begründung:** Befund vom 08.10.2026 (nur lesend): `STRIPE_*` ist bei Vercel EINE Variable für Vorschau und Produktion. Das Umgebungsbanner der Vorschau zeigt „Stripe Test", die Produktion lädt `pk_test_` — beide laufen im Testmodus. Die Annahme aus Lauf 7 (Nr. 34, „sehr wahrscheinlich Live") war falsch.
- **Verhältnis zu anderen Einträgen:** ergänzt Z1; kein Lauf schaltet auf Live um.
- **Dateien:** Stripe-Server-Client, Kasse, AdminShell, Einstellungen „Zahlung", `docs/betrieb/stripe-live.md`; Umsetzung Nr. 42 (freigabe.md §12).

### Z3 · Testumgebung statt Umschalter (08.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 8):**
  - In der Produktion gibt es keinen Umschalter zwischen Test und Live.
  - Echte Abläufe testet man in der Testumgebung `test.farmerzone.at` (Branch `staging`, Entwicklungsdatenbank, Stripe-Test).
  - Testmodus je Hof bleibt eine Option für später.
- **Begründung:** Testzahlungen gehören nicht neben echte Bestellungen; eine eigene Umgebung trennt Daten und Schlüssel.
- **Verhältnis zu anderen Einträgen:** ergänzt Z2. „Testmodus je Hof" ist nicht beauftragt.
- **Dateien:** `src/lib/umgebung.ts`, AdminShell, Umgebungsbanner, E-Mail-Versand außerhalb der Produktion, `.github/workflows/staging-nachziehen.yml`, `docs/betrieb/testumgebung.md`; Umsetzung Nr. 43 (freigabe.md §12).

### Z4 · Testzahlungen aus Auswertungen (10.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 9):**
  - Online-Bestellungen, die vor dem Zeitpunkt in der Server-Variable `STRIPE_LIVE_AB` angelegt wurden, zählen nicht als Umsatz und nicht als Servicegebühr. Barbestellungen zählen immer.
  - Ohne Variable bleibt alles wie heute.
  - Abweichend von `docs/betrieb/stripe-live.md` §10 (Konstante) eine Variable: Zur Live-Schaltung ist dann keine Code-Änderung nötig. Den Wert setzt der Mensch.
- **Begründung:** Befund vom 10.10.2026: Online-Bestellungen aus der Testzeit zählen als Umsatz bzw. Gebühr; dieselbe Zuordnung steht an mehreren Stellen (Auswertung und Verkäufe samt Jahressumme für die Umsatzgrenze, Admin-Finanzen, Admin-Hofliste, Heute, Kunden-Umsätze).
- **Verhältnis zu anderen Einträgen:** ergänzt Z2 (Live-Schaltung durch den Menschen); Bestellungen, Beträge, Checkout, Webhook, Erstattung und Storno bleiben unverändert.
- **Dateien:** eine Regel in `src/lib/` (Prüfung, Prisma-Where, Prisma.sql-Baustein), Auswertung, Verkäufe, Admin-Finanzen, Admin-Hofliste, Heute, Kunden; `docs/betrieb/stripe-live.md`; Umsetzung Nr. 55 (freigabe.md §13).
- **Ergänzung (12.10.2026, Freigabe Lauf 10):** Bestellzahlen zeigen Testbestellungen nirgends mit – Auswertung, Admin-Hofliste und Kundenansicht zählen gleich. Umsetzung Nr. 65 (freigabe.md §14).

---

## T – Teilen

### T1 · Teilen ohne Browser-Speicher (07.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 6):**
  - Für den Teilen-Kanal wird nichts im Browser gespeichert: kein sessionStorage, kein localStorage, kein Cookie.
  - Gezählt werden nur Besuche über `?k=`, serverseitig.
  - Bestellungen werden keinem Kanal zugeordnet; `Order.teilenKanal` bleibt ungenutzt (Spalte bleibt, Expand/Contract).
  - Farbwerte im Teilen-Bild sind eine Ausnahme vom Token-Gebot (Satori kennt keine CSS-Variablen), zentral in `TEILEN_BILD_FARBE`.
- **Begründung:** Speicherzugriff auf dem Endgerät (§ 165 Abs. 3 TKG) ohne Einwilligung vermeiden; die Bestellzuordnung ist den Speicher nicht wert.
- **Verhältnis zu anderen Einträgen:** erledigt Bericht 21 (b) und (e) sowie den Euro-Betrag der Teilen-Karte (22c).
- **Dateien:** `src/lib/teilen-herkunft.ts` und Aufrufer, Checkout, Teilen-Fenster-Texte, `src/components/teilen/teilen-bild-grafik.tsx`; Umsetzung Nr. 25 und 26.

### T5 · Beitrag teilen = ein Fenster (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Das Teilen-Fenster von „Heute" bekommt einen Beitrag-Modus (Bild aus dem Beitrag, Text und Link vorbelegt). Es öffnet sich nach dem Veröffentlichen und über „Teilen" je aktivem Beitrag. Die WhatsApp-Abonnentinnen sind darin die erste Karte und führen zur Tipp-Liste (W1); E-Mail an Abonnentinnen bleibt ein Häkchen beim Veröffentlichen; die Häkchen „Per WhatsApp" und „Als WhatsApp-Status-Bild" entfallen. Teilen (d) bleibt: Teilen legt keinen Beitrag an.
- **Verhältnis zu anderen Einträgen:** Teilen (d) aus F6 bleibt; ergänzt W1.
- **Umsetzung:** Nr. 67 (freigabe.md §15).

### T6 · Teilen-Bild (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Variante A „Marktkarte" (Creme, grüne Kante, Serif-Titel, Produktzeilen mit Foto oder Kategorie-Illustration, Abhol-Streifen, Link-Pille) ist das Bild; liegt ein Foto vor (Beitragsfoto, sonst erstes Produktfoto), gilt Variante B „Foto-Held". Der QR-Code steht nur im Format Status 9:16 (Storys haben keinen klickbaren Link); im 1:1 steht kein QR. Bildquelle je Produktzeile: eigenes Foto → Illustration der Kategorie → „Sonstiges". Schriften im Bild: Fraunces und Instrument Sans wie in der App.
- **Verhältnis zu anderen Einträgen:** ergänzt T1 – Farbwerte im Teilen-Bild bleiben die Ausnahme vom Token-Gebot in `TEILEN_BILD_FARBE`.
- **Umsetzung:** Nr. 69 (freigabe.md §15).

---

## W – WhatsApp-Versand

### W1 · WhatsApp an Abonnenten, ehrlich und je Person (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Die App kann nicht wissen, ob in WhatsApp gesendet wurde (kein Rückkanal von wa.me; die Business-API kommt für den Pilot nicht in Frage). Deshalb heißt der Zustand „geöffnet", nie „gesendet"; markiert wird beim Zurückkommen in den Browser, nicht per Zeitschaltung; jede Person lässt sich zurücksetzen; gespeichert wird, WER angetippt wurde (Abonnements-IDs), die Zahl folgt daraus; Empfängerinnen werden nicht beim Veröffentlichen eingefroren, sondern beim Öffnen der Liste gelesen.
- **Verhältnis zu anderen Einträgen:** ergänzt E12 (WhatsApp fortsetzen im Reiter Beiträge) und T5.
- **Migration (freigegeben, Wortlaut):** „Nr. 66 darf eine Expand-Migration anlegen: neue Spalte StatusPost.whatsappGetippt vom Typ TEXT[] (Abonnements-IDs, keine E-Mails, keine Nummern), nullable, mit leerem Default wie linkedProductIds, ohne Backfill und ohne andere Schema-Änderung. Erzeugt mit prisma migrate diff; Produktion bekommt sie nur über vercel-build beim Merge." Die bestehenden Spalten whatsappSentCount und whatsappRecipientCount bleiben (Contract später, eigene Freigabe).
- **Umsetzung:** Nr. 66 (freigabe.md §15).

---

## S – Freigegebene Sicherheitsanforderungen

### S3 · E-Mail-Bestätigung für neue Höfe (06.10.2026)
- **Entscheidung:** Neue Höfe bestätigen ihre E-Mail.
  - Der Versand läuft über Better Auth `emailVerification` und den bestehenden Mailweg.
  - Anmelden bleibt möglich. Bis zur Bestätigung gesperrt sind Foto-Uploads und „Hof online stellen". Einrichten (Texte, Abholzeiten) ist erlaubt.
  - Die Pflicht gilt nur für Konten nach einem Stichtag. Bestehende Höfe bleiben unberührt, und in Produktion werden keine Daten geändert.
- **Begründung:** Bisher gab es keinen Weg, die Adresse zu bestätigen (`/verify` leer). Eine Sperre ohne diesen Weg hätte jeden neuen Hof bis zur Freischaltung blockiert.
- **Dateien:** `src/lib/auth.ts`, `/verify`, Upload-Route, Admin-Liste; Umsetzung 17b (freigabe.md §8).
- **Stand:** umgesetzt in 17b.
- **Stichtag (06.10.2026, uttoranger im Chat):** Konten ab dem Merge von #184, also ab **06.10.2026, 20:21 Uhr** Wiener Zeit, müssen bestätigen. Bewusst nicht Mitternacht: Ein am 06.10. um 18:07 Uhr angelegter und freigeschalteter Hof bleibt ausgenommen. Konstante `EMAIL_BESTAETIGUNG_STICHTAG` in `src/lib/email-bestaetigung.ts`.

### S11 · Double-Opt-in für werbliche Mails (07.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 7):** Double-Opt-in für alle werblichen Mails (Beiträge per Mail, Benachrichtigungen).
  - Neue Anmeldungen gelten erst nach Klick auf einen Bestätigungslink (signiert, mit Ablauf).
  - Unbestätigte Anmeldungen bekommen keine werblichen Mails.
  - Jede werbliche Mail trägt einen Abmeldelink.
  - Bestehende Abonnenten bleiben vorerst unverändert; ihre Zahl steht im Morgenbericht, den Umgang mit ihnen entscheidet der Mensch.
- **Begründung:** Bisher nur einfaches Opt-in (O3).
- **Dateien:** Abo-Anmeldung, Mailversand der Beiträge und Benachrichtigungen; Umsetzung Nr. 38 (freigabe.md §11), Migration nur Expand, falls nötig.

### S16 · `trustedOrigins` ohne Muster (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 10):** Ein Wert von `NEXT_PUBLIC_APP_URL` mit „*" oder „?" gilt als ungültig (bleibt roh, Warnung); ein https-Wert mit fremdem Host (nicht farmerzone.at/www) wird angenommen, löst aber in der Produktion eine Sentry-Warnung ohne den Wert aus.
- **Umsetzung:** Nr. 64 (freigabe.md §14).
- **Ergänzung (12.10.2026, Freigabe Lauf 11):** Ein Wert mit Port (z. B. `https://farmerzone.at:8443`) gilt als fremder Host und löst dieselbe Warnung aus; sonst ändert sich nichts. Umsetzung Nr. 70 (freigabe.md §15).

---

## D – Direktverkauf

### D1 · Direktverkauf senkt den Vorrat (07.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 7):** „Verkauf eintragen" mit einem Produkt aus dem Sortiment zieht den Vorrat ab.
  - Bedingtes `updateMany`, nie unter 0.
  - Reicht der Vorrat nicht: Hinweis, der Verkauf wird trotzdem gebucht, der Vorrat geht nicht ins Minus.
  - Schalter „Vorrat abziehen" im Formular, Standard ein.
- **Begründung:** Offener Punkt aus Bericht 22b (Backlog Lauf 6).
- **Dateien:** Verkäufe (`/sales`, „Verkauf eintragen"); Umsetzung Nr. 39.

---

## R – Rate-Limit

### R1 · Rate-Limit über die Datenbank (07.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 7):** Für Anmeldecode, Registrierung, Problem melden, Bestellungen finden und Checkout zählt eine Tabelle in der Datenbank (Schlüssel, Fenster, Zähler) die Versuche über alle Instanzen. Die bestehende Bremse je Instanz bleibt als erste Stufe. Alte Einträge räumt der bestehende Cron auf. Migration nur Expand.
- **Begründung:** Die Bremse je Instanz greift auf Vercel nur teilweise (Backlog Lauf 6); ein eigener Dienst ist nicht nötig.
- **Dateien:** `src/lib/rate-limit.ts`, Cron; Umsetzung Nr. 40.

---

## N – Nutzerführung

### N1 · Handy-Navigation (08.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 8):**
  - Jeder Bildschirm hat genau eine Hauptaktion.
  - Öffentliche Seiten zeigen oben immer „Anmelden" (→ `/login`), auch am Handy; mit Hof-Sitzung steht dort „Mein Hof" (→ `/dashboard`).
  - Unterseiten im Hofbereich haben am Handy einen festen Kopf mit Rückweg zur Elternseite (eine Quelle).
  - Einstellungs-Unterseiten führen nach dem Speichern zur Übersicht zurück.
- **Begründung:** Befund vom 08.10.2026 (Handy, 390 px): Bestehende Höfe finden die Anmeldung nur ganz unten im Fuß der Startseite („Anmelden für Höfe"); im Kopf der KundeShell ist „Anmelden" unter 768 px ausgeblendet; ein angemeldeter Hof sieht auf öffentlichen Seiten keinen Weg in seinen Bereich. Im Hofbereich ist der Rückweg auf Unterseiten klein und nach dem Scrollen weg.
- **Dateien:** KundeShell und KundenKopf, AdminShell, `src/lib/kunden-navigation.ts`, `src/lib/kunden-menue.ts`, `src/lib/admin-navigation.ts`, `src/lib/bauern-navigation.ts`, Hofbereich-Unterseiten; Umsetzung Nr. 41 und 44 (freigabe.md §12).

### N2 · Kasse ohne Zusatz-Haken (08.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 8):**
  - Der Pflicht-Haken „Ich hole ab und zahle bar" entfällt; der Kaufknopf „Zahlungspflichtig bestellen" bleibt (FAGG § 9 Abs. 3).
  - Die Neuigkeiten-Anmeldung zieht auf die Bestätigungsseite; Double-Opt-in (S11) bleibt.
  - Die Bar-Bestätigung per Mail (H3) bleibt unverändert.
- **Begründung:** Weniger Schritte in der Kasse; der verbindliche Abschluss liegt im Kaufknopf.
- **Verhältnis zu anderen Einträgen:** ändert die Kasse aus Gate 4 (Nr. 12: Zusage-Haken bei Bar); S11 und H3 bleiben unverändert.
- **Dateien:** Kasse (Formular, Schema, `/api/checkout`), Bestätigungsseite; Umsetzung Nr. 46 (freigabe.md §12).

### N3 · Mein Hof in der Handy-Leiste (10.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 9):**
  - Unter md heißt die Leiste Heute · Bestellungen · Neu · Mein Hof · Mehr. Mein Hof hat dort die Reiter Produkte · Hofseite · Beiträge.
  - Ein Tipp auf „Mein Hof" öffnet Produkte, damit der Vorrat ein Tipp bleibt.
  - Die Route `/products` bleibt. Der Leistenpunkt „Mein Hof" ist aktiv auf `/products*`, `/farm-page*` und `/status*`.
  - Ab md bleiben Seitenleiste und Reiter wie heute (Hofseite | Beiträge).
- **Begründung:** Befund vom 10.10.2026 (Handy): Mein Hof liegt nur im Mehr-Blatt; Produkte belegen einen eigenen Leistenpunkt.
- **Verhältnis zu anderen Einträgen:** ergänzt N1 und E12.
- **Dateien:** `src/lib/bauern-navigation.ts`, `src/components/ui/bottom-nav.tsx`, Mein Hof (`src/app/(hof)/farm-page/`, `src/components/mein-hof/`), `/products`; Umsetzung Nr. 49 (freigabe.md §13).

### N4 · Hofseite an EINEM Ort bearbeiten (10.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 9):**
  - Alles, was Kundinnen auf der Hofseite sehen, wird in Mein Hof bearbeitet. Mein Auftritt zieht dorthin; `/settings/appearance` leitet auf `/farm-page` um.
  - Unter lg steht der Umschalter „Bearbeiten · So sieht's die Kundin" ganz oben. „So sieht's die Kundin" ist die echte Hofseite in der App, kein neuer Tab.
  - „Bearbeiten" ist eine Liste der Abschnitte mit Blatt von unten. Die alte FarmPageView mit Stiften entfällt dort.
  - Nach dem Speichern auf den Reitern Hofseite und Beiträge erscheint „Gespeichert · Ansehen".
- **Begründung:** Befund vom 10.10.2026: Hofseite wird an zwei Orten bearbeitet (Mein Hof, Mein Auftritt); am Handy steht der Umschalter erst unter der Checkliste, „Bearbeiten" zeigt die alte Ansicht mit Stiften (O2).
- **Verhältnis zu anderen Einträgen:** entscheidet O2.
- **Dateien:** Mein Hof (`farm-page-client.tsx`, `hofseite-editor.tsx`, `seitenkopf.tsx`), Mein Auftritt (`settings/appearance/`, `server/actions/appearance.ts`), `src/lib/hof-einstellungen.ts`; Umsetzung Nr. 49 und 50 (freigabe.md §13).
- **Ergänzung (12.10.2026, Freigabe Lauf 10):** `saveAppearanceAction` schreibt nur die mitgeschickten Felder; `farmValues` nur, wenn sie mitkommen. Das Adress-Formular in Mein Hof schickt die Adresse als Ganzes (Land, Breite, Länge mit). Umsetzung Nr. 65 (freigabe.md §14).

### N5 · Hofseite unter lg, Reiter Übersicht (10.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 9):**
  - Unter dem Kopf zuerst das Schaufenster: ein Fotostreifen und bis zu vier Produkte, dazu „Alle Produkte (n)".
  - Danach unverändert: Nächste Abholung mit Abholzeiten, Zahlung & Kontakt, Über uns, Anfahrt; der Mini-Korb bleibt, wo er ist.
  - Ab lg unverändert.
- **Begründung:** Befund vom 10.10.2026: Fotos und Produkte stehen unter lg erst nach Abholung, Zahlung und Anfahrt.
- **Dateien:** Hofseite (`hofseite-kunde.tsx`, `HofseiteFotos`, `hofseite/produkt-karte.tsx`); Umsetzung Nr. 51 (freigabe.md §13).

### N6 · Titelbild im Hochformat (12.10.2026)
- **Kennung:** In der Freigabe Lauf 11 „B2"; B2 ist vergeben und B steht für Bezahlung; Hofseite wie N4/N5, darum N6 (Zuordnung durch den Dirigenten nach dem Muster des Registers).
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Ein Titelbild, das höher als breit ist, wird am Desktop nicht beschnitten, sondern ganz gezeigt (object-contain, mittig) vor einer unscharfen, abgedunkelten Kopie desselben Bilds, die die Fläche füllt; am Handy bleibt der Beschnitt mit Fokuspunkt. Beim Hochladen sagt die App, dass Querformat am Computer größer wirkt – kein Zwang.
- **Verhältnis zu anderen Einträgen:** ergänzt N5.
- **Umsetzung:** Nr. 72 (freigabe.md §15).

### N7 · Mein Hof am breiten Bildschirm (12.10.2026)
- **Kennung:** In der Freigabe Lauf 11 „D3"; D steht für Direktverkauf; Mein Hof wie N4, darum N7 (Zuordnung durch den Dirigenten nach dem Muster des Registers).
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Der Editor ist auf 2 000 px Breite begrenzt und zentriert; die Vorschau ist nie breiter als 1 440 px, die Liste 400–560 px (Web) bzw. höchstens 720 px (Handy).
- **Verhältnis zu anderen Einträgen:** ergänzt N4.
- **Umsetzung:** Nr. 73 (freigabe.md §15).

---

## I – Illustrationen

### I1 · Illustrationen (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Kategorie- und Unterkategorie-Illustrationen liegen als WebP in public/categories/ (Quelle: Bögen bei der Projektleitung, Schneideskript dort); Rückfall je Produkt: Foto → Unterkategorie → Kategorie → Sonstiges; Unterkategorien ohne eigenes Bild (Eier-Haltungsformen, Futter-Altlast) stehen in einer Ausnahmeliste; die Schwarzweiß-Fassung ist für Druck und dunkles Theme vorgesehen (Bau später).
- **Verhältnis zu anderen Einträgen:** Bau der Schwarzweiß-Fassung später, siehe Backlog.
- **Umsetzung:** Nr. 74 (freigabe.md §15).

---

## O – Offen (nicht entschieden, nicht bauen)

| # | Thema | Stand |
|---|---|---|
| O1 | Fehler-Token | **Entschieden 07.10.2026 (uttoranger):** Die Fehler-Farbe bekommt einen Kontrast von mindestens 4,5:1 in beiden Themes (Nr. 28). Bisher: Fehlertext 4,22:1 im hellen Theme, deshalb orange Hinweiskarte bzw. `text-status-offen`. |
| O2 | Bearbeiten am Handy (#180) | **Entschieden durch N4 (10.10.2026, Freigabe Lauf 9).** Bisher: Unter der Checkliste in Mein Hof steht weiter der Editor mit Stiften; das Mockup zeigt nur „Vorschau ansehen". Entfällt er, braucht es einen eigenen Auftrag. |
| O3 | S11 Double-Opt-in | **Entschieden, siehe S11** (Freigabe Lauf 7, Umsetzung Nr. 38). Offen bleibt die Frage, ob „Nochmal bestellen" in der Abholbereit-Mail Werbung ist. |
| O4 | AGB / Nutzungsbedingungen | Werden separat erstellt — **NICHT anfassen** (bestätigt 07.10.2026). Bis dahin gibt es beim Registrieren keinen Zustimmungs-Haken. |
| O5 | Rückruf anfordern | **Entfällt (07.10.2026, uttoranger).** Schema `RueckrufAnfrage` wird nicht gebaut. Ersatz bleibt „E-Mail schreiben". |
| O6 | Kachelquelle der Karten (10.10.2026) | OSM direkt, basemap.at oder ein Anbieter mit Schlüssel. Ein Wechsel ändert die Datenschutzerklärung. **Nicht bauen**; Nr. 52 legt nur einen Vorschlag in den Bericht. Stand 12.10.2026: weiter offen; der Vorschlag aus Bericht 52 steht. |
| O7 | Gründungszusage (10.10.2026) | **Entschieden durch K2 (12.10.2026, Freigabe Lauf 10).** Bisher: Der Freischalt-Dialog im Admin (`GRUENDUNGS_KONDITIONEN`, `src/lib/gruendungshof.ts`) verspricht „keine Plattformgebühr bis 31.12.2029, danach dauerhaft 3 %". Das passt nicht zu E6 und K1. Der Mensch entscheidet; der Text bleibt. |
| O8 | Produkte über der Grenze ab 1.2.2027 (12.10.2026) | **Entschieden 12.10.2026 (uttoranger, Freigabe Lauf 10), Bau in Gate 8 / Lauf 11:** Der Hof wählt die 3 sichtbaren Produkte, die übrigen ruhen, nichts wird gelöscht; ohne Wahl bleiben die 3 zuletzt verkauften sichtbar; Vorwarnung per Mail im Jänner 2027. |

---

## Backlog (entschieden, aber nicht im aktuellen Lauf)

Stand Lauf 7 (uttoranger): Die Punkte aus Lauf 6 sind entschieden und eingeplant — Direktverkauf senkt den Vorrat (D1, Nr. 39), Double-Opt-in (S11, Nr. 38), Rate-Limit über die Datenbank statt eines neuen Dienstes (R1, Nr. 40). Derzeit ist nichts im Backlog.

Stand Lauf 8 (uttoranger, 08.10.2026): N1, N2, Z2 und Z3 sind entschieden und in Nr. 41–48 eingeplant (freigabe.md §12). „Testmodus je Hof" (Z3) bleibt eine Option für später und ist nicht beauftragt. Die Stripe-Live-Schaltung macht der Mensch ganz am Schluss (Z2); kein Lauf schaltet um.

Stand Lauf 9 (uttoranger, 10.10.2026): N3, N4, N5 und Z4 sind entschieden und in Nr. 49–57 eingeplant (freigabe.md §13). O6 (Kachelquelle) und O7 (Gründungszusage) sind offen und werden nicht gebaut. Die Live-Schaltung samt `STRIPE_LIVE_AB` macht der Mensch als letzten Schritt.

Stand Lauf 10 (uttoranger, 12.10.2026): G4, K2, S16 und die Ergänzungen zu E6 („ohne Wahl Hoftor"), Z4 („Bestellzahl ohne Testbestellungen") und N4 („die Server-Action schreibt nur mitgeschickte Felder") sind entschieden und in Nr. 58–65 eingeplant (freigabe.md §14). O8 (Produkte über der Grenze ab 1.2.2027) ist entschieden, der Bau folgt in Gate 8 / Lauf 11; O6 (Kachelquelle) bleibt offen und wird nicht gebaut. Lint gehört zur Abschlussprüfung (Nr. 63): 0 Fehler vor jedem Commit, der Stop-Hook prüft es ab Lauf 11. Die Mockup-Abweichungen aus den Berichten 49–54 und ebee305 (Reihenfolge der Liste „Bearbeiten") sind freigegeben (freigabe.md §13, Nachtrag). Vorgemerkt für Lauf 11: ein dauerhaftes Admin-Protokoll (S12) als Tabelle (braucht eine Migration). Die Live-Schaltung samt `STRIPE_LIVE_AB` macht der Mensch als letzten Schritt.

Stand Lauf 11 (uttoranger, 12.10.2026): W1, T5, T6, F8, N6, N7 und I1 sind entschieden und in Nr. 66–74 eingeplant (freigabe.md §15); in der Freigabe heißen F8, N6 und N7 „F7", „B2" und „D3" (Zuordnung nach dem Muster des Registers). Nr. 66 darf eine Expand-Migration anlegen (Wortlaut bei W1). Die Nacharbeit aus Lauf 10 (Nr. 70) und der Fehler im Nachbestell-Link (Nr. 71) sind beauftragt; die Port-Frage ist durch Nr. 70 erledigt. Vorgemerkt im Backlog: „Illustrationen: Bögen in höherer Auflösung (2K/4K) neu erzeugen und mit dem Schneideskript der Projektleitung ersetzen, sobald Kacheln größer als 260 px gezeigt werden; Schwarzweiß-Fassung für Plakat und dunkles Theme nutzen". Offen und nicht in diesem Lauf: E-Mail-Pflicht nach FAGG; „Produkte im Shop" je Verkaufsgröße oder Familie; Gründungszusage bei Rücknahme der Freischaltung; Grundlage Kundinnen-Status; OSM-Auszug für die Karte; CI-Lint blockierend; SEPA-Weg, Rechnung/USt der Grundgebühr, Rücklastschriften, Admin-Protokoll (S12). Die Live-Schaltung samt `STRIPE_LIVE_AB` macht der Mensch als letzten Schritt.
