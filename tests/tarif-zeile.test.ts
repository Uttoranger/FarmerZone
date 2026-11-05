/**
 * Tarif-Zustand und Tarif-Zeile (Nachtlauf 10, Nr. 61; Register E6-Ergänzung,
 * K1, K2).
 *
 * Beweist:
 *  - EINE Regel (bestimmeTarifZustand): Startphase vor dem Stichtag,
 *    Gründungshof bis einschließlich seines Wiener Kalendertags und mit
 *    Vorrang vor der Startphase, danach Hoftor ohne Wahl, Hofladen nur nach
 *    Wahl. Die Tagesgrenze ist Mitternacht in Wien, nie in UTC.
 *  - Die Zeile je Zustand (baueTarifZeile): Texte aus TARIF_ZEILE, nie ein
 *    Preis oder Betrag; Hofladen hat keine Zeile; „n von 3" ist nur Anzeige.
 *  - Die HofShell zeigt sie unten in der Seitenleiste vor der Person und oben
 *    im Mehr-Blatt als Gruppe „Dein Tarif" — gerendert wie auf dem Server, die
 *    Blätter per Mock offen (sie öffnen sonst erst im Browser).
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, Fragment, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))
vi.mock('@/components/ui/sheet', () => {
  type Kinder = { children?: ReactNode }
  return {
    Sheet: ({ children }: Kinder) => createElement(Fragment, null, children),
    SheetTrigger: ({ children }: Kinder) => createElement('button', { type: 'button' }, children),
    // Der feste Kopf (Prop `kopf`, UI-Runde 4) steht vor dem Inhalt wie im echten Blatt.
    SheetBlatt: ({ children, kopf }: Kinder & { kopf?: ReactNode }) => createElement('section', { 'data-blatt': '' }, kopf, children),
    SheetTitle: ({ children }: Kinder) => createElement('h2', null, children),
    SheetClose: ({ children }: Kinder) => createElement('button', { type: 'button' }, children),
    // Seit Nr. 220 tragen die Blätter der HofShell den Kopf aus dem Baustein (Titel und ein Schließen-Element).
    SheetKopf: ({ titel, schliessen }: { titel: ReactNode; schliessen?: string }) =>
      createElement(Fragment, null, createElement('h2', null, titel), createElement('button', { type: 'button' }, schliessen)),
  }
})

import { TARIFE, TARIFE_AB, TARIF_ZEILE, baueTarifZeile, bestimmeTarifZustand, type TarifZeileDaten } from '@/lib/konditionen'
import { DEIN_TARIF_TITEL, EINSTELLUNG_KONDITIONEN, VERKAUF_UND_KUNDEN_TITEL, datumOhneUmbruch } from '@/lib/bauern-navigation'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HofShell } from '@/components/shells/hof-shell'

/** Das geschützte Leerzeichen nach dem Tag ist Satz, nicht Wortlaut. */
const normal = (text: string): string => text.replace(/ /g, ' ')

const VOR_STICHTAG = new Date('2026-10-12T10:00:00.000Z')
const NACH_STICHTAG = new Date('2027-03-01T10:00:00.000Z')
/** Eine DATE-Spalte kommt aus Prisma als UTC-Mitternacht des Tages. */
const BIS_SILVESTER_2027 = new Date('2027-12-31T00:00:00.000Z')

describe('bestimmeTarifZustand — die eine Regel', () => {
  it('vor dem Stichtag gilt die Startphase, auch wenn schon ein Tarif gewählt ist', () => {
    expect(bestimmeTarifZustand({ tarif: null, gruendungBis: null }, VOR_STICHTAG)).toBe('startphase')
    expect(bestimmeTarifZustand({ tarif: 'HOFLADEN', gruendungBis: null }, VOR_STICHTAG)).toBe('startphase')
  })

  it('die Startphase endet um Mitternacht in Wien am Stichtag — eine Millisekunde davor noch nicht', () => {
    const hof = { tarif: null, gruendungBis: null }
    expect(bestimmeTarifZustand(hof, new Date(TARIFE_AB.getTime() - 1))).toBe('startphase')
    expect(bestimmeTarifZustand(hof, TARIFE_AB)).toBe('hoftor')
  })

  it('ab dem Stichtag gilt ohne Wahl Hoftor, Hofladen nur nach aktiver Wahl (E6-Ergänzung)', () => {
    expect(bestimmeTarifZustand({ tarif: null, gruendungBis: null }, NACH_STICHTAG)).toBe('hoftor')
    expect(bestimmeTarifZustand({ tarif: 'HOFTOR', gruendungBis: null }, NACH_STICHTAG)).toBe('hoftor')
    expect(bestimmeTarifZustand({ tarif: 'HOFLADEN', gruendungBis: null }, NACH_STICHTAG)).toBe('hofladen')
  })

  it('ein Gründungshof sieht seine Zusage statt der Startphase (Vorrang, K2)', () => {
    expect(bestimmeTarifZustand({ tarif: null, gruendungBis: BIS_SILVESTER_2027 }, VOR_STICHTAG)).toBe('gruendungshof')
    expect(bestimmeTarifZustand({ tarif: null, gruendungBis: BIS_SILVESTER_2027 }, NACH_STICHTAG)).toBe('gruendungshof')
  })

  it.each([
    // Winter: Wien ist UTC+1 — der 1. Jänner beginnt um 23:00 UTC des Vortags.
    ['Winter', '2027-12-31', '2027-12-31T22:59:59.999Z', '2027-12-31T23:00:00.000Z'],
    // Sommer: Wien ist UTC+2.
    ['Sommer', '2027-07-31', '2027-07-31T21:59:59.999Z', '2027-07-31T22:00:00.000Z'],
  ])('%s: der Gründungstag gilt bis Mitternacht in Wien, nicht bis Mitternacht in UTC', (_zeit, tag, letzterMoment, danach) => {
    const hof = { tarif: null, gruendungBis: new Date(`${tag}T00:00:00.000Z`) }
    expect(bestimmeTarifZustand(hof, new Date(letzterMoment))).toBe('gruendungshof')
    // In UTC ist es noch derselbe Tag — in Wien schon der nächste: Die Zusage ist vorbei.
    expect(bestimmeTarifZustand(hof, new Date(danach))).toBe('hoftor')
    expect(bestimmeTarifZustand({ ...hof, tarif: 'HOFLADEN' }, new Date(danach))).toBe('hofladen')
  })

  it('nach dem Gründungstag gilt die normale Regel — vor dem Stichtag also die Startphase', () => {
    const vorbei = { tarif: null, gruendungBis: new Date('2026-10-01T00:00:00.000Z') }
    expect(bestimmeTarifZustand(vorbei, VOR_STICHTAG)).toBe('startphase')
  })

  it('ein Datum als Wiener Mitternacht statt UTC-Mitternacht gibt denselben Tag', () => {
    const wienerMitternacht = new Date('2027-12-30T23:00:00.000Z')
    expect(bestimmeTarifZustand({ tarif: null, gruendungBis: wienerMitternacht }, new Date('2027-12-31T22:59:59.999Z'))).toBe('gruendungshof')
    expect(bestimmeTarifZustand({ tarif: null, gruendungBis: wienerMitternacht }, new Date('2027-12-31T23:00:00.000Z'))).toBe('hoftor')
  })
})

describe('baueTarifZeile — die Zeile je Zustand', () => {
  const ohne = { tarif: null, gruendungBis: null, produkteImShop: 2 }

  it('Startphase: „Startphase: kostenlos" bis zum letzten Tag vor dem Stichtag, am Handy mit „du musst nichts tun"', () => {
    const zeile = baueTarifZeile(ohne, VOR_STICHTAG)
    expect(zeile).toMatchObject({ zustand: 'startphase', titel: 'Startphase: kostenlos' })
    expect(normal(zeile?.zeile ?? '')).toBe('bis 31. Jänner 2027')
    expect(normal(zeile?.zeileHandy ?? '')).toBe('bis 31. Jänner 2027 · du musst nichts tun')
    expect(zeile?.grenze).toBeUndefined()
  })

  it('Gründungshof: ohne Grundgebühr bis zu seinem Tag — über den Wiener Kalendertag geschrieben', () => {
    const zeile = baueTarifZeile({ ...ohne, gruendungBis: BIS_SILVESTER_2027 }, VOR_STICHTAG)
    expect(zeile).toMatchObject({ zustand: 'gruendungshof', titel: 'Gründungshof' })
    expect(normal(zeile?.zeile ?? '')).toBe('ohne Grundgebühr bis 31. Dezember 2027')
    expect(zeile?.zeileHandy).toBe(zeile?.zeile)
  })

  it('Gründungshof: die Restzeit „noch N Monate (bis …)“ aus Datum und heute — angefangene Monate, wie im Board (Nr. 233)', () => {
    const rest = (bis: string, heute: string): string =>
      normal(baueTarifZeile({ ...ohne, gruendungBis: new Date(bis) }, new Date(heute))?.restzeit ?? '')
    // Board w1-/s1-mehr-neu: am 3. März 2027 bis 31. Jänner 2028.
    expect(rest('2028-01-31T00:00:00.000Z', '2027-03-03T10:00:00.000Z')).toBe('noch 11 Monate (bis 31. Jänner 2028)')
    expect(rest('2027-12-31T00:00:00.000Z', '2026-11-05T10:00:00.000Z')).toBe('noch 14 Monate (bis 31. Dezember 2027)')
    // Genau ein Monat bis zum Tag (einschließlich des Tags) ist schon ein angefangener zweiter; am letzten Tag „noch 1 Monat“.
    expect(rest('2027-04-03T00:00:00.000Z', '2027-03-03T10:00:00.000Z')).toBe('noch 2 Monate (bis 3. April 2027)')
    expect(rest('2027-04-02T00:00:00.000Z', '2027-03-03T10:00:00.000Z')).toBe('noch 1 Monat (bis 2. April 2027)')
    expect(rest('2027-03-03T00:00:00.000Z', '2027-03-03T21:00:00.000Z')).toBe('noch 1 Monat (bis 3. März 2027)')
    // Wiener Tag: um 0:30 Uhr in Wien ist in UTC noch gestern — gezählt wird der Wiener Tag.
    expect(rest('2027-04-01T00:00:00.000Z', '2027-02-28T23:30:00.000Z')).toBe('noch 2 Monate (bis 1. April 2027)')
    // Die Übersicht der Einstellungen liest weiter `zeile` — dort ändert sich nichts.
    expect(normal(baueTarifZeile({ ...ohne, gruendungBis: BIS_SILVESTER_2027 }, VOR_STICHTAG)?.zeile ?? '')).toBe('ohne Grundgebühr bis 31. Dezember 2027')
  })

  it('nur der Gründungshof hat eine Restzeit — Startphase und Hoftor nicht', () => {
    expect(baueTarifZeile(ohne, VOR_STICHTAG)?.restzeit).toBeUndefined()
    expect(baueTarifZeile({ ...ohne, produkteImShop: 3 }, NACH_STICHTAG)?.restzeit).toBeUndefined()
    // Gegenprobe: abgelaufene Zusage — kein Gründungshof mehr, also auch keine Restzeit.
    expect(baueTarifZeile({ ...ohne, gruendungBis: new Date('2026-10-01T00:00:00.000Z') }, VOR_STICHTAG)?.restzeit).toBeUndefined()
  })

  it('Hoftor: „Produkte im Shop n von 3" und „Tarife vergleichen" — die Zahl ist Anzeige, keine Sperre', () => {
    const zeile = baueTarifZeile({ ...ohne, produkteImShop: 3 }, NACH_STICHTAG)
    expect(zeile).toMatchObject({ zustand: 'hoftor', titel: 'Hoftor · kostenlos', zeile: 'Produkte im Shop', hinweis: 'Tarife vergleichen' })
    expect(zeile?.grenze).toEqual({ wert: '3 von 3', anteil: 1 })
    expect(baueTarifZeile({ ...ohne, produkteImShop: 0 }, NACH_STICHTAG)?.grenze).toEqual({ wert: '0 von 3', anteil: 0 })
    // Mehr sichtbare Produkte als erlaubt: die Zahl stimmt, der Balken läuft nicht über.
    expect(baueTarifZeile({ ...ohne, produkteImShop: 9 }, NACH_STICHTAG)?.grenze).toEqual({ wert: '9 von 3', anteil: 1 })
  })

  it('Hofladen hat keine Zeile', () => {
    expect(baueTarifZeile({ ...ohne, tarif: 'HOFLADEN' }, NACH_STICHTAG)).toBeNull()
  })

  it('nie ein Preis, nie ein Betrag — weder in TARIF_ZEILE noch in einer gebauten Zeile', () => {
    const zeilen = [
      baueTarifZeile(ohne, VOR_STICHTAG),
      baueTarifZeile({ ...ohne, gruendungBis: BIS_SILVESTER_2027 }, VOR_STICHTAG),
      baueTarifZeile({ ...ohne, produkteImShop: 3 }, NACH_STICHTAG),
    ]
    const texte = [
      ...Object.values(TARIF_ZEILE).flatMap((z) => Object.values(z)),
      ...zeilen.flatMap((z) => [z?.titel, z?.zeile, z?.zeileHandy, z?.restzeit, z?.hinweis, z?.grenze?.wert]),
    ].filter((t): t is string => typeof t === 'string')
    expect(texte.length).toBeGreaterThan(10)
    for (const text of texte) {
      expect(text, text).not.toMatch(/€|Euro|Cent|%|\d+,\d{2}\b/)
      for (const tarif of TARIFE) expect(text, text).not.toContain(tarif.preis)
    }
  })

  it('Gegenprobe: die Prüfung schlägt bei einem Preis an', () => {
    for (const text of ['Hofladen · € 19', '19 Euro im Monat', '5 % Gebühr', '19,00 im Monat']) {
      expect(text).toMatch(/€|Euro|Cent|%|\d+,\d{2}\b/)
    }
  })
})

// ─── HofShell: Seitenleiste und Mehr-Blatt ──────────────────────────────────

function el<P extends { children?: ReactNode }>(typ: ComponentType<P>, props: Omit<P, 'children'>): ReactElement {
  return createElement(typ as unknown as ComponentType<Omit<P, 'children'>>, props, createElement('p', null, 'Inhalt'))
}

function shell(tarifZeile: TarifZeileDaten | null): string {
  return renderToStaticMarkup(
    el(HofShell, { hofName: 'Hof Beispiel', hofSlug: 'hof-beispiel', personName: 'Max Mustermann', isAdmin: false, tarifZeile })
  )
}

/** Der Teil des HTML vom ersten `start` bis zum nächsten `ende`. */
function abschnitt(html: string, start: string, ende: string): string {
  const von = html.indexOf(start)
  expect(von, start).toBeGreaterThanOrEqual(0)
  return html.slice(von, html.indexOf(ende, von) + ende.length)
}

/** Der Link der Tarif-Zeile in einem Abschnitt — undefined, wenn keiner da ist. */
const tarifLink = (html: string): string | undefined => html.match(/<a [^>]*data-slot="tarif-zeile"[\s\S]*?<\/a>/)?.[0]

const ZEILEN = {
  startphase: baueTarifZeile({ tarif: null, gruendungBis: null, produkteImShop: 9 }, VOR_STICHTAG),
  gruendungshof: baueTarifZeile({ tarif: null, gruendungBis: BIS_SILVESTER_2027, produkteImShop: 9 }, VOR_STICHTAG),
  hoftor: baueTarifZeile({ tarif: null, gruendungBis: null, produkteImShop: 3 }, NACH_STICHTAG),
}

describe('HofShell — die Tarif-Zeile je Zustand', () => {
  it.each(Object.entries(ZEILEN))('%s: unten in der Seitenleiste vor der Person, mit der Unterzeile fürs Web', (_zustand, zeile) => {
    const leiste = abschnitt(shell(zeile), '<aside', '</aside>')
    const link = tarifLink(leiste)
    expect(link).toBeDefined()
    expect(link).toContain(`href="${EINSTELLUNG_KONDITIONEN.href}"`)
    expect(link).toContain(zeile?.titel)
    // Das Datum bricht nicht um (V13, Nr. 220): die Zeile mit geschützten Leerzeichen; beim Gründungshof die Restzeit.
    expect(link).toContain(datumOhneUmbruch(zeile?.restzeit ?? zeile?.zeile ?? ''))
    if (zeile?.zeileHandy !== zeile?.zeile) expect(link).not.toContain(datumOhneUmbruch(zeile?.zeileHandy ?? ''))
    // Unten: nach „Verkauf und Kunden", vor den Einstellungen und der Konto-Zeile.
    expect(leiste.indexOf('data-slot="tarif-zeile"')).toBeGreaterThan(leiste.indexOf(VERKAUF_UND_KUNDEN_TITEL))
    expect(leiste.indexOf('data-slot="tarif-zeile"')).toBeLessThan(leiste.indexOf('>Einstellungen<'))
  })

  it.each(Object.entries(ZEILEN))('%s: oben im Mehr-Blatt als Gruppe „Dein Tarif", mit der Unterzeile fürs Handy', (_zustand, zeile) => {
    const html = shell(zeile)
    const mehr = html.slice(html.indexOf('<h2>Mehr</h2>'))
    const link = tarifLink(mehr)
    // Beim Gründungshof trägt das Abzeichen den Titel (siehe unten); dort steht die Restzeit.
    if (zeile?.zustand !== 'gruendungshof') expect(link).toContain(zeile?.titel)
    expect(link).toContain(datumOhneUmbruch(zeile?.restzeit ?? zeile?.zeileHandy ?? ''))
    expect(mehr).toContain(`role="group" aria-label="${DEIN_TARIF_TITEL}"`)
    expect(mehr.indexOf(`>${DEIN_TARIF_TITEL}<`)).toBeLessThan(mehr.indexOf('data-slot="tarif-zeile"'))
    expect(mehr.indexOf('data-slot="tarif-zeile"')).toBeLessThan(mehr.indexOf(`>${VERKAUF_UND_KUNDEN_TITEL}<`))
  })

  it('Gründungshof: „31. Dezember 2027“ bleibt beisammen — Seitenleiste und Mehr-Blatt (V13)', () => {
    const html = shell(ZEILEN.gruendungshof)
    expect(html).toContain('31.\u00a0Dezember\u00a02027')
    // Gegenprobe: die gebaute Zeile selbst trägt vor dem Jahr ein normales Leerzeichen — erst die Shell schützt es.
    expect(ZEILEN.gruendungshof?.zeile).toContain('Dezember 2027')
    expect(html).not.toContain('Dezember 2027')
  })

  it('Gründungshof im Mehr-Blatt: das Abzeichen statt Kästchen und Titel (Board s1-mehr-neu, Nr. 233); in der Seitenleiste das Kästchen', () => {
    const html = shell(ZEILEN.gruendungshof)
    const imBlatt = tarifLink(html.slice(html.indexOf('<h2>Mehr</h2>'))) ?? ''
    expect(imBlatt).toContain('bg-abzeichen-grund')
    expect(imBlatt).not.toContain('lucide-sparkle')
    // Gegenprobe: die Seitenleiste zeigt Kästchen und Titel, kein Abzeichen; die Startphase im Blatt auch nicht.
    const inLeiste = tarifLink(abschnitt(html, '<aside', '</aside>')) ?? ''
    expect(inLeiste).not.toContain('bg-abzeichen-grund')
    expect(inLeiste).toContain('lucide-sparkle')
    const start = shell(ZEILEN.startphase)
    expect(tarifLink(start.slice(start.indexOf('<h2>Mehr</h2>')))).not.toContain('bg-abzeichen-grund')
  })

  it('Gründungshof: „noch N Monate (bis …)“ statt „ohne Grundgebühr bis …“; im Blatt sichtbar „· Konditionen und Tarif“ (Boards w1-/s1-mehr-neu)', () => {
    const html = shell(ZEILEN.gruendungshof)
    const inLeiste = tarifLink(abschnitt(html, '<aside', '</aside>')) ?? ''
    const imBlatt = tarifLink(html.slice(html.indexOf('<h2>Mehr</h2>'))) ?? ''
    const rest = datumOhneUmbruch(ZEILEN.gruendungshof?.restzeit ?? '')
    expect(rest).toMatch(/^noch \d+ Monate? \(bis /)
    expect(inLeiste).toContain(`>${rest}<`)
    expect(imBlatt).toContain(`>${rest} · ${EINSTELLUNG_KONDITIONEN.label}<`)
    // Im Blatt steht das Ziel sichtbar — kein doppelter Zusatz für den Screenreader; in der Seitenleiste bleibt er.
    expect(imBlatt).not.toContain('class="sr-only"')
    expect(inLeiste).toContain(`<span class="sr-only">, ${EINSTELLUNG_KONDITIONEN.label}</span>`)
    // Gegenprobe: der alte Wortlaut steht in keiner der beiden Zeilen mehr, die Startphase hat kein sichtbares Ziel.
    expect(inLeiste + imBlatt).not.toContain('ohne Grundgebühr')
    const start = shell(ZEILEN.startphase)
    expect(tarifLink(start.slice(start.indexOf('<h2>Mehr</h2>')))).not.toContain(` · ${EINSTELLUNG_KONDITIONEN.label}`)
  })

  it('Startphase am Handy mit „du musst nichts tun", in der Seitenleiste ohne', () => {
    const html = shell(ZEILEN.startphase)
    expect(tarifLink(abschnitt(html, '<aside', '</aside>'))).not.toContain('du musst nichts tun')
    expect(tarifLink(html.slice(html.indexOf('<h2>Mehr</h2>')))).toContain('du musst nichts tun')
  })

  it('Hoftor zeigt „n von 3" und „Tarife vergleichen" — der Balken ist stumm, die Zahl steht als Text da', () => {
    const link = tarifLink(shell(ZEILEN.hoftor)) ?? ''
    expect(link).toContain('3 von 3')
    expect(link).toContain('Tarife vergleichen')
    expect(link).toMatch(/<span aria-hidden="true"[^>]*><span[^>]*style="width:100%"/)
  })

  it('Symbol je Zustand: Spross für Startphase und Hoftor, beim Gründungshof das Funkeln (Board w1-mehr-neu, Nr. 233)', () => {
    expect(tarifLink(shell(ZEILEN.startphase))).toContain('lucide-sprout')
    expect(tarifLink(shell(ZEILEN.hoftor))).toContain('lucide-sprout')
    expect(tarifLink(shell(ZEILEN.gruendungshof))).toContain('lucide-sparkle')
    expect(tarifLink(shell(ZEILEN.gruendungshof))).not.toContain('lucide-star')
  })

  it('das Funkeln ist gefüllt wie „✦“ im Board, der Spross bleibt ein Umriss (UI-Runde 4)', () => {
    const funkeln = tarifLink(shell(ZEILEN.gruendungshof))?.match(/<svg[^>]*lucide-sparkle[^>]*>/)?.[0] ?? ''
    expect(funkeln).toContain('fill="currentColor"')
    const spross = tarifLink(shell(ZEILEN.startphase))?.match(/<svg[^>]*lucide-sprout[^>]*>/)?.[0] ?? ''
    expect(spross).toContain('fill="none"')
  })

  it('in der Seitenleiste Zeilenhöhe 1,4 ohne Abstand wie im Board (Karte 73 px), der Balken bei Hoftor behält den Abstand', () => {
    expect(tarifLink(shell(ZEILEN.gruendungshof))).toMatch(/class="flex min-w-0 flex-1 flex-col leading-\[1\.4\]"/)
    expect(tarifLink(shell(ZEILEN.hoftor))).toMatch(/class="flex min-w-0 flex-1 flex-col gap-0\.5"/)
  })

  it('ein Link mit ≥ 44 px und sichtbarem Fokus; der Screenreader hört auch, wohin', () => {
    const link = tarifLink(shell(ZEILEN.startphase)) ?? ''
    const klassen = link.match(/^<a [^>]*class="([^"]*)"/)?.[1].split(' ') ?? []
    // 56 px wie im Board w1-mehr-neu (Nr. 233; vorher 44 px) — mehr als das Mindestmaß.
    for (const k of ['min-h-14', ...FOKUS_RAHMEN.split(' ')]) expect(klassen, k).toContain(k)
    expect(link).toContain(`<span class="sr-only">, ${EINSTELLUNG_KONDITIONEN.label}</span>`)
    for (const svg of link.match(/<svg[^>]*>/g) ?? []) expect(svg).toContain('aria-hidden="true"')
  })

  it('nie ein Preis und nie eine Warnfarbe in der Zeile (E6-Ergänzung)', () => {
    for (const zeile of Object.values(ZEILEN)) {
      const link = tarifLink(shell(zeile)) ?? ''
      expect(link).not.toMatch(/€|status-offen|bg-primary|text-primary|destructive/)
    }
    // Gegenprobe: In der Shell stehen Warn- und Hof-Farben (Neu-Knopf) — die Suche findet sie.
    expect(shell(ZEILEN.startphase)).toMatch(/bg-primary/)
  })

  it('Hofladen hat keine Zeile — weder in der Seitenleiste noch im Mehr-Blatt, auch keine leere Gruppe', () => {
    const html = shell(baueTarifZeile({ tarif: 'HOFLADEN', gruendungBis: null, produkteImShop: 9 }, NACH_STICHTAG))
    expect(html).not.toContain('data-slot="tarif-zeile"')
    expect(html).not.toContain(`>${DEIN_TARIF_TITEL}<`)
    // Gegenprobe: mit Zeile steht beides da.
    expect(shell(ZEILEN.startphase)).toContain(`>${DEIN_TARIF_TITEL}<`)
  })
})
