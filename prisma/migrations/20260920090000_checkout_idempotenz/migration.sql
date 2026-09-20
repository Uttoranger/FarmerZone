-- Idempotenz des Checkouts (Bug-Report Befund 4).
--
-- Der Browser erzeugt beim Öffnen des Checkouts einen Schlüssel; der Server
-- speichert ihn an der Bestellung. Ein zweiter Request mit demselben Schlüssel
-- gibt die bestehende Bestellung zurück, statt eine zweite anzulegen.
--
-- WIEDERHOLBAR GESCHRIEBEN wie die übrigen Migrationen des Repos: Prisma fährt
-- eine Migration nicht in einer Transaktion. Bricht sie in der Mitte ab,
-- bleibt das bereits Ausgeführte stehen — deshalb `IF NOT EXISTS`.
--
-- SPERREN: Das Hinzufügen einer Spalte OHNE Vorgabewert ist in PostgreSQL seit
-- Version 11 eine reine Katalogänderung, also praktisch augenblicklich. Der
-- eindeutige Index sperrt Schreibzugriffe auf "Order" für die Dauer des Aufbaus;
-- bei den Mengen des Pilotbetriebs sind das Millisekunden. (Bei einer großen
-- Tabelle wäre CREATE UNIQUE INDEX CONCURRENTLY der Weg — das ist hier bewusst
-- nicht nötig und wäre fehleranfälliger, weil ein Abbruch einen ungültigen
-- Index hinterlässt.)
--
-- Bestandsdaten: keine. Die Spalte bleibt für alle bestehenden Bestellungen
-- NULL; in PostgreSQL schließen sich mehrere NULL-Werte in einem UNIQUE nicht
-- gegenseitig aus, ein Backfill ist also weder nötig noch sinnvoll.
SET lock_timeout = '5s';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
