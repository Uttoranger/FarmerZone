# Probelauf-Checkliste (Nachholung von Nr. 34)

**Status Nr. 48: erledigt (Checkliste).** Stand 08.10.2026, Nachtlauf 8. Auftrag: `freigabe.md` §12 „48", Abläufe aus §11 „34".

Nr. 48 sollte die zwölf Abläufe aus Nr. 34 selbst durchspielen. Aus der Nacht-Sitzung waren aber weder die Vorschau noch die Stripe-Schnittstelle erreichbar. Deshalb gehst du die Abläufe hier selbst durch, am Handy und im Browser. Fehler, die du findest, werden danach als 48a, 48b … behoben, jeder mit einem Test, der den Fehler zeigt.

**Grundregeln**

- Bestellt wird nur in der Testumgebung und nur mit Testkarten. In der Produktion (`farmerzone.at`) schaust du nur, du bestellst dort nichts (Abschnitt 8).
- In Stripes Formulare kommen nur Testdaten: keine echten Namen, Adressen oder Kontonummern.
- Zu jedem Fehler notierst du Bestellnummer, Uhrzeit und ein Bildschirmfoto. In Berichte kommen keine Namen und keine Adressen.
- Die Beträge stammen aus dem Code: `src/lib/servicegebuehr.ts`, `src/app/api/checkout/route.ts`, `src/lib/artikel-fehlt.ts`, `src/lib/storno.ts` und `markAsNotPickedUp` in `src/server/actions/orders.ts`. Sie sind gegen diese Funktionen nachgerechnet.

Inhalt:

- 0 Ort und Vorbedingung
- 1 Ein Test-Schlüssel für Vorschau und Produktion
- 2 Testhof vorbereiten
- 3 Beträge auf einen Blick
- 4 Die zwölf Abläufe
- 5 Hof-Anmeldung am Handy (Nr. 41)
- 6 Rückweg (Nr. 44)
- 7 Unbekanntes Hof-Konto (Nr. 42)
- 8 Testbetrieb-Hinweise (Nr. 42)
- 9 Kasse nach Nr. 46
- 10 Abschluss und Aufräumen
- 11 Ergebnis

---

## 0. Ort und Vorbedingung

| | |
|---|---|
| Ort | `https://test.farmerzone.at`, sobald die Testumgebung nach `docs/betrieb/testumgebung.md` (Nr. 43) steht. Bis dahin die Branch-Adresse des Sammel-PR: `https://farmer-zone-git-integration-lauf8-bierbaron.vercel.app`. Die genaue Adresse steht im PR unter „Vorschau". Unten heißt diese Adresse kurz **Ort**. |
| Zugang | Nur mit Vercel-Anmeldung. Du arbeitest mit **drei getrennten Browserprofilen** oder drei Browsern: **Hof**, **Admin** und **Kundin**. Fenster desselben Profils teilen sich die Anmeldung: Meldest du dich dort als Admin an, ist der Testhof abgemeldet. Jedes Profil braucht seine eigene Vercel-Anmeldung, sonst zeigt Vercel nur seine Anmeldeseite. Der Browser am Handy ist ein weiteres Profil und braucht sie ebenfalls. |
| Daten | Die Entwicklungsdatenbank, nie die Produktion. |
| Stripe | Testmodus. Auch das Stripe-Dashboard öffnest du im Testmodus. |

- [ ] Drei Profile sind eingerichtet: Hof, Admin und Kundin. In jedem bist du bei Vercel angemeldet, und der Ort lässt sich öffnen.
- [ ] **Vorbedingung A:** Oben auf jeder Seite steht das Banner „TESTUMGEBUNG · Dev-Datenbank · Stripe Test · \<Branch\>", am Handy kurz „TEST · Dev-DB · Stripe Test". Steht dort „Stripe LIVE", „Stripe fehlt" oder „Fremde Datenbank": **Stopp.** Bestell nichts und melde es. Den Schlüssel liest du nie aus und entschlüsselst ihn nie; das Banner genügt (Register Z2). Denselben Blick wiederholst du vor jedem Schritt, der bezahlt oder Geld zurückbucht. Dort steht jeweils der Haken „Banner zeigt ‚TEST · Dev-DB · Stripe Test‘".
- [ ] Das Stripe-Dashboard steht im Testmodus. Der Schalter bzw. Hinweis „Testmodus" ist oben zu sehen.

## 1. Ein Test-Schlüssel für Vorschau und Produktion – was das für den Probelauf heißt

Bei Vercel gibt es heute EINE Gruppe `STRIPE_*`-Variablen. Vorschau und Produktion nutzen beide denselben Test-Schlüssel (Register Z2). Daraus folgt:

1. **Ein gemeinsames Stripe-Testkonto.** Zahlungen, Erstattungen und verbundene Hof-Konten aus dem Probelauf stehen im Dashboard neben den Testzahlungen der Produktion. Deine Zahlungen findest du über die Bestellnummer: Jede Zahlung trägt in den Metadaten `orderNumber`, dazu `orderId` und `farmId`. Außerdem hängen sie am verbundenen Konto deines Testhofs.
2. **Webhooks gehen an alle Test-Endpunkte.** Stripe schickt jedes Ereignis im Testmodus an jeden Endpunkt, der dort eingetragen ist.
   - Heute ist das der Endpunkt der Produktion, `https://farmerzone.at/api/stripe/webhook`. Nach Nr. 43 kommt der Endpunkt der Testumgebung dazu.
   - Jede Zahlung aus dem Probelauf erreicht also auch die Produktion. Die Produktion kennt die Bestellung nicht und quittiert mit 200. Sie ändert nichts und meldet nichts an Sentry (im Code geprüft, Bericht 48, „Webhook-Prüfung").
   - Im Protokoll der Produktion steht je bezahlter Testbestellung eine Zeile „[Webhook] Order not found for PaymentIntent …". Das ist erwartet.
   - Einzige Ausnahme: Eine Erstattung, die bei Stripe scheitert, meldet die Produktion einmal an Sentry und per Mail an den Betreiber („keiner Buchung der App zuzuordnen"). Mit den Testkarten hier scheitert keine Erstattung.
   - Umgekehrt erreicht jede Testzahlung der Produktion auch die Testumgebung. Dort wird sie genauso still quittiert.
3. **Die Testumgebung bekommt nur Ereignisse, wenn sie einen eigenen Endpunkt hat.** Bezahlt setzt erst der Webhook. Ohne eigenen Endpunkt bleibt jede Online-Bestellung dort auf „Zahlung wird geprüft", beim Hof auf „Online, noch offen". Dann lassen sich die Abläufe 1, 2, 3, 7, 8 und der Online-Teil von 9 nicht prüfen.
   - Der Endpunkt braucht ein eigenes Signing Secret als `STRIPE_WEBHOOK_SECRET`, nur für den Branch. Sonst lehnt die Testumgebung jede Zustellung mit 400 ab.
   - Er braucht außerdem einen Weg an der Vercel-Sperre vorbei. Sonst bekommt Stripe 401.
   - Beides beschreibt `docs/betrieb/testumgebung.md`, Schritte 3 und 5 (Nr. 43).
4. **Live ist ausgeschlossen.** Ein Live-Schlüssel startet in der Vorschau gar nicht (Nr. 42). Das Banner muss „Stripe Test" zeigen.

### Webhook der Testumgebung einrichten (einmal, vor Ablauf 1)

- [ ] **test.farmerzone.at:** Endpunkt, Weg an der Vercel-Sperre vorbei und Signing Secret nach `docs/betrieb/testumgebung.md`, Schritt 5. Dazu `STRIPE_WEBHOOK_SECRET` nur für den Branch `staging` (Schritt 3), dann `staging` neu deployen.
  - Lies dort auch, was das Geheimnis für die Vercel-Sperre kann: Es öffnet alle geschützten Deployments des Projekts.
- [ ] **Branch-Adresse von `integration/lauf8`**, solange es test.farmerzone.at nicht gibt: dieselben Schritte. Nur ist die Branch-Adresse die Adresse des Endpunkts, und die Variable gilt für den Branch `integration/lauf8` statt `staging`.
  - Die Ereignisse sind dieselben wie bei Endpunkt A in `docs/betrieb/stripe-live.md`, Schritt 3.
  - Danach `integration/lauf8` neu deployen: Deployments → neuestes Deployment des Branch → Redeploy. Variablen wirken erst im nächsten Deployment.
- [ ] Den bestehenden Eintrag `STRIPE_WEBHOOK_SECRET` für Production fasst du nicht an.
- [ ] Prüfung nach der ersten Zahlung (Ablauf 1a): Stripe zeigt beim Endpunkt der Testumgebung die Zustellung mit Antwort 200. Eine 401 heißt: Vercel-Sperre. Eine 400 heißt: falsches Secret.

## 2. Testhof vorbereiten (einmal)

Testhof heißt hier ein Hof der Entwicklungsdatenbank, der nur zum Testen da ist. Am schnellsten geht es mit einem Seed-Konto (`…@example.com`, Passwort in `prisma/seed-daten.ts`). Mails an diese Adressen kommen nicht an; für den Hof brauchst du sie nicht.

- [ ] Im Profil **Hof** als Testhof anmelden: Ort → „Anmelden" → „Ich habe einen Hof".
- [ ] Einstellungen → Zahlung → „Mit Stripe einrichten". Stripe öffnet sein Formular im Testmodus.
  - Trag nur Testdaten ein. Stripe bietet im Testmodus Abkürzungen für Testdaten an. Sonst gelten Stripes Testwerte: SMS-Code `000000`, Geburtsdatum 01.01.1901, Adresszeile `address_full_match`, IBAN `AT611904300234573201`.
  - Erwartet nach der Rückkehr: grüne Karte „Dein Stripe-Konto ist eingerichtet. Online-Zahlung ist jetzt aktiv." und die Marke „Verbunden und aktiv".
  - Steht dort „Einrichtung nicht fertig": kurz warten, dann „Status prüfen".
- [ ] Stripe → Connect → Verbundene Konten: Das Konto des Testhofs ist neu und gehört nur ihm. Nie die Kennung eines echten Hofs in die Entwicklungsdatenbank übernehmen.
- [ ] In der Karte „Bar bei Abholung" steht „Immer aktiv".
- [ ] Im Profil **Admin** anmelden, z. B. mit `admin@example.com`. Dann Höfe → Testhof:
  - Der Hof ist freigeschaltet.
  - Servicegebühr „ändern": Prozentsatz 5, Mindestgebühr 0,50, „Gebühr gilt ab" heute oder früher. **Ohne Datum ist der Hof gebührenfrei, dann stimmen alle Beträge unten nicht.**
  - Die Provision bleibt 0. Dann zeigt Finanzen keine Zeile „Provision".
- [ ] Hof-Profil: eine erfundene Betriebsnummer eintragen, z. B. 9999999. Ohne Nummer lässt sich Futter nicht verkaufen (Ablauf 6).
- [ ] Abholzeiten: mindestens ein Fenster an einem der nächsten Tage. Für Ablauf 5 zusätzlich eines heute, das in etwa 20 Minuten beginnt.
- [ ] Produkte anlegen, genau mit diesen Preisen, damit die Beträge unten stimmen. Alle im Shop, Vorrat je 20:
  - „Test-Eier" € 4,90,
  - „Test-Honig" € 7,50,
  - Futter „Test-Heu": Neu → „Futtermittel", zwei Größen, beide lose bzw. in Ballen: „5 kg-Sack" € 4,90 und „Rundballen" € 45,00. Den Pflicht-Haken „Ich bestätige, dass meine Angaben … richtig und vollständig sind …" setzen.
- [ ] Einstellungen → Teilen: „Teilen-Hinweise zeigen" ist an (für Ablauf 11).
- [ ] Mail-Empfang. Gebraucht wird er in den Abläufen 4, 5, 7, 8 und 10 und in Abschnitt 9.
  - Außerhalb der Produktion verschickt die App Post nur an Adressen aus `TEST_EMPFAENGER` und an `@example.com` (Nr. 43). Alle anderen Mails gelten als „Nicht verschickt" und stehen nur gezählt im Log, ohne Adresse.
  - **Die Adresse der Kundin des Probelaufs muss deshalb in `TEST_EMPFAENGER` stehen.** Die Variable gilt nur für den Branch (`docs/betrieb/testumgebung.md`, Schritt 3). Nimm dafür eine eigene Adresse, die Mails empfängt.
  - Betreiber-Mails, etwa „Erstattung offen", kommen in der Testumgebung nur an, wenn auch die Support-Adresse (`SUPPORT_EMAIL`) in `TEST_EMPFAENGER` steht.
  - Ohne `RESEND_API_KEY` verschickt die Testumgebung gar nichts. Dann kommt auch der Code für Ablauf 10 nicht an.
- [ ] Admin → Finanzen, aktueller Monat: notier „Servicegebühr, online" als **S** und „Servicegebühr, vor Ort bezahlt" als **V**. In der Entwicklungsdatenbank liegen schon andere Bestellungen. Geprüft wird deshalb nur der Unterschied.

## 3. Beträge auf einen Blick

**Regel.**

- Servicegebühr (E4, `berechneServicegebuehr`): 5 % auf den Warenpreis, **immer auf den nächsten ganzen Cent aufgerundet**, mindestens € 0,50.
- Bar (B1): Bis 31. Jänner 2027 kostet Barzahlung keine Servicegebühr.
- Online (`/api/checkout`): Die Zahlung läuft über das Plattformkonto. Stripe überweist dem Hof den vollen Betrag und zieht als Anwendungsgebühr genau die Servicegebühr ab (Provision 0).
- **Hofanteil = Überweisung − Anwendungsgebühr = Warenpreis.**
- Stripes eigene Gebühr trägt die Plattform. In der App kommt sie nicht vor; Finanzen sagt dazu „Stripe-Gebühren sind hier noch nicht abgezogen."

**Rechnung in ganzen Cent.** Warenpreis in Cent × 5 / 100; bleibt ein Rest, kommt ein Cent dazu.

| Bestellung | Ablauf | Zahlart | Ware (Cent) | Gebühr gerechnet | Gebühr | Kundin zahlt | Anwendungs­gebühr | Überweisung an den Hof | Hofanteil |
|---|---|---|---|---|---|---|---|---|---|
| A | 1a, 7, 9a | Karte 4242 | 2 × Eier + 1 × Honig = 980 + 750 = 1.730 | 86,5 → 87 | € 0,87 | € 18,17 | € 0,87 | € 18,17 | € 17,30 |
| B | 1b, 9c | 3-D Secure | 1 × Eier = 490 | 24,5 → 25, unter 50 → Mindestgebühr | € 0,50 | € 5,40 | € 0,50 | € 5,40 | € 4,90 |
| C | 2 | Wallet | 3 × Eier = 1.470 | 73,5 → 74 | € 0,74 | € 15,44 | € 0,74 | € 15,44 | € 14,70 |
| D | 3, 8 | EPS | 1 × Eier + 1 × Honig = 1.240 | 62,0 → 62 (glatt) | € 0,62 | € 13,02 | € 0,62 | € 13,02 | € 12,40 |
| E | 4, 9b | bar | 2 × Eier = 980 | B1 → 0 | € 0,00 | € 9,80 bar | – | – | € 9,80 bar |
| F | 5 | bar | 1 × Honig = 750 | B1 → 0 | € 0,00 | verfällt | – | – | – |
| G | 6 | bar | 1 × Heu Rundballen = 4.500 | B1 → 0 (online wären es 225 → € 2,25) | € 0,00 | € 45,00 bar | – | – | € 45,00 bar |

**Was sich danach bewegt**

| Nach Ablauf | Kundin bekommt zurück | Rückbuchung vom Hof | Anwendungsgebühr | Plattform behält | Hofanteil danach |
|---|---|---|---|---|---|
| 7 (A, Honig fehlt) | € 7,87 = 7,50 + (0,87 − 0,50) | € 7,50 (fester Betrag) | bleibt € 0,87 | € 0,50 | € 9,80 |
| 8 (D, Storno) | € 13,02 (alles) | € 13,02 (ganze Überweisung) | € 0,62 zurück an den Hof | € 0,00 | € 0,00 |
| 9c (B, nicht abgeholt) | € 0,50 (nur die Gebühr) | keine | bleibt € 0,50 | € 0,00 | € 4,90 |

**Rechnung zu Ablauf 7 in Cent:**

- Neue Gebühr auf 980: 49,0 → 49, das liegt unter 50, also 50.
- Differenz: 87 − 50 = 37.
- Erstattung an die Kundin: 750 + 37 = 787.
- Vom Hof zurück: genau der Artikelpreis, 750.
- Plattform: 87 − 37 = 50.

**Admin → Finanzen, „Servicegebühr, online"** (Unterschied zu S):

- nach A +0,87, nach B +0,50, nach C +0,74, nach D +0,62,
- nach Ablauf 7 −0,37, nach 8 −0,62, nach 9c −0,50.
- Am Ende: S + € 1,24 mit Ablauf 2, S + € 0,50 ohne.
- „vor Ort bezahlt" bleibt V: Barbestellungen vor dem Stichtag bringen nichts ein (B1).
- Solange eine Online-Zahlung noch „wird geprüft", steht ihre Gebühr unter „erwartet: … aus N offenen Bestellungen". Das zeigt auch, ob der Webhook fehlt.

## 4. Die zwölf Abläufe

Als Kundin bestellst du im Profil **Kundin**, als Hof arbeitest du im Profil **Hof**, und Finanzen siehst du im Profil **Admin** (Abschnitt 0). Abholtermin: immer ein Fenster an einem der nächsten Tage, außer bei Ablauf 5.

Vor jedem Schritt, der bezahlt oder Geld zurückbucht, steht der Haken „Banner zeigt ‚TEST · Dev-DB · Stripe Test‘". Im Browser steht die lange Form „TESTUMGEBUNG · Dev-Datenbank · Stripe Test · …". Zeigt das Banner etwas anderes: Stopp.

### Ablauf 1 – Online mit Testkarte, auch 3-D Secure

**1a – Karte, Bestellung A**

1. Hofseite des Testhofs: 2 × Test-Eier und 1 × Test-Honig in den Korb, dann zur Kasse.
2. Abholtermin wählen, dann E-Mail (deine), Name und Telefon (erfunden).
3. „Online bezahlen" wählen, dann „Weiter zur Zahlung · € 18,17".
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
4. Im Zahlungsfeld: Karte `4242 4242 4242 4242`, Ablaufdatum in der Zukunft (z. B. 12/34), Prüfziffer beliebig (z. B. 123). Dann „Jetzt bezahlen · € 18,17".

Erwartet:

- [ ] Übersicht vor dem Bezahlen: „Warenpreis" € 17,30, „Servicegebühr · 5 %, mind. € 0,50" € 0,87, „Gesamt" € 18,17. Im Zahlungsschritt nennt die Kasse die Uhrzeit, bis zu der die Ware reserviert ist.
- [ ] Bestätigungsseite: erst kurz „Zahlung wird geprüft", nach dem Neuladen „Danke, deine Bestellung ist da!". Der Schritt „Bezahlt" ist erreicht. Die Kundin bekommt eine Mail.
- [ ] Hof → Bestellungen → A. A steht unter dem Filter „Noch offen", der gewählt ist, wenn die Seite aufgeht:
  - Der Betragskasten zeigt „Online bezahlt" und € 18,17.
  - Darunter steht „Warenpreis € 17,30 + Servicegebühr € 0,87 – die Gebühr ist online einbehalten."
  - Vorrat: Eier −2, Honig −1.
- [ ] Stripe → Zahlungen: € 18,17, erfolgreich. Die Metadaten `orderNumber` zeigen die Bestellnummer aus der App. In der Zahlung: Anwendungsgebühr € 0,87, Überweisung an das verbundene Konto des Testhofs € 18,17.
- [ ] Stripe → Connect → Verbundene Konten → Testhof: Eingang € 18,17, Anwendungsgebühr − € 0,87, netto € 17,30 (Hofanteil).
- [ ] Stripe → Webhooks: Beim Endpunkt der Testumgebung **und** beim Endpunkt der Produktion steht `payment_intent.succeeded` mit Antwort 200, ohne Wiederholungen.
- [ ] Admin → Finanzen: „Servicegebühr, online" = S + € 0,87.

**1b – 3-D Secure, Bestellung B**

1. 1 × Test-Eier in den Korb, Kasse, „Online bezahlen", „Weiter zur Zahlung · € 5,40".
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
2. Freiwillige Gegenprobe vorweg: Karte `4000 0000 0000 0002` (wird abgelehnt) → „Jetzt bezahlen".
   - Erwartet: „Deine Karte wurde abgelehnt" und „Es wurde nichts abgebucht …". Die Ware bleibt bis zur genannten Uhrzeit reserviert.
3. Karte `4000 0027 6000 3184` → „Jetzt bezahlen" bzw. „Erneut bezahlen · € 5,40". Im Stripe-Testfenster für 3-D Secure „Complete" (abschließen) tippen.

Erwartet:

- [ ] Die Gebührenzeile zeigt € 0,50, die Mindestgebühr: 5 % von € 4,90 wären nur € 0,25.
- [ ] Sonst wie bei 1a: Zahlung € 5,40, Anwendungsgebühr € 0,50, Überweisung € 5,40, Hofanteil € 4,90. Finanzen + € 0,50.

**Ergebnis Ablauf 1**

- [ ] bestanden
- [ ] Fehler: ______ (Bestellnummer, Uhrzeit, Bild)
- [ ] ausgelassen, weil: ______

### Ablauf 2 – Wallet, Bestellung C

Vorbereitung:

- Ein Gerät mit Google Pay (Chrome, Karte im Google-Konto) oder Apple Pay (Safari, Karte in Wallet).
- Die Domain des Orts ist in Stripe (Testmodus) unter Einstellungen → Zahlungsmethoden → Domains eingetragen; für test.farmerzone.at siehe `docs/betrieb/testumgebung.md`, Schritt 5.
- Verlangt Stripe dafür eine Datei unter `/.well-known/`, ist das ein eigener kleiner Auftrag (`docs/betrieb/stripe-live.md`, Schritt 7). Heute liegt keine solche Datei im Projekt.
- Bleibt die Domain unbestätigt, kann auch die Vercel-Sperre der Grund sein. Karte und EPS lassen sich trotzdem testen.

Schritte:

1. 3 × Test-Eier in den Korb, „Online bezahlen", „Weiter zur Zahlung · € 15,44".
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
2. Im Zahlungsfeld Google Pay bzw. Apple Pay wählen und bestätigen. Im Testmodus belastet Stripe keine echte Karte.

Erwartet:

- [ ] Wie Ablauf 1a: Zahlung € 15,44, Anwendungsgebühr € 0,74, Überweisung € 15,44, Hofanteil € 14,70. Finanzen + € 0,74.
- [ ] Erscheint keine Wallet: Ablauf als ausgelassen vermerken und den Grund notieren, etwa „Domain nicht eingetragen" oder „Gerät ohne Wallet". Das ist kein Fehler der App: Welche Wege das Zahlungsfeld anbietet, entscheiden die Stripe-Einstellungen und das Gerät.

**Ergebnis Ablauf 2**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 3 – EPS im Testmodus, Bestellung D

Vorbereitung: EPS ist in Stripe (Testmodus) unter Einstellungen → Zahlungsmethoden aktiv.

Schritte:

1. 1 × Test-Eier und 1 × Test-Honig in den Korb, „Online bezahlen", „Weiter zur Zahlung · € 13,02".
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
2. Im Zahlungsfeld „EPS" und eine Bank wählen, weiter.
3. Auf Stripes Testseite „Authorize test payment" (Testzahlung bestätigen) tippen.

Erwartet:

- [ ] Zurück auf der Bestätigungsseite, nach dem Webhook „Bezahlt".
- [ ] Ware € 12,40, Gebühr € 0,62. 5 % von 1.240 Cent sind glatt 62 Cent, es gibt nichts aufzurunden. Gesamt € 13,02.
- [ ] Stripe: Zahlung € 13,02 mit Zahlungsmethode EPS, Anwendungsgebühr € 0,62, Überweisung € 13,02. Hofanteil € 12,40.
- [ ] Finanzen + € 0,62.
- [ ] Gibt es EPS nicht: Bestellung D mit Karte `4242 4242 4242 4242` bezahlen, denn Ablauf 8 braucht sie. Ablauf 3 als ausgelassen vermerken.

**Ergebnis Ablauf 3**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 4 – Bar ohne Servicegebühr (B1) mit Bestätigungsknopf, Bestellung E

Schritte:

1. 2 × Test-Eier in den Korb, zur Kasse, „Bar bei Abholung" wählen.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
2. Knopf „Zahlungspflichtig bestellen · € 9,80" tippen.
3. Die Bestätigungsmail öffnen und den Link tippen. Auf der Seite „Ja, ich hole verbindlich ab" tippen.

Erwartet:

- [ ] Unter den Zahlarten steht „Bei Barzahlung bis 31. Jänner 2027 ohne Servicegebühr.", bei „Bar bei Abholung" der Zusatz „du bestätigst per E-Mail".
- [ ] Die Übersicht hat keine Zeile Servicegebühr: „Warenpreis" € 9,80, „Gesamt" € 9,80.
- [ ] Nach Nr. 46 gibt es bei Bar keinen Pflicht-Haken mehr. Vorher stand dort „Ich hole meine Bestellung zum gewählten Termin ab und zahle vor Ort bar." Siehe Abschnitt 9.
- [ ] Bestätigungsseite: „Fast geschafft – bitte bestätige per E-Mail".
- [ ] Seite hinter dem Link: „Bestellung bei … bestätigen" mit „Bitte bestätige bis … – erst dann packt der Hof für dich." Die Positionen stehen da, **eine Zeile Servicegebühr nicht**, Summe € 9,80.
- [ ] Hof → Bestellungen → E: „Bar zu kassieren € 9,80", darunter „Warenpreis € 9,80", ohne Satz zur Monatsabrechnung.
- [ ] Stripe: nichts. Admin → Finanzen: S und V unverändert.
- [ ] Kommt keine Mail an, gibt es einen Notweg: In der Entwicklungsdatenbank (nur dort, nur lesen) `select "confirmationToken" from "Order" where "orderNumber" = '<Bestellnummer>';` abfragen und `<Ort>/<hof-slug>/bestaetigen/<token>` öffnen. Den fehlenden Mailweg notierst du trotzdem als Befund.

**Ergebnis Ablauf 4**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 5 – Bar unbestätigt, nach Frist freigegeben, Bestellung F

**Regel** (`src/lib/fristen.ts`):

- Eine Barbestellung muss bestätigt sein, bevor die frühere von zwei Grenzen erreicht ist: 2 Stunden nach dem Bestellen oder der Beginn des gewählten Abholfensters.
- Die Frist gilt beim Lesen. Wer danach die Hofseite, die Kasse oder die Bestellungen des Hofs öffnet, gibt die Ware frei. Der tägliche Cron ist nur das Netz darunter.

Schritte:

1. Den Vorrat von Test-Honig notieren.
2. 1 × Test-Honig in den Korb, zur Kasse, „Bar bei Abholung", das Abholfenster von heute wählen, das in etwa 20 Minuten beginnt.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
3. „Zahlungspflichtig bestellen · € 7,50" tippen. Die Mail **nicht** bestätigen.
4. Warten, bis das Fenster begonnen hat. Dann die Hofseite oder Hof → Bestellungen öffnen.
5. Statt zu warten, kannst du die Zeit in der Entwicklungsdatenbank vorstellen, nie in der Produktion: `update "Order" set "createdAt" = now() - interval '3 hours' where "orderNumber" = '<Bestellnummer>';` Danach die Hofseite öffnen.

Erwartet:

- [ ] Vor der Frist steht F in Hof → Bestellungen unter „Heute abholen" und unter „Noch offen".
- [ ] Nach der Frist steht F auf „Storniert" mit dem Grund „Nicht rechtzeitig bestätigt", jetzt unter „Erledigt".
- [ ] Der Vorrat von Test-Honig ist wieder wie vorher.
- [ ] Die Kundin bekommt eine Mail, dass die Bestellung verfallen ist.
- [ ] Der Link aus der ersten Mail zeigt „Bestellung verfallen" und „Die Bestellung wurde nicht rechtzeitig bestätigt. Wir haben die Ware wieder freigegeben – dir entstehen keine Kosten."
- [ ] Stripe: nichts. Finanzen: unverändert.

**Ergebnis Ablauf 5**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 6 – Futter mit Größe und Hinweis „Angaben stammen vom Hof", Bestellung G

Vorbereitung: Test-Heu mit zwei Größen und die Betriebsnummer im Hof-Profil (Abschnitt 2).

Schritte:

1. Hofseite → Abschnitt Futtermittel → Test-Heu → „Größe wählen ›".
2. Auf der Produktseite „Rundballen" wählen und in den Korb legen.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
3. Kasse, bar, „Zahlungspflichtig bestellen · € 45,00", dann per Mail bestätigen.

Erwartet:

- [ ] Die Produktseite zeigt beide Größen mit ihren Preisen: 5 kg-Sack € 4,90, Rundballen € 45,00.
- [ ] Auf der Produktseite und im Warenkorb steht: „Die Angaben zu Registrierung und Kennzeichnung stammen vom Hof. Der Hof ist für ihre Richtigkeit verantwortlich; FarmerZone vermittelt nur und prüft die Angaben nicht."
- [ ] Bestellung G: € 45,00 bar, ohne Servicegebühr. Online kämen 5 % dazu, also € 2,25, zusammen € 47,25.
- [ ] Hof: „Bar zu kassieren € 45,00". Stripe: nichts.

**Ergebnis Ablauf 6**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 7 – Artikel fehlt bei Online-Bestellung, Teilerstattung (Bestellung A)

Vorbereitung: A ist bezahlt (Ablauf 1a).

Schritte als Hof:

1. Bestellungen → A → „Artikel fehlt".
2. „Test-Honig" antippen und den Dialog lesen.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
3. „Änderung speichern und \<Vorname\> informieren".

Erwartet:

- [ ] Der Dialog zeigt vor dem Speichern:
  - „\<Vorname\> bekommt zurück € 7,87",
  - „Von deiner nächsten Auszahlung abgezogen € 7,50",
  - „Artikel € 7,50 + Servicegebühr € 0,37 – die Gebühr gilt nur noch für € 9,80 Ware.",
  - „Das ist genau der Preis des fehlenden Artikels. Den Unterschied bei der Servicegebühr erstattet FarmerZone."
- [ ] Toast: „Gespeichert. \<Vorname\> bekommt € 7,87 zurück und eine E-Mail."
- [ ] A zeigt jetzt € 10,30 mit „Warenpreis € 9,80 + Servicegebühr € 0,50" und „Für fehlende Artikel schon erstattet: € 7,87". Der Honig ist als fehlend markiert. Der Vorrat ändert sich nicht, denn der Artikel war nie da.
- [ ] Die Kundin bekommt eine Mail mit dem neuen Betrag.
- [ ] Stripe, Zahlung A: teilweise erstattet € 7,87. Die Erstattung trägt die Metadaten `anlass=teilstorno`, `art=kunde`, dazu `orderId` und `positionId`.
- [ ] Stripe, Überweisung an den Testhof: Rückbuchung € 7,50 mit `art=hof`. Die Anwendungsgebühr bleibt € 0,87 und wird nicht erstattet.
- [ ] Stripe, verbundenes Konto: Hofanteil jetzt € 9,80 (18,17 − 0,87 − 7,50).
- [ ] Admin → Finanzen: „Servicegebühr, online" sinkt um € 0,37.

**Ergebnis Ablauf 7**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 8 – Storno online, Vollerstattung mit Transfer-Rückbuchung (Bestellung D)

Schritte als Hof:

1. Bestellungen → D → „Stornieren".
2. Einen Grund eintragen oder frei lassen.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test".
3. „Stornieren und erstatten".

Erwartet:

- [ ] Der Dialog sagt: „\<Vorname\> bekommt zurück: € 13,02 (Warenpreis + Servicegebühr)" und „Von deiner nächsten Auszahlung abgezogen: € 12,40 – genau der Warenpreis. Die Servicegebühr erstattet FarmerZone."
- [ ] Toast: „Storniert. \<Vorname\> bekommt € 13,02 zurück."
- [ ] D zeigt „Storniert" und „Warenpreis € 12,40 · Servicegebühr € 0,62 entfällt". In der Liste steht auf breiteren Bildschirmen die Zahlart „Online, erstattet". Der Vorrat ist zurück: Eier +1, Honig +1.
- [ ] Die Kundin bekommt eine Storno-Mail mit dem erstatteten Betrag.
- [ ] Stripe, Zahlung D: erstattet € 13,02, die ganze Zahlung. Metadaten der Erstattung: `anlass=vollstorno`, `art=kunde`.
- [ ] Stripe, Überweisung: Rückbuchung € 13,02, die ganze Überweisung. Die Anwendungsgebühr € 0,62 geht an den Hof zurück.
- [ ] Stripe, verbundenes Konto: unterm Strich € 0,00 für diese Bestellung.
- [ ] Admin → Finanzen: „Servicegebühr, online" sinkt um € 0,62. Stornierte Bestellungen bringen nichts ein.

**Ergebnis Ablauf 8**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 9 – Abgeholt und „Nicht abgeholt"

- [ ] Vor 9a bis 9c: Banner zeigt „TEST · Dev-DB · Stripe Test". 9b vermerkt eine Barzahlung, 9c bucht Geld zurück.
- [ ] Vorher auf Heute (Profil Hof) die Kennzahl „Heute eingenommen" notieren.

**9a – online abgeholt (A, nach Ablauf 7)**

Schritte: A → „Als gepackt markieren" → „Abgeholt".

- [ ] Nach dem Packen: Toast „Gepackt – \<Vorname\> bekommt Bescheid", die Kundin bekommt eine Mail.
- [ ] Nach „Abgeholt": Toast „Als abgeholt gespeichert", die Marke zeigt „Abgeholt", A steht unter „Erledigt".
- [ ] Stripe: nichts Neues. Finanzen: unverändert, A zählt weiter mit € 0,50.

**9b – bar abgeholt (E)**

Schritte: E → „Als gepackt markieren" → „Abgeholt und € 9,80 kassiert".

- [ ] Toast „Als abgeholt und bezahlt gespeichert", danach „Bar kassiert € 9,80".
- [ ] Finanzen: V unverändert (B1).

**9c – online nicht abgeholt (B)**

Schritte: B → „Nicht abgeholt", im Dialog „Nicht abgeholt" bestätigen.

- [ ] Der Dialog „Nicht abgeholt?" sagt: „\<Vorname\> hat die Bestellung nicht abgeholt. Sie bekommt keine E-Mail." und „Die Servicegebühr von € 0,50 bekommt \<Vorname\> zurück. Der Warenpreis bleibt bei dir."
- [ ] Toast „Als nicht abgeholt gespeichert". Die Marke zeigt „Nicht abgeholt", dazu „Warenpreis € 4,90 · Servicegebühr € 0,50 entfällt".
- [ ] Stripe, Zahlung B: teilweise erstattet € 0,50, Metadaten `grund=servicegebuehr_nicht_abgeholt`. Es gibt **keine** Rückbuchung vom Hof. Die Anwendungsgebühr bleibt € 0,50, denn die Erstattung zahlt die Plattform aus ihrem Saldo. Hofanteil € 4,90.
- [ ] Admin → Finanzen: sinkt um € 0,50. Die Kundin bekommt keine Mail.

**Danach auf Heute**

- [ ] „Heute eingenommen" ist um € 19,60 gestiegen. Das ist der Warenpreis von A nach Ablauf 7 (€ 9,80) plus der von E (€ 9,80).
  - Es zählt, was heute abgeholt wurde, ohne Servicegebühr.
  - B zählt nicht, denn B wurde nicht abgeholt.

**Ergebnis Ablauf 9**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 10 – Bestellungen finden per Code

Schritte:

1. Im Profil **Kundin** „Meine Bestellungen" tippen, am Handy unten „Bestellungen". Das öffnet `/bestellungen`.
2. Die E-Mail der Kundin eingeben, „Code schicken".
3. Den 6-stelligen Code aus der Mail eingeben. Er gilt 10 Minuten, es gibt 5 Versuche.

Erwartet:

- [ ] Die Liste zeigt A bis G (C nur, wenn Ablauf 2 lief), getrennt in laufende und frühere Bestellungen.
- [ ] Jede Zeile zeigt Hof, Bestellnummer, Stand und Betrag.
- [ ] Die Marken stimmen: A „Abgeholt" (€ 10,30), B „Nicht abgeholt", C „Bezahlt", D „Storniert", E „Abgeholt", F „Storniert" (verfallen), G „Bestätigt".
- [ ] Gegenprobe: Ein falscher Code ergibt „Der Code stimmt nicht. Schau noch einmal in die E-Mail oder lass dir einen neuen schicken.", keine Liste. Nach 30 Minuten verlangt die Seite wieder einen Code („Deine Ansicht ist abgelaufen").

**Ergebnis Ablauf 10**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 11 – Produkt am Handy anlegen und Teilen-Fenster öffnen

Vorbereitung: Handy oder Browser auf 390 px Breite. Der Testhof ist freigeschaltet, die Teilen-Hinweise sind an.

Schritte:

1. In der Unterleiste „Neu" tippen, das Plus mit dem Wort darunter. Das Blatt „Was legst du an?" geht auf.
2. „Lebensmittel" wählen und ausfüllen: Name „Test-Marmelade", Kategorie, Preis € 3,90, Vorrat 5, im Shop.
3. „Produkt veröffentlichen" tippen.
4. Im Hinweis „Teilen" tippen.
5. Im Teilen-Fenster bei „Link" auf „Kopieren" tippen und dann WhatsApp antippen.
6. Das Produkt einmal bearbeiten und speichern.

Erwartet:

- [ ] Nach dem Veröffentlichen erscheint „Test-Marmelade ist online" mit „Kunden sehen es ab jetzt auf deiner Hofseite. Sag ihnen Bescheid?". Darunter stehen „Teilen", „Nicht jetzt" und „Fragt nur einmal pro Produkt. Abschalten unter Einstellungen."
- [ ] Das Teilen-Fenster zeigt ein Bild mit der Wahl „Beitrag 1:1" oder „Status 9:16", die Kanäle WhatsApp, WhatsApp-Status, Facebook, Instagram und E-Mail sowie „Plakat drucken".
- [ ] „Kopieren" meldet „Link kopiert". Der Link endet auf `<hof-slug>?k=link`, der WhatsApp-Link auf `?k=wa`.
- [ ] „WhatsApp-Status" und „Instagram" öffnen am Handy das Teilen-Menü des Geräts mit Bild und Text.
- [ ] Nach dem Bearbeiten kommt kein zweiter Hinweis.
- [ ] Alles ist gut zu treffen (mindestens 44 px), nichts ist abgeschnitten, hell und dunkel.

**Ergebnis Ablauf 11**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

### Ablauf 12 – QR-Plakat mit gültiger Hofseiten-Adresse und `?k=qr`

Schritte:

1. Im Teilen-Fenster „Plakat drucken" tippen, oder `<Ort>/status/plakat` öffnen.
2. Den QR-Code mit dem Handy scannen. Das Handy muss im Browser bei Vercel angemeldet sein, sonst zeigt Vercel zuerst seine Anmeldung. Das ist der Schutz der Testumgebung, kein Fehler.

Erwartet:

- [ ] Die Seite „QR-Plakat" zeigt das Blatt:
  - Hofname · Ort,
  - „Frisch vom Hof. Online vorbestellen.",
  - den QR-Code,
  - unten die Abholzeiten und die Adresse `<host>/<hof-slug>`, mit dem Host des Orts und nicht farmerzone.at.
- [ ] Der Knopf „Plakat drucken" öffnet den Druckdialog. Die Druckvorschau zeigt nur das A4-Blatt.
- [ ] Der Scan öffnet `https://<host>/<hof-slug>?k=qr`, die Hofseite des Testhofs. Nach dem Laden verschwindet `?k=qr` aus der Adresszeile. Das ist gewollt (T1): Im Browser wird nichts gespeichert.
- [ ] Hof → Auswertung, Karte „Über deine geteilten Links": Der Besuch über „QR" ist um 1 gestiegen.

**Ergebnis Ablauf 12**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

## 5. Hof-Anmeldung am Handy (Nr. 41)

Am Handy oder bei 390 px Breite. Zuerst im Profil **Kundin** (abgemeldet), dann im Profil **Hof** und zuletzt im Profil **Admin**.

- [ ] Profil Kundin: Startseite, `/hoefe`, Hofseite des Testhofs und `/fuer-hoefe` zeigen oben rechts „Anmelden".
- [ ] Ein Tipp darauf öffnet `/login`. „Ich habe einen Hof" ist vorgewählt, „Ich kaufe ein" ist einen Tipp entfernt.
- [ ] „Schon dabei? Anmelden" führt auf `/login`. Der Link steht im Band „Für Höfe" der Startseite, auf `/fuer-hoefe` oben und unten und auf `/register`.
- [ ] Hell und Dunkel schaltest du am Handy im Menü bzw. im Seitenfuß um („Dunkelmodus" / „Heller Modus"). Im Browser bleibt der Schalter im Kopf.
- [ ] Profil Hof, als Testhof angemeldet, dieselben Seiten: Oben rechts steht „Mein Hof". Ein Tipp führt nach Heute (`/dashboard`).
- [ ] **Startbildschirm:** Ganz unten auf Heute steht im Browser die Karte „Mit einem Tipp in deinem Hof: Leg FarmerZone auf den Startbildschirm", mit je zwei Sätzen für iPhone und Android.
- [ ] Nach der Anleitung auf einem echten Handy installieren:
  - iPhone: Safari → „Teilen" → „Zum Home-Bildschirm" → „Hinzufügen".
  - Android: Chrome → drei Punkte → „Zum Startbildschirm hinzufügen" bzw. „App installieren".
- [ ] Vom Startbildschirm geöffnet, startet die App auf Heute, und die Karte fehlt.
  - Am iPhone hat die installierte App einen eigenen Speicher. Dort meldest du dich einmal neu an, in der Testumgebung zuerst bei Vercel.
- [ ] Profil Admin (`admin@example.com`, ohne Hof) unter `/admin`: kein „← Mein Hof", rechts die Initialen-Plakette, auch am Handy.
- [ ] Ein Betreiber-Konto mit Hof sieht „← Mein Hof". Seine Plakette führt auf „Konto und Sicherheit".

**Ergebnis Abschnitt 5**

- [ ] bestanden
- [ ] Fehler: ______

## 6. Rückweg (Nr. 44)

Am Handy oder bei 390 px Breite, im Profil **Hof**.

- [ ] Einstellungen → Hof-Profil: Oben steht eine feste Leiste „← Einstellungen". Beim Scrollen bleibt sie stehen, die Karte läuft darunter durch.
- [ ] Ganz unten ist „Einstellungen → Mein Auftritt" ein Link auf `/settings/appearance`.
- [ ] Zurück im Hof-Profil etwas Harmloses ändern, etwa einen Satz in der Beschreibung, und „Profil speichern" tippen. Es erscheint der Toast „Gespeichert", danach die Übersicht `/settings`.
- [ ] Ausnahme Abholzeiten: Nach dem Speichern bleibt die Seite offen.
- [ ] Bestellungen → eine Bestellung: Leiste „← Bestellungen". Kunden → eine Kundin: Leiste „← Kunden".
- [ ] „Mehr" → Zeile „Angemeldet …" öffnet „Konto und Sicherheit".
- [ ] Im Browser ab 768 px steht wie bisher die Zeile „‹ …".

**Ergebnis Abschnitt 6**

- [ ] bestanden
- [ ] Fehler: ______

## 7. Unbekanntes Hof-Konto (Nr. 42, `docs/betrieb/stripe-live.md` §0)

Erst **nach** den zwölf Abläufen: Der Schritt schaltet die Online-Zahlung des Testhofs ab. Nur in der Entwicklungsdatenbank, z. B. im SQL-Editor des Dev-Projekts, nie in der Produktion.

1. Die bisherige Kennung notieren: `select "stripeAccountId" from "Farm" where slug = '<hof-slug>';`
2. Eine erfundene Kennung setzen: `update "Farm" set "stripeAccountId" = 'acct_erfunden0000000000', "stripeAccountReady" = true where slug = '<hof-slug>';`
3. Freiwillig, im Profil **Kundin**: beim Testhof online bezahlen wollen.
   - [ ] Vorher: Banner zeigt „TEST · Dev-DB · Stripe Test".
   - Erwartet: „Online-Zahlung ist bei diesem Hof gerade nicht möglich. Bitte wähle Bar bei Abholung."
   - Die Kasse stellt auf Bar um, die Ware bleibt reserviert (stripe-live.md §9, Schritt 2).
4. Im Profil **Hof**: Einstellungen → Zahlung → „Status prüfen".

Erwartet:

- [ ] Oben steht die Karte „Online-Zahlung neu einrichten" mit „Stripe kennt dein bisheriges Konto nicht mehr. Richte die Online-Zahlung bitte neu ein – das dauert etwa 10 Minuten. Bis dahin bieten wir deinen Kundinnen nur Barzahlung an."
- [ ] Dazu die Marke „Nicht mehr verbunden" und der orange Knopf „Online-Zahlung neu einrichten".
- [ ] Die Kasse des Testhofs bietet nur noch „Bar bei Abholung" an.
- [ ] Sentry (Umgebung preview): höchstens eine Meldung „Stripe kennt das gespeicherte Konto eines Hofs nicht" je Hof und Tag, nur mit der Hof-ID.
- [ ] Die erfundene Kennung bleibt in der Datenbank stehen. Die App löscht sie nie von selbst.

Zurück:

- [ ] Die alte Kennung wieder eintragen: `update "Farm" set "stripeAccountId" = '<alte Kennung>' where slug = '<hof-slug>';`
- [ ] Dann „Status prüfen". Erwartet: „Verbunden und aktiv".
- [ ] Oder stattdessen „Online-Zahlung neu einrichten" tippen. Das legt ein neues Test-Konto an und führt durch dasselbe Stripe-Formular wie in Abschnitt 2.

**Ergebnis Abschnitt 7**

- [ ] bestanden
- [ ] Fehler: ______

## 8. Testbetrieb-Hinweise (Nr. 42)

Die drei Sätze erscheinen **nur in der Produktion**, solange sie mit Test-Schlüssel läuft. In der Testumgebung sagt es stattdessen das Banner.

- [ ] Testumgebung: Keiner der drei Sätze erscheint. Weder an „Online bezahlen" noch im Admin noch in Einstellungen → Zahlung.
- [ ] Produktion, nur ansehen: `farmerzone.at/admin` zeigt oben die orange Karte „Stripe läuft im Testmodus – Online-Zahlungen sind Testzahlungen, es fließt kein echtes Geld."
- [ ] Kasse an „Online bezahlen": „Testbetrieb: Echte Karten werden noch abgelehnt. Bitte wähle Bar bei Abholung." Das prüfst du **nur** an den Bildern in Bericht 42 (`docs/nachtlauf/berichte/bilder/42/kasse-390-hell.jpg` und folgende). In der Produktion nicht ausprobieren: Ein Korb reserviert dort Ware eines echten Hofs.
- [ ] Produktion, nur ansehen, Einstellungen → Zahlung: „Online-Zahlung läuft noch im Testbetrieb."
  - Nur mit einem eigenen Hof-Konto in der Produktion. Sonst die Bilder in Bericht 42 (`docs/nachtlauf/berichte/bilder/42/zahlung-390-hell.jpg` und folgende).

**Ergebnis Abschnitt 8**

- [ ] bestanden
- [ ] Fehler: ______

## 9. Kasse nach Nr. 46

Nr. 46 lief noch, als diese Liste entstand. Die Punkte folgen deshalb dem Auftrag (`freigabe.md` §12 „46"), nicht dem fertigen Stand. Ist Nr. 46 nicht im Sammel-PR, sieht die Kasse aus wie vorher: Pflicht-Haken bei Bar, Neuigkeiten in der Kasse. Dann lässt du diesen Abschnitt aus.

- [ ] Bar: Es gibt keinen Pflicht-Haken mehr. Der Kaufknopf bleibt „Zahlungspflichtig bestellen · € …".
- [ ] Jeder Abholtermin trägt ein Datum, z. B. „Sa, 10. Okt".
- [ ] In der Kasse gibt es keinen Neuigkeiten-Haken mehr. Die Anmeldung steht auf der Bestätigungsseite, online wie bar.
- [ ] Nach dem Haken kommt eine Mail. Ihr Link öffnet „Bestätige deine Anmeldung" mit dem Knopf „Anmeldung bestätigen". Danach steht dort „Danke, du bist angemeldet". Ohne diesen Klick gibt es keine Neuigkeiten (Double-Opt-in, S11).
- [ ] Ein Fehler bei der Anmeldung ändert nichts an der Bestellung.
- [ ] Am Handy bei 390 px verdeckt der Cookie-Hinweis weder die Unterleiste noch den Kaufknopf.
- [ ] Alle Beträge sind wie in Abschnitt 3; Nr. 46 ändert keine Beträge.
- [ ] `/hoefe`: ein Suchfeld „Ort oder Produkt" und „Standort nutzen". Bei 390 × 844 ist der erste Hof ohne Scrollen zu sehen.
- [ ] Hofseite: Abholtermine lassen sich antippen und landen in der Kasse, oder sie stehen klar als Text da. Nichts sieht wie ein Knopf aus, ohne einer zu sein.

**Ergebnis Abschnitt 9**

- [ ] bestanden
- [ ] Fehler: ______
- [ ] ausgelassen, weil: ______

## 10. Abschluss und Aufräumen

- [ ] Stripe → Webhooks → Endpunkt der Produktion: Alle Zustellungen aus dem Probelauf haben 200, ohne Wiederholungen.
  - Eine bekannte Ausnahme: Gibt es im Testmodus einen Connect-Endpunkt („Ereignisse in verbundenen Konten") zur Produktion, antwortet sie dort mit 400, solange ihr `STRIPE_CONNECT_WEBHOOK_SECRET` fehlt.
  - Das betrifft jedes Ereignis eines verbundenen Kontos, also auch das neue Testkonto. Es liegt an der Einstellung, nicht am Probelauf (`docs/betrieb/stripe-live.md`, Schritte 3 und 4).
- [ ] Sentry, Umgebung production: Durch den Probelauf ist keine neue Meldung entstanden. Die Produktion quittiert fremde Ereignisse still.
  - Die bekannte Warnung „Umgebung widersprüchlich: Stripe TEST in Produktion … Kein STRIPE_CONNECT_WEBHOOK_SECRET …" kommt einmal je Kaltstart und gehört nicht dazu.
- [ ] Sentry, Umgebung preview: höchstens die Warnung aus Abschnitt 7.
- [ ] Die Kennung aus Abschnitt 7 ist zurückgesetzt bzw. neu eingerichtet.
- [ ] Wurde nur auf der Branch-Adresse von `integration/lauf8` getestet:
  - den Endpunkt dieser Adresse in Stripe löschen,
  - die Branch-Variablen `STRIPE_WEBHOOK_SECRET` und `TEST_EMPFAENGER` dieses Branch löschen,
  - das Geheimnis für den Vercel-Schutz neu erzeugen, falls es nur für den Probelauf gedacht war.
  - Für test.farmerzone.at bleibt alles stehen.
- [ ] Testbestellungen und Testhof bleiben in der Entwicklungsdatenbank, die Zahlungen im Stripe-Testmodus. Beides stört nicht.

## 11. Ergebnis

Diese Tabelle kommt in den Morgenbericht bzw. als Kommentar in den Sammel-PR.

| # | Ablauf | Ergebnis (bestanden / Fehler / ausgelassen) | Notiz (Bestellnummer, Grund) |
|---|---|---|---|
| 1 | Online mit Testkarte, auch 3-D Secure | | |
| 2 | Wallet | | |
| 3 | EPS im Testmodus | | |
| 4 | Bar ohne Servicegebühr (B1) mit Bestätigungsknopf | | |
| 5 | Bar unbestätigt, nach Frist freigegeben | | |
| 6 | Futter mit Größe und „Angaben stammen vom Hof" | | |
| 7 | Artikel fehlt bei Online-Bestellung, Teilerstattung | | |
| 8 | Storno online, Vollerstattung mit Transfer-Rückbuchung | | |
| 9 | Abgeholt und „nicht abgeholt" | | |
| 10 | Bestellungen finden per Code | | |
| 11 | Produkt am Handy anlegen, Teilen-Fenster öffnen | | |
| 12 | QR-Plakat mit `?k=qr` | | |
| Abschnitt 5 | Hof-Anmeldung am Handy (Nr. 41) | | |
| Abschnitt 6 | Rückweg (Nr. 44) | | |
| Abschnitt 7 | Unbekanntes Hof-Konto (Nr. 42) | | |
| Abschnitt 8 | Testbetrieb-Hinweise (Nr. 42) | | |
| Abschnitt 9 | Kasse nach Nr. 46 | | |
