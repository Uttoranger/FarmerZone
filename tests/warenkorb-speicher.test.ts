/**
 * Der Warenkorb im Browser-Speicher (src/lib/warenkorb-speicher.ts): Lesen
 * mit Zod, Anzahl, was das Symbol der Kopfzeile zeigt — und dass Schreiben und
 * Leeren allen im Tab Bescheid sagen.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WARENKORB_EREIGNIS,
  WARENKORB_SCHLUESSEL,
  leereWarenkorb,
  leseWarenkorb,
  positionenFuer,
  schreibeWarenkorb,
  warenkorbAnzahl,
  warenkorbImKopf,
  type WarenkorbSpeicher,
} from '@/lib/warenkorb-speicher'

const EIER = { productId: 'p-eier', name: 'Eier', price: 3.6, unit: 'PAKET', unitSize: 10, quantity: 2, imageUrl: null }
const MILCH = { productId: 'p-milch', name: 'Milch', price: 1.4, unit: 'LITER', unitSize: 1, quantity: 3, imageUrl: '/m.jpg' }

const roh = (daten: unknown) => JSON.stringify(daten)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('leseWarenkorb — Fremddaten aus dem Browser', () => {
  it('liest einen gültigen Korb samt Slug', () => {
    expect(leseWarenkorb(roh({ farmId: 'hof-1', farmSlug: 'testhof', items: [EIER, MILCH] }))).toEqual({
      farmId: 'hof-1',
      farmSlug: 'testhof',
      items: [EIER, MILCH],
    })
  })

  it('liest auch einen alten Korb ohne Slug — er bleibt erhalten', () => {
    expect(leseWarenkorb(roh({ farmId: 'hof-1', items: [EIER] }))).toEqual({ farmId: 'hof-1', farmSlug: undefined, items: [EIER] })
  })

  it('nichts, kaputtes JSON oder eine kaputte Hülle ergibt keinen Korb', () => {
    expect(leseWarenkorb(null)).toBeNull()
    expect(leseWarenkorb('{kein json')).toBeNull()
    expect(leseWarenkorb(roh({ items: [EIER] }))).toBeNull()
    expect(leseWarenkorb(roh({ farmId: 'hof-1', items: 'viele' }))).toBeNull()
    expect(leseWarenkorb(roh(['hof-1']))).toBeNull()
  })

  it('eine kaputte Position fällt allein heraus', () => {
    const kaputt = [{ ...EIER, quantity: -1 }, { ...EIER, price: 'billig' }, { ...EIER, quantity: 1.5 }, { productId: 'x' }]
    expect(leseWarenkorb(roh({ farmId: 'hof-1', items: [...kaputt, MILCH] }))?.items).toEqual([MILCH])
  })

  it('ein Slug, der kein Pfadstück ist, gilt als nicht vorhanden — nie ein Link woandershin', () => {
    for (const slug of ['//fremd.example', 'https://fremd.example', '../admin', 'Hof Test', '']) {
      expect(leseWarenkorb(roh({ farmId: 'hof-1', farmSlug: slug, items: [EIER] }))?.farmSlug, slug).toBeUndefined()
    }
  })
})

describe('positionenFuer — ein Korb, ein Hof', () => {
  const speicher: WarenkorbSpeicher = { farmId: 'hof-1', farmSlug: 'testhof', items: [EIER] }

  it('der Korb dieses Hofs', () => {
    expect(positionenFuer(speicher, 'hof-1')).toEqual([EIER])
  })

  it('der Korb eines anderen Hofs zählt hier nicht', () => {
    expect(positionenFuer(speicher, 'hof-2')).toEqual([])
    expect(positionenFuer(null, 'hof-1')).toEqual([])
  })
})

describe('warenkorbAnzahl', () => {
  it('zählt Stück, nicht Positionen', () => {
    expect(warenkorbAnzahl([EIER, MILCH])).toBe(5)
    expect(warenkorbAnzahl([])).toBe(0)
  })
})

describe('warenkorbImKopf — das Symbol in der Kopfzeile', () => {
  it('zeigt die Anzahl und führt zur Hofseite, die den Warenkorb öffnet', () => {
    expect(warenkorbImKopf({ farmId: 'hof-1', farmSlug: 'testhof', items: [EIER, MILCH] })).toEqual({
      anzahl: 5,
      href: '/testhof#warenkorb',
    })
  })

  it('kein Symbol ohne Korb, bei leerem Korb oder ohne Slug (alter Eintrag)', () => {
    expect(warenkorbImKopf(null)).toBeNull()
    expect(warenkorbImKopf({ farmId: 'hof-1', farmSlug: 'testhof', items: [] })).toBeNull()
    expect(warenkorbImKopf({ farmId: 'hof-1', items: [EIER] })).toBeNull()
  })
})

describe('schreibeWarenkorb und leereWarenkorb — alle im Tab zählen mit', () => {
  function browser(setItemWirft = false) {
    const speicher = new Map<string, string>()
    const ereignisse: string[] = []
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => speicher.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (setItemWirft) throw new DOMException('voll', 'QuotaExceededError')
        speicher.set(k, v)
      },
      removeItem: (k: string) => speicher.delete(k),
    })
    vi.stubGlobal('window', { dispatchEvent: (e: Event) => ereignisse.push(e.type) })
    return { speicher, ereignisse }
  }

  it('schreibt unter dem einen Schlüssel und meldet es', () => {
    const { speicher, ereignisse } = browser()
    schreibeWarenkorb({ farmId: 'hof-1', farmSlug: 'testhof', items: [EIER] })

    expect(leseWarenkorb(speicher.get(WARENKORB_SCHLUESSEL) ?? null)).toEqual({ farmId: 'hof-1', farmSlug: 'testhof', items: [EIER] })
    expect(ereignisse).toEqual([WARENKORB_EREIGNIS])
  })

  it('leert und meldet es', () => {
    const { speicher, ereignisse } = browser()
    speicher.set(WARENKORB_SCHLUESSEL, roh({ farmId: 'hof-1', items: [EIER] }))
    leereWarenkorb()

    expect(speicher.has(WARENKORB_SCHLUESSEL)).toBe(false)
    expect(ereignisse).toEqual([WARENKORB_EREIGNIS])
  })

  it('wirft nie, auch wenn der Speicher voll oder gesperrt ist', () => {
    const { ereignisse } = browser(true)
    expect(() => schreibeWarenkorb({ farmId: 'hof-1', items: [EIER] })).not.toThrow()
    expect(ereignisse).toEqual([WARENKORB_EREIGNIS])
  })
})

describe('Ein Schlüssel — nirgends sonst hart im Code', () => {
  it('nur src/lib/warenkorb-speicher.ts kennt den Schlüssel des Warenkorbs', () => {
    const wurzel = path.resolve(__dirname, '..', 'src')
    const treffer: string[] = []
    const durchsuche = (ordner: string) => {
      for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
        const voll = path.join(ordner, eintrag.name)
        if (eintrag.isDirectory()) durchsuche(voll)
        else if (/\.tsx?$/.test(eintrag.name) && fs.readFileSync(voll, 'utf8').includes('bauernshop_cart')) {
          treffer.push(path.relative(wurzel, voll))
        }
      }
    }
    durchsuche(wurzel)
    expect(treffer).toEqual([path.join('lib', 'warenkorb-speicher.ts')])
  })
})
