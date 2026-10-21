-- Startseite: zusätzlicher Abschnitt „Neu bei den Höfen“ (Register N16,
-- Ergänzung 20.10.2026; Nachtlauf Nr. 129, Freigabe §23).
-- Die neuesten aktiven Beiträge sichtbarer Höfe als eigener Abschnitt der
-- Startseite. Er ist ZUSÄTZLICH: Admin fügt ihn in Admin › Startseite hinzu
-- (Zeile im Entwurf, Vorschau, Veröffentlichen); bestehende Fassungen und der
-- Entwurf bleiben ohne ihn gültig (ZUSATZ_ARTEN in src/lib/startseite-gestalten.ts).
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show daa0228:prisma/schema.prisma > <scratchpad>/schema-vor-129.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-129.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ein ALTER TYPE … ADD VALUE — unverändert übernommen, ergänzt um
-- IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht in einer
-- Transaktion) und lock_timeout.
--
-- NUR ADDITIV und nur Katalog (Expand, ARCHITECTURE §5): keine Zeile in
-- "StartseiteAbschnitt", keine Datenänderung. Der Wert wird hier nur angelegt,
-- nie benutzt — PostgreSQL erlaubt die Nutzung erst nach dem Commit.
-- DEPLOY-FENSTER: Alter Code sieht den Wert nie, solange niemand den
-- Abschnitt hinzufügt; eingeblendet wird er erst nach dem Merge.
-- ENDGÜLTIG: PostgreSQL kennt kein DROP VALUE. Code von vor diesem Lauf WIRFT
-- beim Lesen einer Zeile oder Fassung mit diesem Wert — vor einem Rückrollen
-- erst die Zeile „Neu bei den Höfen“ aus dem Entwurf nehmen und eine Fassung
-- ohne sie veröffentlichen (Bericht 129, „Rückweg“).
SET lock_timeout = '5s';

-- AlterEnum
ALTER TYPE "StartseiteArt" ADD VALUE IF NOT EXISTS 'NEUIGKEITEN';
