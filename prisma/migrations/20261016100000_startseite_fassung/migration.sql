-- Startseite: Entwurf und Fassung (Register N16, Änderung 15.10.2026;
-- Nachtlauf Nr. 99, Freigabe §19). Admin › Startseite arbeitet in einem
-- Entwurf (die bestehenden Tabellen StartseiteAbschnitt/StartseiteBlock);
-- „Veröffentlichen …" schreibt daraus eine unveränderliche Fassung in diese
-- neue Tabelle — jetzt oder zu Datum und Uhrzeit. Live ist die jüngste nicht
-- zurückgezogene Fassung mit liveAb ≤ jetzt, verglichen beim Lesen (kein Cron).
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show docs/lauf15:prisma/schema.prisma > <scratchpad>/schema-vor-99.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-99.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ein CREATE TABLE, ein CREATE INDEX — unverändert übernommen,
-- ergänzt um IF NOT EXISTS (wiederholbar: Prisma fährt eine Migration nicht in
-- einer Transaktion), lock_timeout und RLS.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine neue Tabelle und ihr Index.
-- Kein DROP, kein RENAME, kein ALTER COLUMN, keine bestehende Tabelle bekommt
-- eine Spalte; StartseiteAbschnitt und StartseiteBlock bleiben, wie sie sind.
-- DEPLOY-FENSTER: Alter Code kennt die Tabelle nicht und liest die Startseite
-- weiter aus StartseiteAbschnitt; neuer Code ohne Fassung rendert die
-- Standard-Reihenfolge — in Produktion ist das der heutige Stand (acht
-- Abschnitte in Standard-Reihenfolge, alle sichtbar, keine Blöcke), also kein
-- sichtbarer Wechsel.
--
-- KEIN SEED: Ohne Fassung gilt die Standard-Reihenfolge
-- (src/lib/startseite-gestalten.ts, STANDARD_REIHENFOLGE). Eine erste Fassung
-- entsteht erst, wenn der Admin veröffentlicht. Kein INSERT.
--
-- INDEX: liveAb — die Startseite fragt die jüngste Fassung mit liveAb ≤ jetzt
-- und die nächste geplante. erstelltVonUserId ist bewusst kein Fremdschlüssel
-- (wie StartseiteBlock.erstelltVonUserId, prisma/schema.prisma).
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls,
-- 20261015140000_startseite_gestalten) — ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "StartseiteFassung" (
    "id" TEXT NOT NULL,
    "inhalt" JSONB NOT NULL,
    "liveAb" TIMESTAMP(3) NOT NULL,
    "zurueckgezogenAm" TIMESTAMP(3),
    "erstelltVonUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StartseiteFassung_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StartseiteFassung_liveAb_idx" ON "StartseiteFassung"("liveAb");

-- RLS
ALTER TABLE "public"."StartseiteFassung" ENABLE ROW LEVEL SECURITY;
