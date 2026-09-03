-- Grenzregion: Länderfeld für Höfe + die drei fehlenden Fremdschlüssel-Indizes.
--
-- WIEDERHOLBAR GESCHRIEBEN (`IF NOT EXISTS`). Grund, nachgemessen: Prisma
-- fährt eine Migration NICHT in einer Transaktion — bricht sie in der Mitte
-- ab, bleiben die bereits ausgeführten Anweisungen stehen, während
-- `_prisma_migrations.finished_at` leer bleibt. Ein Wiederanlauf nach
-- `migrate resolve --rolled-back` scheiterte dann an „column already
-- exists". So läuft er sauber durch.
--
-- SPERREN: `ADD COLUMN` mit Default ist seit PostgreSQL 11 metadata-only
-- (kein Tabellen-Rewrite, an einer Kopie mit 200 Höfen bestätigt: gleiche
-- relfilenode, gleiche Größe, Laufzeit unter zwei Sekunden). Es braucht
-- trotzdem kurz ACCESS EXCLUSIVE — `lock_timeout` sorgt dafür, dass eine
-- lange offene Lesetransaktion die Migration abbrechen lässt, statt alle
-- nachfolgenden Zugriffe hinter ihr aufzustauen.
--
-- Die drei Indizes entstehen OHNE `CONCURRENTLY`: gemessen an heutigen
-- Zeilenzahlen (60k/40k/120k) zusammen rund 200 ms Schreibsperre, Lesen
-- bleibt frei. Sollte das später zu lang werden, ist `CONCURRENTLY` hier
-- möglich — gerade WEIL Prisma ohne Transaktion fährt (geprüft).
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'AT';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManualSale_productId_idx" ON "ManualSale"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
