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

**Sprint 4 abgeschlossen** — Manuelle Verkaufserfassung (/sales) + Auswertungs-Dashboard (/analytics)

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

### Sprint 3: Produktverwaltung (Tag 3) ✅
- [x] `/products` Liste mit Status-Badge (Aktiv/Ausverkauft/Pausiert), Foto, Preis
- [x] Produkt anlegen/bearbeiten als Dialog (react-hook-form + Zod, alle Felder)
- [x] 14 EU-Allergene als Toggle-Buttons, Saisonalität, Eigenschaften (Bio/Kühlung/TK)
- [x] Foto-Upload via `/api/upload` → Vercel Blob (graceful wenn Token fehlt)
- [x] Quick-Bestand-Buttons +5/+10/+20 direkt in der Liste (optimistic update)
- [x] StockDialog: Schnellbuttons + Direkteingabe + Setzen
- [x] Server Actions: createProduct, updateProduct, updateStock, setStock, deleteProduct
- [x] Löschen mit Bestätigungsdialog
- [x] Zod-Validierung + Ownership-Check in allen Actions

### Sprint 4: Manuelle Verkaufserfassung + Analytics (Tag 4+5) ✅
- [x] `/sales` mit Schnellwiederholung (letzte 4 Verkäufe als One-Click-Buttons)
- [x] SaleDialog: Produkt-Dropdown + "Sonstiges", Betrag, Menge, Kanal-Buttons, Datum, Notiz
- [x] Server Actions: createManualSale, updateManualSale, deleteManualSale (Zod + Ownership)
- [x] Liste der letzten 20 Verkäufe mit Inline-Edit und Löschen
- [x] `/analytics` mit Zeitraum-Wahl (Woche/Monat/Quartal/Jahr via URL-Param)
- [x] Gesamtumsatz mit % Vergleich zur Vorperiode + Trendpfeil
- [x] Horizontales Recharts BarChart (Umsatz nach Kanal, mobile-optimiert)
- [x] Top-5-Produkte mit Fortschrittsbalken (aus Bestellungen + manuellen Verkäufen)
- [x] Automatischer Insight-Text (z.B. Bestseller, Kanal-Tipp)

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

*Zuletzt aktualisiert: 2026-05-31 — Sprint 4 abgeschlossen*
