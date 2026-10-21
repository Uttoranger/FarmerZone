/**
 * Nr. 60 „Telefonnummer erst nach dem Kauf" (Mockups web/mobil-k2-hofseite-
 * ohne-telefon, web/mobil-k3-kasse-angaben-zum-hof, web/mobil-k4-bestellung-
 * hof-erreichen).
 *
 * Beweist:
 *  - Die Hofseite gibt Telefon und E-Mail des Hofs gar nicht erst an die
 *    Client-Komponente — was dort ankommt, stünde in den Seitendaten, auch
 *    ungezeigt. Sie zeigt kein „Anrufen", keinen tel:-Link und kein
 *    telephone/email im JSON-LD; statt der Nummer steht der Hinweis auf die
 *    Bestellbestätigung, im leeren Zustand kein Verweis auf einen Anruf.
 *  - Die Kasse nennt Verkäufer, Anschrift, Telefon und E-Mail des Hofs im DOM
 *    vor dem Kaufknopf — online und bar (§ 4 Abs. 1 Z 2 und 3 FAGG).
 *  - Keine Sackgasse: „ruf direkt am Hof an" und „Frag am besten direkt beim
 *    Hof nach" stehen nirgends mehr in src/.
 * „Hof erreichen" nur mit gültiger Signatur: tests/bestaetigung-zugang.test.ts
 * und tests/bestellverfolgung-zugang.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MARKE } from '@/lib/marke'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/server/hofseite-vorschau', () => ({ ladeHofseiteGeteilt: vi.fn() }))
// Die Prüfung vor dem Streamen (Nr. 117) prüft tests/hofseite-404.test.ts; hier ist der Hof öffentlich.
vi.mock('@/server/queries/seo', () => ({ pruefeHofseiteGeteilt: vi.fn(async () => ({ indexieren: true, geo: null })) }))
vi.mock('@/server/queries/teilen-bild', () => ({ ladeTeilenVorschau: vi.fn(async () => null) }))
vi.mock('@/server/queries/status-posts', () => ({ getActiveStatusPosts: vi.fn(async () => []) }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('notFound')
  },
  unstable_rethrow: () => {},
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
// Stripes Zahlungsfeld (im Bündel der Kasse) braucht ein DOM — hier nur Hülle.
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children?: ReactNode }) => children,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}))
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))

import FarmPage from '@/app/(public)/[farmSlug]/page'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { FarmPageView } from '@/components/farm/farm-page-view'
import { HofseiteKunde } from '@/components/hofseite/hofseite-kunde'
import { AngabenZumHof } from '@/components/checkout/angaben-zum-hof'
import { KassenAbschluss } from '@/components/checkout/checkout-form'
import { HofErreichen } from '@/components/bestaetigung/hof-erreichen'
import { KONTAKT_NACH_DEM_KAUF } from '@/lib/hofseite-kunde'
import { KONTAKT_UNTER_ANGABEN_ZUM_HOF } from '@/lib/stripe-konto'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import { publicProduct } from './fabrik/public-product'
import { publicFarm } from './fabrik/public-farm'
import { findeElement, inhaltHinterSuspense } from './element-suche'

const WURZEL = process.cwd()
const lade = vi.mocked(ladeHofseiteGeteilt)

// So hat der Hof sie eingetragen (gespeichert bleibt die Eingabe) und so zeigt sie die Kasse (Nr. 81, N8).
const TELEFON = '+43 660 0000000'
const ANZEIGE = '+43 660 000 0000'
const EMAIL = 'hof@example.com'

function produkt(id: string, name: string): PublicProduct {
  return publicProduct({ id, name })
}

const HOF: PublicFarm = publicFarm({
  phone: TELEFON, email: EMAIL, aboutText: 'Ein kleiner Familienbetrieb.',
  products: [produkt('p_karotten', 'Karotten'), produkt('p_lauch', 'Lauch')],
})

const JETZT = '2026-10-02T08:00:00.000Z'
const KUNDIN = { art: 'kundin' as const, kaufen: true }

/** Die Props der Client-Komponente im Baum der Seite — ohne Komponenten aufzurufen. */
async function seitenProps(art: 'kundin' | 'vorschau'): Promise<Record<string, unknown>> {
  lade.mockResolvedValue({ farm: HOF, ansicht: { art, noindex: art === 'vorschau', kaufen: art === 'kundin' } })
  const baum = await inhaltHinterSuspense(await FarmPage({ params: Promise.resolve({ farmSlug: 'hof-test' }), searchParams: Promise.resolve({}) }))
  const fund = findeElement(baum, FarmPageView)
  if (!fund) throw new Error('FarmPageView fehlt im Baum der Seite')
  return fund.props
}

function hofseite(farm: PublicFarm = HOF): string {
  // Absichtlich der Hof MIT Telefon und E-Mail: Auch wenn sie einmal
  // durchrutschten, zeigt die Komponente sie nicht.
  return renderToStaticMarkup(createElement(HofseiteKunde, { farm, beitraege: [], beitraegeFehler: false, reorderItems: [], ansicht: KUNDIN, jetzt: JETZT }))
}

describe('Hofseite: Telefon und E-Mail gehen nicht an die Client-Komponente', () => {
  it('die Props von FarmPageView tragen weder phone noch email — für Kundinnen und in der Vorschau', async () => {
    for (const art of ['kundin', 'vorschau'] as const) {
      const props = await seitenProps(art)
      const farm = props.farm as Record<string, unknown>
      expect(Object.keys(farm), art).not.toContain('phone')
      expect(Object.keys(farm), art).not.toContain('email')
      expect(JSON.stringify(props), art).not.toContain(TELEFON)
      expect(JSON.stringify(props), art).not.toContain(EMAIL)
    }
  })

  it('Gegenprobe: der Hof selbst kommt an — Name, Inhaber, Anschrift, Produkte', async () => {
    const farm = (await seitenProps('kundin')).farm as Record<string, unknown>
    expect(farm).toMatchObject({ name: 'Hof Test', ownerName: 'Erika Muster', address: 'Musterweg 1', city: 'Musterdorf' })
    expect(farm.products).toHaveLength(2)
  })
})

describe('Hofseite: kein Anruf, kein tel:-Link, statt der Nummer der Hinweis', () => {
  it('kein „Anrufen", kein tel:, weder Nummer noch E-Mail im HTML', () => {
    const html = hofseite()
    expect(html).not.toContain('Anrufen')
    expect(html).not.toContain('tel:')
    expect(html).not.toContain(TELEFON)
    expect(html).not.toContain(EMAIL)
  })

  it('in „Zahlung & Kontakt" steht der Hinweis auf die Bestellbestätigung — Gegenprobe: Anfahrt und Zahlarten bleiben', () => {
    const html = hofseite()
    const karte = html.slice(html.indexOf('id="zahlung-kontakt"'), html.indexOf('id="anfahrt"'))
    expect(karte).toContain(KONTAKT_NACH_DEM_KAUF)
    expect(karte).toContain('Bar bei Abholung')
    expect(html).toContain('Anfahrt')
  })

  it('der leere Hof verweist nicht auf einen Anruf, der Ausweg bleibt', () => {
    const html = hofseite({ ...HOF, products: [], pickupSlots: [] })
    expect(html).toContain('Dieser Hof richtet gerade seinen Shop ein')
    expect(html).toContain('Schau bald wieder vorbei.')
    expect(html).toContain('Andere Höfe entdecken')
    expect(html).not.toContain('Anrufen')
    expect(html).not.toContain('tel:')
  })

  it('JSON-LD ohne telephone und email — Gegenprobe: Name und Anschrift stehen drin', async () => {
    // Seit Nr. 117 baut die Seite den Block auf dem Server — aus dem Hof MIT Telefon und E-Mail.
    lade.mockResolvedValue({ farm: HOF, ansicht: { art: 'kundin', noindex: false, kaufen: true } })
    const baum = await inhaltHinterSuspense(await FarmPage({ params: Promise.resolve({ farmSlug: 'hof-test' }), searchParams: Promise.resolve({}) }))
    const block = renderToStaticMarkup(baum).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(block).not.toBeNull()
    expect(block![1]).not.toContain(TELEFON)
    expect(block![1]).not.toContain(EMAIL)
    const daten = JSON.parse(block![1]) as Record<string, unknown>
    expect(daten).not.toHaveProperty('telephone')
    expect(daten).not.toHaveProperty('email')
    expect(daten).toMatchObject({ name: 'Hof Test', address: { streetAddress: 'Musterweg 1', addressLocality: 'Musterdorf' } })
  })
})

describe('Kasse: die Angaben zum Hof stehen vor dem Kaufknopf', () => {
  const ANGABEN = ['Hof Test, Erika Muster', 'Musterweg 1, 4900 Musterdorf', ANZEIGE, EMAIL]

  it('die Karte nennt Verkäufer, Anschrift, Telefon und E-Mail, offen, mit dem Satz zum Vertragspartner', () => {
    const html = renderToStaticMarkup(createElement(AngabenZumHof, { hof: HOF }))
    expect(html).toMatch(/<details[^>]*\bopen=""/)
    expect(html).toContain('Angaben zum Hof (dein Vertragspartner)')
    for (const angabe of ANGABEN) expect(html, angabe).toContain(angabe)
    expect(html).toContain(`Du kaufst direkt beim Hof. ${MARKE} vermittelt die Bestellung.`)
  })

  function abschluss(online: boolean): string {
    return renderToStaticMarkup(
      createElement(KassenAbschluss, {
        hof: HOF,
        uebersicht: createElement('section', null, 'Übersicht-Karte'),
        online,
        wirdGesendet: false,
        gesperrt: false,
        gesamt: '€ 14,91',
        fussnote: 'Bezahlung sicher über Stripe',
      })
    )
  }

  for (const [art, knopf] of [
    ['online', 'Weiter zur Zahlung · € 14,91'],
    ['bar', 'Zahlungspflichtig bestellen · € 14,91'],
  ] as const) {
    it(`${art}: Übersicht, dann alle vier Angaben, dann der Knopf „${knopf}"`, () => {
      const html = abschluss(art === 'online')
      const knopfStelle = html.indexOf(knopf)
      expect(knopfStelle).toBeGreaterThan(-1)
      expect(html.indexOf('Übersicht-Karte')).toBeLessThan(html.indexOf('Angaben zum Hof'))
      for (const angabe of ANGABEN) {
        const stelle = html.indexOf(angabe)
        expect(stelle, angabe).toBeGreaterThan(-1)
        expect(stelle, angabe).toBeLessThan(knopfStelle)
      }
    })
  }

  it('was der Hof nicht angegeben hat, steht nicht als leere Zeile da — Gegenprobe: die übrigen Angaben bleiben', () => {
    const html = renderToStaticMarkup(createElement(AngabenZumHof, { hof: { ...HOF, email: '' } }))
    expect(html).not.toContain('>E-Mail<')
    expect(html).toContain('>Telefon<')
    expect(html).toContain(ANZEIGE)
  })

  it('die Nummer steht einheitlich da, wie auch immer der Hof sie eingegeben hat (N8) — Unlesbares unverändert, nie eine leere Zeile', () => {
    const mitNummer = (phone: string) => renderToStaticMarkup(createElement(AngabenZumHof, { hof: { ...HOF, phone } }))
    for (const eingabe of ['0660 0000000', '0043 660 0000000', '660 0000000', '(0660) 000-00 00']) {
      const html = mitNummer(eingabe)
      expect(html, eingabe).toContain(`>${ANZEIGE}<`)
      expect(html, eingabe).not.toContain(`>${eingabe}<`)
    }
    expect(mitNummer('keine Angabe')).toContain('>keine Angabe<')
    expect(mitNummer('')).not.toContain('>Telefon<')
  })

  it('die Kasse nimmt den Abschluss für ihre Übersicht, und nur er trägt den Kaufknopf', () => {
    const formular = readFileSync(join(WURZEL, 'src/components/checkout/checkout-form.tsx'), 'utf8')
    expect(formular).toMatch(/uebersicht=\{\s*<KassenAbschluss\b/)
    expect(formular.match(/type="submit"/g)).toHaveLength(1)
    const abschlussQuelle = formular.slice(formular.indexOf('export function KassenAbschluss'))
    expect(abschlussQuelle).toContain('type="submit"')
  })
})

describe('Hof erreichen: nur, was der Hof angegeben hat', () => {
  const karte = (telefon: string, email: string) => renderToStaticMarkup(createElement(HofErreichen, { telefon, email }))

  it('mit beidem: Anrufen über tel:, E-Mail über mailto:', () => {
    const html = karte(TELEFON, EMAIL)
    expect(html).toContain('href="tel:+436600000000"')
    expect(html).toContain(`>${ANZEIGE}<`)
    expect(html).toContain(`href="mailto:${EMAIL}"`)
  })

  it('die Nummer steht einheitlich da und der Anrufen-Link wählt sie mit +43; ohne Ziffer bleibt die Eingabe stehen, aber ohne Anrufen', () => {
    const html = karte('0660 0000000', '')
    expect(html).toContain(`>${ANZEIGE}<`)
    expect(html).toContain('href="tel:+436600000000"')
    expect(html).not.toContain('0660 0000000')
    const ohneZiffer = karte('keine Angabe', '')
    expect(ohneZiffer).toContain('>keine Angabe<')
    expect(ohneZiffer).not.toContain('tel:')
    expect(ohneZiffer).not.toContain('Anrufen')
  })

  it('ohne E-Mail kein mailto:, ohne Telefon kein tel:, ohne beides keine Karte', () => {
    expect(karte(TELEFON, '')).not.toContain('mailto:')
    expect(karte('', EMAIL)).not.toContain('tel:')
    expect(karte('', EMAIL)).toContain('Hof erreichen')
    expect(karte('', '')).toBe('')
  })
})

describe('Keine Sackgasse: der Weg zu den Kontaktdaten statt „frag beim Hof"', () => {
  const ALTE_SAETZE = /ruf direkt am Hof an|Frag am besten direkt beim Hof nach/

  function dateien(ordner: string): string[] {
    const funde: string[] = []
    for (const name of readdirSync(join(WURZEL, ordner))) {
      const pfad = join(ordner, name)
      if (statSync(join(WURZEL, pfad)).isDirectory()) funde.push(...dateien(pfad))
      else if (/\.tsx?$/.test(name)) funde.push(relative(WURZEL, join(WURZEL, pfad)))
    }
    return funde
  }

  it('Gegenprobe: das Muster findet beide alten Sätze', () => {
    expect(ALTE_SAETZE.test('Schau bald wieder vorbei – oder ruf direkt am Hof an.')).toBe(true)
    expect(ALTE_SAETZE.test('Gerade gibt es keine Abholtermine. Frag am besten direkt beim Hof nach.')).toBe(true)
  })

  it('kein alter Satz mehr in src/', () => {
    const funde = dateien('src').filter((pfad) => ALTE_SAETZE.test(readFileSync(join(WURZEL, pfad), 'utf8')))
    expect(funde).toEqual([])
  }, 30_000)

  it('der neue Satz verweist auf die Karte, die die Kasse wirklich zeigt', () => {
    const name = KONTAKT_UNTER_ANGABEN_ZUM_HOF.match(/„(.+)“/)?.[1]
    expect(name).toBe('Angaben zum Hof')
    const html = renderToStaticMarkup(createElement(AngabenZumHof, { hof: HOF }))
    expect(html.slice(html.indexOf('<summary'), html.indexOf('</summary>'))).toContain(name)
  })
})
