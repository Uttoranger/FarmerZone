import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'

/**
 * Eine Nachricht des Systems an einen Hof: Art SYSTEM, eigener Faden, ohne
 * Absender-Hof — nach dem Muster der Ankündigung der Plattformgebühr
 * (src/server/plattformgebuehr-abrechnung.ts, das selbst unverändert bleibt).
 * Eine Nachricht hat nur Text und Link, keine Überschrift.
 *
 * Wirft nie und gibt zurück, ob die Nachricht steht: Sie ist Nachlauf eines
 * Wechsels, der schon gespeichert ist (Register N49) — ein Fehler hier darf
 * nichts zurückrollen und keine Antwort ändern. Sentry bekommt nur die Art
 * des Fehlers und die Hof-ID, nie den Text.
 */
export async function schreibeSystemNachricht(farmId: string, text: string, linkUrl: string): Promise<boolean> {
  try {
    const jetzt = new Date()
    await prisma.unterhaltung.create({
      data: {
        farmId,
        rundschreibenId: null,
        letzteNachrichtAm: jetzt,
        nachrichten: { create: { vonFarmId: null, text, linkUrl, art: 'SYSTEM', createdAt: jetzt } },
      },
      select: { id: true },
    })
    return true
  } catch (err) {
    try {
      const meldung = new Error('System-Nachricht an den Hof nicht angelegt')
      meldung.name = err instanceof Error ? err.name : 'Unbekannt'
      Sentry.captureException(meldung, { level: 'warning', tags: { aufgabe: 'postfach-system' }, extra: { farmId } })
    } catch {
      // Telemetrie scheitert leise.
    }
    return false
  }
}
