# Testumgebung test.farmerzone.at einrichten

Schritte für den Menschen (Register Z3). In der Produktion gibt es keinen Umschalter zwischen Test und Live. Echte Abläufe testest du in der **Testumgebung**: Branch `staging`, Entwicklungsdatenbank, Stripe im Testmodus, erreichbar unter **`https://test.farmerzone.at`**.

Kein Agent ruft Vercel, DNS oder Stripe auf. Hier stehen nur Schritte, keine Werte: Schlüssel und Secrets gehören nur in Vercel und Stripe, nie in Chat, Tickets oder Commits.

Danach kommt der Probelauf (`docs/nachtlauf/probelauf-checkliste.md`, Nr. 48) und ganz am Schluss die Live-Schaltung (`docs/betrieb/stripe-live.md`).

**Was die App dafür schon mitbringt (Nr. 43):**

- **Eigene Adresse:** In einer Vorschau gilt `NEXT_PUBLIC_APP_URL` als Adresse der App — aber nur als reine https-Adresse und nie als `farmerzone.at`. Links in Mails, die Rücksprünge von Stripe und die Anmeldung laufen dann über `test.farmerzone.at`. Andere Vorschauen bleiben bei ihrer Vercel-Adresse.
- **Banner:** Oben steht „TESTUMGEBUNG · Dev-Datenbank · Stripe Test · staging", daneben der Link „Zur echten Seite".
- **Admin der echten Seite:** Unter dem Kopf steht eine Leiste mit der Marke „Stripe Test" (nach der Live-Schaltung „Stripe Live") und dem Link „Zur Testumgebung".
- **Post nur an dich:** An jede Adresse geht Post nur im Produktions-Deployment bei Vercel. Überall sonst gehen Mails nur an Adressen aus `TEST_EMPFAENGER` und an `@example.com`: in der Testumgebung, in Vorschauen, lokal und in einem lokalen Produktions-Build. Alles andere wird nicht verschickt, nur gezählt: Im Log steht „[E-Mail] Nicht verschickt …" mit einer Zahl, ohne Adresse.
- **Action „Staging nachziehen"** (`.github/workflows/staging-nachziehen.yml`): Nach jedem Push auf `main` setzt sie `staging` per Fast-Forward auf `main`, ohne Force. Vercel baut daraufhin die Testumgebung neu. Hat `staging` eigene Commits, wird die Action rot, statt sie zu überschreiben.

---

## 1. Branch staging anlegen

- [ ] GitHub → Code → Branches → „New branch": Name **`staging`**, Quelle **`main`**. Die Action legt den Branch bewusst nicht selbst an. Bis es ihn gibt, endet sie nach jedem Push auf `main` grün mit dem Hinweis „Branch staging fehlt" und tut nichts.
- [ ] Keine Regel (Branch-Schutz, Ruleset), die Pushes von GitHub Actions auf `staging` verbietet. Die Action schiebt mit dem eingebauten Token. Ein Schutz gegen Force-Push oder Löschen schadet nicht, die Action braucht beides nie.
- [ ] Ihr Schreibrecht fordert die Action selbst an (`contents: write`, nur in ihrem Job). Die Grundeinstellung unter Settings → Actions → General → „Workflow permissions" darf auf „Lesen" bleiben.
- [ ] Auf `staging` arbeitet niemand direkt. Alles kommt über `main`, sonst wird die Action rot (siehe „Wenn etwas hakt").

## 2. Domain bei Vercel und DNS

- [ ] Vercel → Projekt → Settings → Domains → **`test.farmerzone.at`** hinzufügen. Als Umgebung **Preview** wählen und als Git-Branch **`staging`** eintragen.
- [ ] **DNS-Eintrag** beim Anbieter der Zone `farmerzone.at`: ein **CNAME** mit dem Namen `test`, Ziel ist der Wert, den Vercel beim Hinzufügen anzeigt (meist `cname.vercel-dns.com`).
  - Liegt die Zone bei Cloudflare: Proxy **aus** („Nur DNS", graue Wolke). Sonst stellt Vercel kein Zertifikat aus.
- [ ] Warten, bis Vercel die Domain als gültig zeigt.
- [ ] Deployment Protection bleibt, wie sie ist (Vercel Authentication für Vorschauen). Die Testumgebung ist nicht öffentlich: Ohne Vercel-Login gibt es nur die Anmeldeseite von Vercel (HTTP 401).

## 3. Variablen nur für den Branch staging

Vercel → Settings → Environment Variables → „Add". Umgebung **Preview**, darunter den Git-Branch **`staging`** wählen, damit der Wert nur für diesen Branch gilt.

| Variable | Wert | Wozu |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://test.farmerzone.at` | Adresse der Testumgebung: Links in Mails, Stripe-Rücksprung, Anmeldung |
| `BETTER_AUTH_URL` | `https://test.farmerzone.at` | Rückfall für Better Auth. Die App nimmt die Adresse schon aus `NEXT_PUBLIC_APP_URL`, mit gleichem Wert schadet sie nicht |
| `STRIPE_WEBHOOK_SECRET` | Signing Secret des zweiten Test-Endpunkts (Schritt 5) | Sonst prüft die Testumgebung gegen das Secret der Produktion und lehnt jede Zustellung ab |
| `RESEND_API_KEY` | optional, ein Resend-Schlüssel | Ohne ihn verschickt die Testumgebung gar nichts, die Mails stehen nur im Log |
| `TEST_EMPFAENGER` | nur mit `RESEND_API_KEY`: deine Test-Adressen, durch Komma getrennt | Wer in der Testumgebung Post bekommt. `@example.com` gilt immer. Betreiber-Mails (neuer Hof, Fehlermeldung, Erstattung offen, Briefkasten) gehen an die Support-Adresse (`SUPPORT_EMAIL` in `src/lib/support.ts`) und kommen nur an, wenn auch diese Adresse in der Liste steht |

- **`NEXT_PUBLIC_APP_URL` nie für alle Vorschauen anlegen**, nur für `staging`. Die App weist in einer Vorschau nur `farmerzone.at` ab, nicht `test.farmerzone.at`: Für alle Vorschauen gesetzt, schickten sonst alle ihre Links in die Testumgebung.
- **Alles andere erbt die Testumgebung von Preview** und bleibt unverändert: `DATABASE_URL` (Entwicklungsdatenbank) und die Stripe-Test-Schlüssel. Für `staging` nichts davon überschreiben, schon gar keinen Live-Schlüssel (außerhalb der Produktion startet Stripe damit gar nicht, Register Z2).
- **Ohne `RESEND_API_KEY`** kommt in der Testumgebung kein Anmeldecode für Kundinnen an, denn auf Vercel steht er nie im Log. Höfe melden sich mit Passwort an, das geht auch ohne Mail.
- **Anmeldungen bleiben getrennt:** Die Cookies gelten nur für `test.farmerzone.at`, nie für `farmerzone.at`. Die Konten sind die der Entwicklungsdatenbank.
- **Migrationen:** Ein Build von `staging` spielt die Migrationen von `main` in die Entwicklungsdatenbank ein (`vercel-build`), wie jede Vorschau.

## 4. Variable in Production

- [ ] **`NEXT_PUBLIC_TESTUMGEBUNG_URL`** = `https://test.farmerzone.at`, nur Umgebung **Production**. Danach zeigt der Admin der echten Seite „Zur Testumgebung".
  - Gilt nur als reine https-Adresse ohne Pfad. Ein Tippfehler lässt den Link weg, und Sentry bekommt die Warnung „NEXT_PUBLIC_TESTUMGEBUNG_URL ist keine reine https-Adresse …". Der Deploy läuft trotzdem.
  - In der Testumgebung selbst zeigt der Admin den Link nie, auch wenn die Variable dort ankäme.
- [ ] Production neu deployen, damit die Variable greift.

## 5. Stripe im Testmodus

- [ ] Stripe-Dashboard, **Testmodus** → Entwickler → Webhooks → Endpunkt hinzufügen: **`https://test.farmerzone.at/api/stripe/webhook`**.
  - **Zusätzlich, nicht statt des bestehenden** Endpunkts `https://farmerzone.at/api/stripe/webhook`: Die Produktion läuft bis zur Live-Schaltung selbst im Testmodus und braucht ihren Test-Endpunkt weiter.
  - Ereignisse: dieselben wie Endpunkt A in `docs/betrieb/stripe-live.md`, Schritt 3.
- [ ] **Vercel-Sperre für Stripe öffnen:** Stripe kann sich nicht bei Vercel anmelden und bekäme sonst 401.
  - Vercel → Settings → Deployment Protection → „Protection Bypass for Automation": ein Geheimnis erzeugen.
  - Es an die Adresse des Endpunkts hängen: `https://test.farmerzone.at/api/stripe/webhook?x-vercel-protection-bypass=<Geheimnis>`.
  - **Was das Geheimnis kann:** Es öffnet nicht nur die Testumgebung, sondern **alle** geschützten Deployments dieses Projekts, also jede Vorschau und jede Branch-Adresse. Wer es kennt, kommt ohne Vercel-Login hinein.
  - **Wer es sieht:** Es steht bei Vercel und, lesbar, in der Endpunkt-Adresse im Stripe-Dashboard. Jede Person mit Zugang zu den Webhooks bei Stripe kann es lesen.
  - **Erneuern:** Bei Vercel ein neues Geheimnis erzeugen und das alte widerrufen, dann die Adresse des Endpunkts bei Stripe anpassen. Das gilt auch, wenn jemand mit Stripe- oder Vercel-Zugang ausscheidet. Bis Stripe die neue Adresse hat, bekommt der Endpunkt 401 und Stripe stellt später erneut zu.
- [ ] Das **Signing Secret** dieses Endpunkts (beginnt mit `whsec_`) als `STRIPE_WEBHOOK_SECRET` nur für den Branch `staging` eintragen (Schritt 3), dann `staging` neu deployen.
- [ ] Gut zu wissen: Bis zur Live-Schaltung teilen Produktion und Testumgebung den Test-Schlüssel. Deshalb bekommen **beide** Endpunkte **alle** Test-Ereignisse. Jede Seite quittiert Ereignisse zu Bestellungen, die sie nicht kennt (Nr. 48 prüft das im Code).
- [ ] **Apple-Pay-Domain:** Einstellungen → Zahlungsmethoden → Domains (Testmodus): **`test.farmerzone.at`** hinzufügen.
  - Verlangt Stripe eine Datei unter `/.well-known/`, gilt dasselbe wie in `stripe-live.md` Schritt 7: ein eigener kleiner Auftrag.
  - Bleibt die Domain unbestätigt, kann auch die Vercel-Sperre der Grund sein. Karte und EPS lassen sich trotzdem testen.
- Nicht nötig: ein eigener Connect-Endpunkt für die Testumgebung. Den Stand eines Hof-Kontos holt dort „Status prüfen" in Einstellungen → Zahlung.

## 6. Abnahme

- [ ] **Ohne Vercel-Login kein Zugriff:** In einem privaten Fenster `https://test.farmerzone.at` öffnen. Erwartung: die Anmeldeseite von Vercel (HTTP 401), keine Seite von FarmerZone.
- [ ] **Banner:** Mit Vercel-Login oben „TESTUMGEBUNG · Dev-Datenbank · **Stripe Test** · staging" auf gelbem Grund, daneben „Zur echten Seite" (führt auf `farmerzone.at`). Ist der Balken rot, steht der Grund darin.
- [ ] **Admin der echten Seite** (`https://farmerzone.at/admin`): Unter dem Kopf stehen „Stripe Test" und „Zur Testumgebung". Der Link führt nach `test.farmerzone.at`.
- [ ] **Vercel baut den Push der Action:** Nach dem nächsten Merge auf `main` ist GitHub → Actions → „Staging nachziehen" grün. Vercel → Deployments zeigt eine neue Vorschau für `staging` mit demselben Commit wie `main`.
- [ ] **Post-Sperre:** In der Testumgebung bestellen, einmal mit einer Adresse aus `TEST_EMPFAENGER` (die Mail kommt an), einmal mit einer anderen (keine Mail). Im Vercel-Log steht dann „[E-Mail] Nicht verschickt … Bisher 1 in dieser Instanz.", ohne Adresse.
- [ ] **Stripe:** Ein Testkauf in der Testumgebung (Karte `4242 4242 4242 4242`). Der Endpunkt `test.farmerzone.at` zeigt in Stripe eine Zustellung mit 200.

## Wenn etwas hakt

- **Hinweis „Branch staging fehlt" in der Action (grün):** Den Branch gibt es noch nicht, Schritt 1.
- **Action rot „Kein Fast-Forward möglich":** Jemand hat direkt auf `staging` gearbeitet. Die Action hat nichts überschrieben. Zwei Wege:
  - Die Änderung per PR nach `main` bringen; beim nächsten Push zieht die Action nach.
  - Oder `staging` bewusst verwerfen: GitHub → Branches → `staging` löschen und neu aus `main` anlegen. Die Domain bleibt dem Branchnamen zugeordnet.
- **Action rot mit 403 beim Push:** Branch-Schutz oder Ruleset auf `staging` lässt GitHub Actions nicht schieben (Schritt 1).
- **Banner rot „NEXT_PUBLIC_APP_URL ist keine reine https-Adresse …"** oder „… zeigt auf die echte Seite …": Wert der Branch-Variable prüfen. Gültig ist nur `https://test.farmerzone.at`, ein `/` am Ende ist egal.
- **Anmeldung klappt nicht:** Die Testumgebung über `https://test.farmerzone.at` öffnen. Die Branch-Adresse von Vercel geht auch, beide sind vertraut. Nach einer Änderung an den Variablen `staging` neu deployen.
- **Keine Mail in der Testumgebung:** Fehlt `RESEND_API_KEY`, oder steht die Adresse nicht in `TEST_EMPFAENGER`? Gezählt wird beides im Log, ohne Adresse.

## Nach der Live-Schaltung

- Die Testumgebung bleibt im Testmodus: Sie erbt weiter die Test-Schlüssel von Preview (`stripe-live.md`, Schritt 5), ihr Webhook-Secret für `staging` bleibt.
- Der Admin der echten Seite zeigt dann „Stripe Live" in Grün; „Zur Testumgebung" bleibt.
