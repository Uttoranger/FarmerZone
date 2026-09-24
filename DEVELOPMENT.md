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

**Stand 2026-09-22.** Produktivbetrieb mit einem Pilothof. Zuletzt gemerged:
Dark Mode (#96–#99), Testumgebung erkennbar (#98), Taxonomie 1 mit Unterkategorien,
Siegeln und Futter-Kennzeichnung (#100), Preis-Semantik „€ 50,00 für 2 kg" mit
Grundpreis-Zeile (#101). Offen: Produktformular Feinschliff (#102).

Die Sprintliste darunter ist chronologisch von neu nach alt und endet bei Sprint 1;
die Fachabschnitte weiter unten (Reservierungen, Preise, Theme, Taxonomie,
Umgebungen, Triage) beschreiben, wie die Regeln heute funktionieren.

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

### BUG: Storno-Rückbuchung nicht atomar, Doppeltipp buchte doppelt (behoben 2026-09-24)

**Symptom (statisch belegt, kein Kundenfall):** `cancelOrder` prüfte den Status nur
lesend, buchte dann je Position außerhalb jeder Transaktion zurück und setzte
CANCELLED erst am Ende. Zwei gleichzeitige Aufrufe (Doppeltipp) passierten beide
die Leseprüfung → Bestand doppelt zurückgebucht. Die Stripe-Erstattung lief VOR
dem Statuswechsel; ihr Scheitern verhinderte den ganzen Storno.

**Zweiter Weg zum selben Schaden — sequentiell, kein Wettlauf nötig:**
`revertOrderStatus` (das Undo im Toast nach „Bereit"/„Abgeholt") hatte **keinen**
Statusfilter. „Bereit" → Storno → „Rückgängig" im noch sichtbaren Toast holte
die stornierte Bestellung zurück; ein zweiter Storno buchte den Bestand erneut
zurück. `revertReady`/`revertPickedUp` prüften lesend und schrieben blind —
derselbe Schaden, aber nur in einem echten Gleichzeitig-Wettlauf.

**Fix (fix/storno-atomar):**
- Storno: Der bedingte Statuswechsel (`updateMany`, `status notIn [CANCELLED,
  PICKED_UP, NOT_PICKED_UP]`) ist die Sperre und läuft mit der Rückbuchung in
  EINER Transaktion. Die Transaktion ist dem Stripe-Webhook entlehnt — die Sperre
  nicht: Der Webhook prüft nur lesend (siehe Altlast unten).
- `NOT_PICKED_UP` mitgesperrt: Bei „nicht abgeholt" bleibt der Warenpreis beim
  Hof; ein Storno danach erstattete ihn voll und buchte Ware zurück, die nie
  zurückkam. Die Oberfläche bot es dort nie an, der Server jetzt auch nicht.
- Stripe erst nach der Transaktion. Scheitert die Erstattung: Storno und
  Rückbuchung bleiben (richtig so), Meldung an den Hof, **Sentry-Eintrag** mit der
  Bestell-ID — vorher stand es nur im Log. **Keine Storno-Mail** in diesem Fall:
  `order-cancelled.tsx` liest „keine Erstattung" als Vor-Ort-Zahlung und schriebe
  „Da du vor Ort bezahlst, entstehen dir keine Kosten".
- Mail sonst über `nachDerAntwort()`.
- Alle drei Rückwege schreiben bedingt (`updateMany` mit Statusfilter).
  `revertOrderStatus` darf nur den Schritt zurück, den sein Toast meint:
  zurück auf READY nur aus PICKED_UP, sonst nur aus READY. (Ein loser Filter
  „READY oder PICKED_UP" hätte „Bereit" → „Abgeholt" → „Rückgängig" im ersten
  Toast erlaubt — abgeholte Ware wäre wieder stornierbar gewesen.)
- Erstattung und REFUNDED-Vermerk getrennt: Scheitert nur der Vermerk, ist das
  Geld zurück → Erfolg an den Hof, Mail mit Betrag, Sentry meldet den Vermerk.

Wache: `tests/storno-atomar.test.ts` — deterministischer Wettlauf (beide lesen,
bevor einer schreibt), Storno → Undo → Storno, Rückweg-Wettlauf, eigene tx-Fakes
als Beweis, dass die Rückbuchung IN der Transaktion läuft.

**Kandidat fürs Testfundament (Integrationstests, sobald es sie gibt):** zwei
GLEICHZEITIGE `cancelOrder` gegen echtes Postgres → Bestand exakt einmal zurück.

**Offen, mit Absicht nicht angefasst:**
- `PaymentStatus` kennt kein „Erstattung ausstehend" — nach gescheiterter
  Erstattung steht die stornierte Bestellung auf PAID. Vorschlag `REFUND_PENDING`,
  nur mit Freigabe (Schema).
- Die Meldung „Bitte manuell über das Stripe Dashboard erstatten" ist für den Hof
  nicht umsetzbar: Bei der Destination Charge kann nur das Plattformkonto
  erstatten. Wortlaut blieb auf ausdrücklichen Wunsch.
- `markAsReady`, `markAsPickedUp`, `markAsPickedUpAndPaid` prüfen lesend und
  schreiben blind — außerhalb dieses Auftrags, als Altlast in ARCHITECTURE §6.
  Ein Storno genau zwischen ihrem Lesen und Schreiben wird überschrieben; aus
  READY bucht ein zweiter Storno dann erneut zurück. Nur bei echter
  Gleichzeitigkeit erreichbar (zwei Geräte, zwei Knöpfe im selben Moment).
- `markAsNotPickedUp` ebenso. Dort kein Bestand, die Gebühren-Erstattung ist per
  Stripe-Schlüssel idempotent — ein Wettlauf kann nur das Status-Etikett falsch
  setzen, und NOT_PICKED_UP ist jetzt gegen einen zweiten Storno gesperrt.
- Altlast Webhook: `handlePaymentFailed`/`handlePaymentSucceeded` prüfen lesend
  und schreiben unbedingt — `handlePaymentSucceeded` kann eine stornierte
  Bestellung wieder auf PAID setzen. Eigener Fix.

### BUG: Sprungmarken der Hofseite sprangen falsch (behoben 2026-09-20)

**Symptom** (Meldung `cmua8bof` aus dem Briefkasten): „Section bzw. die Sprungmarken funktionieren auf Mobile nicht, wenn ich bilder drücke, springt der screen auf eine andere section."

**Ursachen — vier, alle statisch am Code belegbar, keine davon mobil-exklusiv:**

1. **Reiterfolge gegen Dokumentfolge.** Die Leiste listete Übersicht → Produkte → Fotos, im Dokument stand aber Fotos vor Produkte. Ein Tipp auf den *letzten* Reiter scrollte nach **oben**, und beim Herunterscrollen wanderte die Markierung 1 → 3 → 2, also sichtbar rückwärts.
2. **`#uebersicht` war der Elterncontainer** von `#fotos` und `#produkte`, nicht ihr Geschwister. Der Beobachter sah eine Box, die praktisch die ganze Seite einnimmt, und zog die Markierung dauernd auf „Übersicht" zurück.
3. **`#produkte` umfasste nur die Überschriftenzeile**, das Raster stand daneben. Nach dem Sprung lag diese flache Box oberhalb des Erkennungsstreifens und wurde nie markiert.
4. **Keine Sperre während des programmatischen Scrollens.** `scrollToSection` setzte den Reiter und startete ein weiches Scrollen; der Beobachter überschrieb unterwegs genau den Reiter, den die Person eben gedrückt hatte. Zudem wurde nur `isIntersecting === true` behandelt, und bei mehreren Einträgen in einem Callback gewann der letzte der Schleife — die Reihenfolge des `entries`-Arrays ist nicht zugesichert.

Dazu das zweite gemeldete Symptom: Die **Lightbox sperrte das Scrollen der Seite dahinter nicht** und war als einzige Overlay-Ebene des Projekts ohne Portal gebaut (Warenkorb und Dialoge sperren über Base-UI automatisch). Auf dem Telefon scrollt jede Wischgeste über dem offenen Bild die Seite mit — beim Schließen steht man in einem anderen Abschnitt. Plausibel als Ursache des gemeldeten Verhaltens, aber nicht am Gerät nachgewiesen.

**Fachregel: eine Liste für beides.** Reiterleiste und Beobachter lesen die Sektionen aus `src/lib/hofseite-sektionen.ts`, nicht mehr jeder aus einer eigenen Aufzählung. `hofseiteSektionen()` liefert sie in Dokumentreihenfolge (Übersicht, Fotos, Produkte — deckungsgleich mit `DEFAULT_SECTIONS`, wo `gallery` (4) vor `products` (5) steht); `naechsterAktiverReiter()` entscheidet die Markierung: laufender Sprung gewinnt, sonst der **unterste** sichtbare Abschnitt, sonst bleibt die bisherige Markierung stehen. Wer eine Sektion hinzufügt, ändert diese eine Liste — nicht zwei Stellen, die auseinanderlaufen können.

**Nicht behoben:** Die Hofseite wertet `sectionsConfig.order` weiterhin nicht aus. Der Hof kann die Sektionen unter Einstellungen → Erscheinungsbild per Drag sortieren, die öffentliche Seite rendert aber eine feste Reihenfolge. Das Bedienelement verspricht damit mehr, als es hält — eigener Sprint.

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

## Vorfälle

Produktionsvorfälle, chronologisch. Jeder Eintrag: was passiert ist, Ursache,
Folge, Maßnahme — damit die Regel, die daraus wurde, ihre Begründung behält.

### 2026-09-23 · Deploy-Fenster: P2011 auf FutterKennzeichnung (eine Anfrage, kein Schaden)

**Was passiert ist.** Um 16:13 UTC, während des Deploys von Bereiche 1 (#107),
scheiterte genau eine Anfrage: `POST /products` mit Prisma-Fehler P2011. Der
noch laufende alte Code (Stand #106) legte eine Futter-Kennzeichnung an und
konnte die neuen NOT-NULL-Spalten `futtermittelart`, `nettoMenge`,
`nettoEinheit` nicht liefern.

**Ursache.** `vercel-build` führt `prisma migrate deploy` VOR `next build` aus.
Zwischen Migration und Live-Schaltung läuft der alte Code auf dem neuen Schema
— das Deploy-Fenster, wenige Minuten. Die Schutzabfrage der Migration belegt
zwar, dass die Tabelle beim Migrieren LEER war; „leer" schützt aber nicht vor
Einfügungen des alten Codes in diesem Fenster.

**Folge.** Eine Anfrage mit Fehlermeldung. Kein Datenschaden, kein Checkout
betroffen, die Migration lief vollständig durch; der nächste Versuch nach dem
Deploy ging durch.

**Maßnahme.** Expand/Contract-Regel als Invariante in `docs/ai/ARCHITECTURE.md`
§5, durchgesetzt von `tests/migrationen-wache.test.ts` (Teil der Unit-Suite und
damit des Stop-Hooks). Begründete Ausnahmen tragen
`-- EXPAND-CONTRACT: Tabelle leer` oder `-- EXPAND-CONTRACT: Schritt 2 von 2`
in den fünf Zeilen vor dem `ALTER TABLE`; die Migration von Bereiche 1 trägt
den Marker „Tabelle leer" rückwirkend (die Schutzabfrage belegt ihn). Der
Prüfer-Agent prüft dieselbe Regel im Diff.

**Beobachtungen am Rand, nichts unternommen:**
- `pg` meldet eine Deprecation-Warnung für `client.query()` bei paralleler
  Nutzung desselben Clients — mit pg@8 harmlos; vor einem Update auf pg@9
  prüfen.
- Nach einem Merge mit Migration nicht auf farmerzone.at testen, bis das
  Deployment in Vercel READY ist — sonst testet man genau in das
  Deploy-Fenster hinein.

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
| Supabase | PostgreSQL — zwei Projekte: `Farmerzone` (Produktion) und `farmerzone-dev` (lokal + Previews) | ✅ aktiv, Region Frankfurt |
| Stripe | Zahlungen + Connect (Test-Keys in Dev/Preview, Live in Produktion) | ✅ aktiv |
| Resend | E-Mail-Versand (nur Produktion; Previews senden nicht) | ✅ aktiv |
| Vercel | Hosting, Blob-Storage, Cron (Hobby-Tarif) | ✅ aktiv |
| Sentry | Fehlerberichte (ohne personenbezogene Daten, `sentry-hygiene.ts`) | ✅ aktiv |

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

### Neue Tabellen: RLS nicht vergessen

**Regel: Jede neu hinzugefügte Tabelle braucht in derselben Migration ihre Zeile**

```sql
ALTER TABLE "public"."NeueTabelle" ENABLE ROW LEVEL SECURITY;
```

Sonst kehrt die Supabase-Advisor-Warnung `rls_disabled_in_public` zurück (ein
ERROR-Lint pro Tabelle ohne RLS). Vorbild ist die Migration
`20260804091431_enable_rls`, die RLS erstmals auf allen Tabellen aktiviert hat.

**Warum keine Policies nötig sind:** FarmerZone nutzt die Supabase-Daten-API
nicht (kein `supabase-js`, kein anon-Key, keine `SUPABASE_`-Variablen). Die App
verbindet ausschließlich über Prisma als Rolle `postgres`, die zugleich
Eigentümerin aller Tabellen ist — und der Tabelleneigentümer umgeht RLS.
Aktiviertes RLS ohne Policies sperrt daher genau die richtigen Rollen aus
(`anon`, `authenticated`) und lässt die App unberührt. Policies wären toter
Code, solange die Daten-API ungenutzt bleibt.

**Kein `FORCE ROW LEVEL SECURITY`:** Das würde den Eigentümer-Bypass aufheben
und die App selbst aussperren.

Sobald die Daten-API doch genutzt werden sollte (z. B. Realtime oder ein
Client mit anon-Key), gilt diese Begründung nicht mehr — dann braucht jede
Tabelle echte Policies.

### Umgebungen

| Umgebung | DB | Wer migriert |
|---|---|---|
| Lokal | `farmerzone-dev` (in `.env.local`) | `pnpm db:migrate` manuell |
| Vercel Preview | `farmerzone-dev` (Vercel Env-Var: Preview scope) | automatisch im Build |
| Vercel Production | `farmerzone` Prod-DB (Vercel Env-Var: Production scope) | automatisch im Build |

---

## Checkout und Reservierungen

**Reservierungen buchen keinen Bestand ab.** `Product.stock` sinkt erst beim Kauf. Ein Eintrag in `StockReservation` ist ein weicher Halt: Er zieht die Menge nur von dem ab, was ANDERE Sitzungen sehen. Wenn ein Halt verfällt, gibt es deshalb nichts zurückzubuchen — er hört schlicht auf zu blockieren.

**Die Frist wird beim Lesen durchgesetzt**, nicht vom Cron. Jede Abfrage fremder Halte filtert auf `expiresAt > jetzt`; damit gilt die 15-Minuten-Frist auf die Sekunde genau. `/api/cron/cleanup-reservations` löscht nur noch verfallene Zeilen und ist Aufräumer, nicht die Wahrheit — deshalb schadet es nicht, dass er im Hobby-Tarif einmal täglich läuft.

Die Entscheidung trifft an EINER Stelle `pruefeWarenkorb` (`src/lib/reservierung.ts`, rein und getestet); angewendet wird sie über `src/server/warenkorb.ts` an drei Momenten:

1. beim Laden des Warenkorbs,
2. beim Öffnen des Checkouts (`POST /api/warenkorb/pruefen`),
3. im `POST /api/checkout`, bevor irgendetwas geschrieben wird.

Eine abgelaufene Position wird im Checkout **nie** durchgewunken: Die Antwort trägt `code: RESERVIERUNG_ABGELAUFEN`, den Grund im Klartext und den berichtigten Warenkorb, damit die Kundin sieht, was noch gilt.

**Bestand wird bedingt gebucht:** `updateMany` mit `stock >= Menge` statt blindem `decrement`. Schlägt eine Position fehl, werden die bereits gebuchten wieder gutgeschrieben. Ein blindes Dekrementieren konnte den Bestand ins Minus ziehen, wenn zwei Bestellungen gleichzeitig durch die Prüfung kamen.

**Idempotenz:** Der Browser erzeugt beim Öffnen des Checkouts einen Schlüssel und schickt ihn bei jedem Versuch mit. `Order.idempotencyKey` ist eindeutig; ein zweiter Request mit demselben Schlüssel liefert die bestehende Bestellung. Ein deaktivierter Knopf allein fängt Doppelklick, Zurück-Taste und erneut gesendetes Formular nicht ab.

**Langsames gehört nicht in die Antwort.** Der Mailversand lief synchron im Request und kostete zehn bis fünfzehn Sekunden. Er läuft jetzt über `nachDerAntwort` (`src/lib/nach-der-antwort.ts`, Kapsel um `after()` aus `next/server`). Regel für alles Weitere: Was die Kundin nicht abwarten muss, wartet sie nicht ab — und ein gescheiterter Nachlauf darf nie eine gültige Bestellung zurückrollen.

**Rate-Limit:** `/api/reserve` und `/api/checkout` bremsen je IP **und** je Sitzung (`enforceRateLimit(route, request, sessionId)`). Nur IP wäre zu grob (Mobilfunk-NAT) und zugleich zu schwach, weil eine IP beliebig viele Sitzungen eröffnen kann. Die Zähler leben im Prozess und gelten je Instanz — für den Pilotbetrieb bewusst ausreichend.

---

## Darstellung von Preisen, Mengen und Positionen

`src/lib/format.ts` ist die EINZIGE Quelle. Produktkarte, Warenkorb, Checkout, Bestätigungsseite, Bestätigungs-E-Mail und Bauern-Backend rufen dieselben Funktionen:

- `formatEuro(2.9)` → `€ 2,90` (Symbol vorn, Dezimalkomma; de-AT trennt Tausender mit schmalem Leerzeichen, nicht mit Punkt)
- `formatMenge(6, 'PAKET')` → `6 Pakete`, `formatMenge(2, 'LITER', 0.5)` → `2 × 0,5 L`
- `formatPosition({ name, quantity, unit, unitSize, totalPrice })` → `Tomaten · 2 kg · € 9,98`
- `mitAnzahl(1, 'Produkt', 'Produkte')` → `1 Produkt`

Gebindegrößen werden **offen** gerechnet (`2 × 0,5 L`, nicht `1 L`) — man kauft zwei Flaschen. Neue Ansichten erfinden keine eigene Schreibweise; wenn etwas fehlt, kommt es hier dazu.

---

## Theme (Hell / Dunkel)

Seit dem Dark-Mode-Sprint hat FarmerZone zwei Modi. Die Regeln für neuen Code
stehen in `docs/ai/CODING_STANDARDS.md`, Abschnitt 7. Hier steht, **warum** es so
gebaut ist.

**Wo die Wahl lebt.** `next-themes` schreibt die Klasse `dark` per Inline-Skript
ans `<html>`, bevor der erste Pixel steht — deshalb blitzt nichts hell auf. Die
Wahl liegt im `localStorage` des Geräts, **nicht in der Datenbank**: Sie ist eine
Eigenschaft des Bildschirms, an dem jemand gerade sitzt, nicht des Kontos. Wer am
Traktor-Tablet dunkel will und am Bürorechner hell, bekommt genau das. Der
Umschalter steht unter **Konto → Darstellung** (`settings/account`), bewusst nicht
unter `settings/appearance` — das ist das öffentliche Aussehen des Hofs, eine
ganz andere Sache. Im öffentlichen Bereich gibt es keinen Umschalter; dort
entscheidet das Gerät der Besucherin.

**Warum der Akzent im Dunkeln heller wird.** `--accent` ist bei uns nicht die
dezente Hover-Fläche, die shadcn darunter versteht, sondern das Marken-Orange des
Handlungsknopfs. Im `.dark`-Block stand dafür lange ein Graugrün: Jeder CTA wäre
im Dark Mode farblos gewesen und erst beim Überfahren orange geworden. Der Akzent
ist jetzt in beiden Modi dasselbe Orange; nur der Hover dreht die Richtung — im
Hellen dunkler, im Dunkeln heller, weil er sonst im Hintergrund verschwindet.

**Warum es `--brand-text` gibt.** `--primary` ist die Fläche des Hauptknopfs und
muss im Dunkeln hell werden. Markentext (Wortmarke, Überschriften, Symbole) muss
den umgekehrten Weg gehen. Im hellen Modus sind beide Werte identisch — der
Unterschied entsteht erst nachts.

**Tiefe über Rahmen.** Karte und Grund liegen im Dunkeln nur 1,1:1 auseinander,
ein Schatten ist dort unsichtbar. Deshalb `dark:ring-1 dark:ring-border` statt
stärkerer Schatten.

**Was dem Modus nicht folgt** — und warum:
- **Fotos und Hof-Banner** werden nicht abgedunkelt. Ein Bild vom Hof soll
  aussehen wie der Hof.
- **Kartenkacheln samt Pins** (`hoefe-karte.tsx`): Ein invertiertes Luftbild ist
  keine Karte mehr, und Ortsnamen würden unlesbar. Die Pins sitzen auf diesen
  hellen Kacheln, nicht auf der Seite — sie bleiben deshalb ebenfalls hell.
- **Die Bildmarke**: Ein Logo, das je nach Einstellung anders aussieht, ist kein
  Logo mehr.
- **Die Stripe-Eingabemaske** und der weiße Kasten darum: Stripe rendert das Feld
  in einem eigenen iframe. Die Maske umzustellen wäre eine Änderung am
  Zahlungsweg, nicht am Anstrich.
- **Die Browserleiste auf dem Handy** (`theme-color`) folgt der Systemeinstellung,
  nicht der Wahl im Konto — anders geht es im `<head>` ohne JavaScript nicht.

**Die zweite Palette („Referenz 19").** Hofseite, Produktraster und der ganze
Bauern-Bereich waren nie auf den shadcn-Tokens gebaut, sondern auf einer eigenen,
gewachsenen Palette in Inline-Styles: weichere Kohle statt des fast schwarzen
`--foreground`, ein eigener Seitenton, Sand- und Grün-Chips. Sie steht jetzt als
`--app-*`-Familie in `globals.css`. Die **Tag-Werte sind exakt die bisherigen
Hex-Werte** — das war die Bedingung, unter der sich diese vierzig Dateien
gefahrlos umstellen ließen: Im hellen Modus ändert sich nichts, erst der
`.dark`-Block gibt ihnen eine zweite Lesart.

Die Bauern-Leiste (`--app-bar`) ist in **beiden** Modi dunkelgrün — sie war es
schon am Tag. Ihre Schrift (`--app-bar-ink`, `--app-bar-ink-soft`) steht deshalb
nur in `:root` und wird in `.dark` nicht wiederholt.

**Diagramme (Recharts).** Recharts schreibt Farben als SVG-Attribute; dort greift
keine CSS-Variable. Das Auswertungs-Diagramm hält deshalb zwei Farbsätze und
schaltet in JavaScript über `resolvedTheme` um. Nur der Tooltip kommt ohne aus:
`contentStyle` ist ein React-Style-Objekt, da funktionieren die Tokens direkt.

**Schnellumschalter (2026-09-21).** Die Karte „Darstellung" unter Konto war der einzige
Weg — drei Klicks tief, nur eingeloggt. `src/components/shared/theme-umschalter.tsx`
schaltet mit einem Tipp zwischen Hell und Dunkel, und zwar anhand des gerade
*sichtbaren* Modus (`resolvedTheme`): Wer auf „System" steht und dunkel sieht, bekommt
hell. Danach ist die Wahl fest; zurück zu „System" nur über die Karte, die deshalb
bleibt. Zwei Gestalten, eine Logik: der Symbolknopf (Startseiten-Leiste, Mehr-Sheet)
und die Zeile mit Wort (Seitenleiste). Vor dem Mount ein Platzhalter gleicher Größe —
der Server kennt den Modus nicht. Mobil im Bauern-Bereich sitzt er im Kopf des
Mehr-Sheets (zwei Tipps): Die Tab-Leiste hält ihre Platz-Regel von sechs Zielen; ein
siebtes fiele unter 340 px unter 48 px. Öffentlich trägt ihn nur die Startseite — die
übrigen öffentlichen Seiten haben keinen gemeinsamen Kopf oder Fuß (Header-Sprint).

---

## Produkt-Taxonomie (Sprint Taxonomie 1, 2026-09-22)

Zwei Kategorieebenen, benannte Siegel und die Futtermittel-Kennzeichnung — im
Datenmodell und im Produktformular des Bauern-Bereichs. Die Regeln für neuen Code
stehen in `docs/ai/ARCHITECTURE.md`, Abschnitt 5 („Taxonomie"). Hier steht, warum es
so gebaut ist und was bewusst NICHT passiert ist.

**Öffentliche Seiten sind unverändert.** Kundinnen sehen in diesem Sprint nichts
Neues: keine Unterkategorie auf der Hofseite, keine Siegel-Chips, kein Filter. Die
eine sichtbare Ausnahme ist ein Wort: Die Kategorie HONIG heißt jetzt „Honig &
Bienenprodukte" statt „Honig & Süßes" — weil `src/lib/taxonomie.ts` die einzige
Quelle für Labels ist und die Filterchips auf /hoefe daraus lesen.

**Warum eine Datei für alles.** Vor dem Sprint gab es zwei Zuordnungen je Kategorie
(Labels in `schemas/product.ts`, Illustrations-Dateinamen in `product-image.ts`).
Mit Unterkategorien, Siegeln und Tierarten wären es sechs geworden, die
auseinanderlaufen können. Jetzt ist `taxonomie.ts` die eine Quelle; ein Test hält
ihre Wertlisten deckungsgleich mit den Prisma-Enums. `schemas/product.ts` reicht
`CATEGORY_OPTIONS` nur noch durch, damit /hoefe und die Hofkarte unangetastet
bleiben konnten.

**Warum `isOrganic` bleibt — und trotzdem tot ist.** Die Spalte wird nicht
gelöscht (keine destruktive Migration ohne eigenen Sprint), aber seit der
Migration `20260921100000_taxonomie_1` ist `labels` die Wahrheit: Die Migration
hat jedes `isOrganic = true` nach `labels ∋ BIO` gespiegelt (Dev-DB: 3 von 4
Produkten, alle getroffen). Formular und Server Action schreiben nur noch
`labels`. Die beiden Queries leiten das Boolean `isOrganic`, das die Hofseite und
die Produktliste kennen, aus `labels` ab — sonst hätte das öffentliche Bio-Badge
nach dem ersten Bearbeiten gelogen: neues Bio-Produkt ohne Badge, entferntes Bio
mit Badge. Die Spalte selbst liest damit niemand mehr; ein späterer Sprint
entfernt sie.

**Warum die Unterkategorie fehlen darf.** Alle Bestandsprodukte haben keine. Ein
Pflichtfeld hätte jedes Bearbeiten — auch eine Bestandsänderung — blockiert, bis
der Hof die Taxonomie nachpflegt. Deshalb: kein Fehler, nur ein gestrichelter
Chip „Unterkategorie ergänzen" in der Produktliste und ein Hinweis im Formular.
Einzige Ausnahme sind Futtermittel, weil dort die Art (Einzel-, Misch-,
Ergänzungsfuttermittel) Teil der gesetzlichen Kennzeichnung ist.

**Warum die Futter-Kennzeichnung ein eigenes Modell ist.** Sieben Felder, die nur
eine von zwölf Kategorien braucht, gehören nicht als Nullspalten an jedes Produkt.
`FutterKennzeichnung` ist 1:1, stirbt mit dem Produkt (Cascade), und die
Server Action hält sie in EINER Transaktion mit dem Produkt-Update konsistent:
bei FUTTERMITTEL upsert, sonst deleteMany. Ein Kategoriewechsel weg von
Futtermittel fragt im Formular nach, bevor die Angaben verloren gehen.
`bestaetigtAm` wird bei jedem Speichern neu gestempelt — der Haken ist Pflicht,
also bestätigt der Hof jedes Mal neu.

**Warum ein Accordion, kein Wizard.** Das Formular hatte 17 Felder in einer
Bildschirmhöhe von drei Seiten. Vier Abschnitte (Grunddaten, Preis &
Verfügbarkeit, Details, Kennzeichnung) — beim Anlegen nur der erste offen, beim
Bearbeiten alle zu mit einer Zusammenfassungszeile im Titel („€ 4,90 / kg · 12
auf Lager"). Ein Wizard hätte für eine Preisänderung drei Schritte gekostet.
Validierungsfehler öffnen ihren Abschnitt, markieren den Titel und springen zum
ersten Feld (Muster aus dem Checkout-Fix; Entscheidung in
`produkt-abschnitte.ts`, getestet). Das Accordion selbst ist Base UI
(`src/components/ui/accordion.tsx`), kein neues Paket.

**Bewusst nicht in diesem Sprint:** kein Feld „Reihenfolge" im Formular (die
Reihenfolge wird per Drag & Drop gesetzt, ein Zahlenfeld würde damit
konkurrieren), keine eigene Illustration für Futtermittel (nutzt die Kachel von
Sonstiges), keine dritte Ebene, keine Freitext-Kategorien, keine Änderung an
Hofseite, Produktraster, Chips oder Filtern.

**Migration:** von Hand geschrieben und wiederholbar wie die übrigen; ausgeführt
über `prisma migrate deploy`, weil `migrate dev` an der Supabase-Shadow-Datenbank
scheitert (P3006 bei `enable_rls`) — dasselbe Hindernis wie bei früheren
handgeschriebenen Migrationen.

---

## Bereiche (Sprint Bereiche 1, 2026-09-23)

**Konzept:** `docs/konzepte/bereiche.md` — dort steht das Fachliche vollständig.
Hier steht nur, was umgesetzt ist, was nach Rückfrage anders kam und was offen
bleibt. Die Regeln für neuen Code stehen in `docs/ai/ARCHITECTURE.md` §5.

**Umgesetzt:**
- Futtermittel sind ein eigener Bereich mit vier Kategorien (Heu & Stroh,
  Getreide & Körner, Mischfutter, Ergänzungsfutter) und zehn Sorten. Der
  Bereich ist eine Funktion der Kategorie (`bereichVon` in `taxonomie.ts`),
  keine Spalte.
- Die Futtermittelart nach VO (EG) 767/2009 steht jetzt in der Kennzeichnung
  und ist an die Kategorie gebunden. Dazu Nettomenge je Gebinde und optionale
  Rohwerte. Neue Einheiten Ballen und Big Bag.
- `Product.abgabe` (ALLE / NUR_BETRIEBE); der Checkout zeigt dann den Abschnitt
  „Betrieb" und der Handler verlangt serverseitig Käuferart BETRIEB plus
  Betriebsnummer (400 `BETRIEBSNACHWEIS_FEHLT`).
- `OrderItem.vatRate` als Snapshot, `Order.kaeuferArt` und `Order.betriebsnummer`.
- `mwst.ts` (Vorschlag je Bereich, überall 10 %) und `summenJeSatz` in
  `order-totals.ts` — Letzteres ruft noch niemand auf, es ist Vorbereitung für
  den Steuer-Sprint.
- Produktformular: Kategorie-Sheet (Bereich → Kategorie → Sorte), Kennzeichnung
  mit Futtermittelart, Nettomenge samt vorgerechnetem Kilopreis, Rohwerten und
  Abgabe-Schalter; Dual-Use-Hinweis unter dem Namen (verzögert abgefragt).
- /hoefe zeigt die Futter-Kategorien bis Bereiche 2 nicht in den Chips
  (`HOEFE_KATEGORIEN`, serverseitig). Futterprodukte bleiben über die Hofseite
  erreichbar.

**Nach Rückfrage anders als im ersten Konzeptstand:**
- *F6 — Betriebsnummer gehört dem Hof.* Wer Futter kauft, verkauft meist keines
  und hat gar keine Kennzeichnung. Deshalb `Farm.betriebsnummer` und
  `Farm.betriebsstatus` (Hof-Einstellungen → Profil); `betriebsstatus` ist aus
  der Kennzeichnung gestrichen; `FutterKennzeichnung.registrierungsnummer` ist
  Altlast wie `isOrganic` — nicht mehr geschrieben, nur noch Rückfall beim
  Lesen (`betriebsnummerFuerAnzeige`). Das Konzept ist entsprechend geändert.
- *F2 — Sorte ist Pflicht bei Heu & Stroh und Getreide & Körner.* Ohne Sorte
  gruppiert das Umfeld später nicht, und Heu vs. Stroh ist fachlich kein Detail.
  Misch- und Ergänzungsfutter haben keine Sorten.
- *F7 — Ballen und Big Bags* bietet das Formular bei Futtermitteln UND bei
  Sonstiges an (Brennholz im Big Bag), nicht bei Lebensmitteln. Keine Zod-Regel
  dazu. Ein Big Bag Brennholz hat keine Kennzeichnung, also keinen Grundpreis —
  gewollt.
- *Mindestlänge Betriebsnummer:* 5 Zeichen auch in den Hof-Einstellungen, sonst
  belegte der Checkout eine Nummer vor, die er im nächsten Schritt ablehnt.

**Migration `20260922215748_bereiche_1`.** Futtermittelart und Nettomenge sind
Pflichtangaben vom Sackanhänger; die Migration erfindet sie nicht, sondern bricht
laut ab, wenn beim ersten Lauf Kennzeichnungen existieren. Produktion hatte null
Kennzeichnungen. In Dev wurde vorher die eine Seed-Kennzeichnung (`prod-heu`)
gelöscht, danach Migration und Seed — in dieser Reihenfolge, weil Preview-Builds
`migrate deploy` gegen dieselbe Dev-DB fahren. Backfill `OrderItem.vatRate`: in
Dev 0 Zeilen (keine Bestellungen), in Produktion alle Positionen aus
`Product.vatRate`. Der Rückfall „10 % für Positionen ohne Produkt" aus Konzept §7
steht in der Migration, kann aber nicht greifen: Der Fremdschlüssel
OrderItem→Product ist `ON DELETE RESTRICT`. `prisma migrate diff` meldete danach
„No difference detected" (in Prisma 7 mit `--from-config-datasource --to-schema`;
`--from-url` gibt es nicht mehr).

**Nebenwirkung im Checkout:** Der Handler lädt jetzt die Produkte des Hofs, um
Abgabe und MwSt zu lesen. Eine Position, die nicht zu diesem Hof gehört, geht
deshalb mit 409 `WARENKORB_GEAENDERT` zurück, statt still mitbestellt zu werden.

**Offen:**
- Steuersätze: überall 10 % als Vorschlag. Echte Sätze, `Farm.besteuerung` und
  die käuferabhängige Rechnung kommen im Steuer-Sprint mit Steuerberater.
- Cleanup frühestens vier Wochen nach dem Merge: Enum-Werte `FUTTERMITTEL`,
  `EINZELFUTTERMITTEL`, `MISCHFUTTERMITTEL`, `ERGAENZUNGSFUTTERMITTEL`, Spalten
  `FutterKennzeichnung.registrierungsnummer` und `Product.isOrganic`.
- Bereiche 2: Umschalter und Facetten auf /hoefe, Hofseite nach Bereich
  sektioniert, Produktdetail mit Akkordeon „Kennzeichnung" (dort liest
  `betriebsnummerFuerAnzeige` die Nummer).
- Befund außerhalb dieses Sprints: `/api/checkout` übernimmt `unitPrice` aus dem
  Request, ohne ihn mit `Product.price` abzugleichen. Eigene Aufgabe (`/fix`).

---

## Preis-Semantik: Preis je Gebinde (Sprint Preis-Semantik, 2026-09-22)

**Die Fachregel:** `price` ist der Preis je Gebinde, `unitSize` die Gebindegröße,
der Warenkorb rechnet `price × Anzahl`. Ein Produkt mit Preis 50 und Gebindegröße
2 kg kostet 50 Euro für das ganze Paket, nicht 50 Euro je Kilo. Daran ändert
dieser Sprint nichts — weder am Schema noch an der Rechnung.

**Der Befund:** Das Formular sagte das nirgends. „Preis (€)" stand über „Menge je
Einheit"; ein Hof trug den Kilopreis ein, meinte 50 €/kg und speicherte 50 € je
2-kg-Gebinde. Die Karte zeigte „€ 50,00 / 2 kg", und der Schrägstrich las sich als
„pro". In der Dev-Datenbank steht genau so ein Produkt.

**Was sich geändert hat, und warum so:**
- Die Anzeige schreibt mit Gebinde jetzt „€ 50,00 für 2 kg"; ohne Gebinde bleibt
  „€ 3,50 / kg". Darunter steht überall, wo Kundinnen oder der Hof Preise sehen
  (Produktkarte, Hofübersicht, Warenkorb, Checkout, Bauern-Produktliste), die
  Grundpreis-Zeile „€ 25,00 / kg" — kleiner, Sekundärfarbe. Bei Stück und Paket
  entfällt sie, weil „€ 0,60 / Stück" für ein 6er-Pack Eier mehr verwirrt als
  hilft. Die Rechnung dafür ist `grundpreisJeEinheit` in `format.ts`: reine
  Anzeige, auf Cent gerundet, nie Grundlage einer Abrechnung.
- Das Formular fragt in der Reihenfolge Einheit → Gebindegröße → Preis, weil das
  Preisfeld je nach Gebinde anders heißt: „Preis je kg" oder „Preis für das
  2-kg-Paket". Darunter eine Live-Vorschau: „Kunden sehen: € 50,00 für 2 kg ·
  € 25,00 / kg". Die Entscheidungen liegen in
  `src/components/products/produkt-preis.ts`, rein und getestet.
- **Die Rückfrage „Ist das der Preis für das ganze Paket?"** ist ein Hinweis,
  kein Fehler. Die beauftragte Regel „Gebindegröße > 1 und Preis ≤ Vorschau-
  Kilopreis × 1,2" kann nie wahr werden, weil der Vorschau-Kilopreis der Preis
  geteilt durch die Gebindegröße ist. Umgesetzt ist deshalb die Absicht dahinter:
  Referenz ist der Preis, der im Feld stand, BEVOR die Gebindegröße über 1
  gesetzt wurde — mutmaßlich ein Preis je Einheit. Bleibt der Preis danach in
  dessen Nähe (bis 20 % darüber), kommt die Rückfrage samt Rechnung. Ohne
  Referenz (Bestandsprodukt, das schon mit Gebinde gespeichert war) gibt es
  keine Rückfrage — was der Hof damals meinte, wissen wir nicht.
- `formatPrice` aus `preis-format.ts` ist nach `format.ts` gewandert; die
  Bauern-Produktliste hatte noch ein drittes, eigenes Preisformat — weg. Übrig in
  `preis-format.ts` ist nur `formatEuro` mit dem Symbol hinten (Altlast, siehe
  `docs/ai/ARCHITECTURE.md`).

**Bestandsdaten mit Gebindegröße > 1** (nur gelesen, nicht geändert — der
Betreiber fragt die Höfe, was gemeint war): Dev-Datenbank 3 Produkte, Produktion 2
Produkte; die Namen stehen im PR.

### Produktformular Feinschliff (2026-09-22)

**Dezimaleingabe.** `type="number"` verwarf das Komma je nach Browser still —
„5,99" wurde zu 599 oder zu nichts. Preis, Gebindegröße und MwSt sind jetzt
Textfelder mit `inputMode="decimal"` (`src/components/shared/dezimal-feld.tsx`):
Komma UND Punkt gelten als Dezimaltrenner (`parseDezimal` in `format.ts`),
Leerzeichen werden entfernt, beim Verlassen wird deutsch formatiert. Ein
Tausenderpunkt wird abgelehnt, weil „1.500" zweideutig ist — mit einer Ausnahme:
„0,125" hat auch drei Stellen, ist aber kein Tausender, und 125 g Gebinde müssen
möglich bleiben. Das Zod-Schema parst denselben Weg (`z.preprocess`), Preis auf
zwei, Gebindegröße auf drei Nachkommastellen begrenzt. Das Feld hält den
Rohtext im State, ohne Effekt: Der Entwurf gilt nur, solange er zum Wert des
Formulars passt; setzt jemand den Wert von außen („Nein, das ist der Preis je
kg"), zeigt das Feld ihn formatiert. „Rohwerte der Kennzeichnung" gibt es nicht
als Zahlfelder — die analytischen Bestandteile sind Freitext, dort bleibt es.

**Gebinde und Saison hinter Schaltern.** Beide Felder sind Sonderfälle; ein
Schalter („Ich verkaufe in festen Paketen", „Nur saisonal verfügbar") sagt es
und blendet die Felder erst dann ein. Aus heißt leer (`unitSize`, `seasonStart`,
`seasonEnd` = null). Beim Einschalten der Saison ist Von/Bis mit aktuellem Monat
bis Monat + 2 vorbelegt (`saisonVorbelegung`, über den Jahreswechsel) — es gibt
keinen leeren Zustand und keinen Wert 0 mehr. Beim Bearbeiten steht der
Schalter auf An, wenn der Wert gesetzt ist. Der Schalter selbst ist Base UI
(`src/components/ui/switch.tsx`), auch für „Im Shop verfügbar".

**Bestand mit Einheit.** „Bestand (kg)" bzw. „Bestand (Pakete) = 20 kg"
(`bestandLabel`, `formatBestand`) — bei Stück und Paket ohne Umrechnung, weil
„6er-Pack × 30 = 180 Pakete" nichts sagt.

**MwSt nach Details.** Der Satz gehört nicht zum täglichen Preis-Handgriff.
Unter dem Feld steht „Standard: 10 %" — es gibt keinen Satz je Kategorie, der
Standard ist der Schema-Default `MWST_STANDARD`. Die Zusammenfassung von
„Details" nennt den Satz nur, wenn er davon abweicht.

**Rückfrage mit Antworten.** Statt eines Textes zwei Knöpfe: „Ja, das Paket
kostet € 50,00" lässt alles stehen; „Nein, € 50,00 ist der Preis je kg" trägt
Einheitspreis × Gebinde ein (`paketpreisAntworten`). Beides beendet die
Rückfrage für diese Eingabe; die Rechnung steht ohnehin in „Kunden sehen".

**Knöpfe unten fest**, Hintergrund `card`, feine Linie oben, Abstand für die
Safe-Area am Handy. Der erste Wurf klebte mitten im Dialog und ragte über die
Kante: `DialogFooter` bringt negative Ränder (`-mx-6 -mb-6`) mit, die bei `p-0`
über den Rand laufen, und dem Scrollbereich fehlte `min-h-0` — ohne das wächst
ein Flex-Kind auf Inhaltshöhe, der ganze Dialog scrollt, und ein `sticky`-Fuß
hängt irgendwo dazwischen. Jetzt: drei Flex-Zonen (Kopf, Inhalt mit `min-h-0`
und `overflow-y-auto`, Fuß als eigenes Div ohne Rand-Tricks), `overflow-hidden`
am Dialog. Merksatz für neue Dialoge mit Scrollinhalt: **`min-h-0` auf den
scrollenden Flex-Kindern, kein `DialogFooter` bei `p-0`.** Der Preis zeigt beim
Verlassen immer zwei Stellen („1,00", `formatDezimal`).

**Gebindegröße sprang beim Bearbeiten zurück (reproduziert).** Das Feld gab bei
leerem Zwischenstand `undefined` weiter, und react-hook-form liest `undefined`
als „Ausgangswert wiederherstellen": Bei einem Bestandsprodukt mit Gebinde 1
wurde aus dem Tippen von „0,5" die Folge „1" → „15". Neue Produkte (Ausgangswert
leer) zeigten es nicht, der Preis auch nicht, weil er leer als `NaN` übergibt.
Seitdem gilt im Formular: **Leer ist `null`, nie `undefined`** — für
Gebindegröße, Saison-Monate und die Kennzeichnung gleichermaßen, im Schema
(`.nullable()`), in den Defaults und beim Umschalten. Die Regel steht in
`docs/ai/CODING_STANDARDS.md`, Abschnitt 8.

---

## Upload-Diagnose

Jede Upload-Fehlermeldung endet auf eine Kennung wie `[L71]` — Buchstabe für die Ursache, Zahl für den Code-Stand (`UPLOAD_DIAG` in `src/lib/upload-fehler.ts`). Bei JEDER Verhaltensänderung am Upload-Ablauf muss die Zahl auf die Nummer des Sprints gehoben werden — eine veraltete Kennung ist schlimmer als keine, weil ein zugeschicktes Bildschirmfoto dann den falschen Stand behauptet.

---

## Triage (Fehlerbriefkasten)

Höfe und Kundinnen melden Fehler, Wünsche und Fragen in der App (`/fehler-melden`, „Problem melden" in den Fußzeilen). Die Meldungen landen in der Tabelle `Meldung`; der Betreiber sichtet sie unter `/admin/meldungen`, das Lese-CLI liefert sie als Markdown: `pnpm briefkasten export` (nur lesend — das Skript kann keinen Status setzen).

**Welche Variable wohin gehört:**

| Variable | Vercel | `.env.local` | wofür |
| --- | --- | --- | --- |
| `TRIAGE_TOKEN` | **ja** | **ja**, derselbe Wert | schützt die Leseroute; die App prüft ihn, das CLI schickt ihn |
| `TRIAGE_EXPORT_URL` | nein | ja | sagt dem CLI, wo die Leseroute liegt |
| `TRIAGE_DATABASE_URL` | nein | nur für den Datenbank-Weg | Nur-Lese-Verbindung des CLI |

**Zugang des CLI — zwei Wege:**

1. **Leseroute (empfohlen):** `TRIAGE_EXPORT_URL="https://<app>/api/triage/export"` und `TRIAGE_TOKEN="<Token>"` in `.env.local`, **denselben** `TRIAGE_TOKEN` zusätzlich in Vercel (`openssl rand -hex 24`) — fehlt er dort, antwortet die Route immer 401. Die App erzeugt den Export selbst und liefert ihn über `GET /api/triage/export` aus: `Authorization: Bearer <TRIAGE_TOKEN>`, Vergleich in konstanter Zeit, 10 Aufrufe je Minute und IP, `Cache-Control: no-store`, ausschließlich GET (kein Schreibpfad). Braucht keinen Datenbankzugang — das ist der Weg für Umgebungen, in denen der Supabase-Pooler die Leserolle nicht kennt oder die Direktverbindung nur über IPv6 geht. Über die Route gibt es `export` und `show`; `list` bleibt dem Datenbank-Weg vorbehalten.
2. **Datenbankrolle (Alternative bei Direktzugang):** `TRIAGE_DATABASE_URL="postgresql://triage_leser:…"` in `.env.local`, eine Rolle mit nichts als SELECT. Alle drei Befehle. Die Rolle wird einmalig im SQL-Editor angelegt:

   ```sql
   CREATE ROLE triage_leser LOGIN PASSWORD '<starkes-passwort>' NOINHERIT;
   GRANT CONNECT ON DATABASE postgres TO triage_leser;
   GRANT USAGE ON SCHEMA public TO triage_leser;
   GRANT SELECT ON TABLE public."Meldung", public."Farm" TO triage_leser;
   -- RLS ist auf allen Tabellen aktiv, aber ohne Policies — ohne die beiden
   -- folgenden Zeilen sähe eine fremde Rolle null Zeilen.
   CREATE POLICY triage_leser_lesen ON public."Meldung" FOR SELECT TO triage_leser USING (true);
   CREATE POLICY triage_leser_lesen ON public."Farm"    FOR SELECT TO triage_leser USING (true);
   ```

   Gegenprobe: ein `UPDATE "Meldung" …` als `triage_leser` muss mit `permission denied` scheitern.

Sind beide konfiguriert, nimmt das CLI die Leseroute. Fehlt beides, nennt es die zwei Varianten — es fällt nie auf `DATABASE_URL` zurück.

**Grundsatz:** Der Briefkasten ist ein Eingangskanal, kein Befehlskanal. Aus Meldungen entstehen Vorschläge; entscheiden und mergen tut ausschließlich der Betreiber.

Regeln für die Sichtung:

- **Fehler** = Abweichung vom *beabsichtigten* Verhalten. Referenz dafür sind die Sprint-Prompts und die PR-Berichte — nicht die Erwartung der meldenden Person. „Ich hätte erwartet, dass …" ist ein Wunsch oder eine Frage, kein Fehler.
- **Wünsche** werden gebündelt (`clusterKey`) und gezählt (Reiter „Wünsche"), nie zu Prompts. Die gezählte Liste ist Grundlage einer Produktentscheidung, nicht ihr Ersatz.
- **Ein einzelner, nicht reproduzierbarer Bericht ist ein Signal, kein Auftrag.** Status `GEPRUEFT`, Notiz, abwarten, ob es sich wiederholt.
- **Prompts entstehen nur**, wenn der Fehler im Code reproduzierbar ist ODER ein kritischer Pfad betroffen ist (Bezahlung, Bestellung, Upload) — dann auch ohne Reproduktion, aber mit dem Hinweis, dass die Reproduktion Teil des Sprints ist.
- Status-Bedeutung für den Hof: NEU „Eingegangen", GEPRUEFT „In Prüfung", GEPLANT „Geplant", ERLEDIGT „Erledigt", KEIN_FEHLER „Geprüft — funktioniert wie vorgesehen", DUPLIKAT „Bereits bekannt". Interne Notizen sieht der Hof nie, `antwortAnMelder` schon.
- Aufbewahrung: erledigte Meldungen (ERLEDIGT, KEIN_FEHLER, DUPLIKAT) löscht der Wochenlauf (`/api/cron/briefkasten`, montags) 90 Tage nach der Triage samt Screenshot.

---

## Umgebungen: Produktion, Preview, lokal

Seit dem Sprint `fix/testumgebung` (2026-09-21) entscheidet **eine** Stelle, wo die
App läuft: `src/lib/umgebung.ts` (rein, getestet) und ihr Serverzweig
`src/lib/umgebung-server.ts`.

**Warum:** In Vercel-Previews waren `NEXT_PUBLIC_APP_URL` und `BETTER_AUTH_URL`
nicht gesetzt (nur Production). Auth und Auth-Client fielen dort auf
`http://localhost:3000` zurück — der Browser der Testerin rief einen fremden
Rechner an, der Login war unmöglich. Und keine Preview war als Preview erkennbar.

**Erkennung, fail-closed Richtung Produktion:** `preview` nur bei `VERCEL_ENV=preview`,
`lokal` nur bei `NODE_ENV=development`, alles andere — auch Unbekanntes — ist
`produktion`. Ein Testbanner vor Kundinnen wäre der teurere Fehler als ein fehlendes
im Test. (`ermittleUmgebung` in `sentry-hygiene.ts` entscheidet für Sentry bewusst
andersherum: dort ist Rauschen in der Produktions-Ansicht der teurere Fehler.)

**Adresse und vertraute Herkünfte je Umgebung:**

| Umgebung | `appUrl` / `trustedOrigins` |
|---|---|
| produktion | nur `NEXT_PUBLIC_APP_URL`; fehlt sie: **kein** Ersatz |
| preview | `https://<VERCEL_BRANCH_URL>` (stabil je Branch, darum die Link-Adresse) und `https://<VERCEL_URL>` |
| lokal | `http://localhost:3000` |

Nie ein Platzhalter wie `*.vercel.app` — Better Auth könnte ihn, wir wollen ihn nicht.
Der Auth-**Client** hat gar keine `baseURL` mehr: Laut Better-Auth-Doku darf sie
entfallen, wenn Auth-Server und Seite dieselbe Domain haben — und das ist hier immer so.

**Anschlüsse:** `datenbank` ist `dev` nur per Allowlist (localhost oder die Referenz der
Dev-Datenbank — im Host **oder** im Benutzernamen, denn beim Supabase-Pooler steht sie
nur dort); `stripe` kommt aus dem Präfix des Schlüssels (`sk_test_` / `sk_live_`).
Widersprüche werden zu deutschen Warnsätzen: Preview mit fremder DB oder Stripe live,
Produktion mit Dev-DB oder Stripe test, Preview ohne Vercel-Adresse.

**Sichtbar machen:** In preview und lokal steht ein Balken über jeder Seite
(`src/components/shared/umgebungs-banner.tsx`, Server-Komponente, im Fluss, nicht
klebend, feste Farben: Bernstein, bei Warnung Rot), jeder Tab-Titel trägt `[TEST] `
(Titel-Vorlage im Root-Layout, keine Seite einzeln angefasst) und die Browserleiste am
Handy ist Bernstein bzw. Rot. In Produktion **nie** ein Banner — Widersprüche gehen dort
einmal je Kaltstart als Warnung an Sentry.

**Was Vercel dafür liefern muss:** `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`,
`VERCEL_GIT_COMMIT_REF` — das sind Systemvariablen, die nur ankommen, wenn im Projekt
„Automatically expose System Environment Variables" aktiv ist. Ohne sie zählt eine
Preview als Produktion: kein Banner, kein Login-Fix.

**Nicht mitgenommen:** Der Seed prüft noch nicht über `istDevDatenbank`, ob er gegen
die Dev-Datenbank läuft — die Funktion ist dafür exportiert. Previews versenden weiter
keine Mails (`RESEND_API_KEY` nur in Production), das ist gewollt.

---

## Nützliche Befehle

```bash
pnpm dev              # Dev-Server starten
pnpm db:migrate       # Schema-Änderung: Migrationsdatei erzeugen + Dev-DB aktualisieren
pnpm db:seed          # Testdaten laden (nur Dev-DB)
pnpm db:studio        # Prisma Studio öffnen
pnpm db:generate      # Prisma Client generieren
pnpm briefkasten export   # Briefkasten als Markdown (nur lesend; Leseroute oder TRIAGE_DATABASE_URL)
```

---

---

## Prisma 7 Besonderheiten (wichtig für weitere Entwicklung)

- Kein `url` im `schema.prisma` — stattdessen `prisma.config.ts` im Root
- Adapter-Klasse heißt `PrismaPg` (nicht `PrismaPostgres`)
- Alle Prisma-Scripts via `dotenv -e .env.local --` prefixen
- `PrismaClient` braucht zwingend `{ adapter }` im Konstruktor

---

*Zuletzt aktualisiert: 2026-09-22 — Stand nach Taxonomie 1 (#100) und Preis-Semantik (#101)*
