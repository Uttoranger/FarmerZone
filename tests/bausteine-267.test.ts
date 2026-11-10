/**
 * Render-Tests der Kunden-Bausteine aus Nr. 267 (Lauf 33; Liste „Board oder Code“ §3.2 G10 und G11, Abnahme Lauf 32).
 *
 * Beweist:
 *  - G11: Der Seitenfuß steht im Browser in der Spalte der Seite — EINE Quelle, die Zuordnung Route → Spalte
 *    (spalteDerSeite); je Spaltenart ein Render-Test der KundeShell, mit Gegenprobe, dass die 1200 px nur noch die
 *    breiten Seiten tragen. Jede Seite in der KundeShell steht in der Liste (oder ist Hof-/Produktseite).
 *  - G11: „Vertrag widerrufen“ steht in derselben Liste wie die übrigen Rechtslinks, und die Liste bricht
 *    linksbündig um (keine Ausrichtung nach rechts mehr); in der KundeFokusShell steht die Zeile in der Spalte der Route.
 *  - Die drei früheren Aufrufer von `fussSpalte` geben keine Spalte mehr mit.
 *  - G10: Die Tasche des Warenkorbs ist in Unterleiste und Handy-Kopf so groß wie im Board (16 px statt 24 bzw. 20 px).
 *  - Hof- und Admin-Unterleiste sind Zeichen für Zeichen dieselben wie vor Nr. 267 (Markup-Vergleich mit dem
 *    Stand der Basis, tests/fixtures/unterleiste-hof.html und -admin.html).
 *  - Die Vorschau /intern/bausteine hängt vorschau-267.tsx ein.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pfad = { aktuell: '/hoefe' }
vi.mock('next/navigation', () => ({ usePathname: () => pfad.aktuell, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))
// Der Korb liegt im Browser (localStorage); hier steht er fest — die Shell zeichnet nur, was der Hook sagt.
const korb: { aktuell: { anzahl: number; href: string } | null } = { aktuell: null }
vi.mock('@/lib/use-warenkorb-kopf', () => ({ useWarenkorbKopf: () => korb.aktuell }))

import { KundeFokusShell, KundeShell, type KundeFokusShellProps, type KundeShellProps } from '@/components/shells/kunde-shell'
import { KundeFuss } from '@/components/shells/kunde-fuss'
import { HofShell } from '@/components/shells/hof-shell'
import { AdminShell } from '@/components/shells/admin-shell'
import { SEITENFUSS, SPALTE_JE_ROUTE, spalteDerSeite, type FussSpalte, type KundenNavId } from '@/lib/kunden-navigation'
import { WIDERRUF_TEXT } from '@/lib/widerruf'

const quelle = (datei: string): string => readFileSync(join(process.cwd(), datei), 'utf8')

/** Die Klasse der Spalte je Art, wie der Fuß sie zeichnet (kunde-fuss.tsx). */
const SPALTE_KLASSE: Record<FussSpalte, string> = {
  schmal: 'md:max-w-[552px]',
  mittel: 'md:max-w-[928px]',
  seite: 'md:max-w-[1032px]',
  breit: 'md:max-w-[1200px]',
}

function kundeShell(route: string, props: Partial<Omit<KundeShellProps, 'children'>> = {}): string {
  pfad.aktuell = route
  const Shell = KundeShell as unknown as ComponentType<Omit<KundeShellProps, 'children'>>
  return renderToStaticMarkup(createElement(Shell, { sitzung: 'gast', ...props }, createElement('p', null, 'Inhalt')))
}

function fokusShell(route: string, props: Partial<Omit<KundeFokusShellProps, 'children'>> = {}): string {
  pfad.aktuell = route
  const Shell = KundeFokusShell as unknown as ComponentType<Omit<KundeFokusShellProps, 'children'>>
  return renderToStaticMarkup(
    createElement(Shell, { titel: 'Passwort vergessen', zurueck: { href: '/login', label: 'Zurück zur Anmeldung' }, ...props }, createElement('p', null, 'Inhalt'))
  )
}

function abschnitt(html: string, von: string, bis: string): string {
  const start = html.indexOf(von)
  expect(start, von).toBeGreaterThanOrEqual(0)
  return html.slice(start, html.indexOf(bis, start) + bis.length)
}

/** Die Klassen der Spalte im Fuß (das erste `div` darin). */
function fussSpalteKlassen(html: string): string[] {
  const fuss = abschnitt(html, '<footer data-slot="seitenfuss"', '</footer>')
  return /<div class="([^"]*)"/.exec(fuss)?.[1].split(/\s+/) ?? []
}

/** Die Klassen des Absatzes um „Vertrag widerrufen“ in der Fokus-Shell. */
function widerrufZeileKlassen(html: string): string[] {
  const ende = html.indexOf(`>${WIDERRUF_TEXT.fussLink}</a>`)
  expect(ende).toBeGreaterThanOrEqual(0)
  const davor = html.slice(0, ende)
  return /<p class="([^"]*)">[^]*$/.exec(davor.slice(davor.lastIndexOf('<p class=')))?.[1].split(/\s+/) ?? []
}

describe('G11 – Spalte je Route (spalteDerSeite)', () => {
  it.each([
    ['/bestellungen', 'schmal'],
    ['/forgot-password', 'schmal'],
    ['/reset-password', 'schmal'],
    ['/account/neuigkeiten-bestaetigen', 'schmal'],
    ['/login', 'mittel'],
    ['/login/admin', 'mittel'],
    ['/account/login', 'mittel'],
    ['/register', 'mittel'],
    ['/hof-mueller/bestellung/abc', 'mittel'],
    ['/hof-mueller/confirm/abc', 'mittel'],
    ['/account/profile', 'seite'],
    ['/account/unsubscribe', 'seite'],
    ['/konto/email-bestaetigen', 'seite'],
    ['/sicherheit/nicht-ich', 'seite'],
    ['/widerruf', 'seite'],
    ['/agb', 'seite'],
    ['/agb/2026-10', 'seite'],
    ['/datenschutz', 'seite'],
    ['/impressum', 'seite'],
    ['/konditionen', 'seite'],
    ['/problem-melden', 'seite'],
    ['/', 'breit'],
    ['/hoefe', 'breit'],
    ['/fuer-hoefe', 'breit'],
  ] as const)('%s steht in der Spalte „%s“', (route, spalte) => {
    expect(spalteDerSeite(route)).toBe(spalte)
  })

  it('Hof- und Produktseite (aktiv = entdecken) stehen breit; dieselbe Adresse ohne aktiv ist unbekannt (404 eines Hofs)', () => {
    expect(spalteDerSeite('/hof-mueller', 'entdecken')).toBe('breit')
    expect(spalteDerSeite('/hof-mueller/produkt/abc', 'entdecken')).toBe('breit')
    expect(spalteDerSeite('/hof-mueller')).toBeNull()
  })

  it('Gegenprobe: ein Muster passt Segment für Segment — kein Anfang, kein Unterpfad ohne `/**`', () => {
    expect(spalteDerSeite('/impressumx')).toBeNull()
    expect(spalteDerSeite('/impressum/alt')).toBeNull()
    expect(spalteDerSeite('/hof-mueller/bestellung')).toBeNull()
    expect(spalteDerSeite('/hof-mueller/bestellung/abc/mehr')).toBeNull()
    expect(spalteDerSeite(null)).toBeNull()
  })

  it('jede Seite in der KundeShell steht in der Liste, außer Hof- und Produktseite (aktiv); Gegenprobe: eine erfundene fehlt', () => {
    const app = join(process.cwd(), 'src', 'app')
    const seiten: string[] = []
    const lauf = (ordner: string): void => {
      for (const name of readdirSync(ordner)) {
        const voll = join(ordner, name)
        if (statSync(voll).isDirectory()) lauf(voll)
        else if (name === 'page.tsx' && /KundeShellMitSitzung|<KundeShell\b/.test(readFileSync(voll, 'utf8'))) seiten.push(voll)
      }
    }
    lauf(app)
    // Route aus dem Dateipfad: Gruppen `(…)` fallen weg, `[…]` wird ein Beispielsegment.
    const routen = seiten.map(
      (datei) =>
        '/' +
        relative(app, datei)
          .split(sep)
          .slice(0, -1)
          .filter((teil) => !/^\(.*\)$/.test(teil))
          .map((teil) => (/^\[.*\]$/.test(teil) ? 'beispiel' : teil))
          .join('/')
    )
    expect(routen.length).toBeGreaterThan(15)
    const ueberAktiv = new Set(['/beispiel', '/beispiel/produkt/beispiel'])
    const ohne = routen.filter((r) => !ueberAktiv.has(r) && spalteDerSeite(r) === null)
    expect(ohne).toEqual([])
    expect(spalteDerSeite('/neue-seite-ohne-eintrag')).toBeNull()
  })

  it('in der Liste steht jede Spaltenart, jedes Muster nur einmal', () => {
    const muster = SPALTE_JE_ROUTE.map(([m]) => m)
    expect(new Set(muster).size).toBe(muster.length)
    expect(new Set(SPALTE_JE_ROUTE.map(([, s]) => s))).toEqual(new Set(['schmal', 'mittel', 'seite', 'breit']))
  })
})

describe('G11 – der Seitenfuß der KundeShell in der Spalte der Seite (je Spaltenart)', () => {
  it.each([
    ['/bestellungen', undefined, 'schmal'],
    ['/login', undefined, 'mittel'],
    ['/impressum', undefined, 'seite'],
    ['/gibt-es-nicht', undefined, 'seite'],
    ['/hoefe', undefined, 'breit'],
    ['/hof-mueller', 'entdecken', 'breit'],
  ] as const)('%s (aktiv %s): Fuß in der Spalte „%s“', (route, aktiv, spalte) => {
    const html = kundeShell(route, aktiv ? { aktiv: aktiv as KundenNavId } : {})
    expect(html).toContain(`data-spalte="${spalte}"`)
    const klassen = fussSpalteKlassen(html)
    expect(klassen).toContain(SPALTE_KLASSE[spalte])
    // Gegenprobe: genau eine Breite, und die 1200 px nur bei den breiten Seiten.
    expect(klassen.filter((k) => /max-w-/.test(k))).toEqual([SPALTE_KLASSE[spalte]])
    if (spalte !== 'breit') expect(klassen).not.toContain('max-w-[1200px]')
  })

  it('am Handy gilt keine Spalte: jede Breite erst ab md, der Rand am Handy 16 px wie bisher', () => {
    for (const route of ['/bestellungen', '/login', '/impressum', '/hoefe']) {
      const klassen = fussSpalteKlassen(kundeShell(route))
      expect(klassen.filter((k) => k.includes('max-w-')).every((k) => k.startsWith('md:'))).toBe(true)
      expect(klassen).toContain('px-4')
    }
  })

  it('der Fuß ohne Angabe steht breit wie vor Nr. 267 (1200 px, Rand 24 px ab md)', () => {
    const html = renderToStaticMarkup(createElement(KundeFuss))
    expect(fussSpalteKlassen(html)).toEqual(expect.arrayContaining(['md:max-w-[1200px]', 'md:px-6']))
  })
})

describe('G11 – „Vertrag widerrufen“ in derselben Liste wie die übrigen Rechtslinks', () => {
  it('eine Liste „Rechtliches“ mit allen Rechtslinks, „Vertrag widerrufen“ als letzter Eintrag darin', () => {
    const fuss = renderToStaticMarkup(createElement(KundeFuss, { spalte: 'mittel' }))
    const recht = abschnitt(fuss, '<nav aria-label="Rechtliches"', '</nav>')
    expect(recht.match(/<ul /g)).toHaveLength(1)
    const woerter = [...recht.matchAll(/<li><a [^>]*>([^<]*)<\/a><\/li>/g)].map((m) => m[1])
    expect(woerter).toEqual(SEITENFUSS.rechtlich.map((l) => l.label))
    expect(woerter.at(-1)).toBe(WIDERRUF_TEXT.fussLink)
    // Gegenprobe: nicht bei den Wegen.
    expect(abschnitt(fuss, '<nav aria-label="Mehr entdecken"', '</nav>')).not.toContain(WIDERRUF_TEXT.fussLink)
  })

  it('bricht linksbündig um: die Zeile über `justify-between`, keine Ausrichtung nach rechts an Liste oder Nav', () => {
    const fuss = renderToStaticMarkup(createElement(KundeFuss, { spalte: 'schmal' }))
    expect(fuss).toMatch(/<nav aria-label="Rechtliches">/)
    expect(fuss).toContain('md:justify-between')
    expect(fuss).not.toContain('md:justify-end')
    expect(fuss).not.toContain('md:ml-auto')
    const recht = abschnitt(fuss, '<nav aria-label="Rechtliches"', '</nav>')
    expect(/<ul class="([^"]*)"/.exec(recht)?.[1]).toBe('flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-2')
  })

  it.each([
    ['/forgot-password', 'md:max-w-[552px]'],
    ['/account/neuigkeiten-bestaetigen', 'md:max-w-[552px]'],
    ['/register', 'md:max-w-[928px]'],
  ] as const)('Fokus-Shell auf %s: die Zeile „Vertrag widerrufen“ in der Spalte der Seite (%s)', (route, klasse) => {
    const klassen = widerrufZeileKlassen(fokusShell(route))
    expect(klassen).toContain(klasse)
    expect(klassen).not.toContain('md:max-w-[1200px]')
  })

  it('Fokus-Shell: auf einer Route außerhalb der Liste 1200 px wie bisher; eine eigene Spalte der Ansicht gilt vor der Route', () => {
    expect(widerrufZeileKlassen(fokusShell('/hof-mueller/checkout'))).toEqual(expect.arrayContaining(['md:max-w-[1200px]', 'md:px-6']))
    const eigene = widerrufZeileKlassen(fokusShell('/forgot-password', { spalte: 'max-w-[704px]' }))
    expect(eigene).toContain('max-w-[704px]')
    expect(eigene).not.toContain('md:max-w-[552px]')
  })
})

describe('G11 – die früheren `fussSpalte`-Aufrufer', () => {
  it.each([
    'src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx',
    'src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx',
    'src/app/(public)/bestellungen/page.tsx',
    'src/components/shells/kunde-shell-mit-sitzung.tsx',
  ])('%s gibt keine Spalte mehr mit — die Spalte kommt aus der Route', (datei) => {
    const text = quelle(datei)
    expect(text).toContain('KundeShell')
    expect(text).not.toContain('fussSpalte')
  })
})

describe('G10 – Warenkorb-Symbol in Board-Größe', () => {
  /** Die Klassen und die Strichstärke des Taschen-Symbols in einem Ausschnitt. */
  function tasche(html: string): { klassen: string[]; strich: string | undefined } {
    const svg = /<svg [^>]*class="[^"]*lucide-handbag[^"]*"[^>]*>/.exec(html)?.[0] ?? ''
    expect(svg, 'Taschen-Symbol').not.toBe('')
    return { klassen: /class="([^"]*)"/.exec(svg)?.[1].split(/\s+/) ?? [], strich: /stroke-width="([^"]*)"/.exec(svg)?.[1] }
  }

  it('in der Unterleiste 16 px mit kräftigem Strich, nicht mehr 24 px', () => {
    korb.aktuell = { anzahl: 3, href: '/hof-mueller?korb=1' }
    const leiste = abschnitt(kundeShell('/hoefe'), 'data-slot="bottom-nav"', '</nav>')
    korb.aktuell = null
    const { klassen, strich } = tasche(leiste)
    expect(klassen).toContain('size-4')
    expect(klassen).not.toContain('size-6')
    expect(strich).toBe('2.5')
  })

  it('im Handy-Kopf der Fokus-Seiten mit Kopf dieselbe Größe wie in der Unterleiste (vorher 20 px)', () => {
    korb.aktuell = { anzahl: 2, href: '/hof-mueller?korb=1' }
    const kopf = abschnitt(kundeShell('/gibt-es-nicht', { unterleiste: false }), '<header', '</header>')
    korb.aktuell = null
    const { klassen, strich } = tasche(kopf)
    expect(klassen).toContain('size-4')
    expect(klassen).not.toContain('size-5')
    expect(strich).toBe('2.5')
  })
})

describe('G10 – Hof- und Admin-Unterleiste unverändert (Markup-Vergleich mit dem Stand vor Nr. 267)', () => {
  function leiste(html: string): string {
    const marke = html.indexOf('data-slot="bottom-nav"')
    expect(marke).toBeGreaterThanOrEqual(0)
    const start = html.lastIndexOf('<nav', marke)
    return html.slice(start, html.indexOf('</nav>', marke) + '</nav>'.length)
  }

  it('Hof: Zeichen für Zeichen wie vorher', () => {
    pfad.aktuell = '/dashboard'
    const Hof = HofShell as unknown as ComponentType<Record<string, unknown>>
    const html = renderToStaticMarkup(
      createElement(Hof, { hofName: 'Hof Müller', hofSlug: 'hof-mueller', personName: 'Franz Müller', isAdmin: false, zahlen: { bestellungen: 3, admin: 0 } }, createElement('p', null, 'Inhalt'))
    )
    expect(leiste(html) + '\n').toBe(quelle('tests/fixtures/unterleiste-hof.html'))
  })

  it('Admin: Zeichen für Zeichen wie vorher', () => {
    pfad.aktuell = '/admin'
    const Admin = AdminShell as unknown as ComponentType<Record<string, unknown>>
    const html = renderToStaticMarkup(createElement(Admin, { personName: 'Franz Müller', hatHof: true, zahlen: { heute: 2, postfach: 1 } }, createElement('p', null, 'Inhalt')))
    expect(leiste(html) + '\n').toBe(quelle('tests/fixtures/unterleiste-admin.html'))
  })

  it('Gegenprobe: die Kunden-Unterleiste ist eine andere (mit Tasche), der Vergleich unterscheidet', () => {
    const kunde = leiste(kundeShell('/hoefe'))
    expect(kunde).toContain('lucide-handbag')
    expect(quelle('tests/fixtures/unterleiste-hof.html')).not.toContain('lucide-handbag')
    expect(quelle('tests/fixtures/unterleiste-admin.html')).not.toContain('lucide-handbag')
  })
})

describe('Vorschau /intern/bausteine (Einhängepunkt vorschau-267.tsx)', () => {
  it('zeigt den Fuß in jeder Spaltenart mit ihren Routen und die Unterleiste mit der neuen Tasche', async () => {
    const { Vorschau267 } = await import('@/app/intern/bausteine/vorschau-267')
    const html = renderToStaticMarkup(createElement(Vorschau267))
    for (const id of ['fuss-spalte', 'warenkorb-symbol']) expect(html, id).toContain(`id="${id}-titel"`)
    for (const spalte of ['schmal', 'mittel', 'seite', 'breit']) expect(html, spalte).toContain(`data-spalte="${spalte}"`)
    expect(html).toContain('/bestellungen')
    expect(html).toContain('Hof- und Produktseite')
    expect(html).toMatch(/<svg [^>]*class="lucide lucide-handbag size-4"/)
    // Gegenprobe: Die Leiste der Vorschau ist ein Bild, keine zweite feste Unterleiste.
    expect(html).not.toContain('data-slot="bottom-nav"')
  })

  it('bausteine-vorschau.tsx hängt sie mit genau einer Import- und einer Einhäng-Zeile ein', () => {
    const text = quelle('src/app/intern/bausteine/bausteine-vorschau.tsx')
    expect(text.match(/import \{ Vorschau267 \} from '@\/app\/intern\/bausteine\/vorschau-267'/g)).toHaveLength(1)
    expect(text.match(/<Vorschau267 \/>/g)).toHaveLength(1)
  })
})
