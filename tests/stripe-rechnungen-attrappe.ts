/**
 * Eine kleine Stripe-Rechnungs-Attrappe für die Monatsabrechnung (Nr. 198):
 * merkt sich je Rechnung Status und Positionen, damit Wiederaufnahme nach
 * einem Abbruch (Positionen fehlen, nicht finalisiert) und die Betragsprüfung
 * vor dem Finalisieren ohne Live-Aufruf prüfbar sind. Kein Netz, keine Daten.
 */
import type { Mock } from 'vitest'

type Posten = { id: string; schluessel: string; amount: number }
type Rechnung = { status: 'draft' | 'open' | 'paid' | 'void'; posten: Posten[] }

export type RechnungsAttrappe = {
  invoices: { create: Mock; finalizeInvoice: Mock; pay: Mock; sendInvoice: Mock; retrieve: Mock }
  invoiceItems: { create: Mock; list: Mock }
}

/** Belegt die Mocks mit dem Verhalten; Rückgabe: die Rechnungen zum Vorbelegen und Prüfen. */
export function richteRechnungenEin(s: RechnungsAttrappe, kennung: (art: string) => string): Map<string, Rechnung> {
  const rechnungen = new Map<string, Rechnung>()
  let n = 0
  s.invoices.create.mockImplementation(async (p: { metadata: { art: string } }) => {
    const id = kennung(p.metadata.art)
    if (!rechnungen.has(id)) rechnungen.set(id, { status: 'draft', posten: [] })
    return { id }
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
    if (!r) throw new Error('Rechnung fehlt')
    return { id, status: r.status, total: r.posten.reduce((summe, x) => summe + x.amount, 0) }
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
