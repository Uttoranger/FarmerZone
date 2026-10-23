# Morgenbericht Lauf 23 (23.10.2026)

**Ausgangslage je Nummer am Code bestätigt:** 149 ja · 150 ja · 151 ja · 152 ja · 153 ja · 154 ja · 155 ja · 156 ja · 157 ja. Keine Nummer gestoppt oder übersprungen. Keine Migration, kein neues Paket, keine neue Variable, kein Betrag neu gerechnet. Haltepunkt: Sammel-PR `integration/lauf23`.

**Eine Nummer ist nur teilweise fertig: 155 hat keine Bilder.** `/admin` verlangt eine Passkey-Anmeldung. Lokal ginge das nur über eine Sitzung oder einen Einrichtungscode, die in die Datenbank geschrieben werden. Das hat die Sicherheitsprüfung der Umgebung zu Recht abgelehnt, und es wurde nichts umgangen. Die Abnahme mit Bild machst du in der Vorschau (PR #369, Schritte dort).

Wie in Lauf 22: agent-browser ist im Cloud-Container nicht installiert, Bilder liefen mit dem vorinstallierten Playwright (eigene Chromium-Instanz ohne Anmeldungen, nie Claude in Chrome); axe-core fehlt.

## PRs

| Nr | PR | Basis | Runden |
|---|---|---|---|
| Doku | [#362](https://github.com/Uttoranger/FarmerZone/pull/362) | main | – |
| 154 | [#363](https://github.com/Uttoranger/FarmerZone/pull/363) | `docs/lauf23` | 0 |
| 149 | [#364](https://github.com/Uttoranger/FarmerZone/pull/364) | `docs/lauf23` | 1 |
| 156 | [#365](https://github.com/Uttoranger/FarmerZone/pull/365) | `docs/lauf23` | 0 |
| 150 | [#366](https://github.com/Uttoranger/FarmerZone/pull/366) | `docs/lauf23` | 0 |
| 151 | [#367](https://github.com/Uttoranger/FarmerZone/pull/367) | `docs/lauf23` | 1 (nur Doku) |
| 152 | [#368](https://github.com/Uttoranger/FarmerZone/pull/368) | `docs/lauf23` | 0 |
| 155 | [#369](https://github.com/Uttoranger/FarmerZone/pull/369) | `integration/lauf23` | 2 (Bilder) |
| 153 | [#370](https://github.com/Uttoranger/FarmerZone/pull/370) | `integration/lauf23` | 0 |
| 157 | [#371](https://github.com/Uttoranger/FarmerZone/pull/371) | `integration/lauf23` | 0 |
| Sammel 23 | Sammel-PR `integration/lauf23` → main (Link im Chat) | main | – |

CI (`ci`, `integration`, Vercel-Vorschau) bei #362–#368 grün vor dem Sammel-PR; die Vorschau-Links stehen je PR.

**Sammel-PR:** `integration/lauf23` = `docs/lauf23` + 154 (Zwischenstand) + 151, 156, 149, 150, 152, 155, 153, 157, je `--no-ff`.
- **Konflikte:** `DEVELOPMENT.md` (beide Seiten); `src/lib/bremse-datenbank.ts` (die drei Einträge `barLinkBestellung` 151, `reserveIp` 150 und `stripeKontoLand` 152 alle behalten); `BAUSTEINE.md` je über `pnpm bausteine`.
- **Ein Dirigent-Fix:** `tests/status-new-mailsperre.test.ts` aus 149 kannte die Wache `verlangeHofDerSitzung` aus 156 nicht (voller Lauf rot, 2 Tests). Der Test bekam dieselbe Attrappe wie die übrigen Seiten-Tests aus 156, nur der Test.
- **Sammelstand:** voll typecheck grün, lint 0 Fehler (5 Warnungen), 543 / 10331 (n=1, 3 Worker); Integration ganz 74 / 641.
- **Regel 3:** frische lokale DB, `migrate deploy` (34 Migrationen), `migrate diff --exit-code` ohne Unterschied.

## Zu einzelnen Nummern

**149 – Zeit je Mail.**
- Gemessen (lokal, Resend-SDK als Attrappe, 200 Mails): Vorlage und `sendRaw` ohne Netz brauchen 2,3 ms je Mail.
- Nicht gemessen (keine schreibenden Aufrufe an Resend): die Antwort der API. Angenommen sind 0,1–0,3 s je Mail.
- Damit wird es eng ab etwa **45–50 Abos**, wenn die Funktion 15 s hat (Pro ohne Fluid Compute), bzw. ab **900–1 000 Abos** bei 300 s (Fluid Compute). Welche Vorgabe gilt, steht nicht im Repo.
- Resend begrenzt die Anfragen je Sekunde. Mails über der Grenze kommen jetzt als Fehler zurück, zählen nicht und gehen an Sentry; vorher blieben sie stumm.
- Vorschlag: Pause zwischen den Mails oder Batch.

**150 – Reihenfolge der Prüfungen.**
- `/api/reserve`: Speicher je IP → Parsen → Speicher je Sitzung → Datenbank (`reserveIp`) → Fristfreigabe → Aufräumen → Stilllegung → Freischaltung → Pause → Kaufsperre → Bestand → `upsert`.
- `/api/warenkorb/pruefen`: Speicher je IP → Parsen → Datenbank (derselbe Zähler) → Fristfreigabe → Abgleich → Erneuern.
- **Zur Entscheidung:**
  - (1) Eine gemeinsame Prüfkette für `pruefen`: Heute hält es Ware ohne Prüfung von Stilllegung, Freischaltung, Pause und Kaufsperre und ohne `MAX_MENGE`. Geld ist nie betroffen.
  - (2) Eine Obergrenze je Sitzung; Höfe mit Futter in großen Mengen bedenken.
- Hinweis: Kundinnen hinter einer gemeinsamen Adresse teilen sich die 20 je Minute.

**151 – Klartext-Token.**
- Bestellungen von vor dem Deploy bleiben über den Klartext-Kandidaten gültig. Ein offener Klartext-Link bestätigt höchstens bis zum Ende der Barfrist (`fristVon`, höchstens zwei Stunden nach der Bestellung), also höchstens zwei Stunden nach dem Deploy.
- Stornierte Bestellungen behalten ihren alten Wert.
- **Folgeauftrag (braucht deine Freigabe, Datenänderung in Produktion):** den Klartext-Zweig aus `tokenKandidaten` entfernen und alle Werte ohne `h1:` auf `null` setzen.

**152 – Vorschläge (nicht gebaut).**
- Das Land vor „Einrichten“ zeigen: Wer Stripe vor der Landwahl einrichtet, bekommt weiter ein AT-Konto.
- `src/lib/json-ld.ts` setzt `addressCountry: 'AT'` auch für deutsche Höfe.

**154 – Wache vorher → nachher:**

| Action | vorher | nachher |
|---|---|---|
| `approveFarmAction` | `verlangeAdminAktion` | `verlangeFrischeBestaetigung` zuerst |
| `setServiceFeeAction` | `verlangeAdminAktion` | `verlangeFrischeBestaetigung` zuerst |
| `setzeGruendungBisAction` | `verlangeAdminAktion` | `verlangeFrischeBestaetigung` zuerst |
| `sendeRundschreiben` | Eingabe, dann `verlangeAdminAktion` | `verlangeFrischeBestaetigung`, dann `verschickeRundschreiben` |
| `fuegeEmpfaengerHinzu` | Eingabe, dann `verlangeAdminAktion` | `verlangeFrischeBestaetigung`, dann Eingabe |
| `veroeffentlicheStartseite` | `verlangeAdminAktion` | `verlangeFrischeBestaetigung` zuerst |
| `setzeBuendelStandAction` | `verlangeAdminAktion`, Bescheid über `sendeRundschreiben` | unverändert `verlangeAdminAktion`, Bescheid über `verschickeRundschreiben(…, guard.userId)` (N20-Ergänzung) |

**155 – Abweichung vom Mockup (ohne Bild, siehe oben).**
- `docs/mockups/admin-startseite-entwurf.html` zeigt bei offenem Block rechts das Formular und keine Vorschau.
- Neu steht ab 1024 px links das Formular statt der Liste, rechts bleibt „So sieht’s die Kundin“ (N16, Ergänzung 23.10.2026).
- **Erweiterung über den Wortlaut, bitte bestätigen:** Ist der eben geschlossene Block am gezeigten Tag schon vorbei, steht „„<Titel>“ ist an diesem Tag nicht zu sehen – live bis <Tag, Uhrzeit>.“ statt „live ab“.

**156 – Seiten mit der neuen Wache `verlangeHofDerSitzung`** (25):
- Seiten: analytics, customers, customers/[kundeId], dashboard, farm-page, fehler-melden, meldungen, orders, orders/[orderId], postfach, postfach/[id], products, region, sales, settings, settings/account, settings/konditionen, settings/pause, settings/payments, settings/pickup-slots, settings/profile, settings/teilen, status/[id]/send-whatsapp, status/new, status/plakat.
- Unverändert, weil sie nur umleiten: analytics/umfeld, settings/appearance, status.
- Ohne Hof führen jetzt alle auf `/onboarding`; `/settings/payments` zeigt nie mehr eine leere Seite.
- Eine Quelltext-Wache prüft alle 28 Seiten.

**157:** alle drei Punkte klein und erledigt. Die Branch heißt `157-hof-kleinkram` statt `157-kleinkram-hof` wie in status.md vorgesehen; die Statuszeile ist angepasst.

## Grenzen erweitert (Dirigent)
- **151:** `docs/ai/ARCHITECTURE.md` (Absatz „Seiten mit Daten einer Bestellung“: zwei Schreibwege über die Signatur) und der Kopfkommentar in `src/lib/bestell-link.ts`. Beide widersprachen dem Weg, den die Freigabe anordnete. Die Runde änderte nur Kommentare und Doku; den Rundendiff hat der Dirigent selbst gelesen statt tester ∥ pruefer, der volle Lauf war grün.
- **154:** Ein zusätzlicher Satz in ARCHITECTURE (~Z. 113) zum Muster „Weg ohne Wache in Server-Modul“.
- **155:** In `docs/ai/DESIGN_SYSTEM.md`, Absatz „Entwurf und Fassung“, ist ein Halbsatz an den neuen Aufbau angepasst. Im Absatz Admin › Startseite stehen jetzt 480 statt 520 px, wie der Code. Beides im Sammel-PR.
- **150:** In der Bremsen-Tabelle in ARCHITECTURE ist „Reservieren und Halte erneuern“ in der Zeile „R1, zweite Stufe“ ergänzt (im Sammel-PR).
- **157:** `src/lib/pickup-slot-rules.ts` (Textkonstante `ABHOLZEIT_GELOESCHT`, folgt aus „Texte aus einer Quelle“).
- **152, 153:** `docs/ai/BAUSTEINE.md` (erzeugt, folgt aus neuen Exporten).

## Regelvorschläge
- **Dirigent (155):** Ein Bild, das nach begründeter Prüfung nicht herstellbar ist, wertet der Workflow als „GRENZE (Dirigent)“ und nicht als Blocker; zwei Runden mit vollem Lauf haben in Lauf 23 nichts daran geändert. Dazu kommt ein Skript des Dirigenten, das Admin-Bilder auf localhost über den echten Weg macht (Passwort, Code aus einer lokalen Mail-Falle der Post-Sperre, virtueller Authenticator). Alternativ macht die Projektleitung Admin-Bilder selbst. Ort: docs/nachtlauf.md 4a Punkt 6.
- **151:** Beim Schreiben einer Freigabe Wächter und Regelstellen, die eine genannte Funktion zählen (`git grep` auf den Namen in tests/ und docs/ai), gleich in die Grenze aufnehmen. Ort: docs/nachtlauf.md 4a Punkt 1.
- **154:** Ruft eine Server Action eine andere `'use server'`-Action auf, ist das ein Fund; eine Wache am Quelltext meldet Importe aus `@/server/actions/` innerhalb von `src/server/actions/`.
- **149:** Jede Schleife über Mails läuft über `nachDerAntwort`, zählt die angenommenen und meldet Fehler je Mail (CODING_STANDARDS §4).
- **156:** Neue Hof-Seite → Wache `verlangeHofDerSitzung` Pflicht (steht in ARCHITECTURE, der Test listet die Seiten).
- **Dirigent (Zwischenstand):** Teilen sich zwei Nummern eine Datei (hier 149 und 156 auf `status/new/page.tsx`), schreibt die zweite ihre Tests gegen den Stand der ersten. Sonst merkt erst der Zwischenstand den Bruch.

## Nicht begonnen
Keine. Alle Nummern aus §1 sind gelaufen.

## Bilderstrecke
- 151: `docs/nachtlauf/berichte/bilder/151/` – 390-hell-vor-dem-senden, 390-hell-nach-dem-senden (Bestellung per SQL für einen Seed-Hof unter `integration.lock`, danach gelöscht; keine Mail verschickt).
- 153: `docs/nachtlauf/berichte/bilder/153/390-hell-abgeholt.jpg` (abgeholte Online-Bestellung ohne Adresse; Bestellung danach gelöscht).
- 157: `docs/nachtlauf/berichte/bilder/157/abholzeit-geloescht-toast.jpg`, `bestaetigt-abgemeldet.jpg` (Seed-Hof `hof-mueller`; Zeit per „Rückgängig“ zurück).
- 155: fehlen (siehe oben).

## Nacharbeit („Sollte“)
- 149: Pause zwischen Beitragsmails oder Batch; die Zahl in Heute (`emailAnzahl`) ohne Bedingung; die Teststärke von `mailSperreWo` (Inhalt prüfen); ein adressfreier `code` für Resend-Fehler an Sentry; dieselbe Quelle für den Satz „{n} E-Mails werden …“ im Assistenten.
- 150: Kopfkommentar in `src/lib/rate-limit.ts` („die übrigen Routen bleiben bei dieser einen Stufe“); in `tests/reservations.test.ts` das `!` am Testgeheimnis und die Attrappe von `enforceRateLimit` für die ganze Datei.
- 151: eigenes `bestellLinkSchema` statt des geliehenen `neuigkeitenAnmeldenSchema`; der Cookie-Hinweis verdeckt im Bild die Positionskarte.
- 152: `hofLand` als `Land` typisieren; `mockImplementation` auf Sentry → `mockImplementationOnce`; Test „einmal je Tag“ als Folge; Kopfkommentar `hofkonto-unbekannt.ts`.
- 153: `status: OrderStatus` in der Seite; Gegenprobe „bar offen“ schärfen; eventuell ein Satz zu S17 Punkt 3 in ARCHITECTURE §5.
- 154: Kopfkommentar `postfach.ts`; doppelte `satzAus`/`meldeNachlauf`; ein Unit-Fall „gültige Eingabe, nicht frisch“; Integrations-Gegenprobe `fuegeEmpfaengerHinzu`.
- 156: doppelte Abfragen von Sitzung und Hof in einzelnen Seiten (Lader und Wache).
- 157: **`holeZurueck` fängt keinen Fehler ab** (wirft `addPickupSlot`, etwa ohne Netz, sieht der Hof keinen Toast) → try/catch mit `toast.error`; Gegenprobe der Packliste über die Reihenfolge der Attrappen; `/verify` verlinkt im Zustand „schon bestätigt, abgemeldet“ weiter auf `/login?von=/verify` (außerhalb von 157).

## Zeitbuch
`docs/nachtlauf/berichte/zeitbuch-lauf23.md` (4 Kerne; je Nummer Umsetzer, volle Läufe mit n und Workern, Integration, Runden; drei Sätze).

## Für dich zu tun
- [ ] **Abnahme 155** (Vorschau, als Admin, 1440 px; Schritte in PR #369), gern mit Bildern hell und dunkel; den Satz „live bis“ bestätigen oder einen anderen vorgeben.
- [ ] **Abnahme 154** (Vorschau, als Admin): einen wartenden Hof freischalten, mehr als 5 Minuten nach der Anmeldung → Passkey-Abfrage, danach freigeschaltet.
- [ ] **Abnahme 156** (Vorschau, als Hof): eine Bestellung öffnen, Cookie löschen, neu laden → Anmeldung → zurück auf derselben Bestellung.
- [ ] **Abnahme 151** (Vorschau): Barbestellung mit erfundener Adresse unter TEST_EMPFAENGER → „Mail nicht bekommen? Erneut senden“ → der alte Link gilt nicht mehr, der neue bestätigt.
- [ ] **Abnahme 149** (Vorschau): zwei erfundene Abos unter TEST_EMPFAENGER, Beitrag „Per E-Mail“ → „… wird an 2 Abos verschickt“, Mein Hof zeigt „2 per E-Mail“.
- [ ] **152:** im Stripe-**Test**modus einen DE-Testhof einrichten (Konto muss DE sein) und eine Testzahlung bis zur Überweisung durchspielen.
- [ ] **Merge:** den Sammel-PR per Merge-Commit (nicht Squash); danach die CI auf main ansehen.
- [ ] **Danach in der Produktion mit Stripe im Testmodus:** Abnahme von 151, 154 und 155.
- [ ] **Entscheidungen:** 150 (Prüfkette, Grenze je Sitzung); 151 Folgeauftrag (Klartext entfernen, Datenänderung); 152 Vorschläge; 149 Pause/Batch; die Regelvorschläge oben; wie Admin-Bilder künftig entstehen.
- [ ] **Ab 28.10.:** CSP-Meldungen in Sentry ansehen (Tag `bereich:csp`). `frame-src 'self'` aus 155 ist die Voraussetzung, dass die Vorschau-Rahmen mit der scharfen CSP nicht blockiert werden.
