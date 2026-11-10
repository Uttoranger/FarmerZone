# Probelauf-Checkliste: Hofpreis-Modell, Umschalten, Monatsabrechnung, Rücktritt

**Stand:** 10.11.2026, geschrieben gegen `main` 260f8cf9 (nach Nachtlauf 33 und dem Impressum). Auftrag A011. Ersetzt die Fassung vom 08./12.10.2026 vollständig.

**Wozu.** Bevor echtes Geld fließt, muss jemand die Kaufstrecke einmal von Hand durchspielen: als Kundin, als Hof und als Admin, am Handy und am Laptop. Diese Liste ist dafür gebaut. Sie ist ein **Blocker vor echten Zahlungen** (`docs/betrieb/stripe-live.md` §0) und enthält drei Abnahmen der Projektleitung:

- **Abnahme 197** – Plattformgebühr im Preis (Teil B, B3),
- **Abnahme 198** – Monatsabrechnung mit SEPA-Lastschrift (Teil C, C1 bis C3),
- **Generalprobe 259** – das Umschalten über Mitternacht mit AGB 1.0 (Teil A, A5 und A6, und Teil B, B1).

Fehler, die du findest, behebt danach je ein eigener Auftrag, jeder mit einem Test, der den Fehler zeigt.

## Was du brauchst

- **Zwei Geräte:** einen Laptop und ein Handy.
- **Drei getrennte Browserprofile** (oder drei Browser): **Hof**, **Admin** und **Kundin**. Fenster desselben Profils teilen sich die Anmeldung: Meldest du dich dort als Admin an, ist der Hof abgemeldet. Der Browser am Handy ist ein viertes Profil.
- **In jedem Profil bei Vercel angemeldet.** Die Testumgebung ist nicht öffentlich; ohne Vercel-Anmeldung zeigt sie nur die Anmeldeseite von Vercel.
- **Admin-Zugang der Testumgebung mit Passkey** für `test.agrilo.at`. Geld-Einstellungen (Stichtag, Plattformgebühr eines Hofs, Servicegebühr) fragen jedes Mal frisch nach dem Passkey und brauchen das Recht „Geld“ bzw. „Höfe freischalten“.
- **Zwei eigene Mail-Adressen aus `TEST_EMPFAENGER`** (Variable bei Vercel, nur für den Branch `staging`): eine für die Kundin, eine für den neuen Testhof. In der Testumgebung geht Post nur an diese Adressen und an `@example.com`; alles andere wird nur gezählt (`docs/betrieb/testumgebung.md`, Schritt 3).
- **Stripe-Dashboard im Testmodus** (oben steht „Testmodus“).
- **Testkarten und Test-IBANs** aus der Tabelle unten.
- Von Variablen brauchst du nur die **Namen**. Werte liest du nie aus und schreibst sie nie auf.

## Testkarten und Test-IBANs

Quelle: Stripe-Testseite (docs.stripe.com/testing). Nur im Testmodus gültig. Ablaufdatum irgendwann in der Zukunft (z. B. 12/34), Prüfziffer beliebig (z. B. 123).

| Wofür | Nummer | Was passiert |
|---|---|---|
| Karte, Erfolg | `4242 4242 4242 4242` | Zahlung gelingt sofort |
| Karte, abgelehnt | `4000 0000 0000 0002` | Stripe lehnt ab, es wird nichts abgebucht |
| Karte, 3-D Secure | `4000 0027 6000 3184` | Stripe öffnet ein Testfenster; dort „Complete“ (abschließen) tippen |
| IBAN, Einzug gelingt | `AT321904300235473204` | Lastschrift gelingt nach etwa drei Minuten |
| IBAN, Einzug scheitert | `AT861904300235473202` | Lastschrift scheitert |
| IBAN, Stripes Standard-Testwert | `AT611904300234573201` | gelingt; für das Stripe-Onboarding des Hofs (Auszahlungskonto) |
| IBAN, Rückbuchung | von der Stripe-Testseite nehmen | Stripe nennt dafür eine eigene IBAN; sie ist hier bewusst nicht abgeschrieben |

Weitere Testwerte für Stripes Formular beim Hof-Konto: SMS-Code `000000`, Geburtsdatum 01.01.1901, Adresszeile `address_full_match`. Stripe bietet im Testmodus auch Abkürzungen für Testdaten an.

## Grundregeln

- **Nur Testumgebung.** Bestellt wird nur auf `https://test.agrilo.at` (Branch `staging`, Entwicklungsdatenbank, Stripe-Testmodus). Auf `agrilo.at` schaust du höchstens, du bestellst dort nichts: Ein Korb reserviert dort Ware eines echten Hofs.
- **Banner-Blick vor jedem Schritt mit Geld.** Oben auf jeder Seite steht „TESTUMGEBUNG · Dev-Datenbank · Stripe Test · staging“, am Handy kurz „TEST · Dev-DB · Stripe Test“. Steht dort „Stripe LIVE“, „Stripe fehlt“ oder „Fremde Datenbank“ (am Handy „fremde DB“): **Stopp.** Nichts bestellen, nichts erstatten, melden. Vor jedem Schritt, der bezahlt oder Geld zurückbucht, steht deshalb ein eigener Haken „Banner zeigt ‚TEST · Dev-DB · Stripe Test‘“.
- **Keine echten Daten in Stripes Formulare:** keine echten Namen, Adressen, Kontonummern. Für Kundinnen-Namen und Telefon erfundene Werte.
- **Zu jedem Fehler** notierst du Bestellnummer, Uhrzeit und ein Bildschirmfoto. In Berichte kommen keine Namen und keine Adressen.
- **Beträge** stammen aus dem Code (`src/lib/plattformgebuehr.ts`, `src/lib/servicegebuehr.ts`, `src/lib/artikel-fehlt.ts`, `src/lib/storno.ts`, `markAsNotPickedUp` in `src/server/actions/orders.ts`) und sind gegen diese Funktionen nachgerechnet.
- **SQL nur in der Entwicklungsdatenbank** und nur dort, wo diese Liste es ausdrücklich sagt.

## Drei Sitzungen in fester Reihenfolge

Die Entwicklungsdatenbank bleibt nach dem Stichtag im neuen Modell. Ein zweiter Anlauf der Generalprobe ist dort nicht möglich. Deshalb gilt diese Reihenfolge:

| Sitzung | Wann | Was | Dauer |
|---|---|---|---|
| 1 | Abend vor dem Stichtag, bis kurz nach Mitternacht | Teil A (A0–A6), mit dem Schritt kurz vor und nach Mitternacht | etwa 3 Stunden |
| 2 | Tag nach dem Stichtag | Teil B (B1–B6) | etwa 3 Stunden |
| 3 | danach; die Monatsabrechnung im Folgemonat | Teil C (C1–C5) | etwa 2½ Stunden, verteilt |
| Nachblick | Folgetag nach C3 | Sperre nach einem Tag (C3) | 10 Minuten |

Die Bestellungen bekommen kurze Namen, damit du sie wiederfindest: **V1–V5** (vor dem Stichtag, altes Modell), **H1–H8** (nach dem Stichtag, Hofpreis-Modell). Notier zu jedem Namen die Bestellnummer.

## Beträge auf einen Blick

**Hofpreis-Modell (ab dem Stichtag).** Plattformgebühr 6 % je Stück, **immer auf den ganzen Cent aufgerundet**, ohne Mindestgebühr (`gebuehrJeStueckCents`). Endpreis je Stück = Warenpreis + Gebühr. Die Gebühr einer Bestellung ist die **Summe aus Menge × Gebühr je Stück** (`bestellGebuehr`), nie 6 % auf die Summe. Online und bar gleich. Mindestbestellwert 10 € **Warenwert** je Bestellung. Online: Stripe überweist dem Hof den vollen Betrag und behält als Anwendungsgebühr genau die Gebühr ein; der Hof bekommt 100 % des Warenpreises.

Rechnung in Cent: Warenpreis × 600 ergibt Zehntausendstel-Cent; durch 10.000, bleibt ein Rest, kommt ein Cent dazu.

| Produkt | Warenpreis | Rechnung | Gebühr je Stück | Endpreis |
|---|---|---|---|---|
| Test-Eier | 490 Cent | 490 × 6 % = 29,4 → 30 | € 0,30 | € 5,20 |
| Test-Honig | 750 Cent | 750 × 6 % = 45,0 → 45 (glatt) | € 0,45 | € 7,95 |
| Test-Heu „5 kg-Sack“ | 490 Cent | 490 × 6 % = 29,4 → 30 | € 0,30 | € 5,20 |
| Test-Heu „Rundballen“ | 4.500 Cent | 4.500 × 6 % = 270,0 → 270 (glatt) | € 2,70 | € 47,70 |

| Korb | Ware (Cent) | Gebühr (Cent) | Kundin zahlt, online wie bar | Anwendungsgebühr | Hof bekommt |
|---|---|---|---|---|---|
| 2 × Eier + 1 × Honig | 980 + 750 = 1.730 | 2 × 30 + 45 = 105 | € 18,35 | € 1,05 | € 17,30 |
| 1 × Eier + 1 × Honig | 490 + 750 = 1.240 | 30 + 45 = 75 | € 13,15 | € 0,75 | € 12,40 |
| 3 × Eier | 1.470 | 3 × 30 = 90 | € 15,60 | € 0,90 | € 14,70 |
| 1 × Rundballen | 4.500 | 270 | € 47,70 | € 2,70 | € 45,00 |
| 2 × Eier | 980 | – | **nicht bestellbar**: unter 1.000 Cent Warenwert | – | – |

- **„Je Stück aufgerundet“:** 6 % auf die Summe 1.730 wären 103,8 → 104 Cent. Die App nimmt 105 Cent, weil jede Position für sich aufgerundet wird. Genau das prüft B3.
- **Mindestbestellwert-Satz** (`mindestbestellwertHinweis`): Das „ab“ ist der Endpreis von 1.000 Cent als ein Stück: 1.000 + 60 = 1.060 → „Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,60).“ Bei 2 × Eier fehlen 1.000 − 980 = 20 Cent → „Dir fehlen noch Waren für € 0,20.“

**Altes Modell (nur noch für Bestellungen von vor dem Stichtag).** Servicegebühr nach `berechneServicegebuehr` mit dem Satz des Hofs, hier 5 %, aufgerundet, mindestens € 0,50. Bar bis 31. Jänner 2027 ohne Gebühr. Die Gebühr kommt einmal je Bestellung auf die Summe.

| Korb | Ware (Cent) | Rechnung | Online zahlt die Kundin | Bar zahlt die Kundin |
|---|---|---|---|---|
| 2 × Eier + 1 × Honig | 1.730 | 1.730 × 5 % = 86,5 → 87 | € 18,17 (Gebühr € 0,87) | € 17,30 |
| 1 × Eier + 1 × Honig | 1.240 | 1.240 × 5 % = 62,0 → 62 (glatt) | € 13,02 (Gebühr € 0,62) | € 12,40 |
| 2 × Eier | 980 | 980 × 5 % = 49,0 → 49, unter 50 → 50 | € 10,30 | € 9,80 |

**Was sich danach bewegt**

| Fall | Kundin bekommt zurück | Rückbuchung vom Hof | Anwendungsgebühr | Rechnung in Cent |
|---|---|---|---|---|
| Alt, Honig fehlt (Korb € 18,17) | € 7,87 | € 7,50 | bleibt € 0,87 | neue Gebühr auf 980: 49 → 50; Differenz 87 − 50 = 37; Erstattung 750 + 37 = 787 |
| Alt, Storno (€ 13,02) | € 13,02 | € 12,40 (die ganze Überweisung von € 13,02 geht zurück, die Anwendungsgebühr € 0,62 an den Hof zurück) | zurück | Kundin = Ware + Gebühr = 1.240 + 62; Hof = Ware − Provision 0 |
| Neu, Honig fehlt (Korb € 18,35) | € 7,95 | € 7,50 | bleibt € 1,05 | Gebühr der Position fällt weg: 105 − 45 = 60 neu; Erstattung 750 + 45 = 795; neu zu zahlen 980 + 60 = 1.040 |
| Neu, Storno (€ 18,35) | € 18,35 | € 17,30 (die ganze Überweisung geht zurück, die Anwendungsgebühr € 1,05 an den Hof zurück) | zurück | Kundin = 1.730 + 105; Hof = Ware − Provision 0 |
| Neu, nicht abgeholt (€ 13,15) | € 0,75 (nur die Gebühr) | keine | bleibt € 0,75 | erstattet wird `serviceFeeCents` = 75; die Plattform zahlt aus ihrem Saldo |
| Neu, Rücktritt vom Honig nach Abholung (€ 18,35) | € 7,95 | € 7,50 | bleibt € 1,05 | dieselbe Rechnung wie „Honig fehlt“ (`artikelFehltRechnung`) |

---

# Teil A – Vor dem Umschalten (Sitzung 1)

Am Abend vor dem Stichtag. Am Ende von A5 setzt du den Stichtag auf **morgen**; A6 läuft rund um Mitternacht.

## A0 · Ort und Vorbedingungen (etwa 10 Minuten)

- [ ] In allen drei Profilen öffnet `https://test.agrilo.at`, und oben steht „TESTUMGEBUNG · Dev-Datenbank · Stripe Test · staging“ (am Handy „TEST · Dev-DB · Stripe Test“). Fehler: die Anmeldeseite von Vercel (dann im Profil bei Vercel anmelden) oder ein rotes Band (Stopp, melden).
- [ ] Stripe-Dashboard im **Testmodus** › Entwickler › Webhooks › Endpunkt `https://test.agrilo.at/api/stripe/webhook…`: Er empfängt alle zehn Ereignisse aus `docs/betrieb/testumgebung.md`, Schritt 5 – `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `refund.failed`, `charge.refund.updated`, `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`, `setup_intent.succeeded`, `mandate.updated`. Nur **ansehen**, nichts ändern. Fehlt eines: melden, Teil C geht dann nicht vollständig.
- [ ] Profil **Admin** › Einstellungen › Karte „Hofpreis-Modell ab“: Das Feld „Stichtag“ ist änderbar, das Datum liegt in der Zukunft, der Satz lautet „Ab diesem Tag gilt für neue Bestellungen die Plattformgebühr im Hofpreis (6 %, Mindestbestellwert 10 €). Vorher bleibt alles wie heute.“
- [ ] **Steht dort „Der Stichtag ist erreicht – er lässt sich nicht mehr ändern.“:** Stopp für Teil A. Die Generalprobe ist in dieser Datenbank nicht mehr möglich. Weiter mit Teil B ab B3 und Teil C; im Ergebnis „Generalprobe 259: nicht möglich, Stichtag schon erreicht“ eintragen.

## A1 · Neuer Testhof von der Registrierung bis zur Freischaltung (etwa 75 Minuten)

Dieser Hof ist der **Testhof** für alles Weitere. Ein neuer Hof ist nötig, weil einem älteren Test-Konto (angelegt vor dem 30.10.2026) die Stripe-Fähigkeit für EPS fehlen kann; erst seither fordert die App sie beim Anlegen an (`scripts/eps-faehigkeit-nachfordern.ts` fordert sie für alte Konten nach – das startet nur die Projektleitung).

**Registrieren und bestätigen** (Profil **Hof**, abgemeldet)

1. `/register`: „Name deines Hofs“ (erfunden, z. B. „Testhof Probelauf“), „Dein Name“ (erfunden), „E-Mail“ = deine Testhof-Adresse aus `TEST_EMPFAENGER`, „Passwort“. Über dem Knopf steht „Mit der Registrierung stimmst du den AGB und den Konditionen für Höfe zu.“ › „Konto erstellen“.
   - [ ] Es erscheint „Schau in dein Postfach“, und die Mail „Bestätige deine E-Mail-Adresse · Agrilo“ kommt an (Link gilt 24 Stunden).
2. In der Mail „Zur Bestätigung“ › auf der Seite „E-Mail bestätigen“.
   - [ ] „Danke, deine E-Mail ist bestätigt“ mit „Weiter zum Einrichten“. Fehler: „Das hat nicht geklappt“.

**Hof einrichten**

3. `/onboarding` („So wird dein Hof startklar“): „Hof anlegen“ mit erfundener Adresse und Telefon; als „E-Mail des Hofs“ wieder die Testhof-Adresse.
4. Einstellungen › „Abholzeiten“ › „Abholzeit hinzufügen“: je ein Fenster an den nächsten Tagen, z. B. Mo–Sa 09:00–12:00 › „+ Abholzeit hinzufügen“ (Toast „Abholzeit hinzugefügt“).
5. Produkte anlegen, genau mit diesen Preisen, alle „Im Shop“, Vorrat je 30. Weg: Unterleiste bzw. Seitenleiste „Neu“ › „Was legst du an?“.
   - „Lebensmittel“: „Test-Eier“, Kategorie Eier, Preis € 4,90 je Stück. Der Haken „Verdirbt schnell – kein Rücktritt möglich …“ ist bei Eiern **schon gesetzt**; so lassen (das ist das Produkt mit Rücktrittsausnahme).
   - „Lebensmittel“: „Test-Honig“, Kategorie Honig, € 7,50 je Glas. Haken nicht gesetzt.
   - „Futtermittel“: „Test-Heu“ mit zwei Größen, „5 kg-Sack“ € 4,90 und „Rundballen“ € 45,00. Unter den Hinweisen für Kunden bei „Abholung“ den Chip **„Abholung nach Absprache“** wählen. Im Abschnitt „Rücktritt“ das Feld „Geschätzte Kosten, wenn die Kundin die Ware zurückschickt …“ auf **30** setzen. Den Pflicht-Haken zu den Angaben setzen.
   - Für Futter braucht der Hof eine Betriebsnummer im Hof-Profil: eine erfundene, z. B. 9999999.
6. Einstellungen › „Zahlung“ › „Mit Stripe einrichten“. In Stripes Formular nur Testwerte (Tabelle oben; Auszahlungs-IBAN `AT611904300234573201`).
   - [ ] Nach der Rückkehr: „Dein Stripe-Konto ist eingerichtet. Online-Zahlung ist jetzt aktiv.“ und die Marke „Verbunden und aktiv“. Steht „Einrichtung nicht fertig“: kurz warten, „Status prüfen“.
   - [ ] Stripe-Dashboard (Testmodus) › Connect › Verbundene Konten › das neue Konto › Fähigkeiten: **Kartenzahlungen, Überweisungen und EPS-Zahlungen sind aktiv.** Fehlt EPS oder ist es nicht aktiv: Stopp und melden – im Hofpreis-Modell scheitert dann jede Online-Zahlung dieses Hofs, auch mit Karte.

**AGB zustimmen** (vor dem Stichtag)

- [ ] Hof › Heute: Karte „AGB bestätigen“ mit dem Satz „Ab <Tag> gilt Fassung 1.0. Bitte lies sie und stimm ihr zu – bis dahin gilt für dich Fassung 0.9. Mit deiner Zustimmung gilt Fassung 1.0 für dich ab <Tag>, ohne weitere Ankündigungsfrist (Punkt 32.4).“ <Tag> ist der Stichtag aus A0. Links „Fassung 1.0 lesen“ und „Fassung 0.9“.
- [ ] „Ich stimme den AGB zu“: Die Seite lädt neu, die Karte ist weg (ein Toast kommt nicht). Profil **Admin** › Höfe › Testhof › Abschnitt „Kontakt“, Zeile „AGB“: „Fassung 1.0 · <Datum>, <Uhrzeit> Uhr“.

**Freischalten, Testhof, Servicegebühr** (Profil **Admin**)

7. Admin › Höfe › Testhof „Prüfen“ › „Freischalten“ › Dialog „Hof freischalten?“ › „Freischalten“ › Passkey.
   - [ ] Toast „<Hof> freigeschaltet“, die Mail „Dein Hof ist freigeschaltet“ kommt an die Testhof-Adresse. Ist der Knopf grau, steht der Grund darunter (E-Mail nicht bestätigt, Stripe fehlt, kein Produkt im Shop, keine Abholzeit, keine Kunden-E-Mail).
8. In der Akte „Eingreifen“ › „Als Testhof markieren …“ › „Als Testhof markieren“ › Passkey.
   - [ ] Toast „Der Hof ist jetzt ein Testhof.“ und die Marke „Testhof“ in der Akte. Ein Testhof bekommt keinen Gründungsplatz und verschwindet aus `/hoefe`, Startseite und Karte; per Link bleibt er erreichbar.
   - [ ] Profil **Kundin**, Hofseite des Testhofs (per Link), eine Produktseite und die Kasse zeigen oben „Testhof von Agrilo – Bestellungen hier sind Testbestellungen, es gibt keine Ware.“
9. In der Akte „Servicegebühr …“ › „Prozentsatz (%)“ **5**, „Mindestgebühr (€)“ **0,50**, „Gebühr gilt ab“ **heute** › Passkey. Ohne Datum ist der Hof im alten Modell gebührenfrei; dann stimmen die Beträge in A3 nicht. (Der Knopf „Servicegebühr …“ verschwindet nach dem Stichtag.)

## A2 · Blick vor dem Stichtag (etwa 10 Minuten)

Profil **Kundin**.

- [ ] `/agb` zeigt Fassung 0.9 („Fassung 0.9 – Entwurf, Stand 13. Oktober 2026“) und oben fett „Ab <Tag> gilt Fassung 1.0.“ mit dem Link „Fassung 1.0 lesen“.
- [ ] `/agb/1.0` lässt sich lesen: „Fassung 1.0 – gilt ab <Tag>“, mit den Anhängen 1 bis 3.
- [ ] `/konditionen` nennt den Stichtag: „Ab <Tag> ist die Plattformgebühr im Preis enthalten (Stichtag).“ Der Abschnitt heißt noch „Servicegebühr und Abrechnung“.
- [ ] Hofseite des Testhofs: Test-Eier € 4,90, Test-Honig € 7,50 (Warenpreis ohne Aufschlag) und „Preise zzgl. 5 % Servicegebühr (mind. € 0,50) …“.

## A3 · Bestellungen im alten Modell als Vorrat für Teil B (etwa 25 Minuten)

Profil **Kundin**, Testhof. Abholtermin immer an einem der nächsten Tage. Bestellnummern notieren.

**V1 – online, 2 × Eier + 1 × Honig**

- [ ] Kasse, Übersicht: „Warenpreis“ € 17,30, „Servicegebühr (5 %)“ € 0,87, „Gesamt“ € 18,17. Unter dem Kaufknopf: „Es gelten die AGB von Agrilo. Dein Vertragspartner ist der Hof. Mit dem Bestellen stimmst du zu, dass Agrilo die Vermittlung sofort ausführt.“ (diesen letzten Satz gibt es nur im alten Modell).
- [ ] Banner zeigt „TEST · Dev-DB · Stripe Test“. „Weiter zur Zahlung · € 18,17“, Karte `4242 4242 4242 4242`, „Jetzt bezahlen · € 18,17“. Nach dem Neuladen bezahlt; Stripe: € 18,17, Anwendungsgebühr € 0,87, **kein** „im Namen von“ (on behalf of).
- [ ] Die Bestätigungsmail „Deine Bestellung bei <Testhof> – Abholung <Datum>“ hat die Datei `agb-agrilo-0.9.html` im Anhang.

**V2 – online, 1 × Eier + 1 × Honig** (für den Storno in B2)

- [ ] Banner prüfen. Gesamt € 13,02 (Servicegebühr € 0,62), mit Karte 4242 bezahlen.

**V3 – bar, 2 × Eier** (für das Abholen in B2)

- [ ] Banner prüfen. „Bar bei Abholung“ zeigt „Ohne Servicegebühr bis 31. Jänner 2027. Du bestätigst per E-Mail.“; die Gebührenzeile zeigt „entfällt“, Gesamt € 9,80. „Zahlungspflichtig bestellen · € 9,80“, dann in der Mail „Bitte bestätige deine Bestellung bei <Testhof>“ den Link und „Ja, ich hole verbindlich ab“.

## A4 · Notbremse (etwa 15 Minuten)

Wozu: Am Abend vor dem **echten** Stichtag hält die Projektleitung neue Bestellungen über Mitternacht an (Bericht 259). Hier wird der Griff einmal geübt – und **vor A6 wieder gelöst**, sonst lässt sich A6 nicht prüfen.

1. Profil **Admin** › Heute › „Bestellungen anhalten …“. Grund „Wartung“, „Satz für die Kundschaft“ so lassen („Bestellen ist gerade kurz nicht möglich. Bitte versuch es in einer Stunde wieder.“), „Bis spätestens“ in einer Stunde › „Mit Passkey anhalten“.
   - [ ] Toast „Neue Bestellungen sind angehalten.“, in Heute ganz oben die Aufgabe „Notbremse aktiv“ mit „Freigeben“.
2. Profil **Kundin**:
   - [ ] Hofseite und Kasse zeigen unter dem Kopf das Band mit dem Satz und „bis … Uhr“. „In den Korb“ heißt „Nicht bestellbar“; im Korb-Blatt steht statt „Zur Kasse“ „Bestellen geht gerade nicht.“ Eine offene Kasse nimmt beim Absenden nichts an und zeigt den Satz.
3. Profil **Hof**:
   - [ ] V1 öffnen: Die Knöpfe („Als gepackt markieren“, „Artikel fehlt“, „Stornieren …“) sind da und nicht gesperrt. Laufende Bestellungen bleiben bearbeitbar; nichts davon jetzt antippen.
4. Profil **Admin** › „Freigeben“ › Passkey.
   - [ ] Toast „Bestellungen gehen wieder.“, das Band ist (spätestens nach einer Minute) weg, „In den Korb“ geht wieder. Admin › Betrieb › Protokoll zeigt „Bestellungen angehalten“ und „Bestellungen wieder frei“.

## A5 · Stichtag auf morgen setzen (etwa 10 Minuten)

> **Achtung: nicht umkehrbar.** Nach Mitternacht ist der Stichtag erreicht und lässt sich nicht mehr ändern. Ein Zurücksetzen in der Datenbank ist kein verlässlicher Rückweg (die Einstellung liegt ohne Ablauf im Zwischenspeicher). Die Entwicklungsdatenbank bleibt danach im Hofpreis-Modell, auch für alle späteren Tests.

1. Profil **Admin** › Einstellungen › „Hofpreis-Modell ab“ › „Stichtag“ = **morgen** › „Stichtag speichern“ › Passkey.
   - [ ] Toast „Stichtag gespeichert.“ Gegenprobe vorher: „heute“ ergibt „Der Stichtag muss in der Zukunft liegen.“
   - [ ] Admin › Betrieb › Protokoll: „Stichtag Hofpreis-Modell geändert“ mit dem alten und dem neuen Tag.
   - [ ] `/agb` und `/konditionen` (neu laden) nennen jetzt den **morgigen** Tag. Die AGB-Karte eines Hofs ohne Zustimmung (Seed-Hof) sagt „Ab <morgen> gilt Fassung 1.0. …“.

## A6 · Rund um Mitternacht (freiwillig, aber der einzige Weg für diesen Fall; etwa 45 Minuten)

Geprüft wird: Eine Bestellung von vor Mitternacht bleibt im alten Modell, auch wenn sie erst danach bezahlt oder bestätigt wird. Die Online-Frist ist 30 Minuten ab Bestellung; deshalb geht das nur knapp um Mitternacht.

**V4 – online vor Mitternacht, bezahlt nach Mitternacht**

1. Zwischen **23:35 und 23:55**: 2 × Eier + 1 × Honig, online (€ 18,17). Banner prüfen. Im Zahlungsschritt **EPS** wählen und auf Stripes Testseite die Zahlung **scheitern lassen**.
   - [ ] Zurück in der App: „Zahlung fehlgeschlagen“ mit dem Knopf „Erneut versuchen“. Notier die Uhrzeit, bis zu der die Ware reserviert ist (30 Minuten ab Bestellung).
2. **Nach 00:00 und vor dieser Uhrzeit:** auf der Bestätigungsseite „Erneut versuchen“.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test“.
   - [ ] Die Seite „Bezahlen“ zeigt den **alten** Betrag € 18,17 mit einer Zeile „Servicegebühr …“ über € 0,87 (nicht „Plattformgebühr“), und der AGB-Link unter dem Knopf führt auf `/agb/0.9`.
   - [ ] Mit Karte 4242 bezahlen. Stripe: € 18,17, Anwendungsgebühr € 0,87 und **kein** „im Namen von“. Die Bestätigungsmail hat `agb-agrilo-0.9.html` im Anhang.

**V5 – bar vor Mitternacht, bestätigt nach Mitternacht**

1. Gegen **23:40**: 2 × Eier, „Bar bei Abholung“, Abholtermin an einem späteren Tag. Banner prüfen. „Zahlungspflichtig bestellen · € 9,80“. Die Mail noch nicht bestätigen (die Frist ist 2 Stunden).
2. **Nach 00:00:** In der Mail „Bitte bestätige …“ den Link öffnen, „Ja, ich hole verbindlich ab“.
   - [ ] V5 bleibt ohne Gebühr: € 9,80, keine Zeile „Plattformgebühr“, beim Hof „Bar zu kassieren“ € 9,80. Die Bestätigungsmail hat `agb-agrilo-0.9.html` im Anhang.

---

# Teil B – Der Tag danach (Sitzung 2)

Ab Mitternacht gilt in der Testumgebung das Hofpreis-Modell. Jede **neue** Bestellung kommt jetzt mit der Plattformgebühr (6 %, je Stück aufgerundet), online und bar mit demselben Endpreis. Bestellungen von gestern bleiben im alten Modell, für immer: Das Modell steht in jeder Bestellung fest gespeichert.

Vor jedem Schritt, der bezahlt oder Geld zurückbucht, steht wieder der Haken für das Banner. Er zählt mit, auch wenn er gleich aussieht.

## B1 · Generalprobe 259: Was nach Mitternacht umgeschaltet hat (etwa 15 Minuten)

Profil **Kundin**, dann **Hof** und **Admin**. Seiten, die sich nicht umstellen, einmal neu laden.

- [ ] `/agb` (bei jedem Aufruf frisch) zeigt jetzt „Fassung 1.0 – gilt ab <Stichtag>“ und unten den Link „Frühere Fassung 0.9 (für Bestellungen bis <Vortag>)“. Fehler: Es steht noch 0.9 oben, oder die Seite zeigt einen Ladefehler.
- [ ] `/agb/0.9` lässt sich weiter öffnen und zeigt die alte Fassung. `/agb/2.0` zeigt „nicht gefunden“.
- [ ] `/konditionen` (frisch je Aufruf): „Seit <Stichtag> ist die Plattformgebühr im Preis enthalten (Stichtag).“, der Abschnitt heißt jetzt „Plattformgebühr und Abrechnung“, und nirgends steht eine Marke „Entwurf“.
- [ ] `/fuer-hoefe` sagt „Die Plattformgebühr von 6 % steckt im Preis, den die Kundin zahlt – online wie bar. Du bekommst den vollen Warenpreis.“; Startseite und `/hoefe` zeigen Endpreise „inkl. Plattformgebühr“. Diese drei Seiten erneuern sich nur alle fünf Minuten: Steht kurz nach Mitternacht noch der alte Stand da, nach fünf Minuten einmal neu laden. Erst wenn es danach noch alt ist, ist es ein Fehler. (Der Testhof selbst steht als Testhof nicht auf `/hoefe`; dort schaust du auf einen Seed-Hof.)
- [ ] Hofseite des Testhofs: Test-Eier zeigen € 5,20, Test-Honig € 7,95 (Endpreise, Tabelle oben). Unter den Produkten steht „Preise inkl. Plattformgebühr (6 %) – online und bar gleich.“
- [ ] Profil **Admin** › Einstellungen › Karte „Hofpreis-Modell ab“: Das Feld ist gesperrt, dort steht „Der Stichtag ist erreicht – er lässt sich nicht mehr ändern.“ und der Satz beginnt mit „Seit diesem Tag gilt …“.
- [ ] AGB-Karte eines Hofs, der der Fassung 1.0 noch nicht zugestimmt hat (ein Seed-Hof; seine Admin-Akte zeigt bei den AGB „noch nicht zugestimmt“ oder „Fassung 0.9 · …“). Im Profil **Hof** als dieser Hof › Heute: Karte „AGB bestätigen“ ohne „Ab <Tag> gilt …“, sondern „Die AGB haben sich geändert (jetzt Fassung 1.0). Bitte lies sie und stimm ihnen zu. Dein Hof bleibt in der Zwischenzeit wie gewohnt nutzbar.“ (Hof mit 0.9) bzw. „Bitte lies die AGB (Fassung 1.0) und stimm ihnen zu. …“ (Hof ohne Zustimmung).

## B2 · Bestellungen von vor dem Stichtag (etwa 20 Minuten)

Die drei Bestellungen aus A3 (**V1**, **V2**, **V3**) bleiben im alten Modell. Profil **Hof** › Bestellungen.

- [ ] V1 und V2 zeigen weiter „Servicegebühr“ (nicht „Plattformgebühr“), V1 mit „Warenpreis € 17,30 + Servicegebühr € 0,87 – die Gebühr ist online einbehalten.“
- [ ] **Artikel fehlt bei V1** (online, alte Regel). Banner zeigt „TEST · Dev-DB · Stripe Test“. V1 › „Artikel fehlt“ › Test-Honig antippen. Der Dialog nennt: „<Vorname> bekommt zurück“ € 7,87 und „Von deiner nächsten Auszahlung abgezogen“ € 7,50, dazu „Artikel € 7,50 + Servicegebühr € 0,37 – die Gebühr gilt nur noch für € 9,80 Ware.“ Speichern. Toast „Gespeichert. <Vorname> bekommt € 7,87 zurück und eine E-Mail.“ (Rechnung: Tabelle „Was sich danach bewegt“.)
- [ ] **Storno von V2** (online). Banner zeigt „TEST · Dev-DB · Stripe Test“. V2 › „Stornieren …“: „<Vorname> bekommt zurück“ € 13,02, darunter „Warenpreis € 12,40 + Servicegebühr € 0,62“, „Von deiner nächsten Auszahlung abgezogen“ € 12,40 und „… Die Servicegebühr erstattet Agrilo.“ „Stornieren und erstatten“ → Toast „Storniert. <Vorname> bekommt € 13,02 zurück.“
- [ ] Stripe, Zahlung V2: ganz erstattet (€ 13,02), Überweisung an den Testhof ganz zurückgebucht, Anwendungsgebühr € 0,62 zurück. Zahlung V1: teilweise erstattet € 7,87, Rückbuchung vom Hof € 7,50, Anwendungsgebühr bleibt € 0,87.
- [ ] **V3 bar abholen**: V3 › „Als gepackt markieren“ › „Abgeholt und € 9,80 kassiert“. Toast „Als abgeholt und bezahlt gespeichert“. Keine Gebühr, auch heute nicht (bar vor dem 1. Februar 2027 im alten Modell). V1 danach „Als gepackt markieren“ › „Abgeholt“ → „Als abgeholt gespeichert“.
- [ ] **Mail noch einmal schicken**: Profil **Admin** › Betrieb › Reiter „E-Mails“ › „Alle Mails · 90 Tage“ › die Bestätigungsmail zu V3 öffnen › „Nochmal schicken“ › „Mit Passkey bestätigen und schicken“. Es steht „Ist unterwegs – …“. Die Mail kommt an und hat die Datei `agb-agrilo-0.9.html` im Anhang, nicht 1.0.

## B3 · Abnahme 197: Plattformgebühr im Preis (etwa 45 Minuten)

Profil **Kundin**, Testhof. Bestellungen hier heißen **H1** bis **H5**.

**Anzeige**

- [ ] Hofseite, Produktkarte und Produktseite zeigen den Endpreis: Test-Eier € 5,20, Test-Honig € 7,95, Test-Heu „Rundballen“ € 47,70, „5 kg-Sack“ € 5,20. Steht ein Grundpreis je kg darunter, ist er aus dem Endpreis gerechnet (5 kg-Sack: 520 Cent ÷ 5 = € 1,04 je kg). Fehler: irgendwo steht noch € 4,90 für die Eier.
- [ ] Warenkorb-Blatt mit 2 × Eier und 1 × Honig: Zeilen mit Endpreisen, „Gesamt“ € 18,35 und darunter „Inkl. Plattformgebühr · Reservierung gilt 15 Minuten.“ Nirgends „zzgl. Servicegebühr“.
- [ ] **Mindestbestellwert:** Nur 2 × Eier in den Korb (Warenwert € 9,80). Die Kasse zeigt keinen Bestellknopf, sondern die Karte „Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,60).“ und „Dir fehlen noch Waren für € 0,20. Leg noch etwas dazu.“ mit „Zurück zum Angebot“. Fehler: Man kann trotzdem bestellen.

**H1 – online mit Karte**

1. Korb: 2 × Eier, 1 × Honig. Kasse öffnen.
   - [ ] Übersicht: „Ware“ € 17,30, „Plattformgebühr (6 %)“ € 1,05, „Gesamt“ € 18,35, dazu „Preise inkl. USt“ und „Die Plattformgebühr ist Teil des Preises. Der Hof zahlt damit die Bestellplattform Agrilo.“ Die Warenkorb-Karte zeigt „2 × Eier · € 10,40“ und „1 × Honig · € 7,95“ (oder mit dem vollen Produktnamen).
2. „Online bezahlen“, Abholtermin, Daten, „Weiter zur Zahlung · € 18,35“.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test“.
3. Karte `4242 4242 4242 4242`, „Jetzt bezahlen · € 18,35“.
   - [ ] Bestätigungsseite nach dem Neuladen bezahlt. Die Positionen stehen dort mit dem **Warenpreis** (2 × Eier € 9,80, 1 × Honig € 7,50), darunter „Plattformgebühr · € 1,05“, „Gesamt € 18,35“ und „Online bezahlt · inkl. Plattformgebühr (6 %)“. Das ist so gebaut, kein Fehler.
   - [ ] Stripe › Zahlungen › diese Zahlung: Betrag € 18,35, Anwendungsgebühr € 1,05, Überweisung € 18,35 an das Konto des Testhofs, und in den Details „im Namen von“ (englisch „on behalf of“) **das Hofkonto**. Fehler: kein „im Namen von“.
   - [ ] Profil **Hof** › Bestellungen › H1: „Online bezahlt“ € 18,35 und „Du bekommst € 17,30 · die Kundin zahlt € 18,35 – die Gebühr ist online einbehalten.“ **Haken „Hof bekommt 100 % des Warenpreises“:** 18,35 − 1,05 = 17,30 = Warenpreis.

**H2 – 3-D Secure**

- [ ] Korb 1 × Honig + 1 × Eier (Ware € 12,40, Gebühr 45 + 30 = 75 Cent, Gesamt € 13,15). Banner prüfen. Karte `4000 0027 6000 3184`, im Stripe-Fenster „Complete“. Erwartet: bezahlt, Stripe: € 13,15, Anwendungsgebühr € 0,75, „im Namen von“ das Hofkonto.

**H3 – EPS**

- [ ] Korb 3 × Eier (Ware € 14,70, Gebühr 3 × 30 = 90 Cent, Gesamt € 15,60). Banner prüfen. „EPS“ und eine Bank wählen, auf Stripes Testseite die Zahlung bestätigen. Erwartet: bezahlt, Stripe: Zahlungsmethode EPS, € 15,60, Anwendungsgebühr € 0,90. **Fehler, der genau hier auffällt:** Stripe lehnt den Zahlungsvorgang ab oder die Kasse meldet, Online-Zahlung sei nicht möglich – dann fehlt dem Hofkonto die EPS-Fähigkeit (A1).

**H4 – bar, derselbe Korb wie H1**

Ob bar geht, hängt am Einzugsbeginn des Hofs („Einzug ab“) und an der Lastschrift. Damit das Ergebnis eindeutig ist, stellst du den Einzugsbeginn selbst ein: Profil **Admin** › Höfe › Testhof › Abschnitt „Plattformgebühr“ (unten in der Akte) › „Einzug ab (Vorgabe JJJJ-MM-TT)“ auf einen Tag **in einem Monat**, „Lastschrift Pflicht für bar“ angehakt lassen › „Mit Passkey speichern“. Toast „Plattformgebühr gespeichert. Satz und Einzug gelten für neue Bestellungen.“

- [ ] Profil **Kundin**: Korb 2 × Eier + 1 × Honig, „Bar bei Abholung“, „Zahlungspflichtig bestellen · € 18,35“. Banner prüfen. Mail bestätigen („Ja, ich hole verbindlich ab“). **Haken „online = bar“:** Übersicht und Knopf zeigen dieselben € 18,35 wie bei H1.
- [ ] Profil **Hof** › H4: „Bar zu kassieren“ € 18,35 und „Du bekommst die vollen € 18,35 – bis <Tag vor dem Einzug> zahlst du auf Barverkäufe keine Plattformgebühr.“ Die Gebühr bleibt bis zum Einzugsbeginn beim Hof.

**H5 – bar ohne Lastschrift bei fälligem Einzug**

In derselben Akte „Einzug ab“ auf **heute** setzen, „Lastschrift Pflicht für bar“ angehakt lassen, „Mit Passkey speichern“.

- [ ] Profil **Kundin**, neuer Korb (mindestens € 10 Ware), Kasse neu laden: Es gibt nur noch „Online bezahlen“, „Bar bei Abholung“ fehlt. Fehler: Bar wird angeboten.
- [ ] Profil **Hof** › Einstellungen › „Zahlung“, Karte „Bar bei Abholung“: Marke „Braucht Lastschrift“ und „Barzahlung gibt es, sobald du die Lastschrift für die Monatsabrechnung eingerichtet hast. …“ Bekannt und kein Fehler dieser Liste: Die Hofseite sagt bei „Zahlung & Kontakt“ weiter „Online bezahlen oder bar bei Abholung.“ (Bericht A011).

## B4 · Kasse und Recht (etwa 35 Minuten)

Profil **Kundin**, Testhof, Käuferart Verbraucherin (Normalfall).

- [ ] **Testhof-Hinweis (207):** Hofseite, Produktseite und jeder Schritt der Kasse zeigen oben „Testhof von Agrilo – Bestellungen hier sind Testbestellungen, es gibt keine Ware.“ In Mails steht er nicht.
- [ ] **Sätze unter dem Kaufknopf (215):** Unter „Weiter zur Zahlung“, „Zahlungspflichtig bestellen“ und „Jetzt bezahlen“ steht jeweils „Es gelten die AGB von Agrilo. Dein Vertragspartner ist der Hof.“ – **ohne** den Satz „Mit dem Bestellen stimmst du zu, dass Agrilo die Vermittlung sofort ausführt.“ (den gibt es nur im alten Modell, A3). Darunter „Du kannst vom Kauf innerhalb von 14 Tagen nach der Abholung zurücktreten – außer bei schnell verderblicher Ware. So geht’s: Rücktritt“. Beide Links öffnen in einem neuen Tab; „AGB“ führt auf `/agb` (Fassung 1.0).
- [ ] **Gewährleistung (211):** Über dem Kaufknopf und im Zahlungsschritt steht die Karte „Gesetzliche Gewährleistung“ mit der amtlichen Grafik.
- [ ] **Rücktritts-Hinweise am Produkt:** Produktseite und Warenkorb-Karte der Kasse zeigen bei Test-Eier „Kein Rücktritt: verdirbt schnell“ und beim Rundballen „Rücksendung geschätzt ca. € 30,00“ (der Betrag aus A1).
- [ ] **Abholung nach Absprache (257):** Rundballen in den Korb, Kasse: grüne Karte „Der Hof meldet sich bei dir, um die Abholung abzustimmen. Wähl trotzdem einen Wunschtermin.“, das Notizfeld heißt „Notiz zur Abholung (freiwillig)“. Bestellen (online, Karte 4242, Banner prüfen; Ware € 45,00 + Gebühr € 2,70 = € 47,70). Die Bestätigungsmail sagt unter „Wo“ „Der Hof stimmt die Abholung mit dir ab …“. Beim Hof (Heute und Bestellung) steht die Marke „Abholung absprechen“ mit „Mail schreiben“.
- [ ] **Bar-Mail an den Hof (256):** Nach einer Barbestellung (H4) bekommt die Adresse des Testhofs die Mail „Neue Bestellung für <Abholtag> – <Nr> (Bar bei Abholung)“ mit dem orangen Kasten „<Name> bestätigt bis … Erst dann packst du.“ Nach der Bestätigung durch die Kundin folgt „Bar-Bestellung <Nr> bestätigt“.
- [ ] **Bestätigungsmail an die Kundin (207):** Die Mail zu H1 „Deine Bestellung bei <Testhof> – Abholung <Datum>“ enthält die Rücktrittsbelehrung, das Muster-Widerrufsformular, den Link „Vertrag widerrufen“, die Gewährleistungs-Grafik und im Anhang `agb-agrilo-1.0.html`. Der AGB-Satz darin verlinkt `/agb/1.0`.
- [ ] **EPS abbrechen (202):** Banner prüfen. Neuer Korb (über € 10 Ware), online, EPS, auf Stripes Testseite die Zahlung **scheitern lassen**. Zurück in der App: „Zahlung fehlgeschlagen“, „Bitte versuche es erneut oder wähle eine andere Zahlungsart.“ und der Knopf „Erneut versuchen“. Der Korb ist noch da. „Erneut versuchen“ öffnet „Bezahlen“ mit „Jetzt bezahlen · € …“ für **dieselbe** Bestellung (gleiche Nummer); mit Karte 4242 bezahlen → bezahlt.
- [ ] **Käuferart Betrieb:** Dafür braucht der Korb ein Futter, das der Hof „Nur an landwirtschaftliche Betriebe“ abgibt (Schalter im Produktdialog von Test-Heu einschalten). In der Kasse erscheint „Betrieb“ mit „Ich bestelle als landwirtschaftlicher Betrieb“ und „Betriebsnummer“ (erfundene Nummer, z. B. 9999999). Mit Haken: kein Rücktrittssatz, keine Gewährleistungs-Karte, in der Mail keine Belehrung und kein Formular – die AGB-Datei hängt trotzdem an. Danach den Schalter wieder ausschalten.

## B5 · Rücktritt (200, 214) (etwa 40 Minuten)

Rücktritt heißt in der App auch „Widerruf“. Vor der Abholung storniert die App von selbst; nach der Abholung entscheidet der Hof.

**Einstiege**

- [ ] Der Link „Vertrag widerrufen“ steht in der Bestätigungsmail (H1), auf der Bestätigungsseite, auf der Bestellseite (Link aus der Mail) und im Seitenfuß jeder Kundenseite. Aus Mail und Bestellseite öffnet er `/widerruf` mit der Bestellung schon ausgefüllt, aus dem Fuß ein leeres Formular.

**Ganz zurücktreten vor der Abholung (H2, online bezahlt)**

1. Aus der Mail zu H2 „Vertrag widerrufen“. Die Seite „Rücktrittsrecht“ zeigt „Schritt 1 von 2“ mit „Bestellung“ und „Hof“.
2. „Die ganze Bestellung“, „Vertrag widerrufen“, dann „Schritt 2 von 2 · Bitte prüfe deinen Rücktritt“ und „Widerruf bestätigen“.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test“ (der Rücktritt erstattet sofort).
   - [ ] Grüne Karte „Dein Rücktritt ist bei uns eingegangen“ mit drei Sätzen, Knopf „Drucken oder speichern“.
   - [ ] Mail „Dein Widerruf ist eingegangen · Agrilo“ (Eingangsbestätigung), dazu die Storno-Mail „Deine Bestellung <Nr> wurde storniert“. Stripe: Zahlung H2 ganz erstattet (€ 13,15).
   - [ ] Bei Test-Eier stand in der Positionsliste „Für diese Ware besteht nach Angabe des Hofs kein Rücktrittsrecht (§ 18 Abs. 1 Z 4 FAGG). Der Hof prüft das im Einzelfall.“, beim Honig „Diese Ware ist meist haltbar – der Rücktritt ist hier wahrscheinlich möglich. …“.

**Einzelne Artikel nach der Abholung (H1)**

Vorher Profil **Hof** › H1 › „Als gepackt markieren“ › „Abgeholt“.

1. Aus der Mail zu H1 „Vertrag widerrufen“ › „Einzelne Artikel“ › nur Test-Honig ankreuzen › „Vertrag widerrufen“ › „Widerruf bestätigen“.
   - [ ] Eingangsbestätigung wie oben, Umfang nennt den Honig. Stripe: noch **nichts** erstattet (nach der Abholung entscheidet der Hof).
2. Profil **Hof**:
   - [ ] Heute zeigt die Karte „Rücktritt eingegangen“ („Eine Kundin ist von einem Kauf zurückgetreten.“), das Postfach die Nachricht „Rücktritt zu Bestellung <Nr>: Bitte prüf die Rückgabe und erstatte oder lehne mit Grund ab.“, die Mail „Rücktritt zu Bestellung <Nr>“ kommt an die Hof-Adresse.
3. H1 öffnen › „Rückgabe erhalten – erstatten …“ › „Erstatten“.
   - [ ] Banner zeigt „TEST · Dev-DB · Stripe Test“.
   - [ ] Toast „Erstattung gespeichert“. Die Kundin bekommt „Dein Rücktritt ist erledigt · <Nr>“. Stripe, Zahlung H1: teilweise erstattet **€ 7,95** (Honig € 7,50 + seine Gebühr € 0,45), Rückbuchung vom Hof **€ 7,50**. Rechnung: Tabelle „Was sich danach bewegt“.

**Ablehnen und ohne Bestellung**

- [ ] Ablehnen: H3 (nur Eier, „kein Rücktritt“) abholen lassen, Rücktritt über „Die ganze Bestellung“ einreichen, beim Hof „Ablehnen …“ mit leerem Grund → „Bitte schreib einen Grund.“; mit Grund → Toast „Ablehnung gespeichert“, die Kundin bekommt „Dein Rücktritt wurde abgelehnt · <Nr>“ mit dem Grund.
- [ ] Ohne passende Bestellung: Im Seitenfuß „Vertrag widerrufen“, eine erfundene Bestellnummer und die Adresse der Kundin eintragen, absenden. Die Kundin bekommt die Eingangsbestätigung. Profil **Admin** › Heute zeigt „Rücktritt ohne Bestellung“; Admin › Bestellungen, Abschnitt „Rücktritte ohne Bestellung“ zeigt „eingegeben: <Nr>“ und „Zuordnen …“. Nicht zuordnen – stehen lassen ist hier in Ordnung.

## B6 · Hof-Alltag im neuen Modell (etwa 30 Minuten)

Profil **Hof**. Eine frische Online-Bestellung **H6** (2 × Eier + 1 × Honig, Karte 4242, € 18,35) und eine frische Online-Bestellung **H7** (gleicher Korb) anlegen, dazu **H8** (1 × Honig + 1 × Eier, € 13,15). Banner jedes Mal prüfen.

- [ ] **Artikel fehlt (H6):** „Artikel fehlt“ › Test-Honig. Dialog: „<Vorname> bekommt zurück“ € 7,95, „Von deiner nächsten Auszahlung abgezogen“ € 7,50, „Artikel € 7,50 + Plattformgebühr € 0,45 – die Gebühr gilt nur noch für € 9,80 Ware.“ und „… Den Unterschied bei der Plattformgebühr erstattet Agrilo.“ Banner prüfen, speichern: Toast „Gespeichert. <Vorname> bekommt € 7,95 zurück und eine E-Mail.“
- [ ] Stripe zu H6: Erstattung € 7,95 mit `anlass=teilstorno` und `art=kunde`, Rückbuchung der Überweisung € 7,50 mit `art=hof`, Anwendungsgebühr bleibt € 1,05. Beim Hof steht H6 jetzt mit „Für fehlende Artikel schon erstattet: € 7,95“.
- [ ] **Abgeholt (H6):** „Als gepackt markieren“ (Toast „Als gepackt markiert“) › „Abgeholt“ (Toast „Als abgeholt gespeichert“). Stripe: nichts Neues.
- [ ] **Storno (H7):** „Stornieren …“: „<Vorname> bekommt zurück“ € 18,35, „Warenpreis € 17,30 + Plattformgebühr € 1,05“, „Von deiner nächsten Auszahlung abgezogen“ € 17,30 und „Das ist genau der Warenpreis, den du für diese Bestellung bekommen hast. Die Plattformgebühr wird mit erstattet – sie gibt Agrilo zurück, nicht du.“ Banner prüfen, „Stornieren und erstatten“ → „Storniert. <Vorname> bekommt € 18,35 zurück.“ Der Vorrat ist zurück.
- [ ] Stripe zu H7: ganz erstattet € 18,35 (`anlass=vollstorno`), Überweisung ganz zurückgebucht, Anwendungsgebühr € 1,05 zurück. Beim Hof unterm Strich € 0,00.
- [ ] **Nicht abgeholt (H8):** „Nicht abgeholt“. Dialog „Nicht abgeholt?“: „… Sie bekommt keine E-Mail.“ und „Die Plattformgebühr von € 0,75 bekommt <Vorname> zurück. Der Warenpreis bleibt bei dir.“ sowie „Das lässt sich nicht rückgängig machen.“ Banner prüfen, bestätigen: Toast „Als nicht abgeholt gespeichert“, dazu „Warenpreis € 12,40 · Plattformgebühr € 0,75 entfällt“.
- [ ] Stripe zu H8: teilweise erstattet € 0,75 mit `grund=servicegebuehr_nicht_abgeholt`, **keine** Rückbuchung vom Hof, Anwendungsgebühr bleibt € 0,75. Der Hof behält € 12,40.
- [ ] **Bar abgeholt (H4):** „Als gepackt markieren“ › „Abgeholt und € 18,35 kassiert“ → „Als abgeholt und bezahlt gespeichert“. H4 kommt nicht in die Monatsabrechnung, solange ihre Gebühr erlassen war; die Abrechnung prüft Teil C mit eigenen Bestellungen.

---

# Teil C – Monatsabrechnung und was weiter gilt (Sitzung 3)

Die Plattformgebühr aus Barbestellungen holt die Plattform einmal im Monat per Lastschrift (SEPA) oder Rechnung zur Überweisung. Online behält Stripe sie gleich beim Bezahlen ein. Gebraucht werden zwei Höfe:

- der **neue Testhof** aus A1 mit der IBAN, deren Einzug **scheitert** (seine Mails kommen bei dir an),
- ein **Seed-Hof** (Konto `…@example.com`, Passwort aus `prisma/seed-daten.ts`) mit der IBAN, deren Einzug **gelingt**. Seine Mails kommen nicht an; geprüft wird bei ihm nur der Stand.

## C1 · Lastschrift einrichten (etwa 20 Minuten)

Profil **Hof**, zuerst der neue Testhof.

1. Einstellungen › „Konditionen und Tarif“ (Seite „Deine Konditionen“), ganz unten die Karte „Barzahlung“.
   - [ ] Die Karte zeigt „Plattformgebühr 6 % vom Warenpreis“, „Einzug ab <Datum>“, die Marke „fehlt“ mit „Lastschrift nicht eingerichtet.“ und „Ohne Lastschrift bieten wir bei dir ab dem Einzug nur Online-Bezahlen an.“
2. „Lastschrift einrichten“ tippen. In der Karte erscheint Stripes Formular. Erfundener Name, die Adresse des Testhofs aus `TEST_EMPFAENGER`, IBAN `AT861904300235473202` (Einzug scheitert). Unten wieder „Lastschrift einrichten“.
   - [ ] Gleich danach steht „Die Bank bestätigt die Lastschrift – das dauert meist nur einen Moment. Lade die Seite gleich neu.“ Gültig ist das Mandat erst, wenn Stripe es der App meldet.
   - [ ] Nach dem Neuladen: Marke „eingerichtet“, „Lastschrift eingerichtet · … · IBAN endet auf 3202“ und der Knopf „Lastschrift ändern“. Fehler: Auch nach einer Minute und erneutem Laden steht „fehlt“ (dann fehlt meist `setup_intent.succeeded` am Webhook, A0).
3. Profil **Kundin**, neuer Korb beim Testhof (über € 10 Ware), Kasse neu öffnen.
   - [ ] „Bar bei Abholung“ ist wieder da (Einzug fällig seit B3, jetzt mit Lastschrift).
4. Profil **Admin** › Höfe › Testhof › „Plattformgebühr“.
   - [ ] „Lastschrift“ zeigt „eingerichtet“. Im Protokoll steht „Lastschrift eingerichtet“.
5. Dasselbe für den **Seed-Hof** mit IBAN `AT321904300235473204` (Einzug gelingt nach etwa drei Minuten). Ein Seed-Hof ist meist Gründungshof, seine Bargebühr wäre damit noch erlassen: In seiner Akte deshalb „Einzug ab“ auf **heute** setzen, wie beim Testhof in B3.
   - [ ] Nach dem Neuladen „eingerichtet“, IBAN endet auf 3204, „Einzug ab“ zeigt heute.

## C2 · Abnahme 198: die Monatsabrechnung (etwa 30 Minuten, verteilt über zwei Monate)

**Was es braucht:** je Hof eine Barbestellung im neuen Modell, deren Gebühr per Lastschrift kommt (in der Bestellung steht „… – die Gebühr holt die Monatsabrechnung.“), und die im **Vormonat** abgeholt wurde.

1. Profil **Kundin**: Beim Testhof und beim Seed-Hof je eine Barbestellung nach C1 (also mit Lastschrift), z. B. 2 × Eier + 1 × Honig bzw. ein Korb über € 10. Banner prüfen. Per Mail bestätigen (beim Seed-Hof geht die Mail an die Kundin; die kommt an).
2. Profil **Hof** je Hof: „Als gepackt markieren“ › „Abgeholt und € … kassiert“.
   - [ ] Der Satz in der Bestellung endet auf „– die Gebühr holt die Monatsabrechnung.“
3. Profil **Admin** › Höfe › je Hof › „Plattformgebühr“: „Abrechnungstag (1–28)“ und „Einzug ab“ ansehen und notieren.

**Wie die Abrechnung ausgelöst wird (Stand des Codes beim Schreiben dieser Liste):** Es gibt **keinen Knopf** im Admin. Die Abrechnung läuft als täglicher Ablauf um 05:30 Uhr UTC und rechnet nur Höfe ab, deren Abrechnungstag heute ist, und nur den **Vormonat** (abgeholt im Vormonat, nach Wiener Zeit). Vercel startet solche Abläufe nur in der Produktion. **In der Testumgebung läuft die Monatsabrechnung also nie von selbst.**

> **Notweg, nur Testumgebung**
>
> 1. Bei Vercel eine eigene Variable `CRON_SECRET` **nur für den Branch `staging`** anlegen (Umgebung Preview, Git-Branch `staging`) mit einem neuen, zufälligen Wert. **Nie den Wert der Produktion nehmen, nie den Wert irgendwo aufschreiben.** Dann `staging` neu deployen.
> 2. Warten, bis der Monat gewechselt hat: Die Barbestellungen aus Schritt 2 müssen im Vormonat abgeholt sein.
> 3. Profil **Admin**: Bei beiden Höfen den „Abrechnungstag (1–28)“ auf den **heutigen** Tag des Monats setzen, „Mit Passkey speichern“.
> 4. Die Abrechnung von einem Laptop aus aufrufen. Die Adresse ist `https://test.agrilo.at/api/cron/monatsabrechnung`. Der Aufruf braucht zwei Kopfzeilen: `Authorization: Bearer <dein staging-CRON_SECRET>` und `x-vercel-protection-bypass: <Geheimnis aus testumgebung.md, Schritt 5>`. Mit einem Terminal geht das so (Werte nur in deinem Terminal einsetzen, nie in eine Datei oder einen Chat):
>
> ```bash
> curl -sS -H "Authorization: Bearer $STAGING_CRON_SECRET" -H "x-vercel-protection-bypass: $VERCEL_BYPASS" https://test.agrilo.at/api/cron/monatsabrechnung
> ```
>
> Erwartet: eine kurze Antwort mit Zahlen und `"at"`. `401` heißt: falsches Secret oder Vercel-Sperre.
> 5. Der Aufruf rechnet alle Höfe der Entwicklungsdatenbank ab, deren Abrechnungstag heute ist, und verschickt auch die Ankündigungen („Plattformgebühr ab …“). Das ist in der Testumgebung in Ordnung.

- [ ] Stripe (Testmodus) › Rechnungen: je Hof eine Rechnung „Plattformgebühr <Monat Jahr> · bar“ mit je Bestellung der Zeile „Plattformgebühr bar · Bestellung <Bestellnummer>“ (Betrag = die Gebühr der Bestellung, z. B. € 1,05). Hatte der Hof im Vormonat auch Online-Bestellungen: zusätzlich „Plattformgebühr <Monat Jahr> · online, bereits einbehalten“, als bezahlt markiert.
- [ ] Profil **Admin** › Geld, Monat = Vormonat (Pfeil „Vorheriger Monat“): Abschnitt „Plattformgebühr · Monatsabrechnung <Monat Jahr>“ mit „bar (Lastschrift oder Überweisung)“ und „online (von Stripe einbehalten)“.
- [ ] Profil **Hof** › Deine Konditionen › „Monatsabrechnungen“: eine Zeile „<Monat Jahr> · bar € … · online € …“ mit Stand und „Rechnung (PDF) bar“; der Knopf öffnet die Rechnung.
- [ ] Ein zweiter Aufruf am selben Tag erzeugt keine zweite Rechnung.

## C3 · Einzug: gelingt, scheitert, Sperre (etwa 20 Minuten, dazu ein Nachblick am Folgetag)

**Gelingt (Seed-Hof):**

- [ ] Etwa drei Minuten nach der Abrechnung: Stand „bezahlt“ in Admin › Akte des Seed-Hofs („Letzte Abrechnungen“) und beim Hof unter „Monatsabrechnungen“. Stripe zeigt die Rechnung als bezahlt.

**Scheitert (neuer Testhof):**

- [ ] Stand „Lastschrift gescheitert“ in der Akte und beim Hof. Admin › Heute zeigt die Aufgabe „Lastschrift gescheitert“.
- [ ] Postfach des Testhofs: Nachricht „Die Lastschrift für <Monat Jahr> hat nicht geklappt. Stripe versucht es erneut. … Bleibt der Betrag <N> Tage offen, nehmen wir bei dir keine Barbestellungen mehr an – laufende Bestellungen bleiben.“ Dazu die Mail „Lastschrift für <Monat Jahr> hat nicht geklappt“.
- [ ] **Sperre nach Frist:** Vorher (gleich nach C1) in Admin › Akte des Testhofs „Tage bis zur Sperre“ auf **1** setzen. Am **Folgetag**, mehr als 24 Stunden nach der ersten gescheiterten Lastschrift: Die Kasse des Testhofs bietet nur „Online bezahlen“ an. Hof › Heute zeigt „Barzahlung ist gesperrt“ mit „Die Plattformgebühr für <Monat Jahr> ist noch offen. …“ und „Jetzt bezahlen“; Einstellungen › Zahlung zeigt „Bar gesperrt“. Eine schon bestätigte Barbestellung bleibt und lässt sich abholen.
- [ ] **Wieder frei nach der Zahlung:** Auf Heute „Jetzt bezahlen“ öffnet Stripes Rechnungsseite. Die Rechnung nimmt nur Lastschrift an: dort die IBAN `AT321904300235473204` (gelingt) eingeben und bezahlen. Nach einigen Minuten und dem Neuladen steht die Abrechnung auf „bezahlt“, und die Kasse bietet bar wieder an. Kein Knopf im Admin nötig.
- [ ] **Rückbuchung (nur, wenn die IBAN dafür an der Stripe-Testseite zu finden ist):** Ein Hof mit der Rückbuchungs-IBAN von docs.stripe.com/testing als Mandat; nach der Abrechnung Stand „zurückgebucht“, Bar **sofort** gesperrt, Hof › Heute „Die Lastschrift für <Monat Jahr> wurde zurückgebucht. Barzahlung ist gesperrt – das Team meldet sich bei dir.“, Admin › Heute „Lastschrift zurückgebucht“. **Achtung:** „zurückgebucht“ hebt sich in der App nicht von selbst auf, auch nicht durch eine spätere Zahlung, und einen Knopf dafür gibt es nicht. Diesen Hof danach nicht mehr für Bar-Tests nehmen.

## C4 · Was weiter gilt (etwa 45 Minuten)

Gekürzte Fassung der Abläufe aus der alten Liste, an die heutige Oberfläche angepasst.

**Bar unbestätigt verfällt** (Profil **Kundin**, Testhof)

Eine Barbestellung muss per Mail bestätigt sein, bevor die frühere von zwei Grenzen erreicht ist: 2 Stunden nach dem Bestellen oder der Beginn des gewählten Abholfensters. Die Frist gilt beim Lesen: Wer danach Hofseite, Kasse oder die Bestellungen des Hofs öffnet, gibt die Ware frei.

1. Vorrat von Test-Honig notieren. 2 × Honig (Ware € 15,00, Gebühr 2 × 45 = 90 Cent, € 15,90), bar, Banner prüfen, „Zahlungspflichtig bestellen · € 15,90“. Die Mail **nicht** bestätigen.
2. Warten (2 Stunden) – oder in der **Entwicklungsdatenbank, nie in der Produktion** die Zeit vorstellen: `update "Order" set "createdAt" = now() - interval '3 hours' where "orderNumber" = '<Bestellnummer>';` Dann die Hofseite öffnen.

- [ ] Beim Hof steht die Bestellung auf „Storniert“ mit dem Grund „Nicht rechtzeitig bestätigt“, der Vorrat von Test-Honig ist wieder wie vorher.
- [ ] Die Kundin bekommt „Deine Bestellung ist verfallen, weil sie nicht bestätigt wurde“. Der Link aus der ersten Mail zeigt „Bestellung verfallen“ mit „Du hast nicht bis … bestätigt. Der Hof packt nichts, dir entstehen keine Kosten.“

**Futter mit Größe und Hinweis**

- [ ] Produktseite von Test-Heu: beide Größen mit Endpreis (5 kg-Sack € 5,20, Rundballen € 47,70). Auf der Produktseite und im Korb-Blatt steht „Die Angaben zu Registrierung und Kennzeichnung stammen vom Hof. Der Hof ist für ihre Richtigkeit verantwortlich; Agrilo vermittelt nur und prüft die Angaben nicht.“

**Bestellungen finden per Code** (Profil **Kundin**)

- [ ] „Meine Bestellungen“ (`/bestellungen`) › E-Mail der Kundin › „Code schicken“. Die Mail „Dein Code für deine Bestellungen · Agrilo“ kommt an. Code eingeben › „Bestellungen anzeigen“: Die Liste zeigt die Bestellungen aus Teil A bis C, getrennt in „Aktuell“ und „Früher“, je mit Hof, Nummer, Stand und Betrag.
- [ ] Gegenprobe: Ein falscher Code ergibt „Der Code stimmt nicht. …“ und keine Liste. Nach 30 Minuten verlangt die Seite einen neuen Code („Deine Ansicht ist abgelaufen“).

**Neuigkeiten mit Bestätigung per Mail** (Double-Opt-in)

- [ ] Bestätigungsseite einer abgeholten Bestellung (z. B. H6): Karte „Neuigkeiten vom Hof per E-Mail“ mit „Ja, Neuigkeiten per E-Mail“. **Einmal** tippen: „Danke! Falls du noch nicht angemeldet bist, kommt gleich eine E-Mail zum Bestätigen.“ Die Mail „Bitte bestätige deine Anmeldung · Agrilo“ kommt an; ihr Link führt zu „Bestätige deine Anmeldung“, erst nach „Anmeldung bestätigen“ steht „Danke, du bist angemeldet“. War die Adresse schon angemeldet, kommt keine Mail – auch das ist richtig.
- [ ] Gegenprobe: Eine stornierte Bestellung (H7) zeigt die Karte **nicht**.

**Hof-Anmeldung und Hofbereich am Handy** (Handy oder 390 px Breite)

- [ ] Profil **Kundin**, abgemeldet: oben rechts „Anmelden“ › `/login` mit „Ich kaufe ein“ | „Ich habe einen Hof“. Als Testhof mit E-Mail und Passwort anmelden: Es öffnet „Heute“.
- [ ] Die Unterleiste zeigt „Heute“ · „Bestellungen“ · „Neu“ · „Mein Hof“ · „Mehr“. Alles ist gut zu treffen, nichts abgeschnitten, hell und dunkel.

**Produkt anlegen und teilen** (Handy, Profil **Hof**)

- [ ] „Neu“ › „Lebensmittel“ › „Test-Marmelade“, € 3,90, Vorrat 5, „Im Shop“ › speichern. Es erscheint „Test-Marmelade ist online“ mit „Kunden sehen es ab jetzt auf deiner Hofseite. Sag ihnen Bescheid?“ und „Fragt nur einmal pro Produkt. Abschalten unter Einstellungen.“ „Jetzt teilen“ öffnet das Teilen-Fenster; „Kopieren“ meldet „Link kopiert“, der Link endet auf `?k=link`.

**QR-Plakat**

- [ ] `/status/plakat` zeigt „QR-Plakat“ mit dem Code und unten die Adresse der Hofseite auf `test.agrilo.at`, nicht `agrilo.at`. Scannen mit dem Handy (dort bei Vercel angemeldet) öffnet die Hofseite des Testhofs; `?k=qr` verschwindet nach dem Laden aus der Adresszeile (gewollt).

**Unbekanntes Hof-Konto** (`docs/betrieb/stripe-live.md` §0, Probe „neu einrichten“)

Erst ganz am Ende von Teil C: Der Schritt schaltet die Online-Zahlung des Testhofs ab. **Nur in der Entwicklungsdatenbank** (SQL-Editor des Dev-Projekts), **nie in der Produktion.**

1. Bisherige Kennung notieren: `select "stripeAccountId" from "Farm" where slug = '<hof-slug>';`
2. Erfundene Kennung setzen: `update "Farm" set "stripeAccountId" = 'acct_erfunden0000000000', "stripeAccountReady" = true where slug = '<hof-slug>';`
3. Profil **Hof** › Einstellungen › „Zahlung“ › „Status prüfen“.

- [ ] Die Karte „Online-Zahlung neu einrichten“ mit „Stripe kennt dein bisheriges Konto nicht mehr. Richte die Online-Zahlung bitte neu ein – das dauert etwa 10 Minuten. Bis dahin bieten wir deinen Kundinnen nur Barzahlung an.“, die Marke „Nicht mehr verbunden“ und der Knopf „Online-Zahlung neu einrichten“.
- [ ] Profil **Kundin**: Die Kasse des Testhofs bietet nur noch „Bar bei Abholung“ an. (Kam die Kundin schon vorher in den Zahlungsschritt: „Online-Zahlung ist bei diesem Hof gerade nicht möglich. Bitte wähle Bar bei Abholung.“)
- [ ] Zurück: alte Kennung wieder eintragen (`update "Farm" set "stripeAccountId" = '<alte Kennung>' where slug = '<hof-slug>';`), dann „Status prüfen“ → „Verbunden und aktiv“. Oder „Online-Zahlung neu einrichten“ tippen; das legt ein neues Test-Konto an (danach wieder die EPS-Fähigkeit wie in A1 prüfen).

**Testbetrieb-Hinweise der Produktion** (nur ansehen, nichts bestellen)

- [ ] In der Testumgebung erscheint keiner der drei Sätze; dort sagt es das Banner. `agrilo.at/admin` zeigt oben „Stripe läuft im Testmodus – Online-Zahlungen sind Testzahlungen, es fließt kein echtes Geld.“, solange die Produktion mit dem Test-Schlüssel läuft. Die Sätze an „Online bezahlen“ in der Kasse („Testbetrieb: Echte Karten werden noch abgelehnt. …“) und in Einstellungen › Zahlung prüfst du nur an den Bildern in Bericht 42 (`docs/nachtlauf/berichte/bilder/42/`): In der Produktion reserviert ein Korb Ware eines echten Hofs.

## C5 · Abschluss (etwa 10 Minuten)

- [ ] Stripe › Entwickler › Webhooks › Endpunkt `https://test.agrilo.at/api/stripe/webhook`: Alle Zustellungen der drei Sitzungen haben 200, keine offenen Wiederholungen. Eine 401 heißt Vercel-Sperre, eine 400 falsches Secret.
- [ ] Sentry, Umgebung preview: keine neue Meldung außer den erwarteten (unbekanntes Hof-Konto aus C4, höchstens einmal je Hof und Tag). Umgebung production: durch den Probelauf nichts Neues.
- [ ] Die Kennung aus C4 „Unbekanntes Hof-Konto“ ist zurückgesetzt oder neu eingerichtet; der Testhof zeigt „Verbunden und aktiv“.
- [ ] Was stehen bleibt und nicht stört: Testhof, Seed-Hof mit Mandat, Testbestellungen und Abrechnungen in der Entwicklungsdatenbank, Zahlungen und Rechnungen im Stripe-Testmodus, der gesetzte Stichtag, das `CRON_SECRET` für `staging`. Die Entwicklungsdatenbank bleibt im Hofpreis-Modell.


---

# Ergebnis

Diese Tabelle kommt in den Bericht an die Projektleitung. Ergebnis je Zeile: **bestanden**, **Fehler** oder **ausgelassen**; in die Notiz Bestellnummer, Uhrzeit und Grund, nie Namen oder Adressen.

| Abschnitt | Was | Ergebnis | Notiz |
|---|---|---|---|
| A0 | Ort und Vorbedingungen | | |
| A1 | Neuer Testhof bis zur Freischaltung (EPS-Fähigkeit, AGB, Testhof) | | |
| A2 | Blick vor dem Stichtag | | |
| A3 | Bestellungen im alten Modell (V1–V3) | | |
| A4 | Notbremse | | |
| A5 | Stichtag auf morgen gesetzt | | |
| A6 | Rund um Mitternacht (V4, V5) | | |
| B1 | Was nach Mitternacht umgeschaltet hat | | |
| B2 | Bestellungen von vor dem Stichtag | | |
| B3 | Plattformgebühr im Preis (H1–H5) | | |
| B4 | Kasse und Recht | | |
| B5 | Rücktritt | | |
| B6 | Hof-Alltag im neuen Modell (H6–H8) | | |
| C1 | Lastschrift einrichten | | |
| C2 | Monatsabrechnung (Notweg ja/nein) | | |
| C3 | Einzug gelingt, scheitert, Sperre | | |
| C4 | Was weiter gilt | | |
| C5 | Abschluss | | |
| **Abnahme 197** | Plattformgebühr im Preis: B3 mit „online = bar“ und „Hof bekommt 100 % des Warenpreises“, dazu B4 und B6 | | |
| **Abnahme 198** | Monatsabrechnung mit SEPA: C1 bis C3 | | |
| **Generalprobe 259** | Umschalten über Mitternacht mit AGB 1.0: A5, A6 und B1 | | |
