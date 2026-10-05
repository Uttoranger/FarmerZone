'use server'

import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmation, sendOrderConfirmedToFarmer } from '@/lib/email'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { barBestaetigungsPfad, bestaetigungsPfad } from '@/lib/bestell-link'
import { barBestaetigungsAnsicht, GRUND_KUNDIN_STORNIERT } from '@/lib/bar-bestaetigung'
import { barBestaetigungsTokenSchema } from '@/schemas/bar-bestaetigung'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'

/**
 * Die zwei Knöpfe der Bar-Bestätigung (/{hof}/bestaetigen/{token}, H3).
 *
 * BERECHTIGUNG: Es gibt kein Konto — der Token aus der Mail IST die
 * Berechtigung (nanoid(32), nicht ratbar). Er steht in der WHERE-Klausel des
 * Schreibens, nicht nur in der Abfrage davor. Nach dem Bestätigen ist er
 * gelöscht; ein zweiter Klick findet nichts mehr.
 *
 * Bei Erfolg und bei jedem Stand, den die Seite selbst erklärt (verfallen,
 * storniert, erledigt), leiten die Aktionen weiter; eine Antwort mit `error`
 * gibt es nur, wenn der Token nicht (mehr) gilt.
 */
export type BarAktionStand = { error?: string }

const LINK_UNGUELTIG =
  'Dieser Link gilt nicht mehr. Hast du schon bestätigt? Dann findest du deine Bestellung in der Bestätigungsmail.'

/** Was beide Aktionen lesen — dazu die Felder für die Mails nach dem Bestätigen. */
async function leseBestellung(token: string) {
  return prisma.order.findUnique({
    where: { confirmationToken: token },
    include: {
      farm: {
        select: {
          id: true, name: true, slug: true, email: true, ownerName: true,
          address: true, postalCode: true, city: true, phone: true,
        },
      },
      items: {
        select: {
          productName: true, quantity: true, unitPrice: true, totalPrice: true,
          // Einheit nur für die Anzeige in der Mail gejoint
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
  })
}

/** „Ja, ich hole verbindlich ab" */
export async function bestaetigeBarBestellung(_vorher: BarAktionStand, formular: FormData): Promise<BarAktionStand> {
  const eingabe = barBestaetigungsTokenSchema.safeParse(formular.get('token'))
  if (!eingabe.success) return { error: LINK_UNGUELTIG }
  const token = eingabe.data

  const order = await leseBestellung(token)
  if (!order) return { error: LINK_UNGUELTIG }

  const jetzt = new Date()
  // Frist gilt beim Lesen: Über der Frist verfällt die Bestellung JETZT
  // (mit Rückbuchung und Mail an die Kundin), nicht erst im Cron.
  await gibVerwaisteFreiOhneRisiko(order.farmId, jetzt)

  // Die Frist hängt nur an Feldern, die nach dem Anlegen nie mehr wechseln
  // (Zahlart, Bestellzeit, Abholfenster) — sie aus dem Lesen zu rechnen ist
  // sicher. Der Status dagegen kann sich seither geändert haben: den prüft
  // erst die Bedingung des Schreibens.
  const ansicht = barBestaetigungsAnsicht(order, jetzt)
  if (ansicht === 'ungueltig') return { error: LINK_UNGUELTIG }
  if (ansicht !== 'offen') redirect(barBestaetigungsPfad(order.farm.slug, token))

  // Bedingt bestätigen — der Wechsel ist die Sperre (ARCHITECTURE.md §5): nur
  // aus PENDING_CONFIRMATION, nur mit genau diesem Token, und der Token
  // verfällt im selben Schreiben. count 0: zweiter Klick, parallel storniert
  // oder eben verfallen — die signierte Seite zeigt den echten Stand.
  const { count } = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: 'PENDING_CONFIRMATION',
      confirmationToken: token,
      paymentMethod: { not: 'ONLINE' },
    },
    data: { status: 'CONFIRMED', confirmedAt: jetzt, confirmationToken: null },
  })
  if (count === 0) redirect(bestaetigungsPfad(order.farm.slug, order.id))

  const mailBestellung = {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    totalAmount: order.totalAmount,
    serviceFeeCents: order.serviceFeeCents,
    pickupDate: order.pickupDate,
    pickupTimeStart: order.pickupTimeStart,
    pickupTimeEnd: order.pickupTimeEnd,
    paymentMethod: order.paymentMethod,
    stripePaymentIntentId: order.stripePaymentIntentId,
    farm: order.farm,
    items: order.items,
  }

  // Mails NACH der Antwort und jede für sich: Die Bestellung ist bestätigt,
  // ein hakender Mailserver nimmt das nie zurück (CLAUDE.md, Geld und
  // Bestellungen). Nur die Bestell-ID geht nach Sentry.
  nachDerAntwort(async () => {
    for (const [mail, senden] of [
      ['bestaetigung_kundin', () => sendOrderConfirmation(mailBestellung)],
      ['bestaetigung_hof', () => sendOrderConfirmedToFarmer(mailBestellung)],
    ] as const) {
      try {
        await senden()
      } catch (err) {
        Sentry.captureException(err, { tags: { aufgabe: 'bar-bestaetigung', mail }, extra: { orderId: order.id } })
      }
    }
  })

  redirect(bestaetigungsPfad(order.farm.slug, order.id))
}

/** „Doch nicht – Bestellung stornieren" */
export async function storniereBarBestellung(_vorher: BarAktionStand, formular: FormData): Promise<BarAktionStand> {
  const eingabe = barBestaetigungsTokenSchema.safeParse(formular.get('token'))
  if (!eingabe.success) return { error: LINK_UNGUELTIG }
  const token = eingabe.data

  const order = await prisma.order.findUnique({
    where: { confirmationToken: token },
    select: {
      id: true, farmId: true, status: true, paymentMethod: true, cancelReason: true,
      createdAt: true, pickupDate: true, pickupTimeStart: true,
      farm: { select: { slug: true } },
    },
  })
  if (!order) return { error: LINK_UNGUELTIG }

  const jetzt = new Date()
  await gibVerwaisteFreiOhneRisiko(order.farmId, jetzt)

  const ansicht = barBestaetigungsAnsicht(order, jetzt)
  if (ansicht === 'ungueltig') return { error: LINK_UNGUELTIG }
  // Nur eine offene Bestellung storniert der Link. Eine bestätigte storniert
  // der Hof (cancelOrder) — die Kundin hat dafür seine Kontaktdaten.
  if (ansicht === 'offen') {
    // Bedingt aus PENDING_CONFIRMATION, Rückbuchung in derselben Transaktion.
    // false heißt: jemand anderes war schneller — die Seite zeigt den Stand.
    await storniereUnbezahlteBestellung(order.id, GRUND_KUNDIN_STORNIERT)
  }
  // Der Token bleibt bei einer stornierten Bestellung stehen: Er kann nichts
  // mehr auslösen, und die Seite sagt damit „storniert" statt „gilt nicht mehr".
  redirect(barBestaetigungsPfad(order.farm.slug, token))
}
