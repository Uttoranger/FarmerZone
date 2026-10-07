import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { alsCents } from '@/lib/order-totals'
import {
  ARTIKEL_FEHLT_STATUS,
  artikelFehltRechnung,
  nachFehlendemArtikel,
  type ArtikelFehltAblehnung,
  type ArtikelFehltBestellung,
  type ArtikelFehltTeil,
} from '@/lib/artikel-fehlt'
import {
  NACHTRAGEN_HOECHSTENS,
  STRIPE_AUFRUFE_HOECHSTENS,
  STRIPE_OPTIONEN,
  StripeStandUnklar,
  bucheVomHofZurueck,
  erstatteKundin,
  ladeStripeStand,
  type Buchung,
  type StripeStand,
} from '@/server/teilerstattung'

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
 *   2. Online: lesen, was Stripe zu dieser Bestellung schon gebucht hat
 *      (src/server/teilerstattung.ts, `ladeStripeStand`). Erstattungen für
 *      Positionen, die die Datenbank noch nicht als fehlend kennt (die Antwort
 *      von Stripe kam nicht an, die Transaktion rollte zurück), werden ZUERST
 *      nachgetragen — mit dem Betrag, den Stripe gebucht hat, nie ein zweites
 *      Mal erstattet. Erst dann wird die gemeldete Position vom so
 *      berichtigten Stand gerechnet und gebucht (oder, falls schon gebucht,
 *      nur nachgetragen).
 *   3. Position(en) als fehlend, neuer Warenpreis, neue Gebühr und
 *      `erstattetCents` um GENAU die von Stripe bestätigten Beträge — in
 *      derselben Transaktion, bedingt auf den gelesenen Stand.
 *
 * Damit gilt in jeder Verschränkung: Die Datenbank vermerkt nie eine
 * Erstattung, die Stripe nicht bestätigt hat, und keine Position wird zweimal
 * erstattet — auch nicht nach 24 Stunden oder mit inzwischen anderem Betrag.
 * Scheitert Stripe, rollt die Transaktion zurück, und derselbe Knopf kann es
 * noch einmal versuchen.
 *
 * ZEITGRENZE: Die Transaktion endet nach `TRANSAKTION_MS`. Jeder Stripe-Aufruf
 * läuft ohne SDK-Wiederholung mit kurzer Zeitgrenze (`STRIPE_OPTIONEN`), und
 * es sind höchstens `STRIPE_AUFRUFE_HOECHSTENS` — die Summe liegt mit Luft
 * darunter. Läuft die Transaktion doch ab, findet der nächste Versuch die
 * Buchung über `ladeStripeStand` und trägt sie nach.
 *
 * Bestand: Ein fehlender Artikel geht NICHT zurück in den Vorrat — er ist
 * nicht da (deshalb fehlt er). Eine Gutschrift würde Ware zum Verkauf
 * anbieten, die es nicht gibt. Der Hof korrigiert den Vorrat bei Bedarf selbst.
 */

/** Stripe-Zeitgrenzen aller Aufrufe plus 10 s für die Datenbank. */
export const TRANSAKTION_MS = STRIPE_AUFRUFE_HOECHSTENS * STRIPE_OPTIONEN.timeout + 10_000

/** So lange wartet die Transaktion höchstens auf eine Verbindung, bevor sie beginnt. */
export const VERBINDUNG_WARTEN_MS = 10_000

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
  createdAt: true,
  items: { select: { id: true, totalPrice: true, fehltSeit: true } },
} satisfies Prisma.OrderSelect

type Gebucht = { positionId: string; rechnung: ArtikelFehltTeil; erstattetCents: number; rueckbuchungOffen: boolean }

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
      let zustand: ArtikelFehltBestellung = {
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
        bestelltAm: stand.createdAt,
        positionen: stand.items.map((i) => ({ id: i.id, betragCents: alsCents(i.totalPrice), fehlt: i.fehltSeit !== null })),
      }

      // Vorprüfung ohne Stripe: Fremde Position, falscher Status, nicht bezahlt
      // — dafür wird Stripe gar nicht erst gefragt.
      const vorab = artikelFehltRechnung(zustand, itemId)
      if (vorab.art === 'abgelehnt') return vorab

      const paymentIntentId = vorab.art === 'teil' && vorab.zahlung === 'online' ? stand.stripePaymentIntentId : null
      const stripeStand: StripeStand | null = paymentIntentId ? await ladeStripeStand(paymentIntentId, orderId) : null

      // 2. Verlorene Erstattungen nachtragen — ERST planen und prüfen, dann
      //    buchen: Ist irgendetwas unklar (zu viele, nicht nachtragbar),
      //    wird nichts gebucht (StripeStandUnklar, Sentry, Hof meldet sich).
      //    Die gemeldete Position zuletzt, damit sie vom berichtigten Stand
      //    aus gerechnet wird.
      const plan: Array<{ positionId: string; rechnung: ArtikelFehltTeil; erstattetCents: number }> = []
      if (stripeStand) {
        const verloren = stripeStand.erstattungen
          .filter((e): e is Buchung & { positionId: string } => e.anlass === 'teilstorno' && e.positionId !== null)
          .filter((e) => zustand.positionen.some((p) => p.id === e.positionId && !p.fehlt))
          .toSorted((a, b) => Number(a.positionId === itemId) - Number(b.positionId === itemId))
        if (verloren.length > NACHTRAGEN_HOECHSTENS) {
          throw new StripeStandUnklar('zu_viele_nachtraege', { orderId, anzahl: verloren.length })
        }
        for (const e of verloren) {
          const r = artikelFehltRechnung(zustand, e.positionId)
          if (r.art !== 'teil') {
            // Fachlich nicht vorgesehen (eine Teilerstattung gibt es nie für den
            // letzten Artikel) — nicht raten, nichts buchen.
            throw new StripeStandUnklar('nachtrag_unklar', { orderId, positionId: e.positionId, erstattetCents: e.betrag })
          }
          if (e.betrag !== r.erstattungCents) {
            // Stripe hat vom damaligen Stand gerechnet. Eingetragen wird, was
            // gebucht ist; den Unterschied sieht der Betreiber.
            Sentry.captureException(new Error('Artikel fehlt: nachgetragene Erstattung weicht ab'), {
              tags: { aktion: 'artikelFehlt', grund: 'erstattung_abweichend' },
              extra: { orderId, positionId: e.positionId, gebuchtCents: e.betrag, gerechnetCents: r.erstattungCents },
            })
          }
          plan.push({ positionId: e.positionId, rechnung: r, erstattetCents: e.betrag })
          zustand = nachFehlendemArtikel(zustand, e.positionId, r, e.betrag)
        }
      }
      const gemeldetNachgetragen = plan.some((g) => g.positionId === itemId)
      const gemeldet = gemeldetNachgetragen ? null : artikelFehltRechnung(zustand, itemId)

      // Ab hier wird gebucht. Rückbuchungen der nachgetragenen Positionen
      // (sofern Stripe sie nicht schon hat), dann die gemeldete Position.
      const gebucht: Gebucht[] = []
      for (const g of plan) {
        const rueckbuchungOffen = stripeStand ? await rueckbuchen(stripeStand, orderId, g.positionId, g.rechnung.vomHofCents) : false
        gebucht.push({ ...g, rueckbuchungOffen })
      }

      let ergebnis: ArtikelFehltAusgang
      const schonGebucht = gebucht.find((g) => g.positionId === itemId)
      if (schonGebucht) {
        ergebnis = { art: 'teil', rechnung: schonGebucht.rechnung, erstattetCents: schonGebucht.erstattetCents, rueckbuchungOffen: schonGebucht.rueckbuchungOffen }
      } else if (!gemeldet || gemeldet.art !== 'teil') {
        ergebnis = gemeldet ?? { art: 'abgelehnt', grund: 'schon_fehlend' }
      } else {
        let erstattetCents = 0
        let rueckbuchungOffen = false
        if (stripeStand && paymentIntentId && gemeldet.zahlung === 'online') {
          const kundin = await erstatteKundin(stripeStand, {
            paymentIntentId,
            orderId,
            anlass: 'teilstorno',
            positionId: itemId,
            betragCents: gemeldet.erstattungCents,
            schluessel: `teilstorno-${orderId}-${itemId}`,
          })
          erstattetCents = kundin.erstattetCents
          rueckbuchungOffen = await rueckbuchen(stripeStand, orderId, itemId, gemeldet.vomHofCents)
        }
        gebucht.push({ positionId: itemId, rechnung: gemeldet, erstattetCents, rueckbuchungOffen })
        zustand = nachFehlendemArtikel(zustand, itemId, gemeldet, erstattetCents)
        ergebnis = { art: 'teil', rechnung: gemeldet, erstattetCents, rueckbuchungOffen }
      }

      // Schreiben, was gebucht ist — auch wenn die gemeldete Position danach
      // zum Storno führt: Nachgetragenes darf nicht wieder verloren gehen.
      if (gebucht.length > 0) {
        for (const g of gebucht) {
          const { count } = await tx.orderItem.updateMany({
            where: { id: g.positionId, orderId, fehltSeit: null },
            data: { fehltSeit: jetzt },
          })
          if (count !== 1) throw new Error('Artikel fehlt: Position hat sich unter der Sperre geändert')
        }
        // Bedingt auf den gelesenen Stand — unter der Sperre kann sich nichts
        // geändert haben; trifft es trotzdem nicht, rollt alles zurück.
        const { count } = await tx.order.updateMany({
          where: {
            id: orderId,
            farmId,
            status: { in: [...ARTIKEL_FEHLT_STATUS] },
            serviceFeeCents: stand.serviceFeeCents,
            erstattetCents: stand.erstattetCents,
          },
          data: {
            totalAmount: new Prisma.Decimal(zustand.warenpreisCents).div(100),
            serviceFeeCents: zustand.serviceFeeCents,
            erstattetCents: zustand.erstattetCents,
          },
        })
        if (count !== 1) throw new Error('Artikel fehlt: Bestellung hat sich unter der Sperre geändert')
      }

      return ergebnis
    },
    { timeout: TRANSAKTION_MS, maxWait: VERBINDUNG_WARTEN_MS }
  )
}

/** Rückbuchung genau des Artikelpreises vom Hof; Fehler gehen an Sentry, nicht an den Hof. */
function rueckbuchen(stand: StripeStand, orderId: string, positionId: string, vomHofCents: number): Promise<boolean> {
  return bucheVomHofZurueck(stand, {
    orderId,
    anlass: 'teilstorno',
    positionId,
    betragCents: vomHofCents,
    schluessel: `teilstorno-hof-${orderId}-${positionId}`,
    onFehler: (err) => {
      // Die Kundin hat ihr Geld; nur der Artikelpreis steht beim Hof noch
      // aus. Nur IDs und Betrag, keine Kundendaten.
      Sentry.captureException(err, {
        tags: { aktion: 'artikelFehlt', grund: 'rueckbuchung_offen' },
        extra: { orderId, positionId, vomHofCents, handbuchung: 'Überweisung mit diesem Betrag zurückbuchen' },
      })
    },
  })
}
