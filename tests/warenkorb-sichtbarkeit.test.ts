/**
 * Regressionsschutz: Ein ausgeblendetes Produkt kommt nicht durch den Checkout
 * (src/server/warenkorb.ts).
 *
 * KEIN BUGFIX — die Sperre gibt es schon. Der Checkout ruft in Schritt 3
 * `pruefeSitzungsWarenkorb`, das liest `isAvailable` mit, und `pruefeWarenkorb`
 * macht daraus `zustand: 'weg'`; der Handler antwortet 409, bevor Bestand
 * gebucht wird. Getestet war davon bisher nur die reine Funktion
 * (`tests/reservierung.test.ts`), nicht die Stelle, die `isAvailable` überhaupt
 * ABFRAGT und auf `verkaeuflich` abbildet.
 *
 * Warum jetzt: Mit dem Sichtbarkeits-Schalter wird Ausblenden ein Alltagsgriff —
 * ein Tipp, zwanzig Mal am Tag. Fiele `isAvailable` eines Tages aus der
 * `select`-Liste in warenkorb.ts, wäre nichts rot, und ausgeblendete Ware ließe
 * sich aus einem alten Warenkorb bestellen. Genau das hält dieser Test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    stockReservation: { findMany: vi.fn() },
  },
}))

import { pruefeSitzungsWarenkorb } from '@/server/warenkorb'
import { prisma } from '@/lib/prisma'
import { CODE_RESERVIERUNG_ABGELAUFEN } from '@/lib/reservierung'

const produktFindMany = vi.mocked(prisma.product.findMany)
const halteFindMany = vi.mocked(prisma.stockReservation.findMany)

const JETZT = new Date('2026-09-25T10:00:00.000Z')
const SITZUNG = 'sitzung-1'

/**
 * Bestand und Halte stellen. Der eigene Halt gilt noch — sonst hätte jede
 * Position schon deshalb `abgelaufen`, und der Test bewiese nur das.
 */
function stelleEin(produkt: { id: string; stock: number; isAvailable: boolean }) {
  produktFindMany.mockResolvedValue([produkt] as never)
  halteFindMany.mockImplementation(((argumente: unknown) => {
    const sessionId = (argumente as { where?: { sessionId?: unknown } })?.where?.sessionId
    // { not: … } fragt die FREMDEN Halte ab — hier blockiert niemand.
    if (sessionId && typeof sessionId === 'object') return Promise.resolve([])
    return Promise.resolve([
      {
        productId: produkt.id,
        quantity: 2,
        expiresAt: new Date(JETZT.getTime() + 10 * 60 * 1000),
      },
    ])
  }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('pruefeSitzungsWarenkorb — ausgeblendete Produkte', () => {
  it('nimmt ein ausgeblendetes Produkt aus dem Warenkorb, obwohl Bestand da ist', async () => {
    stelleEin({ id: 'p1', stock: 50, isAvailable: false })

    const pruefung = await pruefeSitzungsWarenkorb([{ productId: 'p1', quantity: 2 }], SITZUNG, JETZT)

    expect(pruefung.befund.etwasGeaendert).toBe(true)
    expect(pruefung.befund.positionen[0]).toMatchObject({ zustand: 'weg', moeglich: 0 })
    // Der berichtigte Warenkorb, den die 409-Antwort mitschickt, enthält es nicht.
    expect(pruefung.berichtigt).toEqual([])
    expect(pruefung.meldung).not.toBeNull()
  })

  it('fragt isAvailable überhaupt ab — genau das darf nie aus der select-Liste fallen', async () => {
    stelleEin({ id: 'p1', stock: 50, isAvailable: true })

    await pruefeSitzungsWarenkorb([{ productId: 'p1', quantity: 2 }], SITZUNG, JETZT)

    const auswahl = (produktFindMany.mock.calls[0][0] as { select: Record<string, boolean> }).select
    expect(auswahl.isAvailable).toBe(true)
    expect(auswahl.stock).toBe(true)
  })

  it('lässt ein sichtbares Produkt mit Bestand unverändert durch', async () => {
    stelleEin({ id: 'p1', stock: 50, isAvailable: true })

    const pruefung = await pruefeSitzungsWarenkorb([{ productId: 'p1', quantity: 2 }], SITZUNG, JETZT)

    expect(pruefung.befund.etwasGeaendert).toBe(false)
    expect(pruefung.befund.etwasAbgelaufen).toBe(false)
    expect(pruefung.meldung).toBeNull()
    expect(pruefung.berichtigt).toEqual([{ productId: 'p1', quantity: 2 }])
  })

  it('nennt ein ausgeblendetes Produkt „weg", nicht „gekürzt" — auch bei Menge 1', async () => {
    // Grenzfall: Eine Kürzung würde bedeuten, dass etwas davon noch geht.
    stelleEin({ id: 'p1', stock: 50, isAvailable: false })

    const pruefung = await pruefeSitzungsWarenkorb([{ productId: 'p1', quantity: 1 }], SITZUNG, JETZT)

    expect(pruefung.befund.positionen[0]!.zustand).toBe('weg')
  })

  it('ein Produkt, das es gar nicht mehr gibt, fällt genauso', async () => {
    produktFindMany.mockResolvedValue([] as never)
    halteFindMany.mockResolvedValue([] as never)

    const pruefung = await pruefeSitzungsWarenkorb([{ productId: 'weg', quantity: 1 }], SITZUNG, JETZT)

    expect(pruefung.befund.etwasGeaendert).toBe(true)
    expect(pruefung.befund.positionen[0]!.zustand).toBe('weg')
    // Ohne eigenen Halt gilt die Position zusätzlich als abgelaufen — der
    // Checkout nennt dann diesen Grund zuerst.
    expect(pruefung.befund.etwasAbgelaufen).toBe(true)
    expect(CODE_RESERVIERUNG_ABGELAUFEN).toBe('RESERVIERUNG_ABGELAUFEN')
  })
})
