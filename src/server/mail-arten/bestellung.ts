import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { OrderForEmail, StapelMail } from '@/lib/email'
import type { EinstellAuftrag } from '@/server/mail-warteschlange'
import type { MailRenderer, Verworfen } from '@/server/mail-arten'
import {
  VORRANG,
  artikelFehltBezugSchema,
  bestellungBezugSchema,
  stornoBezugSchema,
  zahlungZuSpaetBezugSchema,
} from '@/schemas/mail-auftrag'

/*
 * Die Mails zu einer Bestellung (Register N26, Nr. 159) — alle Wichtig. Der
 * Auftrag trägt nur die Kennung der Bestellung (dazu bei Storno, „Artikel
 * fehlt" und „Zahlung zu spät" die Beträge, die beim Ereignis feststanden:
 * nie neu gerechnet). Adresse, Positionen und Hof lädt der Renderer beim
 * Versand frisch — derselbe Stand wie die Bestellseite in diesem Moment.
 */

/** Was jede Bestellmail aus der Datenbank braucht — EINE Abfrage für alle Arten. */
const BESTELLUNG_FUER_MAIL = {
  id: true,
  farmId: true,
  orderNumber: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  totalAmount: true,
  serviceFeeCents: true,
  createdAt: true,
  pickupDate: true,
  pickupTimeStart: true,
  pickupTimeEnd: true,
  paymentMethod: true,
  stripePaymentIntentId: true,
  cancelReason: true,
  // Nur der Renderer „abholbereit“ liest ihn: Die Mail geht nur, solange die Bestellung bereit ist.
  status: true,
  farm: {
    select: { id: true, name: true, slug: true, email: true, ownerName: true, address: true, postalCode: true, city: true, phone: true },
  },
  items: {
    select: {
      id: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      // Einheit nur für die Anzeige in der Mail
      product: { select: { unit: true, unitSize: true } },
    },
  },
} satisfies Prisma.OrderSelect

type BestellungFuerMail = Prisma.OrderGetPayload<{ select: typeof BESTELLUNG_FUER_MAIL }>

/** Die Arten, deren Auftrag nur die Bestellung kennt. */
export type EinfacheBestellArt = 'bestellung-bestaetigung' | 'bestellung-bezahlt-hof' | 'bar-bestaetigt-hof' | 'abholbereit' | 'nicht-abholbereit' | 'verfallen'

/**
 * Der Auftrag einer Bestellmail. Der fachliche Schlüssel ist `<art>:<orderId>`
 * — eine Bestellung wird nur einmal bezahlt, bestätigt, storniert oder
 * verfällt einmal, ein zweites Einstellen (Webhook zweimal) fällt weg.
 * „Abholbereit" und „nicht abholbereit" können sich wiederholen (zurück und
 * wieder bereit): Dort hängt `wiederholung` den Zeitpunkt des Statuswechsels an.
 */
export function bestellMailAuftrag(
  art: EinfacheBestellArt,
  bestellung: { id: string; farmId: string },
  wiederholung?: Date
): EinstellAuftrag {
  return {
    art,
    vorrang: VORRANG.wichtig,
    schluessel: wiederholung ? `${art}:${bestellung.id}:${wiederholung.getTime()}` : `${art}:${bestellung.id}`,
    bezug: { orderId: bestellung.id },
    bestellungId: bestellung.id,
    farmId: bestellung.farmId,
  }
}

/**
 * Nimmt der Hof „Gepackt“ zurück, wird ein noch offener Auftrag `abholbereit`
 * verworfen (Nr. 195, Audit A4) — sonst ginge er später doch hinaus, und nach
 * einem erneuten „Gepackt“ bekäme die Kundin die Mail zweimal. Ein Auftrag, den
 * der Worker gerade verschickt (`in_arbeit`), bleibt: dort schützt die
 * Statusprüfung im Renderer. Wirft bei einem Datenbankfehler; der Aufrufer
 * meldet ihn, der Rückweg gilt trotzdem.
 */
export async function verwirfOffenenAbholbereitAuftrag(orderId: string): Promise<void> {
  await prisma.mailAuftrag.updateMany({
    where: { bestellungId: orderId, art: 'abholbereit', status: 'offen' },
    data: { status: 'verworfen', fehlerCode: 'zurueckgenommen' },
  })
}

/**
 * Storno → Kundin, eingestellt IN der Storno-Transaktion (Nr. 159, Punkt 1).
 * Online bezahlt steht der Betrag dann noch nicht fest — Stripe erstattet erst
 * nach dem Commit (cancelOrder). Der Auftrag trägt deshalb `ausstehend`, und
 * `trageStornoErstattungEin` setzt nach Stripe den Betrag, den Stripe
 * gebucht hat (nie neu gerechnet), oder `offen`. Vor Ort bezahlt (oder online
 * nie bezahlt) gibt es nichts zu erstatten: nur die Kennung.
 */
export function stornoMailAuftrag(bestellung: { id: string; farmId: string }, onlineErstattung: boolean): EinstellAuftrag {
  return {
    art: 'storniert',
    vorrang: VORRANG.wichtig,
    schluessel: stornoSchluessel(bestellung.id),
    bezug: { orderId: bestellung.id, ...(onlineErstattung ? { erstattung: 'ausstehend' } : {}) },
    bestellungId: bestellung.id,
    farmId: bestellung.farmId,
  }
}

function stornoSchluessel(orderId: string): string {
  return `storniert:${orderId}`
}

/**
 * Trägt nach Stripe in den Storno-Auftrag ein, was aus der Erstattung wurde:
 * der gebuchte Betrag in Cent, oder `offen` (gescheitert — dann geht keine
 * Storno-Mail, der Betreiber meldet sich mit der Erstattung). Nur solange der
 * Auftrag nicht fertig ist; hat der Worker ihn gerade belegt, nimmt der
 * nächste Versuch den neuen Bezug (der Worker schreibt `bezug` nie zurück).
 * Wirft bei einem Datenbankfehler — der Aufrufer meldet ihn; der Auftrag
 * bleibt dann `ausstehend` und endet nach den Wiederholungen sichtbar als
 * gescheitert im Protokoll, statt still zu fehlen.
 */
export async function trageStornoErstattungEin(orderId: string, ausgang: { erstattetCents: number } | 'offen'): Promise<void> {
  const bezug = stornoBezugSchema.parse(
    ausgang === 'offen' ? { orderId, erstattung: 'offen' } : { orderId, erstattetCents: String(ausgang.erstattetCents) }
  )
  await prisma.mailAuftrag.updateMany({
    where: { schluessel: stornoSchluessel(orderId), status: { in: ['offen', 'in_arbeit'] } },
    data: { bezug },
  })
}

/**
 * Der Storno-Auftrag wartet noch auf Stripe. Der Renderer wirft, der Worker
 * versucht es nach seinem Plan wieder (1, 5, 15 … Minuten) — ein eigener
 * Name, damit Sentry es vom echten Renderer-Fehler unterscheidet.
 */
export class StornoErstattungAusstehend extends Error {
  constructor() {
    super('Storno-Mail: Erstattung noch nicht eingetragen')
    this.name = 'StornoErstattungAusstehend'
  }
}

/** „Artikel fehlt" → Kundin; eine Position fehlt nur einmal (Sperre „schon fehlend"). */
export function artikelFehltMailAuftrag(
  bestellung: { id: string; farmId: string },
  fehlt: { itemId: string; bisherCents: number; neuCents: number; erstattetCents: number | null }
): EinstellAuftrag {
  return {
    art: 'artikel-fehlt',
    vorrang: VORRANG.wichtig,
    schluessel: `artikel-fehlt:${bestellung.id}:${fehlt.itemId}`,
    bezug: {
      orderId: bestellung.id,
      itemId: fehlt.itemId,
      bisherCents: String(fehlt.bisherCents),
      neuCents: String(fehlt.neuCents),
      ...(fehlt.erstattetCents === null ? {} : { erstattetCents: String(fehlt.erstattetCents) }),
    },
    bestellungId: bestellung.id,
    farmId: bestellung.farmId,
  }
}

/** Zahlung nach dem Storno eingegangen und voll erstattet → Kundin. */
export function zahlungZuSpaetMailAuftrag(bestellung: { id: string; farmId: string }, erstattetCents: number): EinstellAuftrag {
  return {
    art: 'zahlung-zu-spaet',
    vorrang: VORRANG.wichtig,
    schluessel: `zahlung-zu-spaet:${bestellung.id}`,
    bezug: { orderId: bestellung.id, erstattetCents: String(erstattetCents) },
    bestellungId: bestellung.id,
    farmId: bestellung.farmId,
  }
}

/** Ziffern aus dem Bezug (vom Worker schon geprüft) als ganze Cent. */
function cents(ziffern: string): number {
  return Number.parseInt(ziffern, 10)
}

async function ladeBestellung(orderId: string): Promise<BestellungFuerMail | null> {
  return prisma.order.findUnique({ where: { id: orderId }, select: BESTELLUNG_FUER_MAIL })
}

function alsMailBestellung(b: BestellungFuerMail): OrderForEmail {
  return {
    id: b.id,
    orderNumber: b.orderNumber,
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    customerPhone: b.customerPhone,
    totalAmount: b.totalAmount,
    serviceFeeCents: b.serviceFeeCents,
    createdAt: b.createdAt,
    pickupDate: b.pickupDate,
    pickupTimeStart: b.pickupTimeStart,
    pickupTimeEnd: b.pickupTimeEnd,
    paymentMethod: b.paymentMethod,
    stripePaymentIntentId: b.stripePaymentIntentId,
    farm: b.farm,
    items: b.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      product: i.product,
    })),
  }
}

/**
 * Die Bestellung in der Form der Mail-Vorlagen, frisch geladen — für den
 * Bar-Bestätigungslink beim Nochmal-Schicken und in der Vorschau (Nr. 167),
 * dieselbe Abfrage wie die Renderer.
 */
export async function ladeBestellungFuerMail(orderId: string): Promise<OrderForEmail | null> {
  const b = await ladeBestellung(orderId)
  return b ? alsMailBestellung(b) : null
}

const GELOESCHT: Verworfen = { verworfen: 'bestellung_fehlt' }

/** Ein Renderer, der nur die Bestellung braucht. */
function einfach(baue: (email: typeof import('@/lib/email'), order: OrderForEmail) => Promise<StapelMail>): MailRenderer {
  return async (bezug) => {
    const { orderId } = bestellungBezugSchema.parse(bezug)
    const b = await ladeBestellung(orderId)
    if (!b) return GELOESCHT
    return baue(await import('@/lib/email'), alsMailBestellung(b))
  }
}

export const rendereBestellungBestaetigung: MailRenderer = einfach((e, o) => e.baueOrderConfirmation(o))
export const rendereBestellungBezahltHof: MailRenderer = einfach((e, o) => e.baueOrderPaidToFarmer(o))
export const rendereBarBestaetigtHof: MailRenderer = einfach((e, o) => e.baueOrderConfirmedToFarmer(o))
/**
 * „Abholbereit“ nur, solange die Bestellung bereit ist (Nr. 195, Audit A4):
 * Nimmt der Hof „Gepackt“ zurück, bevor der Worker die Mail schickt, wäre sie
 * falsch — die Kundin führe umsonst los. Dieselbe Regel wie `passtNochmal`
 * (src/lib/betrieb-mails.ts). Eine andere Lage (zurück, storniert, schon
 * abgeholt) verwirft den Auftrag, einmal gezählt im Protokoll.
 */
export const rendereAbholbereit: MailRenderer = async (bezug) => {
  const { orderId } = bestellungBezugSchema.parse(bezug)
  const b = await ladeBestellung(orderId)
  if (!b) return GELOESCHT
  if (b.status !== 'READY') return { verworfen: 'nicht_mehr_bereit' }
  return (await import('@/lib/email')).baueOrderReady(alsMailBestellung(b))
}
export const rendereNichtAbholbereit: MailRenderer = einfach((e, o) => e.baueOrderNotReady(o))
export const rendereVerfallen: MailRenderer = einfach((e, o) => e.baueBestellungVerfallen(o))

export async function rendereStorniert(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { orderId, erstattetCents, erstattung } = stornoBezugSchema.parse(bezug)
  // Gescheiterte Erstattung: keine Storno-Mail. Die Vorlage läse „keine
  // Erstattung" als Vor-Ort-Zahlung („entstehen dir keine Kosten") — an eine
  // Kundin, die online bezahlt hat und noch nichts zurückbekam.
  if (erstattung === 'offen') return { verworfen: 'erstattung_offen' }
  const b = await ladeBestellung(orderId)
  if (!b) return GELOESCHT
  if (erstattung === 'ausstehend') throw new StornoErstattungAusstehend()
  const { baueOrderCancelled } = await import('@/lib/email')
  // Der Grund steht seit dem Storno an der Bestellung (cancelReason).
  return baueOrderCancelled(alsMailBestellung(b), erstattetCents === undefined ? null : cents(erstattetCents), b.cancelReason)
}

export async function rendereArtikelFehlt(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const f = artikelFehltBezugSchema.parse(bezug)
  const b = await ladeBestellung(f.orderId)
  const position = b?.items.find((i) => i.id === f.itemId)
  if (!b || !position) return GELOESCHT
  const { baueArtikelFehlt } = await import('@/lib/email')
  return baueArtikelFehlt(alsMailBestellung(b), {
    position: {
      productName: position.productName,
      quantity: position.quantity,
      unitPrice: position.unitPrice,
      totalPrice: position.totalPrice,
      product: position.product,
    },
    // Eine Erstattung gibt es nur bei Online-Zahlung — wie beim Speichern entschieden.
    zahlung: f.erstattetCents === undefined ? 'vor_ort' : 'online',
    bisherCents: cents(f.bisherCents),
    neuCents: cents(f.neuCents),
    erstattetCents: f.erstattetCents === undefined ? null : cents(f.erstattetCents),
  })
}

export async function rendereZahlungZuSpaet(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { orderId, erstattetCents } = zahlungZuSpaetBezugSchema.parse(bezug)
  const b = await ladeBestellung(orderId)
  if (!b) return GELOESCHT
  const { baueZahlungZuSpaet } = await import('@/lib/email')
  return baueZahlungZuSpaet(b, cents(erstattetCents))
}

