/**
 * Eine kleine Stripe-Rechnungs-Attrappe für die Monatsabrechnung (Nr. 198):
 * merkt sich je Rechnung Status und Positionen, damit Wiederaufnahme nach
 * einem Abbruch (Positionen fehlen, nicht finalisiert) und die Betragsprüfung
 * vor dem Finalisieren ohne Live-Aufruf prüfbar sind. Kein Netz, keine Daten.
 */
import type { Mock } from 'vitest'

type Posten = { id: string; schluessel: string; amount: number }
type Rechnung = { status: 'draft' | 'open' | 'paid' | 'void'; posten: Posten[]; collection_method?: 'charge_automatically' | 'send_invoice'; default_payment_method?: string }

export type RechnungsAttrappe = {
  invoices: { create: Mock; finalizeInvoice: Mock; pay: Mock; sendInvoice: Mock; retrieve: Mock; del: Mock }
  invoiceItems: { create: Mock; list: Mock }
}

/** Belegt die Mocks mit dem Verhalten; Rückgabe: die Rechnungen zum Vorbelegen und Prüfen. */
export function richteRechnungenEin(s: RechnungsAttrappe, kennung: (art: string) => string): Map<string, Rechnung> {
  const rechnungen = new Map<string, Rechnung>()
  let n = 0
  // Wie Stripe: derselbe Idempotenzschlüssel gibt dieselbe Rechnung zurück (auch eine gelöschte),
  // ein neuer Schlüssel legt eine neue an — die erste je Art heißt wie `kennung`, weitere mit Zählersuffix.
  const jeSchluessel = new Map<string, string>()
  let neue = 0
  s.invoices.create.mockImplementation(async (p: { metadata: { art: string }; collection_method?: Rechnung['collection_method']; default_payment_method?: string }, o?: { idempotencyKey?: string }) => {
    const schon = o?.idempotencyKey ? jeSchluessel.get(o.idempotencyKey) : undefined
    if (schon) return { id: schon }
    let id = kennung(p.metadata.art)
    if (rechnungen.has(id) || [...jeSchluessel.values()].includes(id)) {
      neue += 1
      id = `${id}_${neue}`
    }
    rechnungen.set(id, { status: 'draft', posten: [], collection_method: p.collection_method, default_payment_method: p.default_payment_method })
    if (o?.idempotencyKey) jeSchluessel.set(o.idempotencyKey, id)
    return { id }
  })
  s.invoices.del.mockImplementation(async (id: string) => {
    const r = rechnungen.get(id)
    if (!r) throw Object.assign(new Error('Rechnung fehlt'), { code: 'resource_missing' })
    if (r.status !== 'draft') throw new Error('Nur Entwürfe lassen sich löschen')
    rechnungen.delete(id)
    return { id, deleted: true }
  })
  s.invoiceItems.create.mockImplementation(async (p: { invoice: string; amount: number; metadata: { schluessel: string } }) => {
    const r = rechnungen.get(p.invoice)
    if (!r || r.status !== 'draft') throw new Error('Rechnung nicht im Entwurf')
    n += 1
    r.posten.push({ id: `ii_${n}`, schluessel: p.metadata.schluessel, amount: p.amount })
    return { id: `ii_${n}` }
  })
  s.invoiceItems.list.mockImplementation(async (p: { invoice: string }) => ({
    data: (rechnungen.get(p.invoice)?.posten ?? []).map((x) => ({ id: x.id, metadata: { schluessel: x.schluessel } })),
    has_more: false,
  }))
  s.invoices.retrieve.mockImplementation(async (id: string) => {
    const r = rechnungen.get(id)
    if (!r) throw Object.assign(new Error('Rechnung fehlt'), { code: 'resource_missing' })
    return { id, status: r.status, collection_method: r.collection_method ?? 'charge_automatically', default_payment_method: r.default_payment_method ?? null, total: r.posten.reduce((summe, x) => summe + x.amount, 0) }
  })
  s.invoices.finalizeInvoice.mockImplementation(async (id: string) => {
    const r = rechnungen.get(id)
    if (r) r.status = 'open'
    return { id }
  })
  s.invoices.pay.mockImplementation(async (id: string) => {
    const r = rechnungen.get(id)
    if (r) r.status = 'paid'
    return { id }
  })
  s.invoices.sendInvoice.mockResolvedValue({})
  return rechnungen
}
