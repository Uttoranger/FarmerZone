# Morgenbericht Nachtlauf 4 (2026-10-06)

Der Dirigent lief interaktiv in einer Cloud-Sitzung (Abschnitt 8 von `docs/nachtlauf.md`). Bearbeitet wurden 17a, 17b, 17c, 17d, 18 und 19. **Der Haltepunkt 19 aus `freigabe.md` §8 ist erreicht.** Nr. 20 wurde nicht begonnen.

Alle Stapel bis #182 waren gemergt, deshalb zweigt 17a von `main` ab. K1 hat im Register ein Datum (1. Februar 2027), also lief auch 17d.

## 1. Bearbeitete Nummern

| Nr | Auftrag | PR | Basis | Enthält Migration | Vorschau | Prüfung, Nachbesserungen | Weggelassen bzw. offen |
|---|---|---|---|---|---|---|---|
| 17a | E8 – Checkout ohne Kundenkonto | #183 | `main` | **nein** | [Vorschau](https://farmer-zone-5wqrrxkmj-bierbaron.vercel.app) | 1 Blocker behoben (Sitzungs-Cache bei Altkonten) | Ablehnungssperre für Altbestand; „/account" auf Abos umgedeutet; Name/Telefon nach fremder Registrierung |
| 17b | S3 – E-Mail-Bestätigung neue Höfe | #184 | #183 | **nein** | [Vorschau](https://farmer-zone-6xrvjvh3h-bierbaron.vercel.app) | **1 Sicherheits-Blocker behoben (Pre-Hijacking)** | **Stichtag vor dem Merge setzen**; Rest-Risiko Hof-Registrierung mit Checkout-Adresse |
| 17c | Slug-Prüfung absichern | #185 | #184 | **nein** | [Vorschau](https://farmer-zone-2g539ocme-bierbaron.vercel.app) | nichts blockierend | – |
| 17d | K1 – Konditionen-Übergang | #186 | #185 | **nein** | [Vorschau](https://farmer-zone-c20beasbp-bierbaron.vercel.app) | Monatsabrechnung zeitlich eingeordnet | Bar-Gebühren vor dem Stichtag entscheiden |
| 18 | Produkte und „Was legst du an?" | #187 | #186 | **nein** | [Vorschau](https://farmer-zone-rbpti6y3t-bierbaron.vercel.app) | Bestandsfehler im Bearbeiten-Dialog mitbehoben, Nebenläufigkeitstest geschärft | Größen/Familien und Futter/Brennmaterial (Gate 6), Moment abschaltbar (Gate 7) |
| 19 | Bestellungen, Storno, Artikel fehlt | #188 (**Entwurf**) | #187 | **nein** | im Vercel-Kommentar des PR | 2 Runden im Geldpfad, kein Blocker | **4 Sollte-Punkte offen** (Abschnitt 4) |

Zu den Vorschau-Links:
- Sie zeigen den Stand beim Schreiben dieses Berichts. Nach jedem Push erzeugt Vercel einen neuen; den aktuellen findest du im Vercel-Kommentar des PR.
- Für #188 war beim Schreiben noch kein Deployment fertig.

Ablauf je Nummer:
- ein frischer Umsetzer;
- danach `tester` und `pruefer`;
- dann bis zu zwei Nachbesserungsrunden. Nach Fixes im Geld- oder Sicherheitspfad gab es zusätzlich eine kurze Nachprüfung des Fix-Commits.
- vor jedem Push habe ich Typecheck und Tests selbst wiederholt.

Stand auf #188: 230 Testdateien mit 4081 Tests grün, Integration 20 Dateien mit 193 Tests grün. Lint meldet in keiner geänderten Zeile einen neuen Befund; der Altbestand sank auf 16 Fehler und 7 Warnungen.

**Keine Nummer hat eine Migration, eine Schema-Änderung oder ein neues Paket.**

## 2. Merge-Reihenfolge

Strikt der Reihe nach: **#183 → #184 → #185 → #186 → #187 → #188.**

**Gestapelte PRs per Merge-Commit mergen, nicht per Squash.** Sonst kennen die darauf gestapelten Branches die Commits nicht mehr und bekommen Konflikte (so war es bei #166–#170).

- **#184:** Erst den Stichtag setzen (Abschnitt 3).
- **#188** ist ein Entwurf. Erst die offenen Punkte aus Abschnitt 4 entscheiden: Fix-PR davor oder bewusst danach.

## 3. Für dich zu tun

- [ ] **#184 Stichtag:** `EMAIL_BESTAETIGUNG_STICHTAG` in `src/lib/email-bestaetigung.ts` (Platzhalter 15.10.2026) auf den Tag des Deploys setzen. Nur Konten ab diesem Tag müssen ihre E-Mail bestätigen.
- [ ] **#188 Vercel:** Prüfen, ob `export const maxDuration = 60` auf den Bestellseiten zu deinem Plan passt.
  - Hobby ohne Fluid Compute erlaubt bis 60 s.
  - Mit Fluid Compute senkt 60 die Standardgrenze von 300 s.
  - Die Transaktion bei „Artikel fehlt" braucht bis zu 52 s.
- [ ] **#188 offene Punkte:** Entscheiden, ob ein kleiner Fix-PR vor dem Merge kommt (Abschnitt 4). Mein Vorschlag: ja, weil Geldpfad.
- [ ] **Mockup-Abweichungen** freigeben. Je PR stehen sie im Bericht unter `docs/nachtlauf/berichte/17a.md` … `19.md`, darunter:
  - der Übergangssatz zweimal auf `/fuer-hoefe` (#186);
  - Stepper am Handy mit 44 statt 30 px (#187);
  - am Handy „Artikel fehlt" statt „Problem melden" (#188).
- [ ] **Entscheidungen** aus Abschnitt 5 treffen und ins Register übernehmen lassen.
- [ ] **Stripe-Dashboard:** EPS, Apple Pay und Google Pay einschalten (offen seit Lauf 2).

## 4. Offen in #188 (Geldpfad, nach zwei Runden)

Der Prüfer hat keinen Blocker gefunden. Die Formel für den Rest-Storno stimmt mit E14; am Ende stehen Hof und Plattform bei 0, und eine Doppelerstattung ist ausgeschlossen. Im Zweifel bucht der Code nichts und meldet an Sentry. Offen sind:

1. **„Bezahlt" kommt aus der Datenbank** (`src/server/actions/orders.ts` ~453): Der Rest-Storno nimmt den bezahlten Betrag aus der Datenbank statt aus Stripe (`latest_charge.amount`). Nach einem abweichenden Nachtrag bekäme die Kundin still zu wenig, oder die Erstattung bliebe offen.
2. **Falsche Anweisung für die Handbuchung** (`orders.ts` ~538): Im Rest-Pfad beschreibt die Sentry-Anweisung eine Vollerstattung, nach einer Teilerstattung ist das falsch.
3. **Unehrlicher Hof-Text** (`orders.ts` ~585, Altlast): „Bitte manuell über das Stripe Dashboard erstatten" geht an den Hof, obwohl der keinen Zugriff aufs Plattformkonto hat.
4. **Kein Webhook für später gescheiterte Erstattungen:** `refund.failed` bzw. `charge.refund.updated` haben keinen Handler. Eine `pending` gezählte Erstattung, die später scheitert, bleibt in der Datenbank „erstattet".

Außerdem fehlt ein Test für `restNachTeilerstattung` mit Provision > 0. Die Vollerstattung im else-Zweig läuft ohne kurze Stripe-Zeitgrenze (Altlast). Den Schema-Kommentar zu `erstattetCents` und `serviceFeeMinCentsApplied` sollte der nächste Schema-PR nachziehen.

## 5. Entscheidungen für dich

**17a (#183)**
- (a) Die Ablehnungssperre zählt nur noch alte Bestellungen am Inhaber-Konto. Soll sie für diesen Altbestand ganz wegfallen?
- (b) „/account zeigt nur Bestellungen der bestätigten Adresse" gilt für die Abos. `/account` zeigt keine Bestellungen, die stehen unter `/bestellungen`.
- (c) Name und Telefon, die eine fremde Passwort-Registrierung am Konto hinterlassen hat. Vorschlag: beim ersten Beweis der Adresse leeren.

**17b (#184)**
- Rest-Risiko: Eine Adresse, die nur aus dem Checkout bekannt ist, kann jemand als Hof registrieren. Er sieht dadurch nichts, aber die Kundin kommt danach nicht mehr per Code hinein (E7).
- „Hof online stellen" ist als Sperre der Admin-Freischaltung umgesetzt.
- Screenshots im Fehlerbriefkasten sind für unbestätigte neue Höfe mitgesperrt.

**17d (#186)**
- Werden Servicegebühren aus Barbestellungen **vor** dem 1. Februar 2027 später eingezogen? Die Bauern-Mail „Vor-Ort-Bestellung bestätigt" spricht weiter von der Monatsabrechnung.
- Altlast: Der Tarif Hofladen verspricht „monatlich kündbar". Der Admin-Dialog sagt auch nach dem Stichtag einen Gründungsplatz zu (Gate 8).

**18 (#187)**
- (a) „Verkauf eintragen" kommt erst mit `/sales` ins neue Design.
- (b) Für denselben Zustand stehen „Entwurf" (Tabelle) und „Nicht im Shop" (Toasts, Hofseite). Welches Wort soll gelten?
- (c) Das bedingte Setzen des Vorrats im Bearbeiten-Dialog ist eine Fehlerbehebung über die Gate-Zeile hinaus. Vorher konnte jedes Speichern Bestellungen rückgängig machen.

**19 (#188)**
- (a) Stripe-Aufrufe laufen innerhalb der Zeilensperre, entgegen „erst schreiben, dann Stripe". Abgesichert ist das mit kurzen Zeitgrenzen und dem Abgleich mit Stripes Buchungen.
- (b) `totalAmount` und `serviceFeeCents` werden bei „Artikel fehlt" überschrieben. Laut Prüfer ist das vertretbar, aber die ursprüngliche Gebühr einer Barbestellung ist danach nicht mehr rekonstruierbar.
- (c) Die Kundenseiten zeigen fehlende Artikel als „fehlt leider · nicht berechnet".
- Annahmen: Fehlende Artikel gehen nicht in den Vorrat zurück. Für Altbestellungen ohne Mindestgebühr-Snapshot gilt € 0,50 als Mindestgebühr.
- Offen: Die Provision fällt auch auf den fehlenden Artikel an, sobald sie über 0 liegt (im Pilot ist sie 0). Die Bestellliste lädt ohne Grenze.

## 6. Sicherheit: was gefunden und behoben wurde

Alle Befunde sind mit Tests belegt, die vor dem Fix rot waren.

- **#184 Pre-Hijacking:** Die HTTP-Registrierung war offen, und jede Passwort-Registrierung bekam eine Bestätigungs-Mail. So hätte jemand ein Konto auf die Adresse einer Kundin anlegen und von ihr bestätigen lassen können; danach hätte er Zugriff auf ihre Abos gehabt.
  - Behoben: Die HTTP-Registrierung ist gesperrt, Mail und Bestätigung gibt es nur noch für Höfe.
  - `/account` steht nur noch Kundinnen offen.
- **#183 Sitzungs-Cache:** Bei ruhenden Altkonten las `/account` die Bestätigung aus dem Sitzungs-Cache, nach der Code-Anmeldung bis zu 5 Minuten lang falsch. „Konto löschen" ließ dabei Abos samt Telefon stehen. Jetzt wird die Bestätigung frisch aus der Datenbank gelesen.
- **#187 Vorrat:** Der Bearbeiten-Dialog schrieb den Vorrat vom Öffnen zurück und konnte so Bestellungen rückgängig machen. Jetzt wird der Vorrat nur noch bedingt gesetzt. Ein Integrationstest erzwingt die Reihenfolge und belegt das mit Gegenprobe.
- **#185:** Die Slug-Prüfung verrät keinen Freischaltungsstand mehr und ist gebremst.

## 7. Altlasten, nicht behoben (Vorschläge für eigene PRs)

- `addFarmPhotoAction` übernimmt `input.url` ungeprüft (`src/server/actions/farm-photos.ts`).
- `register.ts` verrät mit „bereits registriert", ob es eine Adresse schon gibt.
- Der Übergangsweg `/magic-link/verify` mit alten Tokens ist offen.
- `authClient.signUp` ist ein toter Export.
- `updateSubscription` prüft `farmId` nicht mit Zod; `loeseOrtAuf` prüft sein Argument ohne Zod.
- Der rote Knopf „Ablehnen & löschen" im Admin erreicht nur 4,27:1 Kontrast.
- `revertOrderStatus` setzt `paidAt` auf null und lässt `paymentStatus` auf PAID; `queries/orders.ts` nutzt `Number(platformFeeAmount)`.
- **Weiter offen aus Lauf 2 und 3:**
  - Kalender-Route (keine Fristprüfung, signierter Link in `DESCRIPTION`);
  - Bremsen nur im Speicher;
  - `useCart().total` in Fließkomma;
  - Hydration-Hinweis am Theme-Schalter der HofShell;
  - Fehler-Token (O1).

## 8. Screenshots

Die Screenshots liegen lokal in der Cloud-Sitzung unter `.nachtlauf/screens/17a/` bis `19/` und sind nicht committet. Mit dem Ende der Sitzung sind sie weg. Neu erzeugen lassen sie sich wie in `morgenbericht-2026-10-05.md` §5 beschrieben.

## 9. Abweichungen und Vorkommnisse

- **Sitzungslimit:** Während 17d brach die API am Sitzungslimit ab; Umsetzer und Tester von 17d wurden unterbrochen. Danach war der Container neu gestartet, Postgres lief nicht mehr. Ich habe Postgres neu gestartet und den Umsetzer an seinem erhaltenen Zwischenstand fortsetzen lassen. Die Tester-Prüfung von 17d habe ich selbst wiederholt: Typecheck, Lint, Unit- und Integrationstests.
- **Turn-Limit:** Der Prüfer von 17b erreichte sein Turn-Limit und lieferte den Bericht auf Nachfrage.
- **Unteragenten:** Die Umsetzer von 17b und 18 konnten `tester`/`pruefer` nicht selbst aufrufen. Das war ohnehin Aufgabe des Dirigenten und lief für jede Nummer.
- **Kleine Fixes durch den Dirigenten:** Bei 17a und 17c habe ich kleine Doku- und Test-Hinweise selbst behoben, jeweils als eigener Commit und nach der Prüfung.
- **Namensgebung:** Dieser Bericht heißt `morgenbericht-2026-10-06-lauf4.md`, weil Lauf 3 am selben Tag schon `morgenbericht-2026-10-06.md` geschrieben hat.
