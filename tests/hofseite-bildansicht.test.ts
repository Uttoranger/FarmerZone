/**
 * Tests für die Bildansicht (Lightbox) der Hofseite — Meldung cmua8bof.
 *
 * Beweist:
 *  - Nach dem Schließen steht die Seite genau dort, wo sie beim Öffnen stand
 *    (stelleNachBildansicht, rein). Die Sperre über body.style.overflow hält
 *    nicht überall: Auf iOS greift sie bei eingeklappter Safari-Leiste nicht,
 *    die Seite wandert unter dem Bild weg.
 *  - Nur beim echten Schließen: Wer die Hofseite bei offenem Bild verlässt,
 *    bekommt die neue Seite nicht auf die Stelle der alten geschoben.
 *  - Die Fotoansicht nutzt diese Regel beim Aufheben der Sperre, setzt den
 *    Merker nur beim regulären Schließen und gibt den Fokus ohne Scrollen an
 *    die Kachel zurück — ein focus() ohne preventScroll entschiede sonst
 *    selbst, wohin die Seite rollt.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stelleNachBildansicht } from '@/lib/hofseite-sektionen'

const quelltext = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('stelleNachBildansicht', () => {
  it('lässt die Seite in Ruhe, wenn sie sich nicht bewegt hat', () => {
    expect(stelleNachBildansicht({ beimOeffnen: 826, jetzt: 826, geschlossen: true })).toBeNull()
  })

  it('holt die Seite an die Stelle zurück, an der das Bild geöffnet wurde', () => {
    expect(stelleNachBildansicht({ beimOeffnen: 826, jetzt: 1725, geschlossen: true })).toBe(826)
    expect(stelleNachBildansicht({ beimOeffnen: 826, jetzt: 0, geschlossen: true })).toBe(826)
  })

  it('übersieht Bruchteile eines Pixels — hochauflösende Bildschirme melden krumme Werte', () => {
    expect(stelleNachBildansicht({ beimOeffnen: 826, jetzt: 826.5, geschlossen: true })).toBeNull()
    expect(stelleNachBildansicht({ beimOeffnen: 826, jetzt: 827, geschlossen: true })).toBe(826)
  })

  it('springt nicht, wenn die Seite bei offenem Bild verlassen wurde — die neue Seite gehört nicht dorthin', () => {
    expect(stelleNachBildansicht({ beimOeffnen: 826, jetzt: 0, geschlossen: false })).toBeNull()
    expect(stelleNachBildansicht({ beimOeffnen: 826, jetzt: 1725, geschlossen: false })).toBeNull()
  })
})

describe('Bildansicht der Hofseite — am Quelltext', () => {
  const text = quelltext('src/components/farm/farm-page-view.tsx')

  it('merkt sich beim Sperren die Stelle und stellt sie beim Aufheben über die Regel wieder her', () => {
    const sperre = text.slice(
      text.indexOf("document.body.style.overflow = 'hidden'") - 400,
      text.indexOf('}, [lightboxOffen])')
    )
    expect(sperre).toContain('window.scrollY')
    expect(sperre).toMatch(/stelleNachBildansicht\(\{/)
    expect(sperre).toMatch(/geschlossen:\s*\w+\.current/)
    expect(sperre).toMatch(/window\.scrollTo\(/)
  })

  it('setzt den Merker nur im regulären Schließen — nicht beim Verlassen der Seite', () => {
    const schliessen = text.slice(
      text.indexOf('function schliesseLightbox()'),
      text.indexOf('ausloeser.current?.focus')
    )
    expect(schliessen).toMatch(/regulaerGeschlossen\.current = true/)
    // Genau eine Stelle setzt ihn; die Sperre nimmt ihn beim Öffnen zurück.
    expect(text.match(/regulaerGeschlossen\.current = true/g)).toHaveLength(1)
    expect(text).toMatch(/regulaerGeschlossen\.current = false/)
  })

  it('gibt den Fokus ohne Scrollen an die Kachel zurück', () => {
    expect(text).toMatch(/ausloeser\.current\?\.focus\(\{\s*preventScroll:\s*true\s*\}\)/)
    expect(text).not.toMatch(/ausloeser\.current\?\.focus\(\)/)
  })
})
