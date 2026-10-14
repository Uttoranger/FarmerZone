-- Postfach, Stufe 1 (Register N12, Nachtlauf Nr. 87; Freigabe: „Migration
-- (Expand, eine Datei): Rundschreiben, Unterhaltung, Nachricht,
-- UnterhaltungStand … Nichts an bestehenden Tabellen"). Dazu die Spalte
-- Unterhaltung.letzteMailAm für „höchstens eine E-Mail je Faden und Stunde".
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main-87.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main-87.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: drei CREATE TYPE, vier CREATE TABLE, vier CREATE INDEX, vier
-- Fremdschlüssel — unverändert übernommen, ergänzt um IF NOT EXISTS bzw.
-- DO-Blöcke (wiederholbar: Prisma fährt eine Migration nicht in einer
-- Transaktion), lock_timeout und RLS.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): neue Typen, neue Tabellen, Indizes
-- und Fremdschlüssel auf den neuen Tabellen. Kein DROP, kein RENAME, kein
-- ALTER COLUMN, kein UPDATE, kein Backfill; keine bestehende Tabelle bekommt
-- eine Spalte. Der Fremdschlüssel auf "Farm" sperrt "Farm" nur kurz (die neue
-- Tabelle ist leer, die Prüfung sofort fertig) — lock_timeout begrenzt das.
-- DEPLOY-FENSTER: Alter Code kennt die Tabellen nicht und läuft unverändert;
-- Höfe löscht nur der Admin, das Cascade von "Unterhaltung" greift dann mit.
--
-- INDEX JE FREMDSCHLÜSSEL: Unterhaltung.farmId (vorn in zwei Indizes),
-- Unterhaltung.rundschreibenId (eigener Index), Nachricht.unterhaltungId (vorn
-- in (unterhaltungId, createdAt)), UnterhaltungStand.unterhaltungId (vorn im
-- Primärschlüssel). Nachricht.vonFarmId und Rundschreiben.erstelltVonUserId
-- sind bewusst keine Fremdschlüssel (prisma/schema.prisma).
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls) —
-- ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RundschreibenArt" AS ENUM ('INFO', 'WICHTIG');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NachrichtArt" AS ENUM ('NORMAL', 'WICHTIG', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UnterhaltungSeite" AS ENUM ('HOF', 'TEAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Rundschreiben" (
    "id" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "linkUrl" TEXT,
    "art" "RundschreibenArt" NOT NULL,
    "perMail" BOOLEAN NOT NULL DEFAULT false,
    "empfaengerRegel" JSONB NOT NULL,
    "empfaenger" INTEGER NOT NULL,
    "gesendetAm" TIMESTAMP(3) NOT NULL,
    "erstelltVonUserId" TEXT NOT NULL,

    CONSTRAINT "Rundschreiben_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Unterhaltung" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "rundschreibenId" TEXT,
    "letzteNachrichtAm" TIMESTAMP(3) NOT NULL,
    "letzteMailAm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unterhaltung_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Nachricht" (
    "id" TEXT NOT NULL,
    "unterhaltungId" TEXT NOT NULL,
    "vonFarmId" TEXT,
    "text" TEXT NOT NULL,
    "linkUrl" TEXT,
    "art" "NachrichtArt" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nachricht_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UnterhaltungStand" (
    "unterhaltungId" TEXT NOT NULL,
    "seite" "UnterhaltungSeite" NOT NULL,
    "gelesenBis" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnterhaltungStand_pkey" PRIMARY KEY ("unterhaltungId","seite")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Unterhaltung_farmId_letzteNachrichtAm_idx" ON "Unterhaltung"("farmId", "letzteNachrichtAm");

CREATE INDEX IF NOT EXISTS "Unterhaltung_rundschreibenId_idx" ON "Unterhaltung"("rundschreibenId");

CREATE UNIQUE INDEX IF NOT EXISTS "Unterhaltung_farmId_rundschreibenId_key" ON "Unterhaltung"("farmId", "rundschreibenId");

CREATE INDEX IF NOT EXISTS "Nachricht_unterhaltungId_createdAt_idx" ON "Nachricht"("unterhaltungId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Unterhaltung" ADD CONSTRAINT "Unterhaltung_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Unterhaltung" ADD CONSTRAINT "Unterhaltung_rundschreibenId_fkey" FOREIGN KEY ("rundschreibenId") REFERENCES "Rundschreiben"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Nachricht" ADD CONSTRAINT "Nachricht_unterhaltungId_fkey" FOREIGN KEY ("unterhaltungId") REFERENCES "Unterhaltung"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UnterhaltungStand" ADD CONSTRAINT "UnterhaltungStand_unterhaltungId_fkey" FOREIGN KEY ("unterhaltungId") REFERENCES "Unterhaltung"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS
ALTER TABLE "public"."Rundschreiben" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Unterhaltung" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Nachricht" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UnterhaltungStand" ENABLE ROW LEVEL SECURITY;
