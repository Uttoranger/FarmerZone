# Morgenbericht Nachtlauf 5 (2026-10-07)

Der Dirigent lief interaktiv in einer Cloud-Sitzung (Abschnitt 8 von `docs/nachtlauf.md`). Bearbeitet wurden alle elf Nummern in der Reihenfolge aus `freigabe.md` §9: 19c, 19a, 19b, 22a, 22b, 22d, 22e, 20, 21, 22c, 22f. **Der Haltepunkt 22f ist erreicht.**

Beim Start war kein Stapel offen (#188–#190 gemergt), deshalb zweigt 19c von `main` ab. Danach ist jede Nummer auf die vorige gestapelt. Der Lauf wurde zweimal durch einen Neustart des Containers unterbrochen (bei 22e und bei der Nachprüfung von 21). Beide Male ging es bei der ersten offenen Nummer weiter, ohne Verlust an Commits.

## 1. Bearbeitete Nummern

| Nr | Auftrag | PR | Basis | Enthält Migration | Vorschau | Prüfung, Nachbesserungen | Offen |
|---|---|---|---|---|---|---|---|
| 19c | Geldpfad „Artikel fehlt" nachziehen | #191 | `main` | **nein** | [Vorschau](https://farmer-zone-9naykkoww-bierbaron.vercel.app) | Meldungen genau einmal; Nachprüfung des Fixes | Stripe-Events abonnieren; Vollstorno ohne Merkmale wird nur gemeldet |
| 19a | B1 – keine Bargebühr bis zum Stichtag | #192 | #191 | **nein** | [Vorschau](https://farmer-zone-i2627c1be-bierbaron.vercel.app) | Hinweistexte nachgezogen | Mockup-Abweichungen Kasse/Startseite; `/konditionen` verliert den Bar-Satz erst mit dem nächsten Deploy nach dem Stichtag |
| 19b | Sicherheits-Altlasten aus Lauf 4 | #193 | #192 | **nein** | [Vorschau](https://farmer-zone-rcd1tqpj0-bierbaron.vercel.app) | Ehrliche Wortwahl zur Kontenaufzählung, Zod an Bildunterschriften | Foto-Upload nach Deploy prüfen; Registrierung noch nicht ganz neutral |
| 22a | Kunden und Kundendetail | #194 | #193 | **nein** | [Vorschau](https://farmer-zone-pgs66kijs-bierbaron.vercel.app) | Sortierrichtung wiederhergestellt | Sortier-Bedienform und Marken-Farben bestätigen |
| 22b | Verkäufe und „Verkauf eintragen" | #195 | #194 | **nein** | [Vorschau](https://farmer-zone-nsaqd1b4d-bierbaron.vercel.app) | ohne Blocker | Wort „Gesamt"; Bestandsabzug bei Direktverkauf |
| 22d | Einstellungen | #196 | #195 | **nein** | [Vorschau](https://farmer-zone-j2acs90ru-bierbaron.vercel.app) | Sätze aus `konditionen.ts`, Zahlung bei nur bar | **Mockup-Abweichungen der Übersicht vor dem Merge freigeben**; Rechenbeispiel mit eigenen Sätzen |
| 22e | Beiträge, Hilfe, Meine Meldungen | #197 | #196 | **nein** | [Vorschau](https://farmer-zone-6o5adjsjv-bierbaron.vercel.app) | Fokus an 3 Knöpfen, ehrliche Doku | E12-Lesart „bleibt und leitet um"; Anzeigen der alten Beitragskarte |
| 20 | Futter und Brennmaterial | #198 (**Entwurf**) | #197 | **nein** | [Vorschau](https://farmer-zone-9ljfr1mf4-bierbaron.vercel.app) | **1 Blocker behoben** (Sperre je Gebinde per Kategoriewechsel umgehbar); Nachprüfung ohne Befund | **E10-Texte gegenlesen lassen**; (a)–(d) entscheiden |
| 21 | Teilen | #199 (**Entwurf**) | #198 | **nein** (neues Paket `qrcode`) | [Vorschau](https://farmer-zone-3t6q5z41r-bierbaron.vercel.app) | 2 Runden: Cache und Rate-Limit, dann Zeichenfehler und 4. Produkt; Nachprüfung ohne Befund | **sessionStorage (§ 165 TKG) und Farbwerte im Teilen-Bild freigeben**; Momente unvollständig |
| 22c | Auswertung und Region | #200 (**Entwurf**) | #199 | **nein** | [Vorschau](https://farmer-zone-inix3tfy0-bierbaron.vercel.app) | ohne Blocker; Bericht ergänzt | **Slug `region` in Produktion prüfen**; Vorbelegung „Betrieb" |
| 22f | Admin in der AdminShell | #201 (**Entwurf**) | #200 | **nein** | im Vercel-Kommentar des PR | **1 Blocker behoben** (Stripe-Sperre hätte Bar-Höfe ausgesperrt); Nachprüfung ohne Befund | **Freischalten ohne Stripe bestätigen** |

Zu den Vorschau-Links:
- Sie zeigen den Stand beim Schreiben dieses Berichts. Den aktuellen Link findest du im Vercel-Kommentar des PR.
- Für #201 war beim Schreiben noch kein Deployment fertig.

Ablauf je Nummer:
- ein frischer Umsetzer;
- danach `tester` und `pruefer`;
- höchstens zwei Nachbesserungsrunden. Nach Fixes im Geld- oder Sicherheitspfad (20, 21, 22f) gab es zusätzlich eine kurze Nachprüfung des Fix-Commits;
- vor jedem Push habe ich Typecheck und Tests selbst wiederholt.

Stand auf #201: 256 Testdateien mit 4693 Tests grün, Integration 29 Dateien mit 250 Tests grün. Lint meldet in keiner geänderten Zeile einen neuen Befund; der Altbestand sank auf 13 Fehler und 7 Warnungen.

**Keine Nummer hat eine Migration oder eine Schema-Änderung.** Einziges neues Paket ist `qrcode` (freigegeben in §3), dazu das Typpaket `@types/qrcode` (#199). Es wurde mit `corepack pnpm` 10.33.0 installiert; die Lockfile-Overrides sind unverändert.

## 2. Merge-Reihenfolge

Strikt der Reihe nach: **#191 → #192 → #193 → #194 → #195 → #196 → #197 → #198 → #199 → #200 → #201.**

**Gestapelte PRs per Merge-Commit mergen, nicht per Squash.** Sonst kennen die darauf gestapelten Branches die Commits nicht mehr und bekommen Konflikte.

- #191 bis #197 sind keine Entwürfe. Bei #196 bitte vorher die Mockup-Abweichungen der Übersicht freigeben.
- **#198, #199, #200, #201 sind Entwürfe.** Jeder hat eine Vorbedingung (Abschnitt 3). Du kannst bis #197 mergen und den Rest stehen lassen, bis die Vorbedingungen erfüllt sind.

## 3. Für dich zu tun

Vor dem Merge (Vorbedingungen):
- [ ] **#196:** Mockup-Abweichungen der Einstellungs-Übersicht freigeben:
  - „Mein Auftritt" statt „Benachrichtigungen";
  - „Abmelden" nicht unten;
  - „Abholzeiten" ohne „und Bestellschluss".
- [ ] **#198 (Entwurf):** Die E10-Texte von Landwirtschaftskammer oder BAES gegenlesen lassen. Laut Register muss das vor dem Livegang passieren, und der Merge ist der Livegang. Alle Texte stehen in `src/lib/futter-registrierung.ts`.
- [ ] **#199 (Entwurf):**
  - sessionStorage für den Teilen-Kanal rechtlich einordnen (§ 165 Abs. 3 TKG gegen „ohne Cookie-Banner-Pflicht" aus Gate 7). Davon hängen auch der Satz „ohne Cookies" im Teilen-Fenster und die Datenschutzerklärung ab.
  - Farbwerte im Teilen-Bild als Ausnahme vom Hard Constraint freigeben. Satori kennt keine CSS-Variablen; die Werte stehen zentral in `TEILEN_BILD_FARBE`.
- [ ] **#200 (Entwurf):** In Produktion nachsehen, ob ein Hof den Slug `region` hat. Er ist jetzt reserviert, und ein solcher Hof verlöre seine Seite.
- [ ] **#201 (Entwurf):** Die Lesart „Freischalten gesperrt ohne Stripe nur für Höfe, die online kassieren wollen" bestätigen. Höfe, die nur bar kassieren, bleiben freischaltbar und erscheinen als „Nur bar".

Nach dem Deploy bzw. außerhalb des Codes:
- [ ] **#191 Stripe-Dashboard:** Am Webhook die Events `refund.failed` und `charge.refund.updated` abonnieren.
- [ ] **#193:** Nach dem Deploy einmal ein Foto hochladen. Die Upload-Sperren haben sich geändert.
- [ ] **Stripe-Dashboard:** EPS, Apple Pay und Google Pay einschalten (offen seit Lauf 2).
- [ ] **Mockup-Abweichungen** freigeben. Je PR stehen sie im Bericht unter `docs/nachtlauf/berichte/<nr>.md`, darunter:
  - #192 Kasse und Startseite;
  - #194 Marken-Farben;
  - #195 Layout;
  - #197 E-Mail statt Rückruf und kein fester Absenden-Balken am Handy;
  - #198 Größen als Karten;
  - #199 Bild ohne Produktfotos;
  - #200 Umschalter statt Liste und Karte nebeneinander;
  - #201 Karten statt Tabelle unter 1024 px.

## 4. Entscheidungen (bitte treffen und ins Register übernehmen lassen)

**Geld und Bestellungen**
- **19c:** Ein gescheiterter Vollstorno wird nur gemeldet, `paymentStatus` bleibt. Vorschlag: auch die Vollerstattung mit Merkmalen versehen.
- **21 (b):** Eine Bestellung zählt „über einen Link" schon beim Anlegen, also auch, wenn sie nie bezahlt wird. Die Alternative wäre, erst im Webhook zu zählen (Geldpfad).
- **22c:** Zählregel für „Servicegebühren dieses Monats" nach `topfVonBestellung`, wie in `/admin/finanzen`.
- **22b:** Soll ein Direktverkauf mit Produkt den Vorrat senken? Das wäre eine neue Funktion.

**Konto und Sicherheit**
- **19b:** Die Registrierung ist noch nicht ganz neutral. Vorschlag im Bericht: gleiche Antwort und eine Mail an das bestehende Konto.

**Futter (#198)**
- (a) Mischfutter und Ergänzungsfutter brauchen immer BAES;
- (b) Futtermittel entstehen nur über das Futter-Formular;
- (c) Altbestand ohne Verpackung wird nie gesperrt;
- (d) die Verpackung ist Selbstauskunft;
- E11: Das Kategorie-Label heißt noch „Brennholz", das Register sagt „Brennmaterial".

**Teilen (#199)**
- (a) Die Hofseite teilt das Teilen-Bild statt des Titelbilds;
- (c) das Handy-Teilen zählt als „link";
- (d) Teilen legt keinen Beitrag an (S11 und O3 berührt);
- (g) `@types/qrcode`;
- Moment „gespeichert" und die Abschaltung der Momente brauchen eine Spalte, also eine Migration.

**Oberfläche und Wortwahl**
- **19a:** `/konditionen` hat kein `revalidate`. Soll sie nach dem Stichtag automatisch neu bauen?
- **22a:** Eine Sortierwahl für alle Breiten; Marken-Farben.
- **22b:** Das Wort „Gesamt" unter der Wochenzahl, Vorschlag „Dieses Jahr (für die Umsatzgrenze)"; „Verkauf eintragen" auch am Handy im Kopf.
- **22d:** Das Rechenbeispiel rechnet mit den Sätzen des eigenen Hofs. Die öffentliche `/konditionen` wäre ein eigener Auftrag.
- **22e:**
  - E12-Lesart „`/status` bleibt und leitet um";
  - die Kurznummer in „Meine Meldungen";
  - soll die Zahl „N per E-Mail" wieder in die Beitragszeile?
- **22c:** Vorbelegung „Betrieb" bei Futter kaufen (bräuchte einen Weg in den Checkout); Euro-Betrag in der Teilen-Karte (hängt an 21 (b)).

## 5. Weggelassen (nach Register und Freigabe)

**Offene Punkte, nicht angefasst**
- O1–O5: Fehler-Token, Handy-Editing, S11, AGB, Rückruf.
- Wortwahl „Entwurf" bzw. „Nicht im Shop".
- Name und Telefon aus Alt-Registrierungen.
- Ablehnungssperre beim Altbestand.

**Bewusst nicht gebaut**
- Kein Rückruf (O5).
- Keine SEPA-Monatsabrechnung vor dem Stichtag (B1/K1).
- Kein Prüf-Haken für die Futtermittel-Nummer (E9).

**Altlasten, gemeldet, nicht im Auftrag**
- `revertPickedUp`;
- `Number(...)` in `queries/orders.ts` und im Servicegebühr-Dialog;
- `status-posts.ts`: Actions ohne Zod, Besitz per vorgelagertem `findFirst`;
- Datenschutz §10 nennt noch den Magic Link;
- 36-px-Felder in „Mein Auftritt";
- Rate-Limit nur im Speicher je Instanz.

## 6. Aufgeräumt

- Postgres gestoppt.
- Kein Dev-Server läuft mehr.
- Screenshots liegen nur lokal unter `.nachtlauf/screens/`, nicht committet.
