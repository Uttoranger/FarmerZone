# Morgenbericht Nachtlauf 2 (2026-10-05)

Der Dirigent lief interaktiv in einer Cloud-Sitzung, wie es Abschnitt 8 von `docs/nachtlauf.md` erlaubt. Bearbeitet wurden die Nummern 06b bis 14. **Der Haltepunkt 14 aus `freigabe.md` §5/§6 ist erreicht.** Nr. 15 wurde nicht begonnen.

## 1. Bearbeitete Nummern

| Nr | Gate | PR | Basis | Prüfung, Nachbesserungen | Weggelassen bzw. offen |
|---|---|---|---|---|---|
| 06b | Reservierte Slugs vollständig | #170 | `main` | nichts blockierend | – |
| 07 | Startseite | #171 | #170 | 1 Blocker (Seite war dynamisch statt statisch) behoben | Lighthouse-Messung durch dich; PLZ-Suche (siehe Nr. 09); 13 Mockup-Abweichungen |
| 08 | Anmelden (Code für Kundinnen) | #172 | #171 | **3 Sicherheitsbefunde behoben** (siehe Abschnitt 3), 3 Runden | Fehler-Token; Bremse für Code-Anforderungen nur im Speicher |
| 09 | Entdecken (`/hoefe`) | #173 | #172 | Tokens, 44 px, Umkreis beim Zurücksetzen | PLZ in der URL weggelassen (Regel aus #130); 9 Mockup-Abweichungen |
| 10 | Hofseite | #174 | #173 | Geld-Blocker (Korb in Fließkomma) und **JSON-LD-XSS** behoben | Reiter „Beiträge" bestätigen; Futter-Schild auf Karten → Nr. 20 |
| 11 | Produktseite | #175 | #174 | Grundpreis an zwei Stellen verschieden gerundet; Besitzer-Vorschau | Gate-6-Teile (Anhänger/Frontlader, Größen-Sperre, rm/srm) |
| 12 | Kasse | #176 | #175 | Betrag im Zahlungsschritt jetzt der an Stripe übergebene | **E8:** Checkout legt weiter ein ruhendes Konto an; EPS/Wallets im Stripe-Dashboard |
| 13 | Bestätigung und E-Mails | #177 | #176 | feste Datumsangaben in Mails, Mail-Palette, Kalenderlink | „Nochmal bestellen" (S11); einfaches Opt-in; Altlasten der Kalender-Route |
| 14 | „Bestellungen finden" + `/account` | #178 | #177 | eine Quelle für ILIKE-Maskierung und Summen | Slug `bestellungen` in Produktion prüfen |

Ablauf je Nummer:
- ein frischer Umsetzer;
- danach `tester` und `pruefer`;
- dann eine bis zwei Nachbesserungsrunden;
- vor jedem Push habe ich Typecheck und Tests selbst wiederholt.

Stand auf #178: 210 Testdateien mit 3710 Tests grün, Integration 15 Dateien mit 128 bzw. 129 Tests grün. Lint meldet in keiner geänderten Zeile einen neuen Befund; der Altbestand sank von 26/9 auf 18/7, weil Nr. 12 die zwei `<a>`-Befunde in `checkout-form.tsx` beseitigt hat.

Keine Nummer brauchte eine Migration oder ein neues Paket.

## 2. Merge-Reihenfolge

Strikt der Reihe nach: **#170 → #171 → #172 → #173 → #174 → #175 → #176 → #177 → #178.**

Bei Squash-Merges gilt Regel 8: Vor dem nächsten Lauf (oder auf Zuruf „resolve conflicts") holt der Dirigent `main` in die noch offenen Branches. Konflikte entstehen erfahrungsgemäß nur in `DEVELOPMENT.md` und `docs/nachtlauf/status.md`.

## 3. Sicherheit: was gefunden und behoben wurde

Alle Befunde sind mit Tests belegt, die vor dem Fix rot waren:
- **#172, Rollen-Trennung:** Hof- und Admin-Konten konnten über den Kunden-Code-Weg eine Sitzung bekommen. Better Auth legt den Code an, bevor die Mail rausgeht, und `/sign-in/email-otp` prüft keine Rolle. Jetzt wird für Nicht-Kundinnen kein Code angelegt, und die Code-Anmeldung lehnt sie ab.
- **#172, offene Weiterleitung** nach der Anmeldung (`/.//evil.com`).
- **#172, Platzhalter in der Rollenabfrage (gefunden in Nr. 14):** `mode: 'insensitive'` wird in Prisma zu einem ILIKE ohne Maskierung. Vor dem Fix ließ sich ein Hof mit `%` in der Adresse tatsächlich anmelden. Jetzt wird die Adresse maskiert, alle Treffer zählen, und `isAdmin` zählt wie ADMIN. Der Fix ist per Merge durch #173–#178 nachgezogen; ein Kommentar in #172 erklärt ihn.
- **#174, JSON-LD:** Ein Hoftext mit `</script>` wäre auf der öffentlichen Hofseite ausgeführt worden. Jetzt maskiert `jsonLdSicher` die Ausgabe.
- **#176, Geldpfad:** Neue Bestellungen mit „Karte bei Abholung" lehnt der Server ab (E5). Der Bezahl-Knopf zeigt jetzt den Betrag, den Stripe abbucht.

## 4. Fragen und Entscheidungen für dich

**Vor einem Merge zu klären:**
- **#178:** In Produktion nur lesend `SELECT slug FROM "Farm" WHERE slug = 'bestellungen';` ausführen.
- **#171:** Lighthouse der Startseite gegen die Vorschau messen. Gate-Abnahme ist „nicht schlechter als vorher".

**Entscheidungen:**
1. **E8 und das ruhende Konto beim Checkout (#176):** `/api/checkout` legt bei jeder Bestellung ein CUSTOMER-Konto ohne bestätigte E-Mail an, oder hängt die Bestellung an ein bestehendes Konto derselben Adresse. Das widerspricht „kein automatisches Konto beim Checkout".
   - Heute ist das nicht ausnutzbar, weil „Bestellungen finden" (#178) nach `customerEmail` sucht, nicht nach dem Konto.
   - Folge 1: Name und Telefon des ruhenden Kontos setzt, wer zuerst mit der Adresse bestellt.
   - Folge 2: Eine Bestellung unter der E-Mail eines Hof-Inhabers sperrt im Admin die Ablehnung dieses Hofs.
   - Den Umbau habe ich nicht vorgenommen, weil er im Geldpfad liegt.
2. **Fehler-Token für das neue Design:** Fehlertext erreicht im hellen Theme 4,22:1, gefordert sind 4,5:1. Bis zur Entscheidung zeigen die Seiten Fehler als orange Hinweiskarte.
3. **S11 und „Nochmal bestellen"** in der Abholbereit-Mail (#177): Ist das Werbung oder Teil des Vertrags? Außerdem haben Statusmeldungen und Newsletter nur ein einfaches Opt-in, kein Double-Opt-in.
4. **Öffentlicher Reiter „Beiträge" auf der Hofseite (#174):** Er gehört zum Gate-4-Auftrag, ist aber nicht von E12 gedeckt.
5. **Produktkarten verlinken die neue Produktseite (#175):** Das alte Produkt-Blatt ist gelöscht.
6. **Mockup-Abweichungen:** je PR im Bericht aufgelistet. Zur Freigabe gehören auch die Darstellungsänderungen in `/account/unsubscribe` (grüner statt roter Knopf, #178) und der Bar-Knopf „Zahlungspflichtig bestellen" (#176).

**Stripe-Dashboard, nur durch dich:** EPS sowie Apple und Google Pay einschalten, für Apple Pay zusätzlich die Domain registrieren. Code dafür ist nicht nötig, der PaymentIntent nutzt automatische Zahlungsarten.

**Altlasten, nicht behoben, Vorschläge für eigene PRs:**
- **Kalender-Route:** keine Fristprüfung beim Lesen, kein Rate-Limit, und sie schreibt den signierten Bestell-Link in die `DESCRIPTION`. Von dort gelangt er in synchronisierte Kalender.
- **Unmaskiertes ILIKE** noch in `src/server/queries/customers.ts` und `src/server/actions/products.ts`.
- **Bremsen nur im Speicher:** Die Bremsen für Code-Anforderungen bei Anmeldung und „Bestellungen finden" zählen nur im Speicher je Instanz. Die Versuche je Code zählt dagegen die Datenbank.
- **Fließkomma im Korb:** `useCart().total` rechnet im Korb-Blatt und in der Korb-Leiste weiter in Fließkomma. Die Anzeigen auf Hofseite und Kasse laufen über Cent.
- **Fehlerbehandlung:** `gibBestandZurueck` in `route.ts` bucht mit blindem `increment` zurück. `sendRaw` loggt `result.error` ungefiltert.
- **Startseite (#171):** nutzt für ihr Bild-Overlay noch `from-black/…`. Die Overlay-Regel kam erst mit #173 dazu.
- **Hofbereich:** In `farmer-nav.tsx` fehlt ein sichtbarer Fokus, und `signOut()` läuft ohne Fehlerbehandlung.
- **Startbefehl:** `docs/nachtlauf-start.txt` nennt noch den alten Migrationsweg (`--create-only`). Maßgeblich ist Regel 3 in `docs/nachtlauf.md`.

## 5. Screenshots

Die Screenshots liegen lokal in der Cloud-Sitzung unter `.nachtlauf/screens/07/` bis `14/` und sind nicht committet. Sie zeigen jede Route bei 390, 1024 und 1440 px in beiden Themes, für Nr. 13 auch die Mails bei 390 und 680 px. Mit dem Ende der Sitzung sind sie weg. Neu erzeugen kann man sie mit dem Ablauf in `docs/nachtlauf.md` und dem Rahmen der Umsetzer: App gegen die lokale Test-DB starten, dann agent-browser.

## 6. Abweichungen und Vorkommnisse

- **Container-Neustart:** Ein Neustart unterbrach den Umsetzer von Nr. 07. Er setzte am erhaltenen Zwischenstand fort, nichts ging verloren.
- **Werkzeug-Limit:** Der `pruefer` von Nr. 10 erreichte sein Limit. Auf Nachfrage lieferte er seinen Bericht mit dem Vermerk „nicht geprüft" für die restlichen Punkte.
- **Verwaister `next dev`:** Zweimal lief auf Port 3000 noch ein `next dev` aus einem früheren Umsetzer. Er wurde über seine PID beendet.
- **Sicherheitsfix an einem früheren Branch:** Den Fix an #172 habe ich in einem eigenen Worktree gebaut, damit die laufende Prüfung von Nr. 14 im Hauptverzeichnis ungestört blieb. Danach habe ich ihn per Merge-Commit durch alle späteren Branches gezogen (ohne Force-Push) und jeden Branch erneut geprüft.
- **Playwright:** Es ist nicht installiert. Die E2E-Prüfungen von Gate 4 liefen über agent-browser. Online-Zahlungen ließen sich lokal mit den Platzhalter-Schlüsseln nur bis „Online-Zahlung ist gerade nicht möglich" prüfen; echte Stripe-Aufrufe gab es nie.
