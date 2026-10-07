-- Teilen-Momente abschaltbar (Gate 7 Aufgabe 5, Nachtlauf Nr. 30; freigabe.md
-- §10 „30": Migration erlaubt, nur Expand).
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > /tmp/schema-main.prisma
--   pnpm exec prisma migrate diff --from-schema /tmp/schema-main.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ALTER TABLE "Farm" ADD COLUMN "teilenMomenteAus" BOOLEAN NOT NULL DEFAULT false;
-- Ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht
-- in einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine neue Spalte mit Default an einer
-- bestehenden Tabelle. Kein DROP, kein RENAME, kein ALTER COLUMN, kein UPDATE.
-- Seit PostgreSQL 11 ist ADD COLUMN mit konstantem Default eine reine
-- Katalog-Änderung — die Tabelle wird nicht umgeschrieben, die Sperre ist kurz.
-- DEPLOY-FENSTER: Der alte Code kennt die Spalte nicht und schreibt weiter
-- ohne sie; jeder bestehende Hof bekommt false = Momente an, also unverändert.
-- Keine neue Tabelle, deshalb keine RLS.
SET lock_timeout = '5s';

ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "teilenMomenteAus" BOOLEAN NOT NULL DEFAULT false;
