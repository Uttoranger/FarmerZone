-- Double-Opt-in für werbliche Mails (Register S11, Nachtlauf Nr. 38;
-- freigabe.md §11 „38": Migration erlaubt, nur Expand).
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > /tmp/schema-main.prisma
--   pnpm exec prisma migrate diff --from-schema /tmp/schema-main.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ALTER TABLE "CustomerFarmSubscription" ADD COLUMN "emailOptInAngefragtAm" TIMESTAMP(3),
--          ADD COLUMN "emailOptInBestaetigtAm" TIMESTAMP(3);
-- Ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht
-- in einer Transaktion), lock_timeout und eine Anweisung je Spalte.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): zwei neue Spalten OHNE Default und
-- OHNE NOT NULL an einer bestehenden Tabelle — eine reine Katalog-Änderung,
-- die Tabelle wird nicht umgeschrieben. Kein DROP, kein RENAME, kein ALTER
-- COLUMN, kein UPDATE: Jedes bestehende Abo hat danach null/null und gilt
-- damit als Bestand vor dem Double-Opt-in — unverändert (S11).
-- DEPLOY-FENSTER: Der alte Code kennt die Spalten nicht. Was er in dieser
-- Zeit anlegt, hat ebenfalls null/null und zählt als Bestand.
-- Keine neue Tabelle, deshalb keine RLS.
SET lock_timeout = '5s';

ALTER TABLE "CustomerFarmSubscription" ADD COLUMN IF NOT EXISTS "emailOptInAngefragtAm" TIMESTAMP(3);

ALTER TABLE "CustomerFarmSubscription" ADD COLUMN IF NOT EXISTS "emailOptInBestaetigtAm" TIMESTAMP(3);
