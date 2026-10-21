# Stripe live schalten

Schritte für den Menschen, **ganz am Schluss** (Register Z2). Kein Nachtlauf und kein Agent schaltet um. Hier stehen keine Werte: Schlüssel und Secrets gehören nur in Stripe und Vercel, nie in Chat, Tickets oder Commits.

**Heute (Stand 08.10.2026):** Vorschau und Produktion teilen sich bei Vercel EINE Gruppe `STRIPE_*`-Variablen mit Test-Schlüsseln. Die Produktion läuft also im **Testbetrieb**: Echte Karten lehnt Stripe ab. Deshalb zeigen drei Stellen einen Hinweis:

- die Kasse an „Online bezahlen",
- die Admin-Seiten als orange Karte,
- Einstellungen → Zahlung.

Mit dem Live-Schlüssel verschwinden alle drei von selbst. Den Modus liest die App nur am Präfix des Schlüssels (`bestimmeUmgebung`, `src/lib/umgebung.ts`).

**Was die App schon absichert:**

- **Modus-Wache:** Ein Live-Schlüssel (`sk_live_` oder `rk_live_`) startet Stripe **nur im Produktions-Deployment bei Vercel** (`VERCEL_ENV=production`). Überall sonst startet Stripe damit nicht: in der Vorschau, lokal mit `next dev`, in Tests und in der CI. Lokal mit `next start` gilt das nur, solange `VERCEL_ENV` nicht auf `production` steht – nach `vercel env pull --environment=production` startet er dort doch. Die Meldung beginnt mit „Stripe startet nicht …", Sentry bekommt sie einmal je Instanz, ohne Schlüssel. Der Webhook antwortet dann mit 503 „Zahlungsdienst vorübergehend nicht verfügbar." (die Einzelheiten stehen nur im Protokoll), nicht mit „Signatur ungültig".
- **Unbekanntes Hof-Konto:** Ein gespeichertes Hof-Konto, das Stripe nicht kennt oder für das der Plattform-Schlüssel keinen Zugriff hat, macht den Hof „nicht bereit". Danach bietet die Kasse dort nur Bar an, und der Hof sieht „Online-Zahlung neu einrichten". Die Kennung wird nicht automatisch gelöscht.

**Grenzen, die du kennen solltest:**

- **Die Wache vertraut `VERCEL_ENV`.** Fehlt die Variable in der Produktion zur Laufzeit, sperrt sie mit dem Live-Schlüssel auch die Produktion. Vercel liefert sie nur mit dem Schalter „Automatically expose System Environment Variables" (Haken vor Schritt 8).
- **„Kein Zugriff" kann auch „falscher Plattform-Schlüssel" heißen.** Gehört der Live-Schlüssel zu einem anderen Stripe-Konto als dem, in dem Connect eingerichtet ist, gilt jeder Hof als unbekannt. „Neu einrichten" legte die Konten dann bei der falschen Plattform an. Deshalb: Schlüssel aus dem richtigen Konto (Schritt 4) und zuerst EIN Hof (Schritt 9).
- **Die alte Kennung steht nach dem Neu-Einrichten nur noch im Laufzeit-Protokoll**, und Vercel bewahrt es je nach Plan nur kurz auf. Deshalb die Kennungen vorher notieren (Schritt 0).
- **Scheitert der erste Versuch „neu einrichten" bei Stripe**, gibt der Knopf bis zu 15 Minuten dieselbe Antwort (Schritt 9).

---

## 0. Vorher

- [ ] Die Testumgebung läuft und der Probelauf ist bestanden: `docs/betrieb/testumgebung.md` (Nr. 43), `docs/nachtlauf/probelauf-checkliste.md` (Nr. 48).
- [ ] **Offene Online-Bestellungen aus der Testzeit abschließen**, solange der Test-Schlüssel noch gilt: bezahlte abholen lassen oder stornieren.
  > **Hinweis:** Nach der Umstellung lassen sich Testzahlungen von vor der Umstellung **nicht mehr über Stripe erstatten**. Ihre Zahlungsvorgänge liegen im Testmodus, und den sieht der Live-Schlüssel nicht. Ein späterer Storno meldet dem Hof „Rückerstattung fehlgeschlagen“. Erstatten lässt sich dann nur noch von Hand im Stripe-Dashboard (Testmodus) – es ist ohnehin kein echtes Geld.
- [ ] **Probe „neu einrichten" im Testmodus** (in der Testumgebung, nie in der Produktion; Nr. 48 übernimmt den Schritt in die Probelauf-Checkliste):
  1. In der Datenbank der Testumgebung bei einem Testhof `stripeAccountId` auf eine **erfundene** Kennung setzen (`acct_` und beliebige Zeichen) und `stripeAccountReady` auf true.
  2. Als dieser Hof Einstellungen → Zahlung öffnen und **„Status prüfen"** tippen.
  3. Erwartet: die Karte **„Online-Zahlung neu einrichten"**, die Marke „Nicht mehr verbunden" und der orange Knopf „Online-Zahlung neu einrichten". Stripe antwortet auf eine fremde Kennung mit „kein Zugriff" (403) oder „unbekannt" (404) – beides führt hierher.
  4. Danach den Knopf tippen (legt ein neues Test-Konto an) oder die alte Kennung wieder eintragen.
- [ ] **Die gespeicherten Konto-Kennungen notieren**, bevor die Höfe neu einrichten: eine nur lesende Abfrage in der Produktions-Datenbank (etwa im SQL-Editor), Ergebnis exportieren und sicher ablegen – nicht in Chat, Tickets oder Commits.
  ```sql
  select id, slug, "stripeAccountId" from "Farm" where "stripeAccountId" is not null;
  ```
  Nach dem Neu-Einrichten kennt die Datenbank nur noch die neue Kennung. Die alte steht dann nur im Laufzeit-Protokoll („[Stripe] Hof-Konto neu eingerichtet …“), und das bewahrt Vercel je nach Plan nur kurz auf.
- [ ] Die Höfe vorab informieren: Sobald du Bescheid gibst (erst nach der Probe mit EINEM Hof in Schritt 9), öffnen sie einmal Einstellungen → Zahlung und richten die Online-Zahlung neu ein (etwa 10 Minuten). Vorher nicht neu einrichten.
- [ ] Eine ruhige Stunde wählen, ohne laufende Abholung und möglichst ohne Online-Bestellungen: Wer während des Neu-Bauens in Schritt 8 online bestellt, zahlt noch im Testmodus, zählt aber schon als Umsatz (Bau-Fenster, siehe Schritt 4 `STRIPE_LIVE_AB`).
- [ ] Ist im Stripe-Dashboard Link eingeschaltet, brauchen frame-src und connect-src zusätzlich `https://link.com` und `https://*.link.com`, img-src `https://*.link.com` (Stripe-Doku „Integration security guide“, Abschnitt „Content Security Policy › Stripe.js“, docs.stripe.com/security/guide, abgerufen 21.10.2026; `src/lib/csp.ts`, Register G8). Erst danach die CSP scharf schalten.

## 1. Stripe-Konto live aktivieren

- [ ] Im Stripe-Dashboard „Konto aktivieren“: Unternehmensangaben, vertretungsberechtigte Person, Bankkonto für Auszahlungen, Steuerangaben.
- [ ] Prüfen: Mit ausgeschaltetem Testmodus steht kein Hinweis „Konto nicht aktiviert“ mehr da.

## 2. Connect live

- [ ] Connect → Einstellungen (Live-Modus): das Plattformprofil ausfüllen. Die Höfe bekommen **Express**-Konten mit Land **Österreich**.
- [ ] Die Funktionen „Kartenzahlungen“ und „Überweisungen“ (`card_payments`, `transfers`) zulassen. Die App fordert genau diese beim Anlegen eines Hof-Kontos an.
- [ ] Das Branding für das Onboarding der Höfe setzen: Name, Symbol, Farbe.
- [ ] Die **Connect-Client-ID** (beginnt mit `ca_`) für Schritt 4 bereitlegen.

## 3. Zwei Live-Webhooks

Beide Endpunkte zeigen auf **`https://farmerzone.at/api/stripe/webhook`**. Die Route prüft jede Zustellung gegen beide Secrets.

- [ ] **Endpunkt A – Plattform** („Ereignisse in deinem Konto“), alle Ereignisse, die `src/app/api/stripe/webhook/route.ts` verarbeitet:

  | Ereignis | Wozu |
  |---|---|
  | `payment_intent.succeeded` | Bestellung bezahlt, Mails an Kundin und Hof; kam die Zahlung nach dem Storno, wird sofort erstattet |
  | `payment_intent.payment_failed` | Zahlung abgelehnt vermerken (die Kundin kann es erneut versuchen) |
  | `payment_intent.canceled` | unbezahlte Bestellung stornieren, Ware freigeben |
  | `refund.failed` | gescheiterte Erstattung zurücknehmen, Hof und Betreiber informieren |
  | `charge.refund.updated` | dasselbe, wenn eine Erstattung später scheitert |
  | `account.updated` | Kontostand eines Hofs aktuell halten (kommt auch über diesen Endpunkt) |

- [ ] **Endpunkt B – Connect** („Ereignisse in verbundenen Konten“): `account.updated`. Ohne diesen Endpunkt bleibt es unbemerkt, wenn Stripe ein Hof-Konto sperrt oder freigibt.
- [ ] Das Signing Secret jedes Endpunkts (beginnt mit `whsec_`) für Schritt 4 bereitlegen:
  - A → `STRIPE_WEBHOOK_SECRET`,
  - B → `STRIPE_CONNECT_WEBHOOK_SECRET`.

## 4. und 5. Variablen bei Vercel

Vercel erlaubt je Variable und Umgebung nur einen Wert. Deshalb kommt **zuerst Schritt 5, dann Schritt 4**. Dazwischen nicht deployen: Die laufende Produktion behält ihre Werte bis zum nächsten Deploy.

**5. Bestehende `STRIPE_*` auf Preview beschränken**

- [ ] Bei jeder bestehenden Variable `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` und `STRIPE_WEBHOOK_SECRET` sowie bei `STRIPE_PUBLISHABLE_KEY` (falls vorhanden; der Code liest sie nicht) die Umgebung **Production abwählen**. Übrig bleibt Preview, bei Bedarf auch Development.
- [ ] Danach gilt: Vorschau = Test-Schlüssel, Produktion = Live-Schlüssel.
- [ ] Die Branch-Variable `STRIPE_WEBHOOK_SECRET` für `staging` (Testumgebung, `docs/betrieb/testumgebung.md` Schritt 3) bleibt, wie sie ist. Sie gehört zum Test-Endpunkt von `test.farmerzone.at`.

**4. Neue Variablen nur für Production**

- [ ] Diese Variablen anlegen, jede nur für **Production** und als „Sensitive“:

  | Variable | Wert beginnt mit | Herkunft |
  |---|---|---|
  | `STRIPE_SECRET_KEY` | `sk_live_` | Entwickler → API-Schlüssel (Live) |
  | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_` | ebenda |
  | `STRIPE_WEBHOOK_SECRET` | `whsec_` | Endpunkt A (Live) |
  | `STRIPE_CONNECT_WEBHOOK_SECRET` | `whsec_` | Endpunkt B (Live) – **fehlt heute ganz**; ohne ihn meldet die Produktion „Kein STRIPE_CONNECT_WEBHOOK_SECRET“ an Sentry |
  | `STRIPE_CONNECT_CLIENT_ID` | `ca_` | Connect → Einstellungen (steht in `.env.example`; der Code liest sie heute nicht, sie gehört trotzdem zum vollständigen Satz) |

- [ ] Den Live-Schlüssel aus **demselben Stripe-Konto** kopieren, in dem Connect eingerichtet ist (Schritt 2). Ein Schlüssel eines anderen Kontos ließe jeden Hof als „unbekannt“ erscheinen, und „neu einrichten“ legte die Konten dort an.
- [ ] **`STRIPE_LIVE_AB`** anlegen (Register Z4, Nr. 55), ebenfalls **nur für Production** (nicht für Preview; „Sensitive“ ist nicht nötig, so bleibt der Wert lesbar). Online-Bestellungen, die vor diesem Zeitpunkt angelegt wurden, sind Testzahlungen: Sie zählen in Auswertung, Verkäufe, Heute, Kunden und Admin nicht als Umsatz, nicht als Servicegebühr und nicht als Bestellung. Barbestellungen zählen immer.
  - **Wert:** der Beginn des Redeploys aus Schritt 8, **mit Zeitzone**, etwa `2026-11-02T21:00:00+01:00` (Winterzeit `+01:00`, Sommerzeit `+02:00`). Am einfachsten trägst du ihn unmittelbar vor Schritt 8 ein – die Variable wirkt erst mit dem nächsten Deploy.
  - Ohne Zeitzone oder mit einem Tippfehler gilt der Wert nicht: Die Testzahlungen zählen dann weiter mit, und Sentry meldet „Umgebung widersprüchlich: STRIPE_LIVE_AB …“ (höchstens einmal je Instanz). Der Deploy läuft trotzdem.
  - Liegt der Wert **mehr als 24 Stunden in der Zukunft** (etwa ein falsches Jahr), gilt er trotzdem – bis dahin zählen alle Online-Bestellungen als Testzahlungen. Sentry meldet dann „Umgebung widersprüchlich: STRIPE_LIVE_AB liegt mehr als 24 Stunden in der Zukunft …“ (höchstens einmal je Instanz, ohne den Wert). Dann den Wert berichtigen und neu deployen.
  - **Bau-Fenster:** Online-Bestellungen zwischen dem Beginn des Redeploys und dem fertigen Deployment laufen noch über den Test-Schlüssel, liegen aber nach dem Stichtag – sie würden mitgezählt. Darum die ruhige Stunde (Schritt 0) und danach Admin → Finanzen prüfen (Schritt 8).

## 6. Zahlungsarten live aktivieren

- [ ] Einstellungen → Zahlungsmethoden (Live-Modus): **EPS**, **Apple Pay** und **Google Pay** aktivieren, Karten sind an. Welche Wege die Kasse anbietet, entscheidet allein diese Einstellung. Stripes Zahlungsfeld zeigt nur, was hier aktiv ist und was das Gerät kann.

## 7. Apple-Pay-Domain

- [ ] Einstellungen → Zahlungsmethoden → Domains (Live-Modus): **`farmerzone.at`** hinzufügen und warten, bis Stripe die Domain als bestätigt zeigt.
  > Verlangt Stripe dafür eine Datei unter `/.well-known/`, ist das ein eigener kleiner Auftrag. Heute liegt keine solche Datei im Projekt.

## 8. Neu deployen

- [ ] **Vorher:** Vercel → Settings → Environment Variables: **„Automatically expose System Environment Variables“ ist an.** Ohne den Schalter fehlt `VERCEL_ENV` zur Laufzeit, und die Modus-Wache sperrt mit dem Live-Schlüssel auch die Produktion. Gegenprobe: Server-Ereignisse der Produktion tragen in Sentry das environment `production` – zum Beispiel die heutige Warnung „Stripe TEST in Produktion“.
- [ ] Vercel → Deployments → das aktuelle Production-Deployment **neu bauen** („Redeploy“, ohne Build-Cache). Ein Neustart allein genügt nicht: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` wird beim Bauen in die Seiten geschrieben.
- [ ] Danach prüfen, auf `farmerzone.at`:
  - [ ] Kasse (`/<hof>/checkout`): An „Online bezahlen“ steht kein „Testbetrieb: …“ mehr.
  - [ ] Admin (`/admin`): Die orange Karte „Stripe läuft im Testmodus …“ ist weg, unter dem Kopf steht „Stripe Live“ in Grün (Nr. 43).
  - [ ] Einstellungen → Zahlung: „Online-Zahlung läuft noch im Testbetrieb.“ ist weg.
  - [ ] Sentry: Keine neue Warnung „Stripe TEST in Produktion“ und keine „Kein STRIPE_CONNECT_WEBHOOK_SECRET“.
  - [ ] Sentry: Keine Meldung „Stripe-Client nicht gestartet …“. Kommt sie doch, entscheidet der Tag `umgebung`:
    - `umgebung=produktion`: Der Produktion fehlt `VERCEL_ENV`. Den Schalter für die Systemvariablen prüfen (oben), nicht die Vorschau.
    - `umgebung=preview`: Der Live-Schlüssel steckt in einer Vorschau. Dann Schritt 5 prüfen.
  - [ ] Eine Vorschau zeigt im Umgebungsbanner weiter „Stripe Test“.
  - [ ] Admin → Finanzen: Unter dem Titel steht leise „Testzahlungen vor dem … sind nicht mitgezählt.“ mit dem Zeitpunkt aus `STRIPE_LIVE_AB` (nur, wenn in den gezeigten Monaten eine Testzahlung sonst mitgezählt hätte). Fehlt die Zeile trotz Testzahlungen, ist der Wert ungültig – Sentry nennt den Grund.
  - [ ] Admin → Finanzen: Keine Online-Bestellung aus dem Bau-Fenster unter „Servicegebühr, online“. Gibt es doch eine, `STRIPE_LIVE_AB` auf den Zeitpunkt setzen, zu dem das neue Deployment fertig war (Vercel → Deployments, „Ready“), und noch einmal neu deployen – dann laufen alte und neue Version schon mit dem Live-Schlüssel.
  - [ ] Stripe → Webhooks: Endpunkt A und B zeigen beim ersten Ereignis eine Zustellung mit 200.
- [ ] Im **Testmodus** von Stripe den alten Endpunkt `https://farmerzone.at/api/stripe/webhook` löschen. Die Produktion prüft jetzt gegen die Live-Secrets und würde jede Test-Zustellung mit 400 ablehnen. Der Endpunkt der Testumgebung (`test.farmerzone.at`, Nr. 43) bleibt.

## 9. Höfe richten Stripe neu ein

Die gespeicherten Hof-Konten stammen aus dem Testmodus, der Live-Schlüssel kennt sie nicht. So läuft es für jeden Hof:

1. Sobald die App zum ersten Mal bei Stripe nach dem Konto fragt, vermerkt sie den Hof als „nicht bereit“. Das passiert bei „Status prüfen“, „Einrichtung fortsetzen“, „Auszahlungen bei Stripe ansehen“ oder beim ersten Online-Kauf. Die Kennung bleibt stehen.
2. Die erste Kundin, die bis dahin online zahlen will, liest: „Online-Zahlung ist bei diesem Hof gerade nicht möglich. Bitte wähle Bar bei Abholung.“ Die Kasse stellt sofort auf Bar um, ihre Ware bleibt reserviert. Danach bietet die Kasse bei diesem Hof nur noch Bar an.
3. Der Hof öffnet Einstellungen → Zahlung. Er tippt auf „Status prüfen“ bzw. „Einrichtung fortsetzen“ und sieht dann die Karte **„Online-Zahlung neu einrichten“**.
4. Der Knopf „Online-Zahlung neu einrichten“ fragt Stripe zuerst, ob das alte Konto wirklich unbekannt ist oder der Zugriff verweigert wird. Nur dann legt er ein neues Live-Konto an und führt zu Stripe (etwa 10 Minuten). Danach steht dort „Verbunden und aktiv“. Alte und neue Kennung stehen mit der Hof-ID im Server-Protokoll (Vercel-Logs: „[Stripe] Hof-Konto neu eingerichtet …“), falls ein Konto später zuzuordnen ist.
5. Doppelklick und sofortiger Neuversuch bekommen von Stripe dasselbe Konto (Idempotenz-Schlüssel je 15-Minuten-Fenster). Grenzen:
   - Scheitert der erste Versuch bei Stripe, gibt der Knopf bis zu 15 Minuten dieselbe Antwort. Danach noch einmal tippen.
   - Fällt ein Doppelklick genau auf den Wechsel des Fensters, entsteht bei Stripe ein zweites, ungenutztes Konto. Gespeichert wird nur eines; das andere steht mit Hof-ID im Protokoll („[Stripe] Hof-Konto nicht ersetzt …“).
   - Scheitert nach dem Anlegen bei Stripe das Speichern in der Datenbank (oder geht die Antwort von Stripe verloren) und fällt der Neuversuch in ein neues Fenster, entsteht ebenfalls ein zweites Konto. Das erste steht dann NICHT im Protokoll; es ist im Stripe-Dashboard (Connect → Verbundene Konten) über die Hof-Adresse zu finden. Geld geht dabei nicht verloren.

- [ ] **Zuerst EIN Hof** (am besten ein eigener Testhof): Nach dem Neu-Einrichten muss sein Konto im Stripe-Dashboard (Live) unter Connect → Verbundene Konten des Kontos aus Schritt 2 stehen. Erst dann die anderen Höfe bitten.
- [ ] Damit keine Kundin auf Schritt 2 trifft: Nach der Probe mit EINEM Hof (oben) die übrigen Höfe zügig bitten, einmal „Status prüfen“ zu tippen und dann neu einzurichten.
- [ ] Überblick im Admin: Die Höfe-Liste zeigt jeden noch nicht neu eingerichteten Hof (nach dem Vermerk) als **„Stripe fehlt“** (Filter „Stripe fehlt“).
- [ ] Sentry meldet „Stripe kennt das gespeicherte Konto eines Hofs nicht“ höchstens einmal je Hof und Tag, nur mit der Hof-ID.

## 10. Testbestellungen aus den Auswertungen heraushalten – umgesetzt (Nr. 55, Variable statt Konstante)

Online-Bestellungen von vor der Umstellung sind Testzahlungen. **Barbestellungen aus derselben Zeit sind echt:** Das Geld wurde bar übergeben, sie zählen immer.

- **Umgesetzt (Register Z4):** Vorschlag A, aber mit der Server-Variable `STRIPE_LIVE_AB` statt einer Konstante – zur Live-Schaltung ist keine Code-Änderung nötig, den Wert setzt du in Schritt 4. Eine Regel aus einer Quelle (`src/lib/testzahlung.ts`): Zahlart online UND angelegt vor dem Stichtag. Sie gilt für die Auswertung, die Verkäufe samt Jahressumme für die Umsatzgrenze, Heute, die Umsätze und (seit Lauf 10) die Bestellzahlen der Kunden, die Admin-Finanzen und die Admin-Hofliste. Bestellungen, Beträge, Checkout, Webhook, Erstattung und Storno bleiben unverändert; die Liste „Letzte Verkäufe“ zeigt die Bestellungen weiter.
- **Ohne Variable bleibt alles wie vorher.** Lässt eine gezeigte Zahl eine Testzahlung aus, steht in Auswertung, Verkäufe und Admin-Finanzen leise „Testzahlungen vor dem … sind nicht mitgezählt.“
- **Vorschlag B – Merkmal an der Bestellung (Expand-Migration)** bleibt eine Option für später: eine Spalte wie `Order.stripeLivemode`, gesetzt aus `livemode` des PaymentIntents. Sie hielte auch für die Testumgebung und weitere Umstellungen, braucht aber eine freigegebene Migration und einen eigenen Auftrag.

## Zurück, falls nötig

- [ ] Für Production wieder die Test-Werte eintragen und neu deployen (Schritt 8). Die drei Hinweise erscheinen wieder von selbst.
- [ ] Höfe, die schon live neu eingerichtet haben, tragen dann eine Live-Kennung, die der Test-Schlüssel nicht kennt. Sie sehen beim nächsten Kontakt mit Stripe wieder „Online-Zahlung neu einrichten“. Deshalb vorher abwägen und die Höfe informieren.
