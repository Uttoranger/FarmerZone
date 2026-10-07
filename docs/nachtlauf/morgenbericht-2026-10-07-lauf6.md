# Morgenbericht Nachtlauf 6 (2026-10-07)

Der Dirigent lief interaktiv in einer Cloud-Sitzung (Abschnitt 8 von `docs/nachtlauf.md`). Freigabe: uttoranger am 07.10.2026 im Chat, festgehalten in `freigabe.md` §10.

Erledigt sind Schritt 0 (Doku-PR) und die Nummern 23 bis 33 in der festen Reihenfolge. **Der Haltepunkt 33 ist erreicht.** Keine Nummer wurde übersprungen oder gestoppt.

Beim Start waren #191–#197 gemergt. Offen waren #198–#201: #198–#200 sind hier weitergeführt, #201 ist geschlossen und durch #203 ersetzt.

## 1. PRs

| Nr | Auftrag | PR | Basis | Enthält Migration | Vorschau | Prüfung, Nachbesserungen | Entwurf? |
|---|---|---|---|---|---|---|---|
| 0 | Register und Freigabe Lauf 6, Warteschlange 23–33 | #202 | `main` | **nein** | (nur Doku) | – | nein |
| 23 | Nachtrag Futter: Pflicht-Bestätigung, Hinweise, „Brennmaterial" | #198 | `main` | **nein** | [Vorschau](https://farmer-zone-1o5snt4o9-bierbaron.vercel.app) | Linktext und Hinweis über die ganze Familie; Nachprüfung ohne Befund | nein (aufgehoben) |
| 24 | Stripe-Pflicht (Z1) und Admin aus #201 | #203 | `main` | **nein** | [Vorschau](https://farmer-zone-eurq8zg78-bierbaron.vercel.app) | Sackgasse für Höfe mit `acceptsOnline=false` behoben, Freischalten bedingt; Nachprüfung ohne Befund | nein |
| 25 | Teilen ohne Browser-Speicher (T1) | #199 | #198 | **nein** | [Vorschau](https://farmer-zone-q9z6yo54n-bierbaron.vercel.app) | Speicher-Wache erweitert | nein (aufgehoben) |
| 26 | Auswertung und Region nach T1 | #200 | #199 | **nein** | [Vorschau](https://farmer-zone-1e2xqplhi-bierbaron.vercel.app) | ohne Befund | nein (aufgehoben) |
| 27 | Konto und Geld, klein (19c, 19b, B3, B4) | #204 | `main` | **nein** | [Vorschau](https://farmer-zone-qwtmq70e3-bierbaron.vercel.app) | B3 eng nach Register; keine doppelte Erstattungsmeldung; Nachprüfung ohne Befund | nein |
| 28 | Oberfläche und Wortwahl (B2, 22a/b/e, O1, 19a) | #205 | `main` | **nein** | [Vorschau](https://farmer-zone-gqrik460a-bierbaron.vercel.app) | Fehler-Farbe auch auf Tönung ≥ 4,5:1 | nein |
| 29 | „Betrieb" bei Futter kaufen vorbelegen | #206 | #200 | **nein** | [Vorschau](https://farmer-zone-35taz536s-bierbaron.vercel.app) | ohne Befund | nein |
| 30 | Teilen-Momente „gespeichert" und Abschalten | #207 | #199 | **JA** (Expand) | [Vorschau](https://farmer-zone-54yjjdcq3-bierbaron.vercel.app) | Moment nur bei kaufbarer Ware | nein |
| 31 | Tab-Wechsel beschleunigen | #208 | `main` | **nein** | [Vorschau](https://farmer-zone-9dj3e7p1x-bierbaron.vercel.app) | Überschneidungen mit #200/#203/#204 entfernt, Stripe vor der Zeilensperre; Nachprüfung ohne Befund | nein |
| 32 | Altlasten aus Lauf 5 | #209 | #203 | **nein** | im Vercel-Kommentar des PR | Int-Cent-Helfer im Dialog eingebaut, Server nimmt nur ganze Cent; Nachprüfung ohne Befund | nein |
| 33 | Datenschutzerklärung auf Sachstand | #210 | `main` | **nein** | im Vercel-Kommentar des PR | ein Satz zu Kunden-Konten gestrichen (Altkonten) | **ja** (rechtliche Prüfung) |

Zu den Vorschau-Links:
- Sie zeigen den Stand beim Schreiben dieses Berichts.
- Nach meinen letzten Abgleich-Commits (unten) baut Vercel für #198, #200, #204 und #207 neu. Den aktuellen Link findest du im Vercel-Kommentar des PR.

**Migration nur in #207 (Nr. 30), nur Expand:** `prisma/migrations/20261007120000_teilen_momente_aus`.

```sql
SET lock_timeout = '5s';
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "teilenMomenteAus" BOOLEAN NOT NULL DEFAULT false;
```

- Die Spalte hat einen konstanten Default, sie ist im Deploy-Fenster also sicher.
- Der Push hat die Migration über den Vorschau-Build in die Entwicklungsdatenbank gespielt.
- In die Produktion kommt sie über `vercel-build` beim Merge auf `main`.

Stand der Prüfung:
- Jede Nummer: frischer Umsetzer, danach `tester` und `pruefer`, höchstens zwei Nachbesserungsrunden. Nachprüfung der Fix-Commits bei 23, 24, 27, 31 und 32 (Geld bzw. Sicherheit).
- Typecheck und Tests habe ich vor jedem Push selbst wiederholt.
- **Gesamt-Probe-Merge** aller offenen Branches in der Reihenfolge unten: Typecheck grün, 274 Testdateien mit 5236 Tests grün. Die Code-Konflikte aus Abschnitt 3 habe ich dafür so aufgelöst, wie es dort steht.
- Lint: kein neuer Befund in geänderten Zeilen.

## 2. Merge-Reihenfolge (per Merge-Commit, nicht per Squash)

1. **#202** (Doku: Register, Freigabe, Status).
2. **#198 → #199 → #200 → #206**, danach **#207** (gestapelt auf #199).
3. **#203 → #209** (#209 ist auf #203 gestapelt, weil der Servicegebühr-Dialog erst dort existiert).
4. **#204, #205, #208** in beliebiger Reihenfolge.
5. **#210** erst nach der rechtlichen Prüfung (Entwurf).

**Gestapelte PRs per Merge-Commit mergen, nicht per Squash.** Sonst kennen die darauf gestapelten Branches die Commits nicht mehr.

## 3. Konflikte beim Mergen — so auflösen

Doku-Konflikte (`DEVELOPMENT.md`, `docs/ai/*.md`, `status.md`) kommen bei fast jedem Merge. Sie sind mechanisch: beide Abschnitte behalten. Daneben gibt es vier **Code-Konflikte zwischen unabhängigen PRs**. Sie treten auf, wer auch immer als Zweiter gemergt wird:

| Wenn beide drin sind | Datei | Auflösung |
|---|---|---|
| #203 und #207 | `src/app/(hof)/dashboard/page.tsx` | Block `stripe:` aus #203 (`onlinePausiert ? <StripeHinweis …/> : stripeEinrichten && <StripeEinrichtenHinweis />`); die zwei `TeilenKarte`-Zeilen aus #207 (mit `fenster` und `wirkung`) |
| #203 und #207 | `src/server/queries/heute.ts` | beide Felder behalten: `stripeEinrichten` (aus #203) **und** `hof` mit `teilenMomenteAus` (aus #207), im Typ und im Rückgabewert |
| #208 und #207 | `src/server/queries/heute.ts` | Fassung aus #208 (Abfragen nach Freigabe/daneben); im `farm.findUnique`-Select nach `isPaused: true` die Zeile `teilenMomenteAus: true,` ergänzen |
| #205 und #198 (bzw. #207) | `src/lib/produkte-hof.ts` | `brennmaterial: KATEGORIE_LABEL.BRENNHOLZ,` (aus #198) und `entwuerfe: NICHT_IM_SHOP,` mit Kommentar (aus #205); im Kommentar zu den Teilen-Momenten die Fassung aus #207 (Produkt, das nicht im Shop steht, plus der Satz „Seit Nr. 30 …“) |
| #205 und #203 | `tests/admin-knopf-kontrast.test.ts` | Fassung aus #205 (Gegenprobe mit dem alten Rot) |

Wenn du willst, löst der Dirigent diese Merges im nächsten Lauf. Er geht dann PR für PR vor und hält die Tests grün.

## 4. Für dich zu tun

**Vor bzw. direkt nach dem Merge**
- [ ] **#210 Datenschutzerklärung:** Die Tabelle „Geänderte Stellen — bitte rechtlich prüfen lassen" in `docs/nachtlauf/berichte/33.md` prüfen lassen. Dazu:
  - ob die ruhenden Altkonten aus der Zeit vor 17a eigens genannt werden müssen;
  - dass „Bestelldaten 7 Jahre" im Code nicht umgesetzt ist (kein Löschcode);
  - der Teilen-Satz für nach #199 (Vorschlag im Bericht).
- [ ] **Heu-Produkte bestätigen (E10a):** Bestehende Futter-Produkte, vor allem Heu beim Pilothof, beim nächsten Bearbeiten mit dem Pflicht-Haken bestätigen. Bestand ohne Verpackung wird nie gesperrt (E10a (c)).
- [ ] **BAES-Link (#198):** In `BAES_FUTTERMITTEL_URL` (`src/lib/futter-registrierung.ts`) die genaue BAES-Unterseite für Futtermittelbetriebe eintragen. Vorerst steht dort die Startseite, weil baes.gv.at im Lauf nicht erreichbar war.
- [ ] **Abgrenzung neue Bestätigung bestätigen (#198):** Sichtbarkeit und Foto brauchen keine neue Bestätigung, die MwSt schon.
- [ ] **Höfe ohne Stripe ansprechen (#203, Z1):** Im Admin die Filter „Stripe fehlt" und „Online-Zahlung aus" nutzen. Diese Höfe bleiben online und sehen auf Heute bzw. in den Einstellungen „Online-Zahlung einrichten" bzw. „einschalten".
- [ ] **Neuer Ablauf beim Registrieren (#204):** Nach „Konto erstellen" erscheint immer „Schau in dein Postfach", angemeldet wird über `/login` (19b, gleiche Antwort für neue und vergebene Adressen).
- [ ] **Fehler-Farbe (#205):** Das Fehler-Rot ist im hellen Theme deutlich dunkler (O1, auch auf Tönung ≥ 4,5:1). Einmal ansehen.
- [ ] **Servicegebühr-Satz (#209):** Den Satz eines Hofs einmal mit Mindestgebühr „0,50" speichern und prüfen. Der Server nimmt nur noch ganze Cent.

**Außerhalb des Codes**
- [ ] **Stripe-Dashboard:** Am Webhook die Events `refund.failed` und `charge.refund.updated` abonnieren (offen seit #191). Seit #204 erkennt die App auch gescheiterte Vollerstattungen.
- [ ] **Stripe-Dashboard:** EPS, Apple Pay und Google Pay einschalten (offen seit Lauf 2). Der Einrichten-Text nennt sie.
- [ ] **Sentry-Dashboard:** prüfen, ob IP-Adressen gespeichert werden (Vorschlag aus Bericht 33).
- [ ] **Mockup-Abweichungen aus Lauf 6** freigeben. Sie stehen je Nummer im Bericht, darunter:
  - Heute-Karte „Online-Zahlung einrichten" (24);
  - Moment „gespeichert" ohne Produktbild und Bereich „Teilen-Hinweise" (30);
  - Beitragszeile zweizeilig (28);
  - Postfach-Hinweis nach dem Registrieren (27).

## 5. Was der Dirigent zusätzlich getan hat (Abgleich zwischen den PRs)

- **#201 geschlossen**, mit Verweis auf #203. Die Admin-Commits sind per Cherry-pick übernommen. Bei den Doku-Konflikten habe ich nur die 22f-Teile übernommen, nichts aus 20/21/22c.
- **#209 auf #203 gestapelt.** Das weicht von „Branch von main" ab. Ohne den Dialog aus #203 wäre der Int-Cent-Ersatz nicht möglich gewesen.
- **#204:** Die neue Vorlage und das Stripe-SDK werden dynamisch geladen (433c546). Sonst wäre die Wache aus #208 nach dem Merge rot geworden, und `email.ts` hätte einen Code-Konflikt bekommen.
- **#200:** Ladeansicht für die Umleitung `/analytics/umfeld` (9287bdc). Die Wache aus #208 verlangt sie.
- **#198 und #207:** Futter-Hinweise und Kommentare sagen „nicht im Shop" statt „Entwurf" (d98ec0f, d7090ba, 98c358a). Sie stammten aus der Zeit vor B2; die B2-Wache aus #205 wäre nach dem Merge rot geworden.
- **Verwaiste Dev-Server** früherer Umsetzer habe ich zweimal über die PID beendet.

## 6. Offen bzw. bewusst nicht gebaut

**Backlog (Register)**
- Direktverkauf senkt den Vorrat.
- S11 Double-Opt-in.
- Rate-Limit über einen gemeinsamen Speicher.

**Nicht angefasst**
- O4 AGB.

**Altlasten, gemeldet**
- `bestellSummen` rechnet `Math.round(Zahl * 100)`.
- `percent` im Servicegebühr-Schema läuft weiter über `z.coerce`.
- `revertReady` verschickt die Mail synchron.
- `linkedProductIds` in Beiträgen werden nicht gegen den Hof geprüft (nur Datenmüll, kein Leck).
- Knöpfe unter 44 px in „Mein Auftritt" (außer den Feldern).
- `farm-page-view` zeigt „Online (Karte)" nur nach `acceptsOnline`.

**Wiederkehrend:** Hydration-Hinweis am Theme-Umschalter im Dev-Overlay (Altbestand).

## 7. Aufgeräumt

- Postgres gestoppt.
- Kein Dev-Server läuft.
- Probe-Arbeitsbäume entfernt.
- Screenshots nur lokal unter `.nachtlauf/screens/`.
