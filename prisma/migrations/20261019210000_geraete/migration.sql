-- Angemeldete Geräte, Mail bei neuem Gerät, „Das war ich nicht" (Register E7,
-- Ergänzung Lauf 17; Nachtlauf Nr. 114): zwei neue Tabellen — die Geräte, die
-- ein Konto schon kennt (BekanntesGeraet), und Links aus Mails, die genau
-- einmal und nur bis zu einer Frist gelten (EinmalLink).
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show 82b5936:prisma/schema.prisma > <scratchpad>/schema-vor-114.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-114.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: zwei CREATE TABLE, drei CREATE INDEX, zwei Fremdschlüssel —
-- unverändert übernommen, ergänzt um IF NOT EXISTS bzw. DO-Blöcke
-- (wiederholbar: Prisma fährt eine Migration nicht in einer Transaktion),
-- lock_timeout und RLS.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): zwei neue Tabellen mit Indizes und
-- Fremdschlüsseln auf "User". Kein DROP, kein RENAME, kein ALTER COLUMN, kein
-- UPDATE, kein Backfill; keine bestehende Tabelle bekommt eine Spalte ("User"
-- bekommt nur die Rückrelation im Prisma-Schema). Die Fremdschlüssel sperren
-- "User" nur kurz (die neuen Tabellen sind leer) — lock_timeout begrenzt das.
-- DEPLOY-FENSTER: Alter Code kennt die Tabellen nicht und läuft unverändert;
-- wird ein Konto gelöscht, gehen seine Zeilen per Cascade mit.
--
-- KEIN SEED, KEINE DATENÄNDERUNG: Das erste Gerät eines Kontos merkt sich die
-- nächste Anmeldung still (keine Mail) — so bekommt nach dem Deploy nicht
-- jeder Hof eine Warnung.
--
-- KEINE IP-ADRESSE, KEIN ORT, KEIN TOKEN IM KLARTEXT: "kennungHash" und
-- "tokenHash" sind HMAC-SHA256 mit dem Server-Geheimnis (src/lib/geraete.ts);
-- die Kennung steht nur im Cookie des Geräts, der Token nur im Link der Mail.
-- "name" ist Gerät und Browser in festen Wörtern („iPhone · Safari"), nie die
-- volle Browserangabe.
--
-- INDEX JE FREMDSCHLÜSSEL: BekanntesGeraet.userId vorn im eindeutigen Index
-- (userId, kennungHash), EinmalLink.userId eigener Index.
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls,
-- 20261016130000_betrieb) — ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "BekanntesGeraet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kennungHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "erstmalsAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zuletztAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BekanntesGeraet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EinmalLink" (
    "id" TEXT NOT NULL,
    "zweck" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ablaufAm" TIMESTAMP(3) NOT NULL,
    "benutztAm" TIMESTAMP(3),

    CONSTRAINT "EinmalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BekanntesGeraet_userId_kennungHash_key" ON "BekanntesGeraet"("userId", "kennungHash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EinmalLink_tokenHash_key" ON "EinmalLink"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EinmalLink_userId_idx" ON "EinmalLink"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "BekanntesGeraet" ADD CONSTRAINT "BekanntesGeraet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EinmalLink" ADD CONSTRAINT "EinmalLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS
ALTER TABLE "public"."BekanntesGeraet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EinmalLink" ENABLE ROW LEVEL SECURITY;
