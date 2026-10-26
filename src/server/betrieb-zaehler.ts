import { prisma } from '@/lib/prisma'
import { utcTag } from '@/lib/betrieb'

/*
 * Der Mail-Zähler von Admin › Betrieb (Register N18, Nr. 103). Resend zählt
 * je Empfänger und UTC-Tag. Gezählt wird NACH einem erfolgreichen Versand aus
 * src/lib/email.ts per `await import()`: `sendRaw` (genau ein Empfänger je
 * Aufruf) zählt 1, der Stapelversand des Workers (`versendeStapel`) zählt
 * EINMAL mit der Zahl der angenommenen Mails (Nr. 170). So liest email.ts nie
 * selbst Prisma und lädt den Zähler erst beim Versand (ARCHITECTURE §4, die
 * eine Ausnahme dort).
 *
 * Mehr nicht: keine Prüfung, keine Warnung (die macht der Mess-Lauf), kein
 * Rückgabewert. Fail-open entscheidet der Aufrufer (try/catch um den Aufruf).
 */

/**
 * Zählt `menge` verschickte Mails im UTC-Tag (Standard 1). EINE Anweisung (INSERT … ON
 * CONFLICT DO UPDATE): Postgres zählt atomar, auch wenn viele Instanzen
 * gleichzeitig verschicken — Vorbild `zaehleVersuche`
 * (src/server/bremse-datenbank.ts). Der Tag geht als Text JJJJ-MM-TT hinein,
 * nicht als Zeitpunkt: `::date` auf einem Zeitpunkt hinge an der Zeitzone der
 * Sitzung.
 */
export async function zaehleMail(jetzt: Date = new Date(), menge = 1): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "BetriebMessung" ("tag", "art", "wert", "gemessenAm")
    VALUES (${utcTag(jetzt)}::date, 'mails', ${menge}, ${jetzt})
    ON CONFLICT ("tag", "art")
    DO UPDATE SET "wert" = "BetriebMessung"."wert" + EXCLUDED."wert", "gemessenAm" = EXCLUDED."gemessenAm"`
}
