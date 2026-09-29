import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { zuProduktDto } from '@/lib/produkt-dto'

describe('zuProduktDto', () => {
  it('macht aus Preis und Gebindegröße Zahlen und lässt den Rest stehen', () => {
    const dto = zuProduktDto({
      id: 'p1',
      name: 'Erdäpfel',
      price: new Prisma.Decimal('19.99'),
      unitSize: new Prisma.Decimal('2.5'),
    })
    expect(dto).toEqual({ id: 'p1', name: 'Erdäpfel', price: 19.99, unitSize: 2.5 })
  })

  it('lässt eine fehlende Gebindegröße null', () => {
    expect(zuProduktDto({ price: new Prisma.Decimal('3.5'), unitSize: null })).toEqual({
      price: 3.5,
      unitSize: null,
    })
  })

  it('fügt keine Gebindegröße hinzu, wenn die Abfrage sie nicht liest', () => {
    const dto = zuProduktDto({ name: 'Heu', price: new Prisma.Decimal('0.10') })
    expect(dto).toEqual({ name: 'Heu', price: 0.1 })
    expect('unitSize' in dto).toBe(false)
  })
})
