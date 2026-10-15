-- Plattform-Einstellungen (Admin › Einstellungen; Register K2-Ergänzung
-- „Gründungshöfe sichtbar" und N15, Nachtlauf Nr. 93; Freigabe §18:
-- „Migration (Expand): PlattformEinstellung { … } – genau eine Zeile, angelegt
-- beim ersten Lesen (upsert) oder per Seed-Zeile in der Migration").
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show docs/lauf14:prisma/schema.prisma > <scratchpad>/schema-vor-93.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-93.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ein CREATE TABLE — unverändert übernommen, ergänzt um IF NOT
-- EXISTS (wiederholbar: Prisma fährt eine Migration nicht in einer
-- Transaktion), lock_timeout, RLS und die eine Seed-Zeile.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine neue Tabelle ohne Fremdschlüssel.
-- Kein DROP, kein RENAME, kein ALTER COLUMN, keine bestehende Tabelle bekommt
-- eine Spalte. DEPLOY-FENSTER: Alter Code kennt die Tabelle nicht und läuft
-- unverändert.
--
-- SEED-ZEILE: Genau eine Zeile "plattform" mit den Standardwerten der Spalten
-- (12 Plätze, kostenlos bis 31.12.2027, Anzeige an — Register K2). So schreibt
-- kein Lesepfad (Startseite, /fuer-hoefe), gespeichert wird nur aus der
-- Admin-Action per upsert. ON CONFLICT: Eine wiederholte Migration lässt eine
-- schon geänderte Zeile stehen.
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls) —
-- ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlattformEinstellung" (
    "id" TEXT NOT NULL DEFAULT 'plattform',
    "gruendungPlaetze" INTEGER NOT NULL DEFAULT 12,
    "gruendungBisStandard" DATE NOT NULL DEFAULT '2027-12-31'::date,
    "gruendungAnzeige" BOOLEAN NOT NULL DEFAULT true,
    "zustellRegeln" JSONB,
    "geaendertVonUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlattformEinstellung_pkey" PRIMARY KEY ("id")
);

-- Seed-Zeile
INSERT INTO "PlattformEinstellung" ("id", "updatedAt") VALUES ('plattform', now()) ON CONFLICT ("id") DO NOTHING;

-- RLS
ALTER TABLE "public"."PlattformEinstellung" ENABLE ROW LEVEL SECURITY;
