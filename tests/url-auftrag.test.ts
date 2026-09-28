/**
 * Tests für den Auftrag in der Adresse (src/lib/url-auftrag.ts):
 * ?neu=1 öffnet den vorhandenen Anlegen-Dialog, ?edit=<id> den
 * Bearbeiten-Dialog — einmal. Danach nimmt die Seite den Parameter aus der
 * Adresse, damit Neuladen den Dialog nicht wieder öffnet.
 *
 * Die Seiten selbst lassen sich hier nicht rendern (Vitest läuft ohne DOM);
 * dass /sales und /products den Auftrag über useUrlAuftrag lesen und die
 * Adresse danach bereinigen, prüfen wir am Quelltext.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { auftragsSchluessel, leseAuftrag, ohneAuftrag } from '@/lib/url-auftrag'

const q = (suche: string) => new URLSearchParams(suche)
const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('leseAuftrag', () => {
  it('?neu=1 ist der Auftrag „neu"', () => {
    expect(leseAuftrag(q('neu=1'))).toEqual({ art: 'neu' })
  })

  it('?edit=<id> ist der Auftrag „bearbeiten"', () => {
    expect(leseAuftrag(q('edit=clx123abc'))).toEqual({ art: 'bearbeiten', id: 'clx123abc' })
  })

  it('edit sticht neu', () => {
    expect(leseAuftrag(q('neu=1&edit=abc'))).toEqual({ art: 'bearbeiten', id: 'abc' })
  })

  it('ohne oder mit unpassendem Parameter kein Auftrag', () => {
    expect(leseAuftrag(q(''))).toBeNull()
    expect(leseAuftrag(q('neu=0'))).toBeNull()
    expect(leseAuftrag(q('neu=ja'))).toBeNull()
    expect(leseAuftrag(q('edit='))).toBeNull()
    expect(leseAuftrag(q('edit=%3Cscript%3E'))).toBeNull()
    expect(leseAuftrag(q(`edit=${'a'.repeat(65)}`))).toBeNull()
  })

  it('ein anderer Auftrag hat einen anderen Schlüssel', () => {
    expect(auftragsSchluessel(null)).toBeNull()
    expect(auftragsSchluessel({ art: 'neu' })).toBe('neu')
    expect(auftragsSchluessel({ art: 'bearbeiten', id: 'a' })).not.toBe(auftragsSchluessel({ art: 'bearbeiten', id: 'b' }))
  })
})

describe('ohneAuftrag — die Adresse nach dem Öffnen', () => {
  it('nimmt neu und edit heraus', () => {
    expect(ohneAuftrag('/sales', '?neu=1')).toBe('/sales')
    expect(ohneAuftrag('/products', '?edit=abc')).toBe('/products')
  })

  it('lässt andere Parameter und den Anker stehen', () => {
    expect(ohneAuftrag('/products', '?neu=1&filter=eier', '#liste')).toBe('/products?filter=eier#liste')
  })
})

describe('an den Seiten', () => {
  it('/products öffnet über useUrlAuftrag — neu und bearbeiten, ohne den alten Einmal-Effekt', () => {
    const liste = quelle('src/components/products/product-list.tsx')
    expect(liste).toContain('useUrlAuftrag(')
    expect(liste).toContain("auftrag.art === 'neu'")
    expect(liste).not.toContain('initialEditId')
    expect(quelle('src/app/(farmer)/products/page.tsx')).not.toContain('initialEditId')
  })

  it('/sales öffnet „Verkauf eintragen" über useUrlAuftrag', () => {
    const verkauf = quelle('src/components/sales/sales-client.tsx')
    expect(verkauf).toMatch(/useUrlAuftrag\(\(auftrag\) => \{\s*if \(auftrag\.art === 'neu'\) openNewSale\(\)/)
  })

  it('der Hook nimmt den Auftrag per replaceState aus der Adresse', () => {
    const hook = quelle('src/lib/use-url-auftrag.ts')
    expect(hook).toContain('useSearchParams()')
    expect(hook).toMatch(/window\.history\.replaceState\(null, '', ohneAuftrag\(/)
  })
})
