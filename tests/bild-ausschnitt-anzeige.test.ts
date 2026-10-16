/**
 * Der Ausschnitt des Produktfotos in der Anzeige (Register N17, Nachtlauf
 * Nr. 98) — gerendert mit react-dom/server (TESTING_GUIDELINES §1).
 *
 * Beweist:
 *  - Produktkarte und Produktseite tragen bei `bildAusschnitt` die Stil-Werte
 *    aus `bildStil` (Fokus, Zoom um den Fokus, Filter) am Foto; ohne ihn steht
 *    das Foto unverändert da (kein Stil).
 *  - Nur am echten Foto: Die Kategorie-Illustration bekommt nie einen
 *    Ausschnitt, auch wenn einer gespeichert ist.
 *  - Ausverkauft behält Fokus und Zoom, aber ohne Filter des Hofs — ein
 *    Inline-Filter überschriebe sonst die Klasse grayscale.
 *  - Die Käufer-Vorschau im Produktdialog zeigt das Foto im gewählten
 *    Ausschnitt; die große Bildansicht der Galerie zeigt das ganze Foto mit
 *    seinem Filter, ohne Fokus und Zoom (Nr. 98, Runde 1).
 *  - Alle vier Upload-Stellen (Logo, Galerie, Produktdialog, Beitrag) öffnen
 *    den Baustein nach dem Upload mit „Passt so“, das Titelbild nicht.
 *  - Die Vorschau-Paare im Produktdialog passen am Handy (375 px) in die
 *    Breite: kein waagrechtes Scrollen (Nr. 98, Runde 2).
 *  - Wache: Der Screenshot unter „Problem melden“ (Zweck meldung) und die
 *    Rohfoto-Stellen (Warenkorb, Kasse, E-Mails, Teilen-Bild) binden weder den
 *    Baustein noch den Stil ein. Gegenprobe: Dieselbe Suche findet beide in
 *    Mein Hof, im Produktdialog und beim Beitrag.
 *
 * Merkmal ist der Inline-Stil am Bild, gesucht am <img> mit der Adresse des
 * Fotos — je Aussage mit Gegenprobe, dass die Suche das Merkmal findet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const adresse = { suche: '' }
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test/produkt/p_eier',
  useSearchParams: () => new URLSearchParams(adresse.suche),
}))
// Das Bild trägt seinen Stil weiter — genau der ist hier die Aussage.
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; className?: string; style?: Record<string, string> }) =>
    createElement('img', { src: p.src, alt: p.alt, className: p.className, style: p.style }),
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

import ProduktSeite from '@/app/(public)/[farmSlug]/produkt/[id]/page'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { ProduktKarte } from '@/components/hofseite/produkt-karte'
import { BildansichtEbene } from '@/components/hofseite/bildansicht'
import { LebensmittelVorschau } from '@/components/products/lebensmittel-vorschau'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import type { KartenZustand } from '@/lib/bereiche-anzeige'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'

const FOTO = 'https://example.com/eier.jpg'
const ILLUSTRATION = '/categories/eier.webp'
const AUSSCHNITT: BildAusschnitt = { fokusX: 30, fokusY: 70, zoom: 140, filter: 'KLAR' }
// So rendert React den Stil aus bildStil(AUSSCHNITT) — Fokus, Zoom um den Fokus, Filter.
const FOKUS = 'object-position:30% 70%'
const ZOOM = 'transform:scale(1.4);transform-origin:30% 70%'
const FILTER = 'filter:contrast(1.08) brightness(1.03) saturate(1.05)'

function produkt(id: string, teil: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id, name: `Produkt ${id}`, description: null, imageUrl: null, bildAusschnitt: null, category: 'EIER', categoryImageUrl: ILLUSTRATION,
    price: 4.5, unit: 'STUECK', unitSize: null, stock: 20, isAvailable: true, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null,
    familieId: null, brennmaterial: null,
    ...teil,
  }
}

/** Das <img> mit dieser Adresse — die Suche schlägt nur an diesem Bild an, nie an einem anderen. */
function bildTag(html: string, src: string): string {
  const fund = html.match(new RegExp(`<img[^>]*src="${src.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"[^>]*>`))
  if (!fund) throw new Error(`Kein Bild mit ${src} im HTML`)
  return fund[0]
}

describe('Produktkarte — der Ausschnitt am Foto', () => {
  const karte = (p: PublicProduct, zustand: KartenZustand = { art: 'kaufbar' }) =>
    renderToStaticMarkup(
      createElement(ProduktKarte, {
        produkt: p,
        zustand,
        imKorb: 0,
        wirdHinzugefuegt: false,
        href: '/hof-test/produkt/p_eier',
        onInDenKorb: () => {},
        onMenge: () => {},
      })
    )

  it('mit Ausschnitt trägt das Foto Fokus, Zoom und Filter', () => {
    const bild = bildTag(karte(produkt('p_eier', { imageUrl: FOTO, bildAusschnitt: AUSSCHNITT })), FOTO)

    expect(bild).toContain(FOKUS)
    expect(bild).toContain(ZOOM)
    expect(bild).toContain(FILTER)
  })

  it('ohne Ausschnitt steht das Foto unverändert da — kein Stil', () => {
    const bild = bildTag(karte(produkt('p_eier', { imageUrl: FOTO })), FOTO)

    expect(bild).not.toContain('style=')
    expect(bild).toContain('object-cover')
  })

  it('die Kategorie-Illustration bekommt nie einen Ausschnitt, auch wenn einer gespeichert ist', () => {
    const bild = bildTag(karte(produkt('p_eier', { bildAusschnitt: AUSSCHNITT })), ILLUSTRATION)

    expect(bild).not.toContain('style=')
    // Gegenprobe: Dasselbe Produkt mit Foto trägt ihn.
    expect(bildTag(karte(produkt('p_eier', { imageUrl: FOTO, bildAusschnitt: AUSSCHNITT })), FOTO)).toContain(FOKUS)
  })

  it('ausverkauft: Fokus und Zoom bleiben, der Filter fällt weg — sonst wäre das Foto nicht grau', () => {
    const bild = bildTag(karte(produkt('p_eier', { imageUrl: FOTO, bildAusschnitt: AUSSCHNITT, stock: 0 }), { art: 'ausverkauft' }), FOTO)

    expect(bild).toContain(FOKUS)
    expect(bild).toContain('grayscale')
    expect(bild).not.toContain('filter:')
  })
})

describe('Produktseite — der Ausschnitt am Foto', () => {
  const HOF: PublicFarm = {
    id: 'farm_test', slug: 'hof-test', name: 'Hof Test', ownerName: 'Erika Muster',
    description: 'Eier aus Musterdorf', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf',
    phone: '+43 660 0000000', email: 'hof@example.com', logoUrl: null, logoAusschnitt: null, bannerUrl: null,
    tagline: null, foundedYear: null, aboutText: null, bannerType: 'GRADIENT', bannerValue: null, bannerFocusY: 50, bannerAusschnitt: null,
    sectionsConfig: [], farmValues: [], farmPhotos: [],
    acceptsOnline: true, acceptsOnsite: true, stripeAccountReady: true, isPaused: false, pauseMessage: null,
    serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: '2026-01-01T00:00:00.000Z',
    betriebsstatus: 'PRIMAERPRODUKTION',
    products: [],
    pickupSlots: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
  }

  async function seite(p: PublicProduct): Promise<string> {
    vi.mocked(ladeHofseiteGeteilt).mockResolvedValue({ farm: { ...HOF, products: [p] }, ansicht: { art: 'kundin', noindex: false, kaufen: true } })
    return renderToStaticMarkup(await ProduktSeite({ params: Promise.resolve({ farmSlug: 'hof-test', id: p.id }), searchParams: Promise.resolve({}) }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mit Ausschnitt trägt das große Foto Fokus, Zoom und Filter', async () => {
    const bild = bildTag(await seite(produkt('p_eier', { imageUrl: FOTO, bildAusschnitt: AUSSCHNITT })), FOTO)

    expect(bild).toContain(FOKUS)
    expect(bild).toContain(ZOOM)
    expect(bild).toContain(FILTER)
  })

  it('ohne Ausschnitt steht das Foto unverändert da — kein Stil', async () => {
    const bild = bildTag(await seite(produkt('p_eier', { imageUrl: FOTO })), FOTO)

    expect(bild).not.toContain('style=')
    expect(bild).toContain('object-cover')
  })

  it('die Kategorie-Illustration bekommt nie einen Ausschnitt', async () => {
    const bild = bildTag(await seite(produkt('p_eier', { bildAusschnitt: AUSSCHNITT })), ILLUSTRATION)

    expect(bild).not.toContain('style=')
  })
})

// ── Wache: Rohfoto bleibt Rohfoto ────────────────────────────────────────────

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

/** Bindet die Datei den Baustein, den Stil oder die Rahmen ein? (auch über einen dynamischen Import) */
const BILD_MODULE = /['"]@\/(?:components\/shared\/bild-ausschnitt|lib\/bild-ausschnitt|lib\/bild-rahmen)['"]/
const bindetBildEin = (pfad: string): boolean => BILD_MODULE.test(quelle(pfad))

describe('Wache — „Problem melden“ und die Rohfoto-Stellen ohne Ausschnitt und Filter', () => {
  // Jede Datei, die ein Foto zum Zweck „meldung“ hochlädt oder den Screenshot einer Meldung zeigt.
  const MELDUNG = dateien('src').filter((pfad) => /variant: 'meldung'|screenshotUrl/.test(quelle(pfad)))

  it('findet die Stellen des Screenshots — Formular, Hof-Hilfe, Admin, Mail', () => {
    expect(MELDUNG).toEqual(
      expect.arrayContaining([
        'src/components/shared/use-meldung-formular.ts',
        'src/components/shared/meldung-form.tsx',
        'src/components/hof-hilfe/meldung-abgeben.tsx',
      ])
    )
  })

  it('der Screenshot unter „Problem melden“ rendert nie den Bild-Baustein und nie seinen Stil', () => {
    expect(MELDUNG.filter(bindetBildEin)).toEqual([])
  })

  it('Warenkorb, Kasse, E-Mails und Teilen-Bild zeigen das Rohfoto', () => {
    const roh = [
      'src/components/farm/cart-sheet.tsx',
      'src/components/checkout/checkout-form.tsx',
      'src/components/checkout/kasse-teile.tsx',
      ...dateien('src/emails'),
      ...dateien('src/components/teilen'),
    ]
    expect(roh.filter(bindetBildEin)).toEqual([])
  })

  it('Gegenprobe: Dieselbe Suche findet Baustein und Stil dort, wo sie hingehören', () => {
    expect(
      ['src/components/mein-hof/bild-bausteine.tsx', 'src/components/products/product-dialog.tsx', 'src/app/(hof)/status/new/status-new-client.tsx'].filter(bindetBildEin)
    ).toHaveLength(3)
  })
})

describe('Käufer-Vorschau im Produktdialog — derselbe Ausschnitt wie im Baustein darüber', () => {
  const vorschau = (foto: string | null, ausschnitt: BildAusschnitt | null) =>
    renderToStaticMarkup(
      createElement(LebensmittelVorschau, { name: 'Eier', price: 4.5, unit: 'STUECK', unitSize: null, foto, kategorie: 'EIER', unterkategorie: null, ausschnitt })
    )

  it('mit Foto und Ausschnitt trägt die Karte Fokus, Zoom und Filter', () => {
    const bild = bildTag(vorschau(FOTO, AUSSCHNITT), FOTO)
    expect(bild).toContain(FOKUS)
    expect(bild).toContain(ZOOM)
    expect(bild).toContain(FILTER)
  })

  it('ohne Ausschnitt steht das Foto wie heute; ohne Foto bekommt die Illustration keinen', () => {
    expect(bildTag(vorschau(FOTO, null), FOTO)).not.toContain('style=')
    expect(vorschau(null, AUSSCHNITT)).not.toContain(FOKUS)
  })
})

describe('Bildansicht der Galerie — das ganze Foto mit Filter, ohne Beschnitt', () => {
  const bild = { offen: 0, oeffne: () => {}, schliesse: () => {}, vor: () => {}, zurueck: () => {} }
  const ansicht = (ausschnitt: BildAusschnitt | null) =>
    renderToStaticMarkup(createElement(BildansichtEbene, { fotos: [{ id: 'f1', url: FOTO, caption: null, ausschnitt }], bild, titel: 'Fotos vom Hof' }))

  it('trägt den Filter des Fotos, aber weder Fokus noch Zoom — object-contain bleibt', () => {
    const tag = bildTag(ansicht(AUSSCHNITT), FOTO)
    expect(tag).toContain(FILTER)
    expect(tag).not.toContain('object-position')
    expect(tag).not.toContain('transform')
    expect(tag).toContain('object-contain')
  })

  it('ohne Ausschnitt steht das Foto unverändert da — kein Stil', () => {
    expect(bildTag(ansicht(null), FOTO)).not.toContain('style=')
  })
})

describe('Nach dem Upload — „Passt so“ an allen vier Upload-Stellen, nicht beim Titelbild', () => {
  /** Die Namen der Eigenschaften je Aufruf `<BildAusschnitt … />` einer Datei — aus dem Syntaxbaum, kein Regex über verschachteltes JSX. */
  const aufrufe = (pfad: string): string[][] => {
    const baum = ts.createSourceFile(pfad, quelle(pfad), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const funde: string[][] = []
    const besuche = (knoten: ts.Node): void => {
      if (ts.isJsxSelfClosingElement(knoten) && knoten.tagName.getText(baum) === 'BildAusschnitt') {
        funde.push(knoten.attributes.properties.map((a) => (ts.isJsxAttribute(a) ? a.name.getText(baum) : '…')))
      }
      ts.forEachChild(knoten, besuche)
    }
    besuche(baum)
    return funde
  }

  it('Logo, Galerie, Produktdialog und Beitrag reichen `nachUpload` an den Baustein', () => {
    const mitUpload = [
      ...aufrufe('src/components/mein-hof/bild-bausteine.tsx'),
      ...aufrufe('src/components/products/product-dialog.tsx'),
      ...aufrufe('src/app/(hof)/status/new/status-new-client.tsx'),
    ].filter((aufruf) => aufruf.includes('nachUpload'))
    expect(mitUpload).toHaveLength(4)
  })

  it('Gegenprobe: Der Aufruf des Titelbilds (Nr. 97) findet sich und bleibt ohne', () => {
    const titelbild = aufrufe('src/components/mein-hof/bild-bausteine.tsx').filter((aufruf) => aufruf.includes('mitDarstellung'))
    expect(titelbild).toHaveLength(1)
    expect(titelbild[0]).not.toContain('nachUpload')
  })
})

describe('Vorschau-Paare im Produktdialog — passen am Handy (375 px) in die Breite', () => {
  // Platz für eine Reihe bei 375 px: Körper des Dialogs px-6 (2 × 24) und Rahmen
  // des Bausteins p-3 mit Linie (2 × 12 + 2 × 1) — bei 390 px gemessen 316 px.
  const PLATZ_375 = 375 - 48 - 26
  // gap-2.5 zwischen den Rahmen einer Reihe.
  const ABSTAND = 10
  // So viel behält ein Rahmen ohne feste Breite mindestens, sonst ist er nicht mehr lesbar.
  const GETEILT_MINDESTENS = 96

  /** Je Vorschau-Reihe die festen Breiten (undefined = teilt sich den Platz) — aus dem Syntaxbaum. */
  const reihen = (): (number | undefined)[][] => {
    const pfad = 'src/components/products/product-dialog.tsx'
    const baum = ts.createSourceFile(pfad, quelle(pfad), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const breite = (objekt: ts.ObjectLiteralExpression): number | undefined => {
      const eigenschaft = objekt.properties.find(
        (e): e is ts.PropertyAssignment => ts.isPropertyAssignment(e) && e.name.getText(baum) === 'breite',
      )
      if (!eigenschaft) return undefined
      if (!ts.isNumericLiteral(eigenschaft.initializer)) throw new Error('breite ist keine Zahl')
      return Number(eigenschaft.initializer.text)
    }
    let liste: ts.ArrayLiteralExpression | undefined
    const besuche = (knoten: ts.Node): void => {
      if (ts.isVariableDeclaration(knoten) && knoten.name.getText(baum) === 'vorschauen' && knoten.initializer && ts.isArrayLiteralExpression(knoten.initializer)) {
        liste = knoten.initializer
      }
      ts.forEachChild(knoten, besuche)
    }
    besuche(baum)
    if (!liste) throw new Error('Keine Vorschau-Liste im Produktdialog')
    return liste.elements.filter(ts.isObjectLiteralExpression).map((vorschau) => {
      const daneben = vorschau.properties.find(
        (e): e is ts.PropertyAssignment => ts.isPropertyAssignment(e) && e.name.getText(baum) === 'daneben',
      )
      const partner =
        daneben && ts.isArrayLiteralExpression(daneben.initializer) ? daneben.initializer.elements.filter(ts.isObjectLiteralExpression) : []
      return [vorschau, ...partner].map(breite)
    })
  }
  const mindestBreite = (reihe: (number | undefined)[]): number =>
    reihe.reduce<number>((summe, b) => summe + (b ?? GETEILT_MINDESTENS), 0) + ABSTAND * (reihe.length - 1)

  it('beide Titel stehen als Paar da — „In der Liste“ und „Auf der Produktseite“', () => {
    expect(reihen().map((r) => r.length)).toEqual([2, 2])
  })

  it('keine Reihe ist breiter als der Platz bei 375 px', () => {
    for (const reihe of reihen()) expect(mindestBreite(reihe)).toBeLessThanOrEqual(PLATZ_375)
  })

  it('Gegenprobe: zwei feste Rahmen wie 196 + 110 px schlügen an', () => {
    expect(mindestBreite([196, 110])).toBeGreaterThan(PLATZ_375)
  })
})
