/**
 * Quelltext-Wache (Nr. 168, Register N26, Ergänzung 25.10.2026): Ein
 * Mail-Auftrag hält nie eine Zahlung, Barbestätigung, einen Storno oder
 * Statuswechsel einer Bestellung auf. Die Bestellwege stellen darum nur über
 * `stelleMailEinInTransaktion` (Savepoint, wirft nie) bzw. nach dem Commit
 * über `stelleEinOhneRisiko` ein — nie über `stelleMailEin(…, tx)`, das bei
 * einem Fehler die ganze Transaktion kippt. Postfach, Beitrag und
 * Rundschreiben bleiben bewusst bei `stelleMailEin(…, tx)` („alles oder
 * nichts") und stehen deshalb nicht in der Liste.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BESTELLWEGE = ['src/app/api/stripe/webhook/route.ts', 'src/server/actions/bar-bestaetigung.ts', 'src/server/actions/orders.ts', 'src/server/stornieren.ts']

/** Aufrufe von `stelleMailEin(` — nicht `stelleMailEinInTransaktion(`. */
function direkteAufrufe(quelltext: string): string[] {
  return quelltext.split('\n').filter((zeile) => /\bstelleMailEin\s*\(/.test(zeile))
}

describe('Bestellwege stellen nie mit stelleMailEin in ihrer Transaktion ein', () => {
  it.each(BESTELLWEGE)('%s: kein stelleMailEin(…), dafür stelleMailEinInTransaktion', (datei) => {
    const quelltext = readFileSync(join(process.cwd(), datei), 'utf8')
    expect(direkteAufrufe(quelltext)).toEqual([])
    expect(quelltext).toMatch(/\bstelleMailEinInTransaktion\(/)
  })

  it('Gegenprobe: der alte Stand (stelleMailEin mit dem Transaktions-Client) fällt auf', () => {
    const alt = [
      "      if (geaendert > 0) await stelleMailEin(bestellMailAuftrag('abholbereit', { id: orderId, farmId: farm.id }, new Date()), tx)",
      '      if (count === 1) await stelleMailEin(auftrag, tx)',
    ].join('\n')
    expect(direkteAufrufe(alt)).toHaveLength(2)
    expect(direkteAufrufe('await stelleMailEinInTransaktion(auftrag, tx)')).toEqual([])
  })
})
