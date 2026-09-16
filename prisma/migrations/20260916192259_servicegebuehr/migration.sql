-- Servicegebühr: Hofeinstellung (Farm) und Bestell-Snapshot (Order).
--
-- WAS: Die Kundin zahlt eine Servicegebühr auf den Warenpreis; der Hof behält
-- immer 100 % Warenpreis. Der Betreiber stellt PRO HOF ein, ab wann und wie
-- viel gilt (serviceFeeActiveFrom = null → gebührenfrei, das ist die
-- Voreinstellung für jeden Hof). Jede Bestellung friert Gebühr und Prozentsatz
-- zur Bestellzeit ein (Snapshot) — eine spätere Änderung der Hofeinstellung
-- lässt bestehende Bestellungen unverändert.
--
-- KEIN BACKFILL: Bestandsbestellungen behalten serviceFeeCents = 0 (Default),
-- serviceFeePercentApplied bleibt NULL. Es wird keine Zeile umgeschrieben.
-- "totalAmount" bleibt der WARENPREIS; die Gebühr steht daneben in Cent.
--
-- WIEDERHOLBAR GESCHRIEBEN (`IF NOT EXISTS`), Vorbild
-- 20260831163847_grenzregion_country_und_fk_indizes: Prisma fährt eine
-- Migration NICHT in einer Transaktion — bricht sie in der Mitte ab, bleiben
-- die bereits ausgeführten Anweisungen stehen, während
-- `_prisma_migrations.finished_at` leer bleibt. Ein Wiederanlauf scheiterte
-- sonst an „column already exists". Auf einer Probe-Datenbank zweimal
-- hintereinander ausgeführt: läuft sauber durch.
--
-- SPERREN: `ADD COLUMN` mit konstantem Default ist seit PostgreSQL 11
-- metadata-only (kein Tabellen-Rewrite), braucht aber kurz ACCESS EXCLUSIVE.
-- `lock_timeout` sorgt dafür, dass eine lange offene Lesetransaktion die
-- Migration abbrechen lässt, statt alle nachfolgenden Zugriffe hinter ihr
-- aufzustauen. Sechs Spalten in zwei Anweisungen — je Tabelle ein Schloss.
SET lock_timeout = '5s';

-- AlterTable: Hofeinstellung
ALTER TABLE "Farm"
  ADD COLUMN IF NOT EXISTS "serviceFeePercent"    DECIMAL(5,2) NOT NULL DEFAULT 4.9,
  ADD COLUMN IF NOT EXISTS "serviceFeeMinCents"   INTEGER      NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "serviceFeeActiveFrom" TIMESTAMP(3);

-- AlterTable: Bestell-Snapshot
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "serviceFeeCents"          INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "serviceFeePercentApplied" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "serviceFeeRefundedAt"     TIMESTAMP(3);
