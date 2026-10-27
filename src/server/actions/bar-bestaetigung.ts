'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { barBestaetigungsPfad, bestaetigungsPfad, bestellLinkGilt } from '@/lib/bestell-link'
import {
  BAR_LINK_ERNEUT_ANTWORT,
  LINK_UNGUELTIG_SATZ,
  LINK_UNGUELTIG_TITEL,
  barBestaetigungsAnsicht,
  barLinkErneutMoeglich,
  GRUND_KUNDIN_STORNIERT,
  neuerBarToken,
  tokenKandidaten,
} from '@/lib/bar-bestaetigung'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import type { OrderForEmail } from '@/lib/email'
import { barBestaetigungsTokenSchema } from '@/schemas/bar-bestaetigung'
// Dieselben zwei Felder wie die Neuigkeiten-Karte: Kennung und Signatur aus der Adresse der Bestätigungsseite.
import { neuigkeitenAnmeldenSchema as bestellLinkSchema } from '@/schemas/abo'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'
import { stelleEinOhneRisiko, stelleMailEinInTransaktion, type EinstellErgebnis } from '@/server/mail-warteschlange'
import { bestellMailAuftrag } from '@/server/mail-arten/bestellung'

/**
 * Die zwei Knöpfe der Bar-Bestätigung (/{hof}/bestaetigen/{token}, H3).
 *
 * BERECHTIGUNG: Es gibt kein Konto — der Token aus der Mail IST die
 * Berechtigung (nanoid(32), nicht ratbar). Gespeichert ist seit Nr. 151 nur
 * sein Hash (`barTokenHash`); gesucht wird über `tokenKandidaten` (nur der
 * Hash; Klartext-Werte leert das Aufräumen, Nr. 164). Der Filter steht in der
 * WHERE-Klausel des Schreibens, nicht nur in der Abfrage davor. Nach dem
 * Bestätigen ist der Wert gelöscht; ein zweiter Klick findet nichts mehr.
 *
 * Bei Erfolg und bei jedem Stand, den die Seite selbst erklärt (verfallen,
 * storniert, erledigt), leiten die Aktionen weiter; eine Antwort mit `error`
 * gibt es nur, wenn der Token nicht (mehr) gilt.
 */
export type BarAktionStand = { error?: string }

/**
 * Die Daten für den Bestätigungslink (Sofort, „Erneut senden") — dieselben
 * Felder wie beim Checkout. Die Mails nach dem Bestätigen lädt seit Nr. 159
 * der Renderer der Warteschlange selbst.
 */
function barMailBestellung(order: NonNullable<Awaited<ReturnType<typeof leseBestellung>>>): OrderForEmail {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    totalAmount: order.totalAmount,
    serviceFeeCents: order.serviceFeeCents,
    // N38: im Hofpreis-Modell zeigt der Bestätigungslink Endpreise inkl. Plattformgebühr.
    gebuehrModell: order.gebuehrModell,
    gebuehrEinzug: order.gebuehrEinzug,
    // Für die Frist in „Bitte bestätige" und für den Hinweis „bei Barzahlung
    // bis … keine Servicegebühr" in der Mail an den Hof (B1).
    createdAt: order.createdAt,
    pickupDate: order.pickupDate,
    pickupTimeStart: order.pickupTimeStart,
    pickupTimeEnd: order.pickupTimeEnd,
    paymentMethod: order.paymentMethod,
    stripePaymentIntentId: order.stripePaymentIntentId,
    farm: order.farm,
    items: order.items,
  }
}

const LINK_UNGUELTIG = `${LINK_UNGUELTIG_TITEL}. ${LINK_UNGUELTIG_SATZ}`

/**
 * Was Bestätigen und „Erneut senden" lesen — dazu die Felder für die Mails.
 * `findFirst`, weil der Filter über `tokenKandidaten` eine Liste ist.
 */
async function leseBestellung(where: Prisma.OrderWhereInput) {
  return prisma.order.findFirst({
    where,
    include: {
      farm: {
        select: {
          id: true, name: true, slug: true, email: true, ownerName: true,
          address: true, postalCode: true, city: true, phone: true,
          // Für „Erneut senden": ein stillgelegter Hof bekommt keine Mail mehr.
          archivedAt: true,
          geschlossenAm: true,
        },
      },
      items: {
        select: {
          productName: true, quantity: true, unitPrice: true, totalPrice: true,
          // N38: die Gebühr der Zeile — ohne sie zeigt die Mail im Hofpreis-Modell
          // Zeilen ohne Gebühr, aber ein Gesamt mit Gebühr.
          gebuehrCents: true,
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

  const order = await leseBestellung({ confirmationToken: { in: tokenKandidaten(token) } })
  if (!order) return { error: LINK_UNGUELTIG }

  // Frist gilt beim Lesen: Über der Frist verfällt die Bestellung JETZT
  // (mit Rückbuchung und Mail an die Kundin), nicht erst im Cron.
  await gibVerwaisteFreiOhneRisiko(order.farmId)

  // Die Zeit erst NACH der Freigabe nehmen: Die bricht bei verwaisten
  // Online-Bestellungen Zahlungen bei Stripe ab und kann Sekunden dauern.
  // Mit der Zeit vom Anfang des Klicks rutschte eine Bestellung, deren Frist
  // genau in diesen Sekunden abläuft, noch als bestätigt durch.
  const jetzt = new Date()

  // Die Frist hängt nur an Feldern, die nach dem Anlegen nie mehr wechseln
  // (Zahlart, Bestellzeit, Abholfenster) — sie aus dem Lesen zu rechnen ist
  // sicher. Der Status dagegen kann sich seither geändert haben: den prüft
  // erst die Bedingung des Schreibens. Zwischen dieser Prüfung und dem
  // Schreiben liegt kein await mehr außer dem Schreiben selbst.
  const ansicht = barBestaetigungsAnsicht(order, jetzt)
  if (ansicht === 'ungueltig') return { error: LINK_UNGUELTIG }
  if (ansicht !== 'offen') redirect(barBestaetigungsPfad(order.farm.slug, token))

  // Bedingt bestätigen — der Wechsel ist die Sperre (ARCHITECTURE.md §5): nur
  // aus PENDING_CONFIRMATION, nur mit genau diesem Token, und der Token
  // verfällt im selben Schreiben. count 0: zweiter Klick, parallel storniert
  // oder eben verfallen — die signierte Seite zeigt den echten Stand.
  //
  // Die Mails an Kundin und Hof sind seit Nr. 159 Aufträge der Warteschlange
  // — in DERSELBEN Transaktion, erst der Status, dann die Aufträge. Ein
  // Auftrag hält die Bestätigung nie auf (Register N26, Ergänzung
  // 25.10.2026): Das Objekt steht vor der Transaktion fest und wird rein
  // geprüft, bevor geschrieben wird; ungültige fallen weg (einmal gemeldet),
  // gültige werden eingestellt. Scheitert das Einstellen (Savepoint), gilt die
  // Bestätigung trotzdem, und die Aufträge werden nach dem Commit mit
  // demselben Objekt nachgeholt. Verschickt wird nach der Antwort (Worker);
  // ein hakender Mailserver nimmt die Bestätigung nie zurück.
  const auftraege = [bestellMailAuftrag('bestellung-bestaetigung', order), bestellMailAuftrag('bar-bestaetigt-hof', order)]
  const { count, mail } = await prisma.$transaction(async (tx) => {
    const { count: bestaetigt } = await tx.order.updateMany({
      where: {
        id: order.id,
        status: 'PENDING_CONFIRMATION',
        confirmationToken: { in: tokenKandidaten(token) },
        paymentMethod: { not: 'ONLINE' },
      },
      data: { status: 'CONFIRMED', confirmedAt: jetzt, confirmationToken: null },
    })
    if (bestaetigt !== 1) return { count: bestaetigt, mail: null }
    const mail: EinstellErgebnis = await stelleMailEinInTransaktion(auftraege, tx)
    return { count: bestaetigt, mail }
  })
  if (mail === 'nachholen') await stelleEinOhneRisiko('bestellung-bestaetigung', order.id, auftraege)
  if (count === 0) redirect(bestaetigungsPfad(order.farm.slug, order.id))

  // Wie cancelOrder: Die Bestellliste des Hofs zeigt den neuen Stand sofort.
  revalidatePath('/orders')
  revalidatePath(`/orders/${order.id}`)

  redirect(bestaetigungsPfad(order.farm.slug, order.id))
}

/** „Doch nicht – Bestellung stornieren" */
export async function storniereBarBestellung(_vorher: BarAktionStand, formular: FormData): Promise<BarAktionStand> {
  const eingabe = barBestaetigungsTokenSchema.safeParse(formular.get('token'))
  if (!eingabe.success) return { error: LINK_UNGUELTIG }
  const token = eingabe.data

  const order = await prisma.order.findFirst({
    where: { confirmationToken: { in: tokenKandidaten(token) } },
    select: {
      id: true, farmId: true, status: true, paymentMethod: true, cancelReason: true,
      createdAt: true, pickupDate: true, pickupTimeStart: true,
      farm: { select: { slug: true } },
    },
  })
  if (!order) return { error: LINK_UNGUELTIG }

  await gibVerwaisteFreiOhneRisiko(order.farmId)
  // Zeit erst nach der Freigabe nehmen — wie beim Bestätigen.
  const jetzt = new Date()

  const ansicht = barBestaetigungsAnsicht(order, jetzt)
  if (ansicht === 'ungueltig') return { error: LINK_UNGUELTIG }
  // Nur eine offene Bestellung storniert der Link. Eine bestätigte storniert
  // der Hof (cancelOrder) — die Kundin hat dafür seine Kontaktdaten.
  if (ansicht === 'offen') {
    // Bedingt aus PENDING_CONFIRMATION, Rückbuchung in derselben Transaktion.
    // false heißt: jemand anderes war schneller — die Seite zeigt den Stand.
    if (await storniereUnbezahlteBestellung(order.id, GRUND_KUNDIN_STORNIERT)) {
      // Wie cancelOrder: Die Bestellliste des Hofs zeigt den neuen Stand sofort.
      revalidatePath('/orders')
      revalidatePath(`/orders/${order.id}`)
    }
  }
  // Der Token bleibt bei einer stornierten Bestellung stehen: Er kann nichts
  // mehr auslösen, und die Seite sagt damit „storniert" statt „gilt nicht mehr".
  redirect(barBestaetigungsPfad(order.farm.slug, token))
}

/** Stand von „Erneut senden": vor dem ersten Senden leer, danach immer derselbe Satz. */
export type BarLinkErneutStand = { antwort?: string }

/**
 * „Mail nicht bekommen? Erneut senden" auf der Bestätigungsseite (Register S17
 * Punkt 2, Nr. 151).
 *
 * BERECHTIGUNG: die Signatur der Bestätigungsseite (`bestellLinkGilt`), wie
 * bei den Neuigkeiten — geprüft vor jeder Datenbankabfrage. Die Mail geht
 * immer an die Adresse DER Bestellung, nie an eine eingegebene; wer den Link
 * hat, kann also nur der Kundin selbst eine neue Mail schicken.
 *
 * DER NEUE LINK ERSETZT DEN ALTEN: Geschrieben wird der Hash eines neuen
 * Tokens nur, wenn der gespeicherte Wert noch der gelesene ist (der Wechsel
 * ist die Sperre, ARCHITECTURE §5). Von zwei gleichzeitigen Anforderungen
 * gewinnt genau eine und schickt genau eine Mail; der Link der älteren Mail
 * gilt danach nicht mehr.
 *
 * KEINE AUSKUNFT: Gesendet, gebremst, Link falsch, Bestellung nicht mehr
 * offen — die Antwort ist immer `BAR_LINK_ERNEUT_ANTWORT`.
 */
export async function sendeBarLinkErneut(
  _vorher: BarLinkErneutStand,
  formular: FormData
): Promise<BarLinkErneutStand> {
  const antwort: BarLinkErneutStand = { antwort: BAR_LINK_ERNEUT_ANTWORT }
  const eingabe = bestellLinkSchema.safeParse({ orderId: formular.get('orderId'), sig: formular.get('sig') })
  if (!eingabe.success) return antwort
  const { orderId, sig } = eingabe.data
  if (!bestellLinkGilt(orderId, sig)) return antwort

  try {
    const order = await leseBestellung({ id: orderId })
    // Frist gilt beim Lesen: barLinkErneutMoeglich rechnet sie mit (fristVon).
    const jetzt = new Date()
    if (!order || !order.confirmationToken || !barLinkErneutMoeglich(order, jetzt)) return antwort
    // Gezählt wird erst hier — nach Signatur und Stand, sonst brauchte ein
    // Fremder die Grenze einer Bestellung auf.
    const frei = await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.barLinkBestellung, merkmal: orderId }], jetzt)
    if (!frei) return antwort

    const { token, hash } = neuerBarToken()
    const { count } = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: 'PENDING_CONFIRMATION',
        paymentMethod: { not: 'ONLINE' },
        confirmationToken: order.confirmationToken,
      },
      data: { confirmationToken: hash },
    })
    // 0: parallel bestätigt, storniert oder schon neu angefordert — keine Mail.
    if (count !== 1) return antwort

    const mailBestellung = barMailBestellung(order)
    // Die Mail NACH der Antwort; ein hakender Mailserver ändert an der
    // Bestellung nichts. Nach Sentry nur die Bestell-ID.
    nachDerAntwort(async () => {
      try {
        await (await import('@/lib/email')).sendOnsiteConfirmation(mailBestellung, token)
      } catch (err) {
        Sentry.captureException(err, { tags: { aufgabe: 'bar-link-erneut' }, extra: { orderId: order.id } })
      }
    })
  } catch (err) {
    // Datenbank weg: dieselbe Antwort, die Bestellung bleibt, wie sie ist.
    Sentry.captureException(err, { tags: { aufgabe: 'bar-link-erneut' }, extra: { orderId } })
  }
  return antwort
}
