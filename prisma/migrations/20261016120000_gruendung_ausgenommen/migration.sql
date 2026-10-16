-- Gründungshöfe: Testhöfe ausnehmen (Register K2, Ergänzung 16.10.2026;
-- Nachtlauf Nr. 109, Freigabe §20). Der Admin kann einen freigeschalteten Hof
-- aus der Vergabe der Gründungsplätze nehmen und wieder aufnehmen; am Hof steht,
-- wer zuletzt geändert hat und wann.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show bf57be4:prisma/schema.prisma > <scratchpad>/schema-vor-109.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-109.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ein ALTER TABLE mit drei ADD COLUMN — unverändert übernommen,
-- ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht in
-- einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): drei neue Spalten. gruendungAusgenommen
-- NOT NULL MIT Default false = jeder bestehende Hof zählt wie bisher, kein
-- Backfill, kein sichtbarer Wechsel beim Deploy. Die beiden anderen nullable.
-- gruendungGeaendertVonUserId bewusst ohne Fremdschlüssel (wie
-- PlattformEinstellung.geaendertVonUserId): Die Zeile „zuletzt geändert von …“
-- soll ein gelöschtes Konto überleben. Kein DROP, kein RENAME, kein ALTER COLUMN.
-- DEPLOY-FENSTER: Alter Code kennt die Spalten nicht und zählt alle Höfe — wie
-- neuer Code, solange niemand ausnimmt.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "gruendungAusgenommen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "gruendungGeaendertAm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gruendungGeaendertVonUserId" TEXT;
