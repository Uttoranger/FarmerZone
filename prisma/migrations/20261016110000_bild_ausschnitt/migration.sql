-- Bild-Ausschnitt: Fokus, Zoom und Filter für alle Fotos eines Hofs
-- (Register N13, Ergänzung 15.10.2026, und N17; Nachtlauf Nr. 97, Freigabe §19).
-- Ein Ausschnitt { fokusX, fokusY, zoom, filter, darstellung? } je Bildfeld,
-- geprüft mit zod (src/schemas/bild-ausschnitt.ts) und gelesen nur über
-- leseAusschnitt — ungültige Werte ergeben null. Alle fünf Spalten auf einmal,
-- damit Nr. 98 (Logo, Produktfoto, Galerie, Beitragsfoto) ohne Migration auskommt.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show <Basis-Commit der Nr. 99>:prisma/schema.prisma > <scratchpad>/schema-vor-97.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-97.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: vier ALTER TABLE … ADD COLUMN … JSONB — unverändert übernommen,
-- ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht in
-- einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): fünf neue Spalten, alle nullable,
-- ohne Default. Kein DROP, kein RENAME, kein ALTER COLUMN. null = Darstellung
-- wie vorher (Titelbild nach Seitenverhältnis mit Farm.bannerFocusY, die übrigen
-- Fotos mittig).
-- DEPLOY-FENSTER: Alter Code kennt die Spalten nicht und liest weiter
-- Farm.bannerFocusY. Neuer Code schreibt beim Speichern des Titelbild-Ausschnitts
-- bannerFocusY MIT (= fokusY), damit alter Code im Fenster denselben senkrechten
-- Fokus zeigt. Contract von bannerFocusY später (eigene Freigabe).
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "bannerAusschnitt" JSONB,
ADD COLUMN IF NOT EXISTS "logoAusschnitt" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bildAusschnitt" JSONB;

-- AlterTable
ALTER TABLE "StatusPost" ADD COLUMN IF NOT EXISTS "fotoAusschnitt" JSONB;

-- AlterTable
ALTER TABLE "FarmPhoto" ADD COLUMN IF NOT EXISTS "ausschnitt" JSONB;
