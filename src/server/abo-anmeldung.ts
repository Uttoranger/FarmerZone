import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { APP_URL } from '@/lib/umgebung-server'
import { emailAnmeldungSchritt, werbemailErlaubt, type EmailAboStand, type EmailAnmeldeSchritt } from '@/lib/abo-bestaetigung'
import { aboBestaetigungsPfad, erzeugeAboBestaetigungsToken, pruefeAboBestaetigungsToken } from '@/lib/abo-bestaetigung-token'

/*
 * Double-Opt-in für werbliche Mails (Register S11, Nachtlauf Nr. 38) — der
 * Datenbank-Teil. Die Regeln stehen rein in src/lib/abo-bestaetigung.ts.
 */

/**
 * Wer eine werbliche Mail bekommen darf — als Datenbankfilter. Dieselbe
 * Bedingung wie `werbemailErlaubt`: Haken gesetzt UND (Bestand ODER bestätigt).
 * Jede Abfrage nach Empfängern werblicher Mails nimmt diesen Filter, nie
 * `optInEmail: true` allein (tests/abo-bestaetigung-quelltext.test.ts).
 */
export const WERBEMAIL_EMPFAENGER = {
  optInEmail: true,
  OR: [{ emailOptInAngefragtAm: null }, { emailOptInBestaetigtAm: { not: null } }],
} satisfies Prisma.CustomerFarmSubscriptionWhereInput

/** Die Felder, aus denen die Regeln entscheiden — für `select`. */
export const EMAIL_ABO_STAND = {
  id: true,
  optInEmail: true,
  emailOptInAngefragtAm: true,
  emailOptInBestaetigtAm: true,
} as const

/**
 * Eine E-Mail-Anmeldung für ein bestehendes Abo (Checkout-Haken, Schalter auf
 * /account). Neue und abgemeldete Abos bekommen einen Bestätigungslink,
 * bestätigte und Bestandsabos bleiben, wie sie sind.
 *
 * Bedingt geschrieben auf genau den Stand, aus dem entschieden wurde (wie
 * „Vorrat setzen", ARCHITECTURE §5): Zwei gleichzeitige Anmeldungen
 * verschicken nur einen Link, und eine Bestätigung dazwischen wird nicht
 * überschrieben. Die Mail geht nach der Antwort; ihr Fehlschlag ändert am
 * Abo nichts.
 */
export async function meldeEmailAboAn(
  abo: { id: string } & EmailAboStand,
  jetzt: Date
): Promise<EmailAnmeldeSchritt> {
  const schritt = emailAnmeldungSchritt(abo, jetzt)
  if (schritt !== 'bestaetigung-schicken') return schritt

  const { count } = await prisma.customerFarmSubscription.updateMany({
    where: {
      id: abo.id,
      optInEmail: abo.optInEmail,
      emailOptInAngefragtAm: abo.emailOptInAngefragtAm,
      emailOptInBestaetigtAm: abo.emailOptInBestaetigtAm,
    },
    // optInEmail erst mit der Bestätigung: So schickt auch alter Code im
    // Deploy-Fenster (filtert nur nach optInEmail) keine Mail an eine
    // unbestätigte Adresse.
    data: { optInEmail: false, emailOptInAngefragtAm: jetzt, emailOptInBestaetigtAm: null },
  })
  // Eine gleichzeitige Anmeldung war schneller und hat den Link verschickt.
  if (count === 0) return 'gebremst'

  schickeBestaetigungNachDerAntwort(abo.id, jetzt)
  return schritt
}

function meldeVersandFehler(grund: 'resend_fehler' | 'nachlauf_fehler', err?: unknown): void {
  // Fester Text und Art, nie Adresse oder Hofname (sentry-hygiene).
  const kontext = { tags: { aufgabe: 'abo_bestaetigung', grund } }
  if (err === undefined) {
    Sentry.captureMessage('Abo-Bestätigung nicht verschickt', { level: 'error', ...kontext })
    return
  }
  const meldung = new Error('Abo-Bestätigung nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, kontext)
}

function schickeBestaetigungNachDerAntwort(aboId: string, angefragtAm: Date): void {
  nachDerAntwort(async () => {
    try {
      const abo = await prisma.customerFarmSubscription.findUnique({
        where: { id: aboId },
        select: { customerEmail: true, farm: { select: { name: true } } },
      })
      if (!abo) return
      const url = `${APP_URL}${aboBestaetigungsPfad(erzeugeAboBestaetigungsToken(aboId, angefragtAm))}`
      const { sendAboBestaetigung } = await import('@/lib/email')
      const ergebnis = await sendAboBestaetigung(abo.customerEmail, { hofName: abo.farm.name, url })
      // sendRaw wirft nie, ein Resend-Fehler kommt als { error } zurück.
      if (ergebnis.error) meldeVersandFehler('resend_fehler')
      // Ohne Versand (lokal ohne RESEND_API_KEY) steht der Link im Terminal —
      // nie in Produktion, auch nicht bei einem Resend-Fehler.
      if (!ergebnis.id && process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Bestätigungslink Neuigkeiten für ${abo.customerEmail}: ${url}`)
      }
    } catch (err) {
      console.error('[Abo-Bestätigung] E-Mail-Fehler:', err instanceof Error ? err.name : 'unbekannt')
      meldeVersandFehler('nachlauf_fehler', err)
    }
  })
}

export type AboBestaetigungsStand =
  | { zustand: 'offen' | 'bestaetigt'; hofName: string; hofSlug: string }
  | { zustand: 'ungueltig' | 'abgelaufen' | 'abo_weg' }

/**
 * Für die Seite hinter dem Link (GET): liest nur, bestätigt nie — Link-Scanner
 * rufen ihn ungefragt auf (ARCHITECTURE §5). „bestaetigt" heißt: Das Abo
 * bekommt schon Mails, der Knopf ist überflüssig.
 */
export async function ladeAboBestaetigung(token: string, jetzt: Date): Promise<AboBestaetigungsStand> {
  const geprueft = pruefeAboBestaetigungsToken(token, jetzt)
  if (!geprueft.ok) return { zustand: geprueft.grund }
  const abo = await prisma.customerFarmSubscription.findUnique({
    where: { id: geprueft.aboId },
    select: { ...EMAIL_ABO_STAND, farm: { select: { name: true, slug: true } } },
  })
  if (!abo || abo.emailOptInAngefragtAm === null) return { zustand: 'abo_weg' }
  return { zustand: werbemailErlaubt(abo) ? 'bestaetigt' : 'offen', hofName: abo.farm.name, hofSlug: abo.farm.slug }
}

/**
 * Der Knopf (POST): setzt `optInEmail` und den Zeitpunkt der Bestätigung —
 * bedingt, damit ein zweiter Klick den ersten Zeitpunkt (den Nachweis) nicht
 * überschreibt. Bestätigt werden nur Abos, für die ein Link angefragt wurde.
 */
export async function bestaetigeEmailAbo(token: string, jetzt: Date): Promise<AboBestaetigungsStand> {
  const geprueft = pruefeAboBestaetigungsToken(token, jetzt)
  if (!geprueft.ok) return { zustand: geprueft.grund }
  await prisma.customerFarmSubscription.updateMany({
    where: {
      id: geprueft.aboId,
      emailOptInAngefragtAm: { not: null },
      OR: [{ optInEmail: false }, { emailOptInBestaetigtAm: null }],
    },
    data: { optInEmail: true, emailOptInBestaetigtAm: jetzt },
  })
  return ladeAboBestaetigung(token, jetzt)
}
