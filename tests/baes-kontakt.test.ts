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
  BAES_KONTAKT_VORLESEN,
  BAES_LINK_TEXT,
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

  // Die Kontaktwerte selbst stehen nur in der Quelle (ARCHITECTURE §5), hier
  // nur ihre Form: Adresse beim BAES, österreichische Nummer.
  it('E-Mail und Telefon sind ein Kontakt beim BAES in Österreich', () => {
    expect(BAES_KONTAKT.email).toMatch(/^[a-z]+@baes\.gv\.at$/)
    expect(BAES_KONTAKT.telefon).toMatch(/^\+43( \d+)+$/)
  })

  it('die Links wählen genau diese Adresse und Nummer — die Nummer ohne Leerzeichen', () => {
    expect(BAES_KONTAKT_MAILTO).toBe(`mailto:${BAES_KONTAKT.email}`)
    expect(BAES_KONTAKT_TEL).toBe(`tel:${BAES_KONTAKT.telefon.replace(/ /g, '')}`)
    expect(BAES_KONTAKT_TEL).toMatch(/^tel:\+43\d+$/)
  })

  it('der Linktext sagt, dass die Seite englisch ist', () => {
    expect(BAES_LINK_TEXT).toContain('(englisch)')
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
    expect(html).toContain(`${BAES_KONTAKT_VORLESEN.email}</span>${BAES_KONTAKT.email}<`)
    expect(html).toContain(`${BAES_KONTAKT_VORLESEN.telefon}</span>${BAES_KONTAKT.telefon}<`)
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
  it('Adresse, Nummer und Vorlese-Texte kommen nur aus der Quelle', () => {
    const quelltext = readFileSync(join(__dirname, '..', 'src', 'components', 'produkte', 'futter-registrierungen.tsx'), 'utf8')
    expect(quelltext).toContain('BAES_KONTAKT_VORLESEN')
    expect(quelltext).not.toContain('baes.gv.at')
    expect(quelltext).not.toContain(BAES_KONTAKT.telefon.split(' ').at(-1))
    expect(quelltext).not.toContain(BAES_KONTAKT_VORLESEN.email.trim())
    expect(quelltext).not.toContain(BAES_KONTAKT_VORLESEN.telefon.trim())
  })
})

describe('Abgepacktes Heimtierfutter: Meldung, keine Registrierung (§ 8 Abs. 7 FMV 2010)', () => {
  const nachweis = (id: string): string | undefined => REGISTRIERUNGS_FAELLE.find((f) => f.id === id)?.nachweis

  it('der Fall nennt die Meldung beim BAES und sagt, dass keine Registrierung nötig ist', () => {
    expect(nachweis('heimtierfutter-abgepackt')).toContain('Meldung beim BAES')
    expect(nachweis('heimtierfutter-abgepackt')).toContain('Registrierung brauchst du dafür nicht')
    expect(nachweis('heimtierfutter-abgepackt')).not.toContain('USP')
  })

  it('der orange Satz ohne Meldung spricht von Meldung statt Registrierung, ohne USP', () => {
    const satz = registrierungsSaetze({ betriebsnummer: null, betriebsstatus: null })[1]
    expect(satz.ton).toBe('orange')
    expect(satz.text).toContain('Meldung beim BAES')
    expect(satz.text).toContain('keine Registrierung')
    expect(satz.text).not.toContain('USP')
  })

  it('fertige Packungen anderer Hersteller: nur die Meldung beim BAES', () => {
    expect(nachweis('fertige-packungen')).toBe('keine Registrierung – nur Meldung beim BAES')
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
