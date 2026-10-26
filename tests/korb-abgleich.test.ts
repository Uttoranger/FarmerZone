/**
 * Warenkorb ehrlich (Register N28, Nr. 169): Die Hofseite gleicht einen gespeicherten Korb beim Laden mit ihrem
 * eigenen Stand ab — rein, ohne Datenbank, ohne Halt (`gleicheKorbMitHofseite`, src/lib/reservierung.ts).
 *
 * Beweist: Was es nicht mehr gibt, fällt heraus; Mengen über dem Bestand werden gekürzt (0 → raus); ein geänderter
 * Preis wird übernommen (verglichen auf den Cent über `preisAbweichungen`, auch krumme Cent); Name, Einheit, Größe und
 * Bild kommen frisch aus dem Produkt; bei einer Kaufsperre bleibt alles; ohne Änderung null. Der Satz sagt nie
 * „Reservierung abgelaufen" — auf der Hofseite gibt es keinen Halt zu prüfen.
 *
 * Dazu die Quelltext-Wache: Hofseite, Korb-Blatt, useCart und der Abgleich rufen die Prüfung der Kasse nicht auf
 * (wer nur schaut, hält nichts).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  KORB_PREIS_GEAENDERT,
  RESERVIERUNG_ABGELAUFEN,
  gleicheKorbMitHofseite,
  type HofseitenProdukt,
} from '@/lib/reservierung'
import type { WarenkorbPosition } from '@/schemas/warenkorb-speicher'

function produkt(id: string, neu: Partial<HofseitenProdukt> = {}): HofseitenProdukt {
  return { id, name: `Produkt ${id}`, price: 3.5, unit: 'kg', unitSize: 1, imageUrl: null, stock: 10, ...neu }
}

function position(id: string, quantity: number, neu: Partial<WarenkorbPosition> = {}): WarenkorbPosition {
  return { productId: id, name: `Produkt ${id}`, price: 3.5, unit: 'kg', unitSize: 1, imageUrl: null, quantity, ...neu }
}

describe('gleicheKorbMitHofseite (Register N28)', () => {
  it('nichts anders → null, nichts zu schreiben', () => {
    expect(gleicheKorbMitHofseite([position('a', 2), position('b', 1)], [produkt('a'), produkt('b')], null)).toBeNull()
  })

  it('Produkt fehlt in der Liste (gelöscht, nicht im Shop) → raus, mit Satz', () => {
    const ergebnis = gleicheKorbMitHofseite([position('a', 2), position('weg', 1)], [produkt('a')], null)
    expect(ergebnis?.positionen.map((p) => [p.productId, p.quantity])).toEqual([['a', 2]])
    expect(ergebnis?.satz).toBe('Eine Position ist nicht mehr verfügbar und wurde entfernt.')
  })

  it('Menge über dem Bestand → auf den Bestand gekürzt', () => {
    const ergebnis = gleicheKorbMitHofseite([position('a', 5)], [produkt('a', { stock: 3 })], null)
    expect(ergebnis?.positionen.map((p) => [p.productId, p.quantity])).toEqual([['a', 3]])
    expect(ergebnis?.satz).toBe('Eine Menge wurde an den verfügbaren Vorrat angepasst.')
  })

  it('Bestand 0 → raus', () => {
    const ergebnis = gleicheKorbMitHofseite([position('a', 1), position('b', 2)], [produkt('a', { stock: 0 }), produkt('b')], null)
    expect(ergebnis?.positionen.map((p) => p.productId)).toEqual(['b'])
    expect(ergebnis?.satz).toBe('Eine Position ist nicht mehr verfügbar und wurde entfernt.')
  })

  it('Gegenprobe: Menge genau gleich dem Bestand bleibt', () => {
    expect(gleicheKorbMitHofseite([position('a', 3)], [produkt('a', { stock: 3 })], null)).toBeNull()
  })

  it('Preis anders → neuer Preis und der Preissatz', () => {
    const ergebnis = gleicheKorbMitHofseite([position('a', 2, { price: 3.5 })], [produkt('a', { price: 3.9 })], null)
    expect(ergebnis?.positionen).toEqual([position('a', 2, { price: 3.9 })])
    expect(ergebnis?.satz).toBe(KORB_PREIS_GEAENDERT)
  })

  it('krumme Cent: 4,99 gegen 4,98 zählt als geändert', () => {
    const ergebnis = gleicheKorbMitHofseite([position('a', 1, { price: 4.99 })], [produkt('a', { price: 4.98 })], null)
    expect(ergebnis?.positionen[0].price).toBe(4.98)
    expect(ergebnis?.satz).toBe(KORB_PREIS_GEAENDERT)
  })

  it('Gegenprobe: ein Float-Rest unter dem Cent ist keine Änderung', () => {
    expect(gleicheKorbMitHofseite([position('a', 1, { price: 4.990000001 })], [produkt('a', { price: 4.99 })], null)).toBeNull()
  })

  it('entfernt, gekürzt und Preis zusammen: EIN Satz, Folge vorn, Preis dahinter', () => {
    const ergebnis = gleicheKorbMitHofseite(
      [position('weg', 1), position('a', 5), position('b', 1, { price: 2 })],
      [produkt('a', { stock: 2 }), produkt('b', { price: 2.2 })],
      null
    )
    expect(ergebnis?.satz).toBe(
      `Eine Position ist nicht mehr verfügbar und wurde entfernt. Eine Menge wurde an den verfügbaren Vorrat angepasst. ${KORB_PREIS_GEAENDERT}`
    )
    expect(ergebnis?.satz).not.toContain(RESERVIERUNG_ABGELAUFEN)
  })

  it('Name, Einheit, Größe und Bild kommen frisch aus dem Produkt — ohne Satz', () => {
    const ergebnis = gleicheKorbMitHofseite(
      [position('a', 2)],
      [produkt('a', { name: 'Neuer Name', unit: 'Stück', unitSize: null, imageUrl: 'https://beispiel.invalid/bild.jpg' })],
      null
    )
    expect(ergebnis?.positionen).toEqual([
      position('a', 2, { name: 'Neuer Name', unit: 'Stück', unitSize: null, imageUrl: 'https://beispiel.invalid/bild.jpg' }),
    ])
    expect(ergebnis?.satz).toBeNull()
  })

  for (const sperre of ['pause', 'keine-abholzeit', 'ausgebucht'] as const) {
    it(`Kaufsperre „${sperre}" lässt alles stehen`, () => {
      expect(gleicheKorbMitHofseite([position('weg', 1), position('a', 9, { price: 1 })], [produkt('a', { stock: 1 })], sperre)).toBeNull()
    })
  }

  it('leerer Korb → null', () => {
    expect(gleicheKorbMitHofseite([], [produkt('a')], null)).toBeNull()
  })
})

describe('Quelltext-Wache: die Hofseite prüft nicht über die Kasse (Register N28)', () => {
  const dateien = [
    'src/components/farm/product-grid.tsx',
    'src/components/farm/cart-sheet.tsx',
    'src/lib/use-cart.ts',
    'src/lib/reservierung.ts',
  ]

  for (const datei of dateien) {
    it(`${datei} ruft /api/warenkorb/pruefen nicht auf`, () => {
      expect(readFileSync(join(process.cwd(), datei), 'utf8')).not.toContain('/api/warenkorb/pruefen')
    })
  }

  it('Gegenprobe: die Kasse ruft sie auf — die Suche schlägt an', () => {
    expect(readFileSync(join(process.cwd(), 'src/components/checkout/checkout-form.tsx'), 'utf8')).toContain(
      '/api/warenkorb/pruefen'
    )
  })
})
