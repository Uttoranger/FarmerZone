import { prisma } from '@/lib/prisma'
import { utcTag } from '@/lib/betrieb'

/*
 * Der Mail-Zähler von Admin › Betrieb (Register N18, Nr. 103). Es gibt keine
 * Mail-Tabelle — alles läuft über `sendRaw` (src/lib/email.ts), genau ein
 * Empfänger je Aufruf, und Resend zählt je Empfänger und UTC-Tag. Darum ruft
 * `sendRaw` NACH einem erfolgreichen Versand per `await import()` diese Datei:
 * so liest email.ts nie selbst Prisma und lädt den Zähler erst beim Versand
 * (ARCHITECTURE §4, die eine Ausnahme dort).
 *
 * Mehr nicht: keine Prüfung, keine Warnung (die macht der Mess-Lauf), kein
 * Rückgabewert. Fail-open entscheidet der Aufrufer (try/catch um den Aufruf).
 */

/**
 * Zählt eine verschickte Mail im UTC-Tag. EINE Anweisung (INSERT … ON
 * CONFLICT DO UPDATE): Postgres zählt atomar, auch wenn viele Instanzen
 * gleichzeitig verschicken — Vorbild `zaehleVersuche`
 * (src/server/bremse-datenbank.ts). Der Tag geht als Text JJJJ-MM-TT hinein,
 * nicht als Zeitpunkt: `::date` auf einem Zeitpunkt hinge an der Zeitzone der
 * Sitzung.
 */
export async function zaehleMail(jetzt: Date = new Date()): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "BetriebMessung" ("tag", "art", "wert", "gemessenAm")
    VALUES (${utcTag(jetzt)}::date, 'mails', 1, ${jetzt})
    ON CONFLICT ("tag", "art")
    DO UPDATE SET "wert" = "BetriebMessung"."wert" + 1, "gemessenAm" = EXCLUDED."gemessenAm"`
}
