import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { alsCents } from '@/lib/order-totals'
import {
  ARTIKEL_FEHLT_STATUS,
  artikelFehltRechnung,
  type ArtikelFehltAblehnung,
  type ArtikelFehltTeil,
} from '@/lib/artikel-fehlt'
import { erstatteMitFestemBetrag } from '@/server/teilerstattung'

/**
 * „Artikel fehlt" gegen Datenbank und Stripe (E14, Nachtlauf Nr. 19). Was
 * gerechnet wird, entscheidet src/lib/artikel-fehlt.ts; hier wird gesperrt,
 * erstattet und geschrieben.
 *
 * REIHENFOLGE — warum Stripe hier INNERHALB der Sperre läuft (Ausnahme von
 * „erst bedingt schreiben, dann Stripe", ARCHITECTURE §5 Zahlungen):
 *
 *   1. Zeilensperre auf die Bestellung (`SELECT … FOR UPDATE`) und den
 *      aktuellen Stand lesen. Ein zweiter Aufruf (Doppeltipp, zweiter Tab,
 *      ein Storno) wartet hier, bis der erste fertig ist, und rechnet dann vom
 *      neuen Stand: Die Position fehlt schon → abgelehnt, kein Stripe-Aufruf.
 *   2. Online: Erstattung und Rückbuchung mit festen Beträgen und festen
 *      Schlüsseln (`teilstorno-<orderId>-<itemId>`, src/server/teilerstattung.ts).
 *   3. Erst wenn Stripe die Erstattung bestätigt hat: Position als fehlend,
 *      neuer Warenpreis, neue Gebühr und `erstattetCents` um GENAU den von
 *      Stripe bestätigten Betrag — in derselben Transaktion, bedingt auf den
 *      gelesenen Stand.
 *
 * Damit gilt in jeder Verschränkung: Die Datenbank vermerkt nie eine
 * Erstattung, die Stripe nicht bestätigt hat. Scheitert Stripe, rollt die
 * Transaktion zurück — die Bestellung steht unverändert da, und derselbe Knopf
 * kann es noch einmal versuchen. Gelingt Stripe, scheitert aber das Schreiben
 * (oder läuft die Transaktion ab), liefert der Wiederholungsversuch über den
 * Schlüssel DIESELBE Erstattung zurück statt einer zweiten. Die Summe der
 * Erstattungen bleibt unter dem bezahlten Betrag, weil jede Rechnung vom
 * gesperrten aktuellen Stand ausgeht (Beweis in src/lib/artikel-fehlt.ts).
 *
 * Der Preis der Sperre: Die Bestellzeile ist für die Dauer der Stripe-Aufrufe
 * (meist unter einer Sekunde, höchstens drei Aufrufe à 8 s) gesperrt. Andere
 * Schreiber DIESER Bestellung warten so lange; Bestand und andere Bestellungen
 * sind nicht betroffen.
 *
 * Bestand: Ein fehlender Artikel geht NICHT zurück in den Vorrat — er ist
 * nicht da (deshalb fehlt er). Eine Gutschrift würde Ware zum Verkauf
 * anbieten, die es nicht gibt. Der Hof korrigiert den Vorrat bei Bedarf selbst.
 */

/** Höchstdauer der Transaktion: drei Stripe-Aufrufe mit je 8 s Zeitgrenze plus Luft. */
const TRANSAKTION_MS = 30_000

export type ArtikelFehltAusgang =
  | { art: 'abgelehnt'; grund: ArtikelFehltAblehnung | 'nicht_gefunden' }
  /** Es bliebe nichts übrig — der Aufrufer storniert die ganze Bestellung. */
  | { art: 'storno' }
  | {
      art: 'teil'
      rechnung: ArtikelFehltTeil
      /** Von Stripe bestätigt (online), sonst 0. */
      erstattetCents: number
      rueckbuchungOffen: boolean
    }

const STAND_AUSWAHL = {
  id: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  stripePaymentIntentId: true,
  totalAmount: true,
  serviceFeeCents: true,
  serviceFeePercentApplied: true,
  serviceFeeMinCentsApplied: true,
  erstattetCents: true,
  items: { select: { id: true, totalPrice: true, fehltSeit: true } },
} satisfies Prisma.OrderSelect

export async function meldeFehlendenArtikel(eingabe: {
  farmId: string
  orderId: string
  itemId: string
  jetzt: Date
}): Promise<ArtikelFehltAusgang> {
  const { farmId, orderId, itemId, jetzt } = eingabe

  return prisma.$transaction(
    async (tx) => {
      // Besitz in der Sperre selbst: Eine fremde Bestellung wird nie gesperrt.
      const gesperrt = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Order" WHERE id = ${orderId} AND "farmId" = ${farmId} FOR UPDATE`
      if (gesperrt.length === 0) return { art: 'abgelehnt', grund: 'nicht_gefunden' } as const

      const stand = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: STAND_AUSWAHL })
      const rechnung = artikelFehltRechnung(
        {
          status: stand.status,
          paymentMethod: stand.paymentMethod,
          paymentStatus: stand.paymentStatus,
          stripePaymentIntentId: stand.stripePaymentIntentId,
          warenpreisCents: alsCents(stand.totalAmount),
          serviceFeeCents: stand.serviceFeeCents,
          serviceFeePercentApplied:
            stand.serviceFeePercentApplied === null ? null : stand.serviceFeePercentApplied.toNumber(),
          serviceFeeMinCentsApplied: stand.serviceFeeMinCentsApplied,
          erstattetCents: stand.erstattetCents,
          positionen: stand.items.map((i) => ({ id: i.id, betragCents: alsCents(i.totalPrice), fehlt: i.fehltSeit !== null })),
        },
        itemId
      )
      if (rechnung.art !== 'teil') return rechnung

      let erstattetCents = 0
      let rueckbuchungOffen = false
      if (rechnung.zahlung === 'online' && stand.stripePaymentIntentId) {
        const erstattung = await erstatteMitFestemBetrag({
          paymentIntentId: stand.stripePaymentIntentId,
          orderId,
          erstattungCents: rechnung.erstattungCents,
          vomHofCents: rechnung.vomHofCents,
          schluessel: `teilstorno-${orderId}-${itemId}`,
          schluesselHof: `teilstorno-hof-${orderId}-${itemId}`,
          grund: 'artikel_fehlt',
          onRueckbuchungFehler: (err) => {
            // Die Kundin hat ihr Geld; nur der Artikelpreis steht beim Hof
            // noch aus. Nur IDs und Betrag, keine Kundendaten.
            Sentry.captureException(err, {
              tags: { aktion: 'artikelFehlt', grund: 'rueckbuchung_offen' },
              extra: { orderId, itemId, vomHofCents: rechnung.vomHofCents, handbuchung: 'Überweisung mit diesem Betrag zurückbuchen' },
            })
          },
        })
        erstattetCents = erstattung.erstattetCents
        rueckbuchungOffen = erstattung.rueckbuchungOffen
      }

      // Bedingt auf den gelesenen Stand — unter der Sperre kann sich nichts
      // geändert haben; trifft es trotzdem nicht, stimmt etwas Grundsätzliches
      // nicht, und die Transaktion rollt zurück.
      const position = await tx.orderItem.updateMany({
        where: { id: itemId, orderId, fehltSeit: null },
        data: { fehltSeit: jetzt },
      })
      const bestellung = await tx.order.updateMany({
        where: {
          id: orderId,
          farmId,
          status: { in: [...ARTIKEL_FEHLT_STATUS] as Prisma.EnumOrderStatusFilter['in'] },
          serviceFeeCents: stand.serviceFeeCents,
          erstattetCents: stand.erstattetCents,
        },
        data: {
          totalAmount: new Prisma.Decimal(rechnung.neuWarenCents).div(100),
          serviceFeeCents: rechnung.neuGebuehrCents,
          erstattetCents: { increment: erstattetCents },
        },
      })
      if (position.count !== 1 || bestellung.count !== 1) {
        throw new Error('Artikel fehlt: Bestellung hat sich unter der Sperre geändert')
      }

      return { art: 'teil', rechnung, erstattetCents, rueckbuchungOffen } as const
    },
    { timeout: TRANSAKTION_MS, maxWait: 10_000 }
  )
}
