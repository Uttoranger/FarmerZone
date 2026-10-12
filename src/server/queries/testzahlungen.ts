import { prisma } from '@/lib/prisma'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { testzahlungWhere, testzahlungenHinweis, type GezeigteSummen } from '@/lib/testzahlung'
import { umsatzTestzahlungenWhere } from '@/lib/umsatz'
import { testzahlungenBetroffen } from '@/lib/finanzen'
import { SERVICEGEBUEHREN_TOEPFE } from '@/lib/auswertung'

/**
 * Die leise Zeile „Testzahlungen vor dem … sind nicht mitgezählt." auf den
 * Seiten eines Hofs (Auswertung, Verkäufe; Register Z4, Nr. 55) — genau dann,
 * wenn eine Zahl der Seite eine Testzahlung auslässt (Nachbesserung Runde 1):
 *  - eine Umsatzsumme: dieselbe Form wie die Summe (`umsatzTestzahlungenWhere`
 *    je Fenster) — eine offene oder stornierte Testzahlung zählt dort nie;
 *  - die Servicegebühren des Monats (nur Auswertung): eine Testzahlung des
 *    Monats, die `topfVonBestellung` ohne die Regel in einem Topf der Karte
 *    zählte (`testzahlungenBetroffen` mit `SERVICEGEBUEHREN_TOEPFE`, derselben
 *    Liste wie `servicegebuehrenImMonat`), etwa bezahlt und noch nicht abgeholt.
 * So verschwindet die Zeile von selbst, sobald die Testzeit aus allen
 * gezeigten Zeiträumen gefallen ist.
 */
export async function testzahlungenHinweisFuerHof(
  farmId: string,
  summen: GezeigteSummen,
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
): Promise<string | null> {
  if (stripeLiveAb === null) return null
  const monat = summen.gebuehrenMonat
  const [abgeholt, imMonat] = await Promise.all([
    summen.umsatz.length === 0
      ? Promise.resolve(null)
      : prisma.order.findFirst({
          where: { OR: summen.umsatz.map((fenster) => umsatzTestzahlungenWhere(farmId, fenster, stripeLiveAb)) },
          select: { id: true },
        }),
    monat
      ? prisma.order.findMany({
          // Als AND neben dem Monat: testzahlungWhere bringt selbst eine Grenze auf createdAt mit.
          where: { farmId, createdAt: { gte: monat.von, lt: monat.bis }, AND: [testzahlungWhere(stripeLiveAb)] },
          select: { createdAt: true, status: true, paymentMethod: true, paymentStatus: true, serviceFeeCents: true, serviceFeeRefundedAt: true },
        })
      : Promise.resolve([]),
  ])
  // Die Provision entscheidet keinen Topf; die Regel braucht nur das Feld.
  const gebuehrBetroffen = testzahlungenBetroffen(imMonat.map((b) => ({ ...b, provisionCents: 0 })), stripeLiveAb, SERVICEGEBUEHREN_TOEPFE)
  return abgeholt !== null || gebuehrBetroffen ? testzahlungenHinweis(stripeLiveAb) : null
}
