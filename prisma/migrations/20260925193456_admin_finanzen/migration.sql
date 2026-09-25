-- Admin-Finanzen: Tabelle "Kostenposten" mit den Enums KostenKategorie und
-- KostenRhythmus. Was die Plattform an laufenden Kosten hat, trägt der
-- Betreiber einmal ein; die Einnahmen kommen aus den Bestellungen.
--
-- KEINE bestehende Tabelle wird angefasst: neue Typen, neue Tabelle, kein
-- Fremdschlüssel, kein ALTER und kein DROP an Bestehendem. Expand/Contract
-- (ARCHITECTURE §5) ist damit nicht betroffen — im Deploy-Fenster liest alter
-- Code diese Tabelle einfach nicht.
--
-- ab und bis sind DATE, nicht TIMESTAMP: Ein Monat ist ein Kalenderdatum, kein
-- Zeitpunkt. Als Zeitstempel könnte die Umrechnung zwischen Wiener Zeit und UTC
-- einen Posten in den Vormonat schieben. Gespeichert wird immer der Erste eines
-- Monats.
--
-- KEIN INDEX: Die Tabelle bleibt zweistellig, und die Finanzseite liest alle
-- Posten auf einmal (das Fenster ab…bis entscheidet die reine Funktion in
-- src/lib/finanzen.ts, nicht die Datenbank). Ein Index auf einer Tabelle mit
-- zwölf Zeilen kostet Schreibarbeit und spart nichts.
--
-- WIEDERHOLBAR GESCHRIEBEN, Vorbild 20260917200903_fehlerbriefkasten: Prisma
-- fährt eine Migration nicht in einer Transaktion. Bricht sie in der Mitte ab,
-- bleiben ausgeführte Anweisungen stehen, während finished_at leer bleibt.
-- Deshalb IF NOT EXISTS für die Tabelle und der DO-Block für die Enums.
--
-- RLS: wie alle Tabellen im public-Schema (20260804091431_enable_rls) — ohne
-- Policies, ohne FORCE. Die App verbindet als Eigentümerrolle und umgeht RLS
-- gewollt; anon/authenticated der Daten-API bleiben ausgesperrt. Der
-- Supabase-Advisor meldet dafür INFO (rls_enabled_no_policy), kein ERROR.
SET lock_timeout = '5s';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "KostenKategorie" AS ENUM ('HOSTING', 'DATENBANK', 'KI', 'WERKZEUGE', 'DOMAIN', 'EMAIL', 'SONSTIGES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "KostenRhythmus" AS ENUM ('MONATLICH', 'JAEHRLICH', 'EINMALIG');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Kostenposten" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kategorie" "KostenKategorie" NOT NULL,
    "betrag" DECIMAL(10,2) NOT NULL,
    "rhythmus" "KostenRhythmus" NOT NULL,
    "ab" DATE NOT NULL,
    "bis" DATE,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kostenposten_pkey" PRIMARY KEY ("id")
);

-- Row-Level-Security wie auf allen Tabellen im public-Schema (siehe Kopf)
ALTER TABLE "Kostenposten" ENABLE ROW LEVEL SECURITY;
