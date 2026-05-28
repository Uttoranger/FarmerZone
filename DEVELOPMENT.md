# Bauern-Plattform — Entwicklungsstand

## Projektübersicht

Regionaler Bauernhof-Webshop als Pilot mit einem einzelnen Betrieb.
Kunden bestellen per geteiltem Link ohne Login-Zwang, zahlen online (Stripe) oder vor Ort.
Der Bauer verwaltet Produkte, sieht Bestellungen und trägt externe Verkäufe manuell ein.

**Tech-Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · shadcn/ui ·
Prisma 7 · PostgreSQL 16 (Supabase) · Better Auth · Stripe Connect · Resend · Recharts

> Hinweis: `create-next-app` hat Next.js 16 installiert (das aktuelle Latest).
> Die Spec sagt 15, aber 16 ist vollständig kompatibel und besser.

---

## Die 5 Hauptbereiche

| # | Bereich | Seiten / Umfang |
|---|---------|-----------------|
| 1 | **Öffentlicher Kunden-Bereich** | Hof-Schaufenster `/[farmSlug]`, Checkout, Bestellbestätigung |
| 2 | **Bauer-Dashboard** | Login, Dashboard, Bestellverwaltung `/orders`, Produktverwaltung `/products`, Einstellungen `/settings` |
| 3 | **Zahlungsintegration** | Stripe Connect Onboarding, Payment Intents, Webhook-Handler, Vor-Ort-Zahlung mit E-Mail-Bestätigung |
| 4 | **Manuelle Verkaufserfassung & Auswertung** | Schnelle Eingabe `/sales` (WhatsApp/Hofladen/Markt), Recharts-Dashboard `/analytics` |
| 5 | **E-Mail-System** | react-email Templates: Bestellbestätigung, Bauer-Notifikation, Vor-Ort-Bestätigungslink |

---

## Aktueller Stand

**Sprint 2 abgeschlossen** — Auth, Middleware, Farmer-Layout und Dashboard fertig

---

## Erledigte Schritte

### Sprint 1: Setup & Datenmodell ✅
- [x] Spezifikation (docs/spec.docx) vollständig gelesen
- [x] Next.js 16 mit App Router, TypeScript strict, Tailwind CSS 4, src-Verzeichnis
- [x] Alle Dependencies installiert: Prisma, Stripe, Better Auth, Resend, TanStack Query, react-hook-form+Zod, Recharts, nanoid, date-fns, lucide-react
- [x] shadcn/ui initialisiert (Tailwind 4 Modus), Komponenten: button, card, input, label, select, textarea, dialog, sheet, sonner, alert, badge, skeleton, form, table, tabs
- [x] Vollständige Projektstruktur nach Kapitel 3
- [x] `prisma/schema.prisma` mit allen Enums, Modellen, Indizes — inkl. WebhookEvent für Stripe-Idempotenz
- [x] `.env.example` mit allen Variablen aus Kapitel 5
- [x] `prisma/seed.ts` mit Hof Müller, 4 Produkten (Heumilch, Bio-Eier, Brennholz, Rindfleisch-Paket), 2 Abholzeiten, 3 ManualSales
- [x] `src/lib/prisma.ts` Singleton
- [x] `.gitignore` (schließt .env.local aus)

---

## Nächste Schritte

### ~~Vor Sprint 2: Externe Accounts & Datenbank einrichten~~ ✅
- [x] Supabase-Projekt angelegt (Frankfurt), DATABASE_URL + DIRECT_URL in `.env.local`
- [x] `pnpm db:migrate --name init` ausgeführt → 9 Tabellen in Supabase angelegt
- [x] `pnpm db:seed` ausgeführt → Hof Müller mit 4 Produkten, 2 Abholzeiten, 3 ManualSales

### Sprint 2: Auth & Bauer-Dashboard (Tag 2) ✅
- [x] Better Auth für Bauer-Login einrichten (`src/lib/auth.ts`, email+password + Magic Link vorbereitet)
- [x] `/login` Seite (Client Component, German labels, green CTA)
- [x] Auth-Middleware (`src/middleware.ts`) schützt alle Farmer-Routen, prüft FARMER-Rolle
- [x] Farmer-Layout (`src/app/(farmer)/layout.tsx`) mit doppeltem Session-Check
- [x] Mobile Bottom-Tab-Bar + Desktop Sidebar (`src/components/farmer/farmer-nav.tsx`)
- [x] Dashboard-Seite mit echten DB-Daten: Begrüßung, Heute-Warnung, 3 Stats, 4 Aktionen
- [x] DB-Migration: Session/Account/Verification-Tabellen angelegt, passwordHash entfernt
- [x] Seed: Bauer-User über Better Auth `signUpEmail()` angelegt (mit Passwort-Hash in Account)

### Sprint 3: Produktverwaltung (Tag 3)
- [ ] `/products` Liste, anlegen, bearbeiten (Modal)
- [ ] Foto-Upload mit Vercel Blob
- [ ] Quick-Bestandsanpassung (+5/+10/+20)

### Sprint 4: Manuelle Verkaufserfassung (Tag 4)
- [ ] `/sales` mit Schnellauswahl-Buttons und Formular
- [ ] Server Action `createManualSale` mit Zod-Validierung
- [ ] Liste der letzten 20 Verkäufe mit Edit/Delete

### Sprint 5: Auswertungs-Dashboard (Tag 5)
- [ ] `/analytics` mit Recharts-Charts
- [ ] Umsatz nach Kanal (Plattform/WhatsApp/Hofladen/Markt)
- [ ] Top-5-Produkte-Liste

### Sprint 6: Öffentliche Hof-Seite (Tag 6)
- [ ] `/[farmSlug]` als Server Component mit ISR (revalidate: 60)
- [ ] Produkt-Grid (2 cols mobile, 4 cols desktop)
- [ ] Warenkorb in localStorage + Sticky Cart Button

### Sprint 7: Checkout & Stock-Reservierung (Tag 7)
- [ ] Checkout-Seite mit Zod-Validierung
- [ ] Slot-Auswahl, Stock-Reservierung mit Pessimistic Lock
- [ ] Cron Job für Reservation-Cleanup

### Sprint 8: Stripe-Integration (Tag 8)
- [ ] Stripe Connect Onboarding für Bauer
- [ ] Payment Intent + Webhook-Handler (Idempotenz via WebhookEvent)

### Sprint 9: Vor-Ort-Zahlung & E-Mails (Tag 9)
- [ ] Vor-Ort-Zahlung mit Bestätigungs-Token per E-Mail
- [ ] react-email Templates (3 Stück)

### Sprint 10: Bestellübersicht & Bestätigungsseite (Tag 10)
- [ ] `/orders` für Bauer (Gruppierung, Status-Übergänge)
- [ ] `/[farmSlug]/confirm/[orderId]` für Kunden

### Sprint 11: Polish & Deployment
- [ ] Impressum, Datenschutz
- [ ] Mobile-Optimierung prüfen
- [ ] Vercel Deployment, Domain

---

## Wichtige Entscheidungen & Rahmenbedingungen

- **Sprache:** Gesamte App auf Deutsch, auch UI-Texte
- **Provision:** 0% im Pilot (`platformFeePercent = 0`)
- **Auth:** Bauer → Passwort-Login; Kunde → kein Login erforderlich
- **Zahlungsarten:** Stripe (Online) + Vor-Ort (Bar oder Karte)
- **Externe Verkäufe:** WhatsApp, Hofladen, Markt, Geschäftskunde, Sonstiges
- **Hosting:** Vercel Hobby + Supabase Free Tier
- **Mobile-first:** Touch-Targets mindestens 44×44px, max. 2 Aktionen pro Screen
- **Farben:** Primary green-700, Secondary blue-600, Warning amber-500, Danger red-600
- **shadcn toast:** Deprecated → stattdessen `sonner` verwendet

---

## Benötigte externe Accounts

| Service | Zweck | Status |
|---------|-------|--------|
| Supabase | PostgreSQL-Datenbank | ✅ aktiv, Region Frankfurt |
| Stripe | Zahlungen + Connect | ⏳ noch nicht angelegt |
| Resend | E-Mail-Versand | ⏳ noch nicht angelegt |
| Vercel | Hosting + Blob-Storage | ⏳ noch nicht angelegt |

---

## Nützliche Befehle

```bash
pnpm dev              # Dev-Server starten
pnpm db:migrate       # Datenbankmigrationen ausführen (= prisma migrate dev)
pnpm db:seed          # Testdaten laden
pnpm db:studio        # Prisma Studio öffnen
pnpm db:generate      # Prisma Client generieren
```

---

---

## Prisma 7 Besonderheiten (wichtig für weitere Entwicklung)

- Kein `url` im `schema.prisma` — stattdessen `prisma.config.ts` im Root
- Adapter-Klasse heißt `PrismaPg` (nicht `PrismaPostgres`)
- Alle Prisma-Scripts via `dotenv -e .env.local --` prefixen
- `PrismaClient` braucht zwingend `{ adapter }` im Konstruktor

---

*Zuletzt aktualisiert: 2026-05-28 — Sprint 2 abgeschlossen*
