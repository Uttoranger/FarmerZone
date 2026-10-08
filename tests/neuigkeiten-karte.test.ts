/**
 * Die Karte „Neuigkeiten vom Hof per E-Mail" (Register N2, Nachtlauf Nr. 46)
 * serverseitig gerendert (TESTING_GUIDELINES §1: Merkmale, mit Gegenprobe) —
 * dazu der Quelltext: Zurück an den Server gehen nur Kennung und Signatur.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/server/actions/neuigkeiten', () => ({ meldeNeuigkeitenAn: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { NeuigkeitenKarte } from '@/components/bestaetigung/neuigkeiten-karte'
import { NEUIGKEITEN_TEXT } from '@/lib/abo-bestaetigung'

const html = renderToStaticMarkup(
  createElement(NeuigkeitenKarte, { orderId: 'order-1', sig: 'a'.repeat(64), hofName: 'Hof Test', email: 'erika@example.org' })
)
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('NeuigkeitenKarte', () => {
  it('Titel, Hofname, Knopf und die Adresse, an die der Link geht', () => {
    expect(html).toContain(NEUIGKEITEN_TEXT.titel)
    expect(html).toContain('<strong class="font-semibold text-foreground">Hof Test</strong>')
    expect(text).toContain(NEUIGKEITEN_TEXT.knopf)
    expect(text).toContain(`${NEUIGKEITEN_TEXT.bestaetigen[0]} erika@example.org ${NEUIGKEITEN_TEXT.bestaetigen[1]}`)
  })

  it('ein Knopf ohne `disabled`, eine dauerhafte Statuszeile, der Weg zur Datenschutzerklärung', () => {
    expect(html).toMatch(/<button type="button"[^>]*aria-busy="false"/)
    expect(html).not.toMatch(/<button[^>]*disabled/)
    expect(html).toMatch(/<p role="status" class="sr-only">/)
    expect(html).toContain('href="/datenschutz"')
  })

  it('Outline statt Grün: die Hauptaktion der Seite bleibt „Bestellung ansehen"', () => {
    const knopf = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(knopf).toContain('border-border')
    expect(knopf).not.toContain('bg-accent')
    // Gegenprobe: ein grüner Knopf fiele auf.
    expect('<button class="bg-accent text-accent-foreground">').toContain('bg-accent')
  })

  it('der Dank verrät nicht, ob die Adresse schon angemeldet war', () => {
    expect(NEUIGKEITEN_TEXT.danke).toMatch(/^Danke! Falls du noch nicht angemeldet bist/)
    expect(NEUIGKEITEN_TEXT.danke).not.toMatch(/schon angemeldet\.|bereits angemeldet\./)
  })

  it('am Quelltext: zurück an den Server gehen nur Kennung und Signatur, nie die Adresse', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/components/bestaetigung/neuigkeiten-karte.tsx'), 'utf8')
    expect(quelle).toContain('meldeNeuigkeitenAn({ orderId, sig })')
    expect(quelle).not.toMatch(/meldeNeuigkeitenAn\(\{[^}]*email/)
    // Gegenprobe: ein Aufruf mit Adresse fiele auf.
    expect('meldeNeuigkeitenAn({ orderId, sig, email })').toMatch(/meldeNeuigkeitenAn\(\{[^}]*email/)
  })
})
