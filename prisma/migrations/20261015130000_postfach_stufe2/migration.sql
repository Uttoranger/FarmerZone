-- Postfach, Stufe 2 (Register N12-Änderung und N14, Nachtlauf Nr. 95;
-- Freigabe §18: „Migration (Expand): Rundschreiben.antwortMoeglich Boolean
-- @default(true), Order.erstattungOffenSeit DateTime? (Index),
-- BetreiberEmpfaenger { … }"). Die Zustellregeln liegen als Json in
-- PlattformEinstellung.zustellRegeln (Nr. 93) — dafür keine Änderung.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show HEAD:prisma/schema.prisma > <scratchpad>/schema-vor-95.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-95.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: zwei ADD COLUMN, ein CREATE TABLE, drei CREATE INDEX —
-- unverändert übernommen, ergänzt um IF NOT EXISTS (wiederholbar: Prisma
-- fährt eine Migration nicht in einer Transaktion), lock_timeout und RLS.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine Spalte mit Default
-- (antwortMoeglich, Bestand = true: jedes alte Rundschreiben bleibt
-- beantwortbar), eine nullable Spalte samt Index (erstattungOffenSeit, kein
-- Backfill: offene Erstattungen von vorher stehen nur in Mail und Sentry),
-- eine neue Tabelle ohne Fremdschlüssel. Kein DROP, kein RENAME, kein ALTER
-- COLUMN, kein UPDATE. DEPLOY-FENSTER: Alter Code kennt die Spalten und die
-- Tabelle nicht und läuft unverändert; ein Rundschreiben, das alter Code
-- anlegt, bekommt den Default true.
--
-- Der Index auf "Order" sperrt Schreibzugriffe nur, solange er gebaut wird
-- (eine Pilot-Tabelle, Sekundenbruchteile) — lock_timeout begrenzt das Warten
-- auf die Sperre.
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls) —
-- ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "erstattungOffenSeit" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Rundschreiben" ADD COLUMN IF NOT EXISTS "antwortMoeglich" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "BetreiberEmpfaenger" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bestaetigtAm" TIMESTAMP(3),
    "token" TEXT,
    "tokenBis" TIMESTAMP(3),
    "erstelltVonUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetreiberEmpfaenger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BetreiberEmpfaenger_email_key" ON "BetreiberEmpfaenger"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BetreiberEmpfaenger_token_key" ON "BetreiberEmpfaenger"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_erstattungOffenSeit_idx" ON "Order"("erstattungOffenSeit");

-- RLS
ALTER TABLE "public"."BetreiberEmpfaenger" ENABLE ROW LEVEL SECURITY;
