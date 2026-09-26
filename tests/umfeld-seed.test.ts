/**
 * Das Umfeld des Pilothofs gegen den Testdatensatz (prisma/seed-daten.ts) —
 * ohne Datenbank. Die Zahlen sind die aus Phase 0 des Umfeld-Sprints, von
 * Hand aus dem Datensatz gerechnet; hier werden sie festgenagelt.
 *
 * Wie, ohne Datenbank: Die Prisma-Attrappe unten WERTET die WHERE-Klausel der
 * Query auf den Seed-Höfen AUS, statt feste Antworten zu geben. Ändert jemand
 * die Sichtbarkeit oder die Box der Query, ändert sich das Ergebnis hier mit —
 * und eine Bedingung, die die Attrappe nicht kennt, lässt den Test scheitern,
 * statt still durchzurutschen.
 *
 * Der Pilothof liegt im Datensatz in 5280 Braunau am Inn (48.2563/13.0434).
 */
import { describe, expect, it, vi } from 'vitest'
import { Decimal } from '@prisma/client/runtime/index-browser'
import { SEED_HOEFE, type SeedHof } from '../prisma/seed-daten'

type HofZeile = {
  id: string
  slug: string
  name: string
  city: string
  latitude: number | null
  longitude: number | null
  isActive: boolean
  isPaused: boolean
  archivedAt: Date | null
  approvedAt: Date | null
}

/** So legt der Seed-Lauf die Höfe an (prisma/seed-lauf.ts, `stamm`): aktiv, nicht pausiert, nicht stillgelegt. */
function alsZeile(h: SeedHof): HofZeile {
  return {
    id: h.slug,
    slug: h.slug,
    name: h.name,
    city: h.ort,
    latitude: h.breite,
    longitude: h.laenge,
    isActive: true,
    isPaused: false,
    archivedAt: null,
    approvedAt: h.freigegeben ? new Date('2026-06-01') : null,
  }
}

const HOEFE = SEED_HOEFE.map(alsZeile)

function imBereich(wert: number | null, bedingung: unknown): boolean {
  if (bedingung === null) return wert === null
  const { gte, lte } = bedingung as { gte: number; lte: number }
  return wert !== null && wert >= gte && wert <= lte
}

/** Wertet genau die Bedingungen aus, die die Query stellt — alles andere ist ein Fehler. */
function passt(hof: HofZeile, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([schluessel, bedingung]) => {
    switch (schluessel) {
      case 'isActive':
      case 'isPaused':
        return hof[schluessel] === bedingung
      case 'archivedAt':
        if (bedingung !== null) throw new Error('archivedAt: nur null erwartet')
        return hof.archivedAt === null
      case 'approvedAt':
        if (JSON.stringify(bedingung) !== '{"not":null}') throw new Error('approvedAt: nur { not: null } erwartet')
        return hof.approvedAt !== null
      case 'id':
        return typeof bedingung === 'string' ? hof.id === bedingung : hof.id !== (bedingung as { not: string }).not
      case 'latitude':
      case 'longitude':
        return imBereich(hof[schluessel], bedingung)
      case 'OR':
        return (bedingung as Record<string, unknown>[]).some((teil) => passt(hof, teil))
      default:
        throw new Error(`Bedingung, die die Attrappe nicht kennt: ${schluessel}`)
    }
  })
}

const dezimal = (n: number) => new Decimal(n)

function produktZeilen(h: SeedHof, nurImShop: boolean) {
  return h.produkte
    .filter((p) => !nurImShop || p.imShop)
    .map((p) => ({
      farmId: h.slug,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory,
      price: dezimal(p.preis),
      unit: p.einheit,
      unitSize: p.gebindeGroesse === null ? null : dezimal(p.gebindeGroesse),
      stock: p.bestand,
      // Der Seed schreibt keine Reservierung — die Spalte steht auf 0.
      reservedStock: 0,
      futter: p.futter ? { nettoMenge: dezimal(p.futter.nettoMenge), nettoEinheit: p.futter.nettoEinheit } : null,
    }))
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const h = SEED_HOEFE.find((x) => x.slug === where.id)
        if (!h) return null
        return { slug: h.slug, latitude: h.breite, longitude: h.laenge, products: produktZeilen(h, true) }
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        HOEFE.filter((h) => passt(h, where)).map(({ id, slug, name, city, latitude, longitude }) => ({
          id,
          slug,
          name,
          city,
          latitude,
          longitude,
        }))
      ),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => HOEFE.filter((h) => passt(h, where)).length),
    },
    product: {
      findMany: vi.fn(async ({ where }: { where: { farmId: { in: string[] }; isAvailable: boolean } }) => {
        if (where.isAvailable !== true) throw new Error('nur sichtbare Produkte erwartet')
        return SEED_HOEFE.filter((h) => where.farmId.in.includes(h.slug)).flatMap((h) => produktZeilen(h, true))
      }),
    },
  },
}))

import { getUmfeld } from '@/server/queries/umfeld'
import { baueUmfeld, hoefeMitAngebotIm } from '@/lib/umfeld'

const PILOTHOF = 'hof-mueller'

async function umfeld(km: 10 | 25 | 50) {
  const daten = await getUmfeld(PILOTHOF, km)
  if (!daten?.eigenerStandort) throw new Error('Der Pilothof braucht einen Standort')
  return daten
}

describe('Umfeld des Pilothofs im Testdatensatz', () => {
  it.each([
    [10, 5, 4, 4],
    [25, 19, 11, 13],
    [50, 34, 20, 23],
  ] as const)('%i km: %i Höfe, davon %i im Hofladen und %i mit Futtermitteln', async (km, gesamt, hofladen, futter) => {
    const daten = await umfeld(km)
    expect(daten.hoefe).toHaveLength(gesamt)
    expect(hoefeMitAngebotIm(daten.hoefe, 'LEBENSMITTEL')).toBe(hofladen)
    expect(hoefeMitAngebotIm(daten.hoefe, 'FUTTERMITTEL')).toBe(futter)
  })

  it('lässt den Pilothof selbst, den nicht freigegebenen Hof und den ohne Standort weg', async () => {
    const daten = await umfeld(50)
    const slugs = daten.hoefe.map((h) => h.slug)
    expect(slugs).not.toContain(PILOTHOF)
    expect(slugs).not.toContain('hof-wartend')
    expect(slugs).not.toContain('hof-ohne-standort')
    expect(daten.ohneStandort).toHaveLength(1)
    expect(daten.abgeschnitten).toBe(false)
  })

  it('die Box schneidet keinen Hof knapp an der Grenze ab — die exakte Entfernung entscheidet', async () => {
    const zehn = (await umfeld(10)).hoefe.map((h) => h.slug)
    expect(zehn).toContain('kirchbauernhof') // 9,80 km
    expect(zehn).not.toContain('wengerhof') // 10,24 km
    const fuenfundzwanzig = (await umfeld(25)).hoefe.map((h) => h.slug)
    expect(fuenfundzwanzig).toContain('weilbachhof') // 24,41 km
    expect(fuenfundzwanzig).not.toContain('hoehenbauernhof') // 25,15 km
  })

  it('steht auf /hoefe und bekommt deshalb einen Kartenlink', async () => {
    expect((await umfeld(25)).eigenerSlug).toBe(PILOTHOF)
  })

  it('nennt den Hof ohne Standort nur im Bereich, in dem er etwas anbietet', async () => {
    // Er führt Käse und Fisch — also Hofladen, kein Futter.
    const daten = await umfeld(25)
    expect(baueUmfeld({ ...daten, bereich: 'LEBENSMITTEL', km: 25 }).hinweise).toEqual([
      '1 Hof ohne Standort nicht berücksichtigt.',
    ])
    expect(baueUmfeld({ ...daten, bereich: 'FUTTERMITTEL', km: 25 }).hinweise).toEqual([])
  })

  it('zeigt Wiesenheu im 25-km-Umkreis bei 12 Höfen, getrennt nach Klein- und Großgebinde, mit deinem Preis', async () => {
    const daten = await umfeld(25)
    const { zeilen } = baueUmfeld({ ...daten, bereich: 'FUTTERMITTEL', km: 25 })
    const heu = zeilen.find((z) => z.titel === 'Wiesenheu')
    expect(heu?.anzahlHoefe).toBe(12)
    expect(heu?.preise.map((p) => p.klasse)).toEqual(['Kleingebinde', 'Großgebinde'])
    // Der Pilothof verkauft Kleinballen à 15 kg — „Deins" steht in der Klasse Klein.
    expect(heu?.preise[0].deins).not.toBeNull()
    expect(heu?.preise[1].deins).toBeNull()
    // Zeilen mit eigenem Produkt stehen oben.
    expect(zeilen[0].eigenesProdukt).toBe(true)
  })
})
