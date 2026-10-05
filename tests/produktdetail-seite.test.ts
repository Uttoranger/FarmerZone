/**
 * Die Produktseite /[farmSlug]/produkt/[id] (Nachtlauf Nr. 11) — Seite und
 * Ansicht, gerendert mit react-dom/server in Node (TESTING_GUIDELINES §1).
 * Merkmale sind Texte, aria-Beschriftungen, Rollen und data-slot — keine
 * Layout-Klassen.
 *
 * Beweist:
 *  - Sichtbarkeit wie auf der Hofseite: dieselbe Abfrage (ladeHofseiteGeteilt
 *    mit Slug und Suchparametern); falscher Slug, fremdes Produkt und
 *    ausgeblendetes Produkt enden in notFound() — die ID allein reicht nie.
 *  - Metadaten nur aus öffentlichen Daten; die Vorschau bleibt noindex.
 *  - Fokus-Seite: Kopfzeile, aber keine Unterleiste am Handy (Gegenprobe: die
 *    KundeShell hat sonst eine).
 *  - Größenkacheln der Familie als Auswahl (Pfeiltasten über die
 *    Radio-Gruppe), ohne Familie keine; ?groesse= wählt.
 *  - Stepper endet am Bestand; „In den Korb · € …" in Cent gerechnet.
 *  - Schild nach E9, Kennzeichnung zugeklappt mit „laut Angabe des Hofs",
 *    „Gleich mit abholen", kein „Merken".
 *  - Pausiert: kein Kaufknopf, Hinweis.
 *  - Beide Themes: nur Tokens in allen Dateien der Route.
 * Je Aussage eine Gegenprobe, dass die Suche das Merkmal auch findet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const NICHT_GEFUNDEN = new Error('NEXT_NOT_FOUND')
const adresse = { suche: '' }
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw NICHT_GEFUNDEN
  },
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test/produkt/p_5kg',
  useSearchParams: () => new URLSearchParams(adresse.suche),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; onNavigate?: unknown; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('@/server/hofseite-vorschau', () => ({ ladeHofseiteGeteilt: vi.fn() }))

import ProduktSeite, { generateMetadata } from '@/app/(public)/[farmSlug]/produkt/[id]/page'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { KundeShell, type KundeShellProps } from '@/components/shells/kunde-shell'
import type { PublicFarm, PublicFutter, PublicProduct } from '@/server/queries/farm'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'

const lade = vi.mocked(ladeHofseiteGeteilt)

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
function dateien(ordner: string): string[] {
  const funde: string[] = []
  for (const name of readdirSync(join(WURZEL, ordner))) {
    const pfad = join(ordner, name)
    if (statSync(join(WURZEL, pfad)).isDirectory()) funde.push(...dateien(pfad))
    else if (/\.tsx?$/.test(name)) funde.push(relative(WURZEL, join(WURZEL, pfad)))
  }
  return funde
}

function futter(nettoMenge: number): PublicFutter {
  return {
    futtermittelart: 'EINZELFUTTERMITTEL', zielTierarten: ['HEIMTIER'], zusammensetzung: 'Wiesenheu, erster Schnitt',
    analytischeBestandteile: 'Rohprotein 9 %', zusatzstoffe: null, gebrauchshinweis: null,
    nettoMenge, nettoEinheit: 'KG', rohprotein: null, rohfaser: null, rohfett: null, rohasche: null,
    betriebsnummer: '1234567', bestaetigtAm: '2026-09-20T08:00:00.000Z',
  }
}

function produkt(id: string, teil: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id, name: `Produkt ${id}`, description: null, imageUrl: null, category: 'GEMUESE', categoryImageUrl: null,
    price: 4.5, unit: 'STUECK', unitSize: null, stock: 20, isAvailable: true, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null,
    familieId: null, brennmaterial: null,
    ...teil,
  }
}

const HEU = { category: 'HEU_STROH' as const, familieId: 'fam_heu' }
const HOF: PublicFarm = {
  id: 'farm_test', slug: 'hof-test', name: 'Hof Test', ownerName: 'Erika Muster',
  description: 'Gemüse aus Musterdorf', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf',
  phone: '+43 660 0000000', email: 'hof@example.com', logoUrl: null, bannerUrl: null,
  tagline: null, foundedYear: null, aboutText: null, bannerType: 'GRADIENT', bannerValue: null, bannerFocusY: 50,
  sectionsConfig: [], farmValues: [], farmPhotos: [],
  acceptsOnline: true, acceptsOnsite: true, stripeAccountReady: true, isPaused: false, pauseMessage: null,
  serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: new Date('2026-01-01T00:00:00Z'),
  betriebsstatus: 'PRIMAERPRODUKTION',
  products: [
    produkt('p_1kg', { ...HEU, name: 'Bergwiesen-Heu 1 kg-Sackerl', price: 2.5, futter: futter(1) }),
    produkt('p_5kg', { ...HEU, name: 'Bergwiesen-Heu 5 kg-Sack', price: 8, stock: 3, futter: futter(5), description: 'Fein und staubarm.' }),
    produkt('p_rund', { ...HEU, name: 'Bergwiesen-Heu Rundballen', price: 45, unit: 'BALLEN', futter: futter(250) }),
    produkt('p_eier', { name: 'Freilandeier', category: 'EIER', imageUrl: 'https://example.com/eier.jpg' }),
    produkt('p_karotten', { name: 'Karotten' }),
    produkt('p_versteckt', { name: 'Versteckt', isAvailable: false }),
  ],
  pickupSlots: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
}

const KUNDIN: SeitenAnsicht = { art: 'kundin', noindex: false, kaufen: true }

function stelleBereit(farm: PublicFarm | null, ansicht: SeitenAnsicht = KUNDIN) {
  lade.mockResolvedValue({ farm, ansicht })
}

async function rufe(id: string, suche: Record<string, string> = {}, farmSlug = 'hof-test'): Promise<ReactElement> {
  adresse.suche = new URLSearchParams(suche).toString()
  return ProduktSeite({ params: Promise.resolve({ farmSlug, id }), searchParams: Promise.resolve(suche) })
}

async function seite(id: string, suche: Record<string, string> = {}, farm: PublicFarm = HOF, ansicht = KUNDIN): Promise<string> {
  stelleBereit(farm, ansicht)
  return renderToStaticMarkup(await rufe(id, suche))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Sichtbarkeit wie auf der Hofseite', () => {
  it('lädt über dieselbe Abfrage wie die Hofseite — mit Slug und Suchparametern', async () => {
    await seite('p_5kg', { groesse: 'p_1kg' })
    expect(lade).toHaveBeenCalledWith('hof-test', { groesse: 'p_1kg' })
  })

  it('falscher oder unsichtbarer Hof: nicht gefunden', async () => {
    stelleBereit(null)
    await expect(rufe('p_5kg', {}, 'gibt-es-nicht')).rejects.toBe(NICHT_GEFUNDEN)
  })

  it('ein Produkt eines fremden Hofs unter diesem Slug: nicht gefunden', async () => {
    stelleBereit(HOF)
    await expect(rufe('p_von_anderem_hof')).rejects.toBe(NICHT_GEFUNDEN)
  })

  it('ein ausgeblendetes Produkt: nicht gefunden', async () => {
    stelleBereit(HOF)
    await expect(rufe('p_versteckt')).rejects.toBe(NICHT_GEFUNDEN)
  })

  it('Gegenprobe: ein sichtbares Produkt dieses Hofs steht da', async () => {
    expect(await seite('p_karotten')).toMatch(/<h1[^>]*>Karotten<\/h1>/)
  })
})

describe('Metadaten', () => {
  it('Titel und Vorschaubild nur aus öffentlichen Daten', async () => {
    stelleBereit(HOF)
    const meta = await generateMetadata({ params: Promise.resolve({ farmSlug: 'hof-test', id: 'p_eier' }), searchParams: Promise.resolve({}) })
    expect(meta.title).toBe('Freilandeier — Hof Test')
    expect(JSON.stringify(meta.openGraph)).toContain('https://example.com/eier.jpg')
    const text = JSON.stringify(meta)
    for (const privat of ['hof@example.com', '+43 660 0000000', 'Erika Muster']) expect(text).not.toContain(privat)
    expect(meta.robots).toBeUndefined()
  })

  it('in der Vorschau des Hofs noindex', async () => {
    stelleBereit(HOF, { art: 'vorschau', noindex: true, kaufen: false })
    const meta = await generateMetadata({ params: Promise.resolve({ farmSlug: 'hof-test', id: 'p_eier' }), searchParams: Promise.resolve({}) })
    expect(meta.robots).toEqual({ index: false, follow: false })
  })

  it('unbekanntes Produkt: kein Name eines fremden Datensatzes im Titel', async () => {
    stelleBereit(HOF)
    const meta = await generateMetadata({ params: Promise.resolve({ farmSlug: 'hof-test', id: 'p_versteckt' }), searchParams: Promise.resolve({}) })
    expect(meta.title).toBe('Produkt nicht gefunden')
    expect(JSON.stringify(meta)).not.toContain('Versteckt')
  })
})

describe('Fokus-Seite: Kopf ja, Unterleiste nein', () => {
  it('neues Design, eine Kopfzeile, ein <main>, keine Unterleiste', async () => {
    const html = await seite('p_karotten')
    expect(html).toContain('data-design="neu"')
    expect(html).toMatch(/<header\b/)
    expect(html.match(/<main\b/g)).toHaveLength(1)
    expect(html).not.toContain('data-slot="bottom-nav"')
  })

  it('Gegenprobe: die KundeShell ohne Fokus hat eine Unterleiste', () => {
    expect(renderToStaticMarkup(createElement(KundeShell, { angemeldet: false } as KundeShellProps, 'x'))).toContain('data-slot="bottom-nav"')
  })

  it('der Rückweg führt zu allen Produkten des Hofs', async () => {
    expect(await seite('p_karotten')).toContain('href="/hof-test?reiter=produkte"')
  })
})

describe('Größenkacheln der Produktfamilie', () => {
  it('eine Auswahl mit allen Größen, die aus der Adresse ist gewählt', async () => {
    const html = await seite('p_5kg')
    expect(html).toContain('data-slot="groessen-wahl"')
    expect(html.match(/data-slot="groessenkachel"/g)).toHaveLength(3)
    expect(html).toMatch(/id="kaufen-titel"[^>]*>Größe wählen/)
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>(?:(?!role="radio").)*5 kg-Sack/)
    expect(html).toContain('€ 1,60 / kg')
    expect(html).toContain('€ 0,18 / kg')
  })

  it('?groesse= wählt eine andere Größe der Familie', async () => {
    const html = await seite('p_5kg', { groesse: 'p_1kg' })
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>(?:(?!role="radio").)*1 kg-Sackerl/)
  })

  it('ohne Familie keine Kacheln', async () => {
    const html = await seite('p_karotten')
    expect(html).not.toContain('data-slot="groessen-wahl"')
    expect(html).not.toMatch(/id="kaufen-titel"[^>]*>Größe wählen/)
    // Die Heu-Familie unter „Gleich mit abholen" führt zur Größenwahl, statt eine Größe blind in den Korb zu legen.
    expect(html).toMatch(/href="\/hof-test\/produkt\/p_1kg"[^>]*>Größe wählen/)
  })
})

describe('Menge, Vorrat, Korb', () => {
  const plus = (html: string) => html.match(/<button[^>]*aria-label="Menge[^"]*: eins mehr"[^>]*>/)?.[0] ?? ''

  it('Stepper: unter dem Bestand geht „+"', async () => {
    expect(plus(await seite('p_5kg'))).toContain('aria-disabled="false"')
  })

  it('am Bestand ist „+" gesperrt', async () => {
    const farm = { ...HOF, products: HOF.products.map((p) => (p.id === 'p_karotten' ? { ...p, stock: 1 } : p)) }
    expect(plus(await seite('p_karotten', {}, farm))).toContain('aria-disabled="true"')
  })

  it('der Knopf nennt den Betrag, der Vorrat steht da', async () => {
    const html = await seite('p_5kg')
    expect(html).toContain('In den Korb · € 8,00')
    expect(html).toContain('Nur noch 3 Stück')
  })

  it('pausiert: kein Kaufknopf, aber der Hinweis', async () => {
    const html = await seite('p_5kg', {}, { ...HOF, isPaused: true, pauseMessage: 'Wir sind im Urlaub.' })
    expect(html).not.toContain('In den Korb ·')
    expect(html).toContain('Hof Test pausiert gerade.')
  })

  it('kein „Merken" (E8)', async () => {
    for (const id of ['p_5kg', 'p_karotten', 'p_rund']) expect(await seite(id)).not.toMatch(/Merken/)
  })
})

describe('Schild, Kennzeichnung, Gleich mit abholen', () => {
  it('E9: Schild mit LFBIS-Nummer, Kennzeichnung „laut Angabe des Hofs", nie „geprüft"', async () => {
    const html = await seite('p_5kg')
    expect(html).toContain('Futtermittelbetrieb · LFBIS 1234567')
    expect(html).toContain('1234567 (laut Angabe des Hofs)')
    expect(html).not.toMatch(/geprüft/i)
  })

  it('die Kennzeichnung steht zugeklappt in einem <details>', async () => {
    const html = await seite('p_5kg')
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*>\s*<summary[^>]*>(?:(?!<\/summary>).)*Kennzeichnung/)
  })

  it('ohne LFBIS-Status kein Schild', async () => {
    const html = await seite('p_5kg', {}, { ...HOF, betriebsstatus: 'REGISTRIERT' })
    expect(html).not.toContain('Futtermittelbetrieb · LFBIS')
    expect(html).toContain('1234567 (laut Angabe des Hofs)')
  })

  it('„Gleich mit abholen – eine Bestellung, eine Gebühr" mit anderen Produkten des Hofs', async () => {
    const html = await seite('p_5kg')
    expect(html).toContain('Gleich mit abholen')
    expect(html).toContain('Eine Bestellung, eine Gebühr')
    expect(html).toContain('href="/hof-test/produkt/p_eier"')
    expect(html).toContain('aria-label="Karotten in den Korb legen"')
    // Nie die eigene Familie und nie, was nicht im Shop steht.
    expect(html).not.toContain('href="/hof-test/produkt/p_versteckt"')
  })

  it('Gebührenhinweis aus der Hofeinstellung', async () => {
    expect(await seite('p_5kg')).toContain('zzgl. 5 % Servicegebühr')
  })
})

describe('Vorschau des Hofs', () => {
  it('Links bleiben in der Vorschau, der Korb fehlt', async () => {
    const html = await seite('p_5kg', {}, HOF, { art: 'vorschau', noindex: true, kaufen: false })
    expect(html).toContain('href="/hof-test?vorschau=1&amp;reiter=produkte"')
    expect(html).toContain('href="/hof-test/produkt/p_eier?vorschau=1"')
    expect(html).not.toContain('Dein Korb')
  })
})

describe('beide Themes: nur Tokens in den Dateien der Route', () => {
  const PALETTE = /\b(?:text|bg|border|ring|from|to|via)-(?:red|amber|green|emerald|lime|yellow|orange|slate|gray|zinc|neutral|stone|sky|blue|teal)-\d{2,3}\b/
  const SCHWARZ_WEISS = /\b(?:text|bg|border|ring|from|to|via|fill|stroke|outline|shadow|divide|decoration)-(?:black|white)(?![\w-])/
  const HEX = /#[0-9a-fA-F]{3,8}\b/
  const BESTAND = /\b(?:app-(?:page|ink|chip|line-firm|button|bar|trough)|notice)\b|var\(--app-/
  const ROUTE = [...dateien('src/app/(public)/[farmSlug]/produkt'), ...dateien('src/components/produktdetail')]

  it('erkennt sie (Gegenprobe) und findet die Dateien', () => {
    expect(PALETTE.test('text-amber-700')).toBe(true)
    expect(SCHWARZ_WEISS.test('bg-black/50')).toBe(true)
    expect(HEX.test("'#2D5F3F'")).toBe(true)
    expect(ROUTE.length).toBeGreaterThanOrEqual(4)
  })

  it('keine Datei der Route nutzt sie', () => {
    for (const pfad of ROUTE) {
      const text = quelle(pfad)
      expect(PALETTE.test(text), pfad).toBe(false)
      expect(SCHWARZ_WEISS.test(text), pfad).toBe(false)
      expect(HEX.test(text), pfad).toBe(false)
      if (!pfad.endsWith('loading.tsx')) expect(BESTAND.test(text), pfad).toBe(false)
    }
  })

  it('die Ladeansicht steht im neuen Design', () => {
    expect(quelle('src/app/(public)/[farmSlug]/produkt/[id]/loading.tsx')).toContain('data-design="neu"')
  })
})

describe('lange Namen', () => {
  it('ein Produktname mit 100 Zeichen bricht um, statt das Layout zu sprengen, voller Name im title der Kachel', async () => {
    const lang = 'Bergwiesen-Heu '.repeat(8).slice(0, 100)
    const farm = { ...HOF, products: HOF.products.map((p) => (p.id === 'p_1kg' ? { ...p, name: lang } : p)) }
    const html = await seite('p_1kg', {}, farm)
    expect(html).toMatch(new RegExp(`<h1[^>]*break-words[^>]*>${lang}</h1>`))
  })
})
