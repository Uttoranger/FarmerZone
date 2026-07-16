# FarmerZone — Entwicklungsstand

## Projektübersicht

Regionale Lebensmittel direkt vom Bauern — FarmerZone als Pilot mit ausgewählten Höfen.
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

**Sprint 15 abgeschlossen** — Härtung 1: test-email dev-only, Cron fail-closed, CI-Workflow, Webhook-Retry-Fix, Build-Script mit `prisma generate`

---

## Erledigte Schritte

### Sprint 15: Härtung 1 — Sicherheit + CI + Webhook + Deploy-Vorbereitung ✅
- [x] `/api/test-email` — nur noch bei `NODE_ENV=development` aktiv, in Produktion 404; keine Konfigurationsdetails (API-Key-Präfix etc.) mehr im Response
- [x] Cron-Route `cleanup-reservations` fail-closed: fehlendes `CRON_SECRET` oder falscher Header → 401
- [x] `package.json`: `"typecheck": "tsc --noEmit"`; `"build": "prisma generate && next build"` (Vercel-Build-Cache kann sonst veralteten Prisma-Client verwenden); `packageManager`-Feld für CI/Vercel gepinnt
- [x] `.github/workflows/ci.yml` — lint + typecheck + build bei push/PR auf main; Build läuft mit Dummy-ENV-Werten (im Workflow dokumentiert), keine Secrets nötig
- [x] **Webhook-Retry-Fix**: `WebhookEvent` wird erst NACH erfolgreicher Verarbeitung persistiert; bei Verarbeitungsfehler antwortet die Route 500, sodass Stripe retried (vorher: Event galt bei Fehler dauerhaft als erledigt). Unique Constraint auf `stripeEventId` verifiziert; parallele Zustellung (P2002 beim Persistieren) wird als „skipped" behandelt. `handlePaymentFailed` läuft jetzt atomar in einer Transaktion inkl. Guard gegen doppelte Bestands-Rückbuchung bei Retries
- [x] `scripts/README.md` — Zweck + Ausführungshinweise für alle Diagnose-/Reparaturskripte
- [x] `vercel.json`: Cron-Schedule bereits auf `0 3 * * *` (Vercel-Hobby-Limit, war schon vor Sprint 15 umgestellt)

**Webhook-Verifikation mit der Stripe CLI** (lokal, `stripe listen --forward-to localhost:3000/api/stripe/webhook`):
1. **Erfolgsfall:** `stripe trigger payment_intent.succeeded` → zugehörige Bestellung steht auf `PAID`, `WebhookEvent`-Zeile mit der Event-ID existiert, Response 200 `{received: true}`
2. **Idempotenz:** dasselbe Event erneut zustellen (`stripe events resend <evt_id>`) → Response 200 `{received: true, skipped: true}`, keine Doppelverarbeitung
3. **Fehlerfall:** temporär einen `throw new Error('test')` in `handlePaymentSucceeded` einbauen → Trigger liefert Response 500, es wird KEIN `WebhookEvent` persistiert; nach Entfernen des `throw` stellt Stripe das Event automatisch erneut zu (bzw. `stripe events resend`) → Verarbeitung läuft korrekt durch
- Hinweis: E-Mail-Fehler lösen KEIN 500 aus — `lib/email.ts` fängt Fehler intern ab (Log statt Throw). Der 500-Pfad greift bei DB-/Verarbeitungsfehlern

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

### Sprint 5: Öffentliche Hof-Seite + Warenkorb (Tag 6) ✅
- [x] `/[farmSlug]` Server Component mit ISR (revalidate: 60), 404 + Pausiert-Screen
- [x] generateMetadata mit OpenGraph + Schema.org LocalBusiness JSON-LD
- [x] Banner, Header, Über-uns, Abholzeiten, Zahlungsarten, Kontakt
- [x] Produkt-Grid: 2 cols mobil / 3–4 cols Desktop, Bio-Badge, Lager-Icons, Saisonalität
- [x] "Ausverkauft"- und "Nicht verfügbar"-State mit unavailableReason
- [x] Warenkorb in localStorage (farmId-spezifisch, Session-ID für Reservierungen)
- [x] Pessimistisches Stock-Reservierungssystem (/api/reserve, 15 min TTL)
- [x] Sticky Cart-Button (erscheint nach erstem Produkt), Cart-Sheet mit Mengensteuerung
- [x] Cron-Job /api/cron/cleanup-reservations + vercel.json (alle 5 Minuten)
- [x] Impressum + Datenschutz Platzhalter-Seiten

### Sprint 6: Stripe Connect + Checkout + Vor-Ort-Zahlung (Tag 6+7) ✅
- [x] `src/lib/stripe.ts` — Stripe-Singleton (Server), `getStripePublishableKey()`
- [x] `src/lib/email.ts` — Resend-Wrapper mit Fallback-Logging + HTML-Templates
- [x] Stripe Connect Express-Onboarding: `createConnectAccount`, `createOnboardingLink`, `checkConnectStatus`
- [x] `/settings` — Übersicht mit Navigation zu Unterbereichen
- [x] `/settings/payments` — Stripe-Status-Anzeige, Onboarding-Button, Return-Handler
- [x] `/api/stripe/return` — Callback nach Onboarding, setzt `stripeAccountReady`
- [x] `/[farmSlug]/checkout` — Server Component mit `CheckoutForm`-Client
  - Warenkorb-Übersicht aus localStorage
  - Abholtermin-Auswahl (nächste 14 Tage, basierend auf PickupSlots)
  - Kundendaten (Name, Email, Telefon, Notiz)
  - Zahlungsart-Auswahl (Online / Bar / Karte, nur was Farm akzeptiert)
  - Pflicht-Checkbox bei Vor-Ort-Zahlung
- [x] Stripe Elements — `StripePaymentStep` mit `PaymentElement` + `confirmPayment`
- [x] `/api/checkout` — Pessimistischer Stock-Lock, Order-Erstellung, PaymentIntent (ONLINE) oder Bestätigungsmail (ONSITE)
- [x] `/api/orders/confirm/[token]` — Vor-Ort-Bestätigung per E-Mail-Link → `CONFIRMED`
- [x] `/api/stripe/webhook` — Signatur-Verifikation, Idempotenz via WebhookEvent, `payment_intent.succeeded` → `PAID` + Mails, `payment_intent.payment_failed` → `CANCELLED` + Stock-Restore
- [x] `/[farmSlug]/confirm/[orderId]` — Bestätigungsseite (Online bezahlt / Vor-Ort bestätigt / pending / fehlgeschlagen)

### Sprint 7: Bestellverwaltung & E-Mail-System (Tag 7+8) ✅
- [x] `src/emails/_layout.tsx` — `EmailLayout` Wrapper + Style-Konstanten
- [x] `src/emails/order-confirmation.tsx` — Bestellbestätigung für Kunden (Online-Zahlung)
- [x] `src/emails/onsite-confirmation.tsx` — Vor-Ort-Bestätigungslink mit CTA-Button
- [x] `src/emails/new-order-notification.tsx` — Bauer-Benachrichtigung (neue Bestellung)
- [x] `src/emails/order-confirmed.tsx` — Bauer-Benachrichtigung (Vor-Ort bestätigt)
- [x] `src/emails/pickup-reminder.tsx` — Kundenbenachrichtigung "Bereit zur Abholung"
- [x] `src/emails/order-cancelled.tsx` — Storno-Mail mit optionaler Rückerstattungsinfo
- [x] `src/lib/email.ts` — vollständig neu mit `OrderForEmail`-Typ und 6 typisierten Send-Funktionen; `renderToStaticMarkup` statt Resend-eigenes Rendering; Fehler werden geloggt ohne Server-Action-Crash
- [x] `src/server/queries/orders.ts` — `getOrdersForFarm`, `getOrderDetail` mit Items
- [x] `src/server/actions/orders.ts` — `markAsReady` (→ READY + Kundenmail), `markAsPickedUp`, `markAsPickedUpAndPaid`, `cancelOrder` (→ Stripe-Refund + Stock-Restore + Storno-Mail)
- [x] `src/components/orders/order-status.ts` — `statusLabel`, `statusColor`, `paymentLabel`
- [x] `src/components/orders/order-card.tsx` — OrderCard mit Quickactions + useTransition
- [x] `src/components/orders/orders-client.tsx` — Filter-Tabs (Offen/Heute/Alle/Erledigt), Gruppierung nach Abholtag
- [x] `src/components/orders/order-actions.tsx` — OrderActions für Detailseite
- [x] `src/components/orders/print-button.tsx` — Client-Komponente für `window.print()`
- [x] `/orders` — Bestellliste (Server Component → OrdersClient)
- [x] `/orders/[orderId]` — Detailseite mit Kundeninfo, Abholung, Produkte, Zahlung, Aktionen
- [x] `/orders/[orderId]/print` — Druckversion (print:hidden CSS, kein Nav auf Print)
- [x] Webhook + Confirm-Route auf neue Email-Funktionen umgestellt
- [x] `checkout/route.ts` auf `sendOnsiteConfirmation` umgestellt

### Kombinierter Sprint: Tabellen-Ansicht + Status-Werkstatt ✅

**Teil 1 — Tabellen-Ansicht für /customers:**
- [x] **`customers-client.tsx`** — Filter/Suche von Sortierung getrennt: `filtered` (unsortiert) → Tabelle auf Desktop; `sortedForCards` → Karten auf Mobile. Sort-Dropdown auf Mobile sichtbar (`md:hidden`), auf Desktop durch Spalten-Header ersetzt
- [x] **`src/components/customers/customers-table.tsx`** — Eigener `sortCol/sortDir` State; sortierbare Spalten (Name/Bestellungen/Umsatz/Letzte Bestellung per Klick auf Header mit Pfeil-Indikator); Sticky Header; Hover-Highlight; Klick auf Zeile → Detailseite; Telefon-Icon in Aktionsspalte; Empty State

**Teil 2 — Status-Werkstatt:**
- [x] **`StatusPostAnlass` Enum** — FRESH_PRODUCT / NEW_SEASON / PROMOTION / ANNOUNCEMENT in `prisma/schema.prisma`
- [x] **`StatusPost` Modell** — farmId, title, body, anlass, photoUrl, linkedProductIds[], publishedAt?, expiresAt?, showOnFarmPage, sentViaEmail, sentViaWhatsApp, emailRecipientCount, whatsappRecipientCount, whatsappSentCount; Index auf (farmId, publishedAt)
- [x] **Migration** — `20260623_status_posts/migration.sql` manuell erstellt, via `prisma migrate deploy` angewendet (Supabase Shadow-DB Workaround)
- [x] **`src/server/queries/status-posts.ts`** — `getStatusPostsForFarm` (alle mit isActive/isDraft Flags), `getActiveStatusPost` (für Hof-Seite, nur showOnFarmPage=true + nicht abgelaufen), `getStatusPostForWhatsApp` (inkl. Subscriber-Liste + Namensauflösung via Orders)
- [x] **`src/server/actions/status-posts.ts`** — `publishStatusPost` (Frequenz-Schutz: max. 1 E-Mail pro 7 Tage farm-weit; `{Vorname}` Personalisierung; `revalidatePath` für /status und öffentliche Hof-Seite), `markWhatsAppSent`, `expireStatusPost`, `deleteStatusPost`
- [x] **`src/emails/status-update.tsx`** — Anlass-Badge farbig, Titel, Body (Zeilenumbrüche erhalten), optionales Foto, Farm-CTA-Button, Abmelde-Link im Footer
- [x] **`src/lib/email.ts`** — `sendStatusUpdateEmail()` hinzugefügt
- [x] **`/status`** — Übersicht (Aktiv/Entwürfe/Vergangen-Sektionen), Empty State, "+ Neuer Status" Button; `status-post-card.tsx` mit Anlass-Badge, Status-Indikator, Statistiken, Deaktivieren/Löschen-Buttons, Link zu WhatsApp-Tap-Liste wenn unvollständig
- [x] **`/status/new`** — 3-Schritt-Wizard: Schritt 1 (Anlass/Titel/Body/Produkte verlinken, Platzhalter-Buttons für Sprach&KI-Hilfe); Schritt 2 (4 Kanal-Cards mit Counts, Frequenz-Schutz-Hinweis, Info-Box); Schritt 3 (Vorschau-Card + Empfänger-Zusammenfassung + "Versand starten")
- [x] **`/status/[id]/send-whatsapp`** — Fortschrittsbalken; pro Abonnent: Avatar+Name+Telefon, "Tippen"-Button öffnet `wa.me/…?text=…` mit vorbereiteter Nachricht; Mark-als-gesendet (clientseitig + Server via `markWhatsAppSent`); Erfolgsscreen bei 100%
- [x] **`/api/status-image/[id]/route.tsx`** — `ImageResponse` aus `next/og` (kein Zusatzpaket nötig); 1080×1920 WhatsApp-Story-Format; Anlass-Badge, Titel, Body, Farm-Footer; downloadbar via `?download` oder direktem Link
- [x] **Hof-Seite** — `getActiveStatusPost` parallel zu Farm-Daten; hervorgehobene Card nach Hof-Header mit Anlass-Badge + "vor X Stunden/Tagen"-Hinweis + Titel + Body + optionalem Foto
- [x] **`farmer-nav.tsx`** — "Status" mit `Megaphone`-Icon zwischen "Kunden" und "Produkte"

### Sprint 9c: Kundenliste mit Smart-Filtern und Detailansicht ✅
- [x] **`src/server/queries/customers.ts`** — `getCustomersForFarm(farmId)`: aggregiert alle Bestellungen nach `customerEmail`, berechnet `orderCount`, `totalSpent` (ohne CANCELLED/NOT_PICKED_UP), `daysSinceLastOrder`, `topProducts` (Top 3), `isSubscribed` aus `CustomerFarmSubscription`; Status-Flags: `isStammkunde` (≥3 Bestellungen), `isDiesenMonatAktiv` (≤30 Tage), `isLangeNichtGesehen` (≥2 Bestellungen + >60 Tage), `isNeu` (1 Bestellung <14 Tage); `getCustomerDetail(farmId, email)` zusätzlich mit letzten 10 Bestellungen + Subscription-Details; alle Daten serialisiert (ISO-Strings, Numbers statt Decimal)
- [x] **`/customers`** (Server Component) — Header mit Personen-Badge, gibt alle Kundendaten an `CustomersClient` weiter
- [x] **`customers-client.tsx`** (Client Component) — Live-Suchleiste (Name/Telefon/Email); 5 Pill-Filter mit Counts (Alle/Stammkunden/Diesen Monat/Lange weg/Neu); Sort-Dropdown (Häufigste/Höchster Umsatz/Letzte Bestellung/Alphabetisch/Neueste Kunden); Kundenkarten mit Avatar+Initialen (grün=Stammkunde, amber=Lange weg), Glocken-Icon bei `isSubscribed`, Status-Badge, Top-2-Produkte im Footer; Tel-Icon als direkter `tel:`-Link; Insight-Box wenn ≥3 "Lange weg"-Kunden
- [x] **`/customers/[customerEmail]`** (Server Component) — URL-Encoding für E-Mail beachtet (`encodeURIComponent` bei Links, `decodeURIComponent` + Prisma `mode: 'insensitive'` für Query); großer Avatar, Header mit Status-Badge + "Kunde seit Monat Jahr"; 3 Aktions-Buttons (Anrufen/WhatsApp/E-Mail, disabled wenn kein Telefon); Kontakt-Karte; 3 Statistik-Kacheln; Lieblingsprodukte-Karte; Abonnements-Sektion (wenn `isSubscribed`); letzte 5 Bestellungen (klickbar → `/orders/[orderId]`) mit Status-Farben aus `order-status.ts`
- [x] **`farmer-nav.tsx`** — neuer Nav-Eintrag "Kunden" mit `Users`-Icon zwischen "Bestellungen" und "Produkte" (Desktop-Sidebar + Mobile-Tab-Bar)
- [x] **Keine DB-Migration nötig** — `CustomerFarmSubscription` bereits in Sprint 9b angelegt

### Sprint 9b: Kunden-Opt-in-System ✅
- [x] **Datenmodell** — neues Prisma-Modell `CustomerFarmSubscription` mit `customerEmail`, `farmId`, `optInEmail`, `optInWhatsApp`, `customerPhone`; Unique-Index auf `(customerEmail, farmId)`; manuell migriert via `20260623_customer_subscriptions`
- [x] **Checkout-Checkboxen** — `optInEmail` + `optInWhatsApp` in Formular (beide unchecked by default, DSGVO-konform); WhatsApp-Toggle disabled wenn keine Telefonnummer; Datenschutz-Hinweis mit Links
- [x] **Checkout-API** — nach Bestellerstellung: `CustomerFarmSubscription.upsert()` wenn opt-in gesetzt; bestehende `true`-Werte werden nicht überschrieben
- [x] **Magic-Link-Auth** — `auth.ts` `sendMagicLink`-Callback sendet jetzt echte E-Mails via `sendMagicLinkEmail()` aus `email.ts`; Fallback auf `console.log` bei Fehler; 15 Min. Gültigkeit
- [x] **`/account/login`** — Kunden geben E-Mail ein, erhalten Magic-Link-E-Mail; Erfolgs-Screen mit "Erneut senden"-Option
- [x] **`/account/profile`** — Server Component (Session-Check → redirect wenn nicht eingeloggt); zeigt alle Abos mit Inline-Toggles; Konto-Lösch-Button (DSGVO); Abmelden-Button
- [x] **`/account/unsubscribe?token=...`** — tokenbasiertes Abmelden ohne Login (für Newsletter-Mails); HMAC-SHA256-Token via `src/lib/unsubscribe.ts`
- [x] **E-Mail-Templates** — `customer-magic-link.tsx` (Login-Link), `newsletter.tsx` (Vorlage für Sprint 9d); `_layout.tsx` erweitert um optionales `manageUrl` im Footer; `order-confirmation.tsx` mit Link zu `/account/profile`
- [x] **Datenschutz** — Abschnitte 9 (Newsletter-Opt-in) und 10 (Magic-Link-Login) ergänzt
- [x] **"Mein Konto"-Link** — in Footer der Hof-Seite (`/[farmSlug]`) hinzugefügt
- [x] **`src/server/actions/subscriptions.ts`** — `updateSubscription`, `unsubscribeWithToken`, `deleteCustomerAccount`
- [x] **`src/lib/unsubscribe.ts`** — `generateUnsubscribeToken` / `verifyUnsubscribeToken` (HMAC-SHA256 mit BETTER_AUTH_SECRET)

### Sprint 9a: Quick Wins fürs Bauer-Erlebnis ✅
- [x] **"Heute"-Dashboard** — persönliche Begrüßung, Tagesaufgaben-Karte mit Kundennamen, aggregierte Packliste, Wochesumsatz mit %-Vergleich zur Vorwoche (TrendingUp/Down/Minus), Bestellungsanzahl diese Woche, 4 Aktionskarten
- [x] **Shop-Link-Banner** — `<ShopLinkBanner farmSlug={...}>` auf jeder Farmer-Seite (im Layout), tägliches Ausblenden via localStorage, "Link kopieren" + "Per WhatsApp teilen"-Button
- [x] **Packlisten-Druck** — `/orders/today/print` Server Component: aggregierte Mengen-Übersicht + Pro-Kunde-Blöcke, Print-CSS (`@media print`), `<PrintButton>` Client-Komponente
- [x] **Undo-Toasts** — 6 Sek. Sonner-Toast nach "Als bereit markiert" / "Abgeholt" / "Abgeholt & bezahlt" mit "Rückgängig"-Button → `revertOrderStatus` Server Action
- [x] **Cancel-Bestätigungsdialog** — Dialog mit Warnung vor Rückerstattung bei Online-Zahlung in `OrderCard` und `OrderActions`
- [x] **Sprach-Cleanup** — "Stornieren" → "Zurücknehmen" in Order-Card, Order-Actions
- [x] **Touch-Targets** — OrderCard/OrderActions Buttons `h-10`/`min-h-[52px]`, Quick-Stock-Buttons `h-10 min-w-[48px]`, Mobile-Nav-Items `min-h-[56px]`
- [x] **OrdersClient Empty State** — "Shop-Link kopieren"-Button bei 0 Bestellungen (filter=active), spezifische Nachrichten für "alle erledigt" vs. "keine in dieser Ansicht"
- [x] **Filter-Tabs** — Design-Update: `bg-primary` aktiv, `py-2.5` (min-h 44px)
- [x] **`revertOrderStatus` Server Action** — whitelist-basierte Status-Rücksetzung (`PAID|CONFIRMED|IN_PREPARATION|READY`), löscht `pickedUpAt` + `paidAt`
- [x] **Dashboard-Abfragen** — Prev-Week-Vergleich, `umsatzChangePercent`, `bestellungenWocheCount`, today-filter schließt PICKED_UP nicht mehr aus
- [x] **Farmer-Layout** — Lädt `farm.slug` und gibt ihn an `<ShopLinkBanner>` weiter; doppelter Farm-Lookup vermieden durch direkten Query im Layout

### Sprint 8: Polish, Branding & Go-Live-Vorbereitung ✅
- [x] Branding: "Bauernshop" → "FarmerZone" (Titles, UI, E-Mails, Docs)
- [x] Startseite `/` — FarmerZone Landing Page statt Next.js-Default
- [x] `src/app/not-found.tsx` — hübsche 404-Seite
- [x] `src/app/error.tsx` — hübsche Error-Seite
- [x] `/impressum` — vollständiger Inhalt gemäß ECG (Österreich), inkl. Pilot-Hinweis
- [x] `/datenschutz` — DSGVO-konforme Datenschutzerklärung (Stripe, Resend, Supabase, Vercel)
- [x] Cookie-Banner — `<CookieBanner>` im Root-Layout (localStorage-gesteuert)
- [x] Settings-Übersicht `/settings` — 5 Bereiche als Karten
- [x] `/settings/profile` — Hof-Profil bearbeiten (Name, Beschreibung, Adresse, Kontakt, Bilder)
- [x] `/settings/pickup-slots` — Abholzeiten verwalten (Hinzufügen, Löschen, Aktivieren/Deaktivieren)
- [x] `/settings/pause` — Shop pausieren mit optionaler Kunden-Nachricht
- [x] `/settings/account` — Konto-Info (E-Mail, Passwort-Hinweis, Konto-Löschung)
- [x] Server Actions: `updateProfile`, `addPickupSlot`, `deletePickupSlot`, `togglePickupSlotActive`, `setPause`
- [x] Empty States verbessert: Orders, Products, Sales, Analytics
- [x] React-Warning gefixt: `EMPTY_DEFAULTS` im product-dialog.tsx mit vollständigen String-Defaults
- [x] README.md — vollständig (Tech-Stack, Setup, Deployment, Go-Live-Checkliste)
- [x] `.env.example` — aktualisiert mit allen Variablen
- [x] DEVELOPMENT.md — auf Stand Sprint 8 gebracht

### E-Mail-Diagnose-Infrastruktur (Sprint 7, läuft noch)
- `/api/test-email?to=deine@email.at` — Test-E-Mail senden und Ergebnis als JSON
- `sendRaw()` in `src/lib/email.ts` exportiert für direkte Diagnose
- Alle Send-Funktionen loggen Init + Senden + Erfolg/Fehler

### Stripe-CLI-Webhooks für lokales Testen (Sprint 7)
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# STRIPE_WEBHOOK_SECRET=whsec_... in .env.local eintragen
```

---

## Bekannte Bugs & Fixes

### BUG: Status-Inkonsistenz bei Online-Zahlungen (behoben 2026-06-22)

**Symptom:** Order HM-2206-E3CC zeigte `status=PENDING_CONFIRMATION` + `paymentLabel="Online bezahlt"` — optisch widersprüchlich.

**Root Cause (2 Probleme):**

1. **Stripe-Webhook erreicht localhost nicht** — Im lokalen Dev ohne `stripe listen` kann Stripe den `/api/stripe/webhook` Endpunkt nicht erreichen. Der `payment_intent.succeeded`-Event wird zwar von Stripe ausgelöst, landet aber nie beim Dev-Server. Die Bestellung bleibt dadurch auf `PENDING_CONFIRMATION` + `payStatus=PENDING` stecken, obwohl die Zahlung bei Stripe erfolgreich war.

2. **Irreführendes Label** — `paymentLabel('ONLINE')` gab "Online bezahlt" zurück, was fälschlicherweise impliziert, die Zahlung sei bereits eingegangen. Das Label zeigt die Zahlungsmethode, nicht den Zahlungsstatus.

**Fixes:**
- `src/components/orders/order-status.ts`: `paymentLabel('ONLINE')` → "Online (Stripe)" statt "Online bezahlt"
- `scripts/fix-pending-online-orders.ts`: Einmalige Migration — prüft alle ONLINE-Orders mit `payStatus=PENDING` gegen Stripe-API und setzt auf PAID wenn `pi.status === 'succeeded'`. **4 Bestellungen korrigiert** (HM-1506-5874, HM-1706-F081, HM-1706-1587, HM-2206-E3CC).
- Außerdem: Prisma `Decimal`-Serialisierung in `getOrdersForFarm`/`getOrderDetail` — werden jetzt vor dem Server→Client-Transfer auf `number` konvertiert.

**Lokales Webhook-Testing — Stripe CLI einrichten:**

```bash
# 1. Stripe CLI installieren (einmalig)
# Windows: winget install Stripe.StripeCLI
# oder: https://stripe.com/docs/stripe-cli

# 2. Einloggen
stripe login

# 3. Webhooks an localhost weiterleiten (immer vor dem Testen starten!)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 4. Den angezeigten Webhook-Signing-Secret in .env.local setzen:
# STRIPE_WEBHOOK_SECRET=whsec_...

# 5. In einem anderen Terminal: Dev-Server starten
pnpm dev

# 6. Test-Zahlung mit Testkarte 4242 4242 4242 4242 durchführen
# → stripe listen zeigt den Event + Response
```

**Verifizierung nach einer neuen Online-Bestellung:**
1. `/orders` öffnen → Bestellung erscheint mit Status "Bezahlt" (PAID)
2. Oder: `stripe listen` Terminal zeigt `payment_intent.succeeded → 200 OK`
3. Alternativ: `pnpm exec dotenv -e .env.local -- pnpm exec tsx scripts/check-orders.ts` ausführen

---

## Wichtige Entscheidungen & Rahmenbedingungen

- **Komponentenrumpf:** Helfer-Funktionen und ihre `const`-Datengrundlagen stehen VOR ihrer ersten Verwendung — im Prod-Bundle konvertiert der SWC-Minifier `function`-Deklarationen zu `const`, die nicht gehoisted werden; TDZ crasht lautlos in Produktion (Vorfall Sprint 20: `sections`/`isSectionVisible` in `farm-page-view.tsx`).
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

## Schema-Änderungen ab jetzt

**Regel: NIE wieder `prisma db push`. Jede Schema-Änderung erzeugt eine Migrationsdatei.**

### Ablauf bei einer Schema-Änderung

1. `prisma/schema.prisma` bearbeiten
2. `pnpm db:migrate` ausführen (= `prisma migrate dev` gegen die Dev-DB in `farmerzone-dev`)
   → Prisma erzeugt automatisch eine neue Datei unter `prisma/migrations/<timestamp>_<name>/migration.sql`
3. Die neue Migrationsdatei committen und pushen
4. Vercel führt beim Deploy automatisch `prisma migrate deploy` gegen Produktion aus (via `vercel-build` Script)

### Warum das besser ist

| Vorher (`db push`) | Jetzt (`migrate dev` + `migrate deploy`) |
|---|---|
| Kein SQL-Audit-Trail | Jede Änderung als SQL-Datei nachvollziehbar |
| Reihenfolge-Fehler möglich | Konstruktionsbedingt unmöglich |
| Deploy = manueller Schritt | Deploy = automatisch im Vercel-Build |
| Dev = Prod-DB (Datengefahr) | Dev = eigene `farmerzone-dev`-DB |

### Umgebungen

| Umgebung | DB | Wer migriert |
|---|---|---|
| Lokal | `farmerzone-dev` (in `.env.local`) | `pnpm db:migrate` manuell |
| Vercel Preview | `farmerzone-dev` (Vercel Env-Var: Preview scope) | automatisch im Build |
| Vercel Production | `farmerzone` Prod-DB (Vercel Env-Var: Production scope) | automatisch im Build |

---

## Nützliche Befehle

```bash
pnpm dev              # Dev-Server starten
pnpm db:migrate       # Schema-Änderung: Migrationsdatei erzeugen + Dev-DB aktualisieren
pnpm db:seed          # Testdaten laden (nur Dev-DB)
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

*Zuletzt aktualisiert: 2026-07-16 — Sprint U: Umgebungs-Trennung + Migrations-Baseline*
