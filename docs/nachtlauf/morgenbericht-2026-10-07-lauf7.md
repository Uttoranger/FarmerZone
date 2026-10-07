# Morgenbericht Nachtlauf 7 (2026-10-07)

Der Dirigent lief interaktiv in einer Cloud-Sitzung (Abschnitt 8 von `docs/nachtlauf.md`). Die Freigabe gab uttoranger am 07.10.2026 im Chat; sie steht in `freigabe.md` §11.

Erledigt sind:
- Schritt 0 (Doku-PR #212);
- die Nummern 35 bis 40 in der festen Reihenfolge;
- der **Sammel-PR #219**, der Haltepunkt des Laufs.

**Nr. 34 (Probelauf) ist übersprungen**, weil seine Vorbedingung nicht belegbar war (siehe Abschnitt 1). Deshalb gibt es keine Fehlernummern 34a ff. Eine Nummer im Code-Konflikt anhalten musste ich nicht.

## 1. Probelauf (Nr. 34) — nicht ausgeführt

**Vorbedingung laut Freigabe:** Die Vorschau nutzt die Entwicklungsdatenbank und Stripe im **Testmodus**; der Stripe-Schlüssel der Vorschau beginnt mit `sk_test_`. Sonst: STOPP, Nummer überspringen, melden.

**Befund (ohne Werte auszugeben):**
- `STRIPE_SECRET_KEY` ist bei Vercel **eine gemeinsame Variable für Vorschau und Produktion**. Dasselbe gilt für `STRIPE_PUBLISHABLE_KEY` und `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Die Variable hat den Typ *sensitive*. Ihr Präfix lässt sich nicht lesen, ohne sie zu entschlüsseln; das ist untersagt.
- Weil Produktion echtes Geld annimmt, nutzt die Vorschau damit **sehr wahrscheinlich den Live-Schlüssel**.
- Die Vorschau-Adressen waren aus dem Container zudem nicht erreichbar (Proxy).

**Ergebnis:** STOPP nach Freigabe. Es lief keine Zahlung, kein Stripe-Aufruf und kein Zugriff auf Produktion.

| # | Ablauf | Ergebnis |
|---|---|---|
| 1 | Online mit Testkarte, auch 3-D-Secure | ausgelassen: Vorbedingung (Stripe-Testmodus) nicht belegbar |
| 2 | Wallet | ausgelassen: Vorbedingung nicht belegbar |
| 3 | EPS im Testmodus | ausgelassen: Vorbedingung nicht belegbar |
| 4 | Bar ohne Servicegebühr (B1) mit Bestätigungsknopf | ausgelassen: Nr. 34 als Ganzes übersprungen |
| 5 | Bar unbestätigt → nach Frist freigegeben | ausgelassen: Nr. 34 übersprungen |
| 6 | Futter mit Größe inkl. „Angaben stammen vom Hof" | ausgelassen: Nr. 34 übersprungen |
| 7 | Artikel fehlt bei Online-Bestellung → Teilerstattung | ausgelassen: Vorbedingung nicht belegbar |
| 8 | Storno online → Vollerstattung mit Transfer-Rückbuchung | ausgelassen: Vorbedingung nicht belegbar |
| 9 | Abgeholt und „nicht abgeholt" | ausgelassen: Nr. 34 übersprungen |
| 10 | Bestellungen finden per Code | ausgelassen: Nr. 34 übersprungen |
| 11 | Produkt am Handy anlegen, Teilen-Fenster öffnen | ausgelassen: Nr. 34 übersprungen |
| 12 | QR-Plakat erzeugt gültige Hofseiten-Adresse mit `?k=qr` | ausgelassen: Nr. 34 übersprungen |

**Sicherheitsbefund:** Vorschau-Deployments laufen sehr wahrscheinlich mit dem **Live-Schlüssel** von Stripe. Wer eine Vorschau mit einer echten Karte bedient, erzeugt echte Zahlungen.

**Empfehlung:** In Vercel eigene `STRIPE_*`-Variablen nur für *Preview* mit Test-Schlüsseln anlegen (`sk_test_…`, `pk_test_…`, Test-Webhook-Secret) und die bestehenden auf *Production* beschränken. Danach kann Nr. 34 in einem Lauf nachgeholt werden.

## 2. PRs

| Nr | Auftrag | PR | Basis | Migration | Vorschau | Prüfung, Nachbesserungen | Entwurf? |
|---|---|---|---|---|---|---|---|
| 0 | Doku Lauf 7: Register G3, S11, D1, R1; Freigabe §11; Plan; Status | #212 | `main` | **nein** | [Vorschau](https://farmer-zone-git-docs-lauf7-bierbaron.vercel.app) | – | nein |
| 35 | Altlasten aus Lauf 6 | #213 | `main` | **nein** | [Vorschau](https://farmer-zone-git-nacht-2026-10-0735-altlasten-bierbaron.vercel.app) | 3 „Sollte" (Tokens auf Foto-Kreisen, Zod-Rückfall, Float im Test) in Runde 1; Nachprüfung ohne Befund | nein |
| 36 | BAES-Angaben | #214 | `main` | **nein** | [Vorschau](https://farmer-zone-git-nacht-2026-10-0736-baes-bierbaron.vercel.app) | Kontakt nur an einer Stelle, Ausnahme eng gefasst, Texte in der Quelle (Runde 1) | nein, aber **Gegenlesen** |
| 37 | Sentry ohne IP-Adressen | #215 | `main` | **nein** | [Vorschau](https://farmer-zone-git-nacht-2026-10-0737-sentry-ip-bierbaron.vercel.app) | Filter wirft nie, mehr IP-Header, statischer Test je Aufruf (Runde 1); Tests geschärft (Runde 2); zwei Nachprüfungen | nein |
| 38 | Double-Opt-in (S11) | #217 | `main` | **JA** (Expand) | [Vorschau](https://farmer-zone-git-nacht-2026-10-0738-double-opt-in-bierbaron.vercel.app) | Blocker „Ausschalten wirkt nicht" plus Replay plus Checkout-Test (Runde 1); Regression „bestätigt → aus hängt" (Runde 2); zwei Nachprüfungen; **ein „Sollte" offen** (Rückgabetyp, siehe PR) | nein |
| 39 | Direktverkauf senkt den Vorrat (D1) | #216 | `main` | **nein** | [Vorschau](https://farmer-zone-git-nacht-2026-10-0739-direktverka-0c23ce-bierbaron.vercel.app) | Blocker „Menge änderte still ihre Einheit" → Grundeinheit plus Decimal (Runde 1); Anzeige exakt wie Server (Runde 2); Nachprüfung ohne Befund | nein, aber **Annahmen freigeben** |
| 40 | Rate-Limit über die Datenbank (R1) | #218 | `main` | **JA** (Expand) | [Vorschau](https://farmer-zone-git-nacht-2026-10-0740-rate-limit-db-bierbaron.vercel.app) | kein Blocker; Datenschutz-Einordnung im Bericht korrigiert (Runde 1, nur Doku) | nein |
| Sammel | Alle obigen zusammengeführt | **#219** | `main` | **JA** (beide) | [Vorschau](https://farmer-zone-git-integration-lauf7-bierbaron.vercel.app) | Gesamtstand grün (unten) | nein |

Die Vorschau-Links sind Branch-Adressen und zeigen immer den neuesten Stand des PR.

**Migrationen (beide nur Expand, nach Regel 3 erzeugt, vom `tester` gegen `prisma migrate diff` verglichen):**

```sql
-- #217 · prisma/migrations/20261007180000_double_opt_in
SET lock_timeout = '5s';
ALTER TABLE "CustomerFarmSubscription" ADD COLUMN IF NOT EXISTS "emailOptInAngefragtAm" TIMESTAMP(3);
ALTER TABLE "CustomerFarmSubscription" ADD COLUMN IF NOT EXISTS "emailOptInBestaetigtAm" TIMESTAMP(3);

-- #218 · prisma/migrations/20261007200000_rate_limit_db
SET lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS "RateLimitZaehler" ("schluessel" TEXT NOT NULL, "fensterStart" TIMESTAMP(3) NOT NULL,
  "zaehler" INTEGER NOT NULL DEFAULT 0, "ablauf" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitZaehler_pkey" PRIMARY KEY ("schluessel","fensterStart"));
CREATE INDEX IF NOT EXISTS "RateLimitZaehler_ablauf_idx" ON "RateLimitZaehler"("ablauf");
ALTER TABLE "public"."RateLimitZaehler" ENABLE ROW LEVEL SECURITY;
```

- **Weg in die Datenbanken:** Die Pushes haben beide Migrationen über die Vorschau-Builds in die Entwicklungsdatenbank gespielt. Produktion bekommt sie über `vercel-build` beim Merge auf `main`.
- **Keine weiteren Migrationen:** Bei keiner anderen Nummer ist eine Migration oder Schemaänderung entstanden.

**Ablauf je Nummer:**
- Frischer Umsetzer, danach `tester` und `pruefer`, höchstens zwei Nachbesserungsrunden.
- Nachprüfung der Fix-Commits bei 35, 37, 38 und 40 (Geld bzw. Sicherheit), bei 39 zusätzlich wegen des Bestands.
- Typecheck und Tests habe ich vor jedem Push selbst wiederholt.
- **Parallelbetrieb:** 36, 37 und 39 liefen parallel in eigenen Arbeitsbäumen. 40 bekam eine eigene Kopie von `node_modules`, damit sich die Prisma-Clients von 38 und 40 nicht in die Quere kommen. Integrationstests liefen über eine Sperre nacheinander.

## 3. Sammel-PR #219 (`integration/lauf7`)

**Reihenfolge**, je `git merge --no-ff`: #212 → #213 → #214 → #215 → #217 → #216 → #218. Entwürfe gibt es keine.

**Prüfung auf dem Gesamtstand:**
- `pnpm typecheck` grün.
- `pnpm lint` 13/7 wie auf `main`.
- `pnpm test` **286 Dateien / 5456 Tests** grün.
- `pnpm test:integration` **36 / 328** grün.
- Regel-3-Diff auf dem Gesamtstand = genau die beiden Migrationen.

**Konfliktauflösungen:**
- **Code: keine Konflikte.** Drei Code-Dateien ändern zwei PRs zugleich; Git hat sie sauber zusammengeführt:
  - `prisma/schema.prisma` (#217 und #218),
  - `src/app/api/checkout/route.ts` (#217 Abo im eigenen `try`, #218 Bremse vor dem ersten Schreiben),
  - `src/server/actions/status-posts.ts` (#213 Produktprüfung, #217 Empfänger-Filter).

  Die Integrationstests decken alle drei Stellen ab.
- **`DEVELOPMENT.md`** bei #214, #215, #217, #216 und #218: beide Seiten behalten, die Einträge 35 bis 40 stehen hintereinander.
- **`docs/ai/ARCHITECTURE.md`** bei #218: Die S11-Regel aus #217 bleibt stehen, ebenso der von #218 geänderte E7-Absatz. **Nachgearbeitet:** Die einfache Vereinigung hätte den E7-Absatz doppelt gelassen (alte und neue Fassung). Die alte Fassung aus `main` ist entfernt.
- **Kontrolle:** Jede Zeile, die ein PR in `DEVELOPMENT.md`/`docs/ai/*` hinzufügte, steht im Ergebnis. Keine Zeile, die ein PR ersetzt hat, steht noch darin.

**Merge-Empfehlung:** Nur **#219** mergen, per Merge-Commit. Die Einzel-PRs gelten danach als gemergt. Wer lieber einzeln merged, nimmt dieselbe Reihenfolge und **#217 vor #218**.

## 4. Für dich zu tun

1. **Stripe in der Vorschau trennen.** Eigene `STRIPE_*`-Variablen nur für *Preview* mit Test-Schlüsseln anlegen, die bestehenden auf *Production* beschränken (Abschnitt 1). Bis dahin in Vorschauen nie mit echter Karte zahlen.
2. **Probelauf vor Ort mit dem Pilothof.** Die 12 Abläufe aus Abschnitt 1 einmal mit echtem Gerät durchgehen. Nach Punkt 1 kann das auch Nr. 34 automatisch nachholen.
3. **Sentry-Dashboard:** Unter Projekt-Einstellungen → Security & Privacy „Prevent Storing of IP Addresses" einschalten bzw. prüfen (#215). Sitzungsdaten laufen nicht durch unseren Filter, dagegen hilft nur diese Einstellung.
4. **Zahl der bestehenden Abonnenten** ermitteln (nur lesend). Vor dem Deploy von #217:
   ```sql
   SELECT count(*) AS abos, count(DISTINCT lower("customerEmail")) AS adressen
   FROM "CustomerFarmSubscription" WHERE "optInEmail" = true;
   ```
   - Abfragen für die Zeit nach dem Deploy und je Hof stehen im PR #217.
   - Bestehende Abonnenten bekommen unverändert weiter Mails.
   - **Wie mit ihnen umgegangen wird, entscheidest du (S11).**
5. **BAES-Text gegenlesen (#214).** Wichtigster Punkt ist der Satz „eine Registrierung brauchst du dafür nicht" für selbst abgepacktes Heimtierfutter (§ 8 Abs. 7 FMV 2010).
   - Der Gesetzestext war aus dem Container nicht erreichbar.
   - Suchergebnisse nennen für *Herstellung* eine Registrierungspflicht.
   - Die verlinkte FAQ-Seite ist die englische Fassung; eine deutsche gibt es laut Suche.
   - Ein Vorschlag für eine CLAUDE.md-Ergänzung zur Behörden-Ausnahme steht im Bericht 36.
6. **Vorratslogik freigeben (#216):**
   - Die Menge bleibt in der Grundeinheit; der Server rechnet die Gebinde und rundet auf.
   - Bei Unterdeckung wird der Vorrat auf 0 gesetzt.
   - Bei abweichender Einheit wird nichts abgezogen.
   - Offen fürs Register: Ändern oder Löschen eines Verkaufs bucht nicht zurück.
7. **Datenschutzerklärung (#218, O4):** Der neue Zähler speichert bis etwa 25 Stunden einen HMAC aus IP-Adresse, E-Mail oder Sitzung. Ein Satzvorschlag steht im Bericht 40, eingebaut ist er nicht. Außerdem fehlt im Text noch der Double-Opt-in (#217), und Einträge aus Lauf 6 (#210) sind ebenfalls offen.
8. **Registrierung bekommt eine Bremse (#218):** 10 Versuche pro Minute je IP; bisher gab es keine. Bitte zur Kenntnis nehmen.
9. **Mockup-Abweichungen freigeben:**
   - #213: Pfeile in „Mein Auftritt", Marken „Online bezahlen" und „Bar bei Abholung".
   - #214: Fall-Texte im Futter-Formular, Kontaktzeile.
   - #216: Schalterzeile, Hinweis-Toasts.
   - #217: neue Bestätigungsseite, Hinweis „Wartet auf deine Bestätigung", Zeile im Checkout.

## 5. Offene Punkte für einen späteren Lauf
- **#217:**
  - `loeseOffeneAnfrageAuf` braucht einen ausdrücklichen Rückgabetyp; die Nachbesserungsrunden waren ausgeschöpft.
  - Die Quelltext-Wache für `optInEmail: true` lässt sich noch schärfen.
  - WhatsApp-Opt-in ist von S11 nicht erfasst.
  - Ein List-Unsubscribe-Kopf fehlt.
- **#215:** `logentry`, `tags`, `extra`, übrige `contexts`, `frame.vars` und Brotkrumen-Daten laufen weiter ungefiltert durch die Sentry-Hygiene. Das stammt aus der Zeit vor diesem Lauf.
- **#218:**
  - Fällt die Datenbank aus, kommt je gebremstem Aufruf ein Sentry-Event; eine Drosselung fehlt.
  - Die Bremse in `reserve`, `warenkorb/pruefen` und Teilen bleibt einstufig.
- **#213:** Die `minCents`-Meldungen der Servicegebühr sind nicht geduzt und nennen keinen Ausweg; nur Admins sehen sie.
- **Mockups:** Im Mockup `mobil-h2-neues-futter-meldung-fehlt` steht noch „über das USP".

## 6. Aufgeräumt
- Lokale Dev-Server sind beendet.
- Die Umsetzer haben ihre Testdaten in der lokalen Test-DB laut ihren Berichten wieder entfernt.
- Die Arbeitsbäume der Nummern sind entfernt.
- Postgres ist gestoppt.
