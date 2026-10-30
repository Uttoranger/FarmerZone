import { prisma } from '@/lib/prisma'
import type { StapelMail } from '@/lib/email'
import { HOF_KONTAKT_FELDER, hofKontaktEmail } from '@/lib/hof-kontakt'
import { WIDERRUF_TEXT, eingangZeitpunkt, lesePositionen } from '@/lib/widerruf'
import type { Verworfen } from '@/server/mail-arten'
import type { EinstellAuftrag } from '@/server/mail-warteschlange'
import { VORRANG, widerrufBezugSchema, widerrufErstattetBezugSchema } from '@/schemas/mail-auftrag'

/*
 * Die Renderer des Widerrufs (Nr. 200, Register N39): Adresse und Inhalt
 * frisch aus Widerruf und Bestellung — im Auftrag steht nur die Kennung.
 * Die Eingangsbestätigung geht direkt (Sofort, src/server/widerruf.ts) und hat
 * hier keinen Renderer.
 */

/** An den Hof (Wichtig): je Widerruf höchstens ein Auftrag. */
export function widerrufHofAuftrag(widerrufId: string, order: { id: string; farmId: string }): EinstellAuftrag {
  return { art: 'widerruf-hof', vorrang: VORRANG.wichtig, schluessel: `widerruf-hof:${widerrufId}`, bezug: { widerrufId }, bestellungId: order.id, farmId: order.farmId }
}

/** Ergebnis an die Kundin (Wichtig): erstattet (Betrag in Cent, bar null) oder abgelehnt — je Widerruf höchstens einmal. */
export function widerrufErgebnisAuftrag(
  art: 'widerruf-erstattet' | 'widerruf-abgelehnt',
  widerrufId: string,
  order: { id: string; farmId: string },
  erstattetCents: number | null = null
): EinstellAuftrag {
  return {
    art,
    vorrang: VORRANG.wichtig,
    schluessel: `${art}:${widerrufId}`,
    bezug: { widerrufId, ...(art === 'widerruf-erstattet' && erstattetCents !== null ? { erstattetCents: String(erstattetCents) } : {}) },
    bestellungId: order.id,
    farmId: order.farmId,
  }
}

const SELECT = {
  id: true,
  orderId: true,
  eingegangenAm: true,
  email: true,
  umfang: true,
  positionen: true,
  grund: true,
} as const

async function lade(widerrufId: string) {
  const w = await prisma.widerruf.findUnique({ where: { id: widerrufId }, select: SELECT })
  if (!w?.orderId) return null
  const order = await prisma.order.findUnique({
    where: { id: w.orderId },
    select: {
      id: true,
      orderNumber: true,
      customerEmail: true,
      farm: { select: { name: true, ...HOF_KONTAKT_FELDER } },
      items: { select: { id: true, productName: true, quantity: true } },
    },
  })
  return order ? { w, order } : null
}

const FEHLT: Verworfen = { verworfen: 'widerruf_fehlt' }

/** An den Hof: ein Widerruf nach der Abholung — nur, solange er noch offen ist. */
export async function rendereWiderrufHof(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { widerrufId } = widerrufBezugSchema.parse(bezug)
  const geladen = await lade(widerrufId)
  if (!geladen) return FEHLT
  const { w, order } = geladen
  const umfang =
    w.umfang === 'ganz'
      ? [WIDERRUF_TEXT.ganz]
      : lesePositionen(w.positionen).map((p) => `${p.menge} × ${order.items.find((i) => i.id === p.orderItemId)?.productName ?? WIDERRUF_TEXT.teil}`)
  const { baueWiderrufHof } = await import('@/lib/email')
  return baueWiderrufHof(hofKontaktEmail(order.farm), {
    bestellnummer: order.orderNumber,
    umfang: umfang.length > 0 ? umfang : [WIDERRUF_TEXT.teil],
    eingegangenAm: eingangZeitpunkt(w.eingegangenAm),
    bestellungPfad: `/orders/${order.id}`,
    ausnahmeSatz: WIDERRUF_TEXT.hofAusnahme,
  })
}

/** Erstattet → Kundin, an die Adresse der Bestellung; der Betrag steht im Auftrag (online) oder fehlt (bar). */
export async function rendereWiderrufErstattet(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { widerrufId, erstattetCents } = widerrufErstattetBezugSchema.parse(bezug)
  const geladen = await lade(widerrufId)
  if (!geladen) return FEHLT
  const { baueWiderrufErgebnis } = await import('@/lib/email')
  return baueWiderrufErgebnis(geladen.order.customerEmail, {
    bestellnummer: geladen.order.orderNumber,
    hofName: geladen.order.farm.name,
    erstattetCents: erstattetCents === undefined ? null : Number.parseInt(erstattetCents, 10),
    grund: null,
  })
}

/** Abgelehnt → Kundin, mit dem Grund des Hofs. */
export async function rendereWiderrufAbgelehnt(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { widerrufId } = widerrufBezugSchema.parse(bezug)
  const geladen = await lade(widerrufId)
  if (!geladen) return FEHLT
  if (!geladen.w.grund) return { verworfen: 'ohne_grund' }
  const { baueWiderrufErgebnis } = await import('@/lib/email')
  return baueWiderrufErgebnis(geladen.order.customerEmail, {
    bestellnummer: geladen.order.orderNumber,
    hofName: geladen.order.farm.name,
    erstattetCents: null,
    grund: geladen.w.grund,
  })
}
