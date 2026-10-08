import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'

/**
 * Stripe kennt das gespeicherte Konto eines Hofs nicht (Register Z2,
 * Nachtlauf Nr. 42) — erkannt an den Stellen, die das Hof-Konto benutzen
 * (src/lib/stripe-konto.ts): im Checkout mit `istUnbekanntesStripeKonto`,
 * bei Kontostatus, Einrichtungs- und Login-Link und der Rückkehr aus dem
 * Onboarding mit `istUnzugaenglichesStripeKonto` (dort zählt auch „kein
 * Zugriff"). Typisch nach der Live-Umstellung: Das Konto stammt aus dem
 * Testmodus.
 *
 * 1. Der Hof gilt als NICHT BEREIT: `stripeAccountReady` auf false — bedingt
 *    auf genau diese Kennung, damit ein inzwischen neu eingerichtetes Konto
 *    nie zurückgesetzt wird. Danach bietet der Checkout Online nicht mehr an
 *    (wie ohne Konto, Z1), und der Hof sieht in den Einstellungen den Weg
 *    „Online-Zahlung neu einrichten".
 * 2. Die Kennung bleibt stehen — NIE automatisch löschen: Ein falsch
 *    gesetzter Schlüssel in der Produktion ließe sonst jedes Hof-Konto
 *    verschwinden. Ersetzen darf sie nur der Hof selbst, wenn er neu
 *    einrichtet und Stripe das alte Konto dabei nachweislich nicht kennt
 *    (`createConnectAccount`).
 * 3. Sentry höchstens einmal je Hof und Tag, nur mit der Hof-ID — gezählt in
 *    der Bremse über alle Instanzen (gehashter Schlüssel, Nr. 40). Scheitert
 *    die Zählung, wird gemeldet (fail-open der Drossel: lieber einmal zu viel).
 *
 * Wirft nie: Der Vermerk sitzt auf Fehlerwegen, die danach noch antworten
 * müssen — der Kundin mit ihrem Satz, dem Hof mit seinem Weg.
 */
export async function vermerkeUnbekanntesHofKonto(
  farmId: string,
  stripeAccountId: string,
  jetzt: Date = new Date()
): Promise<void> {
  try {
    await prisma.farm.updateMany({
      where: { id: farmId, stripeAccountId, stripeAccountReady: true },
      data: { stripeAccountReady: false },
    })
  } catch (err) {
    // Nur die Art des Fehlers: Ein Prisma-Text kann die Kennung tragen.
    const meldung = new Error('Hof-Konto nicht als „nicht bereit" vermerkt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    try {
      Sentry.captureException(meldung, { tags: { aufgabe: 'stripe-konto', grund: 'vermerk_gescheitert' }, extra: { farmId } })
    } catch {
      // Telemetrie scheitert leise.
    }
  }

  let melden = true
  try {
    melden = await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.stripeKontoUnbekannt, merkmal: farmId }], jetzt)
  } catch {
    melden = true
  }
  if (!melden) return
  try {
    Sentry.captureMessage('Stripe kennt das gespeicherte Konto eines Hofs nicht', {
      level: 'warning',
      tags: { aufgabe: 'stripe-konto', grund: 'konto_unbekannt' },
      extra: { farmId },
    })
  } catch {
    // Telemetrie scheitert leise.
  }
}
