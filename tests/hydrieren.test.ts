// @vitest-environment jsdom
/**
 * Test des Hydrierens (Nr. 135, G6-Ergänzung 21.10.2026): Teile, die mit Uhr, Breite oder Browser-Speicher
 * rechnen, zeichnen beim Hydrieren dasselbe wie das Server-HTML und holen den Wert des Browsers erst danach nach
 * (useSyncExternalStore mit Server-Wert). Ein Teil, das beim Rendern den Browser fragt, würde im Server-HTML etwas
 * anderes zeigen als im Browser — React meldet das als Hydrationsfehler, in der Produktion springt die Seite.
 *
 * Wie: tests/hydrieren-hilfe.ts rendert den Server-Teil OHNE Browser-Objekte (renderToString), setzt das HTML in
 * einen Container und hydriert es (hydrateRoot in act). Gesammelt werden onRecoverableError und console.error;
 * erwartet ist keine Meldung. Dies ist die einzige Testdatei mit jsdom (TESTING_GUIDELINES §1); ein neues Teil
 * dieser Art kommt hier dazu. Komponenten mit next/navigation, next/link und Sitzung bekommen die Attrappen
 * der übrigen Tests (tests/mein-hof-umschalter.test.ts, tests/abzeichen.test.ts).
 *
 * Gegenprobe: Ein Teil, das beim Rendern `typeof window` abfragt und davon abhängig anderes zeichnet, macht die
 * Hilfe rot — und das Server-HTML beweist, dass der Server den Browser nicht sah.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { BROWSER_OBJEKTE, hydriere, pruefeHydrieren, raeumeHydrierenAuf } from './hydrieren-hilfe'

// Attrappen wie in tests/mein-hof-umschalter.test.ts: Die Adresse liest useSearchParams aus `adresse`.
const adresse = { suche: '' }
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(adresse.suche),
  useRouter: () => router,
  usePathname: () => '/hoefe',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
// Die Sitzung lädt im Browser: solange sie fehlt, gilt „Gast“ (use-kunden-sitzung).
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }) }))
// Wie der echte Provider: Der Server kennt den Modus nicht (undefined), der Browser liest ihn beim ersten Rendern aus dem Speicher.
vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: typeof localStorage === 'undefined' ? undefined : (localStorage.getItem('theme') ?? 'light'),
    setTheme: vi.fn(),
  }),
}))

import { Abholzeile } from '@/components/hoefe/abholzeile'
import { BeitragMarke } from '@/components/hoefe/beitrag-marke'
import { ThemeUmschalter, ThemeUmschalterZeile } from '@/components/shared/theme-umschalter'
import { CookieBanner } from '@/components/cookie-banner'
import { KundenKopf } from '@/components/shared/kunden-kopf'
import { MeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { StartbildschirmKarte } from '@/components/heute/startbildschirm-karte'
import { STARTBILDSCHIRM_KARTE } from '@/lib/startbildschirm'
import { MEIN_HOF_ANSICHT_TEXT } from '@/lib/mein-hof-ansicht'
import { WARENKORB_SCHLUESSEL } from '@/lib/warenkorb-speicher'
import { useCart } from '@/lib/use-cart'
import { useHoefeAdresse } from '@/components/hoefe/use-hoefe-adresse'
import { useMindestbreite, useSchmalerAls } from '@/lib/use-mindestbreite'

/** Die Breite des Fensters für matchMedia, und ob die Seite als installierte App läuft. */
const fenster = { breite: 390, standalone: false }

function neueMatchMedia(abfrage: string): MediaQueryList {
  const mindestens = /\(min-width:\s*(\d+)px\)/.exec(abfrage)
  const matches = mindestens ? fenster.breite >= Number(mindestens[1]) : /display-mode:\s*standalone/.test(abfrage) && fenster.standalone
  return { matches, media: abfrage, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList
}

beforeEach(() => {
  fenster.breite = 390
  fenster.standalone = false
  adresse.suche = ''
  vi.stubGlobal('matchMedia', neueMatchMedia)
  localStorage.clear()
})

afterEach(async () => {
  await raeumeHydrierenAuf()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  window.history.replaceState(null, '', '/')
})

/** Die Uhr: erst die des Servers beim Bauen der Seite, beim Hydrieren (imBrowser) die spätere des Browsers. */
function stelleUhr(iso: string): void {
  vi.setSystemTime(new Date(iso))
}

describe('Hydrieren – die Hilfe selbst (Gegenprobe)', () => {
  /** Zeichnet je nach Umgebung etwas anderes — der Fehler, den der Test finden muss. */
  function Weiche(): React.JSX.Element {
    return createElement('p', null, typeof window === 'undefined' ? 'gerendert auf dem Server' : 'gerendert im Browser')
  }

  it('ein Teil, das beim Rendern typeof window abfragt, macht die Hilfe rot', async () => {
    await expect(pruefeHydrieren(createElement(Weiche))).rejects.toThrow(/Hydrieren meldet/)
    // Und es liegt an der Weiche: Hydrieren meldet dort etwas, das Server-HTML kam ohne Fenster.
    const ergebnis = await hydriere(createElement(Weiche))
    expect(ergebnis.serverHtml).toContain('gerendert auf dem Server')
    expect(ergebnis.meldungen.length).toBeGreaterThan(0)
  })

  it('der Server-Teil sieht keines der fünf Browser-Objekte, danach stehen sie wieder da', async () => {
    function Sicht(): React.JSX.Element {
      const g = globalThis as Record<string, unknown>
      return createElement('p', null, BROWSER_OBJEKTE.map((name) => `${name}:${typeof g[name]}`).join(' '))
    }
    const ergebnis = await hydriere(createElement(Sicht))
    expect(ergebnis.serverHtml).toContain('window:undefined document:undefined navigator:undefined localStorage:undefined matchMedia:undefined')
    for (const name of BROWSER_OBJEKTE) expect(typeof (globalThis as Record<string, unknown>)[name], name).not.toBe('undefined')
  })

  it('ein Teil ohne Abweichung besteht die Hilfe (die Hilfe ist nicht immer rot)', async () => {
    const ergebnis = await pruefeHydrieren(createElement('p', null, 'immer gleich'))
    expect(ergebnis.meldungen).toEqual([])
    expect(ergebnis.container.textContent).toBe('immer gleich')
  })
})

describe('Hydrieren – Teile mit der Uhr des Browsers', () => {
  const JETZT_SERVER = '2026-10-21T10:00:00.000Z' // Mittwoch, 12:00 Uhr in Wien
  const EINE_STUNDE_SPAETER = '2026-10-21T11:00:00.000Z' // die Uhr des Browsers: 13:00 Uhr

  it('Abholzeile: das Server-HTML rechnet mit dem Zeitpunkt des Servers, der Browser danach mit seiner Uhr', async () => {
    stelleUhr(JETZT_SERVER)
    const fenster = [{ dayOfWeek: 3, startTime: '12:30', endTime: '15:00' }]
    const ergebnis = await pruefeHydrieren(createElement(Abholzeile, { fenster, isPaused: false, jetzt: JETZT_SERVER }), {
      imBrowser: () => stelleUhr(EINE_STUNDE_SPAETER),
    })
    // Server: Das Fenster beginnt in einer halben Stunde — „heute“.
    expect(ergebnis.serverHtml).toContain('data-abholung="heute"')
    // Browser eine Stunde später: Das Fenster hat begonnen, bestellen geht nicht mehr — das nächste ist erst nächste Woche.
    expect(ergebnis.container.querySelector('[data-abholung]')?.getAttribute('data-abholung')).toBe('spaeter')
    expect(ergebnis.container.textContent).not.toContain('heute')
  })

  it('BeitragMarke: „vor 1 Std.“ im Server-HTML, „vor 2 Std.“ nach dem Hydrieren mit der Uhr des Browsers', async () => {
    stelleUhr(JETZT_SERVER)
    const beitrag = { titel: 'Frische Eier', veroeffentlicht: '2026-10-21T08:30:00.000Z', endet: null }
    const ergebnis = await pruefeHydrieren(
      createElement(BeitragMarke, { beitrag, jetzt: JETZT_SERVER, beschreibungId: 'beitrag-marke-testhof-a' }),
      { imBrowser: () => stelleUhr(EINE_STUNDE_SPAETER) },
    )
    expect(ergebnis.serverHtml).toContain('Neu · vor 1 Std.')
    expect(ergebnis.container.textContent).toContain('Neu · vor 2 Std.')
  })
})

describe('Hydrieren – Teile mit dem Darstellungsmodus des Browsers', () => {
  it('ThemeUmschalter: Platzhalter im Server-HTML, der Knopf mit dem Modus aus dem Speicher erst danach', async () => {
    const ergebnis = await pruefeHydrieren(createElement(ThemeUmschalter), { imBrowser: () => localStorage.setItem('theme', 'dark') })
    expect(ergebnis.serverHtml).not.toContain('<button')
    // Im Browser ist es dunkel: Der Knopf bietet den hellen Modus an.
    expect(ergebnis.container.querySelector('button')?.getAttribute('aria-label')).toBe('Hellen Modus einschalten')
  })

  // Fund aus Nr. 135: Die Beschriftung am Knopf richtete sich schon beim ersten Rendern im Browser nach dem Modus, den der Server nicht kennt.
  it('ThemeUmschalterZeile: „Darstellung“ im Server-HTML, danach das Wort zum Modus des Browsers', async () => {
    const ergebnis = await pruefeHydrieren(createElement(ThemeUmschalterZeile), { imBrowser: () => localStorage.setItem('theme', 'dark') })
    expect(ergebnis.serverHtml).toContain('Darstellung')
    expect(ergebnis.meldungen).toEqual([])
    expect(ergebnis.container.textContent).toBe('Heller Modus')
    // Im Browser ist es dunkel: Beschriftung und Tooltip bieten den hellen Modus an.
    const knopf = ergebnis.container.querySelector('button')
    expect(knopf?.getAttribute('aria-label')).toBe('Hellen Modus einschalten')
    expect(knopf?.getAttribute('title')).toBe('Hellen Modus einschalten')
  })
})

describe('Hydrieren – Teile mit dem Browser-Speicher', () => {
  /** Die Messung des Cookie-Hinweises läuft über Bildaufbau und Beobachter — fürs Hydrieren ohne Belang. */
  function ohneMessung(): void {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  }

  it('CookieBanner: im Server-HTML nichts, nach dem Hydrieren der Hinweis, solange der Speicher nichts weiß', async () => {
    ohneMessung()
    const ergebnis = await pruefeHydrieren(createElement(CookieBanner))
    expect(ergebnis.serverHtml).not.toContain('Hinweis zu Cookies')
    expect(ergebnis.container.querySelector('[aria-label="Hinweis zu Cookies"]')).not.toBeNull()
  })

  it('CookieBanner: hat der Browser „Verstanden“ schon gespeichert, bleibt der Hinweis weg', async () => {
    ohneMessung()
    const ergebnis = await pruefeHydrieren(createElement(CookieBanner), { imBrowser: () => localStorage.setItem('fz_cookie_ok', '1') })
    expect(ergebnis.container.querySelector('[aria-label="Hinweis zu Cookies"]')).toBeNull()
  })

  it('Kopfzeile: die Zahl im Warenkorb kommt aus dem Speicher des Browsers, nicht aus dem Server-HTML', async () => {
    const position = { productId: 'p-eier', name: 'Eier', price: 3.2, unit: 'piece', unitSize: null, imageUrl: null }
    const korb = { farmId: 'hof-a', farmSlug: 'testhof-a', items: [{ ...position, quantity: 2 }, { ...position, productId: 'p-brot', quantity: 3 }] }
    const ergebnis = await pruefeHydrieren(createElement(KundenKopf, { seite: { art: 'hofuebersicht' } }), {
      imBrowser: () => localStorage.setItem(WARENKORB_SCHLUESSEL, JSON.stringify(korb)),
    })
    expect(ergebnis.serverHtml).not.toContain('Warenkorb:')
    expect(ergebnis.container.querySelector('[aria-label^="Warenkorb:"]')?.getAttribute('aria-label')).toBe('Warenkorb: 5 Artikel — zum Hof')
  })

  it('useCart: der Korb des Hofs erscheint erst nach dem Hydrieren, im Server-HTML ist er leer', async () => {
    function KorbZaehler(): React.JSX.Element {
      const { count, isHydrated } = useCart('hof-a', 'testhof-a')
      return createElement('p', null, `Korb: ${count} (${isHydrated ? 'gelesen' : 'noch nicht gelesen'})`)
    }
    const korb = { farmId: 'hof-a', farmSlug: 'testhof-a', items: [{ productId: 'p-eier', name: 'Eier', price: 3.2, unit: 'piece', unitSize: null, imageUrl: null, quantity: 4 }] }
    const ergebnis = await pruefeHydrieren(createElement(KorbZaehler), {
      imBrowser: () => localStorage.setItem(WARENKORB_SCHLUESSEL, JSON.stringify(korb)),
    })
    expect(ergebnis.serverHtml).toContain('Korb: 0 (noch nicht gelesen)')
    expect(ergebnis.container.textContent).toBe('Korb: 4 (gelesen)')
  })
})

describe('Hydrieren – Teile mit der Breite und der Adresse des Browsers', () => {
  it('MeinHofAnsicht (useSchmalerAls): am schmalen Fenster mit ?ansicht=kundin öffnet die Kundenansicht erst nach dem Hydrieren', async () => {
    adresse.suche = 'ansicht=kundin'
    // Die Kinder stehen in den Props, wie JSX sie übergibt (wie tests/mein-hof-umschalter.test.ts).
    const props: ComponentProps<typeof MeinHofAnsicht> = {
      reiter: 'hofseite',
      slug: 'testhof-a',
      kopf: createElement('h1', null, 'Mein Hof'),
      children: createElement('p', null, 'Inhalt'),
    }
    const ergebnis = await pruefeHydrieren(createElement(MeinHofAnsicht, props))
    // Server und erstes Rendern im Browser: „nicht schmal“, also zu. Danach die echte Breite.
    expect(ergebnis.serverHtml).not.toContain(MEIN_HOF_ANSICHT_TEXT.rahmenTitel)
    expect(document.body.querySelector(`iframe[title="${MEIN_HOF_ANSICHT_TEXT.rahmenTitel}"]`)).not.toBeNull()
  })

  // Das Blatt der Kundenansicht hängt an einem Portal und kommt ohnehin erst im Browser: Eine Abweichung im Hook zeigt
  // der Baum von MeinHofAnsicht deshalb nicht. Der Hook selbst, mit Text im Baum, schon.
  describe('useSchmalerAls und useMindestbreite', () => {
    function Breite(): React.JSX.Element {
      return createElement('p', null, `schmal: ${useSchmalerAls(768)}, breit: ${useMindestbreite(768)}`)
    }

    it('am schmalen Fenster: im Server-HTML „nicht schmal“, nach dem Hydrieren schmal', async () => {
      const ergebnis = await pruefeHydrieren(createElement(Breite), { imBrowser: () => (fenster.breite = 390) })
      expect(ergebnis.serverHtml).toContain('schmal: false, breit: false')
      expect(ergebnis.container.textContent).toBe('schmal: true, breit: false')
    })

    it('am breiten Fenster: im Server-HTML „nicht breit“, nach dem Hydrieren breit', async () => {
      const ergebnis = await pruefeHydrieren(createElement(Breite), { imBrowser: () => (fenster.breite = 1280) })
      expect(ergebnis.serverHtml).toContain('schmal: false, breit: false')
      expect(ergebnis.container.textContent).toBe('schmal: false, breit: true')
    })
  })

  it('StartbildschirmKarte: im Server-HTML nichts, im Browser die Anleitung — in der installierten App nicht', async () => {
    const imBrowser = await pruefeHydrieren(createElement(StartbildschirmKarte))
    expect(imBrowser.serverHtml).toBe('')
    expect(imBrowser.container.textContent).toContain(STARTBILDSCHIRM_KARTE.titel)
    await raeumeHydrierenAuf()

    fenster.standalone = true
    const alsApp = await pruefeHydrieren(createElement(StartbildschirmKarte))
    expect(alsApp.container.textContent).toBe('')
  })

  it('useHoefeAdresse: die Filter aus der Adresse stehen erst nach dem Hydrieren da, der Server kennt nur den leeren Filter', async () => {
    function Filter(): React.JSX.Element {
      const suche = useHoefeAdresse()
      return createElement('p', null, `Adresse: ${suche ?? 'leer'}`)
    }
    const ergebnis = await pruefeHydrieren(createElement(Filter), {
      imBrowser: () => window.history.replaceState(null, '', '/hoefe?kat=eier'),
    })
    expect(ergebnis.serverHtml).toContain('Adresse: leer')
    expect(ergebnis.container.textContent).toBe('Adresse: ?kat=eier')
  })
})
