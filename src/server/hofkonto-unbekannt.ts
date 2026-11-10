import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { protokolliere } from '@/server/admin-protokoll'

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
 *    nie zurückgesetzt wird. Dreht sich der Wert, steht es im Protokoll
 *    („Online-Zahlung pausiert“, Grund konto_unbekannt; N33, N49), und der
 *    gespeicherte grobe Stand wird gelöscht (Anzeige „Angaben fehlen“). Danach bietet der Checkout Online nicht mehr an
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
    const { count } = await prisma.farm.updateMany({
      where: { id: farmId, stripeAccountId, stripeAccountReady: true },
      data: { stripeAccountReady: false },
    })
    // Der Bereit-Wert hat sich gedreht: ins Protokoll (Register N33, N49).
    // protokolliere wirft nie.
    if (count === 1) {
      await protokolliere({ wer: null, art: 'online_zahlung_pausiert', bezugArt: 'hof', bezugId: farmId, mitPasskey: false, grund: 'konto_unbekannt' })
    }
  } catch (err) {
    meldeVermerkGescheitert(err, farmId)
  }
  // Unabhängig davon den gespeicherten Stand löschen (Register N49): Die
  // Anzeige gilt dann als „Angaben fehlen“, und der Weg „Bei Stripe ergänzen“
  // → „Einrichtung fortsetzen“ → „neu einrichten“ greift. Bedingt auf genau
  // diese Kennung, wie oben.
  try {
    await prisma.farm.updateMany({ where: { id: farmId, stripeAccountId }, data: { stripeKontoStand: null } })
  } catch (err) {
    meldeVermerkGescheitert(err, farmId)
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

/** Nur die Art des Fehlers: Ein Prisma-Text kann die Kennung tragen. */
function meldeVermerkGescheitert(err: unknown, farmId: string): void {
  const meldung = new Error('Hof-Konto nicht als „nicht bereit" vermerkt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  try {
    Sentry.captureException(meldung, { tags: { aufgabe: 'stripe-konto', grund: 'vermerk_gescheitert' }, extra: { farmId } })
  } catch {
    // Telemetrie scheitert leise.
  }
}

/**
 * Das Stripe-Konto eines Hofs liegt in einem anderen Land als der Hof
 * (Nachtlauf 23, Nr. 152) — typisch ein Konto, das vor der Landwahl mit
 * Österreich angelegt wurde. Es ändert sich NICHTS am Konto (Stripe stellt
 * das Land nicht um, ein stilles Ersetzen ließe Geld hängen): Der Betreiber
 * bekommt eine Meldung, höchstens einmal je Hof und Tag, nur mit Hof-ID und
 * den beiden Länderkürzeln — wie bei `vermerkeUnbekanntesHofKonto`. Fehlt das
 * Konto-Land oder stimmt es überein, passiert nichts. Wirft nie.
 */
export async function meldeAbweichendesKontoLand(
  farmId: string,
  kontoLand: string | null | undefined,
  hofLand: string,
  jetzt: Date = new Date()
): Promise<void> {
  try {
    if (!kontoLand) return
    const konto = kontoLand.toUpperCase()
    if (konto === hofLand) return

    let melden = true
    try {
      melden = await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.stripeKontoLand, merkmal: farmId }], jetzt)
    } catch {
      melden = true
    }
    if (!melden) return
    Sentry.captureMessage('Stripe-Konto eines Hofs liegt in einem anderen Land als der Hof', {
      level: 'warning',
      tags: { aufgabe: 'stripe-konto', grund: 'konto_land_abweichend' },
      extra: { farmId, kontoLand: konto, hofLand },
    })
  } catch {
    // Telemetrie scheitert leise.
  }
}
