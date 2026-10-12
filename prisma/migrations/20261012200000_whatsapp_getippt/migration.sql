-- Wer eine WhatsApp-Nachricht zu einem Beitrag geöffnet bekam (Register W1,
-- Nachtlauf Nr. 66; Freigabe: „neue Spalte StatusPost.whatsappGetippt vom Typ
-- TEXT[] (Abonnements-IDs, keine E-Mails, keine Nummern), nullable, mit
-- leerem Default wie linkedProductIds, ohne Backfill und ohne andere
-- Schema-Änderung").
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ALTER TABLE "StatusPost" ADD COLUMN "whatsappGetippt" TEXT[] DEFAULT ARRAY[]::TEXT[];
-- Ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht
-- in einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine nullable Spalte mit konstantem
-- Default an einer bestehenden Tabelle — seit Postgres 11 steht der Default
-- nur im Katalog, die Tabelle wird nicht umgeschrieben, die Sperre ist kurz.
-- Kein DROP, kein RENAME, kein ALTER COLUMN, kein UPDATE, kein Backfill:
-- Bestehende Beiträge lesen [] (noch niemand angetippt). whatsappSentCount
-- und whatsappRecipientCount bleiben (Contract später, eigene Freigabe).
-- DEPLOY-FENSTER: Der alte Code kennt die Spalte nicht; seine neuen Beiträge
-- bekommen den Default [], seinen Zähler whatsappSentCount liest und schreibt
-- er weiter wie bisher.
-- Keine neue Tabelle, deshalb keine RLS.
SET lock_timeout = '5s';

ALTER TABLE "StatusPost" ADD COLUMN IF NOT EXISTS "whatsappGetippt" TEXT[] DEFAULT ARRAY[]::TEXT[];
