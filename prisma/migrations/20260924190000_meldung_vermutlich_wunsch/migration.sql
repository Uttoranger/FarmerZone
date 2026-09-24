-- Sprint Briefkasten-Rückkopplung: neuer Triage-Status VERMUTLICH_WUNSCH.
-- Die KI hält eine Fehler-Meldung für einen Wunsch und schlägt das vor; ob es
-- einer ist, entscheidet der Mensch im Admin (DEVELOPMENT.md → Triage).
--
-- ADDITIV und nur Katalog: kein Umschreiben, keine Sperre auf "Meldung".
-- WIEDERHOLBAR wie die übrigen Migrationen (IF NOT EXISTS).
-- Der Wert wird hier nur angelegt, nie benutzt — PostgreSQL erlaubt die
-- Nutzung erst nach dem Commit.
-- DEPLOY-FENSTER: Alter Code sieht den Wert nie; nur die neue Schreibroute
-- setzt ihn.
-- ENDGÜLTIG: PostgreSQL kennt kein DROP VALUE. Code von vor diesem Sprint
-- WIRFT beim Lesen einer Meldung mit diesem Wert — vor einem Rückrollen erst
-- das UPDATE aus DEVELOPMENT.md → Triage („Rückrollen hinter diesen Sprint").
SET lock_timeout = '5s';

ALTER TYPE "MeldungStatus" ADD VALUE IF NOT EXISTS 'VERMUTLICH_WUNSCH' AFTER 'GEPRUEFT';
