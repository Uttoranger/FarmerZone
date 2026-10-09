/**
 * Hofseite, Karte „Nächste Abholung" (Nachtlauf Nr. 46, Register N2):
 * Abholtermine klar als Text — keine Kacheln, die wie wählbare Knöpfe
 * aussehen, aber nichts tun. Serverseitig gerendert (TESTING_GUIDELINES §1),
 * Merkmale mit Gegenprobe.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { HofseiteSeitenspalte, type SeitenspalteHof } from '@/components/hofseite/hofseite-seitenspalte'

// Mittwoch, 22. Juli 2026, 10 Uhr in der Zeit des Rechners — in Wien derselbe Tag (nextPickupDays rechnet in Wiener Zeit).
const JETZT = new Date(2026, 6, 22, 10, 0, 0).toISOString()

const HOF: SeitenspalteHof = {
  id: 'farm-1',
  slug: 'hof-test',
  phone: '+43 660 0000000',
  address: 'Feldweg 1',
  postalCode: '4910',
  city: 'Beispieldorf',
  isPaused: false,
  pickupSlots: [
    { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' },
    { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
  ],
}

function spalte(hof: SeitenspalteHof = HOF): string {
  return renderToStaticMarkup(
    createElement(HofseiteSeitenspalte, { hof, zahlungsarten: [], gebuehrKurz: null, gebuehrKorb: null, mitKorb: false, jetzt: JETZT })
  )
}

/** Der Abschnitt „Nächste Abholung" allein. */
function naechsteAbholung(html: string): string {
  const anfang = html.indexOf('aria-labelledby="naechste-abholung"')
  const ende = html.indexOf('</section>', anfang)
  return anfang < 0 ? '' : html.slice(anfang, ende)
}

describe('Nächste Abholung: Termine als Text mit Datum', () => {
  it('jede Zeile nennt Wochentag und Datum, heute zusätzlich „Heute"; dazu die Zeit', () => {
    const abschnitt = naechsteAbholung(spalte())
    expect(abschnitt).toContain('Heute · Mi, 22. Juli')
    expect(abschnitt).toContain('Sa, 25. Juli')
    expect(abschnitt).toContain('Mi, 29. Juli')
    expect(abschnitt).toContain('15–18 Uhr')
    expect(abschnitt).toContain('Dein Zeitfenster wählst du beim Bestellen.')
  })

  it('keine Knopf-Optik: kein Rahmen, keine grüne Fläche, kein Knopf oder Link in den Zeilen', () => {
    const abschnitt = naechsteAbholung(spalte())
    const zeilen = abschnitt.slice(abschnitt.indexOf('<ul'), abschnitt.indexOf('</ul>'))
    expect(zeilen).not.toMatch(/\bborder\b|border-accent|bg-accent|rounded-xl|<button|<a\b/)
    // Gegenprobe: die alte Kachel fiele auf.
    expect('<li class="min-w-0 flex-1 rounded-xl px-1.5 py-3 text-center border-[1.5px] border-accent bg-accent/12">').toMatch(
      /\bborder\b|border-accent|bg-accent|rounded-xl|<button|<a\b/
    )
    // Und die Zeilen sind wirklich da (Gegenprobe zum leeren Fund).
    expect((zeilen.match(/<li/g) ?? []).length).toBe(3)
  })

  it('bei Pause keine Termine — Ankündigen, was man nicht buchen kann, wäre ein leeres Versprechen', () => {
    expect(naechsteAbholung(spalte({ ...HOF, isPaused: true }))).toBe('')
  })
})
