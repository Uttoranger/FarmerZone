-- Testhof (Register N21, neu 19.10.2026; Nachtlauf Nr. 119, Freigabe §22).
-- Ein Hof kann im Admin als Testhof markiert werden: Er erscheint in keiner
-- Liste, Karte, Zählung oder Auswahl, trägt noindex, und seine Hofseite bleibt
-- per Link erreichbar. Dazu, wer zuletzt markiert oder zurückgenommen hat.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show 9f7044b:prisma/schema.prisma > <scratchpad>/schema-vor-119.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-119.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ein ALTER TABLE mit drei Spalten — unverändert übernommen,
-- ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht
-- in einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): drei neue Spalten auf Farm.
-- Farm.istTesthof NOT NULL MIT Default false, testhofGeaendertAm und
-- testhofGeaendertVonUserId nullable (VonUserId ohne Fremdschlüssel, wie
-- gruendungGeaendertVonUserId). Kein Backfill, keine Datenänderung: Markiert
-- wird nach dem Merge durch die Projektleitung — bis dahin ist jeder Hof so
-- sichtbar wie bisher. Kein DROP, kein RENAME, kein ALTER COLUMN.
-- DEPLOY-FENSTER: Alter Code kennt die Spalten nicht und zeigt alle
-- öffentlichen Höfe — wie neuer Code, solange kein Hof markiert ist.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "istTesthof" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "testhofGeaendertAm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "testhofGeaendertVonUserId" TEXT;
