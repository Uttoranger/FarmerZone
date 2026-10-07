/**
 * BAES-Angaben im Kopfhinweis von „Deine Futtermittel-Registrierungen"
 * (Nachtlauf Nr. 36, freigabe.md §11) — gerendert und als Quelle.
 *
 * Beweist: Der Kopfhinweis verlinkt die FAQ-Seite des BAES zu Futtermitteln
 * und nennt E-Mail und Telefon der Behörde als anklickbare Links (mailto/tel).
 * Die Werte stehen genau einmal, neben BAES_FUTTERMITTEL_URL — die
 * Komponente hat keine eigene Kopie. Der Fall „abgepacktes Heimtierfutter"
 * spricht von einer Meldung beim BAES, nie von einer Registrierung (§ 8 Abs. 7
 * Futtermittelverordnung 2010), und ohne das Kürzel USP.
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { FutterRegistrierungen } from '@/components/produkte/futter-registrierungen'
import {
  BAES_FUTTERMITTEL_URL,
  BAES_KONTAKT,
  BAES_KONTAKT_MAILTO,
  BAES_KONTAKT_TEL,
  REGISTRIERUNGS_FAELLE,
  registrierungsSaetze,
  speichernHinweis,
} from '@/lib/futter-registrierung'
import { BETRIEBSSTATUS } from '@/lib/taxonomie'

function kopf(): string {
  return renderToStaticMarkup(
    createElement(FutterRegistrierungen, { registrierung: { betriebsnummer: null, betriebsstatus: null } })
  )
}

describe('Die Werte aus der Freigabe (Nr. 36)', () => {
  it('der Link führt auf die FAQ-Seite des BAES zu Futtermitteln', () => {
    expect(BAES_FUTTERMITTEL_URL).toBe('https://baes.gv.at/en/admission/feed/faq-feed')
  })

  it('E-Mail und Telefon der Behörde stehen so, wie die Freigabe sie nennt', () => {
    expect(BAES_KONTAKT.email).toBe('futtermittel@baes.gv.at')
    expect(BAES_KONTAKT.telefon).toBe('+43 5 0555 33216')
  })

  it('die Links wählen genau diese Adresse und Nummer — die Nummer ohne Leerzeichen', () => {
    expect(BAES_KONTAKT_MAILTO).toBe('mailto:futtermittel@baes.gv.at')
    expect(BAES_KONTAKT_TEL).toBe('tel:+435055533216')
  })
})

describe('Kopfhinweis im Futter-Formular', () => {
  it('verlinkt die BAES-Seite in einem neuen Tab, ohne Verweis-Angabe', () => {
    const html = kopf()
    expect(html).toContain(`href="${BAES_FUTTERMITTEL_URL}"`)
    expect(html).toMatch(/href="https:\/\/baes\.gv\.at[^"]*" target="_blank" rel="noopener noreferrer"/)
  })

  it('nennt E-Mail und Telefon als Links zum Schreiben und Anrufen', () => {
    const html = kopf()
    expect(html).toContain(`href="${BAES_KONTAKT_MAILTO}"`)
    expect(html).toContain(`href="${BAES_KONTAKT_TEL}"`)
    expect(html).toContain(`>${BAES_KONTAKT.email}<`)
    expect(html).toContain(`>${BAES_KONTAKT.telefon}<`)
  })

  it('jeder Link im Kopfhinweis hat sichtbaren Fokus und 44 px Trefferfläche', () => {
    const html = kopf()
    for (const href of [BAES_FUTTERMITTEL_URL, BAES_KONTAKT_MAILTO, BAES_KONTAKT_TEL]) {
      const tag = html.match(new RegExp(`<a[^>]*href="${href.replace(/[.+?]/g, '\\$&')}"[^>]*>`))?.[0] ?? ''
      expect(tag, href).toContain('min-h-11')
      expect(tag, href).toContain('focus-visible:outline-solid')
    }
  })
})

describe('Die Komponente hat keine eigene Kopie der Werte', () => {
  it('Adresse und Nummer kommen nur aus der Quelle', () => {
    const quelltext = readFileSync(join(__dirname, '..', 'src', 'components', 'produkte', 'futter-registrierungen.tsx'), 'utf8')
    expect(quelltext).toContain('BAES_KONTAKT')
    expect(quelltext).not.toContain('baes.gv.at')
    expect(quelltext).not.toContain('0555')
  })
})

describe('Abgepacktes Heimtierfutter: Meldung, keine Registrierung (§ 8 Abs. 7 FMV 2010)', () => {
  const heimtier = REGISTRIERUNGS_FAELLE.find((f) => f.id === 'heimtierfutter-abgepackt')!

  it('der Fall nennt die Meldung beim BAES und sagt, dass keine Registrierung nötig ist', () => {
    expect(heimtier.nachweis).toContain('Meldung beim BAES')
    expect(heimtier.nachweis).toContain('Registrierung brauchst du dafür nicht')
    expect(heimtier.nachweis).not.toContain('USP')
  })

  it('der orange Satz ohne Meldung spricht von Meldung statt Registrierung, ohne USP', () => {
    const satz = registrierungsSaetze({ betriebsnummer: null, betriebsstatus: null })[1]
    expect(satz.ton).toBe('orange')
    expect(satz.text).toContain('Meldung beim BAES')
    expect(satz.text).toContain('keine Registrierung')
    expect(satz.text).not.toContain('USP')
  })

  it('fertige Packungen anderer Hersteller: nur die Meldung beim BAES', () => {
    expect(REGISTRIERUNGS_FAELLE.find((f) => f.id === 'fertige-packungen')!.nachweis).toBe('keine Registrierung – nur Meldung beim BAES')
  })

  it('wartet alles auf die Meldung, nennt der Speichern-Satz Nummer und Meldung statt „Registrierung"', () => {
    const satz = speichernHinweis(0, 2)
    expect(satz).toContain('LFBIS-Nummer bzw. BAES-Meldung')
    expect(satz).not.toContain('Registrierung')
  })

  it('der Status „Registriert" im Hofprofil gilt auch für den Hof mit Meldung für Heimtierfutter', () => {
    expect(BETRIEBSSTATUS.REGISTRIERT.hilfe).toContain('gemeldet')
    expect(BETRIEBSSTATUS.REGISTRIERT.hilfe).toContain('Heimtierfutter')
  })
})
