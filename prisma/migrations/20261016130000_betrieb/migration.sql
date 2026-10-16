-- Admin › Betrieb (Register N18 neu, N15 geändert; Nachtlauf Nr. 103, Freigabe
-- §20): drei neue Tabellen — je Tag und Wert eine Messung (BetriebMessung), der
-- Herzschlag der Abläufe (AblaufLauf) und die zuletzt gemeldete Warnstufe
-- (BetriebWarnung).
--
-- Erzeugt nach Regel 3 in docs/nachtlauf.md:
--   git show 43a5076:prisma/schema.prisma > <scratchpad>/schema-vor-103.prisma
--   pnpm exec prisma migrate diff --from-schema <scratchpad>/schema-vor-103.prisma \
--     --to-schema prisma/schema.prisma --script
-- Ausgabe: drei CREATE TABLE mit Primärschlüssel — unverändert übernommen,
-- ergänzt um IF NOT EXISTS (wiederholbar, der Primärschlüssel steht in der
-- Anweisung und entsteht nur mit der Tabelle: Prisma fährt eine Migration
-- nicht in einer Transaktion), lock_timeout und RLS.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): drei neue Tabellen. Kein DROP, kein
-- RENAME, kein ALTER COLUMN, keine bestehende Tabelle wird angefasst.
-- DEPLOY-FENSTER: Alter Code kennt die Tabellen nicht und läuft unverändert
-- weiter.
--
-- KEIN SEED, KEINE DATENÄNDERUNG: Die erste Messung schreibt der Ablauf
-- /api/cron/betrieb bzw. „Jetzt messen“; ohne Zeile zeigt Admin › Betrieb
-- „noch nicht gemessen“ bzw. „noch kein Lauf“.
--
-- KEINE PERSONENDATEN, KEINE INHALTE: Gespeichert werden nur Zahlen (Bytes,
-- Dateien, Mails je Tag), die Namen der Abläufe und Arten aus festen Listen
-- (src/lib/betrieb.ts) und Zeitpunkte. "fehlerKlasse" ist die einzige
-- Textspalte außer Namen und Arten — nur die Klasse des Fehlers (Error.name),
-- nie seine Nachricht.
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls,
-- 20261007200000_rate_limit_db) — ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "BetriebMessung" (
    "tag" DATE NOT NULL,
    "art" TEXT NOT NULL,
    "wert" BIGINT NOT NULL,
    "gemessenAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetriebMessung_pkey" PRIMARY KEY ("tag","art")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AblaufLauf" (
    "name" TEXT NOT NULL,
    "gestartetAm" TIMESTAMP(3) NOT NULL,
    "beendetAm" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL,
    "fehlerKlasse" TEXT,
    "dauerMs" INTEGER,

    CONSTRAINT "AblaufLauf_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BetriebWarnung" (
    "art" TEXT NOT NULL,
    "stufe" INTEGER NOT NULL,
    "seit" TIMESTAMP(3) NOT NULL,
    "gemeldetAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetriebWarnung_pkey" PRIMARY KEY ("art")
);

ALTER TABLE "public"."BetriebMessung" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AblaufLauf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BetriebWarnung" ENABLE ROW LEVEL SECURITY;
