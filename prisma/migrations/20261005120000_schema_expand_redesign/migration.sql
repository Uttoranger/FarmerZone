-- Schema-Expand Redesign (Gate 3, Aufgabe 5 aus docs/umsetzungsprompt.md,
-- Abschnitt 5). Nur die Punkte, die docs/nachtlauf/freigabe.md (Abschnitt 2)
-- freigibt: Produktfamilie (E3), Verpackung (E10), Brennmaterial (E11),
-- Teilen-Wirkung (S8), Tarife und Monatsabrechnung (E6), Teilstorno (E14).
-- NICHT enthalten: Farm.betriebsnummerGeprueftAm (E9: keine Prüfung),
-- Merkliste (E8: kein Kundenkonto), RueckrufAnfrage (nicht besprochen).
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): neue Enum-Werte, neue Enums, neue
-- Tabellen, an bestehenden Tabellen nur Spalten, die nullable sind oder einen
-- Default haben, und ein Index. Kein DROP, kein ALTER COLUMN, kein UPDATE auf
-- Bestandszeilen. DEPLOY-FENSTER: Kein Code liest oder schreibt eine dieser
-- Strukturen; alter Code schreibt weiter, ohne sie zu kennen.
--
-- NEUE ENUM-WERTE an bestehenden Typen (ProductUnit, ProductSubcategory) werden
-- hier NUR angelegt, nie benutzt — PostgreSQL erlaubt die Nutzung erst nach dem
-- Commit. ENDGÜLTIG: PostgreSQL kennt kein DROP VALUE. Solange keine Zeile
-- einen der neuen Werte trägt, kann alter Code gefahrlos zurückgerollt werden;
-- danach siehe DEVELOPMENT.md → „Schema-Expand Redesign" (Rückrollen).
--
-- VON HAND GESCHRIEBEN: `prisma migrate dev --create-only` scheitert an der
-- Shadow-Datenbank (P3006 bei 20260804091431_enable_rls, weil dort
-- "_prisma_migrations" noch nicht existiert) — dasselbe Hindernis wie bei den
-- früheren handgeschriebenen Migrationen. Geprüft mit `prisma migrate diff
-- --from-config-datasource --to-schema` gegen die lokale Testdatenbank.
--
-- WIEDERHOLBAR wie die übrigen Migrationen (IF NOT EXISTS, DO-Blöcke): Prisma
-- fährt eine Migration nicht in einer Transaktion.
--
-- RLS: Die drei neuen Tabellen bekommen RLS wie alle Tabellen im public-Schema
-- (20260804091431_enable_rls) — ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- 1. Neue Werte an bestehenden Enums (E11). Nur angelegt: Zod kennt sie noch
--    nicht, kein Formular bietet sie an (Gate 6 schaltet sie frei).
ALTER TYPE "ProductUnit" ADD VALUE IF NOT EXISTS 'RAUMMETER';
ALTER TYPE "ProductUnit" ADD VALUE IF NOT EXISTS 'SCHUETTRAUMMETER';

ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'BRENNHOLZ_SCHEIT';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'ANZUENDHOLZ';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'HACKSCHNITZEL';

-- 2. Neue Enums
DO $$ BEGIN
  CREATE TYPE "Verpackung" AS ENUM ('LOSE_BALLEN', 'ABGEPACKT_ETIKETT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "Trocknung" AS ENUM ('OFENFERTIG', 'LUFTTROCKEN', 'FRISCH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TeilenKanal" AS ENUM (
    'WHATSAPP', 'WHATSAPP_STATUS', 'FACEBOOK', 'INSTAGRAM', 'EMAIL', 'QR', 'LINK'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "Tarif" AS ENUM ('HOFTOR', 'HOFLADEN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Farm: Tarif und SEPA-Mandat (E6). Beide nullable, OHNE Default und ohne
--    Backfill: null = bisheriges Modell (keine Grundgebühr, keine Grenzen).
--    Jeder Default würde Bestandshöfen einen Tarif unterstellen, den sie nie
--    gewählt haben.
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "tarif" "Tarif";
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "sepaMandatAm" TIMESTAMP(3);

-- 4. Product: Produktfamilie (E3) und Verpackung (E10), beide nullable.
--    null = Einzelprodukt bzw. keine Angabe — so stehen alle Bestandsprodukte.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "familieId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "verpackung" "Verpackung";
CREATE INDEX IF NOT EXISTS "Product_familieId_idx" ON "Product"("familieId");

-- 5. Order: Teilstorno (E14) und Teilen-Kanal (S8).
--    erstattetCents mit Default 0: Bestandsbestellungen haben nichts teilweise
--    erstattet; der Default schreibt das in einem Katalog-Schritt fest (PG 11+,
--    kein Umschreiben der Tabelle). Die beiden anderen nullable.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serviceFeeMinCentsApplied" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "erstattetCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "teilenKanal" "TeilenKanal";

-- 6. OrderItem: Position fehlt (E14), nullable. null = wird übergeben.
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "fehltSeit" TIMESTAMP(3);

-- 7. BrennmaterialAngaben (E11), 1:1 zum Produkt, stirbt mit ihm.
CREATE TABLE IF NOT EXISTS "BrennmaterialAngaben" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "holzart" TEXT NOT NULL,
    "scheitlaengeCm" INTEGER,
    "trocknung" "Trocknung" NOT NULL,
    "restfeuchteMax" INTEGER,
    "wassergehalt" INTEGER,
    "koernung" INTEGER,
    "gelagertSeit" DATE,
    "ueberdacht" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrennmaterialAngaben_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrennmaterialAngaben_productId_key" ON "BrennmaterialAngaben"("productId");

DO $$ BEGIN
  ALTER TABLE "BrennmaterialAngaben" ADD CONSTRAINT "BrennmaterialAngaben_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. TeilenAufruf (S8): NUR Zähler je Hof, Kanal und Kalendertag. Keine
--    Spalte für Personen-, Geräte- oder IP-Daten, kein Zeitstempel eines
--    einzelnen Aufrufs.
CREATE TABLE IF NOT EXISTS "TeilenAufruf" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "kanal" "TeilenKanal" NOT NULL,
    "tag" DATE NOT NULL,
    "besuche" INTEGER NOT NULL DEFAULT 0,
    "bestellungen" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeilenAufruf_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeilenAufruf_farmId_kanal_tag_key" ON "TeilenAufruf"("farmId", "kanal", "tag");

DO $$ BEGIN
  ALTER TABLE "TeilenAufruf" ADD CONSTRAINT "TeilenAufruf_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. Monatsabrechnung (E6): Snapshots in Cent, eine je Hof und Monat. monat
--    ist DATE (der Erste des Monats), wie Kostenposten.ab. RESTRICT wie bei
--    Order: Abrechnungen unterliegen der Aufbewahrungspflicht.
CREATE TABLE IF NOT EXISTS "Monatsabrechnung" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "monat" DATE NOT NULL,
    "tarif" "Tarif" NOT NULL,
    "grundgebuehrCents" INTEGER NOT NULL,
    "servicegebuehrBarCents" INTEGER NOT NULL,
    "barBestellungen" INTEGER NOT NULL,
    "servicegebuehrOnlineCents" INTEGER NOT NULL,
    "nichtAbgeholtBestellungen" INTEGER NOT NULL,
    "summeCents" INTEGER NOT NULL,
    "eingezogenAm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Monatsabrechnung_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Monatsabrechnung_farmId_monat_key" ON "Monatsabrechnung"("farmId", "monat");

DO $$ BEGIN
  ALTER TABLE "Monatsabrechnung" ADD CONSTRAINT "Monatsabrechnung_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10. Row-Level-Security wie auf allen Tabellen im public-Schema (siehe Kopf)
ALTER TABLE "public"."BrennmaterialAngaben" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TeilenAufruf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Monatsabrechnung" ENABLE ROW LEVEL SECURITY;
