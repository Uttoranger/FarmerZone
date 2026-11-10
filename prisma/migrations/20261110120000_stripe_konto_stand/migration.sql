-- Stripe-Kontostatus (Auftrag A012): zwei Spalten auf "Farm" — der grobe
-- Stand des Stripe-Kontos (nur Werte aus STRIPE_KONTO_STAENDE in
-- src/lib/stripe-konto.ts) und wann er bei Stripe gelesen wurde.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main-a012.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main-a012.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe unverändert übernommen, ergänzt um IF NOT EXISTS (wiederholbar:
-- Prisma fährt eine Migration nicht in einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): zwei nullbare Spalten ohne Default,
-- kein DROP, kein RENAME, keine Typänderung, keine Datenänderung, kein
-- Backfill — der Bestand bleibt NULL, bis ein Schreiber das Konto neu liest.
-- DEPLOY-FENSTER: Alter Code kennt die Spalten nicht, liest und schreibt
-- unverändert.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "stripeKontoGelesenAm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "stripeKontoStand" TEXT;
