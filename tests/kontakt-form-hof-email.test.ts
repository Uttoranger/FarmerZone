/**
 * Mein Hof › Kontakt sagt dasselbe über die Hof-E-Mail wie das Profil (Nr. 194,
 * Nachbesserung Runde 1): Das Feld ist freiwillig, und leer heißt Anmelde-Adresse.
 * Beide Formulare bearbeiten Farm.email — ohne den Hinweis leerte der Hof das
 * Feld unter Mein Hof, ohne zu erfahren, wohin seine Bestellmeldungen dann gehen.
 *
 * Beweist (renderToStaticMarkup, kein DOM, kein Netz): Label mit „(freiwillig)",
 * HOF_EMAIL_HILFE unter dem Feld und per aria-describedby mit ihm verbunden; der
 * Satz darunter behauptet nicht mehr, die E-Mail stehe auf der Hofseite.
 * Gegenprobe: Das Telefon trägt keinen Freiwillig-Zusatz und keine Hilfe.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: unknown }) => createElement('a', { href }, children as never),
}))
vi.mock('@/components/mein-hof/abschnitt-speichern', () => ({
  speichereAuftritt: vi.fn(),
  speichereProfil: vi.fn(),
  speichernOhneWurf: vi.fn(),
}))

import { KontaktForm } from '@/components/mein-hof/abschnitt-formulare'
import { FREIWILLIG, HOF_EMAIL_HILFE } from '@/lib/profil-meldungen'
import type { FarmSettings } from '@/server/queries/farm'

function zeichne(email: string): string {
  const einstellungen = { name: 'Hof Beispiel', ownerName: 'Erfunden', phone: '0123 456', email } as unknown as FarmSettings
  return renderToStaticMarkup(createElement(KontaktForm, { einstellungen, onGespeichert: vi.fn(), onAbbrechen: vi.fn() }))
}

/** Text ohne Tags, Entitäten aufgelöst, wie ihn ein Mensch liest. */
function text(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')
}

describe('KontaktForm unter Mein Hof: Hof-E-Mail', () => {
  it.each(['', 'hof@example.org'])('Label freiwillig, Hinweis auf die Anmelde-Adresse (gespeichert: "%s")', (email) => {
    const html = zeichne(email)
    expect(text(html)).toContain(`E-Mail ${FREIWILLIG}`)
    expect(text(html)).toContain(HOF_EMAIL_HILFE)
    expect(html).toMatch(/<input[^>]*id="hofseite-email"[^>]*aria-describedby="hofseite-email-hilfe"/)
    expect(html).toContain('<p id="hofseite-email-hilfe"')
  })

  it('der Satz unter den Feldern widerspricht dem Hinweis nicht', () => {
    const html = zeichne('')
    expect(text(html)).not.toContain('Beides steht')
    expect(text(html)).not.toMatch(/E-Mail[^.]*Hofseite/)
  })

  it('Gegenprobe: Telefon ohne Freiwillig-Zusatz und ohne Hilfe', () => {
    const html = zeichne('')
    expect(text(html)).not.toContain(`Telefon ${FREIWILLIG}`)
    expect(html).not.toMatch(/<input[^>]*id="hofseite-telefon"[^>]*aria-describedby/)
  })
})
