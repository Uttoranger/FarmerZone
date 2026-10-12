-- Gründungs-Enddatum je Hof (Register K2, Nachtlauf Nr. 62; Freigabe:
-- „neue Spalte Farm.gruendungBis vom Typ DATE, nullable, ohne Default, ohne
-- Backfill und ohne andere Schema-Änderung").
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ALTER TABLE "Farm" ADD COLUMN "gruendungBis" DATE;
-- Ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht
-- in einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine nullable Spalte ohne Default an
-- einer bestehenden Tabelle — eine reine Katalog-Änderung, die Tabelle wird
-- nicht umgeschrieben, die Sperre ist kurz. Kein DROP, kein RENAME, kein
-- ALTER COLUMN, kein UPDATE: Bestehende Höfe behalten null = Standard
-- (31.12.2027, src/lib/gruendungshof.ts).
-- DEPLOY-FENSTER: Der alte Code kennt die Spalte nicht und schreibt weiter
-- ohne sie; null heißt für den neuen Code „Standard", also nichts verändert.
-- Keine neue Tabelle, deshalb keine RLS.
SET lock_timeout = '5s';

ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "gruendungBis" DATE;
