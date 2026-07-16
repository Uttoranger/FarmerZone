/**
 * Tests für die Dashboard-Hinweiskarten und die Kunden-gesamt-Zahl
 * (src/lib/dashboard-hints.ts).
 *
 * Beweist: Low-Stock-Schwelle (≤5 zählt, 6 nicht, leer → keine Karte),
 * Status-Erinnerung (≥6 Tage, exakt 6, frisch → keine Karte, nie → 'never'),
 * eindeutige Kundenzählung (case-insensitive).
 */
import { describe, it, expect } from 'vitest'
import {
  buildLowStockHint,
  statusReminder,
  countUniqueCustomers,
  LOW_STOCK_THRESHOLD,
  STATUS_REMINDER_DAYS,
} from '@/lib/dashboard-hints'

const NOW = new Date(2026, 6, 20, 10, 0, 0)

describe('buildLowStockHint', () => {
  it('Schwelle ist 5 (entspricht der bestehenden Low-Stock-Konstante)', () => {
    expect(LOW_STOCK_THRESHOLD).toBe(5)
  })

  it('zeigt ein einzelnes knappes Produkt als "Nur noch X: Name"', () => {
    expect(buildLowStockHint([{ name: 'Brennholz Buche', stock: 3 }])).toBe(
      'Nur noch 3: Brennholz Buche'
    )
  })

  it('listet mehrere knappe Produkte mit Beständen auf', () => {
    const hint = buildLowStockHint([
      { name: 'Eier', stock: 2 },
      { name: 'Brennholz', stock: 5 },
    ])
    expect(hint).toContain('Eier (2)')
    expect(hint).toContain('Brennholz (5)')
  })

  it('genau an der Schwelle (5) zählt als knapp, 6 nicht mehr', () => {
    expect(buildLowStockHint([{ name: 'A', stock: 5 }])).not.toBeNull()
    expect(buildLowStockHint([{ name: 'A', stock: 6 }])).toBeNull()
  })

  it('ohne knappe Produkte keine Karte (null)', () => {
    expect(buildLowStockHint([])).toBeNull()
  })
})

describe('statusReminder', () => {
  it('Schwelle ist 6 Tage (passt zum Frequenzschutz 1/Woche)', () => {
    expect(STATUS_REMINDER_DAYS).toBe(6)
  })

  it("meldet 'never', wenn nie ein Status veröffentlicht wurde", () => {
    expect(statusReminder(null, NOW)).toBe('never')
  })

  it('meldet die Tage, wenn der letzte Status ≥ 6 Tage her ist', () => {
    expect(statusReminder(new Date(2026, 6, 13, 10), NOW)).toBe(7)
    expect(statusReminder(new Date(2026, 6, 14, 10), NOW)).toBe(6)
  })

  it('bleibt still (null), wenn der letzte Status frisch genug ist', () => {
    expect(statusReminder(new Date(2026, 6, 15, 10), NOW)).toBeNull()
    expect(statusReminder(new Date(2026, 6, 20, 8), NOW)).toBeNull()
  })

  it('akzeptiert ISO-Strings (Prisma-Serialisierung)', () => {
    expect(statusReminder(new Date(2026, 6, 10).toISOString(), NOW)).toBe(10)
  })
})

describe('countUniqueCustomers (Kunden gesamt)', () => {
  it('zählt eindeutige E-Mails über alle Bestellungen', () => {
    expect(
      countUniqueCustomers([
        { customerEmail: 'anna@example.com' },
        { customerEmail: 'josef@example.com' },
        { customerEmail: 'anna@example.com' },
      ])
    ).toBe(2)
  })

  it('ignoriert Groß-/Kleinschreibung', () => {
    expect(
      countUniqueCustomers([{ customerEmail: 'Anna@Example.com' }, { customerEmail: 'anna@example.com' }])
    ).toBe(1)
  })

  it('leere Liste ergibt 0', () => {
    expect(countUniqueCustomers([])).toBe(0)
  })
})
