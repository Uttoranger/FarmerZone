/**
 * Die Konditionen für Höfe (src/lib/konditionen.ts, Nr. 15): eine Quelle für
 * jede Preisangabe, der Satz der Servicegebühr aus servicegebuehr.ts.
 */
import { describe, expect, it } from 'vitest'
import { Tarif } from '@prisma/client'
import {
  SERVICEGEBUEHR_SATZ_TEXT,
  SERVICEGEBUEHR_ZAHLT_KUNDE,
  START_TARIF,
  TARIFE,
  grundgebuehrText,
  tarifKarte,
  tarifText,
} from '@/lib/konditionen'
import { SERVICEGEBUEHR_STANDARD_MIND_CENTS, SERVICEGEBUEHR_STANDARD_PROZENT } from '@/lib/servicegebuehr'

describe('Tarife (E6)', () => {
  it('Hoftor kostet € 0, Hofladen € 19 im Monat', () => {
    expect(tarifText('HOFTOR')).toMatchObject({ name: 'Hoftor', grundgebuehrCents: 0, preis: '€ 0' })
    expect(tarifText('HOFLADEN')).toMatchObject({ name: 'Hofladen', grundgebuehrCents: 1900, preis: '€ 19' })
  })

  it('führt genau die Werte des Prisma-Enums Tarif', () => {
    expect(TARIFE.map((t) => t.id).sort()).toEqual(Object.values(Tarif).sort())
  })

  it('der Preistext kommt aus der Grundgebühr, nicht von Hand', () => {
    for (const tarif of TARIFE) expect(tarif.preis).toBe(grundgebuehrText(tarif.grundgebuehrCents))
  })

  it('krumme Beträge behalten ihre Cent', () => {
    expect(grundgebuehrText(1950)).toBe('€ 19,50')
    expect(grundgebuehrText(2000)).toBe('€ 20')
  })

  it('gestartet wird mit dem günstigsten Tarif', () => {
    const guenstigster = [...TARIFE].sort((a, b) => a.grundgebuehrCents - b.grundgebuehrCents)[0]
    expect(START_TARIF.id).toBe(guenstigster.id)
  })
})

describe('Servicegebühr — Satz aus servicegebuehr.ts (E4)', () => {
  it('nennt 5 % und mind. € 0,50', () => {
    expect(SERVICEGEBUEHR_SATZ_TEXT).toBe('5 % (mind. € 0,50)')
    expect(SERVICEGEBUEHR_ZAHLT_KUNDE).toContain('5 % (mind. € 0,50) zahlt der Kunde')
  })

  it('Gegenprobe: die Zahlen im Text sind die Konstanten des Gebührenmoduls', () => {
    expect(SERVICEGEBUEHR_STANDARD_PROZENT).toBe(5)
    expect(SERVICEGEBUEHR_STANDARD_MIND_CENTS).toBe(50)
    expect(SERVICEGEBUEHR_SATZ_TEXT).toContain(`${SERVICEGEBUEHR_STANDARD_PROZENT} %`)
    expect(SERVICEGEBUEHR_SATZ_TEXT).toContain(`0,${SERVICEGEBUEHR_STANDARD_MIND_CENTS}`)
  })
})

describe('tarifKarte — Einrichten', () => {
  it('ohne gewählten Tarif (heute jeder Hof): beide Tarife, kein „Dein Tarif"', () => {
    const karte = tarifKarte(null)
    expect(karte.titel).toBe('Tarife')
    expect(karte.tarife).toHaveLength(2)
  })

  it('mit Tarif: genau dieser', () => {
    const karte = tarifKarte('HOFLADEN')
    expect(karte.titel).toBe('Dein Tarif')
    expect(karte.tarife.map((t) => t.name)).toEqual(['Hofladen'])
  })
})
