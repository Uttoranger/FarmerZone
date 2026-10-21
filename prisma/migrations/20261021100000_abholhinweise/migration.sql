-- Abholhinweise (Register N23, neu 20.10.2026; Nachtlauf Nr. 123, Freigabe §23).
-- Ein Futter trägt feste Angaben des Hofs zur Abholung: Anhänger nötig,
-- Verladen mit Frontlader, Abholung nach Absprache. Sie stehen in „Futter
-- kaufen" und auf der Produktseite als Kennzeichen; gespeichert wird nur im
-- Bereich Futtermittel, bei allen anderen Produkten bleibt die Liste leer.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show 3d6d425:prisma/schema.prisma > <scratchpad>/schema-vor-123.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-123.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: CREATE TYPE und ein ALTER TABLE mit einer Spalte — übernommen,
-- ergänzt um den Guard gegen einen schon vorhandenen Typ (wiederholbar: Prisma
-- fährt eine Migration nicht in einer Transaktion), IF NOT EXISTS,
-- lock_timeout und NOT NULL (Freigabe: Prisma legt Listen ohne NOT NULL an;
-- mit DEFAULT bekommt jede bestehende Zeile die leere Liste, nie null).
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine neue Aufzählung und eine neue
-- Spalte auf Product, NOT NULL MIT Default. Kein Backfill, keine
-- Datenänderung, kein DROP, kein RENAME, kein ALTER COLUMN.
-- DEPLOY-FENSTER: Alter Code kennt die Spalte nicht, liest und schreibt sie
-- nicht; neue Zeilen alten Codes bekommen die leere Liste.
SET lock_timeout = '5s';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Abholhinweis" AS ENUM ('ANHAENGER_NOETIG', 'FRONTLADER', 'NACH_ABSPRACHE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "abholhinweise" "Abholhinweis"[] NOT NULL DEFAULT ARRAY[]::"Abholhinweis"[];
