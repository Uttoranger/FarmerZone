-- Widerruf online (§ 13a FAGG, Register N39; Nachtlauf Nr. 200, Freigabe
-- Lauf 27): neue Tabelle "Widerruf".
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main-200.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main-200.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe unverändert übernommen, ergänzt um IF NOT EXISTS (wiederholbar:
-- Prisma fährt eine Migration nicht in einer Transaktion), lock_timeout und RLS.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine neue leere Tabelle, kein DROP,
-- kein RENAME, keine Typänderung, kein Fremdschlüssel (ein Widerruf ohne
-- passende Bestellung wird trotzdem angenommen), keine Datenänderung.
-- DEPLOY-FENSTER: Alter Code kennt die Tabelle nicht und liest sie nie.
SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Widerruf" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "eingegangenAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(120) NOT NULL,
    "email" TEXT NOT NULL,
    "bestellnummerEingabe" TEXT,
    "umfang" TEXT NOT NULL,
    "positionen" JSONB,
    "nachricht" VARCHAR(500),
    "stand" TEXT NOT NULL DEFAULT 'eingegangen',
    "standGeaendertAm" TIMESTAMP(3),
    "grund" VARCHAR(300),

    CONSTRAINT "Widerruf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Widerruf_stand_eingegangenAm_idx" ON "Widerruf"("stand", "eingegangenAm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Widerruf_orderId_idx" ON "Widerruf"("orderId");

-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls) —
-- die App greift über Prisma als Eigentümer zu, die Supabase-API sieht nichts.
ALTER TABLE "public"."Widerruf" ENABLE ROW LEVEL SECURITY;
