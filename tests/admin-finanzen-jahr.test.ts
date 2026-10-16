/**
 * Admin › Finanzen, Jahresansicht (Register N15, Ergänzung Nr. 100) — die Seite
 * gerendert wie auf dem Server, über die echten Abfragen (nur Prisma ersetzt).
 * Beweist:
 *  - Die Adresse: `zeitraum` und `jahr` werden von Zod gelesen; ohne `zeitraum`
 *    bleibt die Seite der Monat, ein ungültiges Jahr ist das laufende.
 *  - Der Umschalter Monat | Jahr: zwei Links, der aktuelle trägt aria-current.
 *  - Die Seite im Jahr: Kennzahlen mit den Zahlen der Rechnung (nicht
 *    nachgebaut), Diagramm mit Beschriftung, die Tabelle Monat für Monat (neuester
 *    oben, jede Zeile ein Link auf den Monat), das Blättern je Jahr (vor ist im
 *    laufenden Jahr nicht da), der Knopf zur CSV, vier Unterreiter.
 *  - „Bis Jahresende“ nur im laufenden Jahr; der Vergleich mit dem Vorjahr aus mit
 *    Hinweis, solange es kein Vorjahr gibt.
 *  - Kosten im Jahr: Posten, Summe, Anteile; Auszahlungen und Entfallene Gebühren
 *    sagen ehrlich, dass sie nichts zeigen.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch'))
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/finanzen',
}))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminSeite: vi.fn(async () => 'admin_1') }))
vi.mock('@/server/actions/finanzen', () => ({
  kostenpostenAnlegen: vi.fn(),
  kostenpostenAendern: vi.fn(),
  kostenpostenBeenden: vi.fn(),
  kostenpostenLoeschen: vi.fn(),
}))
vi.mock('@/server/queries/admin', () => ({ ladeHoefeFuerGruendung: vi.fn(async () => []) }))
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('./finanzen-jahr-daten')).prismaAttrappe }))
// Stichtag der Live-Schaltung: derselbe wie in den Zeilen; die Abfrage nimmt ihn sonst aus der Umgebung.
vi.mock('@/lib/umgebung-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/umgebung-server')>()),
  STRIPE_LIVE_AB: new Date('2025-06-01T00:00:00Z'),
}))

import AdminFinanzenPage from '@/app/admin/finanzen/page'
import { ZeitraumUmschalter } from '@/app/admin/finanzen/zeitraum-wahl'
import { getFinanzenJahr } from '@/server/queries/finanzen'
import { FINANZEN_JAHR_TEXT, ergebnisText, finanzenJahrAdresse } from '@/lib/finanzen'
import { FINANZEN_REITER_OHNE_INHALT } from '@/lib/admin-finanzen-seite'
import { centsAlsEuro, formatEuro } from '@/lib/format'
import { finanzenJahrAus, finanzenZeitraumAus } from '@/schemas/admin-reiter'
import { JETZT, STICHTAG } from './finanzen-jahr-daten'

async function seite(suche: Record<string, string> = {}): Promise<string> {
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  try {
    return renderToStaticMarkup(await AdminFinanzenPage({ searchParams: Promise.resolve(suche) }))
  } finally {
    vi.useRealTimers()
  }
}

/** Alle Link-Ziele des Markups. */
const links = (html: string): string[] => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((t) => t[1]!.replaceAll('&amp;', '&'))
/** Das ganze Start-Tag des ersten Links mit diesem Ziel. */
const linkMit = (html: string, ziel: string): string => {
  const treffer = [...html.matchAll(/<a [^>]*>/g)].find((t) => t[0].replaceAll('&amp;', '&').includes(`href="${ziel}"`))
  return treffer?.[0] ?? ''
}

describe('die Adresse (Zod)', () => {
  it('Zeitraum: Jahr oder Monat; ohne Wert, mit Unsinn oder doppelt der Monat', () => {
    expect(finanzenZeitraumAus('jahr')).toBe('jahr')
    expect(finanzenZeitraumAus('monat')).toBe('monat')
    expect(finanzenZeitraumAus(undefined)).toBe('monat')
    expect(finanzenZeitraumAus('quartal')).toBe('monat')
    expect(finanzenZeitraumAus(['jahr', 'monat'] as unknown as string)).toBe('monat')
  })

  it('Jahr: vierstellig und nicht nach dem laufenden; alles andere ist das laufende Jahr', () => {
    expect(finanzenJahrAus('2025', 2026)).toBe(2025)
    expect(finanzenJahrAus('2026', 2026)).toBe(2026)
    for (const unsinn of [undefined, '', '26', '20266', 'abc', '2026x', '-2025', '2025.5', '2027', '9999', ' 2025']) {
      expect(finanzenJahrAus(unsinn, 2026), String(unsinn)).toBe(2026)
    }
    expect(finanzenJahrAus(['2025', '2024'] as unknown as string, 2026)).toBe(2026)
  })

  it('die Adresse des Jahres trägt Zeitraum und Jahr, den Reiter nur wenn er nicht der Standard ist', () => {
    expect(finanzenJahrAdresse({ jahr: 2026, reiter: 'monat' })).toBe('/admin/finanzen?zeitraum=jahr&jahr=2026')
    expect(finanzenJahrAdresse({ jahr: 2026, reiter: 'kosten' })).toBe('/admin/finanzen?zeitraum=jahr&jahr=2026&reiter=kosten')
  })
})

describe('der Umschalter Monat | Jahr', () => {
  const umschalter = (aktiv: 'monat' | 'jahr') =>
    renderToStaticMarkup(
      createElement(ZeitraumUmschalter, { aktiv, monatHref: '/admin/finanzen?monat=2026-10', jahrHref: '/admin/finanzen?zeitraum=jahr&jahr=2026' })
    )

  it('zwei Links; der gewählte trägt aria-current, der andere nicht', () => {
    for (const aktiv of ['monat', 'jahr'] as const) {
      const html = umschalter(aktiv)
      expect(links(html)).toEqual(['/admin/finanzen?monat=2026-10', '/admin/finanzen?zeitraum=jahr&jahr=2026'])
      expect(html.match(/aria-current="page"/g)).toHaveLength(1)
      const gewaehlt = linkMit(html, aktiv === 'monat' ? '/admin/finanzen?monat=2026-10' : '/admin/finanzen?zeitraum=jahr&jahr=2026')
      expect(gewaehlt).toContain('aria-current="page"')
    }
  })

  it('ist eine Navigation mit Namen', () => {
    expect(umschalter('jahr')).toContain(`aria-label="${FINANZEN_JAHR_TEXT.umschalter}"`)
  })
})

describe('ohne zeitraum bleibt es der Monat', () => {
  it('Monatsansicht wie bisher, mit dem Umschalter im Kopf (Monat gewählt)', async () => {
    const html = await seite({})
    expect(html).toContain('Wann trägt sich die Plattform?')
    expect(html).not.toContain('nach Monaten')
    expect(linkMit(html, '/admin/finanzen?monat=2026-10')).toContain('aria-current="page"')
    expect(links(html)).toContain('/admin/finanzen?zeitraum=jahr&jahr=2026')
  })

  it('Unsinn im Zeitraum ist ebenfalls der Monat', async () => {
    expect(await seite({ zeitraum: 'quartal' })).toContain('Wann trägt sich die Plattform?')
  })
})

describe('die Seite im Jahr (2026, laufend)', () => {
  it('Kennzahlen: die Zahlen der Rechnung, Monatsspanne, Zahl der Bestellungen, Ton des Ergebnisses und der Hinweis', async () => {
    const { rechnung } = await getFinanzenJahr(2026, JETZT, STICHTAG)
    const html = await seite({ zeitraum: 'jahr', jahr: '2026' })
    expect(html).toContain('Servicegebühren 2026')
    expect(html).toContain(formatEuro(centsAlsEuro(rechnung.servicegebuehrenCents)))
    expect(html).toContain('Jän–Okt · 78 Bestellungen')
    expect(html).toContain('Kosten 2026')
    expect(html).toContain(formatEuro(centsAlsEuro(rechnung.kostenCents)))
    expect(html).toContain('laufend ')
    expect(html).toContain('einmalig € 280,00')
    expect(html).toContain('Ergebnis 2026')
    expect(html).toContain(ergebnisText(rechnung.ergebnisCents))
    // Die erfundenen Kosten (die einmalige Marke) liegen über den Gebühren: orange, nicht grün (Register O1: kein Rot).
    expect(rechnung.ergebnisCents).toBeLessThan(0)
    expect(html).toContain('text-zustand-tun')
    expect(html).toContain('Bis Jahresende')
    expect(html).toContain('nur als Hinweis')
    // Die einzige Testzahlung liegt im Mai 2025 (Vorjahr): Ohne „vergleichen" steht keine Zahl von 2025 da — also kein Hinweis (Nacharbeit 100).
    expect(rechnung.testzahlungAusgelassen).toBe(false)
    expect(html).not.toContain('Testzahlungen vor')
  })

  it('der Kopf: Umschalter (Jahr gewählt), Blättern (zurück ja, vor nein), CSV-Knopf', async () => {
    const html = await seite({ zeitraum: 'jahr', jahr: '2026' })
    expect(linkMit(html, '/admin/finanzen?zeitraum=jahr&jahr=2026')).toContain('aria-current="page"')
    // Zurück in den Monat: im laufenden Jahr der heutige.
    expect(links(html)).toContain('/admin/finanzen?monat=2026-10')
    expect(linkMit(html, '/admin/finanzen?zeitraum=jahr&jahr=2025')).toContain('aria-label="Voriges Jahr"')
    expect(html).not.toContain('Nächstes Jahr')
    expect(html).toContain('aria-label="Jahr wählen"')
    expect(linkMit(html, '/admin/finanzen/export?jahr=2026')).toContain('download')
    expect(html).toContain('CSV 2026')
  })

  it('das Diagramm ist ein Bild mit Beschriftung; die Tabelle darunter ist seine Textfassung (neuester Monat oben, jede Zeile ein Link)', async () => {
    const html = await seite({ zeitraum: 'jahr', jahr: '2026' })
    expect(html).toContain('2026 nach Monaten')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Servicegebühren und Kosten je Monat 2026"')
    expect(html).toMatch(/aria-describedby="[^"]+"/)
    expect(html).toContain('Monat für Monat')
    const tabelle = html.slice(html.indexOf('<table'))
    expect(tabelle.indexOf('Okt 2026')).toBeGreaterThan(-1)
    expect(tabelle.indexOf('Okt 2026')).toBeLessThan(tabelle.indexOf('Sep 2026'))
    expect(tabelle.indexOf('Feb 2026')).toBeLessThan(tabelle.indexOf('Jän 2026'))
    // Gezählt sind zehn Monate; November und Dezember stehen nur als „offen“ im Diagramm.
    expect(tabelle).not.toContain('Nov 2026')
    for (const nummer of ['01', '05', '10']) expect(links(html)).toContain(`/admin/finanzen?monat=2026-${nummer}`)
    expect(html.match(/offen/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('der Vergleich mit dem Vorjahr: ein Schalter, an, solange es 2025 gibt', async () => {
    const html = await seite({ zeitraum: 'jahr', jahr: '2026' })
    expect(html).toContain('mit 2025 vergleichen')
    expect(html).not.toContain('ab 2026')
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/)
    expect(html).not.toContain('aria-disabled="true"')
  })

  it('Unterreiter: Übersicht · Kosten (mit der Zahl der Posten) · Auszahlungen · Entfallene Gebühren', async () => {
    const html = await seite({ zeitraum: 'jahr', jahr: '2026' })
    for (const ziel of [
      '/admin/finanzen?zeitraum=jahr&jahr=2026',
      '/admin/finanzen?zeitraum=jahr&jahr=2026&reiter=kosten',
      '/admin/finanzen?zeitraum=jahr&jahr=2026&reiter=auszahlungen',
      '/admin/finanzen?zeitraum=jahr&jahr=2026&reiter=entfallen',
    ]) {
      expect(links(html), ziel).toContain(ziel)
    }
    expect(html).toContain('Übersicht')
    expect(html).toContain('Entfallene Gebühren')
    expect(linkMit(html, '/admin/finanzen?zeitraum=jahr&jahr=2026&reiter=kosten')).not.toContain('aria-current')
    expect(html).toContain(FINANZEN_JAHR_TEXT.regel)
  })

  it('Gegenprobe: ein ungültiges oder fremdes Jahr zeigt das laufende', async () => {
    for (const jahr of ['abc', '2099', '2019', '26']) {
      const html = await seite({ zeitraum: 'jahr', jahr })
      expect(html, jahr).toContain('2026 nach Monaten')
    }
  })
})

describe('das vergangene und das erste Jahr (2025)', () => {
  it('ganzes Jahr: keine Hochrechnung, vor ist da, zurück nicht, der Vergleich ist aus mit Hinweis', async () => {
    const html = await seite({ zeitraum: 'jahr', jahr: '2025' })
    expect(html).toContain('2025 nach Monaten')
    expect(html).not.toContain('Bis Jahresende')
    expect(html).toContain('Jän–Dez')
    expect(html).toContain('im ganzen Jahr')
    expect(html).not.toContain('Voriges Jahr')
    expect(linkMit(html, '/admin/finanzen?zeitraum=jahr&jahr=2026')).toContain('aria-label="Nächstes Jahr"')
    // Zurück in den Monat: bei einem vergangenen Jahr der Dezember.
    expect(links(html)).toContain('/admin/finanzen?monat=2025-12')
    // Vergleich: kein Vorjahr, also aus — mit dem Grund daneben.
    expect(html).toContain('mit 2024 vergleichen · ab 2026')
    expect(html).toMatch(/role="switch"[^>]*aria-disabled="true"/)
    // Alle zwölf Monate gezählt, keiner offen.
    expect(html).toContain('Dez 2025')
    // Die Testzahlung vom Mai fehlt in den Zahlen dieses Jahres — der Hinweis steht.
    expect(html).toContain('Testzahlungen vor')
  })
})

describe('Kosten im Jahr', () => {
  it('Posten · Rhythmus · Betrag · Monate · Im Jahr · Anteil, Summenzeile', async () => {
    const { rechnung } = await getFinanzenJahr(2026, JETZT, STICHTAG)
    const html = await seite({ zeitraum: 'jahr', jahr: '2026', reiter: 'kosten' })
    expect(html).toContain('Kosten im Jahr')
    for (const kopf of ['Kostenposten', 'Rhythmus', 'Betrag', 'Monate im Jahr', 'Im Jahr 2026', 'Anteil']) expect(html).toContain(kopf)
    for (const name of ['Hosting Beispiel', 'Domain Beispiel', 'Marke Beispiel', 'Werkzeug Beispiel']) expect(html).toContain(name)
    expect(html).toContain(formatEuro(185)) // Hosting: zehn Monate zu 18,50 €
    expect(html).toContain('Mai') // der einmalige Posten steht mit seinem Monat
    expect(html).toContain('Summe 2026')
    expect(html).toContain(formatEuro(centsAlsEuro(rechnung.kostenCents)))
    expect(html).toContain('100 %')
    // Die Übersicht ist in diesem Reiter nicht da.
    expect(html).not.toContain('nach Monaten')
  })

  it('Auszahlungen und Entfallene Gebühren zeigen wie im Monat ihren Leerzustand', async () => {
    for (const reiter of ['auszahlungen', 'entfallen']) {
      const html = await seite({ zeitraum: 'jahr', jahr: '2026', reiter })
      expect(html, reiter).toContain(FINANZEN_REITER_OHNE_INHALT)
      expect(html, reiter).not.toContain('nach Monaten')
    }
  })
})
