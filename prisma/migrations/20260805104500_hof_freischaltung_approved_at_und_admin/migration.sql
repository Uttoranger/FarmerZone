-- Offene Hof-Registrierung mit Freigabe durch den Plattformbetreiber.
--
-- Farm."approvedAt"  null = wartet auf Freigabe. Ein wartender Hof ist
--                    öffentlich unsichtbar und nimmt keine Bestellungen an.
-- User."isAdmin"     Betreiber-Recht für /admin. Bewusst orthogonal zu
--                    User."role": der Betreiber führt selbst einen Hof und
--                    muss role = 'FARMER' behalten, sonst sperrt ihn die
--                    Rollenwache in src/app/(farmer)/layout.tsx aus seinem
--                    eigenen Hofbereich aus. Kein Codepfad setzt isAdmin;
--                    der erste Admin wird einmalig per SQL gesetzt.
--
-- WARUM DER BACKFILL ZWINGEND IST
-- Die Spalte entsteht als NULL, und NULL bedeutet ab dieser Migration
-- „wartet auf Freigabe" — also öffentlich unsichtbar und keine Bestellungen.
-- Ohne den Backfill wäre der bestehende Pilothof in der Sekunde des Deploys
-- offline, samt laufender Bestellungen. Alle Höfe, die es VOR dieser
-- Migration schon gab, waren freigeschaltet; sie bekommen deshalb hier den
-- Zeitpunkt der Migration als Freigabezeitpunkt. Neue Höfe, die nach dieser
-- Migration entstehen, starten regulär mit NULL.
--
-- Die Reihenfolge ist entscheidend: erst die Spalte, dann der Backfill, in
-- derselben Migration und damit derselben Transaktion. Es darf keinen
-- Zwischenzustand geben, in dem die Spalte existiert und leer ist.
--
-- RLS bleibt unverändert — es kommen keine neuen Tabellen dazu, und die
-- bestehenden sind seit der Migration 20260804091431_enable_rls abgedeckt.

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: alle bereits bestehenden Höfe gelten als freigeschaltet.
UPDATE "Farm" SET "approvedAt" = NOW() WHERE "approvedAt" IS NULL;
