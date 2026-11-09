/**
 * Der Kasten unter „Gesamt“ auf dem Abholzettel (Nr. 249b, Antwort 8 der Projektleitung, 7.11.2026)
 * und der Satz zur Gebühr darunter (Mangel Zwischen-Durchgang A, druck Bild 1).
 *
 * Beweist: Der Titel des Kastens hängt am Stand der Bestellung — nicht abgeholt, storniert oder mit
 * entfallener Gebühr „Nichts zu kassieren“ (ohne Betrag), Karte bei Abholung „Zu kassieren“, sonst
 * „Bar zu kassieren“; online kein Kasten. Der Betrag bleibt `barZuKassierenCents` — die Wahl ändert
 * keinen Cent (Gegenprobe je Fall). Der Satz „… inkl. Plattformgebühr“ spricht vom Gesamt, nicht von den
 * Positionen (die stehen ohne Gebühr), und steht nur, wenn das Gesamt die Gebühr wirklich enthält.
 */
import { describe, it, expect } from 'vitest'
import { druckGesamtHinweis, druckKasse } from '@/lib/hof-bestellungen'
import { barZuKassierenCents } from '@/lib/servicegebuehr'
import { GEBUEHR_MODELL_HOFPREIS } from '@/lib/plattformgebuehr'

type Fall = Parameters<typeof druckKasse>[0]

const basis: Fall = {
  status: 'CONFIRMED',
  paymentMethod: 'ONSITE_CASH',
  totalAmount: '12.20',
  serviceFeeCents: 75,
  serviceFeeRefundedAt: null,
}

const mit = (teil: Partial<Fall>): Fall => ({ ...basis, ...teil })

describe('druckKasse — Titel des Kastens unter „Gesamt“', () => {
  it('bar offen: „Bar zu kassieren“ mit Betrag', () => {
    expect(druckKasse(basis)).toEqual({ titel: 'Bar zu kassieren', cents: 1295 })
  })

  it('bar abgeholt: unverändert „Bar zu kassieren“', () => {
    expect(druckKasse(mit({ status: 'PICKED_UP' }))).toEqual({ titel: 'Bar zu kassieren', cents: 1295 })
  })

  it('bar nicht abgeholt: „Nichts zu kassieren“ ohne Betrag', () => {
    expect(druckKasse(mit({ status: 'NOT_PICKED_UP' }))).toEqual({ titel: 'Nichts zu kassieren', cents: null })
  })

  it('storniert bzw. Gebühr entfallen: „Nichts zu kassieren“', () => {
    expect(druckKasse(mit({ status: 'CANCELLED', serviceFeeRefundedAt: new Date('2026-11-06T10:00:00Z') }))).toEqual({
      titel: 'Nichts zu kassieren',
      cents: null,
    })
    expect(druckKasse(mit({ serviceFeeRefundedAt: '2026-11-06T10:00:00Z' }))).toEqual({ titel: 'Nichts zu kassieren', cents: null })
    // Storniert ohne Gebühr (Altbestand vor dem Stichtag, kein Erstattungszeitpunkt): auch dann nichts zu kassieren.
    expect(druckKasse(mit({ status: 'CANCELLED', serviceFeeCents: 0 }))).toEqual({ titel: 'Nichts zu kassieren', cents: null })
  })

  it('Karte bei Abholung (Altbestand) offen: „Zu kassieren“ statt „Bar zu kassieren“', () => {
    expect(druckKasse(mit({ paymentMethod: 'ONSITE_CARD' }))).toEqual({ titel: 'Zu kassieren', cents: 1295 })
  })

  it('Karte bei Abholung nicht abgeholt: „Nichts zu kassieren“', () => {
    expect(druckKasse(mit({ paymentMethod: 'ONSITE_CARD', status: 'NOT_PICKED_UP' }))).toEqual({
      titel: 'Nichts zu kassieren',
      cents: null,
    })
  })

  it('online: kein Kasten wie bisher', () => {
    expect(druckKasse(mit({ paymentMethod: 'ONLINE', status: 'PAID' }))).toBeNull()
    expect(druckKasse(mit({ paymentMethod: 'ONLINE', status: 'NOT_PICKED_UP' }))).toBeNull()
  })

  it('Gegenprobe: der Betrag ist immer barZuKassierenCents, die Wahl rechnet nicht', () => {
    const faelle: Fall[] = [basis, mit({ status: 'PICKED_UP' }), mit({ paymentMethod: 'ONSITE_CARD' }), mit({ serviceFeeCents: 0 })]
    for (const f of faelle) expect(druckKasse(f)?.cents).toBe(barZuKassierenCents(f))
  })
})

describe('druckGesamtHinweis — Satz zur Gebühr unter dem Zettel', () => {
  const hofpreis = { gebuehrModell: GEBUEHR_MODELL_HOFPREIS, serviceFeeCents: 75, serviceFeeRefundedAt: null }

  it('Hofpreis-Modell mit Gebühr: der Satz spricht vom Gesamt, nicht von den Preisen der Positionen', () => {
    expect(druckGesamtHinweis(hofpreis)).toBe('Gesamt inkl. Plattformgebühr.')
    expect(druckGesamtHinweis(hofpreis)).not.toMatch(/^Preise/)
  })

  it('kein Satz, wenn das Gesamt die Gebühr nicht enthält (entfallen, null) oder im Modell „bisher“', () => {
    expect(druckGesamtHinweis({ ...hofpreis, serviceFeeRefundedAt: new Date('2026-11-06T10:00:00Z') })).toBeNull()
    expect(druckGesamtHinweis({ ...hofpreis, serviceFeeCents: 0 })).toBeNull()
    expect(druckGesamtHinweis({ ...hofpreis, gebuehrModell: null })).toBeNull()
  })
})
