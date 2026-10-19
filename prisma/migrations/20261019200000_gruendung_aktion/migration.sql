-- Aktion „100 Gründungshöfe“ und Abzeichen (Register K2, Änderung 19.10.2026;
-- Nachtlauf Nr. 116, Freigabe §21). Der Gründungsplatz wird je Hof
-- festgeschrieben (eindeutig), der Hof kann sein Abzeichen ausblenden; die
-- Einstellung kennt Monate, Stichtag der Aktion und den Zeitpunkt des
-- Festschreibens.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show 91dea05:prisma/schema.prisma > <scratchpad>/schema-vor-116.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-116.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: zwei ALTER TABLE und ein CREATE UNIQUE INDEX — unverändert
-- übernommen, ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine
-- Migration nicht in einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): fünf neue Spalten, ein neuer Index.
-- Farm.gruendungPlatz nullable (kein Platz), Farm.gruendungAbzeichenZeigen NOT
-- NULL MIT Default true, PlattformEinstellung.gruendungMonate NOT NULL MIT
-- Default 24, gruendungAktionBis und gruendungFestAm nullable. Kein Backfill,
-- keine Datenänderung: Solange gruendungFestAm leer ist, läuft alles wie
-- bisher (Reihenfolge, bisheriges Ende), und ohne festgeschriebenen Platz
-- zeigt kein Hof ein Abzeichen — der Deploy ändert nichts Sichtbares, bis die
-- Projektleitung die Einstellungen setzt und festschreibt. Der eindeutige
-- Index entsteht auf einer Spalte, die überall null ist (Postgres lässt
-- mehrere null zu). Kein DROP, kein RENAME, kein ALTER COLUMN.
-- DEPLOY-FENSTER: Alter Code kennt die Spalten nicht und rechnet nach der
-- Reihenfolge — wie neuer Code, solange nicht festgeschrieben ist.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "gruendungAbzeichenZeigen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "gruendungPlatz" INTEGER;

-- AlterTable
ALTER TABLE "PlattformEinstellung" ADD COLUMN IF NOT EXISTS "gruendungAktionBis" DATE,
ADD COLUMN IF NOT EXISTS "gruendungFestAm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gruendungMonate" INTEGER NOT NULL DEFAULT 24;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Farm_gruendungPlatz_key" ON "Farm"("gruendungPlatz");
