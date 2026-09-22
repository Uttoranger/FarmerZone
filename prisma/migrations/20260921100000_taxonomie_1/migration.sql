-- Sprint Taxonomie 1: zweite Kategorieebene, benannte Siegel, Futtermittel.
--
-- WAS: Neue Kategorie FUTTERMITTEL (vor BRENNHOLZ), drei neue Enums
-- (ProductSubcategory, ProductLabel, Tierart), zwei neue Spalten an "Product"
-- (subcategory, labels), eine neue 1:1-Tabelle "FutterKennzeichnung" und die
-- Spiegelung isOrganic = true → labels enthält BIO.
--
-- NICHT DESTRUKTIV: "isOrganic" bleibt bestehen. Die Spalte wird ab diesem
-- Stand nur noch gelesen, nie mehr geschrieben; ein späterer Sprint entfernt
-- sie, sobald alle Lesestellen auf labels umgestellt sind.
--
-- WIEDERHOLBAR GESCHRIEBEN wie die übrigen Migrationen des Repos: Prisma fährt
-- eine Migration NICHT in einer Transaktion. Bricht sie in der Mitte ab,
-- bleibt das bereits Ausgeführte stehen — deshalb `IF NOT EXISTS` bzw. der
-- DO-Block für CREATE TYPE (das kennt kein IF NOT EXISTS).
--
-- ENUM-REIHENFOLGE: FUTTERMITTEL steht bewusst VOR BRENNHOLZ, weil die
-- Enum-Reihenfolge Schema, Wertliste und Formular spiegelt (Vorbild
-- 20260903142727_kategorie_fisch). Der neue Wert wird in dieser Migration
-- NICHT verwendet (nur hinzugefügt) — PostgreSQL verbietet sonst die Nutzung
-- in derselben Transaktion. Die Spiegelung unten nutzt nur ProductLabel, und
-- das ist ein hier neu ANGELEGTER Typ, für den die Einschränkung nicht gilt.
--
-- SPERREN: ADD VALUE nimmt ein kurzes Schloss auf dem Typ. ADD COLUMN mit
-- konstantem Vorgabewert ist seit PostgreSQL 11 eine Katalogänderung ohne
-- Tabellen-Rewrite. Das UPDATE der Spiegelung fasst nur Zeilen mit
-- isOrganic = true an — beim Pilotbetrieb eine Handvoll.
--
-- RLS: Neue Tabelle → in derselben Migration aktivieren (DEVELOPMENT.md,
-- „Neue Tabellen: RLS nicht vergessen"). Keine Policies nötig — die App
-- verbindet als Tabelleneigentümerin und umgeht RLS.
SET lock_timeout = '5s';

-- AlterEnum
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'FUTTERMITTEL' BEFORE 'BRENNHOLZ';

-- CreateEnum (wiederholbar)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductSubcategory') THEN
    CREATE TYPE "ProductSubcategory" AS ENUM (
      'RIND', 'SCHWEIN', 'HAEHNCHEN', 'PUTE', 'LAMM', 'WILD', 'WURST',
      'EIER_BIO', 'EIER_FREILAND', 'EIER_BODENHALTUNG',
      'TRINKMILCH', 'KAESE', 'JOGHURT_TOPFEN', 'BUTTER',
      'ERDAEPFEL', 'WURZELGEMUESE', 'BLATT_SALAT', 'KOHL', 'FRUCHTGEMUESE',
      'KUERBIS', 'ZWIEBEL_LAUCH', 'KRAEUTER', 'EINGELEGT',
      'KERNOBST', 'STEINOBST', 'BEEREN', 'NUESSE', 'EINGEKOCHT_GETROCKNET',
      'BLUETENHONIG', 'WALDHONIG', 'SORTENHONIG', 'BIENENPRODUKTE',
      'EINZELFUTTERMITTEL', 'MISCHFUTTERMITTEL', 'ERGAENZUNGSFUTTERMITTEL'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductLabel') THEN
    CREATE TYPE "ProductLabel" AS ENUM ('BIO', 'GENTECHNIKFREI', 'AMA_GUETESIEGEL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Tierart') THEN
    CREATE TYPE "Tierart" AS ENUM ('PFERD', 'RIND', 'GEFLUEGEL', 'SCHWEIN', 'SCHAF_ZIEGE', 'HEIMTIER');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "labels" "ProductLabel"[] DEFAULT ARRAY[]::"ProductLabel"[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "subcategory" "ProductSubcategory";

-- CreateTable
CREATE TABLE IF NOT EXISTS "FutterKennzeichnung" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "zielTierarten" "Tierart"[],
    "zusammensetzung" TEXT NOT NULL,
    "analytischeBestandteile" TEXT NOT NULL,
    "zusatzstoffe" TEXT,
    "registrierungsnummer" TEXT,
    "gebrauchshinweis" TEXT,
    "bestaetigtAm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FutterKennzeichnung_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FutterKennzeichnung_productId_key" ON "FutterKennzeichnung"("productId");

-- AddForeignKey (wiederholbar)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FutterKennzeichnung_productId_fkey'
  ) THEN
    ALTER TABLE "FutterKennzeichnung"
      ADD CONSTRAINT "FutterKennzeichnung_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS
ALTER TABLE "FutterKennzeichnung" ENABLE ROW LEVEL SECURITY;

-- Datenspiegelung: isOrganic = true → labels enthält BIO.
-- Idempotent: Zeilen, die BIO schon tragen, werden nicht erneut angefasst.
UPDATE "Product"
SET "labels" = array_append(COALESCE("labels", ARRAY[]::"ProductLabel"[]), 'BIO'::"ProductLabel")
WHERE "isOrganic" = true
  AND NOT ('BIO'::"ProductLabel" = ANY(COALESCE("labels", ARRAY[]::"ProductLabel"[])));
