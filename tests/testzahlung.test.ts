/**
 * Die Regel „Testzahlung" (Register Z4, Nachtlauf Nr. 55, src/lib/testzahlung.ts):
 * Zahlart online UND angelegt vor dem Stichtag STRIPE_LIVE_AB. Bar und Karte
 * beim Hof zählen immer, ohne Stichtag gibt es keine Testzahlung.
 *
 * Geprüft in allen drei Formen derselben Regel — Prüfung, Prisma-Bedingung
 * und SQL-Baustein —, jeweils genau an der Grenze, eine Millisekunde davor und
 * danach. Dass die Datenbank die Bedingungen so auswertet, zeigt
 * tests/integration/testzahlungen.int.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { Prisma, type PaymentMethod } from '@prisma/client'
import {
  TESTZAHLUNG_ZAHLART,
  istTestzahlung,
  ohneTestzahlungenSql,
  ohneTestzahlungenWhere,
  testzahlungWhere,
  testzahlungenHinweis,
} from '@/lib/testzahlung'

// Erfundener Stichtag: Sonntag, 1. November 2026, 21:30 Uhr in Wien (MEZ, UTC+1).
const AB = new Date('2026-11-01T21:30:00+01:00')
const DAVOR = new Date(AB.getTime() - 1)
const DANACH = new Date(AB.getTime() + 1)
const ZAHLARTEN: readonly PaymentMethod[] = ['ONLINE', 'ONSITE_CASH', 'ONSITE_CARD']

describe('istTestzahlung', () => {
  it('online vor dem Stichtag ist eine Testzahlung', () => {
    expect(istTestzahlung({ paymentMethod: 'ONLINE', createdAt: DAVOR }, AB)).toBe(true)
    expect(istTestzahlung({ paymentMethod: 'ONLINE', createdAt: new Date('2026-07-06T10:00:00Z') }, AB)).toBe(true)
  })

  it('genau am Stichtag und danach zählt die Online-Bestellung schon', () => {
    expect(istTestzahlung({ paymentMethod: 'ONLINE', createdAt: AB }, AB)).toBe(false)
    expect(istTestzahlung({ paymentMethod: 'ONLINE', createdAt: DANACH }, AB)).toBe(false)
  })

  it('bar und Karte beim Hof sind nie Testzahlungen — das Geld wurde übergeben', () => {
    for (const createdAt of [DAVOR, AB, DANACH]) {
      expect(istTestzahlung({ paymentMethod: 'ONSITE_CASH', createdAt }, AB)).toBe(false)
      expect(istTestzahlung({ paymentMethod: 'ONSITE_CARD', createdAt }, AB)).toBe(false)
    }
  })

  it('ohne Stichtag gibt es keine Testzahlung — alles zählt wie vor Nr. 55', () => {
    for (const paymentMethod of ZAHLARTEN) {
      expect(istTestzahlung({ paymentMethod, createdAt: DAVOR }, null)).toBe(false)
      expect(istTestzahlung({ paymentMethod, createdAt: new Date('2020-01-01T00:00:00Z') }, null)).toBe(false)
    }
  })

  it('nennt als Zahlart nur den Weg über Stripe', () => {
    expect(TESTZAHLUNG_ZAHLART).toBe('ONLINE')
  })
})

describe('testzahlungWhere und ohneTestzahlungenWhere — dieselbe Regel für Prisma', () => {
  it('trifft genau die Testzahlungen: online und angelegt VOR dem Stichtag (lt, nicht lte)', () => {
    expect(testzahlungWhere(AB)).toEqual({ paymentMethod: 'ONLINE', createdAt: { lt: AB } })
  })

  it('verneint beide Felder zusammen, nicht jedes für sich — als Element von AND', () => {
    expect(ohneTestzahlungenWhere(AB)).toEqual({ AND: [{ NOT: { paymentMethod: 'ONLINE', createdAt: { lt: AB } } }] })
  })

  it('ein eigenes NOT des Aufrufers überschreibt die Regel nicht (Nachbesserung Runde 1)', () => {
    const bedingung = { farmId: 'hof-1', ...ohneTestzahlungenWhere(AB), NOT: { customerEmail: 'test@example.com' } }
    expect(bedingung.NOT).toEqual({ customerEmail: 'test@example.com' })
    expect(bedingung.AND).toEqual([{ NOT: { paymentMethod: 'ONLINE', createdAt: { lt: AB } } }])
  })

  it('ohne Stichtag ein leeres Objekt: eingemischt bleibt die Bedingung, wie sie war', () => {
    expect(ohneTestzahlungenWhere(null)).toStrictEqual({})
    const vorher = { farmId: 'hof-1', status: 'PICKED_UP' as const }
    expect({ ...vorher, ...ohneTestzahlungenWhere(null) }).toStrictEqual(vorher)
  })
})

describe('ohneTestzahlungenSql — dieselbe Regel für rohes SQL', () => {
  it('ohne Stichtag TRUE: die Abfrage zählt wie vor Nr. 55', () => {
    const baustein = ohneTestzahlungenSql(Prisma.sql, null)
    expect(baustein.sql).toBe('TRUE')
    expect(baustein.values).toEqual([])
  })

  it('mit Stichtag die verneinte Regel, der Zeitpunkt als gebundener Parameter — nie als Text', () => {
    const baustein = ohneTestzahlungenSql(Prisma.sql, AB)
    expect(baustein.sql).toBe(`NOT ("paymentMethod" = '${TESTZAHLUNG_ZAHLART}' AND "createdAt" < ?)`)
    expect(baustein.values).toEqual([AB])
    expect(baustein.sql).not.toContain('2026')
  })

  it('setzt sich in eine größere Abfrage ein, ohne den Parameter zu verlieren', () => {
    const von = new Date('2026-11-01T00:00:00+01:00')
    const abfrage = Prisma.sql`SELECT 1 FROM "Order" WHERE "createdAt" >= ${von} AND ${ohneTestzahlungenSql(Prisma.sql, AB)}`
    expect(abfrage.values).toEqual([von, AB])
    expect(abfrage.sql).toContain(`AND NOT ("paymentMethod" = 'ONLINE' AND "createdAt" < ?)`)
  })
})

describe('testzahlungenHinweis — die leise Zeile', () => {
  it('nennt Tag und Uhrzeit in Wiener Zeit', () => {
    expect(testzahlungenHinweis(AB)).toBe('Testzahlungen vor dem 1. November 2026, 21:30 Uhr sind nicht mitgezählt.')
  })

  it('rechnet über die Zeitumstellung in Wiener Zeit, nicht in der Zeit des Servers', () => {
    // 1. Juli, 22:15 UTC ist in Wien (MESZ) schon der 2. Juli, 00:15 Uhr.
    expect(testzahlungenHinweis(new Date('2026-07-01T22:15:00Z'))).toBe(
      'Testzahlungen vor dem 2. Juli 2026, 00:15 Uhr sind nicht mitgezählt.'
    )
  })
})
