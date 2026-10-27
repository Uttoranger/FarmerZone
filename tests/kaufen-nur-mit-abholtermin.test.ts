/**
 * Kaufen nur mit Abholtermin (Register N24, /fix 21.10.2026). Anlass: Hof- und Produktseite sperrten die
 * Kaufwege nur bei Pause. Ein Hof ohne aktive Abholzeit (oder mit vollen Terminen im ganzen Vorlauf) füllte
 * den Korb, erst die Kasse sagte „Gerade gibt es keine Abholzeiten“.
 *
 * Beweist:
 *  - `kaufSperre` (src/lib/bereiche-anzeige.ts) liefert alle vier Ergebnisse, die Pause vor allem anderen,
 *    „ausgebucht“ nur im Vorlauf (`ABHOL_VORLAUF_TAGE`) und an der Zeitumstellung Ende Oktober mit dem
 *    Wiener Kalendertag — feste Uhr als Parameter.
 *  - Die Texte kommen aus einer Quelle (Titel, Satz, Knopf), die Wochen aus der Konstante.
 *  - Die echte Hofseite (page.tsx mit gestellter Uhr): ohne aktive Abholzeit und ausgebucht kein „+“, kein
 *    „Jetzt bestellen“, die Hinweiskarte mit dem Grund, der Knopf „Nicht bestellbar“; die Produkte bleiben
 *    sichtbar und in ihrer Reihenfolge. Gegenprobe mit freier Abholzeit.
 *  - Die echte Produktseite: dasselbe ohne „In den Korb · …“. Gegenprobe.
 *  - Mini-Warenkorb: Liegt etwas im Korb, steht statt „Zur Kasse“ der Hinweis — nur der Titel, damit der
 *    Satz auf Hof- und Produktseite einmal dasteht (ein Zustand, eine Fassung; gezählt mit vollem Korb).
 *    Im Korb-Blatt (`CartSheet`), das unter 1024 px der einzige Weg zur Kasse ist, die volle Karte.
 *  - Die Kasse (page.tsx) rechnet die Sperre einmal auf dem Server aus der einen Zählung der vollen Tage und
 *    gibt sie dem Formular; bei Pause zeigt sie die Pausen-Karte (Nr. 176), ein unbekannter Hof bleibt eine 404.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Fragment, createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const korb = vi.hoisted(() => ({ positionen: [] as unknown[] }))
const NICHT_GEFUNDEN = vi.hoisted(() => new Error('NEXT_NOT_FOUND'))

// N38 (Nr. 197): Die Kasse liest die Gebührenlage des Hofs — ohne Zeile bleibt bar, wie es ist.
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn(async () => null) } } }))
vi.mock('@/server/hofseite-vorschau', () => ({ ladeHofseiteGeteilt: vi.fn() }))
// Die Prüfung vor dem Streamen (Nr. 117) prüft tests/hofseite-404.test.ts; hier ist der Hof öffentlich.
vi.mock('@/server/queries/seo', () => ({
  pruefeHofseiteGeteilt: vi.fn(async () => ({ indexieren: true, geo: null })),
  pruefeProduktseiteGeteilt: vi.fn(async () => ({ indexieren: true })),
}))
vi.mock('@/server/queries/teilen-bild', () => ({ teilenVorschauAus: vi.fn(() => null) }))
vi.mock('@/server/queries/status-posts', () => ({ getActiveStatusPosts: vi.fn(async () => []) }))
vi.mock('@/server/queries/farm', () => ({ getPublicFarmGeteilt: vi.fn() }))
vi.mock('@/server/queries/products', () => ({ getNurBetriebeProduktIds: vi.fn(async () => []), getBetriebsVorbelegung: vi.fn(async () => null) }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn(async () => {}) }))
vi.mock('@/server/abholfenster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/abholfenster')>()),
  ausgebuchteTage: vi.fn(async () => new Map()),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => null) } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
// Der Korb liegt im Browser-Speicher; beim Server-Rendern wäre er leer. Gestellt, damit der Mini-Warenkorb erscheint.
vi.mock('@/lib/use-warenkorb-kopf', () => ({ useWarenkorbKopf: () => null, useWarenkorbVomHof: () => korb.positionen }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw NICHT_GEFUNDEN
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
// Das Korb-Blatt rendert sein Fenster beim Server-Rendern nicht (Portal). Auf Wunsch steht sein Inhalt an Ort
// und Stelle (per vi.mock ersetzte Teilkomponente, TESTING_GUIDELINES §1); sonst bleibt es das echte.
const blattInline = vi.hoisted(() => ({ an: false }))
vi.mock('@/components/ui/sheet', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/ui/sheet')>()
  type Kinder = { open?: boolean; children?: ReactNode }
  return {
    ...echt,
    Sheet: (props: Parameters<typeof echt.Sheet>[0]) =>
      blattInline.an ? createElement(Fragment, null, (props as Kinder).open ? (props as Kinder).children : null) : createElement(echt.Sheet, props),
    SheetContent: (props: Parameters<typeof echt.SheetContent>[0]) =>
      blattInline.an ? createElement('section', null, (props as Kinder).children) : createElement(echt.SheetContent, props),
    SheetTitle: (props: Parameters<typeof echt.SheetTitle>[0]) =>
      blattInline.an ? createElement('h2', null, (props as Kinder).children) : createElement(echt.SheetTitle, props),
  }
})
// Die Kasse prüft hier nur, was ihre Seite dem Formular gibt (die Props); das Formular selbst rendert
// tests/kasse-formular.test.ts. So bleibt Stripes Zahlungsfeld aus dem Spiel (Wache tests/paket-mock-wache.test.ts).
vi.mock('@/components/checkout/checkout-form', () => ({ CheckoutForm: () => null, KassePausiert: () => null }))

import FarmPage from '@/app/(public)/[farmSlug]/page'
import ProduktSeite from '@/app/(public)/[farmSlug]/produkt/[id]/page'
import CheckoutPage from '@/app/(public)/[farmSlug]/checkout/page'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { getPublicFarmGeteilt } from '@/server/queries/farm'
import { ausgebuchteTage, fensterSchluessel } from '@/server/abholfenster'
import { HofseiteSeitenspalte } from '@/components/hofseite/hofseite-seitenspalte'
import { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import { CartSheet } from '@/components/farm/cart-sheet'
import type { CartItem } from '@/lib/use-cart'
import { KAUFSPERRE_KNOPF, kaufSperre, kaufSperreHinweis, type KaufSperre } from '@/lib/bereiche-anzeige'
import { ABHOL_VORLAUF_TAGE } from '@/lib/pickup-days'
import { SHOP_PAUSED_BUTTON_LABEL, SHOP_PAUSED_FALLBACK } from '@/lib/shop-pause'
import type { AbholFenster } from '@/lib/hofuebersicht'
import type { PublicFarm } from '@/server/queries/farm'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'
import { publicFarm } from './fabrik/public-farm'
import { publicProduct } from './fabrik/public-product'
import { inhaltHinterSuspense } from './element-suche'

const lade = vi.mocked(ladeHofseiteGeteilt)
const ladeFuerKasse = vi.mocked(getPublicFarmGeteilt)
const volleTage = vi.mocked(ausgebuchteTage)

// Montag, 19. Oktober 2026, 10:00 Uhr in Wien (Sommerzeit). Der Vorlauf reicht bis So, 1. Nov.
const JETZT = new Date('2026-10-19T08:00:00.000Z')
const MITTWOCH: AbholFenster = { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }
// Beide Mittwoche im Vorlauf voll: 21. und 28. Oktober.
const MITTWOCH_VOLL: AbholFenster = { ...MITTWOCH, ausgebuchtAm: ['2026-10-21', '2026-10-28'] }

const TEXT = {
  keineTitel: 'Noch nicht bestellbar.',
  keineSatz: 'Hof Test hat gerade keine Abholzeit eingetragen. Schau bald wieder vorbei.',
  vollTitel: 'Gerade ausgebucht.',
  vollSatz: 'Alle Abholzeiten der nächsten 2 Wochen sind voll. Schau bald wieder vorbei.',
}

const PRODUKTE = [publicProduct({ id: 'p_karotten', name: 'Karotten' }), publicProduct({ id: 'p_lauch', name: 'Lauch' })]
const HOF_FREI = publicFarm({ products: PRODUKTE, pickupSlots: [MITTWOCH] })
const HOF_OHNE = publicFarm({ products: PRODUKTE, pickupSlots: [] })
const HOF_VOLL = publicFarm({ products: PRODUKTE, pickupSlots: [MITTWOCH_VOLL] })

const KUNDIN: SeitenAnsicht = { art: 'kundin', noindex: false, kaufen: true }

beforeEach(() => {
  vi.clearAllMocks()
  korb.positionen = []
  // Nur das Datum ist gestellt: Die Seiten bestimmen ihr `jetzt` mit new Date().
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('kaufSperre — eine Regel für alle Kaufwege', () => {
  it('ohne Pause und mit freiem Termin: keine Sperre', () => {
    expect(kaufSperre({ isPaused: false, pickupSlots: [MITTWOCH] }, JETZT)).toBeNull()
  })

  it('keine aktive Abholzeit: „keine-abholzeit“', () => {
    expect(kaufSperre({ isPaused: false, pickupSlots: [] }, JETZT)).toBe('keine-abholzeit')
  })

  it('alle Termine im Vorlauf voll: „ausgebucht“ — Gegenprobe: ein freier Mittwoch genügt', () => {
    expect(kaufSperre({ isPaused: false, pickupSlots: [MITTWOCH_VOLL] }, JETZT)).toBe('ausgebucht')
    expect(kaufSperre({ isPaused: false, pickupSlots: [{ ...MITTWOCH, ausgebuchtAm: ['2026-10-21'] }] }, JETZT)).toBeNull()
  })

  it('eine zweite Abholzeit mit freiem Termin hebt „ausgebucht“ auf', () => {
    const samstag: AbholFenster = { dayOfWeek: 6, startTime: '09:00', endTime: '12:00', ausgebuchtAm: ['2026-10-24'] }
    expect(kaufSperre({ isPaused: false, pickupSlots: [MITTWOCH_VOLL, samstag] }, JETZT)).toBeNull()
  })

  it('die Pause sticht alles: ohne Abholzeit, ausgebucht und frei', () => {
    for (const pickupSlots of [[], [MITTWOCH_VOLL], [MITTWOCH]]) {
      expect(kaufSperre({ isPaused: true, pickupSlots }, JETZT)).toBe('pause')
    }
  })

  it('ein schon begonnenes Fenster von heute zählt nicht — ist der nächste Termin voll, ist der Hof ausgebucht', () => {
    // Mittwoch, 21. Oktober: um 16:00 läuft das Fenster schon (Bestellschluss = Beginn), am 28. ist alles voll.
    const mittwochNachmittag = new Date('2026-10-21T14:00:00.000Z')
    const nurDer28 = { ...MITTWOCH, ausgebuchtAm: ['2026-10-28'] }
    expect(kaufSperre({ isPaused: false, pickupSlots: [nurDer28] }, mittwochNachmittag)).toBe('ausgebucht')
    // Gegenprobe: um 14:00 (vor Beginn) ist heute noch frei.
    expect(kaufSperre({ isPaused: false, pickupSlots: [nurDer28] }, new Date('2026-10-21T12:00:00.000Z'))).toBeNull()
  })

  it('weiter als der Vorlauf zählt nicht: frei erst am 15. Tag heißt ausgebucht', () => {
    // Ab So, 25. Oktober reicht der Vorlauf bis Sa, 7. November; der 8. November wäre frei, liegt aber dahinter.
    const sonntag: AbholFenster = { dayOfWeek: 0, startTime: '09:00', endTime: '12:00', ausgebuchtAm: ['2026-10-25', '2026-11-01'] }
    expect(ABHOL_VORLAUF_TAGE).toBe(14)
    expect(kaufSperre({ isPaused: false, pickupSlots: [sonntag] }, new Date('2026-10-25T05:00:00.000Z'))).toBe('ausgebucht')
  })

  describe('Zeitumstellung Ende Oktober 2026 (So, 25. Oktober, 03:00 → 02:00) mit fester Uhr', () => {
    it('an der Grenze des Vorlaufs zählt der Wiener Kalendertag, nicht der Tag der UTC-Uhr', () => {
      // 24.10. 22:30 UTC = So, 25.10. 00:30 in Wien (noch Sommerzeit). Von Sonntag aus liegt der Samstag,
      // 7. November, auf Tag 13 — im Vorlauf, frei. Nach dem UTC-Kalender (Sa, 24.10., 22:30) fiele er auf
      // Tag 14, hinter den Vorlauf: ausgebucht. Wer den UTC-Tag mit der Wiener Uhrzeit mischt, zählte den
      // vergangenen 24.10. als heutigen Termin (00:30 vor 09:00) — der ist voll, also auch ausgebucht.
      const jetzt = new Date('2026-10-24T22:30:00.000Z')
      const samstag: AbholFenster = { dayOfWeek: 6, startTime: '09:00', endTime: '12:00', ausgebuchtAm: ['2026-10-24', '2026-10-31'] }
      expect(ABHOL_VORLAUF_TAGE).toBe(14)
      expect(kaufSperre({ isPaused: false, pickupSlots: [samstag] }, jetzt)).toBeNull()
      // Gegenprobe: Ist auch der 7. November voll, gibt es im Vorlauf keinen Samstag mehr.
      expect(kaufSperre({ isPaused: false, pickupSlots: [{ ...samstag, ausgebuchtAm: ['2026-10-24', '2026-10-31', '2026-11-07'] }] }, jetzt)).toBe(
        'ausgebucht'
      )
    })

    it('in der Nacht der Umstellung (So, 00:30 Sommerzeit): beide Sonntage im Vorlauf voll heißt ausgebucht, ein freier genügt', () => {
      // Zählt die vollen Tage über die Umstellung hinweg; welcher Kalendertag gilt, prüft der Fall an der Grenze.
      const jetzt = new Date('2026-10-24T22:30:00.000Z')
      const sonntag: AbholFenster = { dayOfWeek: 0, startTime: '09:00', endTime: '12:00', ausgebuchtAm: ['2026-10-25', '2026-11-01'] }
      expect(kaufSperre({ isPaused: false, pickupSlots: [sonntag] }, jetzt)).toBe('ausgebucht')
      // Gegenprobe: Voll sind nur der Samstag davor und der 1. November — der 25. ist frei.
      expect(kaufSperre({ isPaused: false, pickupSlots: [{ ...sonntag, ausgebuchtAm: ['2026-10-24', '2026-11-01'] }] }, jetzt)).toBeNull()
    })

    it('nach der Umstellung (Mo, 00:30 Winterzeit): beide Montage im Vorlauf voll heißt ausgebucht, ein freier genügt', () => {
      // 25.10. 23:30 UTC = Mo, 26.10. 00:30 in Wien (Winterzeit).
      const jetzt = new Date('2026-10-25T23:30:00.000Z')
      const montag: AbholFenster = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', ausgebuchtAm: ['2026-10-26', '2026-11-02'] }
      expect(kaufSperre({ isPaused: false, pickupSlots: [montag] }, jetzt)).toBe('ausgebucht')
      expect(kaufSperre({ isPaused: false, pickupSlots: [{ ...montag, ausgebuchtAm: ['2026-10-26'] }] }, jetzt)).toBeNull()
    })

    it('am Tag der Umstellung: ein Fenster um 09:00 ist um 08:30 Winterzeit noch zu bestellen', () => {
      // 25.10. 07:30 UTC = 08:30 in Wien (Winterzeit, UTC+1) — vor dem Beginn um 09:00.
      const sonntag: AbholFenster = { dayOfWeek: 0, startTime: '09:00', endTime: '12:00', ausgebuchtAm: ['2026-11-01'] }
      expect(kaufSperre({ isPaused: false, pickupSlots: [sonntag] }, new Date('2026-10-25T07:30:00.000Z'))).toBeNull()
      // 25.10. 08:30 UTC = 09:30 in Wien: begonnen, der nächste Sonntag voll.
      expect(kaufSperre({ isPaused: false, pickupSlots: [sonntag] }, new Date('2026-10-25T08:30:00.000Z'))).toBe('ausgebucht')
    })
  })
})

describe('Texte aus einer Quelle', () => {
  it('ohne Abholzeit: Titel und Satz mit dem Hofnamen aus den Daten', () => {
    expect(kaufSperreHinweis('keine-abholzeit', 'Sonnhof')).toEqual({
      titel: 'Noch nicht bestellbar.',
      satz: 'Sonnhof hat gerade keine Abholzeit eingetragen. Schau bald wieder vorbei.',
    })
  })

  it('ausgebucht: die Wochen aus ABHOL_VORLAUF_TAGE (heute 14 Tage = 2 Wochen)', () => {
    const { titel, satz } = kaufSperreHinweis('ausgebucht', 'Testhof A')
    expect(titel).toBe('Gerade ausgebucht.')
    expect(satz).toBe(`Alle Abholzeiten der nächsten ${ABHOL_VORLAUF_TAGE / 7} Wochen sind voll. Schau bald wieder vorbei.`)
    expect(satz).toBe(TEXT.vollSatz)
  })

  it('der ruhende Knopf heißt „Nicht bestellbar“ — analog zu „Pausiert“', () => {
    expect(KAUFSPERRE_KNOPF).toBe('Nicht bestellbar')
    expect(SHOP_PAUSED_BUTTON_LABEL).toBe('Pausiert')
  })
})

/** Die echte Hofseite: page.tsx bis hinter die Suspense-Grenze, gerendert. */
async function hofseite(farm: PublicFarm, suche: Record<string, string> = {}): Promise<string> {
  lade.mockResolvedValue({ farm, ansicht: KUNDIN })
  const baum = await inhaltHinterSuspense(await FarmPage({ params: Promise.resolve({ farmSlug: 'hof-test' }), searchParams: Promise.resolve(suche) }))
  return renderToStaticMarkup(baum)
}

describe('Hofseite: ohne Abholtermin kein „+“, eine Hinweiskarte mit dem Grund', () => {
  for (const [fall, farm, titel, satz] of [
    ['ohne aktive Abholzeit', HOF_OHNE, TEXT.keineTitel, TEXT.keineSatz],
    ['alle Termine im Vorlauf voll', HOF_VOLL, TEXT.vollTitel, TEXT.vollSatz],
  ] as const) {
    it(`${fall}: Hinweis, kein „+“, kein „Jetzt bestellen“, Knopf „Nicht bestellbar“`, async () => {
      for (const html of [await hofseite(farm), await hofseite(farm, { reiter: 'produkte' })]) {
        expect(html).toContain(titel)
        expect(html).toContain(satz)
        expect(html).not.toContain('in den Korb legen')
        expect(html).not.toContain('Jetzt bestellen')
        expect(html).toContain(`>${KAUFSPERRE_KNOPF}<`)
        expect(html).not.toContain('pausiert gerade')
      }
    })

    it(`${fall}: die Produkte bleiben sichtbar und in ihrer Reihenfolge`, async () => {
      const html = await hofseite(farm, { reiter: 'produkte' })
      expect(html.indexOf('Karotten')).toBeGreaterThan(-1)
      expect(html.indexOf('Karotten')).toBeLessThan(html.indexOf('Lauch'))
    })
  }

  it('ausgebucht: keine Karte „Nächste Abholung“ — sie versprächen einen Termin, den es nicht gibt', async () => {
    expect(await hofseite(HOF_VOLL)).not.toContain('Nächste Abholung')
  })

  it('Gegenprobe: mit freier Abholzeit „+“ und „Jetzt bestellen“, kein Hinweis', async () => {
    const html = await hofseite(HOF_FREI)
    expect(html).toContain('Karotten in den Korb legen')
    expect(html).toContain('Jetzt bestellen')
    for (const text of [TEXT.keineTitel, TEXT.vollTitel, `>${KAUFSPERRE_KNOPF}<`]) expect(html).not.toContain(text)
  })

  it('Pause: weiter die Pause-Karte, der Knopf „Pausiert“ — nicht der neue Hinweis', async () => {
    const html = await hofseite({ ...HOF_OHNE, isPaused: true, pauseMessage: 'Wir sind im Urlaub.' }, { reiter: 'produkte' })
    expect(html).toContain('Hof Test pausiert gerade.')
    expect(html).toContain('Wir sind im Urlaub.')
    expect(html).toContain(`>${SHOP_PAUSED_BUTTON_LABEL}<`)
    expect(html).not.toContain(TEXT.keineTitel)
  })
})

/** Die echte Produktseite: page.tsx bis hinter die Suspense-Grenze, gerendert. */
async function produktseite(farm: PublicFarm): Promise<string> {
  lade.mockResolvedValue({ farm, ansicht: KUNDIN })
  const baum = await inhaltHinterSuspense(
    await ProduktSeite({ params: Promise.resolve({ farmSlug: 'hof-test', id: 'p_karotten' }), searchParams: Promise.resolve({}) })
  )
  return renderToStaticMarkup(baum)
}

describe('Produktseite: dieselbe Sperre', () => {
  for (const [fall, farm, titel, satz] of [
    ['ohne aktive Abholzeit', HOF_OHNE, TEXT.keineTitel, TEXT.keineSatz],
    ['alle Termine im Vorlauf voll', HOF_VOLL, TEXT.vollTitel, TEXT.vollSatz],
  ] as const) {
    it(`${fall}: Hinweis, kein „In den Korb“, Knopf „Nicht bestellbar“, nichts zum Mitnehmen`, async () => {
      const html = await produktseite(farm)
      expect(html).toContain(titel)
      expect(html).toContain(satz)
      expect(html).not.toContain('In den Korb ·')
      expect(html).not.toContain('in den Korb legen')
      expect(html).toContain(`>${KAUFSPERRE_KNOPF}<`)
      expect(html).not.toContain('Gleich mit abholen')
    })
  }

  it('Gegenprobe: mit freier Abholzeit „In den Korb · €“ und „Gleich mit abholen“', async () => {
    const html = await produktseite(HOF_FREI)
    expect(html).toContain('In den Korb · €')
    expect(html).toContain('Gleich mit abholen')
    expect(html).not.toContain(TEXT.keineTitel)
  })
})

describe('Mini-Warenkorb: statt „Zur Kasse“ der Hinweis', () => {
  const HOF_SPALTE = { id: 'farm_test', slug: 'hof-test', name: 'Hof Test', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf', pauseMessage: null, pickupSlots: [MITTWOCH] }

  function spalte(sperre: KaufSperre): string {
    return renderToStaticMarkup(
      createElement(HofseiteSeitenspalte, {
        hof: HOF_SPALTE,
        sperre,
        zahlungsarten: [],
        gebuehrKurz: null,
        gebuehrKorb: null,
        mitKorb: true,
        jetzt: JETZT.toISOString(),
      })
    )
  }

  beforeEach(() => {
    korb.positionen = [{ productId: 'p_karotten', name: 'Karotten', price: 4.5, unit: 'STUECK', unitSize: null, quantity: 2, imageUrl: null }]
  })

  it('ohne Abholzeit, ausgebucht und Pause: kein „Zur Kasse“, der Grund steht im Korb — nur der Titel', () => {
    // Den Satz trägt die Karte oben auf derselben Seite (ein Zustand, eine Fassung); der Korb nennt nur den Grund.
    for (const [sperre, titel, satz] of [
      ['keine-abholzeit', TEXT.keineTitel, TEXT.keineSatz],
      ['ausgebucht', TEXT.vollTitel, TEXT.vollSatz],
      ['pause', 'Hof Test pausiert gerade.', SHOP_PAUSED_FALLBACK],
    ] as const) {
      const html = spalte(sperre)
      expect(html, sperre).toContain(titel)
      expect(html, sperre).not.toContain(satz)
    }
    for (const sperre of ['keine-abholzeit', 'ausgebucht', 'pause'] as const) {
      const html = spalte(sperre)
      expect(html, sperre).toContain('Dein Warenkorb')
      expect(html, sperre).not.toContain('Zur Kasse')
    }
  })

  it('Gegenprobe: dieselbe Karte ohne `kurz` trägt den Satz — nur die Kurzfassung lässt ihn weg', () => {
    for (const [sperre, titel, satz] of [
      ['keine-abholzeit', TEXT.keineTitel, TEXT.keineSatz],
      ['ausgebucht', TEXT.vollTitel, TEXT.vollSatz],
      ['pause', 'Hof Test pausiert gerade.', SHOP_PAUSED_FALLBACK],
    ] as const) {
      const karte = (kurz: boolean) => renderToStaticMarkup(createElement(KaufSperreHinweis, { sperre, hofName: 'Hof Test', pauseMessage: null, kurz }))
      expect(karte(false), sperre).toContain(satz)
      expect(karte(true), sperre).toContain(titel)
      expect(karte(true), sperre).not.toContain(satz)
    }
  })

  it('Gegenprobe: ohne Sperre „Zur Kasse“; leerer Korb zeigt keinen Mini-Warenkorb und keinen Hinweis', () => {
    expect(spalte(null)).toContain('Zur Kasse')
    korb.positionen = []
    const leer = spalte('keine-abholzeit')
    expect(leer).not.toContain('Dein Warenkorb')
    expect(leer).not.toContain(TEXT.keineSatz)
  })
})

/** Wie oft ein Text im HTML steht. */
function vorkommen(html: string, text: string): number {
  return html.split(text).length - 1
}

describe('Ein Zustand, eine Fassung: mit vollem Korb steht der Satz einmal auf der Seite', () => {
  const POSITION = { productId: 'p_karotten', name: 'Karotten', price: 4.5, unit: 'STUECK', unitSize: null, quantity: 2, imageUrl: null }
  const HOF_PAUSE = { ...HOF_FREI, isPaused: true, pauseMessage: 'Wir sind im Urlaub.' }

  // Der Mini-Warenkorb (ab 1024 px) steht auf derselben Seite wie die Karte oben: Er nennt nur den Titel.
  for (const [fall, farm, titel, satz] of [
    ['ohne aktive Abholzeit', HOF_OHNE, TEXT.keineTitel, TEXT.keineSatz],
    ['alle Termine im Vorlauf voll', HOF_VOLL, TEXT.vollTitel, TEXT.vollSatz],
    ['Pause', HOF_PAUSE, 'Hof Test pausiert gerade.', 'Wir sind im Urlaub.'],
  ] as const) {
    it(`${fall}: Hof- und Produktseite — Satz einmal (Karte oben), Titel zweimal (Karte und Korb)`, async () => {
      korb.positionen = [POSITION]
      const seiten = { hofseite: await hofseite(farm), produkte: await hofseite(farm, { reiter: 'produkte' }), produktseite: await produktseite(farm) }
      for (const [seite, html] of Object.entries(seiten)) {
        expect(html, seite).toContain('Dein Warenkorb')
        expect(vorkommen(html, satz), seite).toBe(1)
        expect(vorkommen(html, titel), seite).toBe(2)
      }
    })

    it(`${fall}: Gegenprobe — leerer Korb: kein Mini-Warenkorb, Titel und Satz je einmal`, async () => {
      for (const html of [await hofseite(farm), await produktseite(farm)]) {
        expect(html).not.toContain('Dein Warenkorb')
        expect(vorkommen(html, satz)).toBe(1)
        expect(vorkommen(html, titel)).toBe(1)
      }
    })
  }
})

describe('Korb-Blatt (unter 1024 px der einzige Weg zur Kasse): statt „Zur Kasse“ der Hinweis', () => {
  const POSITION = { productId: 'p_karotten', name: 'Karotten', price: 4.5, unit: 'STUECK', unitSize: null, quantity: 2, imageUrl: null }

  beforeEach(() => {
    blattInline.an = true
  })
  afterEach(() => {
    blattInline.an = false
  })

  function blatt(sperre: KaufSperre, items: CartItem[] = [POSITION as CartItem]): string {
    return renderToStaticMarkup(
      createElement(CartSheet, {
        open: true,
        onOpenChange: () => {},
        items,
        total: 9,
        farmSlug: 'hof-test',
        onUpdateQuantity: () => {},
        onRemoveItem: () => {},
        kaufSperre: { sperre, hofName: 'Hof Test', pauseMessage: null },
      })
    )
  }

  it('ohne Abholzeit, ausgebucht und Pause: kein „Zur Kasse“, der Grund steht im Blatt', () => {
    expect(blatt('keine-abholzeit')).toContain(TEXT.keineSatz)
    expect(blatt('ausgebucht')).toContain(TEXT.vollSatz)
    expect(blatt('pause')).toContain('Hof Test pausiert gerade.')
    for (const sperre of ['keine-abholzeit', 'ausgebucht', 'pause'] as const) {
      const html = blatt(sperre)
      expect(html, sperre).toContain('Karotten')
      expect(html, sperre).not.toContain('Zur Kasse')
    }
  })

  it('Gegenprobe: ohne Sperre „Zur Kasse“ und kein Hinweis; leeres Blatt ohne beides', () => {
    const frei = blatt(null)
    expect(frei).toContain('Zur Kasse')
    expect(frei).not.toContain(TEXT.keineTitel)
    const leer = blatt('keine-abholzeit', [])
    expect(leer).toContain('Dein Warenkorb ist leer.')
    expect(leer).not.toContain(TEXT.keineSatz)
  })

  // Nr. 145: Mit Sperre lehnt /api/reserve jede neue Menge ab — Knöpfe dafür brächten bei jedem Tipp eine Ablehnung.
  it('mit Sperre: keine Knöpfe „eins mehr“/„eins weniger“, die Menge steht als Zahl, Entfernen bleibt', () => {
    for (const sperre of ['keine-abholzeit', 'ausgebucht', 'pause'] as const) {
      const html = blatt(sperre)
      expect(html, sperre).not.toContain('Karotten: eins mehr')
      expect(html, sperre).not.toContain('Karotten: eins weniger')
      expect(html, sperre).toContain('Menge: 2')
      expect(html, sperre).toContain('Karotten aus dem Warenkorb nehmen')
    }
  })

  it('Gegenprobe: ohne Sperre stehen beide Mengen-Knöpfe und Entfernen da', () => {
    const frei = blatt(null)
    expect(frei).toContain('Karotten: eins mehr')
    expect(frei).toContain('Karotten: eins weniger')
    expect(frei).toContain('Karotten aus dem Warenkorb nehmen')
  })
})

describe('Kasse: die Sperre rechnet der Server, einmal, aus der einen Zählung', () => {
  async function kasse(farm: PublicFarm): Promise<ReactElement<Record<string, unknown>>> {
    ladeFuerKasse.mockResolvedValue(farm)
    return (await CheckoutPage({ params: Promise.resolve({ farmSlug: 'hof-test' }), searchParams: Promise.resolve({}) })) as ReactElement<Record<string, unknown>>
  }

  it('ohne aktive Abholzeit: das Formular bekommt „keine-abholzeit“', async () => {
    expect((await kasse(HOF_OHNE)).props.sperre).toBe('keine-abholzeit')
  })

  it('alle Termine voll: „ausgebucht“, aus derselben Zählung wie die ausgegrauten Termine', async () => {
    volleTage.mockResolvedValueOnce(
      new Map([['farm_test', new Map([[fensterSchluessel(MITTWOCH), { ...MITTWOCH, ausgebuchtAm: ['2026-10-21', '2026-10-28'] }]])]])
    )
    const formular = await kasse(HOF_FREI)
    expect(formular.props.sperre).toBe('ausgebucht')
    expect(formular.props.ausgebuchteAbholfenster).toEqual(['2026-10-21|15:00|18:00', '2026-10-28|15:00|18:00'])
    expect(volleTage).toHaveBeenCalledTimes(1)
  })

  it('Gegenprobe: mit freiem Termin keine Sperre', async () => {
    expect((await kasse(HOF_FREI)).props.sperre).toBeNull()
  })

  it('Pause (Nr. 176): keine Kasse und kein 404, sondern die Pausen-Karte mit dem Hof', async () => {
    const seite = await kasse({ ...HOF_FREI, isPaused: true })
    expect(String(typeof seite.type === 'function' ? seite.type.name : seite.type)).toBe('KassePausiert')
    expect((seite.props.farm as { slug: string }).slug).toBe(HOF_FREI.slug)
  })

  it('Gegenprobe (Nr. 176): ein unbekannter Hof bleibt ein 404', async () => {
    ladeFuerKasse.mockResolvedValue(null)
    await expect(CheckoutPage({ params: Promise.resolve({ farmSlug: 'gibt-es-nicht' }), searchParams: Promise.resolve({}) })).rejects.toBe(NICHT_GEFUNDEN)
  })
})
