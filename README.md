# FarmerZone

Regionale Lebensmittel direkt vom Bauern — eine digitale Vermittlungsplattform im Pilotbetrieb.

## Was kann die App?

| Bereich | Feature |
|---|---|
| **Öffentliche Hof-Seite** | Produkte anzeigen, Warenkorb, Abholzeit wählen, Online- oder Vor-Ort-Zahlung |
| **Bestellabwicklung** | Stripe-Zahlung, E-Mail-Bestätigungen (Kunde + Bauer), Abholbestätigung |
| **Farmer-Dashboard** | Bestellübersicht, Produkt- und Bestandsverwaltung, Direktverkauf eintragen |
| **Auswertung** | Umsatz nach Zeitraum, Verkaufskanal-Vergleich |
| **Einstellungen** | Hof-Profil, Abholzeiten, Stripe Connect, Pause/Urlaub |

## Tech-Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Datenbank:** PostgreSQL via Supabase + Prisma 7 (PrismaPg Adapter)
- **Auth:** Better Auth 1.6
- **Zahlungen:** Stripe Connect Express + Webhooks
- **E-Mail:** Resend + react-email
- **Styling:** Tailwind CSS 4
- **Upload:** Vercel Blob
- **Deployment:** Vercel

## Lokales Setup (Schritt für Schritt)

### Voraussetzungen
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Stripe CLI (für lokales Webhook-Testing)
- Supabase-Konto mit PostgreSQL-Datenbank

### 1. Repository klonen

```bash
git clone <repo-url>
cd bauern-plattform
pnpm install
```

### 2. Umgebungsvariablen einrichten

```bash
cp .env.example .env.local
```

Fülle alle Felder in `.env.local` aus (Supabase, Stripe, Resend, etc.).

### 3. Datenbank einrichten

```bash
# Schema auf die DB pushen
pnpm exec dotenv -e .env.local -- pnpm exec prisma db push

# Ersten Bauer-User anlegen (interaktives Skript)
pnpm exec dotenv -e .env.local -- pnpm exec tsx scripts/seed.ts
```

### 4. Dev-Server starten

```bash
pnpm dev
```

App läuft auf [http://localhost:3000](http://localhost:3000).

### 5. Stripe Webhooks lokal testen

```bash
# In separatem Terminal:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Den ausgegebenen `whsec_...`-Secret als `STRIPE_WEBHOOK_SECRET` in `.env.local` eintragen.

---

## Deployment auf Vercel

### 1. Vercel-Projekt anlegen

```bash
vercel
```

Oder über [vercel.com](https://vercel.com) importieren.

### 2. Umgebungsvariablen setzen

Alle Variablen aus `.env.example` im Vercel Dashboard unter **Settings → Environment Variables** eintragen.

Wichtig für Produktion:
- `BETTER_AUTH_URL` = `https://deine-domain.at`
- `NEXT_PUBLIC_APP_URL` = `https://deine-domain.at`
- `STRIPE_SECRET_KEY` = Live-Key (`sk_live_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = Live-Key (`pk_live_...`)
- `EMAIL_FROM` = Adresse von verifizierter Resend-Domain

### 3. Stripe Webhook für Produktion

Im [Stripe Dashboard](https://dashboard.stripe.com/webhooks) einen neuen Webhook anlegen:
- **URL:** `https://deine-domain.at/api/stripe/webhook`
- **Events:** `payment_intent.succeeded`, `payment_intent.payment_failed`
- Den Signing Secret als `STRIPE_WEBHOOK_SECRET` in Vercel eintragen.

### 4. Cron-Job einrichten

`vercel.json` enthält bereits den Cron-Job für tägliche Reservierungs-Bereinigung.
`CRON_SECRET` muss in Vercel gesetzt sein.

---

## Go-Live-Checkliste (Pilot-Start)

### Infrastruktur
- [ ] Domain registrieren und in Vercel einrichten
- [ ] SSL-Zertifikat (automatisch über Vercel)
- [ ] Alle Umgebungsvariablen in Vercel gesetzt
- [ ] Datenbank-Migration auf Prod ausgeführt (`prisma db push`)

### Stripe
- [ ] Stripe-Konto vollständig eingerichtet (Bankverbindung hinterlegt)
- [ ] Live-API-Keys in Vercel gesetzt (`sk_live_...`, `pk_live_...`)
- [ ] Stripe Webhook für Prod-URL registriert
- [ ] Stripe Connect für Bauer-Onboarding aktiviert
- [ ] Test-Zahlung mit echter Karte durchgeführt

### E-Mail
- [ ] Domain bei Resend verifiziert (`resend.com/domains`)
- [ ] `EMAIL_FROM` auf verifizierte Domain-Adresse gesetzt (z.B. `bestellung@deine-domain.at`)
- [ ] Test-E-Mail erfolgreich versendet (`/api/test-email`)
- [ ] Alle E-Mail-Typen geprüft (Bestellbestätigung, Abholhinweis, Storno)

### Impressum & Datenschutz
- [ ] Impressum mit echten Betreiberdaten befüllt (`/impressum`)
- [ ] Datenschutzerklärung vollständig ausgefüllt (insb. Kontaktadressen)

### Hof-Setup
- [ ] Ersten Bauer-Account anlegt (via Datenbank oder Admin-Skript)
- [ ] Hof-Profil vollständig befüllt (Name, Adresse, Beschreibung, Foto)
- [ ] Abholzeiten eingetragen
- [ ] Stripe Connect für den Hof eingerichtet (wenn Online-Zahlung gewünscht)
- [ ] Produkte angelegt mit Bestand
- [ ] Hof-Seite öffentlich erreichbar (`/[slug]`)

### Qualitätssicherung
- [ ] Test-Bestellung (Vor-Ort-Zahlung) von Anfang bis Abholung durchgespielt
- [ ] Test-Bestellung (Online-Zahlung) mit echter Karte durchgespielt
- [ ] E-Mail-Flow geprüft (Kunde + Bauer erhalten korrekte Mails)
- [ ] Mobile-Ansicht auf Smartphone getestet
- [ ] Stripe Webhook in Prod getriggert und Bestellung auf PAID gesetzt

### Nach dem Launch
- [ ] Erste echte Bestellung beobachten
- [ ] E-Mail-Logs im Resend Dashboard prüfen
- [ ] Stripe Dashboard auf Zahlungen prüfen
- [ ] Feedback vom ersten Bauer und ersten Kunden einholen

---

## Bekannte Einschränkungen (Pilotbetrieb)

- Kein Kunden-Account — Bestellungen sind anonym (nur E-Mail)
- Kein Admin-Panel — Bauer-Accounts werden direkt in DB angelegt
- Resend Free-Tier: E-Mails nur an verifizierte Domains möglich
- Foto-Upload erfordert Vercel Blob Token

## Lizenz

Proprietär — Pilotprojekt, nicht für die Öffentlichkeit freigegeben.
