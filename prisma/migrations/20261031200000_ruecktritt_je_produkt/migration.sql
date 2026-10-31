-- Rücktritt je Produkt (Register N39, Ergänzung 31.10.2026; Nachtlauf
-- Nr. 214): zwei Spalten auf "Product" — ob die Ware nach Angabe des Hofs
-- schnell verdirbt (§ 18 Abs. 1 Z 4 FAGG) und was die Rücksendung sperriger
-- Ware schätzungsweise kostet (§ 4 Abs. 1 Z 9 FAGG, in Cent).
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main-214.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main-214.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe unverändert übernommen, ergänzt um IF NOT EXISTS (wiederholbar:
-- Prisma fährt eine Migration nicht in einer Transaktion) und lock_timeout.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine Spalte NOT NULL mit Default
-- false und eine nullbare Spalte ohne Default — kein DROP, kein RENAME, keine
-- Typänderung, keine Datenänderung. Kein Bestandsprodukt bekommt eine Angabe:
-- Ohne Angabe gilt der bisherige Hinweis je Kategorie bzw. keine
-- Rücksendekosten für die Kundschaft.
-- DEPLOY-FENSTER: Alter Code kennt die Spalten nicht, liest und schreibt
-- unverändert; neue Zeilen alten Codes bekommen false bzw. null.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "keinRuecktritt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ruecksendekostenCents" INTEGER;
