-- Startseite gestalten (Register N16, Nachtlauf Nr. 96; Freigabe §18:
-- „Migration (Expand + Seed): die zwei Tabellen aus N16; Seed-SQL legt die
-- acht festen Abschnitte in der heutigen Reihenfolge an").
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show HEAD:prisma/schema.prisma > <scratchpad>/schema-vor-96.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-96.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: zwei CREATE TYPE, zwei CREATE TABLE, ein CREATE UNIQUE INDEX, ein
-- Fremdschlüssel — unverändert übernommen, ergänzt um IF NOT EXISTS bzw.
-- DO-Blöcke (wiederholbar: Prisma fährt eine Migration nicht in einer
-- Transaktion), lock_timeout, RLS und die acht Seed-Zeilen.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): neue Typen, neue Tabellen, ein Index
-- und ein Fremdschlüssel zwischen den beiden neuen Tabellen. Kein DROP, kein
-- RENAME, kein ALTER COLUMN, keine bestehende Tabelle bekommt eine Spalte.
-- DEPLOY-FENSTER: Alter Code kennt die Tabellen nicht und rendert die
-- Startseite wie bisher; neuer Code ohne Zeilen rendert die heutige
-- Reihenfolge (src/lib/startseite-gestalten.ts, STANDARD_ABSCHNITTE).
--
-- INDEX JE FREMDSCHLÜSSEL: StartseiteAbschnitt.blockId (eindeutig, 1:1 zum
-- Block). StartseiteBlock.farmIds und erstelltVonUserId sind bewusst keine
-- Fremdschlüssel (prisma/schema.prisma). kategorie nutzt den vorhandenen Typ
-- "ProductCategory".
--
-- SEED: die acht festen Abschnitte mit festen Kennungen in der heutigen
-- Reihenfolge (KOPF, HOEFE, FUTTER, BRENNMATERIAL, SO_FUNKTIONIERTS,
-- FUER_HOEFE, FRAGEN, FUSS), alle sichtbar. ON CONFLICT: Eine wiederholte
-- Migration lässt eine schon geänderte Zeile stehen.
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls) —
-- ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StartseiteArt" AS ENUM ('KOPF', 'HOEFE', 'FUTTER', 'BRENNMATERIAL', 'SO_FUNKTIONIERTS', 'FUER_HOEFE', 'FRAGEN', 'FUSS', 'BLOCK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StartseiteVorlage" AS ENUM ('SAISONKARTE', 'HINWEISBAND', 'HOEFE_AUSWAHL', 'KATEGORIE_HINWEIS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StartseiteAbschnitt" (
    "id" TEXT NOT NULL,
    "art" "StartseiteArt" NOT NULL,
    "position" INTEGER NOT NULL,
    "sichtbar" BOOLEAN NOT NULL DEFAULT true,
    "blockId" TEXT,

    CONSTRAINT "StartseiteAbschnitt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StartseiteBlock" (
    "id" TEXT NOT NULL,
    "vorlage" "StartseiteVorlage" NOT NULL,
    "ueberzeile" TEXT,
    "titel" TEXT NOT NULL,
    "text" TEXT,
    "bildUrl" TEXT,
    "linkUrl" TEXT,
    "linkText" TEXT,
    "farmIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kategorie" "ProductCategory",
    "liveAb" TIMESTAMP(3) NOT NULL,
    "liveBis" TIMESTAMP(3),
    "erstelltVonUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StartseiteBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StartseiteAbschnitt_blockId_key" ON "StartseiteAbschnitt"("blockId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StartseiteAbschnitt" ADD CONSTRAINT "StartseiteAbschnitt_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "StartseiteBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: die acht festen Abschnitte in der heutigen Reihenfolge
INSERT INTO "StartseiteAbschnitt" ("id", "art", "position", "sichtbar") VALUES
  ('startseite-kopf', 'KOPF', 0, true),
  ('startseite-hoefe', 'HOEFE', 1, true),
  ('startseite-futter', 'FUTTER', 2, true),
  ('startseite-brennmaterial', 'BRENNMATERIAL', 3, true),
  ('startseite-so-funktionierts', 'SO_FUNKTIONIERTS', 4, true),
  ('startseite-fuer-hoefe', 'FUER_HOEFE', 5, true),
  ('startseite-fragen', 'FRAGEN', 6, true),
  ('startseite-fuss', 'FUSS', 7, true)
ON CONFLICT ("id") DO NOTHING;

-- RLS
ALTER TABLE "public"."StartseiteAbschnitt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StartseiteBlock" ENABLE ROW LEVEL SECURITY;
