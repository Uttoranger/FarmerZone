-- Schema für den Regelbetrieb (Register N33, N34, N35, N36, N38; Nachtlauf
-- Nr. 188, Freigabe Lauf 26): Tabelle "AdminAktion" (Admin-Protokoll), Rechte
-- je Person auf "User", Sperre und Schließen auf "Farm", Notbremse und
-- Stichtag auf "PlattformEinstellung", Felder der Plattformgebühr im Hofpreis
-- (benutzt ab 197/198) auf "Farm", "Order", "OrderItem", "Monatsabrechnung".
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show origin/main:prisma/schema.prisma > <scratchpad>/schema-main-188.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-main-188.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe unverändert übernommen, ergänzt um IF NOT EXISTS (wiederholbar:
-- Prisma fährt eine Migration nicht in einer Transaktion), lock_timeout, RLS
-- und den einen freigegebenen Datenschritt am Ende.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): jede neue Spalte ist nullbar oder hat
-- einen Default, eine neue leere Tabelle, kein DROP, kein RENAME, keine
-- Typänderung, keine Fremdschlüssel (ein gelöschtes Konto reißt das Protokoll
-- nicht mit). DEPLOY-FENSTER: Alter Code kennt die Spalten nicht, liest und
-- schreibt unverändert; die Defaults füllen die neuen NOT-NULL-Spalten.
--
-- KEINE ADRESSE, KEIN NAME, KEIN INHALT, KEIN TOKEN im Protokoll; keine IBAN
-- und keine Mandatsdaten, nur Kennungen von Stripe.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminInhaber" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "adminRechte" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "abrechnungsTag" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "adminGesperrtAm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "adminGesperrtVonUserId" TEXT,
ADD COLUMN IF NOT EXISTS "adminSperrGrund" TEXT,
ADD COLUMN IF NOT EXISTS "barMandatPflicht" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "barSperreNachTagen" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN IF NOT EXISTS "einzugAb" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "endgueltigAm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gebuehrHinweisAm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "geschlossenAm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "plattformgebuehrProzent" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "sepaZahlungsmittelId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeKundeId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gebuehrEinzug" TEXT,
ADD COLUMN IF NOT EXISTS "gebuehrModell" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "gebuehrCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Monatsabrechnung" ADD COLUMN IF NOT EXISTS "offenSeit" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rechnungBarId" TEXT,
ADD COLUMN IF NOT EXISTS "rechnungOnlineId" TEXT,
ADD COLUMN IF NOT EXISTS "stand" TEXT NOT NULL DEFAULT 'entwurf',
ADD COLUMN IF NOT EXISTS "zurueckgebuchtAm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlattformEinstellung" ADD COLUMN IF NOT EXISTS "bestellstoppAb" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "bestellstoppBis" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "bestellstoppGrund" TEXT,
ADD COLUMN IF NOT EXISTS "bestellstoppSatz" TEXT,
ADD COLUMN IF NOT EXISTS "hofpreisModellAb" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAktion" (
    "id" TEXT NOT NULL,
    "wann" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wer" TEXT,
    "art" TEXT NOT NULL,
    "bezugArt" TEXT NOT NULL,
    "bezugId" TEXT NOT NULL,
    "grund" TEXT,
    "mitPasskey" BOOLEAN NOT NULL,

    CONSTRAINT "AdminAktion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAktion_wann_idx" ON "AdminAktion"("wann");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAktion_bezugArt_bezugId_wann_idx" ON "AdminAktion"("bezugArt", "bezugId", "wann");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAktion_wer_wann_idx" ON "AdminAktion"("wer", "wann");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Farm_stripeKundeId_key" ON "Farm"("stripeKundeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Monatsabrechnung_stand_idx" ON "Monatsabrechnung"("stand");

-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls) —
-- ohne Policies, ohne FORCE.
ALTER TABLE "public"."AdminAktion" ENABLE ROW LEVEL SECURITY;

-- Daten (Register N35, freigegeben Lauf 26, der einzige Datenschritt):
-- Bestehende Admins werden Inhaber, damit beim Umstieg kein Recht verloren
-- geht. Wiederholbar (setzt nur true auf true).
UPDATE "User" SET "adminInhaber" = true WHERE "isAdmin" = true AND "adminInhaber" = false;
