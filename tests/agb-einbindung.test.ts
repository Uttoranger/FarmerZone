/**
 * Die AGB werden eingebunden (Register O4, geändert 13.10.2026, Nr. 90) —
 * mit einem Satz und einem Link, nie mit einem Haken.
 *
 * Beweist, gerendert und mit Gegenprobe:
 *  - Kasse: Unter dem Kaufknopf steht „Es gelten die AGB von <Name>. Dein
 *    Vertragspartner ist der Hof. Mit dem Bestellen stimmst du zu, dass <Name>
 *    die Vermittlung sofort ausführt." mit Link auf /agb in neuem Tab — online
 *    wie bar, ohne Haken, in derselben festen Leiste wie der Knopf.
 *  - Fußzeile der Startseite: „AGB" steht vor „Impressum".
 *  - Bestellbestätigung per Mail: eine Zeile mit Link auf /agb, absolut.
 *  - /hoefe: der Satz zur Reihenfolge steht unter der Liste, nie über einer
 *    leeren, in beiden Ansichten mit Liste.
 *  - Registrierung: die Sätze kommen aus der einen Quelle (der Satz im
 *    gerenderten Formular: tests/registrieren-formular.test.ts).
 *  - Alle Texte stammen aus src/lib/rechtstexte/agb-einbindung.ts; die AGB
 *    selbst (agb.ts) laden Registrierung und Kasse nicht ins Browserpaket.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Die Adresse der Hofübersicht, je Test gesetzt: leer = alle Höfe.
const adresse = vi.hoisted(() => ({ suche: '' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test/checkout',
  useSearchParams: () => new URLSearchParams(adresse.suche),
}))
// /hoefe liest seine Filter im Browser aus der Adresse (Register N19) — hier der Stand nach der Hydration.
vi.mock('@/components/hoefe/use-hoefe-adresse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/hoefe/use-hoefe-adresse')>()),
  useHoefeAdresse: () => (adresse.suche ? `?${adresse.suche}` : ''),
}))
// Die Karte lädt erst im Browser (Leaflet) — hier ohne.
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; onNavigate?: unknown; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
// Stripes Zahlungsfeld (im Bündel der Kasse) braucht ein DOM — hier nur Hülle.
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children?: ReactNode }) => children,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}))
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))

import { KassenAbschluss } from '@/components/checkout/checkout-form'
import { StartseiteFuss } from '@/components/startseite/startseite-abschnitte'
import { KundeFuss } from '@/components/shells/kunde-fuss'
import { HoefeClient } from '@/components/hoefe/hoefe-client'
import { SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'
import type { HofUebersichtEintrag } from '@/server/queries/farm'
import { OrderConfirmationEmail } from '@/emails/order-confirmation'
import { AgbSatz } from '@/components/rechtstexte/agb-stuecke'
import {
  AGB_LINK_TEXT,
  AGB_PFAD,
  KASSE_AGB_SATZ,
  KASSE_AGB_SATZ_HOFPREIS,
  MAIL_AGB_ZEILE,
  kasseAgbSatz,
  REGISTRIERUNG_AGB_SATZ,
  REIHENFOLGE_HINWEIS,
} from '@/lib/rechtstexte/agb-einbindung'
import type { AngabenHof } from '@/components/checkout/angaben-zum-hof'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'
import { MARKE } from '@/lib/marke'

const WURZEL = process.cwd()
const lies = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')

const HOF: AngabenHof = {
  name: 'Hof Test',
  ownerName: 'Erika Muster',
  address: 'Musterweg 1',
  postalCode: '4900',
  city: 'Musterdorf',
  phone: '+43 660 0000000',
  email: 'hof@example.com',
}

describe('Kasse: der Satz unter dem Kaufknopf', () => {
  const abschluss = (online: boolean): string =>
    renderToStaticMarkup(
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

  // Ein neuer Tab trägt rel: Die geöffnete Seite kommt weder an window.opener noch erfährt sie den Referrer.
  const SATZ = `Es gelten die <a href="/agb" target="_blank" rel="noopener noreferrer"`

  for (const [art, knopf] of [
    ['online', 'Weiter zur Zahlung · € 14,91'],
    ['bar', '>Zahlungspflichtig bestellen</button>'],
  ] as const) {
    it(`${art}: der Satz mit Link auf die AGB steht nach dem Knopf „${knopf}", in derselben festen Leiste`, () => {
      const html = abschluss(art === 'online')
      expect(html).toContain(SATZ)
      expect(html).toContain(`>${AGB_LINK_TEXT}</a> von ${MARKE}. Dein Vertragspartner ist der Hof. Mit dem Bestellen stimmst du zu, dass ${MARKE} die Vermittlung sofort ausführt.`)
      expect(html.indexOf(knopf)).toBeGreaterThan(-1)
      expect(html.indexOf(knopf)).toBeLessThan(html.indexOf('Es gelten die'))
      // Dieselbe Leiste: Zwischen Knopf und Satz schließt kein <div> mit data-unten-fest, und der Satz steht vor ihrem Ende.
      const leiste = html.slice(html.indexOf('data-unten-fest'))
      expect(leiste).toContain('Es gelten die')
    })
  }

  it('kein Haken: die Zustimmung ist der Knopf, nicht ein Feld', () => {
    const html = abschluss(true)
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain('role="checkbox"')
  })

  it('Gegenprobe: ohne die Zeile in KassenAbschluss fände die Suche den Satz nicht', () => {
    const quelle = lies('src/components/checkout/checkout-form.tsx')
    const abschlussQuelle = quelle.slice(quelle.indexOf('export function KassenAbschluss'))
    // Seit N45 je Modell: kasseAgbSatz wählt zwischen KASSE_AGB_SATZ und KASSE_AGB_SATZ_HOFPREIS.
    expect(abschlussQuelle).toContain('<AgbSatz stuecke={kasseAgbSatz({ hofpreis, agbPfad })}')
    // Der Satz steht nur dort, nicht noch einmal im Formular.
    expect(quelle.match(/kasseAgbSatz\(/g)).toHaveLength(1)
    expect(quelle).not.toMatch(/KASSE_AGB_SATZ/)
    expect(abschluss(true).match(/Es gelten die/g)).toHaveLength(1)
  })
})

// Seit Nr. 120 (Register N22) trägt der Seitenfuß der KundeShell den AGB-Link —
// „AGB-Link in jeder Fußzeile" (O4); die Reihenfolge ist die des Boards.
describe('Seitenfuß: Impressum, Datenschutz, AGB, Problem melden', () => {
  it('der Link auf /agb steht im Seitenfuß, in „Rechtliches", nach Impressum und Datenschutz', () => {
    const html = renderToStaticMarkup(createElement(KundeFuss))
    const rechtlich = html.slice(html.indexOf('aria-label="Rechtliches"'))
    const agb = rechtlich.indexOf(`href="${AGB_PFAD}"`)
    expect(agb).toBeGreaterThan(-1)
    expect(rechtlich.indexOf('href="/impressum"')).toBeLessThan(rechtlich.indexOf('href="/datenschutz"'))
    expect(rechtlich.indexOf('href="/datenschutz"')).toBeLessThan(agb)
    expect(agb).toBeLessThan(rechtlich.indexOf('href="/problem-melden"'))
    expect(html).toContain(`>${AGB_LINK_TEXT}</a>`)
  })

  it('die Startseite führt die AGB nicht noch einmal — ihr Fuß steht über dem Seitenfuß (Gegenprobe)', () => {
    const html = renderToStaticMarkup(createElement(StartseiteFuss, { jahr: 2026 }))
    expect(html).not.toContain(`href="${AGB_PFAD}"`)
    expect(renderToStaticMarkup(createElement(KundeFuss))).toContain(`href="${AGB_PFAD}"`)
  })

  // Nr. 127 (Register N22, Ergänzung): Der Fuß der Startseite ist am Computer verborgen — die AGB bleiben
  // dort trotzdem erreichbar, weil der Seitenfuß sie führt und nie verborgen ist; am Handy gilt dasselbe
  // (der Seitenfuß steht unter dem Fuß der Startseite). In JEDEM sichtbaren Fuß ist der Weg zu den AGB da.
  it('die AGB sind in jedem Fuß erreichbar: am Computer im Seitenfuß, am Handy im Seitenfuß unter dem Fuß der Startseite', () => {
    const fuss = renderToStaticMarkup(createElement(KundeFuss))
    expect(fuss).toContain(`href="${AGB_PFAD}"`)
    const klassen = (markup: string) => markup.match(/<footer[^>]*class="([^"]*)"/)?.[1].split(/\s+/) ?? []
    // Lauf 31: die Linie am Handy am Fuß selbst, im Browser an der Spalte des Inhalts darin (Boards w1-bestaetigung u. a.).
    expect(klassen(fuss)).toContain('max-md:border-t')
    expect(fuss).toMatch(/class="[^"]*\bmd:border-t\b[^"]*"/)
    expect(klassen(fuss)).not.toContain('hidden')
    expect(klassen(fuss)).not.toContain('md:hidden')
    // Gegenprobe: Der Fuß der Startseite ist ab md verborgen und führt die AGB nicht — sie hängen allein am Seitenfuß.
    const startseite = renderToStaticMarkup(createElement(StartseiteFuss, { jahr: 2026 }))
    expect(klassen(startseite)).toContain('md:hidden')
    expect(startseite).not.toContain(`href="${AGB_PFAD}"`)
  })
})

describe('Bestellbestätigung per Mail: eine Zeile mit Link auf die AGB', () => {
  const props = {
    orderNumber: 'HT-0210-A4F2',
    farmName: 'Hof Test',
    farmPhone: '+43 660 0000000',
    farmAddress: 'Musterweg 1',
    farmCity: 'Musterdorf',
    pickupDate: 'Sa, 10. Okt',
    pickupTime: '15:00–18:00',
    zahlart: 'online' as const,
    items: [{ name: 'Karotten', betrag: 4.5 }],
    total: 4.5,
    routeUrl: 'https://maps.example/route',
  }

  async function render(element: Parameters<typeof import('@react-email/render').render>[0]): Promise<string> {
    return (await import('@react-email/render')).render(element)
  }

  async function mail(extra: { appUrl?: string } = {}): Promise<string> {
    return render(createElement(OrderConfirmationEmail, { ...props, ...extra }))
  }

  it('der Link ist absolut und führt auf die AGB der echten Seite — in der Fassung der Bestellung (ohne Angabe 0.9, N45)', async () => {
    const html = await mail()
    expect(html).toContain(`href="${PRODUKTION_ADRESSE}${AGB_PFAD}/0.9"`)
    const hofpreis = await render(createElement(OrderConfirmationEmail, { ...props, agbFassung: '1.0' }))
    expect(hofpreis).toContain(`href="${PRODUKTION_ADRESSE}${AGB_PFAD}/1.0"`)
    expect(hofpreis).not.toContain(`${AGB_PFAD}/0.9"`)
    expect(html).toContain(`Es gelten die <a`)
    expect(html).toContain(`von ${MARKE}. Du findest sie auch als Datei im Anhang dieser E-Mail und kannst sie jederzeit nachlesen, speichern und ausdrucken.`)
  })

  it('eine übergebene Adresse gilt für den Link — Gegenprobe zur echten Seite', async () => {
    const html = await mail({ appUrl: 'https://vorschau.example' })
    expect(html).toContain(`href="https://vorschau.example${AGB_PFAD}/0.9"`)
    expect(html).not.toContain(`href="${PRODUKTION_ADRESSE}${AGB_PFAD}/0.9"`)
  }, 30_000)

  it('der Satz bleibt zusammenhängend: kein Kommentar zwischen „Es gelten die" und dem Link', async () => {
    const html = await mail()
    expect(html).toMatch(/Es gelten die <a [^>]*>AGB<\/a> von /)
  })
})

describe('/hoefe: der Satz zur Reihenfolge über der Liste (Board w1-/s1-hoefe, Nr. 234)', () => {
  const quelle = lies('src/components/hoefe/hoefe-client.tsx')

  const hof = (slug: string): HofUebersichtEintrag => ({
    slug,
    name: `Hof ${slug}`,
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

  const uebersicht = (suche = ''): string => {
    adresse.suche = suche
    return renderToStaticMarkup(createElement(HoefeClient, { hoefe: [hof('a'), hof('b')], jetzt: '2026-10-21T08:00:00.000Z' }))
  }

  it('der Wortlaut ist der aus der Freigabe (§ 4a Abs. 1 Z 1 FAGG)', () => {
    expect(REIHENFOLGE_HINWEIS).toBe('Reihenfolge: nach Entfernung zum gewählten Ort, sonst nach Freischaltung. Keine bezahlte Platzierung.')
  })

  it('mit Höfen steht der Satz genau einmal da — direkt über der Liste, wo man die Höfe liest', () => {
    const html = uebersicht()
    expect(html.match(new RegExp(REIHENFOLGE_HINWEIS, 'g'))).toHaveLength(1)
    expect(html.indexOf('aria-label="Höfe"')).toBeGreaterThan(-1)
    expect(html.indexOf(REIHENFOLGE_HINWEIS)).toBeLessThan(html.indexOf('aria-label="Höfe"'))
    // Zwischen Satz und Liste steht nichts mehr (keine Karten-Vorschau, kein Filter).
    expect(html.slice(html.indexOf(REIHENFOLGE_HINWEIS), html.indexOf('aria-label="Höfe"'))).not.toMatch(/<a |<button/)
  })

  it('Gegenprobe: ohne Treffer gibt es keine Liste und keinen Satz', () => {
    const html = uebersicht(`${SUCHTEXT_PARAMETER}=gibtesnirgends`)
    expect(html).not.toContain('aria-label="Höfe"')
    expect(html).not.toContain(REIHENFOLGE_HINWEIS)
  })

  it('im Browser (ab 1024 px) steht er über der Liste im linken Teil; der Kartenmodus am Handy hat keine Liste und keinen Satz', () => {
    // Der Server rendert die schmale Gestalt; den Splitscreen sieht erst der Browser — darum am Quelltext.
    expect(quelle).toMatch(/\{reihenfolgeHinweis\}\s+\{ergebnisse\(true\)\}/)
    // Ohne Breiten- oder Suchbedingung: Die Pflichtangabe weicht auch bei der Produktsuche am Handy nicht.
    expect(quelle).toMatch(/\{anzahl > 0 && <p className="text-\[13px\] text-muted-foreground">\{REIHENFOLGE_HINWEIS\}<\/p>\}/)
    // Splitscreen, Karte im Browser und Liste am Handy — der Kartenmodus am Handy nicht.
    expect(quelle.match(/\{reihenfolgeHinweis\}/g)).toHaveLength(3)
    // Gegenprobe: Ohne die Zeile fände die Suche den Satz nicht.
    expect(quelle.replace(/\{reihenfolgeHinweis\}\s+\{ergebnisse\(true\)\}/, '')).not.toMatch(/\{reihenfolgeHinweis\}\s+\{ergebnisse\(true\)\}/)
  })
})

describe('Die Sätze: eine Quelle', () => {
  const html = (stuecke: Parameters<typeof AgbSatz>[0]['stuecke'], neuerTab = false): string =>
    renderToStaticMarkup(createElement(AgbSatz, { stuecke, neuerTab }))

  it('Registrierung: AGB und Konditionen für Höfe, beide als Link in neuem Tab', () => {
    expect(html(REGISTRIERUNG_AGB_SATZ, true)).toMatch(
      /^<p>Mit der Registrierung stimmst du den <a href="\/agb" target="_blank" rel="noopener noreferrer"[^>]*>AGB<\/a> und den <a href="\/konditionen" target="_blank" rel="noopener noreferrer"[^>]*>Konditionen für Höfe<\/a> zu\.<\/p>$/
    )
    // Gegenprobe: Ohne neuen Tab fehlen target und rel.
    expect(html(REGISTRIERUNG_AGB_SATZ)).not.toContain('target=')
    expect(html(REGISTRIERUNG_AGB_SATZ)).not.toContain('rel=')
  })

  it('Kasse und Mail nennen den Namen nur über MARKE — und den Hof als Vertragspartner', () => {
    expect(KASSE_AGB_SATZ.filter((s) => typeof s === 'string').join('')).toContain(`von ${MARKE}.`)
    expect(KASSE_AGB_SATZ.filter((s) => typeof s === 'string').join('')).toContain('Dein Vertragspartner ist der Hof.')
    expect(MAIL_AGB_ZEILE('0.9').filter((s) => typeof s === 'string').join('')).toContain(`von ${MARKE}.`)
    expect(KASSE_AGB_SATZ_HOFPREIS.filter((s) => typeof s === 'string').join('')).toBe(`Es gelten die  von ${MARKE}. Dein Vertragspartner ist der Hof.`)
    const links = [...REGISTRIERUNG_AGB_SATZ, ...KASSE_AGB_SATZ, ...KASSE_AGB_SATZ_HOFPREIS, ...MAIL_AGB_ZEILE('0.9'), ...MAIL_AGB_ZEILE('1.0')].filter((s) => typeof s !== 'string')
    // N45: Die Mail verlinkt die Fassung der Bestellung, die Kasse /agb.
    expect(links.map((l) => l.ziel)).toEqual(['/agb', '/konditionen', '/agb', '/agb', '/agb/0.9', '/agb/1.0'])
  })

  it('N45: kasseAgbSatz — je Modell der Satz, das Ziel des Links frei; kein Wort ändert sich mit dem Ziel', () => {
    expect(kasseAgbSatz({ hofpreis: false, agbPfad: '/agb' })).toEqual(KASSE_AGB_SATZ)
    expect(kasseAgbSatz({ hofpreis: true, agbPfad: '/agb' })).toEqual(KASSE_AGB_SATZ_HOFPREIS)
    const zuONeun = kasseAgbSatz({ hofpreis: false, agbPfad: '/agb/0.9' })
    expect(zuONeun.filter((s) => typeof s !== 'string').map((l) => l.ziel)).toEqual(['/agb/0.9'])
    expect(zuONeun.filter((s) => typeof s === 'string')).toEqual(KASSE_AGB_SATZ.filter((s) => typeof s === 'string'))
    // Gegenprobe: Der Satz im Modell „bisher“ nennt die Vermittlung, der im Hofpreis-Modell nicht.
    expect(KASSE_AGB_SATZ.join('')).toContain('Vermittlung')
    expect(KASSE_AGB_SATZ_HOFPREIS.filter((s) => typeof s === 'string').join('')).not.toContain('Vermittlung')
  })

  it('Registrierung und Kasse laden nicht die ganzen AGB ins Browserpaket', () => {
    for (const datei of [
      'src/lib/rechtstexte/agb-einbindung.ts',
      'src/lib/rechtstexte/stuecke.ts',
      'src/components/rechtstexte/agb-stuecke.tsx',
      'src/app/(auth)/register/register-form.tsx',
      'src/components/checkout/checkout-form.tsx',
    ]) {
      expect(lies(datei), datei).not.toMatch(/from '@\/lib\/rechtstexte\/agb'/)
    }
    for (const datei of ['src/components/checkout/checkout-form.tsx', 'src/lib/rechtstexte/agb-fassung.ts']) {
      expect(lies(datei), datei).not.toMatch(/from '@\/lib\/rechtstexte\/agb(-0-9|-texte|-datei)?'/)
    }
    // Gegenprobe: Die Seite lädt den Text (über agb-texte.ts, N45).
    expect(lies('src/app/(public)/agb/page.tsx')).toMatch(/from '@\/lib\/rechtstexte\/agb-texte'/)
  })

  it('die Registrierung bindet den Satz aus der Quelle ein', () => {
    const quelle = lies('src/app/(auth)/register/register-form.tsx')
    expect(quelle).toContain('<AgbSatz stuecke={REGISTRIERUNG_AGB_SATZ} neuerTab')
  })
})
