-- Admin nur mit Passkey (Register N20, Ergänzung Lauf 18; Nachtlauf Nr. 115):
-- die Tabelle des Plugins @better-auth/passkey 1.6.23 (Passkey), die
-- Ersatzcodes eines Admin-Kontos (AdminErsatzcode), der Zeitpunkt, zu dem das
-- Admin-Recht vergeben wurde ("User"."adminSeit"), und an der Sitzung die
-- letzte Bestätigung mit Passkey und die Art der Anmeldung.
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show 9f7044b:prisma/schema.prisma > <scratchpad>/schema-vor-115.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-115.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: zwei ALTER TABLE … ADD COLUMN, zwei CREATE TABLE, vier CREATE
-- INDEX, zwei Fremdschlüssel — unverändert übernommen, ergänzt um IF NOT
-- EXISTS bzw. DO-Blöcke (wiederholbar: Prisma fährt eine Migration nicht in
-- einer Transaktion), lock_timeout und RLS.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): drei neue Spalten, alle nullable
-- ohne Default (kein Tabellen-Rewrite), zwei neue Tabellen mit Indizes und
-- Fremdschlüsseln auf "User". Kein DROP, kein RENAME, kein ALTER COLUMN, kein
-- UPDATE, kein Backfill. ADD COLUMN nimmt auf "User" und "Session" kurz eine
-- ACCESS-EXCLUSIVE-Sperre — lock_timeout bricht ab, statt hinter einer langen
-- Lesetransaktion jede Anmeldung warten zu lassen (wie 20261019210000_geraete).
-- DEPLOY-FENSTER: Alter Code liest die Spalten nicht und schreibt sie nicht
-- (NULL); die Tabellen kennt er nicht. Wird ein Konto gelöscht, gehen seine
-- Passkeys und Ersatzcodes per Cascade mit.
--
-- KEIN SEED, KEINE DATENÄNDERUNG: "adminSeit" bleibt für bestehende Admins
-- leer — die Projektleitung setzt es nach dem Merge per SQL. Bis dahin ist
-- die Einrichtung gesperrt, der Admin-Bereich zeigt die Pflichtseite, der
-- Hof bleibt erreichbar.
--
-- KEIN GEHEIMNIS IM KLARTEXT: "codeHash" ist HMAC-SHA256 mit dem
-- Server-Geheimnis (src/lib/ersatzcodes.ts); "publicKey" ist der öffentliche
-- Schlüssel des Passkeys, der private bleibt auf dem Gerät.
--
-- INDEX JE FREMDSCHLÜSSEL: Passkey.userId und AdminErsatzcode.userId je ein
-- eigener Index; "credentialID" eindeutig (das Plugin sucht darüber).
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls,
-- 20261019210000_geraete) — ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminSeit" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "anmeldeart" TEXT,
ADD COLUMN IF NOT EXISTS "passkeyAm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminErsatzcode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "benutztAm" TIMESTAMP(3),

    CONSTRAINT "AdminErsatzcode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Passkey_credentialID_key" ON "Passkey"("credentialID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Passkey_userId_idx" ON "Passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminErsatzcode_codeHash_key" ON "AdminErsatzcode"("codeHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminErsatzcode_userId_idx" ON "AdminErsatzcode"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AdminErsatzcode" ADD CONSTRAINT "AdminErsatzcode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE "public"."Passkey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdminErsatzcode" ENABLE ROW LEVEL SECURITY;
