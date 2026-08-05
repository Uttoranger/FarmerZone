-- Offene Hof-Registrierung mit Freigabe durch den Plattformbetreiber.
--
-- ANLASS
-- Bauern registrieren sich künftig ohne Einladungscode und richten ihren Hof
-- vollständig ein. Öffentlich sichtbar und bestellbar wird er erst, wenn der
-- Betreiber ihn im Admin-Bereich freischaltet.
--
-- Farm."approvedAt"  null = wartet auf Freigabe, Zeitstempel = freigeschaltet.
-- User."isAdmin"     Recht für /admin. Bewusst SEPARAT von User."role":
--                    role steuert den Bauernbereich (Layout prüft auf FARMER),
--                    ein Betreiber mit eigenem Hof muss beides sein können.
--
-- ⚠ DER BACKFILL IST DIE WICHTIGSTE ZEILE DIESER MIGRATION
-- "approvedAt" wird als NULL hinzugefügt. Ohne den UPDATE unten stünden ALLE
-- bereits bestehenden Höfe unmittelbar nach dem Deploy auf "wartet auf
-- Freigabe" — ihre Hofseiten wären sofort 404 und Bestellungen würden mit 409
-- abgelehnt. Der Backfill setzt deshalb jeden zum Migrationszeitpunkt
-- existierenden Hof auf freigeschaltet. Weil die Spalte im selben Schritt neu
-- entsteht, trifft `WHERE "approvedAt" IS NULL` exakt den Altbestand; später
-- angelegte Höfe bleiben unberührt und warten wie vorgesehen auf die Freigabe.
--
-- KEINE NEUE TABELLE
-- Es entstehen nur Spalten, keine Tabellen — daher ist hier kein zusätzliches
-- ENABLE ROW LEVEL SECURITY nötig (Regel aus DEVELOPMENT.md, „Neue Tabellen").
-- RLS ist seit 20260804091431_enable_rls auf allen Tabellen aktiv.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- Backfill: bestehende Höfe bleiben online (siehe Kopfkommentar)
UPDATE "Farm" SET "approvedAt" = NOW() WHERE "approvedAt" IS NULL;
