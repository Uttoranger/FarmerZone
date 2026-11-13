/**
 * `fehlerArt` (Nr. 288): Für das Log im Geldpfad nur die Art eines Fehlers —
 * Name und ein kurzer Code, nie die Meldung. Meldungen von Prisma und Stripe
 * können Adressen, Werte aus der Anfrage oder Teile von SQL tragen.
 */
import { describe, it, expect } from 'vitest'
import Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import { fehlerArt } from '@/lib/fehler-art'

describe('fehlerArt', () => {
  it('nennt bei einem Prisma-Fehler Klasse und Code', () => {
    const fehler = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`customerEmail`)', {
      code: 'P2002',
      clientVersion: 'test',
    })
    expect(fehlerArt(fehler)).toBe('PrismaClientKnownRequestError P2002')
  })

  it('nennt bei einem Stripe-Fehler Klasse und Code', () => {
    const fehler = new Stripe.errors.StripeCardError({ type: 'card_error', code: 'card_declined', message: 'Your card was declined.' })
    expect(fehlerArt(fehler)).toBe('StripeCardError card_declined')
  })

  it('gibt eine Adresse aus der Meldung nie heraus', () => {
    const fehler = new Error('Kein Konto für erika.muster@example.com gefunden')
    const art = fehlerArt(fehler)
    expect(art).toBe('Error')
    expect(art).not.toContain('example.com')
    expect(art).not.toContain('@')
  })

  it('lässt einen Code weg, der kein kurzes Kennwort ist (z. B. mit Adresse oder Leerzeichen)', () => {
    const mitAdresse = Object.assign(new Error('x'), { code: 'erika@example.com' })
    const mitLeerzeichen = Object.assign(new TypeError('x'), { code: 'zwei Wörter' })
    const zuLang = Object.assign(new RangeError('x'), { code: 'A'.repeat(41) })
    expect(fehlerArt(mitAdresse)).toBe('Error')
    expect(fehlerArt(mitLeerzeichen)).toBe('TypeError')
    expect(fehlerArt(zuLang)).toBe('RangeError')
  })

  it('nimmt eine Zahl als Code nicht (nur Text)', () => {
    expect(fehlerArt(Object.assign(new Error('x'), { code: 42 }))).toBe('Error')
  })

  it('ein Nicht-Fehler ist „Unbekannt“', () => {
    expect(fehlerArt('erika@example.com')).toBe('Unbekannt')
    expect(fehlerArt(null)).toBe('Unbekannt')
    expect(fehlerArt(undefined)).toBe('Unbekannt')
    expect(fehlerArt({ message: 'kein Error-Objekt' })).toBe('Unbekannt')
  })
})
