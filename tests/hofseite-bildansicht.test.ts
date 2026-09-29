/**
 * Tests für die Bildansicht (Lightbox) der Hofseite — Meldung cmua8bof.
 *
 * Beweist:
 *  - Nach dem Schließen steht die Seite genau dort, wo sie beim Öffnen stand
 *    (scrollNachBildansicht, rein). Die Sperre über body.style.overflow hält
 *    nicht überall: Auf iOS greift sie bei eingeklappter Safari-Leiste nicht,
 *    die Seite wandert unter dem Bild weg.
 *  - Die Fotoansicht nutzt diese Regel beim Aufheben der Sperre und gibt den
 *    Fokus ohne Scrollen an die Kachel zurück — ein focus() ohne
 *    preventScroll entschiede sonst selbst, wohin die Seite rollt.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scrollNachBildansicht } from '@/lib/hofseite-sektionen'

const quelltext = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('scrollNachBildansicht', () => {
  it('lässt die Seite in Ruhe, wenn sie sich nicht bewegt hat', () => {
    expect(scrollNachBildansicht({ beimOeffnen: 826, jetzt: 826 })).toBeNull()
  })

  it('holt die Seite an die Stelle zurück, an der das Bild geöffnet wurde', () => {
    expect(scrollNachBildansicht({ beimOeffnen: 826, jetzt: 1725 })).toBe(826)
    expect(scrollNachBildansicht({ beimOeffnen: 826, jetzt: 0 })).toBe(826)
  })

  it('übersieht Bruchteile eines Pixels — hochauflösende Bildschirme melden krumme Werte', () => {
    expect(scrollNachBildansicht({ beimOeffnen: 826, jetzt: 826.5 })).toBeNull()
    expect(scrollNachBildansicht({ beimOeffnen: 826, jetzt: 827 })).toBe(826)
  })
})

describe('Bildansicht der Hofseite — am Quelltext', () => {
  const text = quelltext('src/components/farm/farm-page-view.tsx')

  it('merkt sich beim Sperren die Stelle und stellt sie beim Aufheben wieder her', () => {
    const sperre = text.slice(text.indexOf("document.body.style.overflow = 'hidden'") - 400, text.indexOf('}, [lightboxOffen])'))
    expect(sperre).toContain('window.scrollY')
    expect(sperre).toMatch(/scrollNachBildansicht\(/)
    expect(sperre).toMatch(/window\.scrollTo\(/)
  })

  it('gibt den Fokus ohne Scrollen an die Kachel zurück', () => {
    expect(text).toMatch(/ausloeser\.current\?\.focus\(\{\s*preventScroll:\s*true\s*\}\)/)
    expect(text).not.toMatch(/ausloeser\.current\?\.focus\(\)/)
  })
})
