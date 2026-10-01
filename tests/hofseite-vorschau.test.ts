/**
 * Tests für den Vorschau-Modus der Hofseite (src/lib/hofseite-vorschau.ts,
 * src/schemas/hofseite-vorschau.ts).
 *
 * Beweist:
 *  - (Wer die Vorschau bekommt: tests/ansichts-modus.test.ts; nicht
 *    freigegebener Hof: tests/hofseite-vorschau-laden.test.ts.)
 *  - Einen Korb gibt es nur, wo Kaufen wirkt und nicht bearbeitet wird —
 *    nicht im Bearbeitungsmodus, nicht in der Vorschau; und product-grid kennt
 *    keinen zweiten Maßstab neben dieser Regel.
 *  - Markierung und Bereit-Meldung werden nur vom eigenen Ursprung und nur in
 *    der vereinbarten Form gelesen.
 *  - Die Seite lädt den Hof nur über den Lader und setzt noindex; im
 *    Vorschau-Modus bestellt der Kaufknopf nichts und legt keinen Korb an.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BEREIT_TYP, MARKIERUNG_TYP, markierungSchema } from '@/schemas/hofseite-vorschau'
import {
  VORSCHAU_KAUF_HINWEIS,
  VORSCHAU_SEITENBREITE,
  VORSCHAU_WEB_MINDESTBREITE,
  korbErlaubt,
  leseBereit,
  leseMarkierung,
  verlaesstRahmen,
  vorschauAdresse,
  vorschauLink,
  vorschauMassstab,
  VORSCHAU_BEARBEITUNG_BREITE,
} from '@/lib/hofseite-vorschau'

const quelltext = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('verlaesstRahmen — welcher Klick im Rahmen einen neuen Tab öffnet', () => {
  const HIER = 'https://farmerzone.example/hof-test?vorschau=1&stand=2'
  const link = (href: string, target = '') => ({ href, target })

  it('andere Seiten des eigenen Ursprungs und fremde Seiten verlassen den Rahmen', () => {
    expect(verlaesstRahmen(link('/impressum'), HIER)).toBe(true)
    expect(verlaesstRahmen(link('https://farmerzone.example/hof-test/bestellung/abc'), HIER)).toBe(true)
    expect(verlaesstRahmen(link('https://karten.example/?q=hof'), HIER)).toBe(true)
  })

  it('Anker und andere Bereiche derselben Seite bleiben im Rahmen', () => {
    expect(verlaesstRahmen(link('#fotos'), HIER)).toBe(false)
    expect(verlaesstRahmen(link('https://farmerzone.example/hof-test#warenkorb'), HIER)).toBe(false)
    expect(verlaesstRahmen(link('/hof-test?bereich=futter'), HIER)).toBe(false)
  })

  it('tel:, mailto:, javascript: und Unlesbares regelt der Browser', () => {
    expect(verlaesstRahmen(link('tel:+43660000000'), HIER)).toBe(false)
    expect(verlaesstRahmen(link('mailto:hof@example.com'), HIER)).toBe(false)
    expect(verlaesstRahmen(link('javascript:void(0)'), HIER)).toBe(false)
    expect(verlaesstRahmen(link('http://[unlesbar'), HIER)).toBe(false)
  })

  it('ein Link, der ohnehin einen neuen Tab öffnet, bleibt dem Browser', () => {
    expect(verlaesstRahmen(link('https://karten.example/?q=hof', '_blank'), HIER)).toBe(false)
  })
})

describe('korbErlaubt', () => {
  it('einen Korb gibt es nur, wo Kaufen wirkt und nicht bearbeitet wird', () => {
    expect(korbErlaubt({ isEditMode: false, kaufen: true })).toBe(true)
    expect(korbErlaubt({ isEditMode: true, kaufen: true })).toBe(false)
    expect(korbErlaubt({ isEditMode: false, kaufen: false })).toBe(false)
    expect(korbErlaubt({ isEditMode: true, kaufen: false })).toBe(false)
  })
})

describe('Markierung', () => {
  const URSPRUNG = 'https://farmerzone.example'
  const nachricht = { typ: MARKIERUNG_TYP, abschnitt: 'fotos' }

  it('liest die Kennung vom eigenen Ursprung', () => {
    expect(leseMarkierung({ origin: URSPRUNG, data: nachricht }, URSPRUNG)).toBe('fotos')
    expect(leseMarkierung({ origin: URSPRUNG, data: { ...nachricht, abschnitt: null } }, URSPRUNG)).toBeNull()
  })

  it('ignoriert fremde Ursprünge, auch mit passender Nachricht', () => {
    expect(leseMarkierung({ origin: 'https://fremd.example', data: nachricht }, URSPRUNG)).toBeNull()
  })

  it('ignoriert alles, was nicht die vereinbarte Form hat', () => {
    for (const data of [null, 'fotos', { typ: MARKIERUNG_TYP }, { typ: 'anders', abschnitt: 'fotos' }, { typ: MARKIERUNG_TYP, abschnitt: 'unbekannt' }]) {
      expect(leseMarkierung({ origin: URSPRUNG, data }, URSPRUNG), JSON.stringify(data)).toBeNull()
    }
    expect(markierungSchema.safeParse({ typ: MARKIERUNG_TYP, abschnitt: 'titelbild' }).success).toBe(true)
  })
})

describe('Bereit-Meldung', () => {
  const URSPRUNG = 'https://farmerzone.example'

  it('gilt nur vom eigenen Ursprung und nur in der vereinbarten Form', () => {
    expect(leseBereit({ origin: URSPRUNG, data: { typ: BEREIT_TYP } }, URSPRUNG)).toBe(true)
    expect(leseBereit({ origin: 'https://fremd.example', data: { typ: BEREIT_TYP } }, URSPRUNG)).toBe(false)
    for (const data of [null, BEREIT_TYP, { typ: MARKIERUNG_TYP, abschnitt: null }, { typ: 'anders' }]) {
      expect(leseBereit({ origin: URSPRUNG, data }, URSPRUNG), JSON.stringify(data)).toBe(false)
    }
  })

  it('Markierung und Bereit-Meldung sind zwei Typen mit demselben Präfix', () => {
    expect(BEREIT_TYP).not.toBe(MARKIERUNG_TYP)
    expect(BEREIT_TYP.startsWith('farmerzone:')).toBe(true)
    expect(MARKIERUNG_TYP.startsWith('farmerzone:')).toBe(true)
  })
})

describe('Maßstab und Gerät der Vorschau', () => {
  it('Web: Rahmenbreite geteilt durch 1440, nie über 1', () => {
    expect(vorschauMassstab({ breite: 720 }, 'web')).toBeCloseTo(0.5, 6)
    expect(vorschauMassstab({ breite: 644 }, 'web')).toBeCloseTo(644 / 1440, 6)
    expect(vorschauMassstab({ breite: 2000 }, 'web')).toBe(1)
    // Die Höhe spielt im Web keine Rolle — die Seite scrollt im Rahmen.
    expect(vorschauMassstab({ breite: 720, hoehe: 100 }, 'web')).toBeCloseTo(0.5, 6)
  })

  it('Handy: Rahmenbreite geteilt durch 390; mit Höhe zählt die engere Seite', () => {
    expect(vorschauMassstab({ breite: 304 }, 'handy')).toBeCloseTo(304 / 390, 6)
    expect(vorschauMassstab({ breite: 390 }, 'handy')).toBe(1)
    expect(vorschauMassstab({ breite: 600, hoehe: 422 }, 'handy')).toBeCloseTo(0.5, 6)
    expect(vorschauMassstab({ breite: 0 }, 'handy')).toBe(1)
  })

  it('die Web-Vorschau passt erst ab 1280 px neben die Bearbeitung, die dann 400 px behält', () => {
    expect(VORSCHAU_WEB_MINDESTBREITE).toBe(1280)
    expect(VORSCHAU_BEARBEITUNG_BREITE).toBe(400)
    // Der Editor fragt die Fensterbreite genau mit dieser Grenze ab.
    expect(quelltext('src/components/farmer/hofseite-editor.tsx')).toContain('useMindestbreite(VORSCHAU_WEB_MINDESTBREITE)')
  })

  it('die Seitenbreiten sind die der Mockups', () => {
    expect(VORSCHAU_SEITENBREITE).toEqual({ handy: 390, web: 1440 })
  })
})

describe('Vorschau-Adresse', () => {
  it('trägt den Parameter und einen Stand, der das Neuladen erzwingt', () => {
    expect(vorschauAdresse('hof-test', 3)).toBe('/hof-test?vorschau=1&stand=3')
    expect(vorschauLink('hof-test')).toBe('/hof-test?vorschau=1')
  })
})

describe('am Quelltext', () => {
  it('die Hofseite lädt nur über den Lader, der ansichtsModus fragt, und setzt noindex nach seinem Ergebnis', () => {
    const seite = quelltext('src/app/(public)/[farmSlug]/page.tsx')
    expect(seite).toContain('ladeHofseiteGeteilt(')
    expect(seite).not.toContain('getPublicFarm')
    expect(seite).toMatch(/ansicht\.noindex \? \{ robots: \{ index: false/)
    const lader = quelltext('src/server/hofseite-vorschau.ts')
    expect(lader).toContain('await ansichtsModus(suche, {')
    // Vor der Freigabe sichtbar nur, wenn ansichtsModus den Besitzer nennt.
    expect(lader).toContain('besitzerVorFreigabe ? await getOwnerFarm(besitzerVorFreigabe) : await getPublicFarm(farmSlug)')
  })

  it('die Seite lädt den Nachbestell-Link nur, wo Kaufen wirkt', () => {
    const seite = quelltext('src/app/(public)/[farmSlug]/page.tsx')
    expect(seite).toMatch(/reorder && ansicht\.kaufen \? await loadReorderItems/)
  })

  it('jeder Weg in den Korb läuft über korbErlaubt — Kaufknopf, Nachbestell-Link, Anker, Knopf, Sheet', () => {
    const raster = quelltext('src/components/farm/product-grid.tsx')
    expect(raster).toContain('const mitKorb = korbErlaubt({ isEditMode, kaufen })')
    // Kein zweiter Maßstab neben der Regel.
    expect(raster).not.toMatch(/!isEditMode && kaufen/)
    expect(raster).not.toMatch(/if \(!?kaufen\)/)
    expect(raster).not.toMatch(/if \(isEditMode\) return/)
    // Nachbestell-Link: der Effekt bricht vor dem ersten addItem ab.
    const nachbestellung = raster.slice(raster.indexOf('Den Korb aus dem Nachbestell-Link'), raster.indexOf('async function handleAddToCart'))
    expect(nachbestellung.indexOf('if (!mitKorb) return')).toBeGreaterThan(-1)
    expect(nachbestellung.indexOf('if (!mitKorb) return')).toBeLessThan(nachbestellung.indexOf('addItem('))
    // Kaufknopf: der Hinweis kommt VOR dem ersten Griff in den Korb — sonst wäre er schon angelegt.
    const kauf = raster.slice(raster.indexOf('async function handleAddToCart'), raster.indexOf('setAddingId(product.id)'))
    expect(kauf).toContain('VORSCHAU_KAUF_HINWEIS')
    expect(kauf).toMatch(/if \(!mitKorb\)/)
    expect(VORSCHAU_KAUF_HINWEIS).not.toMatch(/shop/i)
    // Anker, Korb-Knopf, Sheet.
    expect(raster).toContain('if (!mitKorb || !isHydrated) return')
    expect(raster).toMatch(/\{mitKorb && isHydrated && count > 0 &&/)
    expect(raster).toMatch(/\{mitKorb && \(\s*<CartSheet/)
  })
})
