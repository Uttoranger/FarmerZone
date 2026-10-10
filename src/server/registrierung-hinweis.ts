import { randomUUID } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { APP_URL } from '@/lib/umgebung-server'
import {
  REGISTRIERUNG_HINWEIS_FENSTER_SEKUNDEN,
  registrierungsHinweisKennung,
  registrierungsHinweisWeg,
  registrierungsHinweisZiele,
} from '@/lib/registrierung-hinweis'

/*
 * Der Hinweis an ein bestehendes Konto, wenn sich jemand mit seiner Adresse
 * registrieren wollte (Register F6 „19b", Nachtlauf Nr. 27). Better Auth ruft
 * das über `onExistingUserSignUp` (src/lib/auth.ts) — dort schon nach der
 * Antwort (`nachDerAntwort`), damit eine vergebene Adresse nicht langsamer
 * antwortet als eine neue.
 */

/**
 * Nimmt den einen Platz im Fenster — oder sagt false, wenn es schon einen
 * Hinweis gab. Die Zeile des Kontos wird gesperrt (`SELECT … FOR UPDATE` auf
 * "User"): Zwei gleichzeitige Versuche laufen nacheinander, der zweite sieht
 * den ersten. Der Zeitpunkt steht in der bestehenden Verification-Tabelle
 * (keine Schema-Änderung) und gilt damit über alle Instanzen — wie die
 * Bremse für „Erneut senden" (src/server/email-bestaetigung.ts).
 */
async function reserviereHinweis(userId: string, jetzt: Date): Promise<boolean> {
  const identifier = registrierungsHinweisKennung(userId)
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const laufend = await tx.verification.findFirst({ where: { identifier, expiresAt: { gt: jetzt } }, select: { id: true } })
    if (laufend) return false
    await tx.verification.deleteMany({ where: { identifier } })
    await tx.verification.create({
      data: {
        id: randomUUID(),
        identifier,
        value: String(jetzt.getTime()),
        expiresAt: new Date(jetzt.getTime() + REGISTRIERUNG_HINWEIS_FENSTER_SEKUNDEN * 1000),
      },
    })
    return true
  })
}

/**
 * Meldet einen gescheiterten Hinweis — nur die Art, nie Adresse oder
 * Fehlertext (ein Resend- oder Datenbanktext kann die Adresse tragen).
 */
function meldeHinweisFehler(grund: 'resend_fehler' | 'nachlauf_fehler', err?: unknown): void {
  const kontext = { tags: { aufgabe: 'registrierung-hinweis', grund } }
  if (err === undefined) {
    Sentry.captureMessage('Registrierungs-Hinweis nicht verschickt', { level: 'error', ...kontext })
    return
  }
  const meldung = new Error('Registrierungs-Hinweis nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, kontext)
}

/**
 * Schickt dem Konto den Hinweis — höchstens einmal je Fenster. Wirft nie:
 * Läuft im Nachlauf einer Registrierung, die schon geantwortet hat; ein
 * Fehler geht ohne Adresse nach Sentry.
 */
export async function sendeRegistrierungsHinweis(userId: string, jetzt: Date = new Date()): Promise<void> {
  try {
    const konto = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true, isAdmin: true } })
    if (!konto) return
    if (!(await reserviereHinweis(userId, jetzt))) return
    const weg = registrierungsHinweisWeg(konto)
    const { sendRegistrierungsHinweis } = await import('@/lib/email')
    const ergebnis = await sendRegistrierungsHinweis(konto.email, { weg, ...registrierungsHinweisZiele(weg, APP_URL) })
    // sendRaw wirft nie, ein Resend-Fehler kommt als { error } zurück.
    if (ergebnis.error) meldeHinweisFehler('resend_fehler')
  } catch (err) {
    console.error('[Registrierungs-Hinweis] Fehler:', err instanceof Error ? err.name : 'unbekannt')
    meldeHinweisFehler('nachlauf_fehler', err)
  }
}
