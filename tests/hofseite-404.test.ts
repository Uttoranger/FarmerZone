/**
 * Echte 404 auf Hof- und Produktseite (Nr. 117) — und was Suchmaschinen dort lesen.
 *
 * Jede Adresse `/<irgendwas>` landet in `[farmSlug]`. Beweist:
 *  - Eine Adresse, die kein Slug sein kann (Punkt, Großbuchstabe, Länge, fester
 *    Ordner), endet in notFound() OHNE Datenbankaufruf — die Attrappe von Prisma
 *    zählt 0 Aufrufe, auch mit ?vorschau=1 und in den Metadaten.
 *  - Ein unbekannter Hof: genau EINE schlanke Abfrage, dann notFound() — der
 *    Lader (Hof samt Fristfreigabe) läuft nicht.
 *  - Andere Suchparameter (?reiter=, ?utm_…, ?fbclid=, ?vorschau=0) ändern daran
 *    nichts: weiter EINE Abfrage, kein Lader. Nur ?vorschau=1 fragt den Lader
 *    (Vorschau des Besitzers, auch vor der Freigabe) — ob die Adresse sie
 *    verlangt, sagt ansichtsModus (tests/hofseite-einmal.test.ts).
 *  - Erst nach der Prüfung die Suspense-Grenze mit dem Skelett.
 *  - Metadaten: Titel, Canonical ohne Parameter, noindex (follow) für Höfe ohne
 *    Produkt im Shop und Testhöfe samt deren Produktseiten (Register N21) — ein
 *    nur aus der Gründung ausgenommener Hof wird indexiert —, Open Graph in de_AT.
 *  - JSON-LD der Seiten: gültiges JSON, ohne Telefon und E-Mail, `</script>`
 *    im Hofnamen bleibt im Block; Produkt mit Preis und Verfügbarkeit.
 * Status 404 selbst misst der sichter am lokalen Produktions-Build.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Suspense, createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const NICHT_GEFUNDEN = new Error('NEXT_NOT_FOUND')
const db = vi.hoisted(() => ({
  aufrufe: [] as string[],
  argumente: [] as unknown[],
  hof: null as Record<string, unknown> | null,
  produkt: null as Record<string, unknown> | null,
}))
// Jeder Zugriff auf ein Modell und jede Methode zählt — gleich welche.
vi.mock('@/lib/prisma', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_, modell: string) =>
        new Proxy(
          {},
          {
            get: (__, methode: string) => async (argument: unknown) => {
              db.aufrufe.push(`${modell}.${methode}`)
              db.argumente.push(argument)
              return modell === 'farm' ? db.hof : modell === 'product' ? db.produkt : null
            },
          }
        ),
    }
  ),
}))
vi.mock('@/server/hofseite-vorschau', () => ({ ladeHofseiteGeteilt: vi.fn() }))
vi.mock('@/server/queries/teilen-bild', () => ({ ladeTeilenVorschau: vi.fn(async () => null) }))
vi.mock('@/server/queries/status-posts', () => ({ getActiveStatusPosts: vi.fn(async () => []) }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw NICHT_GEFUNDEN
  },
  unstable_rethrow: () => {},
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; onNavigate?: unknown; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
// Volle Adressen im JSON-LD: die Basis wie metadataBase.
vi.mock('@/lib/umgebung-server', async (original) => {
  const echt = await original<typeof import('@/lib/umgebung-server')>()
  return { ...echt, UMGEBUNG: { ...echt.UMGEBUNG, appUrl: 'https://hof.example' } }
})

import FarmPage, { generateMetadata } from '@/app/(public)/[farmSlug]/page'
import ProduktSeite, { generateMetadata as produktMetadaten } from '@/app/(public)/[farmSlug]/produkt/[id]/page'
import { HofseiteSkelett } from '@/app/(public)/[farmSlug]/hofseite-skelett'
import { ProduktSkelett } from '@/app/(public)/[farmSlug]/produkt/[id]/produkt-skelett'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { FarmPageView } from '@/components/farm/farm-page-view'
import { OEFFENTLICH_SICHTBAR, type PublicFarm, type PublicProduct } from '@/server/queries/farm'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'
import { findeElement, inhaltHinterSuspense } from './element-suche'

const lade = vi.mocked(ladeHofseiteGeteilt)
const TELEFON = '+43 660 0000000'
const KUNDIN: SeitenAnsicht = { art: 'kundin', noindex: false, kaufen: true }

function produkt(id: string, teil: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id, name: `Produkt ${id}`, description: null, imageUrl: null, bildAusschnitt: null, category: 'GEMUESE', categoryImageUrl: null,
    price: 4.5, unit: 'STUECK', unitSize: null, stock: 20, isAvailable: true, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null, familieId: null, brennmaterial: null, abholhinweise: [],
    ...teil,
  }
}

const HOF: PublicFarm = {
  id: 'farm_test', slug: 'hof-test', name: 'Hof Test', ownerName: 'Erika Muster',
  description: 'Gemüse aus Musterdorf', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf',
  phone: TELEFON, email: 'hof@example.com', logoUrl: null, logoAusschnitt: null, bannerUrl: null,
  tagline: null, foundedYear: null, aboutText: null, bannerType: 'GRADIENT', bannerValue: null, bannerFocusY: 50, bannerAusschnitt: null,
  sectionsConfig: [], farmValues: [], farmPhotos: [],
  acceptsOnline: true, acceptsOnsite: true, stripeAccountReady: true, isPaused: false, pauseMessage: null,
  serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: null, betriebsstatus: null,
  gruendungshof: false, gruendungSeit: null, abzeichenBlatt: null, istTesthof: false,
  products: [
    produkt('p_eier', { name: 'Freilandeier', category: 'EIER', price: 4.5, stock: 0 }),
    produkt('p_karotten', { name: 'Karotten', category: 'GEMUESE' }),
    produkt('p_honig', { name: 'Honig', category: 'HONIG' }),
    produkt('p_fleisch', { name: 'Speck', category: 'FLEISCH' }),
    produkt('p_aus', { name: 'Versteckt', category: 'MILCH', isAvailable: false }),
  ],
  pickupSlots: [],
}

/** Ein öffentlicher Hof in der schlanken Abfrage: ohne Ausnahme, mit Produkten im Shop. */
const OEFFENTLICH = { istTesthof: false, latitude: null, longitude: null, _count: { products: 4 } }
/** Ein Produkt im Shop in der schlanken Abfrage der Produktseite — eines nicht ausgenommenen Hofs. */
const IM_SHOP = (id: string, istTesthof = false) => ({ id, farm: { istTesthof } })

const hofseite = (farmSlug: string, suche: Record<string, string> = {}) =>
  FarmPage({ params: Promise.resolve({ farmSlug }), searchParams: Promise.resolve(suche) })
const hofMeta = (farmSlug: string, suche: Record<string, string> = {}) =>
  generateMetadata({ params: Promise.resolve({ farmSlug }), searchParams: Promise.resolve(suche) })
const produktseite = (farmSlug: string, id: string, suche: Record<string, string> = {}) =>
  ProduktSeite({ params: Promise.resolve({ farmSlug, id }), searchParams: Promise.resolve(suche) })
const produktMeta = (farmSlug: string, id: string) =>
  produktMetadaten({ params: Promise.resolve({ farmSlug, id }), searchParams: Promise.resolve({}) })
const alsText = (suche: Record<string, string>) => JSON.stringify(suche)

/** Der JSON-LD-Block im gerendert Inhalt hinter der Grenze. */
async function jsonLd(seite: Promise<ReactElement>): Promise<{ roh: string; daten: Record<string, unknown> }> {
  const html = renderToStaticMarkup(await inhaltHinterSuspense(await seite))
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  if (!block) throw new Error('kein JSON-LD im HTML')
  return { roh: block[1], daten: JSON.parse(block[1]) as Record<string, unknown> }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.aufrufe = []
  db.argumente = []
  db.hof = null
  db.produkt = null
  lade.mockResolvedValue({ farm: HOF, ansicht: KUNDIN })
})

describe('eine Adresse, die kein Hof sein kann: 404 ohne Datenbank', () => {
  const KEIN_SLUG = ['gibt-es-nicht.php', 'wp-login.php', 'Hof-Test', 'hof--test', '-hof', 'hof_test', 'x'.repeat(161), 'admin', 'hoefe']

  it('die Hofseite ruft notFound(), Prisma zählt 0 Aufrufe, der Lader läuft nicht — auch mit ?vorschau=1', async () => {
    for (const slug of KEIN_SLUG) {
      for (const suche of [{}, { vorschau: '1' }] as Record<string, string>[]) {
        await expect(hofseite(slug, suche), slug).rejects.toBe(NICHT_GEFUNDEN)
      }
    }
    expect(db.aufrufe).toEqual([])
    expect(lade).not.toHaveBeenCalled()
  })

  it('die Metadaten fragen ebenfalls nichts: „Hof nicht gefunden", noindex', async () => {
    for (const slug of KEIN_SLUG) expect(await hofMeta(slug), slug).toEqual({ title: 'Hof nicht gefunden', robots: { index: false, follow: false } })
    expect(db.aufrufe).toEqual([])
    expect(lade).not.toHaveBeenCalled()
  })

  it('die Produktseite genauso — Seite und Metadaten', async () => {
    for (const slug of KEIN_SLUG) {
      await expect(produktseite(slug, 'p_eier'), slug).rejects.toBe(NICHT_GEFUNDEN)
      expect((await produktMeta(slug, 'p_eier')).title, slug).toBe('Produkt nicht gefunden')
    }
    expect(db.aufrufe).toEqual([])
    expect(lade).not.toHaveBeenCalled()
  })

  it('Gegenprobe: eine Adresse in Slug-Form fragt die Datenbank — die Zählung schlägt an', async () => {
    await expect(hofseite('hof-test')).rejects.toBe(NICHT_GEFUNDEN)
    expect(db.aufrufe).toEqual(['farm.findFirst'])
  })
})

describe('ein unbekannter Hof: eine schlanke Abfrage, dann 404', () => {
  it('genau eine Abfrage mit der Sichtbarkeitsregel, danach notFound() — kein Lader, keine Fristfreigabe', async () => {
    await expect(hofseite('unbekannter-hof')).rejects.toBe(NICHT_GEFUNDEN)
    expect(db.aufrufe).toEqual(['farm.findFirst'])
    expect(lade).not.toHaveBeenCalled()
  })

  it('die Abfrage fragt nach öffentlich sichtbar (OEFFENTLICH_SICHTBAR) und Produkten im Shop', async () => {
    await expect(hofseite('unbekannter-hof')).rejects.toBe(NICHT_GEFUNDEN)
    expect(db.argumente).toEqual([
      expect.objectContaining({
        where: { slug: 'unbekannter-hof', ...OEFFENTLICH_SICHTBAR },
        select: expect.objectContaining({ _count: { select: { products: { where: { isAvailable: true } } } } }),
      }),
    ])
  })

  it('ein unbekanntes Produkt eines Hofs: eine Abfrage (Produkt im Shop eines öffentlichen Hofs), dann 404', async () => {
    await expect(produktseite('hof-test', 'p_gibt_es_nicht')).rejects.toBe(NICHT_GEFUNDEN)
    expect(db.aufrufe).toEqual(['product.findFirst'])
    expect(lade).not.toHaveBeenCalled()
  })

  it('andere Suchparameter ändern nichts: eine Abfrage, kein Lader, keine Fristfreigabe — Seite und Metadaten', async () => {
    const ANDERE: Record<string, string>[] = [{ reiter: 'produkte' }, { utm_source: 'teilen' }, { fbclid: 'abc' }, { vorschau: '0' }, { vorschau: 'ja' }]
    for (const suche of ANDERE) {
      db.aufrufe = []
      await expect(hofseite('unbekannter-hof', suche), alsText(suche)).rejects.toBe(NICHT_GEFUNDEN)
      expect(db.aufrufe, alsText(suche)).toEqual(['farm.findFirst'])
      db.aufrufe = []
      expect((await hofMeta('unbekannter-hof', suche)).title, alsText(suche)).toBe('Hof nicht gefunden')
      expect(db.aufrufe, alsText(suche)).toEqual(['farm.findFirst'])
    }
    expect(lade).not.toHaveBeenCalled()
  })

  it('Gegenprobe: nur ?vorschau=1 fragt den Lader (Vorschau des Besitzers) — ohne Recht bleibt es bei 404', async () => {
    lade.mockResolvedValue({ farm: null, ansicht: KUNDIN })
    await expect(hofseite('unbekannter-hof', { vorschau: '1' })).rejects.toBe(NICHT_GEFUNDEN)
    expect(lade).toHaveBeenCalledWith('unbekannter-hof', { vorschau: '1' })
  })

  it('die Produktseite ebenso: ?groesse= fragt den Lader nicht, ?vorschau=1 schon', async () => {
    await expect(produktseite('hof-test', 'p_gibt_es_nicht', { groesse: 'p_eier' })).rejects.toBe(NICHT_GEFUNDEN)
    expect(db.aufrufe).toEqual(['product.findFirst'])
    expect(lade).not.toHaveBeenCalled()
    lade.mockResolvedValue({ farm: null, ansicht: KUNDIN })
    await expect(produktseite('hof-test', 'p_gibt_es_nicht', { vorschau: '1' })).rejects.toBe(NICHT_GEFUNDEN)
    expect(lade).toHaveBeenCalledWith('hof-test', { vorschau: '1' })
  })

  it('die Vorschau des Besitzers zeigt seinen noch nicht freigegebenen Hof weiter', async () => {
    lade.mockResolvedValue({ farm: HOF, ansicht: { art: 'vorschau', noindex: true, kaufen: false } })
    const baum = await hofseite('hof-test', { vorschau: '1' })
    expect(findeElement(await inhaltHinterSuspense(baum), FarmPageView)).not.toBeNull()
    // Gegenprobe: derselbe Hof für eine Kundin mit Parametern — nicht öffentlich, also 404.
    lade.mockResolvedValue({ farm: HOF, ansicht: KUNDIN })
    await expect(hofseite('hof-test', { vorschau: '1' })).rejects.toBe(NICHT_GEFUNDEN)
  })
})

describe('ein öffentlicher Hof: erst geprüft, dann das Skelett, dahinter der Inhalt', () => {
  it('die Seite gibt die Suspense-Grenze mit dem Skelett zurück; geladen wird erst dahinter', async () => {
    db.hof = OEFFENTLICH
    const baum = (await hofseite('hof-test')) as ReactElement<{ fallback: ReactElement }>
    expect(baum.type).toBe(Suspense)
    expect(baum.props.fallback.type).toBe(HofseiteSkelett)
    expect(lade).not.toHaveBeenCalled()
    expect(findeElement(await inhaltHinterSuspense(baum), FarmPageView)).not.toBeNull()
    expect(lade).toHaveBeenCalledWith('hof-test', {})
  })

  it('die Produktseite ebenso, mit ihrem eigenen Skelett', async () => {
    db.produkt = IM_SHOP('p_karotten')
    const baum = (await produktseite('hof-test', 'p_karotten')) as ReactElement<{ fallback: ReactElement }>
    expect(baum.type).toBe(Suspense)
    expect(baum.props.fallback.type).toBe(ProduktSkelett)
  })
})

describe('Metadaten der Hofseite', () => {
  it('„{Hof} in {Ort} – {bis zu drei Kategorien}", Canonical ohne Parameter, Open Graph in de_AT', async () => {
    db.hof = OEFFENTLICH
    const meta = await hofMeta('hof-test', { reiter: 'produkte', bereich: 'futter' })
    // Kategorien der Produkte im Shop in der Reihenfolge der Taxonomie; die ausgeblendete Milch fehlt.
    expect(meta.title).toMatch(/^Hof Test in Musterdorf – [^,]+, [^,]+, [^,]+$/)
    expect(meta.title).not.toMatch(/Milch/)
    expect(meta.alternates?.canonical).toBe('/hof-test')
    expect(meta.robots).toBeUndefined()
    expect((meta.openGraph as { locale?: string }).locale).toBe('de_AT')
  })

  it('ohne Produkt im Shop: kein Kategorie-Teil im Titel, noindex mit follow', async () => {
    db.hof = { ...OEFFENTLICH, _count: { products: 0 } }
    lade.mockResolvedValue({ farm: { ...HOF, products: [] }, ansicht: KUNDIN })
    const meta = await hofMeta('hof-test')
    expect(meta.title).toBe('Hof Test in Musterdorf')
    expect(meta.robots).toEqual({ index: false, follow: true })
  })

  it('ein Testhof (Register N21): noindex mit follow, auch mit Produkten — die Abfrage liest istTesthof', async () => {
    db.hof = { ...OEFFENTLICH, istTesthof: true }
    expect((await hofMeta('hof-test')).robots).toEqual({ index: false, follow: true })
    expect(db.argumente[0]).toEqual(expect.objectContaining({ select: expect.objectContaining({ istTesthof: true }) }))
  })

  it('ein nur aus der Gründung ausgenommener echter Hof hat KEIN noindex (Nr. 119) — die Abfrage fragt gruendungAusgenommen nicht', async () => {
    db.hof = { ...OEFFENTLICH, gruendungAusgenommen: true }
    expect((await hofMeta('hof-test')).robots).toBeUndefined()
    expect(db.argumente[0]).toEqual(expect.objectContaining({ select: expect.not.objectContaining({ gruendungAusgenommen: expect.anything() }) }))
  })

  it('die Vorschau-Adresse bleibt ganz fern (noindex, nofollow)', async () => {
    db.hof = OEFFENTLICH
    lade.mockResolvedValue({ farm: HOF, ansicht: { art: 'kundin', noindex: true, kaufen: true } })
    expect((await hofMeta('hof-test', { vorschau: 'x' })).robots).toEqual({ index: false, follow: false })
  })
})

describe('Metadaten der Produktseite', () => {
  it('„{Produkt} vom {Hof} in {Ort}", Canonical auf die Produktseite ohne Parameter, de_AT', async () => {
    db.produkt = IM_SHOP('p_karotten')
    const meta = await produktMeta('hof-test', 'p_karotten')
    expect(meta.title).toBe('Karotten vom Hof Test in Musterdorf')
    expect(meta.alternates?.canonical).toBe('/hof-test/produkt/p_karotten')
    expect(meta.robots).toBeUndefined()
    expect((meta.openGraph as { locale?: string }).locale).toBe('de_AT')
  })

  it('ein Produkt eines Testhofs (Register N21): noindex mit follow — wie dessen Hofseite', async () => {
    db.produkt = IM_SHOP('p_karotten', true)
    expect((await produktMeta('hof-test', 'p_karotten')).robots).toEqual({ index: false, follow: true })
    expect(db.argumente).toEqual([expect.objectContaining({ select: expect.objectContaining({ farm: { select: { istTesthof: true } } }) })])
  })
})

describe('JSON-LD der Seiten', () => {
  const ANGRIFF = '</script><script>alert(1)</script>'

  it('Hofseite: gültiges JSON, LocalBusiness mit voller URL und geo — ohne Telefon und E-Mail', async () => {
    db.hof = { ...OEFFENTLICH, latitude: 48.2, longitude: 13.1 }
    const { roh, daten } = await jsonLd(hofseite('hof-test'))
    expect(roh).not.toContain(TELEFON)
    expect(roh).not.toContain('hof@example.com')
    expect(daten).toMatchObject({ '@type': 'LocalBusiness', name: 'Hof Test', url: 'https://hof.example/hof-test', geo: { latitude: 48.2, longitude: 13.1 } })
  })

  it('ein Hofname mit </script> bleibt im Block — kein eingeschleustes Skript', async () => {
    db.hof = OEFFENTLICH
    lade.mockResolvedValue({ farm: { ...HOF, name: `Hof ${ANGRIFF}`, description: ANGRIFF }, ansicht: KUNDIN })
    const html = renderToStaticMarkup(await inhaltHinterSuspense(await hofseite('hof-test')))
    expect(html).not.toContain('<script>alert(1)')
    const { daten } = await jsonLd(hofseite('hof-test'))
    expect(daten).toMatchObject({ name: `Hof ${ANGRIFF}`, description: ANGRIFF })
  })

  it('Produktseite: Product mit Preis, Währung und Verfügbarkeit aus dem Vorrat', async () => {
    db.produkt = IM_SHOP('p_eier')
    const leer = await jsonLd(produktseite('hof-test', 'p_eier'))
    expect(leer.daten).toMatchObject({
      '@type': 'Product', name: 'Freilandeier',
      offers: { price: '4.50', priceCurrency: 'EUR', availability: 'https://schema.org/OutOfStock', seller: { name: 'Hof Test' } },
    })
    expect(leer.roh).not.toContain(TELEFON)
    db.produkt = IM_SHOP('p_karotten')
    const voll = await jsonLd(produktseite('hof-test', 'p_karotten'))
    expect((voll.daten.offers as { availability: string }).availability).toBe('https://schema.org/InStock')
  })
})
