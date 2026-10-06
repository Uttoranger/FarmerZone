/**
 * Reservierte Slugs (src/lib/slug.ts) gegen die echten Routen.
 *
 * Warum: Die Hofseite liegt unter /[farmSlug]. Bekäme ein Hof den Slug eines
 * festen Routenordners (/teilen, /verify, /konditionen …), gewänne die feste
 * Route dauerhaft — seine Hofseite wäre nie erreichbar, und jeder geteilte
 * Link führte woandershin.
 *
 * Beweist:
 *  - Jeder Routenordner unter src/app (oberste Ebene und durch alle
 *    Routengruppen hindurch) steht in RESERVED_SLUGS. Gelesen wird die echte
 *    Ordnerstruktur — ein künftig neuer Ordner fällt hier auf, nicht erst in
 *    Produktion. Gegenprobe: Die Suche findet bekannte Ordner aus jeder Ebene.
 *  - RESERVED_SLUGS und die Ausschlussliste KEINE_HOFSEITE aus next.config.ts
 *    sind dieselbe Menge. Die Liste wird aus der geladenen Konfiguration
 *    gelesen (die Header-Regel der Hofseiten-Vorschau), nicht nachgeschrieben.
 *  - Das Onboarding nimmt die Liste ernst: Prüfung der Verfügbarkeit und
 *    Anlegen des Hofs weichen einem reservierten Slug aus.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { farm: { findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendNewFarmNotification: vi.fn() }))

import { RESERVED_SLUGS, generateSlug } from '@/lib/slug'
import { checkSlugAvailability, createFarm } from '@/server/actions/onboarding'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Regel = { source: string; has?: { key: string }[] }

let keineHofseite: string[] = []

beforeAll(async () => {
  // Die Konfiguration ist von Sentry umschlossen; headers() bleibt unberührt.
  const { default: konfiguration } = await import('../next.config')
  const regeln = ((await konfiguration.headers?.()) ?? []) as Regel[]
  const vorschau = regeln.find((r) => r.source.startsWith('/:farmSlug(') && r.has?.some((h) => h.key === 'vorschau'))
  // Quelle: /:farmSlug((?!(?:a|b|c)$)[a-z0-9-]+) — die Namen stehen in der Klammer (?:…)
  const treffer = vorschau?.source.match(/\(\?:([a-z0-9|-]+)\)\$/)
  keineHofseite = treffer ? treffer[1].split('|') : []
}, 30_000)

/**
 * Jeder Ordner, der als feste Route auf oberster Ebene erscheint: direkt unter
 * src/app und unter jeder (auch verschachtelten) Routengruppe `(name)`.
 * Ausgenommen sind dynamische Segmente `[…]`, private Ordner `_…` und
 * parallele Routen `@…` — sie belegen keinen festen Pfad.
 */
function routenOrdner(ordner = join(process.cwd(), 'src/app')): string[] {
  const namen: string[] = []
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag)
    if (!statSync(pfad).isDirectory()) continue
    if (eintrag.startsWith('(')) namen.push(...routenOrdner(pfad))
    else if (!/^[[_@]/.test(eintrag)) namen.push(eintrag)
  }
  return namen.sort()
}

describe('RESERVED_SLUGS gegen die Ordner unter src/app', () => {
  it('die Suche findet die Ordner jeder Ebene (Gegenprobe)', () => {
    const ordner = routenOrdner()
    // oberste Ebene, (auth), (farmer), (public)
    for (const bekannt of ['teilen', 'intern', 'verify', 'meldungen', 'konditionen']) {
      expect(ordner, bekannt).toContain(bekannt)
    }
    // Das dynamische Segment der Hofseite ist keine feste Route.
    expect(ordner).not.toContain('[farmSlug]')
  })

  it('kein Hof kann den Slug eines Routenordners bekommen', () => {
    const fehlend = routenOrdner().filter((name) => !RESERVED_SLUGS.has(name))
    expect(fehlend).toEqual([])
  })

  it('jeder Routenordner ist ein möglicher Slug — die Sperre ist also nötig', () => {
    for (const name of routenOrdner()) expect(generateSlug(name), name).toBe(name)
  })
})

describe('RESERVED_SLUGS gegen KEINE_HOFSEITE (next.config.ts)', () => {
  it('die Liste wird aus der Konfiguration gelesen (Gegenprobe)', () => {
    expect(keineHofseite.length).toBeGreaterThan(20)
    expect(keineHofseite).toContain('teilen')
  })

  it('beide Listen enthalten dieselben Namen', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual([...keineHofseite].sort())
  })
})

describe('Onboarding weicht reservierten Slugs aus', () => {
  const hof = {
    ownerName: 'Erika Muster',
    description: 'Beschreibung',
    address: 'Weg 1',
    postalCode: '5270',
    city: 'Musterdorf',
    phone: '+43 660 0000000',
    email: 'hof@example.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_neu', email: 'hof@example.com' } } as never)
    // Kein Hof belegt irgendeinen Slug — nur die Reservierung greift.
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.farm.create).mockImplementation((async (a: { data: { slug: string; name: string } }) => ({
      id: 'farm_neu', slug: a.data.slug, name: a.data.name,
    })) as never)
  })

  it('meldet einen Hofnamen, der eine Route ergäbe, als nicht verfügbar', async () => {
    for (const name of ['Teilen', 'Verify', 'Problem melden', 'Farm-Page']) {
      expect((await checkSlugAvailability(name))?.available, name).toBe(false)
    }
    // Gegenprobe: ein gewöhnlicher Name ist frei.
    expect((await checkSlugAvailability('Hof am Bach'))?.available).toBe(true)
  })

  it('legt einen Hof namens „Teilen" unter teilen-2 an, nie unter teilen', async () => {
    const ergebnis = await createFarm({ ...hof, name: 'Teilen' })

    expect(ergebnis).toEqual({ farmId: 'farm_neu', farmSlug: 'teilen-2' })
  })
})
