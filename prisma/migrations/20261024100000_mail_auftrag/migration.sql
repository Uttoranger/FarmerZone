-- Mail-Warteschlange und Protokoll (Register N26; Nachtlauf Nr. 158,
-- Freigabe §28): eine neue Tabelle "MailAuftrag" — eine Zeile je Mail, für
-- „Wichtig“ und „Kann warten“ als Auftrag des Workers, für „Sofort“ nur als
-- Protokoll.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main-158.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main-158.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: ein CREATE TABLE, zwei CREATE UNIQUE INDEX, sieben CREATE INDEX —
-- unverändert übernommen, ergänzt um IF NOT EXISTS (wiederholbar: Prisma
-- fährt eine Migration nicht in einer Transaktion), lock_timeout und RLS.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine neue, leere Tabelle. Kein DROP,
-- kein RENAME, kein ALTER an einer bestehenden Tabelle, kein Backfill, keine
-- Fremdschlüssel (ein gelöschter Bezug reißt das Protokoll nicht mit).
-- DEPLOY-FENSTER: Alter Code kennt die Tabelle nicht und läuft unverändert.
--
-- KEINE ADRESSE, KEIN NAME, KEIN INHALT, KEIN TOKEN, KEIN CODE: "bezug" trägt
-- nur Kennungen, "empfaengerHash" ist ein HMAC der Adresse (nicht umkehrbar),
-- "fehlerCode" ein kurzer Code von Resend, nie dessen Text.
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls,
-- 20261016130000_betrieb) — ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "MailAuftrag" (
    "id" TEXT NOT NULL,
    "art" TEXT NOT NULL,
    "vorrang" INTEGER NOT NULL,
    "schluessel" TEXT NOT NULL,
    "bestellungId" TEXT,
    "bezug" JSONB,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "versuche" INTEGER NOT NULL DEFAULT 0,
    "naechsterVersuchAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "belegtBis" TIMESTAMP(3),
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gesendetAm" TIMESTAMP(3),
    "resendId" TEXT,
    "fehlerCode" TEXT,
    "zugestelltAm" TIMESTAMP(3),
    "bounceAm" TIMESTAMP(3),
    "beschwerdeAm" TIMESTAMP(3),
    "farmId" TEXT,
    "ausloeser" TEXT NOT NULL DEFAULT 'system',
    "nochmalVon" TEXT,
    "empfaengerHash" TEXT,

    CONSTRAINT "MailAuftrag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MailAuftrag_schluessel_key" ON "MailAuftrag"("schluessel");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MailAuftrag_resendId_key" ON "MailAuftrag"("resendId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MailAuftrag_status_vorrang_naechsterVersuchAm_idx" ON "MailAuftrag"("status", "vorrang", "naechsterVersuchAm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MailAuftrag_art_erstelltAm_idx" ON "MailAuftrag"("art", "erstelltAm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MailAuftrag_erstelltAm_idx" ON "MailAuftrag"("erstelltAm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MailAuftrag_bestellungId_idx" ON "MailAuftrag"("bestellungId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MailAuftrag_farmId_erstelltAm_idx" ON "MailAuftrag"("farmId", "erstelltAm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MailAuftrag_nochmalVon_idx" ON "MailAuftrag"("nochmalVon");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MailAuftrag_empfaengerHash_erstelltAm_idx" ON "MailAuftrag"("empfaengerHash", "erstelltAm");


-- RLS
ALTER TABLE "public"."MailAuftrag" ENABLE ROW LEVEL SECURITY;
