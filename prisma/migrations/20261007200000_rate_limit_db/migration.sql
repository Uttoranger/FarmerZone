-- Bremse über alle Instanzen (Register R1, Nachtlauf Nr. 40, freigabe.md §11
-- „40"): eine neue Tabelle mit Schlüssel, Fenster und Zähler.
--
-- NUR ADDITIV (Expand, ARCHITECTURE §5): eine neue Tabelle und ein Index.
-- Kein DROP, kein ALTER COLUMN, kein UPDATE auf Bestandszeilen; keine
-- bestehende Tabelle wird angefasst. DEPLOY-FENSTER: Alter Code kennt die
-- Tabelle nicht und läuft unverändert weiter.
--
-- ERZEUGT nach Regel 3 in docs/nachtlauf.md (`prisma migrate diff
-- --from-schema <Schema von main> --to-schema prisma/schema.prisma --script`),
-- danach wiederholbar gemacht (IF NOT EXISTS): Prisma fährt eine Migration
-- nicht in einer Transaktion.
--
-- KEINE PERSONENDATEN: "schluessel" ist der Zweck plus ein gekürzter HMAC des
-- Merkmals (IP, Adresse, Sitzung) mit dem Server-Geheimnis
-- (src/lib/bremse-datenbank.ts) — nie das Merkmal selbst.
--
-- RLS wie auf allen Tabellen im public-Schema (20260804091431_enable_rls) —
-- ohne Policies, ohne FORCE.
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "RateLimitZaehler" (
    "schluessel" TEXT NOT NULL,
    "fensterStart" TIMESTAMP(3) NOT NULL,
    "zaehler" INTEGER NOT NULL DEFAULT 0,
    "ablauf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitZaehler_pkey" PRIMARY KEY ("schluessel","fensterStart")
);

-- Für das Aufräumen im Cron (ablauf < jetzt).
CREATE INDEX IF NOT EXISTS "RateLimitZaehler_ablauf_idx" ON "RateLimitZaehler"("ablauf");

ALTER TABLE "public"."RateLimitZaehler" ENABLE ROW LEVEL SECURITY;
