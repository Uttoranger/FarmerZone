-- Zustimmung der Höfe zu den AGB (§ 104 JN, P2B-Verordnung; Nachtlauf
-- Nr. 207): zwei Spalten auf "Farm" — welche Fassung der Hof bestätigt hat
-- und wann.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main-207.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main-207.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe unverändert übernommen, ergänzt um IF NOT EXISTS (wiederholbar:
-- Prisma fährt eine Migration nicht in einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): zwei nullbare Spalten ohne Default,
-- kein DROP, kein RENAME, keine Typänderung, keine Datenänderung — kein Hof
-- gilt durch die Migration als zugestimmt (keine Zustimmungsfiktion).
-- DEPLOY-FENSTER: Alter Code kennt die Spalten nicht, liest und schreibt
-- unverändert.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "agbFassung" TEXT,
ADD COLUMN IF NOT EXISTS "agbZugestimmtAm" TIMESTAMP(3);
