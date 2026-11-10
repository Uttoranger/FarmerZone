/**
 * /impressum — die Pflichtangaben nach § 5 ECG und § 25 MedienG, gerendert.
 *
 * Beweist nur die Struktur, nie die Werte (das Repository ist öffentlich):
 *  - Die Abschnitte „Angaben gemäß § 5 ECG", „Offenlegung nach § 25 MedienG"
 *    und die Kontaktstelle nach dem DSA sind Überschriften.
 *  - Die Zeilen für Rechtsform, UID, Gewerbe mit GISA-Zahl, Behörde, Kammer und
 *    Rechtsvorschriften stehen da (je ein data-angabe), dazu der zweite
 *    Kontaktweg: ein Link auf /problem-melden.
 *  - Die Offenlegung nennt Medieninhaber, Unternehmensgegenstand und
 *    grundlegende Richtung.
 *  - Die Kontaktstelle nennt die Adresse aus KONTAKT_EMAIL.
 *  - Die Hinweiskarte zum Pilotbetrieb hängt an PILOTBETRIEB: an → da, aus → weg.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { KONTAKT_EMAIL } from '@/lib/support'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('main', null, children),
}))

/** Rendert die Seite mit dem gewünschten Stand des Pilot-Schalters. */
async function seite(pilotbetrieb: boolean): Promise<string> {
  vi.doMock('@/lib/pilotbetrieb', () => ({ PILOTBETRIEB: pilotbetrieb }))
  const { default: ImpressumPage } = await import('@/app/(public)/impressum/page')
  return renderToStaticMarkup(createElement(ImpressumPage))
}

/** Alle h2-Texte ohne Tags. */
const abschnitte = (html: string): string[] =>
  [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map(([, inhalt]) => inhalt.replace(/<[^>]*>/g, ''))

/** Der Inhalt des Abschnitts, dessen Überschrift mit `titel` beginnt — bis zum nächsten. */
function abschnitt(html: string, titel: string): string {
  const start = html.search(new RegExp(`<h2[^>]*>${titel}`))
  expect(start).toBeGreaterThan(-1)
  const ende = html.indexOf('</section>', start)
  return html.slice(start, ende)
}

beforeEach(() => {
  vi.resetModules()
})

describe('/impressum: Pflichtangaben', () => {
  it('die drei Pflichtabschnitte sind Überschriften, ECG zuerst', async () => {
    const titel = abschnitte(await seite(true))
    const ecg = titel.findIndex((t) => t.startsWith('Angaben gemäß § 5 ECG'))
    const medieng = titel.findIndex((t) => t.startsWith('Offenlegung nach § 25 MedienG'))
    const dsa = titel.findIndex((t) => t.startsWith('Kontaktstelle nach Art. 11 und 12 DSA'))
    expect(ecg).toBe(0)
    expect(medieng).toBeGreaterThan(ecg)
    expect(dsa).toBeGreaterThan(medieng)
  })

  it.each(['rechtsform', 'anschrift', 'email', 'kontaktformular', 'uid', 'gisa', 'behoerde', 'kammer', 'rechtsvorschriften'])(
    'Angaben nach § 5 ECG: die Zeile „%s" steht da',
    async (angabe) => {
      const ecg = abschnitt(await seite(true), 'Angaben gemäß § 5 ECG')
      expect(ecg.match(new RegExp(`data-angabe="${angabe}"`, 'g'))).toHaveLength(1)
    },
  )

  it('der zweite Kontaktweg führt auf das bestehende Formular /problem-melden', async () => {
    const ecg = abschnitt(await seite(true), 'Angaben gemäß § 5 ECG')
    const zeile = ecg.match(/<[^>]*data-angabe="kontaktformular"[^>]*>.*?<\/p>/)?.[0] ?? ''
    expect(zeile).toContain('href="/problem-melden"')
    expect(ecg).toContain(`href="mailto:${KONTAKT_EMAIL}"`)
  })

  it('die Offenlegung nennt Medieninhaber, Unternehmensgegenstand und grundlegende Richtung', async () => {
    const offenlegung = abschnitt(await seite(true), 'Offenlegung nach § 25 MedienG')
    for (const angabe of ['medieninhaber', 'gegenstand', 'richtung']) {
      expect(offenlegung).toContain(`data-angabe="${angabe}"`)
    }
  })

  it('die Kontaktstelle nach dem DSA nennt die Kontakt-Adresse', async () => {
    const dsa = abschnitt(await seite(true), 'Kontaktstelle nach Art. 11 und 12 DSA')
    expect(dsa).toContain(`href="mailto:${KONTAKT_EMAIL}"`)
  })
})

describe('/impressum: Pilotbetrieb hängt an einem Schalter', () => {
  it('im Pilotbetrieb steht die Hinweiskarte da', async () => {
    expect(await seite(true)).toContain('data-slot="hinweiskarte"')
  })

  it('Gegenprobe: ohne Pilotbetrieb fehlt die Hinweiskarte, und kein Satz nennt den Pilot mehr', async () => {
    const html = await seite(false)
    expect(html).not.toContain('data-slot="hinweiskarte"')
    expect(html).not.toMatch(/Pilot/i)
  })
})
