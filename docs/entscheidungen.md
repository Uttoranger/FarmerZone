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
- **M** – Marke und Domain
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
- **Ergänzung Geräte, Code- und Passwort-Raten (uttoranger, im Chat, 19.10.2026; Nr. 112 und 114):** „Falsche Codes zählen je Adresse über alle Codes hinweg: höchstens 10 je Stunde und 30 je Tag; darüber pausiert die Anmeldung mit Code für diese Adresse bis zum Ende des Zeitfensters, und es geht eine Mail an die Adresse (eine je Pause). Falsche Passwörter zählen je Konto: höchstens 10 je Stunde, danach Pause bis zum Ende der Stunde und eine Mail; „Passwort vergessen“ bleibt möglich. Alles gilt gleich für Adressen, die es nicht gibt. Ein erfolgreiches Zurücksetzen des Passworts setzt diesen Zähler zurück; Warn-Mails dazu höchstens eine am Tag. Höfe sehen unter Einstellungen › Konto und Sicherheit ihre angemeldeten Geräte (Gerät und Browser, nie Ort oder IP-Adresse) und melden einzelne oder alle anderen sofort ab, ohne Code. Meldet sich ein Hof- oder Admin-Konto auf einem Gerät an, das wir bei diesem Konto noch nicht kannten, geht eine Mail „Neue Anmeldung“ mit Gerät und Uhrzeit hinaus; ihr Knopf „Das war ich nicht“ öffnet eine Seite mit Knopf (der Link gilt 7 Tage und einmal), die alle Geräte abmeldet und einen Link für ein neues Passwort schickt. Jede Sitzung wird frisch aus der Datenbank gelesen (kein Zwischenspeicher im Cookie mehr), sodass Abmelden sofort wirkt. Bis zur SMS (Lauf 18) geht der Hinweis an die E-Mail-Adresse, danach über den jeweils anderen Weg.“

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
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 123):** „Das Schild heißt überall ‚Futtermittelbetrieb · LFBIS <Nummer> · laut Hof‘ – in neutraler Farbe und ohne Haken-Symbol (Futter kaufen, Produktseite, Vorschau im Futter-Formular). Texte sagen ‚Höfe mit LFBIS-Nummer‘, nie ‚registriert‘ oder ‚geprüft‘. Ein (i) in ‚Futter kaufen‘ erklärt: Die Nummer gibt der Hof selbst an, Agrilo prüft sie nicht.“

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
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 129):** „Heute zeigt ‚Dein Beitrag‘ nach Abholung und Packliste (Anlass, Titel, seit wann, wie lange noch, E-Mail- und WhatsApp-Zahl, Teilen, Ansehen, Neuer Beitrag); läuft keiner und gab es 14 Tage keinen, einen ruhigen Anstoß mit den vier Anlässen. Mein Hof › Hofseite nennt den laufenden Beitrag in der ersten Zeile. Verwaltet wird weiter unter Mein Hof › Beiträge.“

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
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 127):** „Die CI (ci.yml) läuft auch für PRs auf `integration/**`, `docs/**` und `nacht/**`, damit Fehler im Zusammenspiel gestapelter PRs vor dem Sammel-PR auffallen. Ein neuer Push bricht den laufenden CI-Lauf desselben PRs ab, auf main nie.“

### G4 · Bausteinverzeichnis und Regelvorschläge (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 10):** `docs/ai/BAUSTEINE.md` wird aus dem Code erzeugt (`pnpm bausteine`), nie von Hand geschrieben; ein Test hält es aktuell; vor jeder neuen Datei, Komponente oder Funktion wird es gelesen. Fehler, die wiederkommen können, werden bevorzugt durch eine Prüfung verhindert (Test, Lint, Hook), sonst durch eine Textregel am richtigen Ort. Agenten schlagen Regeln vor, der Mensch gibt frei; neue Regeln tragen Herkunft und Datum. Jeder fünfte Lauf (10, 15, …) beginnt mit einer Regel-Inventur: überholte, doppelte oder durch Tests abgedeckte Regeln werden zum Streichen vorgeschlagen, nicht selbst gestrichen.
- **Umsetzung:** Nr. 58 (freigabe.md §14).
- **Ergänzung (uttoranger, im Chat, 19.10.2026; Nr. 121):** „Aus Morgenbericht 17 §5 freigegeben und in Nr. 121 umgesetzt: 112 (feste Uhr in tests/integration nur in der Vergangenheit, außer ohne Better Auth), 113, 114, 116, 117 (nur Vermerk), Dirigent (1) und Dirigent (2). 118 braucht keinen Satz.“
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 127):** „Aus Morgenbericht 18 §5 freigegeben und in Nr. 127 umgesetzt: 115 (`vi.mock` an Paketgrenzen), 119 (eine Fabrik je Testtyp – ändert den Satz ‚keine geteilte Fixture-Datei ohne Not‘ in TESTING_GUIDELINES), 120 (Uhr-Wache für src/components/hoefe), 121 (Uhr-Schritte in der Integrations-Wache) und der Vorschlag des Dirigenten (CI für gestapelte PRs, siehe G3).“
- **Ergänzung (uttoranger, im Chat, 21.10.2026):** „Aus Morgenbericht 19 §5 freigegeben und in Nr. 130, 134 und 136 umgesetzt, je als Prüfung vor einer Textregel: 122 (‚Teile exportieren‘ heißt ‚unverändert benennen und exportieren‘), 123 (bei Seed-Feldern nennt die Grenze seed-daten.ts und seed-lauf.ts), 124 (vor einer Fachregel über ein Feld hält ein Test die Bedeutung des Felds im Formular fest), 125 (von next.config.ts erreichbare Dateien importieren nur relativ), 128 (`useCart(` nur in der Produktliste der Hofseite und auf der Produktseite), 129 (zur Grenze gehört die rendernde Seite), G3 (nach dem Umstellen der Basis einmal pushen), CI auf main (Hook-Test mit eigenem Verzeichnis), Fabrik-Wache (Tests, die ganz src/ oder tests/ lesen, tragen die Zeitgrenze aus TESTING_GUIDELINES, jetzt geprüft).“

### G5 · Bedeutungsfarben als Tokens (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 12):** Die vier Zustände tun (Kundin oder Hof muss etwas tun), läuft, erledigt, abgebrochen haben je ein Flächen- und ein Text-Token in beiden Modi; Marken entstehen nur aus dem Baustein `Marke`. Kontrast Text auf Fläche ≥ 4,5:1 in beiden Modi (heute 2,3:1 bei tun und erledigt im hellen Modus). Die Regel „keine Hexfarben in Komponenten" gilt damit ohne die Ausnahme aus bestellstatus.ts; benannte Ausnahmen bleiben: Teilen-Bild, Mails, QR, Absperrband, Leaflet-Pins (hoefe-anzeige.ts), Titelbild-Verläufe (mein-hof.ts), manifest/layout. Die bewusste Trennung Kundin-Sicht (bestellstatus.ts) / Hof-Sicht (order-status.ts) bleibt – nur die Farbe kommt aus einer Quelle.
- **Verhältnis zu anderen Einträgen:** ersetzt die Ausnahme im Kopfkommentar von `src/lib/bestellstatus.ts` („keine Tokens für Bedeutungsfarben"); nimmt den Regelvorschlag 68 aus Lauf 11 (StatusBadge mit Symbol) im Baustein `Marke` auf.
- **Umsetzung:** Nr. 79 (freigabe.md §16).
- **Bestätigt (uttoranger, Freigabe Lauf 13, 13.10.2026):** Entscheidungen des Dirigenten aus Lauf 12 (Morgenbericht 12 §7): CODING_STANDARDS §7 ist nach G5 umgeschrieben (Zustandsmarken nur über `Marke` mit den Tokens `--fz-zustand-*`; kein Hexwert in `src/components` und `src/lib` außer den benannten Ausnahmen der Hex-Wache; Palette mit `dark:` nur noch für Bedeutung ohne Marke). Grenzerweiterung für Nr. 79: `components/farmer/schild.tsx` und die neue `src/lib/marke-art.ts` (der Typ liegt in lib, weil die Fachregeln ihn liefern).

### G6 · Pakete erst ab 14 Tagen (19.10.2026)
- Entscheidung (uttoranger, im Chat 19.10.2026): pnpm installiert keine Paketversion, die jünger als 14 Tage ist (`minimumReleaseAge: 20160` in pnpm-workspace.yaml), auch nicht als Unterpaket. Ausnahmen nur für eine dringende Sicherheitskorrektur, mit Freigabe, je Version in `minimumReleaseAgeExclude`.
- Begründung: Verseuchte Paketversionen werden meist in den ersten Tagen entdeckt und zurückgezogen. Beim Paket für Nr. 115 wären sonst Unterpakete mitgekommen, die 3 bzw. 7 Tage alt waren.
- Dateien: `pnpm-workspace.yaml`, `CLAUDE.md`, `docs/ai/TECH_STACK.md` §4.
- **Ergänzung (uttoranger, im Chat, 21.10.2026; Nr. 135):** „Freigegeben sind zwei Entwicklungspakete, je Version: `yaml` 2.9.1 (YAML-Parser der Wachen über .github/workflows; ersetzt den Umweg über das `js-yaml` von ESLint) und `jsdom` 30.1.2 (Umgebung für den Test des Hydrierens). Beide sind älter als 14 Tage, eine Ausnahme nach G6 gibt es nicht.“

### G7 · Vorschau ohne WIP-Commits (19.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 18):** „Vercel baut keine Vorschau für einen Commit, dessen Betreff mit ‚WIP:‘ beginnt (scripts/vercel-ignore.sh als `ignoreCommand` in vercel.json); die Produktion baut immer, im Zweifel wird gebaut. Der letzte Commit einer Nummer vor dem PR ist nie ein WIP-Commit – sonst fehlen Vorschau und Migration in der Entwicklungsdatenbank.“
- **Umsetzung:** Nr. 121 (freigabe.md §22; `scripts/vercel-ignore.sh` als `ignoreCommand` in `vercel.json`).

### G8 · Content-Security-Policy zum Beobachten (20.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 19):** „Alle Seiten tragen eine `Content-Security-Policy-Report-Only` aus einer Quelle (src/lib/csp.ts) mit den erlaubten Hosts (Stripe, Kartenkacheln, Blob, Sentry, Vercel). Gemeldet wird nur aus der Produktion, an die eigene Route /api/csp-bericht; sie gibt die Meldung ohne Query, Fragment und Code-Ausschnitt an Sentry weiter, gebremst und entdoppelt. Seiten mit Token oder Signatur in der Adresse melden nie. Scharf geschaltet wird erst nach Auswertung der Meldungen (eigener Auftrag).“
- **Umsetzung:** Nr. 125 (freigabe.md §23; keine Migration, kein Paket).
- **Ergänzung (uttoranger, im Chat, 21.10.2026; Nr. 132):** „Die Stripe-Hosts stehen nach der Stripe-Doku ‚Integration security guide › Content Security Policy › Stripe.js‘ (docs.stripe.com/security/guide, abgerufen 21.10.2026) in der Policy: `https://api.stripe.com` in connect-src; `https://js.stripe.com` und `https://*.js.stripe.com` in script-src und frame-src; `https://hooks.stripe.com` in frame-src (3-D-Secure). `https://maps.googleapis.com` (nur mit eigenem Google-Schlüssel im Address Element) und die Hosts von Link kommen nur dazu, wenn wir das nutzen.“

### G9 · Seed-Höfe in Bildern (21.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 20):** „In den Bildern der Läufe dürfen die erfundenen Höfe aus dem Seed (prisma/seed-daten.ts) stehen, mit ihren Gemeinden und Postleitzahlen. In Tests heißen Höfe weiter ‚Testhof A‘, ‚Testhof B‘ und ‚Sonnhof‘; nur Tests, die den Seed selbst prüfen, nennen seine Slugs. Der Seed bleibt erfunden: Hof- und Personennamen, Straßen und Telefonnummern sind ausgedacht, Adressen enden auf @example.com. Nur die Gemeinden sind echt. Welche Orte der Seed nicht trägt, gibt die Projektleitung je Auftrag vor. Eine Liste dieser Orte steht nicht im öffentlichen Repository.“
- **Umsetzung:** geplant in Nr. 133 (freigabe.md §24): drei Orte im Seed getauscht; keine Migration.

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
- **Bestätigt (uttoranger, Freigabe Lauf 12, 13.10.2026):** Kennung F8 statt F7 aus der Freigabe Lauf 11 bestätigt.
- **Änderung (uttoranger, im Chat, 20.10.2026; Nr. 128):** „Die Hofseite hat keinen Reiter ‚Beiträge‘ mehr. Die aktiven Beiträge (höchstens fünf, der neueste zuerst mit ‚Aktuell‘) stehen als Abschnitt ‚Aktuell vom Hof‘ oben in der Übersicht: der neueste als Karte mit ‚Weiterlesen‘ und den verknüpften Produkten (‚Dazu im Hofladen‘, mit ‚+‘ in den Korb), ältere als Zeilen, die an Ort und Stelle aufklappen. `?beitrag=<id>` zeigt genau diesen aktiven Beitrag des Hofs oben; alte Links mit `?reiter=beitraege` landen bei ‚Aktuell vom Hof‘. Ohne aktiven Beitrag entfällt der Abschnitt. Board system-k2-beitraege-v2.“

### F9 · Mockup-Abweichungen Lauf 12 (13.10.2026)
- **Entscheidung (uttoranger, Freigabe Lauf 13):** genehmigt sind die Mockup-Abweichungen aus Nr. 82 (Uhrzeit-Format, Pille 50 px, Radioknopf, „für dich reserviert", Platzhalter 17:30) und aus Nr. 79 (Dunkel deckt die Fläche).
- **Verhältnis zu anderen Einträgen:** betrifft N10 (Nr. 82) und G5 (Nr. 79).

### F10 · Bestätigungen aus Lauf 19 (21.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 20):** „Bestätigt sind alle Mockup- und Board-Abweichungen aus Morgenbericht 19 §8: 122 (‚Zum Hof‘ als Textlink, Leerzustand ohne Standort gestrichelt, Dialog ‚So rechnen wir‘ ohne Griffleiste), 123 (Reihe ‚Abholung‘ als Links, eigene Radiofelder für die Größen, HofKopf mit PLZ und Ort, Karte am Pin am Computer unten links, Abholhinweise auf der Produktseite unter dem Schild), 124 (Karte am Pin unten links mit 320 px, aufgeklappt je Hof nur das zählende Produkt), 128 (‚Weiterlesen‘ auch beim geteilten Beitrag, am Computer die Produkte über die ganze Kartenbreite) und 129 (Marke auf deckender Fläche, ‚vor 1 Tag‘ statt ‚gestern‘, ‚Neuer Beitrag‘ am Handy in eigener Zeile, im Karussell die Marke in der Zeile, Block ‚Höfe-Auswahl‘ ohne Marke). Dazu, entschieden vom Team: Karussell und Produkttreffer behalten ihren eigenen Kopf. Sie sind keine Hofkarten; dort ist das Produkt bzw. die Reihe die Hauptsache. Der Admin-Hinweis zu angemeldeten Geräten nennt bei Konten mit Passkey kein Passwort, denn das ist gesperrt (N20). Ebenfalls bestätigt: Eine Adresse mit falschem Format gilt bei den Ersatzcodes als unbekannte Adresse (gleiche Antwort, kein 400, 126). Die Login-Bremse ‚3 je 10 s‘ zählt über alle Instanzen auch hinter einer geteilten IP (Mobilfunk) und ist dort strenger als vorher; kommen in der Produktion 429 vor, wird nachgeschärft (R1). Region zeigt an der eigenen Hofkarte keine Marke (`neuerBeitrag: null`, 129).“
- **Verhältnis zu anderen Einträgen:** bestätigt die freigegebenen Abweichungen von den Boards in freigabe.md §23 (N23, Beiträge v2); ergänzt N20 (Admin-Hinweis zu angemeldeten Geräten) und R1 (Login-Bremse).
- **Umsetzung:** Vermerk „bestätigt 21.10.2026 (Register F10)“ in den Zeilen der Region-Boards und der Beiträge v2 in docs/mockups/README.md; der Kommentar zu Karussell und Produkttreffer in `hof-kopf.tsx` folgt mit Nr. 133 (freigabe.md §24).

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
- **Ergänzung (uttoranger, im Chat, 15.10.2026; Nr. 93): Gründungshöfe sichtbar:** kein Banner. Bausteine: (1) Startseite, Für-Höfe-Band: ein Satz nach der Beschreibung – „Noch n von 12 Gründungsplätzen frei – Hofladen kostenlos bis 31. Dezember 2027.“ mit Stern (Schmuck, aria-hidden); (2) /fuer-hoefe: Pill „Gründungsphase · noch n von 12 Plätzen“ über der Überschrift, der eine orange Knopf heißt „Gründungshof werden“, Fußnote „Kostenlos bis 31. Dezember 2027 · danach Tarif nach Wahl · monatlich kündbar“; im Abschnitt Preise eine Angebotszeile direkt über den Tarifkarten und in der Hofladen-Karte „0 € / Monat · bis 31.12.2027 · dann 19 €“; (3) /register: ein Satz über dem Formular „Du wärst voraussichtlich Gründungshof Nr. k – Hofladen kostenlos bis 31. Dezember 2027. Die Zusage kommt mit der Freischaltung.“ (k = vergeben + wartende Höfe vor dir + 1, immer mit „voraussichtlich“); (4) nach der Freischaltung EINE Nachricht vom Team im Postfach (art SYSTEM, „Du bist Gründungshof Nr. n – Hofladen ohne Grundgebühr bis …“, Link Deine Konditionen) – sie erscheint damit als Heute-Karte und verschwindet mit „Gelesen“; keine Dauerkarte; (5) alle vergeben oder Datum vorbei: nichts wird gezeigt, kein „0 von 12“. Zahlen aus den Admin-Einstellungen (Plätze gesamt, Kostenlos-bis-Standard, Anzeige an/aus); MAX_GRUENDUNGSHOEFE und GRUENDUNG_BIS_STANDARD_TAG werden zu Defaults der Einstellung. Keine seitenweite Leiste, kein Countdown, nie zwei orange Knöpfe auf einer Seite.
- **Korrektur 15.10.2026 (uttoranger): ‚keine Bankdaten nötig‘ gestrichen** – Stripe verlangt beim Einrichten ein Auszahlungskonto; die Fußnote oben ist angepasst. Im selben Zug heißt der zweite Satz der Zusage (`baueGruendungsZusage`, Nachricht nach der Freischaltung, „Dein Stand“, Freischalt-Dialog) „Danach wählst du deinen Tarif – ohne Wahl bleibt Hoftor, kostenlos.“ statt „Danach gelten die normalen Tarife – ohne Wahl Hoftor, kostenlos.“
- **Verhältnis zu anderen Einträgen (Ergänzung):** baut auf K1 (Konditionen-Übergang) und dem Enddatum je Hof aus diesem Eintrag auf; Wortliste N8 um „Gründungsplatz“ und „Gründungsphase“ ergänzt (DESIGN_SYSTEM „Wortliste“).
- **Umsetzung (Ergänzung):** Nr. 93 (freigabe.md §18; Einstellungen-Seite und Bausteine, eine Migration, Expand); Mockups `system-k2-gruendung-bausteine`, `web-/mobil-k2-startseite-gruendung`, `web-/mobil-k2-fuer-hoefe-gruendung`, `web-/mobil-k2-registrieren-gruendung` (docs/mockups/README.md).
- **Ergänzung Testhöfe ausnehmen (uttoranger, im Chat, 16.10.2026; Nr. 109):** „Der Admin kann einen freigeschalteten Hof aus der Vergabe der Gründungsplätze nehmen (etwa einen Testhof) und wieder aufnehmen. Ein ausgenommener Hof belegt keinen Platz; die Höfe danach rücken auf, wie bei einem stillgelegten Hof. Hält der Hof gerade einen Platz, verlangt das Ausnehmen den Haken „Testhof oder Zustimmung des Hofs“ – zugesagte Konditionen bleiben sonst (K1), wie beim Verkürzen von „Gründungshof bis“. Wieder aufnehmen geht nur, solange ein Platz frei ist – so verliert nie ein anderer Hof seine Zusage; die Nummern der Höfe dahinter können sich um eins verschieben (die Nummer ist eine Reihenfolge, die Zusage ist das Datum). Wer zuletzt geändert hat und wann, steht am Hof. Der Hof bekommt keine Nachricht, auch nicht ein Hof, der dadurch neu Gründungshof wird.“
- **Änderung Aktion „100 Gründungshöfe“ (uttoranger, im Chat, 19.10.2026; Nr. 116):** „Es gibt 100 Gründungsplätze. Gründungshöfe bekommen den Hofladen 24 Monate ohne Grundgebühr (Wert 456 € inkl. USt.), gerechnet ab dem späteren Tag von Tarifstart (1. Februar 2027) und Freischaltung; das Ende steht je Hof fest. Ein Platz zählt erst mit der Freischaltung, und die verlangt jetzt neben bestätigter E-Mail und fertigem Stripe mindestens ein Produkt im Shop. Platz und Ende werden bei der Freischaltung festgeschrieben (Nummer = kleinste freie); Stilllegen und Wieder-Aktivieren ändern nichts daran, so verliert nie ein anderer Hof seine Zusage. Die Aktion endet am Stichtag ‚Aktion bis‘ (31. März 2027); danach werden keine Plätze mehr vergeben. Den Stichtag kann der Admin nur vorziehen, nie nach hinten schieben; die Monate nur erhöhen. Ob Plätze vergeben werden, entscheiden nur Festschreiben, Stichtag und freie Plätze – der Schalter ‚Anzeige‘ steuert nur die Sätze der Werbung. Der Zähler ‚Noch n von 100‘ erscheint erst ab 10 vergebenen Plätzen; davor steht der Satz ohne Zahl. Bestehende Zusagen werden einmal per Admin-Aktion festgeschrieben, nie kürzer als bisher (K1) – auch für stillgelegte, freigeschaltete Höfe. Freigabe entziehen und erneut freigeben ändern Platz und Ende nicht. Gründungshöfe tragen das Abzeichen ‚Gründungshof‘ – ein Etikett direkt über dem Hofnamen auf Hofseite, Höfe-Liste, den Hofkarten der Startseite und im Teilen-Bild, ohne Nummer, kein Prüfsiegel –, für immer; der Hof kann es unter Konditionen und Tarif ausblenden (Standard: an). Ausgenommene Höfe (Testhöfe) bekommen kein Abzeichen.“
- **Ergänzung Heute-Karte (uttoranger, im Chat, 19.10.2026):** „Die Heute-Karte nach der Freischaltung (Baustein 5 der Gründungs-Mockups) entfällt; die Gründungs-Nachricht im Postfach nennt Nummer und Ende.“
- **Verhältnis zu N21 (19.10.2026):** Ein Testhof ist immer auch ausgenommen; ‚ausgenommen‘ heißt ab N21 nur noch: zählt nicht für die Gründungsplätze (ein ausgenommener echter Hof ist normal sichtbar und wird indexiert).

### K3 · Unterhaltungen zwischen Höfen (13.10.2026)
- **Stand:** beschlossen 13.10.2026, **Bau nach Signal**, nicht in Lauf 13.
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 13):** Eine Unterhaltung mit einem anderen Hof beginnt nur ein Hof, dessen Tarifstand nicht „hoftor" ist; antworten kann jeder Hof. Tariftabelle: Hoftor „Fragen anderer Höfe beantworten", Hofladen „Fragen an andere Höfe stellen – unbegrenzt". Signal für den Bau: mehr als eine Handvoll Nachfragen je Monat (z. B. über ein späteres „Frage per E-Mail" in Futter kaufen) oder mindestens 15 Höfe mit Futterangebot. Konzept, Mockups und Belege: claude/lauf13-vormerkung.md Abschnitt 7.
- **Verhältnis zu anderen Einträgen:** ergänzt die Tarife aus E6; gehört mit T8 zusammen.

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
- **Korrektur (uttoranger, im Chat, 15.10.2026):** „Eine Testumgebung test.agrilo.at wurde nie eingerichtet (keine Variable NEXT_PUBLIC_TESTUMGEBUNG_URL, kein Branch staging). Der Code bleibt (Link nur mit Variable); die Betriebsleiste des Admins zeigt bis auf Weiteres nur den Stripe-Modus.“ Umsetzung der Betriebsleiste: Nr. 94 (freigabe.md §18).

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
- **Bestätigt (uttoranger, Freigabe Lauf 12, 13.10.2026):** Im Beitrag-Modus bestimmt die Auswahl `p` im Fenster das Bild vor den verknüpften Produkten; ohne `p` die verknüpften (nur kaufbare), sonst der Standard (Nr. 67 Runde 1, Entscheidung des Dirigenten in Lauf 11).
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 128):** „Der Link eines Beitrags – im Teilen-Fenster wie in der Mail an Abonnentinnen – führt zur Übersicht mit genau diesem Beitrag oben (`?beitrag=<id>`), nicht mehr in einen Reiter.“

### T6 · Teilen-Bild (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Variante A „Marktkarte" (Creme, grüne Kante, Serif-Titel, Produktzeilen mit Foto oder Kategorie-Illustration, Abhol-Streifen, Link-Pille) ist das Bild; liegt ein Foto vor (Beitragsfoto, sonst erstes Produktfoto), gilt Variante B „Foto-Held". Der QR-Code steht nur im Format Status 9:16 (Storys haben keinen klickbaren Link); im 1:1 steht kein QR. Bildquelle je Produktzeile: eigenes Foto → Illustration der Kategorie → „Sonstiges". Schriften im Bild: Fraunces und Instrument Sans wie in der App.
- **Verhältnis zu anderen Einträgen:** ergänzt T1 – Farbwerte im Teilen-Bild bleiben die Ausnahme vom Token-Gebot in `TEILEN_BILD_FARBE`.
- **Umsetzung:** Nr. 69 (freigabe.md §15).
- **Bestätigt (uttoranger, Freigabe Lauf 12, 13.10.2026):** Schriftquelle Instrument Sans aus github.com/Instrument/instrument-sans (Commit 7fa2230) statt der nicht vorhandenen Adresse github.com/googlefonts/instrument-sans – Entscheidung des Dirigenten in Lauf 11.

### T7 · Teilen-Bild als JPEG (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 12):** Die Bildroute liefert JPEG (Qualität 82) statt PNG, damit die Vorschau in WhatsApp und Co. sicher erscheint (PNG mit Foto 1,2–1,4 MB); Dateiname und Teilen-Datei .jpg, Open-Graph-Typ image/jpeg. QR und Schrift müssen bei 1080 px lesbar bleiben (Abnahme an den sechs Bildern aus 69).
- **Verhältnis zu anderen Einträgen:** ergänzt T6 (Gestaltung bleibt).
- **Umsetzung:** Nr. 76 (freigabe.md §16).

### T8 · Lebenslauf und Aufbewahrung einer Hof↔Hof-Unterhaltung (13.10.2026)
- **Stand:** beschlossen 13.10.2026, **Bau nach Signal**, nicht in Lauf 13.
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 13):** läuft 14 Tage ab der letzten Nachricht des Beginners, danach nur lesen; 3 Jahre ab Abschluss lesbar und herunterladbar, dann gelöscht (Verjährung § 1489 ABGB; DSGVO Art. 5 Abs. 1 lit. e); das Team liest nur gemeldete Unterhaltungen; kein Löschen durch Nutzer. Wortlaut in claude/lauf13-vormerkung.md Abschnitt 7.
- **Verhältnis zu anderen Einträgen:** gehört zu K3.

---

## W – WhatsApp-Versand

### W1 · WhatsApp an Abonnenten, ehrlich und je Person (12.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Die App kann nicht wissen, ob in WhatsApp gesendet wurde (kein Rückkanal von wa.me; die Business-API kommt für den Pilot nicht in Frage). Deshalb heißt der Zustand „geöffnet", nie „gesendet"; markiert wird beim Zurückkommen in den Browser, nicht per Zeitschaltung; jede Person lässt sich zurücksetzen; gespeichert wird, WER angetippt wurde (Abonnements-IDs), die Zahl folgt daraus; Empfängerinnen werden nicht beim Veröffentlichen eingefroren, sondern beim Öffnen der Liste gelesen.
- **Verhältnis zu anderen Einträgen:** ergänzt E12 (WhatsApp fortsetzen im Reiter Beiträge) und T5.
- **Migration (freigegeben, Wortlaut):** „Nr. 66 darf eine Expand-Migration anlegen: neue Spalte StatusPost.whatsappGetippt vom Typ TEXT[] (Abonnements-IDs, keine E-Mails, keine Nummern), nullable, mit leerem Default wie linkedProductIds, ohne Backfill und ohne andere Schema-Änderung. Erzeugt mit prisma migrate diff; Produktion bekommt sie nur über vercel-build beim Merge." Die bestehenden Spalten whatsappSentCount und whatsappRecipientCount bleiben (Contract später, eigene Freigabe).
- **Umsetzung:** Nr. 66 (freigabe.md §15).
- **Bestätigt (uttoranger, Freigabe Lauf 13, 13.10.2026):** Entscheidung des Dirigenten aus Lauf 12 (Morgenbericht 12 §7): Nr. 75 – Grenzerweiterungen `server/queries/teilen-bild.ts` (Lader) und `lib/whatsapp-versand.ts` (nur der Toast-Satz); der Hook lag in `hofseite-vorschau-rahmen.tsx` statt im Editor, dort ist nur die Funktion heraus und der Import hinein.

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
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 125):** „Auch die eingebaute Bremse von Better Auth (Anmeldung, Registrierung, Passwort, Codes) zählt über alle Instanzen – über `rateLimit.customStorage` mit atomarem `consume` auf der bestehenden Tabelle `RateLimitZaehler` (feste Fenster, Schlüssel nur als HMAC, nie eine IP im Klartext), ohne Migration. Antwortet die Datenbank nicht binnen 1,5 s oder mit einem Fehler, zählt die Instanz für sich wie bisher und meldet die Fehlerklasse an Sentry.“

---

## M – Marke und Domain

### M1 · Marke und Domain (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 13):** Die Plattform heißt **Agrilo** (Entscheidung uttoranger 13.10.2026). Produktionsdomain agrilo.at; agrilo.eu, [www.agrilo.at](https://www.agrilo.at), [www.agrilo.eu](https://www.agrilo.eu) und farmerzone.at leiten per 308 auf agrilo.at um (farmerzone.at bis zum Ablauf, world4you); DNS und Mail-Empfang bei Cloudflare, Versand über Resend (agrilo.at), Absender „Agrilo <noreply@agrilo.at>" über EMAIL_FROM; Adressen support@, kontakt@, datenschutz@agrilo.at. Der Name steht im Code an EINER Stelle (Konstante MARKE in src/lib/marke.ts, dazu MARKE_TEAM = `${MARKE}-Team`); die Domain bleibt an EINER Stelle (PRODUKTION_HOST). Repo „FarmerZone", Vercel-Projekt „farmer-zone" und farmer-zone.vercel.app bleiben technische Namen. Überall, wo dieser Text, das Register, die Mockups oder die Wortliste „FarmerZone" sagen, gilt ab Nr. 91 „Agrilo" (z. B. „Agrilo-Team" im Postfach). Testumgebung test.agrilo.at.
- **Offen (Projektleitung):** Markenprüfung in TMview (gleichnamige App „Agrilo" eines anderen Anbieters), Stripe-Anzeigename auf der Kartenabrechnung, Vercel-Plan Pro vor Stripe-Live.
- **Verhältnis zu anderen Einträgen:** ergänzt Z3 (die Testumgebung heißt test.agrilo.at) und S16 (trustedOrigins).
- **Umsetzung:** Nr. 91 (freigabe.md §17). Den Cutover (Variablen, Umleitungen, Stripe-Adressen) macht die Projektleitung nach §2 der Freigabe, nicht der Lauf.
- **Ergänzung Bildmarke (uttoranger, im Chat, 14.10.2026; Nr. 92):** Es gibt EINE Bildmarke in zwei Fassungen derselben Form — voll ab 48 px, klein darunter (Favicon 16/32, Kopfzeile 32). Farben fest: Kachel #2D5F3F, Zeichnung #F3EDE0, Blatt #D07A45; kein Wechsel mit Hell/Dunkel. Die Kachel ist Teil der Marke; ihre Rundung (22 %) entsteht im Skript (`pnpm marke`) bzw. per CSS, nie im SVG. Quelle: `public/marke/agrilo-icon-voll.svg` und `agrilo-icon-klein.svg` (dazu PNG 1024/2048) sowie `public/og/startseite.jpg` (1200 × 630, der Text ist Teil des Bildes); Mockup `docs/mockups/system-m1-marke-agrilo-entscheidung.html` (gilt; `system-m1-marke-agrilo.html` sind die Varianten der Vorarbeit, nur Dokumentation). Die drei bisherigen Zeichnungen — Blatt im Kreis (Wortmarke), Blatt im Kreis (Teilen-Bild), F-Icon (public/icons, apple-icon.png, favicon.ico, og/startseite.jpg) — entfallen ersatzlos. Regeln: `docs/ai/DESIGN_SYSTEM.md`, Abschnitt „Marke“.

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
- **Ergänzung Kundenansicht am Handy (uttoranger, im Chat, 16.10.2026; Nr. 107):** „Die Kundenansicht in Mein Hof (Knopf „Kundenansicht“ im Kopf, Adresse `?ansicht=kundin`) öffnet am Handy als Vollbild mit dem Band ‚Kundenansicht · So sieht dich die Kundschaft‘ und ‚Fertig‘. Sie deckt die Leiste des Hofs ab; die Leiste der Kundschaft ist zu sehen, reagiert in der Vorschau aber nicht.“

### N5 · Hofseite unter lg, Reiter Übersicht (10.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 9):**
  - Unter dem Kopf zuerst das Schaufenster: ein Fotostreifen und bis zu vier Produkte, dazu „Alle Produkte (n)".
  - Danach unverändert: Nächste Abholung mit Abholzeiten, Zahlung & Kontakt, Über uns, Anfahrt; der Mini-Korb bleibt, wo er ist.
  - Ab lg unverändert.
- **Begründung:** Befund vom 10.10.2026: Fotos und Produkte stehen unter lg erst nach Abholung, Zahlung und Anfahrt.
- **Dateien:** Hofseite (`hofseite-kunde.tsx`, `HofseiteFotos`, `hofseite/produkt-karte.tsx`); Umsetzung Nr. 51 (freigabe.md §13).
- **Änderung Fotos als Mosaik (uttoranger, im Chat, 16.10.2026; Nr. 107):** „Die Fotos der Übersicht stehen am Handy als Mosaik statt als Streifen: 1 Foto in voller Breite, 2 Fotos als zwei Hälften, ab 3 Fotos ein großes und zwei kleine, ab 4 Fotos auf der dritten Kachel ‚+n · alle n Fotos‘. Kein seitliches Scrollen. Ab 1024 px bleibt das Raster. Die Bildansicht zeigt ‚3 / 8‘, lässt wischen und hat unten eine Leiste zum Springen.“
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 128):** „Unter lg steht ‚Aktuell vom Hof‘ nach den Knöpfen und dem Reiter und vor dem Schaufenster; ab lg oben in der linken Spalte. Die Karte bleibt kurz (zwei Zeilen Text).“

### N6 · Titelbild im Hochformat (12.10.2026)
- **Kennung:** In der Freigabe Lauf 11 „B2"; B2 ist vergeben und B steht für Bezahlung; Hofseite wie N4/N5, darum N6 (Zuordnung durch den Dirigenten nach dem Muster des Registers).
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Ein Titelbild, das höher als breit ist, wird am Desktop nicht beschnitten, sondern ganz gezeigt (object-contain, mittig) vor einer unscharfen, abgedunkelten Kopie desselben Bilds, die die Fläche füllt; am Handy bleibt der Beschnitt mit Fokuspunkt. Beim Hochladen sagt die App, dass Querformat am Computer größer wirkt – kein Zwang.
- **Verhältnis zu anderen Einträgen:** ergänzt N5.
- **Umsetzung:** Nr. 72 (freigabe.md §15).
- **Bestätigt (uttoranger, Freigabe Lauf 12, 13.10.2026):** Kennung N6 statt B2 aus der Freigabe Lauf 11 bestätigt.

### N7 · Mein Hof am breiten Bildschirm (12.10.2026)
- **Kennung:** In der Freigabe Lauf 11 „D3"; D steht für Direktverkauf; Mein Hof wie N4, darum N7 (Zuordnung durch den Dirigenten nach dem Muster des Registers).
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 11):** Der Editor ist auf 2 000 px Breite begrenzt und zentriert; die Vorschau ist nie breiter als 1 440 px, die Liste 400–560 px (Web) bzw. höchstens 720 px (Handy).
- **Verhältnis zu anderen Einträgen:** ergänzt N4.
- **Umsetzung:** Nr. 73 (freigabe.md §15).
- **Bestätigt (uttoranger, Freigabe Lauf 12, 13.10.2026):** Kennung N7 statt D3 aus der Freigabe Lauf 11 bestätigt.
- **Ergänzung (uttoranger, Freigabe Lauf 13, 13.10.2026):** Web-Vorschau bleibt 1 408 px, DESIGN_SYSTEM nennt 1 408. Quelle: Morgenbericht 12 §10, zu Nr. 75; Umsetzung Nr. 85.

### N8 · Wortliste (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 12):** Für jede Sache gibt es in Nutzertexten genau ein Wort; die Liste steht in docs/ai/DESIGN_SYSTEM.md und ein Test schützt sie. Erste Einträge: **Abholzeiten** = die Zeiten, die der Hof anbietet; **Abholtermin** = der Termin, den die Kundin gewählt hat; nicht: Zeitfenster, Abholslot. **Vorrat**; nicht: Bestand, Lagerstand, Lager (Code-Bezeichner wie `stock` bleiben). **Beitrag**; nicht: Status, Post, Neuigkeit als Objekt (Route /status bleibt, Register 22e). **Problem melden** als Türname auf beiden Seiten; „Meine Meldungen" bleibt die Übersicht des Hofs; nicht: Hilfe und Rückmeldung, Fehler melden. **Kundin/Kunden**: Beschriftungen, Reiter, Kennzahlen „Kunden" (z. B. „Kunden", „12 Kunden"); ganze Sätze „die Kundin"/„deine Kundinnen" (gewachsener Hausstil); „Käufer" nur für die Futter-Käuferarten (Betrieb/privat). **Telefonnummern** werden einheitlich angezeigt: „+43 660 000 0000" (Ländercode, Leerzeichen nach Vorwahl und in Dreier-/Vierergruppen), gespeichert bleibt die Eingabe. Jeder weitere Eintrag kommt nur über eine Freigabe.
- **Verhältnis zu anderen Einträgen:** ergänzt CLAUDE.md §5 (Sprache) und E11 (Brennmaterial).
- **Umsetzung:** Nr. 77 (Liste und Test), Nr. 78 (Begriffe), Nr. 81 (Telefonnummern); freigabe.md §16.
- **Bestätigt (uttoranger, Freigabe Lauf 13, 13.10.2026):** Entscheidungen des Dirigenten aus Lauf 12 (Morgenbericht 12 §7): Nr. 81 – zwei Sollte zu Blockern hochgestuft; das Kundendetail nutzt `whatsAppLink` aus Nr. 75 (gestapelt), ohne die Datei zu ändern. Nr. 78 – in Dateien anderer Nummern nur die genannten Zeilen (Tipp-Liste Z. 124, `product-grid.tsx` Z. 420/442).
- **Ergänzung (uttoranger, Freigabe Lauf 13, 13.10.2026):** Land DE: führende 0 bleibt +43 (Standard Österreich), keine +49-Vermutung. „Neuigkeiten" (Mehrzahl, Name der Anmeldung), „Hof-Seite", „Dashboard" in Mails, „Plattformgebühr", „Abholfenster" bleiben offen; keine Änderung in diesem Lauf. Quelle: Morgenbericht 12 §10, zu Nr. 77, 78 und 81; Umsetzung Nr. 85.

### N9 · Leerzustände (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 12):** Jeder Leerzustand einer Liste oder Karte entsteht aus EmptyState (Symbol, ein Satz, nächste Aktion); kleine Zeilen in Karten („Alles erledigt.") sind erlaubt, wenn sie eine einzelne Zeile bleiben und keine Aktion brauchen. Text je Seite aus einer Quelle in src/lib; kein Zustand hat zwei Fassungen.
- **Verhältnis zu anderen Einträgen:** ergänzt DESIGN_SYSTEM, Abschnitt „Zustände".
- **Umsetzung:** Nr. 80 (freigabe.md §16).
- **Bestätigt (uttoranger, Freigabe Lauf 13, 13.10.2026):** Entscheidungen des Dirigenten aus Lauf 12 (Morgenbericht 12 §7): Nr. 80 – ein Sollte zum Blocker hochgestuft; neue Variante `titelStufe` am EmptyState (die Freigabe erlaubt eine Variante, wo nötig). Runde 1 von Nr. 80 ist in den Branch von Nr. 83 zusammengeführt (e813eb7; Konflikt nur in DESIGN_SYSTEM „Leerzustände").

### N10 · Kasse glätten (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 12):** vier flache Karten in Lesereihenfolge Korb → Abholung (eine Zeile Chips, Adresse rechts im Kopf) → Deine Daten (ab md zwei Spalten: E-Mail · Name / Telefon · Notiz, Notiz einzeilig und wächst) → Bezahlen (Optionen ab md nebeneinander, jede mit eigener Erklärung). **Online bleibt vorbelegt**, auch im Testbetrieb (Entscheidung uttoranger 13.10.: Die Plattform verdient nur an Online-Zahlungen); der Testbetrieb-Satz steht an der Online-Option. Bar trägt seinen Vorteil selbst („Ohne Servicegebühr bis 31. Jänner 2027. Du bestätigst per E-Mail – ein Tipp genügt."); der Stripe-Satz nur bei Online (wie heute). „Ein Korb pro Hof" entfällt in der Kasse. Übersicht: „Servicegebühr (5 %)" mit (i)-Knopf, der den Erklärsatz und „mind. € 0,50" aufklappt; bei Bar ohne Gebühr steht „entfällt" statt € 0,00. Angaben zum Hof, Kaufknopf und Knopftexte bleiben (Nr. 60, N2). Abweichung von k3-kasse-angaben-zum-hof genehmigt.
- **Verhältnis zu anderen Einträgen:** ergänzt N2 (Kasse ohne Zusatz-Haken), Z2 und B1; ersetzt die Anordnung aus `web-/mobil-k3-kasse-angaben-zum-hof` (Nr. 60), die Angaben zum Hof bleiben.
- **Umsetzung:** Nr. 82 (freigabe.md §16); Mockups `web-k3-kasse-glatt`, `mobil-k3-kasse-glatt`, `system-k3-kasse-bezahlen-bar` (docs/mockups/README.md).
- **Bestätigt (uttoranger, Freigabe Lauf 13, 13.10.2026):** Entscheidung des Dirigenten aus Lauf 12 (Morgenbericht 12 §7): Nr. 82 – Grenzerweiterung `tests/bargebuehr.test.ts` (ein `it` mit dem alten Bar-Text).
- **Ergänzung (uttoranger, Freigabe Lauf 13, 13.10.2026):** TESTBETRIEB_TEXT.kasse auf den Mockup-Satz kürzen (ohne „Bitte wähle Bar"); Bar-Zeilen („entfällt", „bar am Hof") nur, wenn Bar angeboten wird; „Du bestätigst per E-Mail – ein Tipp genügt." → „Du bestätigst per E-Mail." Quelle: Morgenbericht 12 §10, zu Nr. 82; Umsetzung Nr. 85.

### N11 · Heute (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 12):** Hauptspalte Packliste → Braucht dich → Teilen (dringend vor freiwillig); leeres „Braucht dich" ist eine Zeile „Nichts braucht dich heute." statt einer Karte. Kein Mockup; die Bilder im Bericht sind die Vorlage.
- **Umsetzung:** Nr. 83 (freigabe.md §16; kein Mockup, die Bilder im Bericht sind die Vorlage).
- **Bestätigt (uttoranger, Freigabe Lauf 13, 13.10.2026):** Entscheidungen des Dirigenten aus Lauf 12 (Morgenbericht 12 §7): Nr. 83 – Runde 1 von Nr. 80 hereingeholt (e813eb7); eine Kommentarzeile an `brauchtDich` außerhalb von `heuteAufbau`.
- **Ergänzung (uttoranger, Freigabe Lauf 13, 13.10.2026):** „Nichts braucht dich heute." nur, wenn Packliste UND Braucht dich leer sind. Quelle: Morgenbericht 12 §10, zu Nr. 83; Umsetzung Nr. 85.
- **Ergänzung (uttoranger, im Chat, 21.10.2026; Nr. 134):** „Steht in Heute der Anstoß für einen Beitrag (E12), entfällt in ‚Braucht dich‘ die Erinnerung an einen Beitrag. Es gibt nie zwei Erinnerungen an dieselbe Sache.“

### N12 · Postfach, Stufe 1 (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 13):** ein Wort für alles, was ankommt – bei Hof und Admin. Das Team schreibt Höfen Nachrichten (Rundschreiben an alle, ausgewählte oder nach Filter: ohne Online-Zahlung, Futter ohne Nummer; auch an einen einzelnen Hof); jede Nachricht ist ein eigener Faden, auf den der Hof antwortet; das Team antwortet im selben Faden. Höfe beginnen keine Fäden – ein Problem, Wunsch oder eine Frage geht wie bisher über „Problem melden" (Meldung); so gibt es für jede Sache einen Weg. Art Info/Wichtig; Link nur relativ oder auf die Produktionsdomain (aus PRODUKTION_HOST, ab 91 agrilo.at); E-Mail an den Hof nur mit Haken „Betriebsmitteilung" (betrifft den Betrieb des Hofs; Werbung für Dritte nie) und bei einer Antwort des Teams höchstens eine je Faden und Stunde. Hof: Hauptpunkt „Postfach" nach „Bestellungen" (Seitenleiste; am Handy ganz oben im Mehr-Blatt) mit Zähler ungelesen; auf Heute steht eine ungelesene Nachricht **ganz oben in der Hauptspalte lesbar** (Titel, Text, Link, „Antworten", „Gelesen"; bei mehreren die neueste, darunter „n weitere im Postfach"). Admin: /admin/postfach mit Reitern Unterhaltungen (Antworten der Höfe) · Meldungen (der bisherige „Briefkasten", Logik unverändert, /admin/meldungen leitet um) · Rundschreiben (Gesendet mit Lesequote, Neues Rundschreiben). Kein Echtzeit-Kanal: Laden beim Öffnen, offener Faden alle 60 s nachladen (router.refresh). Rate-Limit je Hof und Tag: 30 Nachrichten. Wortliste: Postfach, Nachricht, Rundschreiben, Unterhaltung, Meldung; „Briefkasten" entfällt. Aufbewahrung: Nachrichten vom Team bleiben, solange das Hofkonto besteht (Betriebsmitteilungen, Abrechnung); mit dem Hof werden sie gelöscht (Cascade). Mockups: mobil-h6-postfach, mobil-h6-unterhaltung, mobil-h3-heute-post-karte, admin-postfach, admin-rundschreiben, system-h0-navigation-postfach.
- **Verhältnis zu anderen Einträgen:** ergänzt N1 (Handy-Navigation: Mehr-Blatt), N9 (Leerzustand ohne Aktion, begründet), N11 (Heute: Block ganz oben in der Hauptspalte) und 22e/Briefkasten (F6); die Wortliste N8 ist um fünf Zeilen ergänzt (DESIGN_SYSTEM „Wortliste").
- **Umsetzung:** Nr. 86 (Wort) und Nr. 87 (Bau); freigabe.md §17.
- **Änderung (uttoranger, im Chat, 15.10.2026; Nr. 95):** Admin-Postfach: Reiter Eingang · Rundschreiben · Zustellung statt Unterhaltungen · Meldungen · Rundschreiben. Der Eingang ist eine Liste aller drei Arten (Antwort, Meldung, Aufgabe) mit Filterchips Offen · Antwort · Meldung · Aufgabe · Alle, links die Liste (480 px), rechts die Arbeit (Faden mit Antwortfeld; Meldung mit Entscheiden; Aufgabe mit Freischalten/Ablehnen bzw. Sprung zur Bestellung). /admin/meldungen/[id] leitet auf /admin/postfach?meldung=<id> um. Die Meldungs-Logik (Status, Bündel, Sprint, Antwort an den Melder, `Behebt Meldung:`) bleibt unverändert. Höfe beginnen weiterhin keine Fäden; 30 Antworten je Hof und Tag bleiben.
- **Verhältnis zu anderen Einträgen (Änderung):** ersetzt die Reiter Unterhaltungen · Meldungen · Rundschreiben aus der Entscheidung oben; ergänzt durch N14 (Aufgaben, Zustellung, „Antwort möglich“) und N15 (Seitenmuster).
- **Umsetzung (Änderung):** Nr. 95 (freigabe.md §18); Mockups `admin-postfach`, `admin-postfach-unterhaltungen`, `admin-postfach-meldungen`, `admin-rundschreiben`, `admin-postfach-zustellung`, `system-postfach-prozess` (docs/mockups/README.md).

### N13 · Titelbild am Computer (13.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 13):** Die Fläche wird mit der Breite höher – 220 px am Handy, 300 px ab 768, 360 px ab 1 280, 420 px ab 1 536 – und wird ab 1 920 px nicht weiter aufgezogen (Foto und Fläche rechnen mit höchstens 1 920 px Breite, der Rest ist Hintergrund aus derselben unscharfen Kopie). Ab 768 px steht ein Foto ganz (volle Höhe, mittig, dahinter die unscharfe, abgedunkelte Kopie), sobald breite/hoehe < 1,5 – Quadrat, Hochformat und 4:3; nur Querformate ab 3:2 füllen die Fläche mit Fokuspunkt (wie heute). Der Wechsel von beschnitt nach ganz nach dem Laden blendet weich über (kein Sprung). Die Maße beim Hochladen zu speichern (Migration) bleibt offen; damit könnte der Server später sofort richtig rendern.
- **Verhältnis zu anderen Einträgen:** ergänzt N6 (Titelbild im Hochformat) und N7 (Mein Hof am breiten Bildschirm).
- **Umsetzung:** Nr. 89 (freigabe.md §17); Mockup `system-k2-titelbild-computer` (docs/mockups/README.md).
- **Ergänzung Titelbild-Ausschnitt (uttoranger, im Chat, 15.10.2026; Nr. 97):** „Der Hof wählt, ob sein Foto am Computer die Fläche füllt oder ganz steht (Default: die bisherige Regel nach Seitenverhältnis). Der Ausschnitt ist ein Fokuspunkt waagrecht und senkrecht plus Zoom (100–250 %), gewählt durch Ziehen im Rahmen; EIN Fokus für Computer und Handy. Fokus, Zoom und Filter wirken am Computer und am Handy gleich; die Wahl füllen/ganz gilt nur am Computer, am Handy füllt das Foto immer, weil Hofname und Schleier darauf stehen. Umsetzung Nr. 97.“

### N14 · Postfach, Stufe 2: Eingang, Aufgaben, Zustellung (15.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 14):** **Aufgaben** sind keine Datensätze, sondern Ableitungen: wartende Höfe (approved false) und Bestellungen mit offener Erstattung (neue Spalte Order.erstattungOffenSeit DateTime?, gesetzt, wenn die Stripe-Erstattung beim Storno scheitert; gelöscht, sobald erstattet). Der Zähler am Reiter Postfach = ungelesene Antworten + Meldungen NEU/GEPRUEFT + offene Aufgaben. **Zustellung** = Reiter im Postfach: Empfängerliste (support@PRODUKTION_HOST fest; weitere Adressen beliebig, aber nur nach Double-Opt-in; jederzeit entfernbar; nur Admin) und Regel je Art (Fehlermeldung sofort · Neuer Hof wartet sofort · Erstattung offen sofort, nicht abschaltbar · Antwort eines Hofs sofort oder nur Zähler · Wünsche und Fragen nur im Eingang · Wochenbericht montags 7 Uhr, nur wenn etwas offen ist). Alle Betreiber-Mails gehen an die Liste statt fest an SUPPORT_EMAIL. **Rundschreiben** bekommt den Haken „Antwort möglich“ (neue Spalte Rundschreiben.antwortMoeglich Boolean @default(true)); Standard beim Verfassen: Wichtig → an, Info → aus, jeweils änderbar; ist er aus, zeigt der Hof statt des Antwortfelds „Auf diese Nachricht kannst du nicht antworten. Hast du eine Frage dazu? Dann ‚Problem melden‘.“ und antworteAlsHof lehnt ab. Hof › Einstellungen › Benachrichtigungen (Bestell-Mails) bleibt unverändert – sie betreffen Bestellungen, nicht das Postfach.
- **Verhältnis zu anderen Einträgen:** baut auf N12 (Änderung vom 15.10.2026: Reiter Eingang · Rundschreiben · Zustellung) auf; die Bestätigung weiterer Adressen folgt dem Double-Opt-in-Muster aus S11 (Nr. 38), das Hinzufügen bremst das Rate-Limit nach R1, Mails gehen nur über die bestehende Post-Sperre (Z3). Wortliste N8 um „Eingang“, „Aufgabe“ und „Zustellung“ ergänzt (DESIGN_SYSTEM „Wortliste“).
- **Umsetzung:** Nr. 95 (freigabe.md §18; eine Migration, Expand: Rundschreiben.antwortMoeglich, Order.erstattungOffenSeit, BetreiberEmpfaenger; die Zustellregeln liegen als Json in PlattformEinstellung.zustellRegeln aus Nr. 93).
- **Ergänzung Meldungen (uttoranger, im Chat, 15.10.2026; Nr. 101):** „Das Postfach bekommt den Reiter ‚Meldungen‘ (Eingang · Meldungen · Rundschreiben · Zustellung; nur der Eingang trägt eine Zahl). Oben steht ein Stand-Band über alle Meldungen: Braucht dich (Neu, KI-Vorschlag) · In Arbeit (Geplant) · Erledigt (90 Tage, danach gelöscht) · Gesammelt (Wünsche, noch nicht geplant) · Abgelegt (kein Fehler, nicht geplant). Gezählt werden Meldungen, nicht Karten. Der Ablauf zeigt Neu, KI-Vorschlag, Geplant und Erledigt als Spalten, Gesammelt und Abgelegt zugeklappt. Zwei Meldungen zur selben Sache werden zusammengefasst (Hauptmeldung + Duplikat); ein Duplikat zählt als Stimme, bekommt den Stand seiner Hauptmeldung zu sehen und wird erst mit ihr gelöscht. Stimmen eines Bündels = verschiedene Höfe und Kundinnen. Die KI sortiert nur vor; jeder Klick lässt sich rückgängig machen; entscheiden, antworten, Status setzen und bauen tut der Mensch.“
- **Ergänzung ruhiges Postfach (uttoranger, im Chat, 16.10.2026; Nr. 105):** „Kopf und Reiter des Postfachs stehen auf allen vier Reitern an derselben Stelle (ein Satz für alle; die Kennzahlen gehören zum Eingang und stehen unter den Reitern). Ein Wechsel von Reiter, Filter oder Eintrag zeigt kein Ladebild und scrollt nicht. Die Aufgabe ‚Erstattung offen‘ schließt der Admin mit ‚Erstattung erledigt‘, wenn er im Stripe-Dashboard erstattet hat. Die Mail ‚Ein Hof hat geantwortet‘ geht höchstens einmal je Faden und voller Stunde.“

### N15 · Admin-Seitenmuster und Reiter (15.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 14):** Reiter Höfe · Postfach · Startseite · Finanzen · Einstellungen; jede Admin-Seite folgt dem Muster (Seitenkopf mit Satz · Kennzahlen · Unterreiter · Inhalt · Regel-Zeile). Höfe: Kennzahlen Warten · Online · Pausiert · Ohne Zahlung · Gründungsplätze frei; Unterreiter Warten auf Freischaltung · Alle Höfe · Gründungshöfe; Warteliste zeigt „bekäme Gründungsplatz Nr. k“ (nur mit Stripe) bzw. „Gründungsplatz erst mit Freischaltung“; Tabelle mit Spalte Gründungshof („Nr. 3 · bis 30.06.2027 abweichend“ / „kein Gründungshof“). Finanzen: Monat im Seitenkopf, Kennzahlen mit „Grundgebühren 0 € · Startphase · n Gründungshöfe“, Unterreiter Monat · Kosten · Auszahlungen · Entfallene Gebühren (Inhalt wie heute, nur neu geordnet; keine neuen Zahlen). Einstellungen: Gruppen Gründungshöfe · Betrieb · Plattform (links), jede Gruppe mit eigenem Speichern und Protokollzeile „zuletzt geändert von … am …“ (Protokoll = letzte Änderung je Gruppe, kein Admin-Protokoll S12). Betriebsleiste zeigt nur den Stripe-Modus (Z3-Korrektur). Admin am Handy: Reiter als scrollbare Zeile, Kennzahlen zu dritt, Einstellungen als aufklappbare Liste.
- **Verhältnis zu anderen Einträgen:** ergänzt die Admin-Beschreibung in DESIGN_SYSTEM (neuer Abschnitt „Admin-Seitenmuster“); die Kachel-Töne kommen aus G5, die Gründungsplätze aus K2, die Betriebsleiste folgt der Z3-Korrektur; das Admin-Protokoll S12 bleibt offen.
- **Umsetzung:** Nr. 94 (freigabe.md §18; Höfe, Finanzen, Bausteine Seitenkopf, Kennzahlen, Unterreiter); die Einstellungen-Seite baut Nr. 93, Postfach Nr. 95, Startseite Nr. 96. Mockups `admin-hoefe-und-freischaltung`, `admin-finanzen`, `admin-einstellungen`, `admin-mobil-unterwegs-freischalten`, `admin-mobil-einstellungen` (docs/mockups/README.md).
- **Ergänzung Finanzen (uttoranger, im Chat, 15.10.2026; Nr. 100):** „Admin › Finanzen zeigt wahlweise einen Monat oder ein Jahr (Umschalter Monat | Jahr, Blättern je Jahr). Das Jahr ist die Summe seiner Monate (Wiener Zeit) aus denselben Funktionen wie der Monat – keine zweite Rechnung. Das laufende Jahr zählt bis heute; eine Hochrechnung bis Jahresende steht nur als Hinweis. Testzahlungen zählen nicht (Z4).“
- **Änderung Reiter Betrieb (uttoranger, im Chat, 16.10.2026; Nr. 103):** „Reiter Höfe · Postfach · Startseite · Finanzen · Betrieb · Einstellungen. Der Reiter Betrieb trägt einen Punkt, solange eine Warnung offen ist; die Betriebsleiste nennt sie rechts mit Link. Die Gruppe ‚Betrieb‘ in Einstellungen entfällt, der Stripe-Modus steht in Admin › Betrieb.“

### N16 · Startseite gestalten (15.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 14):** Lauf-13-Vormerkung „Startseite als Abschnittsliste“ (claude/lauf13-vormerkung.md), jetzt freigegeben: Tabellen StartseiteAbschnitt { id, art KOPF|HOEFE|FUTTER|BRENNMATERIAL|SO_FUNKTIONIERTS|FUER_HOEFE|FRAGEN|FUSS|BLOCK, position Int, sichtbar Boolean, blockId? } und StartseiteBlock { id, vorlage SAISONKARTE|HINWEISBAND|HOEFE_AUSWAHL|KATEGORIE_HINWEIS, ueberzeile? ≤ 24, titel ≤ 60, text? ≤ 160, bildUrl?, linkUrl? (nur relativ), linkText?, farmIds String[] @default([]), kategorie?, liveAb DateTime, liveBis DateTime?, erstelltVonUserId, createdAt, updatedAt }; Seed-Migration mit der heutigen Reihenfolge; KOPF, HOEFE, FUSS fest (immer sichtbar, nicht über/unter KOPF/FUSS); BRENNMATERIAL behält die Saison-Automatik zusätzlich zum Auge; page.tsx liest die Liste (eine Abfrage, revalidate 300 bleibt) und rendert je art die bestehende Komponente, Blöcke nur im Zeitraum (Wiener Zeit, Vergleich nur am Server). Admin › Startseite: Abschnittsliste (Griff = Reihenfolge, Auge = aus/ein), „Block einfügen“ zwischen Abschnitten, Block-Formular mit Vorlage, Zeitraum und Vorschau-Kachel, Vorlagen-Bibliothek (vier Komponenten, neue nur über einen Lauf), Umschalter „Bearbeiten · So sieht’s die Kundin“ (Handy 304 px / Web 1 408 px wie Mein Hof, „Stand am“ Heute · +1 Woche · nächster Block; rendert die echte Startseite mit den Blöcken des Tages plus dem Block in Bearbeitung); „Vorschau öffnen“ = signierter Link `/?vorschau=<token>` (nur Admin-Sitzung, 1 h, no-store). Bild über den bestehenden Upload-Weg mit neuem Zweck 'startseite' (1:1, ≥ 320 px) – Admin-Sitzung statt Hof-Sitzung an dieser einen Stelle. Speichern = eine Transaktion, Zod über alles, nur Admin (verlangeAdminAktion).
- **Verhältnis zu anderen Einträgen:** gehört zum Reiter Startseite aus N15; die Vorschau folgt den Maßen der Vorschau in Mein Hof (Handy 304 px / Web 1 408 px, N7); die Saison-Automatik des Brennmaterial-Bandes (gebaut mit Nr. 07, `istBrennmaterialSaison`; siehe DEVELOPMENT.md) bleibt. Das in Lauf 13 geparkte „Startseite gestalten“ ist damit freigegeben.
- **Umsetzung:** Nr. 96 (freigabe.md §18; eine Migration mit Seed, Expand; gestapelt auf Nr. 95; wird sie nicht begonnen, geht sie in Lauf 15). Mockups `admin-startseite-gestalten`, `admin-startseite-vorschau`, `mobil-k0-startseite-saisonblock` (docs/mockups/README.md).
- **Änderung (uttoranger, im Chat, 15.10.2026; Nr. 99):** „Admin › Startseite arbeitet in einem Entwurf. Jede Änderung (Reihenfolge, Auge, Block) wird automatisch im Entwurf gespeichert und ändert die öffentliche Startseite nicht. Die Vorschau ‚So sieht’s die Kundin‘ zeigt wahlweise den Entwurf oder die Live-Fassung, an einem gewählten Tag. ‚Veröffentlichen …‘ macht aus dem Entwurf eine unveränderliche Fassung – jetzt oder zu Datum und Uhrzeit (Wiener Zeit). Live ist immer die jüngste nicht zurückgezogene Fassung, deren Zeit erreicht ist; mehrere Planungen sind möglich. Blöcke behalten ihren eigenen Zeitraum zusätzlich. Eine geplante Fassung lässt sich bis zu ihrer Zeit zurückziehen; jede frühere Fassung lässt sich ‚als Entwurf übernehmen‘. Ohne Fassung zeigt die Startseite die Standard-Reihenfolge. Die Umstellung braucht bis zu 5 Minuten (revalidate 300 bleibt). Wer wann veröffentlicht hat, steht in der Fassung.“
- **Ergänzung Vorschau lädt neu (uttoranger, im Chat, 16.10.2026; Nr. 106):** „Die Vorschau ‚So sieht’s die Kundin‘ lädt nach jedem gespeicherten Entwurf neu, behält dabei ihre Scroll-Position und sagt ‚Vorschau aktualisiert · hh:mm‘.“
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 129):** „Neuer Abschnitt der Startseite ‚Neu bei den Höfen‘ (Art `NEUIGKEITEN`, Migration `20261021110000_startseite_neuigkeiten`): die neuesten aktiven Beiträge sichtbarer, nicht pausierter Höfe aus den letzten 14 Tagen, höchstens einer je Hof und sechs insgesamt, nach Zeit. Er ist ein zusätzlicher Abschnitt: Admin fügt ihn in Admin › Startseite hinzu (Entwurf, Vorschau, Veröffentlichen); bestehende Fassungen bleiben ohne ihn gültig.“

### N17 · Bild-Baustein für alle Fotos (15.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 15):** „Wo ein Hof ein Foto hochlädt (Titelbild, Logo, Produktfoto, Galerie, Beitragsfoto), kann er danach Ausschnitt (Fokus + Zoom) und Filter wählen und sieht vorher live, wie das Foto in jeder Größe aussieht – am Handy und am Computer gleichwertig: am Computer in der Zeile, am Handy im Blatt, mit Vorschau ‚So sieht es im Browser aus‘ und ‚So sieht es am Handy aus‘. Sechs feste Filter nur als CSS (Natürlich, Klar, Warm, Kräftig, Sanft, Schwarzweiß); gespeichert wird nur der Name. Das Logo bekommt keinen Filter. Kein Ausschnitt und kein Filter beim Screenshot unter ‚Problem melden‘. Keine zweite Bilddatei, keine Verarbeitung am Server; Teilen-Vorschaubild, Warenkorb, Kasse und E-Mails zeigen das Rohfoto. Umsetzung Nr. 97 (Baustein, Titelbild, Schema) und Nr. 98 (Logo, Produktfoto, Galerie, Beitragsfoto).“
- **Verhältnis zu anderen Einträgen:** ergänzt N13 (Ergänzung Titelbild-Ausschnitt vom 15.10.2026: Fokus, Zoom, füllen/ganz); die Bild-Overlays bleiben theme-fest (DESIGN_SYSTEM); Wortliste N8 um „Ausschnitt“, „Filter“ und „Vorschau“ ergänzt.
- **Umsetzung:** Nr. 97 (freigabe.md §19; Baustein, Titelbild, eine Migration, Expand: fünf Json-Spalten) und Nr. 98 (Logo, Produktfoto, Galerie, Beitragsfoto; keine Migration). Mockups `system-h1-bild-baustein`, `system-h1-titelbild-filter`, `web-h1-titelbild-ausschnitt`, `mobil-h1-titelbild-ausschnitt`, `mobil-h2-produktfoto-ausschnitt` (docs/mockups/README.md).
- **Ergänzung ersetzte Fotos (uttoranger, im Chat, 16.10.2026; Nr. 108):** „Ein ersetztes Foto wird beim Hochladen nicht mehr gelöscht, sondern bleibt als ‚Bild ohne Verwendung‘ liegen, bis es nach Durchsicht entfernt wird (N18). So zeigt kein Produkt und keine Hofseite je ein gelöschtes Bild, auch wenn das Speichern danach scheitert.“

### N18 · Betrieb (16.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 16):** „Admin › Betrieb zeigt, jeden Morgen gemessen: Bilder-Speicher, Datenbank, E-Mails des Tages und des Monats und Bild-Vorgänge des Monats, je gegen die Grenze des Tarifs (die Grenzen stehen an einer Stelle im Code), den Verlauf von 90 Tagen, die Abläufe mit ihrem letzten Lauf (Herzschlag) und die größten Tabellen. Ab 80 %, ab 95 % und bei voll sowie bei einem überfälligen oder gescheiterten Ablauf geht eine Warn-Mail an die Empfänger aus Postfach › Zustellung (Art ‚Betrieb‘, nicht abschaltbar), einmal je Stufe: bei Speicher (Bilder, Datenbank) mit Entwarnung unter 75 %, bei Monatswerten (E-Mails, Bild-Vorgänge) ohne Entwarnung (der neue Monat beginnt still bei 0); für E-Mails je Tag (Resend zählt den Tag ab 0 Uhr UTC) kommt am Morgen ein Hinweis, wenn der Vortag 80 % erreicht hat. Nur in der Produktion; ein Ablauf ohne bisherigen Lauf gilt als „noch kein Lauf“, nicht als überfällig. Gespeichert wird je Tag und Wert eine Zahl, 400 Tage lang; keine Personendaten. Bilder ohne Verwendung werden nur gelistet (älter als 7 Tage, nur in der Produktion, nur Höfe dieser Datenbank); gelöscht wird erst nach Durchsicht, mit eigener Freigabe. Täglich aufgeräumt werden abgelaufene Sitzungen (7 Tage nach Ablauf), abgelaufene Codes (1 Tag nach Ablauf), Webhook-Ereignisse (nach 30 Tagen, ohne die Melde-Vermerke, die doppelte Mails verhindern) und Messungen (nach 400 Tagen); Bestellungen nie.“
- **Verhältnis zu anderen Einträgen:** ändert N15 (Reiter Betrieb, Gruppe ‚Betrieb‘ in Einstellungen entfällt); ergänzt N14 (Zustellung: Art ‚Betrieb‘, fest an) und N17 (ersetzte Fotos bleiben als Bilder ohne Verwendung liegen); Wortliste N8 um „Betrieb“, „Grenze“, „Ablauf“ und „Bilder ohne Verwendung“ ergänzt.
- **Umsetzung:** Nr. 103 (freigabe.md §20; Admin › Betrieb, Messen, Herzschlag, Warn-Mail; eine Migration, Expand: drei neue Tabellen) und Nr. 104 (Aufräumen, Bilder ohne Verwendung; keine Migration). Mockups `admin-betrieb`, `mobil-admin-betrieb`, `email-betrieb-warnung` (docs/mockups/README.md).

### N19 · Entdecken statisch (19.10.2026)
- **Entscheidung (uttoranger, im Chat, 19.10.2026):** „/hoefe wird statisch mit Neubau alle fünf Minuten, wie die Startseite. Die Filter liest der Browser aus der Adresse. Ein geteilter Filter-Link zeigt kurz die ungefilterte Liste und dann die gefilterte. Filter-Links auf /hoefe tragen nofollow, robots.txt sperrt /hoefe mit Parametern und die privaten Bereiche, die Seite nennt /hoefe als Canonical.“
- **Verhältnis zu anderen Einträgen:** ändert die Festlegung zu /hoefe in ARCHITECTURE.md (Nr. 09: „bleibt force-dynamic wegen der Filter im Server-HTML“); ergänzt docs/konzepte/bereiche.md (§6.2): Die Filter bleiben teilbar und reload-fest. Anlass und Zahlen: DEVELOPMENT.md, „Filter-Falle auf /hoefe“.
- **Umsetzung:** /fix „Filter-Falle auf /hoefe schließen“ (Branch `fix/hoefe-filter-falle`; keine Migration, kein neues Paket).
- **Ergänzung (uttoranger, im Chat, 21.10.2026; Nr. 131):** „Die Hofliste kennt volle Abholfenster, und mit ihr /hoefe (Liste, Karussell, Karte am Pin), die Startseite (‚Höfe in deiner Nähe‘) und Region › Futter kaufen; ebenso ‚Nächste Abholung‘ auf Hof- und Produktseite. Für jeden Hof stehen im Zwischenspeicher die ausgebuchten Tage je Fenster im Vorlauf. Ausgebucht heißt: `maxOrders` ist erreicht, gezählt wie in der Kasse, also jede nicht stornierte Bestellung. Abholzeile, ‚Nächste Abholung‘ und Filter ‚Abholung‘ überspringen diese Termine. Wird eine Bestellung angelegt oder storniert und hat der Hof eine aktive Abholzeit mit Höchstzahl, wird der Zwischenspeicher sofort erneuert. Sonst altert er wie bisher höchstens fünf Minuten. Weil das Erneuern in Route, Cron, Action und beim Rendern einer Seite gleich läuft, nimmt es `revalidateTag(tag, { expire: 0 })` nach der Antwort (`nachDerAntwort`) statt `updateTag`. Verbindlich bleibt die Prüfung der Kasse.“

### N20 · Admin nur mit Passkey (19.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 17):** „Ein Konto mit Admin-Recht meldet sich nur mit Passkey an – auf der Seite /login/admin mit dem Knopf ‚Mit Passkey anmelden‘; den QR-Code fürs Handy zeigt der Browser, nicht Agrilo – oder mit einem von 10 Ersatzcodes. Sobald das Konto einen Passkey hat, sind Passwort, ‚Passwort vergessen‘ und Code per E-Mail für dieses Konto gesperrt, auch für seinen Hof; die Antworten bleiben neutral. Den ersten Passkey richtet es nur nach Anmeldung mit Passwort UND frischem Code per E-Mail ein, und nur innerhalb von 24 Stunden, nachdem das Recht vergeben wurde (`adminSeit`, gesetzt per SQL wie `isAdmin`); nach einer Anmeldung mit Ersatzcode darf es innerhalb von 15 Minuten genau einen neuen Passkey anlegen. Ohne Passkey bleibt der Admin-Bereich zu (Pflichtseite), der Hof bleibt erreichbar. Admin-Sitzungen enden nach 12 Stunden, ohne ‚Gerät merken‘; heikle Aktionen verlangen eine frische Bestätigung mit Passkey, die 5 Minuten gilt. Passkey hinzufügen und entfernen geht nur frisch bestätigt; der letzte Passkey lässt sich nicht entfernen. Passkey hinzugefügt, Passkey entfernt und ein benutzter Ersatzcode lösen eine Mail an das Konto aus; nach einem Ersatzcode ist ein neuer Passkey Pflicht, bevor der Admin-Bereich wieder aufgeht. Ersatzcodes werden nur gehasht gespeichert und nur beim Erstellen gezeigt. Für Höfe gibt es in Lauf 17 keine Passkeys.“
- **Verhältnis zu anderen Einträgen:** ergänzt E7 (Ergänzung 19.10.2026: Angemeldete Geräte und die Mail „Neue Anmeldung“ gelten auch für Admin-Konten); Wortliste N8 um „Passkey“, „Ersatzcode“ und „Angemeldete Geräte“ ergänzt.
- **Umsetzung:** Nr. 115 (freigabe.md §21; eine Migration `20261019220000_admin_passkey`, Expand; ein neues Paket `@better-auth/passkey` 1.6.23). Mockup `system-admin-anmeldung-passkey` (docs/mockups/README.md).
- **Umsetzung (Lauf 18):** Nr. 115 lief in Lauf 17 nicht (Installation des Pakets gesperrt) und läuft neu in Lauf 18 (freigabe.md §22; Migration `20261020110000_admin_passkey`, Expand; das Paket kam vorher mit dem Paket-PR, G6).
- **Ergänzung (uttoranger, im Chat, 19.10.2026; Nr. 115 in Lauf 18):** „Die frische Bestätigung ist eine erneute Anmeldung mit Passkey; sie zählt nur, wenn der Passkey zum angemeldeten Konto gehört, und ersetzt dessen Sitzung. Ein Admin-Passkey verlangt Fingerabdruck, Gesicht oder PIN (Nutzerprüfung) beim Einrichten und bei jeder Anmeldung. Die Pflicht ‚erst Passkey, dann Admin-Bereich‘ prüft jede Admin-Seite selbst, nicht nur das Layout. Nach einem Ersatzcode ist genau ein neuer Passkey erlaubt. Migration `20261020110000_admin_passkey` (statt des nie angelegten Namens aus Lauf 17).“

### N21 · Testhof (19.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 18):** „Ein Hof kann im Admin als Testhof markiert werden. Ein Testhof erscheint in keiner Liste, Karte, Zählung oder Auswahl der Plattform – nicht auf /hoefe, nicht auf der Startseite, nicht in Region (Preise vergleichen, Futter kaufen), nicht in der Produktsuche und nicht in der Sitemap – und trägt noindex. Seine Hofseite bleibt per direktem Link erreichbar und zeigt oben ‚Testhof – nur zum Ausprobieren‘; Bestellen bleibt möglich. Ein Testhof ist immer auch aus der Gründung ausgenommen und bekommt nie einen Gründungsplatz und nie das Abzeichen; wird ein Hof mit Platz markiert, wird der Platz frei (Haken wie beim Ausnehmen). ‚Ausgenommen‘ heißt ab jetzt nur noch: zählt nicht für die Gründungsplätze – ein ausgenommener echter Hof ist normal sichtbar und wird indexiert. Ändert die Festlegung von Nr. 117 (noindex und Sitemap lesen das Testhof-Merkmal statt `gruendungAusgenommen`) und ergänzt K2.“
- **Verhältnis zu anderen Einträgen:** ändert die Festlegung von Nr. 117 (noindex und Sitemap lesen `istTesthof` statt `gruendungAusgenommen`); ergänzt K2 (Ergänzung Testhöfe ausnehmen, 16.10.2026); Wortliste N8 um „Testhof“.
- **Umsetzung:** Nr. 119 (freigabe.md §22; eine Migration `20261020100000_testhof`, Expand). Keine neuen Mockups (Marke wie die bestehenden Marken in Admin › Höfe).

### N22 · Entdecken v2 (19.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 18):** „Die Hofkarte auf /hoefe zeigt Foto oder Bildfläche, Name, Entfernung, Ort, die Abholzeile und bis zu drei Produkte mit Preis (Variante A des Boards system-k1-entdecken-v2); keine Kategorie-Chips in Hofkarte und Karussell, keine Initialen. Fehlt ein Foto, steht die Illustration der Kategorie (dieselbe Quelle wie im Teilen-Bild). Die Abholzeile nennt das nächste Abholfenster, das man noch bestellen kann (heute, morgen, Wochentag, Datum), bzw. die Pause – in Liste, Karussell und Karte gleich. Neuer Filter ‚Abholung‘: alle Tage, heute, morgen, Wochenende (Samstag und Sonntag) – im Browser, die Seite bleibt im Cache (N19). Höfe, die noch nicht bestellbar sind (kein kaufbares Produkt oder keine kommende Abholzeit), bleiben an ihrem Platz in der Reihenfolge und tragen die Zeile ‚Noch nicht bestellbar‘; eingeklappt werden sie erst, wenn AGB §3 das nennt (O4). Die Karte zeigt Namen an den Pins ab Zoom 12 oder bei höchstens 12 Pins im Bild und am Computer eine Vorschau beim Darüberfahren und mit Tab. Alle Seiten der Kundschaft tragen einen Seitenfuß mit Impressum, Datenschutz, AGB und ‚Problem melden‘ (das erfüllt ‚AGB-Link in jeder Fußzeile‘ aus O4); ausgenommen sind Kasse und Bestätigung (Fokus, dort steht der AGB-Satz unter dem Kaufknopf). Die Abholzeit auf /hoefe und auf der Startseite zählt nur Fenster, die man noch bestellen kann.“
- **Verhältnis zu anderen Einträgen:** baut auf N19 auf (Filter Abholung im Browser, die Seite bleibt im Cache); berührt O4 (Seitenfuß mit AGB-Link in jeder Fußzeile; „Noch nicht bestellbar“ eingeklappt erst nach einer Änderung von AGB §3); Wortliste N8 um „Seitenfuß“.
- **Umsetzung:** Nr. 120 (freigabe.md §22; keine Migration). Mockup `system-k1-entdecken-v2` (docs/mockups/README.md), freigegebene Abweichungen in freigabe.md §22.
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 127):** „Am Computer hat jede Seite der Kundschaft genau einen Fuß, den Seitenfuß. Der Fuß der Startseite erscheint nur noch am Handy; am Computer führen ‚Für Höfe‘ im Seitenfuß und ‚Anmelden‘ im Kopf zu Registrierung, Anmeldung und Konditionen.“
- **Ergänzung (uttoranger, im Chat, 20.10.2026; Nr. 129):** „Hat ein Hof einen aktiven Beitrag, der höchstens 7 Tage alt ist, trägt seine Hofkarte am Bild die Marke ‚Neu · vor …‘ – auf /hoefe und im Karussell der Startseite. ‚vor …‘ und das Ende rechnet der Browser; Veröffentlichen, Deaktivieren, Ablaufen-lassen und Löschen eines Beitrags erneuern den Zwischenspeicher von /hoefe (N19).“

### N23 · Region v2 (20.10.2026)
- **Entscheidung (uttoranger, im Chat, Freigabe Lauf 19):** „Region nutzt die Bausteine von /hoefe statt eigener Kopien: Hofkopf, Produktzeilen, Bild ohne Foto, die Karte mit Namen an den Pins (Regel von /hoefe) und die kurze Hofkarte am Pin, die in Region als Bereich mit ‚Schließen‘ aufgeht; ‚Futter kaufen‘ dazu die Abholzeile. Preise vergleichen: Die Karte am Pin zeigt die ersten zwei kaufbaren Produkte des Bereichs in der Reihenfolge der Hofseite statt des günstigsten Grundpreises; ab zwei Höfen mit verschiedenen Werten steht die Spanne zusätzlich als Streifen (je Hof ein Punkt ohne Namen, nicht antippbar; die Mitte als Strich; ‚Deins‘ als eigener Punkt) mit der Lage in Worten – unter der Spanne, unter der Mitte, nahe der Mitte (höchstens 3 % daneben), über der Mitte, über der Spanne; Eier werden je Stück verglichen; jede Stufe des Umkreises nennt die Zahl der Höfe; ‚So rechnen wir‘ erklärt die Rechnung. Futter kaufen: Liste | Karte, Filter Abholung (alle Tage, heute, morgen, Wochenende; in der Adresse, der Server rechnet), Größenwahl mit Gebinde- und Kilopreis und einem Knopf ‚Bestellen‘ für genau diese Größe, Abholhinweise als feste Auswahl je Produkt (Anhänger nötig, Verladen mit Frontlader, Abholung nach Absprache; Spalte `Product.abholhinweise`, Migration `20261021100000_abholhinweise`, nur Expand), ‚Selbst verkaufen‘ nur ohne eigenes Futter. Leitplanken: nur Daten, die auf den Hofseiten öffentlich stehen, nur sichtbare, nicht pausierte Höfe; keine Empfehlung, kein Zielpreis, kein ‚zu teuer‘, keine Preise an den Pins, keine Sortierung nach Preis, keine Historie, keine Benachrichtigung, kein Export. Ändert Konzept Umfeld §3, §4 und §6. Das Team empfiehlt, die Spanne vor dem Merge rechtlich prüfen zu lassen (Austausch von Preisen unter Mitbewerbern); die Projektleitung hat den Bau freigegeben.“
- **Verhältnis zu anderen Einträgen:** baut auf N22 auf (Bausteine von /hoefe, Karte mit Namen an den Pins); ändert Konzept Umfeld §3, §4 und §6 (docs/konzepte/umfeld.md, „Geändert in Lauf 19“); ergänzt E9 (Ergänzung 20.10.2026: Schild „laut Hof“); Wortliste N8 um „Abholhinweis“.
- **Umsetzung:** Nr. 122, 123 und 124 (freigabe.md §23; eine Migration `20261021100000_abholhinweise` in 123, Expand). Mockups `system-h5-region-v2` und `system-h5-region-eigene-teile` (docs/mockups/README.md), freigegebene Abweichungen in freigabe.md §23.
- **Änderung (uttoranger, im Chat, 21.10.2026):** „Eier je Stück ist zurückgestellt bis zum Pilot. `unitSize` ist bei der Einheit Paket die Zahl der Packungen, nicht die Stückzahl. Eine Regel ‚Preis ÷ unitSize‘ wäre deshalb falsch. Bis dahin zählen Eier in der Region wie alle anderen Stück- und Paketpreise: gezählt, nicht bepreist, mit Grund in der Zeile. Wieder aufgenommen wird es mit einem eigenen Feld ‚Stück je Packung‘ (Migration, eigene Freigabe), sobald echte Höfe Eier eintragen.“

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
| O4 | AGB / Nutzungsbedingungen | **Geändert 13.10.2026 (uttoranger, Freigabe Lauf 13):** AGB liegen als Entwurf in docs/recht/agb.md (Fassung 0.9, 13.10.2026); Seite /agb baut Nr. 90; Freigabe der Fassung 1.0 nach anwaltlicher Prüfung durch die Projektleitung; bis dahin trägt die Seite den Stand-Vermerk. Beim Registrieren und in der Kasse ein Satz mit Link, kein Haken. Der Entwurf docs/recht/agb.md ist die Quelle der AGB-Seite; Änderungen am Wortlaut nur durch die Projektleitung (nach anwaltlicher Prüfung), nie durch einen Lauf. Die Seite trägt bis zur Freigabe „Fassung 0.9 – Entwurf, Stand 13.10.2026". Einbeziehung: Registrierung mit dem Satz „Mit der Registrierung stimmst du den AGB und den Konditionen zu" (Links), Kasse unter dem Kaufknopf „Es gelten die AGB von Agrilo. Vertragspartner ist der Hof." (Link; Name aus MARKE) und die Zustimmung zur sofortigen Ausführung der Vermittlung („… und stimme zu, dass Agrilo die Vermittlung sofort ausführt") – ohne Haken. AGB-Link in jeder Fußzeile und in der Bestellbestätigungs-Mail. |
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

Stand Lauf 12 (uttoranger, 13.10.2026): N8, N9, N10, N11, G5 und T7 sind entschieden und in Nr. 76–83 eingeplant (freigabe.md §16); die Nacharbeit aus Lauf 11 ist als Nr. 75 beauftragt. Die Regelvorschläge 71, 66, 67 und 74 aus Morgenbericht 11 §8 sind freigegeben und eingetragen (TESTING_GUIDELINES §2, TECH_STACK; Wache und CI-Schritt baut Nr. 75), 73 steht in docs/nachtlauf.md 4a Punkt 1, 68 geht in Nr. 79 auf. Die Entscheidungen des Dirigenten aus Lauf 11 sind bestätigt (Kennungen F8/N6/N7, Schriftquelle, „p vor verknüpften Produkten", die Grenzerweiterungen aus Morgenbericht 11 §6). Lauf 12 hat keine Migration. Nicht in diesem Lauf (Lauf 13, nach Entscheidung): Warteliste je Produkt, Push bei neuer Bestellung, Nachfrage-Signal, Beitrag per Sprache, Hof merken. Offen bleibt: Kopf mit Reitern bei 2560 volle Breite (73); Titelbild-Maße beim Hochladen speichern (Migration); Contract whatsappSentCount/whatsappRecipientCount; E-Mail-Pflicht FAGG; Produkte je Verkaufsgröße/Familie; Gründungszusage bei Rücknahme; Kundinnen-Status; OSM-Auszug; CI-Lint blockierend; SEPA, Rechnung/USt, Rücklastschriften, Admin-Protokoll (S12). Die Live-Schaltung samt `STRIPE_LIVE_AB` macht der Mensch als letzten Schritt.

Stand Lauf 13 (uttoranger, 13.10.2026): M1, N12, N13 und die Änderung von O4 sind entschieden und in Nr. 84–87 und 89–91 eingeplant (freigabe.md §17); K3 und T8 sind beschlossen, Bau nach Signal. Die Regelvorschläge 75, 76, 82 und der Dirigenten-Vorschlag (Telefonnummern-Wache) aus Morgenbericht 12 §9 sind freigegeben und eingetragen (TESTING_GUIDELINES §1/§2; die Tests baut Nr. 85), der Blocker-Satz steht in docs/nachtlauf.md 4a und .claude/agents/pruefer.md; nicht freigegeben: eine Prüfung „Kundin" als Beschriftung (78). Die Entscheidungen des Dirigenten aus Lauf 12 sind bestätigt (Register-Kennungen wie in der Freigabe: N8–N11, G5 und T7 waren frei; drei hochgestufte Sollte; CODING_STANDARDS §7 nach G5; Grenzerweiterungen; Zusammenführung 80-R1 in 83; Bilderstrecke auf eigenem Seed-Hof). Lauf 13 hat genau eine Migration (Nr. 87, Expand). Geparkt: Unterhaltungen zwischen Höfen (K3/T8), Anzeige im Umkreis, Startseite gestalten. Nicht in diesem Lauf: Warteliste je Produkt, Push bei neuer Bestellung, Nachfrage-Signal, Beitrag per Sprache, Hof merken. Offen bleibt: Kopf mit Reitern bei 2560 volle Breite (73); Titelbild-Maße beim Hochladen speichern; Contract whatsappSentCount/whatsappRecipientCount; E-Mail-Pflicht FAGG; Produkte je Verkaufsgröße/Familie; Gründungszusage bei Rücknahme; Kundinnen-Status; OSM-Auszug; CI-Lint blockierend; SEPA, Rechnung/USt, Rücklastschriften, Admin-Protokoll (S12). Der Cutover auf agrilo.at (§2 der Freigabe) und die Live-Schaltung samt `STRIPE_LIVE_AB` macht der Mensch.

Stand Lauf 14 (uttoranger, 15.10.2026): Die Ergänzung zu K2 (Gründungshöfe sichtbar), die Änderung von N12, N14, N15, N16 und die Korrektur von Z3 sind entschieden und in Nr. 93–96 eingeplant (freigabe.md §18). Lauf 14 hat drei Migrationen (Nr. 93, 95 und 96, je nur Expand; die von Nr. 96 mit Seed). Nicht in diesem Lauf: K3/T8 (Bau nach Signal), Anzeige im Umkreis, Warteliste je Produkt, Push, Admin-Protokoll (S12; die Protokollzeile je Gruppe in Admin › Einstellungen ist kein Ersatz). Offen bleibt die Liste aus Lauf 13: Kopf mit Reitern bei 2560 volle Breite (73); Titelbild-Maße beim Hochladen speichern; Contract whatsappSentCount/whatsappRecipientCount; E-Mail-Pflicht FAGG; Produkte je Verkaufsgröße/Familie; Gründungszusage bei Rücknahme; Kundinnen-Status; OSM-Auszug; CI-Lint blockierend; SEPA, Rechnung/USt, Rücklastschriften, Admin-Protokoll (S12). Die Live-Schaltung samt `STRIPE_LIVE_AB` macht der Mensch.

Stand Lauf 15 (uttoranger, 15.10.2026): Die Ergänzungen zu N13, N14 und N15, die Änderung von N16 und N17 (Bild-Baustein für alle Fotos) sind entschieden und in Nr. 97–101 eingeplant (freigabe.md §19). Lauf 15 hat zwei Migrationen (Nr. 99 und 97, je nur Expand, ohne Seed). Nicht in diesem Lauf: Sammelbestellung (nur Idee, Stufe 0 von Hand; Nr. 102 erst nach eigener Freigabe); KI-Vorschläge „Duplikat“ und „kein Fehler“ sowie Bündel-Stichwort und Bündel-Zusammenfassung (brauchen ein Feld, Folgeauftrag); Zusagen je Hof festschreiben; Knopf „Erstattung erledigt“; Drossel für die Mail „Ein Hof hat geantwortet“; Inhalte für „Auszahlungen“ und „Entfallene Gebühren“; Satz für zu kleine Bilder; K3-Messfühler; SEPA-Monatsabrechnung; Contract von Farm.bannerFocusY; die Regelvorschläge aus Morgenbericht 14 §8. Offen bleibt die Liste aus Lauf 14. Die Live-Schaltung samt `STRIPE_LIVE_AB` macht der Mensch.

Stand Lauf 16 (uttoranger, 16.10.2026): Die Ergänzungen zu K2, N4, N14, N16, N17, die Änderungen von N5 und N15 und N18 (Betrieb) sind entschieden und in Nr. 103–109 eingeplant (freigabe.md §20); Nr. 110 setzt freigegebene Regelvorschläge als Prüfungen um. Die Punkte aus Morgenbericht 15 §8 sind bestätigt (99: Quelle im signierten Inhalt, Cache und Termin, ‚gespeichert hh:mm‘ erst nach dem ersten Speichern, echter Wochentag; 101: Bescheid braucht eine Antwort, Ablegen verlangt die Antwort im Dialog, Postfach-Absatz in DESIGN_SYSTEM; 100: jährliche Posten umgelegt, das Mockup ist angepasst; 97: Vorschau in der Zeile, ‚Zurücksetzen‘ auch für füllen/ganz; 98: Baustein im Fotofeld, ‚Übernehmen‘, Serie öffnet einmal, Fotostreifen auf /hoefe als Rohfoto; die Grenzerweiterungen des Dirigenten). Der Link der Gründungs-Nachricht bleibt `/settings/konditionen` (93). Lauf 16 hat zwei Migrationen (109 und 103, je nur Expand, ohne Seed). Offen bleibt: Tarife Vercel/Supabase, SEPA und Stichtag B1, Zusagen je Hof festschreiben, Auszahlungen, KI-Vorschläge, K3-Messfühler, Löschen von Bildern ohne Verwendung, Regel-Inventur Vorschlag 9.

Stand Lauf 17 (uttoranger, 19.10.2026): N19 (Entdecken statisch), die Ergänzung zu E7 (Geräte, Code- und Passwort-Raten), N20 (Admin nur mit Passkey) und die Änderung von K2 (Aktion 100 Gründungshöfe mit Abzeichen) sind entschieden und in Nr. 111–116 eingeplant (freigabe.md §21); Nr. 117 bringt SEO-Grundlagen und echte 404, Nr. 118 Reste aus 110 und die freigegebenen Regelvorschläge aus Morgenbericht 16 §5. Lauf 17 hat drei Migrationen (114, 115, 116, je nur Expand, ohne Seed) und ein neues Paket (@better-auth/passkey 1.6.23, nur 115). Offen bleibt: Anmeldung der Höfe ohne Passwort (Lauf 18), Hof- und Produktseiten zwischenspeichern, SEPA und Stichtag B1, Stripe-Gebühren und Stornoquote, Löschen von Bildern ohne Verwendung, Teil b von 110 und Vorschlag 9, Datenschutz-Fix nach #210/#236.

Stand Lauf 18 (uttoranger, 19.10.2026): die Ergänzung zu N20 (frische Bestätigung, Nutzerprüfung, Pflicht je Seite), N21 (Testhof), N22 (Entdecken v2), die Ergänzung zu K2 (Heute-Karte entfällt), G7 (Vorschau ohne WIP-Commits) und die Regelvorschläge aus Morgenbericht 17 §5 sind entschieden und in Nr. 115 und 119–121 eingeplant (freigabe.md §22). G6 (Pakete erst ab 14 Tagen) kam mit dem Paket-PR vor dem Lauf. Lauf 18 hat zwei Migrationen (119, 115; je nur Expand, ohne Seed) und kein neues Paket. Nicht in diesem Lauf: Region v2/v3 (Lauf 19), automatische Suche des Kartenpunkts (Datenschutzerklärung), ‚Noch nicht bestellbar‘ eingeklappt (AGB §3), Messereignisse, Titel mit Marke, Hook-Fehlalarm. Offen bleibt: Anmeldung der Höfe ohne Passwort, Hof- und Produktseiten zwischenspeichern, SEPA und Stichtag B1, Stripe-Gebühren und Stornoquote, Löschen von Bildern ohne Verwendung, Teil b von 110 und Vorschlag 9, Datenschutz-Fix nach #210/#236.

Stand Lauf 19 (uttoranger, 20.10.2026): N23 (Region v2), die Ergänzung zu E9 (Schild ‚laut Hof‘), die Ergänzung zu R1 (Better Auth über alle Instanzen), G8 (CSP zum Beobachten), Beiträge v2 (Änderung von F8, Ergänzungen zu N5, T5, N16, E12 und N22 mit der Marke an der Hofkarte), die Ergänzung zu N22 (ein Fuß am Computer), die Ergänzung zu G3 (CI für gestapelte PRs) und die Regelvorschläge aus Morgenbericht 18 §5 sind entschieden und in Nr. 122–129 eingeplant (freigabe.md §23). Der Sicherheits-PR (Next.js 16.4.2, sharp 0.35.5) kam vor dem Lauf. Lauf 19 hat zwei Migrationen (123, 129; je nur Expand, ohne Seed) und kein neues Paket. Nicht in diesem Lauf: CSP scharf, volle Abholfenster, Test des Hydrierens, ‚zuletzt benutzt‘ je Passkey, Wache für G6, Neuigkeiten-Anmeldung ohne Bestellung, Aufrufe je Beitrag. Offen bleibt: Anmeldung der Höfe ohne Passwort, Hof- und Produktseiten zwischenspeichern, SEPA und Stichtag B1, Stripe-Gebühren und Stornoquote, Löschen von Bildern ohne Verwendung, Teil b von 110 und Vorschlag 9, Datenschutz-Fix nach #210/#236, `emailVerified` doppelt, Kartenpunkt-Suche, AGB §3.

Stand Lauf 20 (uttoranger, 21.10.2026): G9 (Seed-Höfe in Bildern), F10 (Bestätigungen aus Lauf 19), die Änderung von N23 (Eier je Stück zurückgestellt), die Ergänzungen zu N19 (volle Abholfenster in Hofliste und Hofseite), N11 (eine Erinnerung je Sache), G4 (Regelvorschläge aus Morgenbericht 19 §5), G6 (yaml, jsdom) und G8 (Stripe-Hosts) sind entschieden und in Nr. 130–136 eingeplant (freigabe.md §24). Lauf 20 ist ein fünfter Lauf mit Regel-Inventur. Er hat keine Migration und zwei neue Entwicklungspakete. 124 bleibt bis zur rechtlichen Prüfung offen. Nicht in diesem Lauf: CSP scharf, Eier je Stück, Backups, Marke für Futterhöfe, ‚zuletzt benutzt‘ je Passkey, Wache für G6, Neuigkeiten-Anmeldung ohne Bestellung, Aufrufe je Beitrag. Offen bleibt: Anmeldung der Höfe ohne Passwort, Hof- und Produktseiten zwischenspeichern, SEPA und Stichtag B1, Stripe-Gebühren und Stornoquote, Löschen von Bildern ohne Verwendung, Teil b von 110 und Vorschlag 9, Datenschutz-Fix nach #210/#236, `emailVerified` doppelt, Kartenpunkt-Suche, AGB §3.
