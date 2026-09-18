-- Fehlerbriefkasten: Tabelle "Meldung" mit den Enums MeldungArt und MeldungStatus.
--
-- GRUNDSATZ (auch im Schema): Der Briefkasten ist ein Eingangskanal, kein
-- Befehlskanal. Aus Meldungen entstehen Vorschläge; entscheiden und mergen tut
-- ausschließlich der Betreiber. Wünsche werden gebündelt und gezählt, nie
-- automatisch zu Aufgaben.
--
-- WIEDERHOLBAR GESCHRIEBEN, Vorbild 20260831163847_grenzregion_country_und_fk_indizes:
-- Prisma fährt eine Migration NICHT in einer Transaktion — bricht sie in der
-- Mitte ab, bleiben die bereits ausgeführten Anweisungen stehen, während
-- `_prisma_migrations.finished_at` leer bleibt. Deshalb `IF NOT EXISTS` für
-- Tabelle und Indizes; für die beiden Enum-Typen und den Fremdschlüssel, die
-- kein `IF NOT EXISTS` kennen, ein DO-Block, der „existiert schon" schluckt.
-- Auf einer Probe-Datenbank zweimal hintereinander ausgeführt: läuft sauber durch.
--
-- SPERREN: Neue Tabelle, neue Typen — keine bestehende Tabelle wird umgebaut;
-- der Fremdschlüssel nimmt kurz ein Schloss auf "Farm" (Validierung gegen die
-- leere neue Tabelle, Millisekunden). `lock_timeout` wie im Vorbild.
--
-- RLS: wie alle Tabellen im public-Schema (20260804091431_enable_rls) — ohne
-- Policies, ohne FORCE. Die App verbindet als Eigentümerrolle und umgeht RLS
-- gewollt; die API-Rollen anon/authenticated bleiben ausgesperrt. Der
-- Supabase-Advisor meldet dafür INFO (rls_enabled_no_policy), kein ERROR —
-- dieser Zustand ist gewollt und bleibt erhalten.
SET lock_timeout = '5s';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MeldungArt" AS ENUM ('FEHLER', 'WUNSCH', 'FRAGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MeldungStatus" AS ENUM ('NEU', 'GEPRUEFT', 'GEPLANT', 'ERLEDIGT', 'KEIN_FEHLER', 'DUPLIKAT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Meldung" (
    "id" TEXT NOT NULL,
    "art" "MeldungArt" NOT NULL,
    "text" TEXT NOT NULL,
    "seiteUrl" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "viewport" TEXT NOT NULL,
    "farmId" TEXT,
    "customerEmail" TEXT,
    "screenshotUrl" TEXT,
    "diagKennung" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MeldungStatus" NOT NULL DEFAULT 'NEU',
    "clusterKey" TEXT,
    "triageNotiz" TEXT,
    "duplikatVonId" TEXT,
    "sprintName" TEXT,
    "triagedAt" TIMESTAMP(3),
    "antwortAnMelder" TEXT,

    CONSTRAINT "Meldung_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Meldung_status_idx" ON "Meldung"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Meldung_clusterKey_idx" ON "Meldung"("clusterKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Meldung_farmId_idx" ON "Meldung"("farmId");

-- AddForeignKey (SET NULL: ein gelöschter Hof lässt seine Meldungen als hoflos stehen)
DO $$ BEGIN
  ALTER TABLE "Meldung" ADD CONSTRAINT "Meldung_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Row-Level-Security wie auf allen Tabellen im public-Schema (siehe Kopf)
ALTER TABLE "public"."Meldung" ENABLE ROW LEVEL SECURITY;
