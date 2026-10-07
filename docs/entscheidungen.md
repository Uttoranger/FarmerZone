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

### E10 · Registrierungs-Fälle LFBIS / BAES (02.10.2026)
- **Entscheidung:** Eigene Ernte, lose oder in Ballen, braucht nur LFBIS. Abgepacktes Heimtierfutter mit Etikett, Zukauf und Mischen brauchen eine aktive BAES-Meldung.
- **Begründung:** Fachliche Klärung des Menschen. Die Texte lässt er vor dem Livegang gegenlesen (Umsetzungsprompt Abschnitt 10). — **Das Gegenlesen vor dem Livegang ist ersetzt durch E10a (07.10.2026).** Die Fälle selbst gelten weiter.
- **Dateien:** `Product.verpackung` (#169); Sperre je Gebinde mit Nr. 20 (Gate 6).

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

### E12 · Beiträge als Reiter in Mein Hof (02.10.2026)
- **Entscheidung:** Mein Hof hat die Reiter Hofseite | Beiträge. `/status` bleibt als Route und wird von dort verlinkt.
- **Begründung:** Mein-Hof-Umbau „mach es so".
- **Dateien:** `src/app/(hof)/farm-page/`, `src/components/mein-hof/` (#180).
- **Stand:** Nr. 22e (07.10.2026): Der Reiter „Beiträge" bietet alle Handlungen von `/status` (Deaktivieren, Löschen, Als Vorlage, WhatsApp fortsetzen); `/status` bleibt als Route und leitet auf den Reiter um (freigabe.md §9 „22e"; Lesart „bleibt und leitet um" am 07.10.2026 von uttoranger bestätigt), `/status/new` und WhatsApp fortsetzen liegen in der HofShell (Bericht 22e).

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

---

## K – Konditionen

### K1 · Konditionen-Übergang (06.10.2026)
- **Entscheidung:** Öffentlicher Text aus einer Quelle (`src/lib/konditionen.ts`): „In der Startphase kostenlos. Die Tarife gelten ab **1. Februar 2027**. Bereits freigeschaltete Höfe behalten ihre zugesagten Konditionen." Die Admin-Freischaltung (Gründungsplatz) bleibt, bis die Abrechnung gebaut ist (Gate 8).
- **Begründung:** Zwei Regeln widersprechen sich: Öffentlich standen die Tarife (E6), der Admin vergibt aber einen Gründungsplatz. Bereits zugesagte Konditionen (Pilothof) bleiben gültig.
- **Dateien:** `src/lib/konditionen.ts`, `/fuer-hoefe`, `/konditionen`, Registrieren-Link, `src/app/admin/admin-farm-list.tsx`, `src/lib/gruendungshof.ts`.
- **Datum:** **1. Februar 2027** (festgelegt am 06.10.2026, uttoranger im Chat). Damit ist 17d freigegeben (freigabe.md §8).
- **Stand:** umgesetzt in 17d.

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

---

## O – Offen (nicht entschieden, nicht bauen)

| # | Thema | Stand |
|---|---|---|
| O1 | Fehler-Token | **Entschieden 07.10.2026 (uttoranger):** Die Fehler-Farbe bekommt einen Kontrast von mindestens 4,5:1 in beiden Themes (Nr. 28). Bisher: Fehlertext 4,22:1 im hellen Theme, deshalb orange Hinweiskarte bzw. `text-status-offen`. |
| O2 | Bearbeiten am Handy (#180) | Unter der Checkliste in Mein Hof steht weiter der Editor mit Stiften; das Mockup zeigt nur „Vorschau ansehen". Entfällt er, braucht es einen eigenen Auftrag. |
| O3 | S11 Double-Opt-in | **Entschieden 07.10.2026 (uttoranger):** Double-Opt-in vor dem ersten Werbeversand — im Backlog, nicht in Lauf 6. Dazu gehört die Frage, ob „Nochmal bestellen" in der Abholbereit-Mail Werbung ist. |
| O4 | AGB / Nutzungsbedingungen | Werden separat erstellt — **NICHT anfassen** (bestätigt 07.10.2026). Bis dahin gibt es beim Registrieren keinen Zustimmungs-Haken. |
| O5 | Rückruf anfordern | **Entfällt (07.10.2026, uttoranger).** Schema `RueckrufAnfrage` wird nicht gebaut. Ersatz bleibt „E-Mail schreiben". |

---

## Backlog (entschieden, aber nicht im aktuellen Lauf)

Stand 07.10.2026 (uttoranger, Freigabe Lauf 6):
- 22b: Ein Direktverkauf mit Produkt senkt den Vorrat.
- S11: Double-Opt-in vor dem ersten Werbeversand (O3).
- Rate-Limit über einen gemeinsamen Speicher statt je Instanz — braucht einen neuen Dienst, die Entscheidung dafür ist offen.
