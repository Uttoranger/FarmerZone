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
- **Begründung:** Fachliche Klärung des Menschen. Die Texte lässt er vor dem Livegang gegenlesen (Umsetzungsprompt Abschnitt 10).
- **Dateien:** `Product.verpackung` (#169); Sperre je Gebinde mit Nr. 20 (Gate 6).

### E11 · Brennmaterial mit Raummeter und Schüttraummeter (02.10.2026)
- **Entscheidung:** Kategorie „Brennmaterial" mit den Arten Brennholz, Anzündholz und Hackschnitzel. Einheiten sind Raummeter und Schüttraummeter; M3 bleibt für Altdaten. Nur Abholung.
- **Begründung:** Holz war als Kategorie gewünscht und wurde um Hackschnitzel erweitert. M3 ist für Holz mehrdeutig.
- **Dateien:** `prisma/schema.prisma` (`ProductUnit`, `ProductSubcategory`, `BrennmaterialAngaben`, #169); Formular mit Nr. 20 (Gate 6).

### E12 · Beiträge als Reiter in Mein Hof (02.10.2026)
- **Entscheidung:** Mein Hof hat die Reiter Hofseite | Beiträge. `/status` bleibt als Route und wird von dort verlinkt.
- **Begründung:** Mein-Hof-Umbau „mach es so".
- **Dateien:** `src/app/(hof)/farm-page/`, `src/components/mein-hof/` (#180).

### E13 · „Verkauf eintragen" bleibt im Neu-Menü (02.10.2026)
- **Entscheidung:** Die bestehende Funktion bleibt erhalten und steht im Neu-Menü. Das Formular wird nur ins neue Design gezogen.
- **Begründung:** Die Funktion wird genutzt und fehlte nur in den Mockups.
- **Dateien:** `src/lib/bauern-navigation.ts` (`HOF_NEU`), `src/components/produkte/was-legst-du-an.tsx`.
- **Stand:** Nr. 18 (06.10.2026): „Verkauf eintragen" steht im Neu-Menü der HofShell und im Dialog „Was legst du an?" und öffnet das vorhandene Formular auf `/sales`. Ins neue Design zieht das Formular mit der Route `/sales`, die nicht zu Nr. 18 gehört (Bericht 18, „Bitte entscheiden").

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
| O1 | Fehler-Token | Fehlertext erreicht im hellen Theme 4,22:1 statt 4,5:1. Bis dahin zeigen die Seiten Fehler als orange Hinweiskarte bzw. orangen Text (`text-status-offen`). |
| O2 | Bearbeiten am Handy (#180) | Unter der Checkliste in Mein Hof steht weiter der Editor mit Stiften; das Mockup zeigt nur „Vorschau ansehen". Entfällt er, braucht es einen eigenen Auftrag. |
| O3 | S11 Double-Opt-in | Statusmeldungen und Newsletter haben nur ein einfaches Opt-in. Dazu gehört die Frage, ob „Nochmal bestellen" in der Abholbereit-Mail Werbung ist. |
| O4 | AGB / Nutzungsbedingungen | Werden extern erstellt. Bis dahin gibt es beim Registrieren keinen Zustimmungs-Haken. |
| O5 | Rückruf anfordern | Schema `RueckrufAnfrage` ist nicht freigegeben. Ersatz: „E-Mail schreiben". |
