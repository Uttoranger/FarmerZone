/**
 * Die eine Regel für `Farm.stripeAccountReady` (src/lib/stripe-konto.ts) und
 * wann Heute den Hinweis „Online-Zahlung ist pausiert" zeigt.
 */
import { describe, it, expect } from 'vitest'
import { onlineZahlungPausiert, stripeKontoBereit } from '@/lib/stripe-konto'

describe('stripeKontoBereit', () => {
  it('nur wenn Zahlungen UND Auszahlungen frei sind', () => {
    expect(stripeKontoBereit({ charges_enabled: true, payouts_enabled: true })).toBe(true)
    expect(stripeKontoBereit({ charges_enabled: false, payouts_enabled: true })).toBe(false)
    expect(stripeKontoBereit({ charges_enabled: true, payouts_enabled: false })).toBe(false)
  })

  it('fehlende Angaben zählen als nicht bereit', () => {
    expect(stripeKontoBereit({})).toBe(false)
    expect(stripeKontoBereit({ charges_enabled: true, payouts_enabled: null })).toBe(false)
  })
})

describe('onlineZahlungPausiert', () => {
  it('nur wenn der Hof online kassieren will und Stripe es nicht zulässt', () => {
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: false })).toBe(true)
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: true })).toBe(false)
    expect(onlineZahlungPausiert({ acceptsOnline: false, stripeAccountReady: false })).toBe(false)
  })
})
