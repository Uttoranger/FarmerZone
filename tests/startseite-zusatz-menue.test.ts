/**
 * Admin › Startseite: „Neu bei den Höfen“ im Menü zum Hinzufügen (Register
 * N16, Ergänzung Nr. 129). Die Seite echt, serverseitig gerendert; Aktionen,
 * Router und Vorschau-Rahmen sind Attrappen.
 *
 * Beweist: Solange der Entwurf den Abschnitt nicht hat, steht neben „Block
 * einfügen“ zusätzlich „„Neu bei den Höfen“ einfügen“ — an beiden Stellen,
 * an denen ein Block entsteht (nach den Höfen, vor dem Fuß). Steht er schon im
 * Entwurf, fehlt er im Menü (kein zweites Mal) und hat als Zeile Pfeile und
 * Auge wie jede andere, kein Entfernen.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('@/server/actions/startseite', () => ({
  loescheStartseitenBlock: vi.fn(),
  speichereEntwurf: vi.fn(),
  uebernehmeFassungAlsEntwurf: vi.fn(),
  veroeffentlicheStartseite: vi.fn(),
  zieheFassungZurueck: vi.fn(),
  erzeugeStartseitenVorschau: vi.fn(),
}))
vi.mock('@/components/admin/startseite-vorschau', () => ({ StartseiteVorschau: () => null, VorschauFenster: () => null }))

import { StartseiteGestalten } from '@/components/admin/startseite-gestalten'
import { STANDARD_REIHENFOLGE } from '@/lib/startseite-gestalten'
import type { AdminStartseite, AdminStartseitenZeile } from '@/server/queries/startseite'

const ZEILEN: AdminStartseitenZeile[] = STANDARD_REIHENFOLGE.map((art) => ({ id: `z-${art.toLowerCase()}`, art, sichtbar: true, block: null }))
const daten = (zeilen: AdminStartseitenZeile[]): AdminStartseite => ({ zeilen, hoefe: [], live: null, geplant: [], frueher: [] })
const seite = (zeilen: AdminStartseitenZeile[]) =>
  renderToStaticMarkup(createElement(StartseiteGestalten, { daten: daten(zeilen), jetzt: '2026-10-15T18:30:00.000Z' }))

const EINFUEGEN = '„Neu bei den Höfen“ einfügen'
const anzahl = (html: string, text: string) => html.split(text).length - 1

describe('Menü zum Hinzufügen', () => {
  it('ohne den Abschnitt steht „Neu bei den Höfen“ neben „Block einfügen“ — an beiden Stellen', () => {
    const html = seite(ZEILEN)
    expect(anzahl(html, 'Block einfügen<')).toBe(2)
    expect(anzahl(html, EINFUEGEN)).toBe(2)
  })

  it('steht er im Entwurf, fehlt er im Menü — als Zeile mit Pfeilen und Auge, ohne Entfernen', () => {
    const mit = [ZEILEN[0], ZEILEN[1], { id: 'z-neuigkeiten', art: 'NEUIGKEITEN' as const, sichtbar: true, block: null }, ...ZEILEN.slice(2)]
    const html = seite(mit)
    expect(anzahl(html, 'Block einfügen<')).toBe(2)
    expect(html).not.toContain(EINFUEGEN)
    expect(html).toContain('aria-label="„Neu bei den Höfen“ nach unten"')
    expect(html).toContain('aria-label="„Neu bei den Höfen“ ausblenden"')
    expect(html).not.toMatch(/„Neu bei den Höfen“ (entfernen|löschen)/)
  })
})
