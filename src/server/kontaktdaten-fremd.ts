import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { fremdesPasswortBeiCodeAnmeldung } from '@/lib/anmeldecode'

/**
 * Name und Telefon aus einer FREMDEN Alt-Registrierung leeren (Register B3,
 * Nr. 27). Better Auth ruft das über `databaseHooks.account.delete.before`
 * (src/lib/auth.ts), wenn die Code-Anmeldung das Passwort eines
 * unbestätigten Kontos entfernt (`fremdesPasswortBeiCodeAnmeldung`) — das
 * geschieht VOR dem Setzen von `emailVerified`, das Konto ist in diesem
 * Moment also noch unbestätigt.
 *
 * Die Bedingung steht in der WHERE-Klausel, nicht in einem vorgelagerten
 * `if`: genau dieses Konto, noch unbestätigt, CUSTOMER, kein Betreiber. Ein
 * Hof bekommt ohnehin keinen Code; hier soll trotzdem nichts durchfallen.
 *
 * Wirft nie: Ein Fehler darf die Anmeldung der echten Kundin nicht scheitern
 * lassen. Er geht aber nach Sentry — nur die Art, nie Adresse oder
 * Fehlertext (er kann die Adresse tragen).
 */
export async function leereKontaktdatenNachFremdemPasswort(
  konto: { userId: string; providerId: string },
  pfad: string | null | undefined
): Promise<void> {
  if (!fremdesPasswortBeiCodeAnmeldung({ pfad, providerId: konto.providerId })) return
  try {
    await prisma.user.updateMany({
      where: { id: konto.userId, emailVerified: false, role: 'CUSTOMER', isAdmin: false },
      data: { name: '', phone: null },
    })
  } catch (err) {
    console.error('[Code-Anmeldung] Kontaktdaten nicht geleert:', err instanceof Error ? err.name : 'unbekannt')
    const meldung = new Error('Kontaktdaten einer fremden Alt-Registrierung nicht geleert')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'anmeldecode', grund: 'kontaktdaten_nicht_geleert' }, extra: { userId: konto.userId } })
  }
}
