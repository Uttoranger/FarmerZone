/**
 * Die eine Regel für `Farm.stripeAccountReady` (src/lib/stripe-konto.ts) und
 * wann Heute den Hinweis „Online-Zahlung ist pausiert" zeigt.
 */
import { describe, it, expect } from 'vitest'
import {
  onlinePausiertText,
  onlineZahlungPausiert,
  stripeKontoBereit,
  zahlungNichtMoeglichText,
} from '@/lib/stripe-konto'

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
  const konto = 'acct_platzhalter'

  it('nur wenn der Hof online kassieren will, ein Konto hat und Stripe es nicht zulässt', () => {
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: false, stripeAccountId: konto })).toBe(true)
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: true, stripeAccountId: konto })).toBe(false)
    expect(onlineZahlungPausiert({ acceptsOnline: false, stripeAccountReady: false, stripeAccountId: konto })).toBe(false)
  })

  it('ein neuer Hof ohne Stripe-Konto ist nicht „pausiert" — dafür gibt es den Erste-Schritte-Schritt', () => {
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: false, stripeAccountId: null })).toBe(false)
  })
})

describe('Texte — Barzahlung nur versprechen, wenn es sie gibt', () => {
  it('Hinweis auf Heute', () => {
    expect(onlinePausiertText(true)).toContain('nur bar bei Abholung')
    expect(onlinePausiertText(false)).not.toContain('bar')
  })

  it('Antwort des Checkouts', () => {
    expect(zahlungNichtMoeglichText(true)).toBe(
      'Online-Zahlung ist gerade nicht möglich. Bitte versuch es später oder wähle Barzahlung.'
    )
    expect(zahlungNichtMoeglichText(false)).not.toContain('Barzahlung')
  })
})
