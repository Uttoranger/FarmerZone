-- Sprint Bereiche 1: Futtermittel als eigener Bereich (docs/konzepte/bereiche.md §3, §7,
-- geändert nach Rückfrage F6: Betriebsnummer und Betriebsstatus gehören dem Hof).
--
-- WIEDERHOLBAR wie die übrigen Migrationen (IF NOT EXISTS, DO-Blöcke).
-- NEUE ENUM-WERTE an bestehenden Typen werden hier NUR angelegt, nie benutzt —
-- PostgreSQL erlaubt die Nutzung erst nach dem Commit. Die Typen, die diese
-- Migration neu ANLEGT (Abgabe, Futtermittelart …), sind davon nicht betroffen.
-- ALTLAST: FUTTERMITTEL, EINZELFUTTERMITTEL, MISCHFUTTERMITTEL,
-- ERGAENZUNGSFUTTERMITTEL bleiben im Enum (Konzept 2.3); Zod lehnt sie ab.
-- ALTLAST: FutterKennzeichnung.registrierungsnummer bleibt als Spalte stehen,
-- wird nicht mehr geschrieben, nur als Rückfall gelesen (Cleanup-Sprint).
-- Keine neue Tabelle → keine RLS-Änderung.
SET lock_timeout = '5s';

-- 1. Neue Werte an bestehenden Enums
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'HEU_STROH' BEFORE 'BRENNHOLZ';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'GETREIDE_KOERNER' BEFORE 'BRENNHOLZ';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'MISCHFUTTER' BEFORE 'BRENNHOLZ';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'ERGAENZUNGSFUTTER' BEFORE 'BRENNHOLZ';

ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'WIESENHEU';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'LUZERNE';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'STROH';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'SILAGE';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'MAIS';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'HAFER';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'GERSTE';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'WEIZEN';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'ROGGEN';
ALTER TYPE "ProductSubcategory" ADD VALUE IF NOT EXISTS 'TRITICALE';

ALTER TYPE "ProductUnit" ADD VALUE IF NOT EXISTS 'BALLEN';
ALTER TYPE "ProductUnit" ADD VALUE IF NOT EXISTS 'BIGBAG';

-- 2. Neue Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Abgabe') THEN
    CREATE TYPE "Abgabe" AS ENUM ('ALLE', 'NUR_BETRIEBE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Futtermittelart') THEN
    CREATE TYPE "Futtermittelart" AS ENUM (
      'EINZELFUTTERMITTEL', 'ALLEINFUTTERMITTEL', 'ERGAENZUNGSFUTTERMITTEL', 'MINERALFUTTERMITTEL'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NettoEinheit') THEN
    CREATE TYPE "NettoEinheit" AS ENUM ('KG', 'LITER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Betriebsstatus') THEN
    CREATE TYPE "Betriebsstatus" AS ENUM ('PRIMAERPRODUKTION', 'REGISTRIERT', 'ZUGELASSEN');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'KaeuferArt') THEN
    CREATE TYPE "KaeuferArt" AS ENUM ('PRIVAT', 'BETRIEB');
  END IF;
END $$;

-- 3. Farm: Betriebsnummer und Betriebsstatus (F6). Eigenschaft des HOFS, nicht
--    des Produkts — auch ein Hof ohne eigenes Futter kauft damit als Betrieb ein.
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "betriebsnummer" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "betriebsstatus" "Betriebsstatus";

-- 4. Product: Abgabe + Index auf category
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "abgabe" "Abgabe" NOT NULL DEFAULT 'ALLE';
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");

-- 5. FutterKennzeichnung. Futtermittelart und Nettomenge sind Pflichtangaben
--    vom Sackanhänger — die Migration erfindet sie nicht. Gibt es beim ERSTEN
--    Lauf schon Kennzeichnungen, bricht sie LAUT ab, statt Platzhalter zu
--    schreiben oder still zu überspringen. Produktion: 0 Zeilen. Dev: die
--    Seed-Kennzeichnung wird vorher gelöscht, der Seed legt sie neu an.
DO $$ BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'FutterKennzeichnung' AND column_name = 'nettoMenge')
     AND EXISTS (SELECT 1 FROM "FutterKennzeichnung") THEN
    RAISE EXCEPTION 'Bereiche 1: % Futter-Kennzeichnung(en) ohne Futtermittelart und Nettomenge. Erst bereinigen, siehe DEVELOPMENT.md (Bereiche).',
      (SELECT count(*) FROM "FutterKennzeichnung");
  END IF;
END $$;

-- EXPAND-CONTRACT: Tabelle leer — belegt durch die Schutzabfrage direkt darüber:
-- Sie bricht LAUT ab, wenn die Tabelle beim ersten Lauf schon Zeilen hat.
-- (Marker nachträglich, Vorfall 2026-09-23: siehe DEVELOPMENT.md → Vorfälle.)
ALTER TABLE "FutterKennzeichnung"
  ADD COLUMN IF NOT EXISTS "futtermittelart" "Futtermittelart" NOT NULL,
  ADD COLUMN IF NOT EXISTS "nettoMenge"      DECIMAL(10,3)     NOT NULL,
  ADD COLUMN IF NOT EXISTS "nettoEinheit"    "NettoEinheit"    NOT NULL,
  ADD COLUMN IF NOT EXISTS "rohprotein"      DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "rohfaser"        DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "rohfett"         DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "rohasche"        DECIMAL(5,2);

-- 6. Order: Käuferart + Betriebsnummer (Snapshot zur Bestellzeit)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "kaeuferArt" "KaeuferArt" NOT NULL DEFAULT 'PRIVAT';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "betriebsnummer" TEXT;

-- 7. OrderItem.vatRate: nullable anlegen, Backfill, dann NOT NULL (Konzept §7)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2);

UPDATE "OrderItem" oi SET "vatRate" = p."vatRate"
FROM "Product" p
WHERE p.id = oi."productId" AND oi."vatRate" IS NULL;

-- Rückfall für Positionen ohne Produkt. Kann heute nicht greifen: der
-- Fremdschlüssel OrderItem→Product ist ON DELETE RESTRICT. Bleibt als Netz.
UPDATE "OrderItem" SET "vatRate" = 10 WHERE "vatRate" IS NULL;

ALTER TABLE "OrderItem" ALTER COLUMN "vatRate" SET NOT NULL;
