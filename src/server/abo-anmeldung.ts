import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { APP_URL } from '@/lib/umgebung-server'
import { emailAnmeldungSchritt, werbemailErlaubt, type EmailAboStand, type EmailAnmeldeSchritt } from '@/lib/abo-bestaetigung'
import { aboBestaetigungsPfad, erzeugeAboBestaetigungsToken, pruefeAboBestaetigungsToken } from '@/lib/abo-bestaetigung-token'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'

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
 * Eine E-Mail-Anmeldung für ein bestehendes Abo (Bestätigungsseite einer
 * Bestellung seit Nr. 46, Schalter auf /account). Neue und abgemeldete Abos
 * bekommen einen Bestätigungslink, bestätigte und Bestandsabos bleiben, wie
 * sie sind.
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

  await stelleBestaetigungEin(abo.id, jetzt)
  return schritt
}

function meldeEinstellFehler(err: unknown): void {
  // Fester Text und Art, nie Adresse oder Hofname (sentry-hygiene).
  const meldung = new Error('Abo-Bestätigung nicht eingestellt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, { tags: { aufgabe: 'abo_bestaetigung', grund: 'einstellen_fehler' } })
}

/**
 * Die Bestätigungsmail ist ein Auftrag der Warteschlange (Wichtig, Nr. 159):
 * Im Auftrag steht nur das Abo, den Link signiert der Renderer beim Versand
 * frisch aus Abo und Anfragezeitpunkt (src/server/mail-arten/kundin.ts). Ein
 * Fehler beim Einstellen ändert am Abo nichts.
 */
async function stelleBestaetigungEin(aboId: string, angefragtAm: Date): Promise<void> {
  try {
    const abo = await prisma.customerFarmSubscription.findUnique({ where: { id: aboId }, select: { farmId: true } })
    if (!abo) return
    // Erst hier geladen: Seiten unter /account binden diese Datei ein, die Warteschlange samt Renderern brauchen sie nicht.
    const [{ stelleMailEin }, { aboBestaetigungAuftrag }] = await Promise.all([import('@/server/mail-warteschlange'), import('@/server/mail-arten/kundin')])
    await stelleMailEin(aboBestaetigungAuftrag({ id: aboId, farmId: abo.farmId }, angefragtAm))
    // Ohne Versand (lokal ohne RESEND_API_KEY) steht der Link im Terminal —
    // nie in Produktion. Ohne Adresse: Die Abo-ID reicht, um ihn zuzuordnen.
    if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
      console.log(`[DEV] Bestätigungslink Neuigkeiten (Abo ${aboId}): ${APP_URL}${aboBestaetigungsPfad(erzeugeAboBestaetigungsToken(aboId, angefragtAm))}`)
    }
  } catch (err) {
    console.error('[Abo-Bestätigung] Einstellen gescheitert:', err instanceof Error ? err.name : 'unbekannt')
    meldeEinstellFehler(err)
  }
}

/**
 * Löst eine offene, unbestätigte Anfrage auf (Ausschalten auf /account,
 * Abmeldelink): `emailOptInAngefragtAm` zurück auf null, `optInEmail` false.
 * Danach ist das Abo „nie angefragt, ohne Haken" — keine Mail, und ein alter
 * Link findet seine Anfrage nicht mehr (an den Zeitpunkt gebunden). Den
 * Haken setzt danach nur wieder `bestaetigeEmailAbo`; eine neue Anmeldung
 * geht über `meldeEmailAboAn` und verlangt einen neuen Link. Bestätigte Abos
 * behalten ihre Zeitpunkte (Nachweis); ihr alter Link greift nicht mehr, weil
 * die Bestätigung schon gesetzt ist.
 *
 * ACHTUNG, verzögert: Das Ergebnis ist ein Prisma-Promise, das erst mit
 * `await` (bzw. `.then`) oder als Schritt in `prisma.$transaction([...])`
 * läuft. Wer es nur aufruft und liegen lässt, ändert nichts.
 *
 * @returns Den noch nicht ausgeführten Schritt; ausgeführt liefert er die
 *   Zahl der aufgelösten Anfragen (`count`).
 */
export function loeseOffeneAnfrageAuf(
  wo: Prisma.CustomerFarmSubscriptionWhereInput
): Prisma.PrismaPromise<Prisma.BatchPayload> {
  // Ohne await: Der Aufrufer stellt den Schritt in eine $transaction VOR das
  // Ausschalten (Reihenfolge siehe updateSubscription).
  return prisma.customerFarmSubscription.updateMany({
    where: { ...wo, emailOptInAngefragtAm: { not: null }, emailOptInBestaetigtAm: null },
    data: { optInEmail: false, emailOptInAngefragtAm: null },
  })
}

/**
 * Abmelden mit dem signierten Link aus einer werblichen Mail — derselbe Weg
 * für den Knopf auf der Seite (`unsubscribeWithToken`) und die Ein-Klick-
 * Abmeldung des Mailprogramms (`/api/abmelden`, RFC 8058, Nr. 47).
 *
 * Erst die offene Anfrage auflösen, dann E-Mail und WhatsApp aus, in einer
 * Transaktion (Reihenfolge wie beim Ausschalten auf /account): Ein alter
 * Bestätigungslink meldet danach niemanden wieder an (S11, Nachbesserung
 * Runde 1). Idempotent: Ein zweiter Aufruf trifft nichts mehr. Ob es ein Abo
 * gab, sagt das Ergebnis nicht — nur, ob der Token gilt.
 */
export async function meldeAboMitTokenAb(token: string): Promise<{ gueltig: boolean }> {
  const daten = verifyUnsubscribeToken(token)
  if (!daten) return { gueltig: false }
  await meldeAboAb({ customerEmail: daten.email.toLowerCase(), farmId: daten.farmId })
  return { gueltig: true }
}

/**
 * Die eine Abmeldung eines Abos — für den Abmeldelink (`meldeAboMitTokenAb`)
 * und, ohne Token, für eine Zustellmeldung von Resend (harter Bounce oder
 * Spam gemeldet zu einem Beitrag, Register N26, Nr. 160, über die Kennung des
 * Abos aus dem Bezug des Auftrags). Erst die offene Anfrage auflösen, dann
 * E-Mail und WhatsApp aus, in einer Transaktion. Idempotent.
 *
 * Bewusst nur diese zwei Formen: Eine freie Bedingung könnte leer sein und
 * träfe dann jedes Abo.
 */
export async function meldeAboAb(wo: { customerEmail: string; farmId: string } | { id: string }): Promise<void> {
  await prisma.$transaction([
    loeseOffeneAnfrageAuf(wo),
    prisma.customerFarmSubscription.updateMany({
      where: wo,
      data: { optInEmail: false, optInWhatsApp: false },
    }),
  ])
}

export type AboBestaetigungsStand =
  | { zustand: 'offen' | 'bestaetigt'; hofName: string; hofSlug: string }
  | { zustand: 'ungueltig' | 'abgelaufen' | 'ueberholt' | 'abo_weg' }

/**
 * Für die Seite hinter dem Link (GET): liest nur, bestätigt nie — Link-Scanner
 * rufen ihn ungefragt auf (ARCHITECTURE §5).
 *  - `offen`: genau diese Anfrage wartet (Zeitpunkt aus dem Token, unbestätigt).
 *  - `bestaetigt`: genau diese Anfrage ist bestätigt und das Abo bekommt Mails
 *    (zweiter Klick, neu laden).
 *  - `ueberholt`: Die Anfrage gibt es so nicht mehr — ausgeschaltet,
 *    abgemeldet oder durch einen neueren Link ersetzt.
 */
export async function ladeAboBestaetigung(token: string, jetzt: Date): Promise<AboBestaetigungsStand> {
  const geprueft = pruefeAboBestaetigungsToken(token, jetzt)
  if (!geprueft.ok) return { zustand: geprueft.grund }
  const abo = await prisma.customerFarmSubscription.findUnique({
    where: { id: geprueft.aboId },
    select: { ...EMAIL_ABO_STAND, farm: { select: { name: true, slug: true } } },
  })
  if (!abo) return { zustand: 'abo_weg' }
  if (abo.emailOptInAngefragtAm?.getTime() !== geprueft.angefragtAm.getTime()) return { zustand: 'ueberholt' }
  const hof = { hofName: abo.farm.name, hofSlug: abo.farm.slug }
  if (abo.emailOptInBestaetigtAm === null) return { zustand: 'offen', ...hof }
  return werbemailErlaubt(abo) ? { zustand: 'bestaetigt', ...hof } : { zustand: 'ueberholt' }
}

/**
 * Der Knopf (POST): setzt `optInEmail` und den Zeitpunkt der Bestätigung —
 * bedingt auf genau die Anfrage aus dem Token (Zeitpunkt) und nur, solange
 * sie unbestätigt ist. So überschreibt ein zweiter Klick den ersten
 * Zeitpunkt (den Nachweis) nicht, und ein alter Link meldet nach Ausschalten
 * oder Abmelden niemanden wieder an.
 */
export async function bestaetigeEmailAbo(token: string, jetzt: Date): Promise<AboBestaetigungsStand> {
  const geprueft = pruefeAboBestaetigungsToken(token, jetzt)
  if (!geprueft.ok) return { zustand: geprueft.grund }
  await prisma.customerFarmSubscription.updateMany({
    where: { id: geprueft.aboId, emailOptInAngefragtAm: geprueft.angefragtAm, emailOptInBestaetigtAm: null },
    data: { optInEmail: true, emailOptInBestaetigtAm: jetzt },
  })
  return ladeAboBestaetigung(token, jetzt)
}
