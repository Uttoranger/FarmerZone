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
 *
 * Die Liste (Regelvorschlag 135 aus Morgenbericht 20, freigegeben 21.10.2026, Nr. 140): Jede Datei unter `src/`, in
 * der `useSyncExternalStore` aufgerufen wird, steht in `GEPRUEFT` (mit den Teilen, die ihren Fall tragen) oder in
 * `AUSNAHMEN` (mit Grund). Zu jedem Teil in `GEPRUEFT` gibt es einen `it`, der es über `pruefeHydrieren` oder
 * `hydriere` rendert. Das Teil darf auch nur ein Hook sein, den ein kleines Prüf-Bauteil im Test benutzt. Eine neue
 * Datei mit `useSyncExternalStore` macht die Wache rot, bis hier ein Fall dazukommt. Zu jedem Fall der Liste wurde
 * gezeigt, dass er rot wird, wenn das Teil auf direktes Lesen steht (`typeof window === 'undefined' ? … : lesen()`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, type ComponentProps, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
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
  // Wie der echte Link: onNavigate und prefetch gehen nie als Attribut ans <a>.
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; onNavigate?: unknown; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
// Die Sitzung lädt im Browser: solange sie fehlt, gilt „Gast“ (use-kunden-sitzung).
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }) }))
// Wie der echte Provider: Der Server kennt den Modus nicht (undefined), der Browser liest ihn beim ersten Rendern aus dem Speicher.
vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: typeof localStorage === 'undefined' ? undefined : (localStorage.getItem('theme') ?? 'light'),
    // Die Wahl selbst (Hell, Dunkel, System): fehlt sie im Speicher, gilt „System“.
    theme: typeof localStorage === 'undefined' ? undefined : (localStorage.getItem('theme') ?? undefined),
    setTheme: vi.fn(),
  }),
}))
// Die Karte der Hofübersicht lädt erst im Browser (Leaflet) — hier ohne.
vi.mock('next/dynamic', () => ({ default: () => () => null }))
// Das Meldeformular schickt über eine Server-Aktion ab; beim Hydrieren wird nichts abgeschickt.
vi.mock('@/server/actions/meldung', () => ({ meldungAbsenden: vi.fn() }))

import { Abholzeile } from '@/components/hoefe/abholzeile'
import { BeitragMarke } from '@/components/hoefe/beitrag-marke'
import { ThemeUmschalter, ThemeUmschalterZeile } from '@/components/shared/theme-umschalter'
import { CookieBanner } from '@/components/cookie-banner'
import { useWarenkorbKopf } from '@/lib/use-warenkorb-kopf'
import { MeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { StartbildschirmKarte } from '@/components/heute/startbildschirm-karte'
import { STARTBILDSCHIRM_KARTE } from '@/lib/startbildschirm'
import { MEIN_HOF_ANSICHT_TEXT } from '@/lib/mein-hof-ansicht'
import { WARENKORB_SCHLUESSEL } from '@/lib/warenkorb-speicher'
import { useCart } from '@/lib/use-cart'
import { useHoefeAdresse } from '@/components/hoefe/use-hoefe-adresse'
import { useMindestbreite, useSchmalerAls } from '@/lib/use-mindestbreite'
import { DarstellungKarte } from '@/app/(hof)/settings/account/darstellung-karte'
import { useImVorschauRahmen, VorschauImRahmen } from '@/components/farm/vorschau-im-rahmen'
import { HoefeClient } from '@/components/hoefe/hoefe-client'
import { useMeldungFormular } from '@/components/shared/use-meldung-formular'
import { useWarenkorbVomHof } from '@/lib/use-warenkorb-kopf'
import type { HofUebersichtEintrag } from '@/server/queries/farm'

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
    // Das Symbol der Kopfzeile (KundeShell) liest den Korb über useWarenkorbKopf — hier nur dessen Anzeige.
    function KorbSymbol(): React.JSX.Element | null {
      const korb = useWarenkorbKopf()
      return korb ? createElement('a', { href: korb.href, 'aria-label': `Warenkorb: ${korb.anzahl} Artikel — zum Hof` }) : null
    }
    const ergebnis = await pruefeHydrieren(createElement(KorbSymbol), {
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

describe('Hydrieren – weitere Teile mit dem Browser-Speicher und -Kontext', () => {
  it('DarstellungKarte: Platzhalter im Server-HTML, die drei Knöpfe mit der Wahl des Browsers erst danach', async () => {
    const ergebnis = await pruefeHydrieren(createElement(DarstellungKarte), { imBrowser: () => localStorage.setItem('theme', 'dark') })
    expect(ergebnis.serverHtml).not.toContain('<button')
    const knoepfe = [...ergebnis.container.querySelectorAll('[role="group"] button')]
    expect(knoepfe.map((k) => [k.textContent, k.getAttribute('aria-pressed')])).toEqual([
      ['Hell', 'false'],
      ['Dunkel', 'true'],
      ['System', 'false'],
    ])
  })

  it('useWarenkorbVomHof: die Positionen des Hofs kommen aus dem Speicher des Browsers, im Server-HTML ist der Korb leer', async () => {
    function Positionen(): React.JSX.Element {
      return createElement('p', null, `Positionen: ${useWarenkorbVomHof('hof-a').length}`)
    }
    const position = { productId: 'p-eier', name: 'Eier', price: 3.2, unit: 'piece', unitSize: null, imageUrl: null }
    const korb = { farmId: 'hof-a', farmSlug: 'testhof-a', items: [{ ...position, quantity: 2 }, { ...position, productId: 'p-brot', quantity: 1 }] }
    const ergebnis = await pruefeHydrieren(createElement(Positionen), {
      imBrowser: () => localStorage.setItem(WARENKORB_SCHLUESSEL, JSON.stringify(korb)),
    })
    expect(ergebnis.serverHtml).toContain('Positionen: 0')
    expect(ergebnis.container.textContent).toBe('Positionen: 2')
  })

  it('useMeldungFormular: der Kontext (Adresse, Fenstergröße) steht erst nach dem Hydrieren da, im Server-HTML ist er leer', async () => {
    function Kontext(): React.JSX.Element {
      const { kontext } = useMeldungFormular({ formToken: 'token-testwert', alsHof: false, kennungVorbelegt: '' })
      return createElement('p', null, `Fenster: ${kontext.viewport || 'unbekannt'}`)
    }
    const ergebnis = await pruefeHydrieren(createElement(Kontext), {
      imBrowser: () => {
        vi.stubGlobal('innerWidth', 390)
        vi.stubGlobal('innerHeight', 844)
      },
    })
    expect(ergebnis.serverHtml).toContain('Fenster: unbekannt')
    expect(ergebnis.container.textContent).toBe('Fenster: 390x844')
  })

  // Die Leiste der KundeShell weiß erst nach dem Mounten, dass die Hofseite im Rahmen des Editors steht: Eine andere
  // Wurzel der Seite hat den Stand schon gesetzt, bevor diese hydriert — das Lesen beim Hydrieren darf ihn nicht sehen.
  it('useImVorschauRahmen: im Server-HTML und beim Hydrieren „normal“, erst danach „im Rahmen“', async () => {
    function Leiste(): React.JSX.Element {
      return createElement('p', null, `Leiste: ${useImVorschauRahmen() ? 'blass' : 'normal'}`)
    }
    const nebenContainer = document.createElement('div')
    document.body.appendChild(nebenContainer)
    const nebenWurzel = createRoot(nebenContainer)
    try {
      const ergebnis = await pruefeHydrieren(createElement(Leiste), {
        imBrowser: () => {
          // Die Seite steht in einem Rahmen: window.parent ist ein anderes Fenster.
          vi.stubGlobal('parent', { postMessage: vi.fn() })
          act(() => nebenWurzel.render(createElement(VorschauImRahmen)))
        },
      })
      expect(ergebnis.serverHtml).toContain('Leiste: normal')
      expect(ergebnis.container.textContent).toBe('Leiste: blass')
    } finally {
      act(() => nebenWurzel.unmount())
      nebenContainer.remove()
    }
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

describe('Hydrieren – die Hofübersicht /hoefe', () => {
  const hof = (slug: string): HofUebersichtEintrag => ({
    slug,
    name: `Testhof ${slug}`,
    postalCode: '4900',
    city: 'Musterdorf',
    logoUrl: null,
    logoAusschnitt: null,
    latitude: 48.1,
    longitude: 13.1,
    isPaused: false,
    kategorien: [],
    angebot: [],
    naechsteAbholung: null,
    abholfenster: [],
    produkte: [],
    produkteGesamt: 0,
    produkteJeBereich: { LEBENSMITTEL: 0, FUTTERMITTEL: 0 },
    suchNamen: [],
    fotos: [],
    gruendungshof: false,
    neuerBeitrag: null,
  })
  const JETZT = '2026-10-21T08:00:00.000Z'

  it('HoefeClient (useIstBreit): der Server zeichnet die schmale Gestalt, am breiten Fenster springt der Splitscreen erst nach dem Hydrieren ein', async () => {
    const element = createElement(HoefeClient, { hoefe: [hof('a'), hof('b')], jetzt: JETZT })
    const ergebnis = await pruefeHydrieren(element, { imBrowser: () => (fenster.breite = 1280) })
    // Die Zahlzeile in der Filterreihe (ein <span role="status">) steht nur im Splitscreen; die <p role="status"> über der Liste immer.
    expect(ergebnis.serverHtml).not.toContain('<span role="status"')
    expect(ergebnis.container.querySelector('span[role="status"]')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Die Liste: jede Datei mit useSyncExternalStore hat einen Fall oder steht mit Grund unter den Ausnahmen.
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Datei → die Teile, die ihren Hydrier-Fall tragen (Komponente oder Hook, wie sie oben im Test stehen). Ein Hook, den nur
 * Bauteile aus anderen Dateien benutzen (`use-uhr.ts`), steht mit den Bauteilen, die ihn im Fall zeigen. Hat eine Datei
 * mehrere Aufrufe von useSyncExternalStore, nennt sie mindestens ebenso viele Teile (`use-warenkorb-kopf.ts`: das Symbol
 * der Kopfzeile über `useWarenkorbKopf`, der Mini-Warenkorb über `useWarenkorbVomHof`).
 */
const GEPRUEFT: Record<string, string[]> = {
  'src/app/(hof)/settings/account/darstellung-karte.tsx': ['DarstellungKarte'],
  'src/components/cookie-banner.tsx': ['CookieBanner'],
  'src/components/farm/vorschau-im-rahmen.tsx': ['useImVorschauRahmen'],
  'src/components/heute/startbildschirm-karte.tsx': ['StartbildschirmKarte'],
  'src/components/hoefe/hoefe-client.tsx': ['HoefeClient'],
  'src/components/hoefe/use-hoefe-adresse.ts': ['useHoefeAdresse'],
  'src/components/hoefe/use-uhr.ts': ['Abholzeile', 'BeitragMarke'],
  'src/components/shared/theme-umschalter.tsx': ['ThemeUmschalter', 'ThemeUmschalterZeile'],
  'src/components/shared/use-meldung-formular.ts': ['useMeldungFormular'],
  'src/lib/use-cart.ts': ['useCart'],
  'src/lib/use-mindestbreite.ts': ['useMindestbreite', 'useSchmalerAls'],
  'src/lib/use-warenkorb-kopf.ts': ['useWarenkorbKopf', 'useWarenkorbVomHof'],
}

/** Datei → Grund, warum es für sie keinen Hydrier-Fall gibt. Heute keine; ein Eintrag braucht einen Satz und kommt in den Bericht. */
const AUSNAHMEN: Record<string, string> = {}

function quellDatei(text: string, name: string): ts.SourceFile {
  return ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

/** Wie oft die Datei useSyncExternalStore aufruft — Kommentare und der Import zählen nicht. */
function zaehleStore(text: string, name: string): number {
  if (!text.includes('useSyncExternalStore')) return 0
  let anzahl = 0
  const besuche = (k: ts.Node): void => {
    if (ts.isImportDeclaration(k)) return
    if (ts.isIdentifier(k) && k.text === 'useSyncExternalStore') anzahl++
    ts.forEachChild(k, besuche)
  }
  besuche(quellDatei(text, name))
  return anzahl
}

/** Alle Quelldateien unter `src/` rekursiv. */
function quelldateien(ordner: string): string[] {
  const funde: string[] = []
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) funde.push(...quelldateien(pfad))
    else if (/\.tsx?$/.test(name)) funde.push(pfad)
  }
  return funde
}

/** Datei → Zahl der Aufrufe von useSyncExternalStore, nur Dateien mit mindestens einem. */
function leseStoreDateien(): Map<string, number> {
  const funde = new Map<string, number>()
  for (const pfad of quelldateien(join(process.cwd(), 'src'))) {
    const name = relative(process.cwd(), pfad).split(sep).join('/')
    const anzahl = zaehleStore(readFileSync(pfad, 'utf8'), name)
    if (anzahl > 0) funde.set(name, anzahl)
  }
  return funde
}

/** Was an der Liste nicht stimmt, als Sätze mit dem Namen der Datei; leer = jede Datei ist geprüft oder mit Grund ausgenommen. */
function listenProbleme(funde: Map<string, number>, gepruefit: Record<string, string[]>, ausnahmen: Record<string, string>): string[] {
  const probleme: string[] = []
  for (const [datei, anzahl] of funde) {
    const teile = gepruefit[datei]
    if (teile === undefined && ausnahmen[datei] === undefined) probleme.push(`${datei} ruft useSyncExternalStore auf und steht weder in GEPRUEFT noch in AUSNAHMEN`)
    if (teile !== undefined && ausnahmen[datei] !== undefined) probleme.push(`${datei} steht in GEPRUEFT und in AUSNAHMEN`)
    if (teile !== undefined && anzahl > teile.length) probleme.push(`${datei} ruft useSyncExternalStore ${anzahl}-mal auf, GEPRUEFT nennt nur ${teile.length} Teil(e)`)
  }
  for (const datei of [...Object.keys(gepruefit), ...Object.keys(ausnahmen)]) {
    if (!funde.has(datei)) probleme.push(`${datei} steht in der Liste, ruft useSyncExternalStore aber nicht mehr auf`)
  }
  for (const [datei, grund] of Object.entries(ausnahmen)) if (grund.trim() === '') probleme.push(`${datei} steht in AUSNAHMEN ohne Grund`)
  for (const [datei, teile] of Object.entries(gepruefit)) if (teile.length === 0) probleme.push(`${datei} steht in GEPRUEFT ohne ein Teil`)
  return probleme
}

/**
 * Die Hydrier-Fälle einer Testdatei: jeder `it`, der `pruefeHydrieren` oder `hydriere` aufruft, mit den Namen, die er benutzt —
 * im Rumpf des `it` und in den Hilfen (Bauteile, Konstanten), die das umgebende `describe` neben seinen Fällen deklariert.
 * Importe zählen nicht: Ein Teil, das nur importiert wird, hat noch keinen Fall.
 */
function hydrierFaelle(text: string): Array<{ titel: string; namen: Set<string> }> {
  const datei = quellDatei(text, 'tests/hydrieren.test.ts')
  const namenIn = (knoten: ts.Node): Set<string> => {
    const namen = new Set<string>()
    const besuche = (k: ts.Node): void => {
      if (ts.isIdentifier(k)) namen.add(k.text)
      ts.forEachChild(k, besuche)
    }
    besuche(knoten)
    return namen
  }
  const istAufruf = (k: ts.Node, name: string): k is ts.CallExpression => ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === name
  const faelle: Array<{ titel: string; namen: Set<string> }> = []
  const besuche = (k: ts.Node): void => {
    if (istAufruf(k, 'it') && k.arguments.some((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a))) {
      const namen = namenIn(k)
      if (namen.has('pruefeHydrieren') || namen.has('hydriere')) {
        for (let eltern = k.parent; eltern; eltern = eltern.parent) {
          if (!ts.isBlock(eltern) || !ts.isArrowFunction(eltern.parent) || !istAufruf(eltern.parent.parent, 'describe')) continue
          for (const anweisung of eltern.statements) {
            if (ts.isVariableStatement(anweisung) || ts.isFunctionDeclaration(anweisung)) for (const n of namenIn(anweisung)) namen.add(n)
          }
        }
        const titel = k.arguments[0] && ts.isStringLiteralLike(k.arguments[0]) ? k.arguments[0].text : '(Titel zur Laufzeit)'
        faelle.push({ titel, namen })
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return faelle
}

/** Zu welchen Teilen der Liste es in der Testdatei keinen Hydrier-Fall gibt. */
function fehlendeFaelle(testText: string, gepruefit: Record<string, string[]>): string[] {
  const faelle = hydrierFaelle(testText)
  return Object.entries(gepruefit).flatMap(([datei, teile]) =>
    teile.filter((teil) => !faelle.some((fall) => fall.namen.has(teil))).map((teil) => `${teil} (${datei}) hat keinen Hydrier-Fall`),
  )
}

/** Weniger Fälle als Dateien der Liste kann es nicht geben — sonst hätte die Suche nach den Fällen nichts gefunden. */
const GEPRUEFT_MINDESTENS_FAELLE = Object.keys(GEPRUEFT).length

describe('Hydrieren – jede Datei mit useSyncExternalStore ist geprüft', () => {
  it('jede Datei unter src/ mit useSyncExternalStore steht in GEPRUEFT oder, mit Grund, in AUSNAHMEN', () => {
    // Liest jede Datei unter src/ (TESTING_GUIDELINES §4: Zeitgrenze 30_000 an genau diesem it).
    const funde = leseStoreDateien()
    // Nicht blind: Die Wache sieht die Dateien der Liste und kein Dutzend mehr.
    expect(funde.size).toBeGreaterThanOrEqual(12)
    expect(listenProbleme(funde, GEPRUEFT, AUSNAHMEN)).toEqual([])
  }, 30_000)

  it('zu jedem Teil der Liste gibt es in dieser Datei einen Fall, der es hydriert', () => {
    const text = readFileSync(join(process.cwd(), 'tests', 'hydrieren.test.ts'), 'utf8')
    expect(hydrierFaelle(text).length).toBeGreaterThanOrEqual(GEPRUEFT_MINDESTENS_FAELLE)
    expect(fehlendeFaelle(text, GEPRUEFT)).toEqual([])
  })
})

describe('Hydrieren – Gegenprobe: die Liste schlägt an', () => {
  const eine = (datei: string, anzahl = 1): Map<string, number> => new Map([[datei, anzahl]])

  it('eine neue Datei mit useSyncExternalStore ohne Eintrag macht die Wache rot', () => {
    expect(listenProbleme(eine('src/lib/neu.ts'), {}, {})).toEqual(['src/lib/neu.ts ruft useSyncExternalStore auf und steht weder in GEPRUEFT noch in AUSNAHMEN'])
  })

  it('zählt Aufrufe, nicht Importe und Kommentare', () => {
    expect(zaehleStore("import { useSyncExternalStore } from 'react'\nexport const a = () => useSyncExternalStore(x, y, z)", 'src/lib/a.ts')).toBe(1)
    expect(zaehleStore("import { useSyncExternalStore } from 'react'\n// useSyncExternalStore liefert den Server-Wert\nexport const a = 1", 'src/lib/a.ts')).toBe(0)
    expect(zaehleStore("export const a = () => React.useSyncExternalStore(x, y, z)\nexport const b = () => useSyncExternalStore(x, y, z)", 'src/lib/a.ts')).toBe(2)
    expect(zaehleStore("export const text = 'useSyncExternalStore'", 'src/lib/a.ts')).toBe(0)
  })

  it('ein Eintrag in GEPRUEFT oder mit Grund in AUSNAHMEN genügt', () => {
    expect(listenProbleme(eine('src/lib/neu.ts'), { 'src/lib/neu.ts': ['useNeu'] }, {})).toEqual([])
    expect(listenProbleme(eine('src/lib/neu.ts'), {}, { 'src/lib/neu.ts': 'Das Teil braucht einen Browser, den jsdom nicht hat.' })).toEqual([])
  })

  it('schlägt an bei einem Eintrag ohne Grund, ohne Teil, in beiden Listen, bei veraltetem Eintrag und bei zu wenigen Teilen', () => {
    expect(listenProbleme(eine('src/lib/neu.ts'), {}, { 'src/lib/neu.ts': ' ' })).toEqual(['src/lib/neu.ts steht in AUSNAHMEN ohne Grund'])
    expect(listenProbleme(eine('src/lib/neu.ts'), { 'src/lib/neu.ts': [] }, {})).toContain('src/lib/neu.ts steht in GEPRUEFT ohne ein Teil')
    expect(listenProbleme(eine('src/lib/neu.ts'), { 'src/lib/neu.ts': ['useNeu'] }, { 'src/lib/neu.ts': 'Grund' })).toEqual(['src/lib/neu.ts steht in GEPRUEFT und in AUSNAHMEN'])
    expect(listenProbleme(new Map(), { 'src/lib/alt.ts': ['useAlt'] }, {})).toEqual(['src/lib/alt.ts steht in der Liste, ruft useSyncExternalStore aber nicht mehr auf'])
    expect(listenProbleme(eine('src/lib/zwei.ts', 2), { 'src/lib/zwei.ts': ['useEins'] }, {})).toEqual(['src/lib/zwei.ts ruft useSyncExternalStore 2-mal auf, GEPRUEFT nennt nur 1 Teil(e)'])
  })

  it('ein Teil ohne Fall schlägt an: nur importiert, nur gerendert ohne Hydrieren, oder gar nicht benutzt', () => {
    const liste = { 'src/lib/neu.ts': ['useNeu'] }
    const kopf = "import { pruefeHydrieren } from './hydrieren-hilfe'\nimport { useNeu } from '@/lib/neu'\n"
    expect(fehlendeFaelle(kopf, liste)).toHaveLength(1)
    expect(fehlendeFaelle(`${kopf}describe('x', () => { it('rendert', () => { useNeu() }) })`, liste)).toHaveLength(1)
    expect(fehlendeFaelle(`${kopf}describe('x', () => { it('hydriert', async () => { await pruefeHydrieren(a) }) })`, liste)).toHaveLength(1)
    expect(fehlendeFaelle(`${kopf}describe('x', () => { it('hydriert', async () => { function T() { return useNeu() } await pruefeHydrieren(a) }) })`, liste)).toEqual([])
  })

  it('ein Teil mit Fall besteht: im it selbst, in einer Hilfe des describe, mit hydriere statt pruefeHydrieren', () => {
    const liste = { 'src/lib/neu.ts': ['useNeu', 'Anzeige'] }
    const faelle = [
      "describe('a', () => {",
      "  function Bauteil() { return useNeu() }",
      "  it('hydriert den Hook', async () => { await pruefeHydrieren(createElement(Bauteil)) })",
      "  it('hydriert die Anzeige', async () => { await hydriere(createElement(Anzeige)) })",
      '})',
    ].join('\n')
    expect(fehlendeFaelle(faelle, liste)).toEqual([])
  })
})
