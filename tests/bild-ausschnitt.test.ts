/**
 * Ausschnitt, Zoom und Filter eines Fotos (Register N13/N17, Nachtlauf Nr. 97) —
 * Format, Lesen, Stil und Rechnung, ohne Mock.
 *
 * Beweist:
 *  - Das Format ist streng: Fokus 0–100 und Zoom 100–250 als ganze Zahlen, einer
 *    der sechs Filter, die Wahl füllen/ganz nur als AUTO, FUELLEN oder GANZ; ein
 *    fremder Schlüssel (eine Hof-Kennung) macht ihn ungültig.
 *  - leseAusschnitt macht aus allem, was nicht passt, null (= wie vorher) — nie
 *    einen Fehler.
 *  - bildStil liefert Fokus, Zoom um den Fokus und den Filter; ohne Filter, mit
 *    Natürlich und ohne Ausschnitt entsprechend weniger. Die sechs Filter sind
 *    die des Mockups, keiner dreht die Farben (hue-rotate).
 *  - Die Rechnung: Bei object-cover, object-position und scale um den Fokus liegt
 *    der Bildpunkt (fx, fy) in jedem Rahmen an derselben relativen Stelle —
 *    gezeigt an 1920 × 420, 768 × 300 und 390 × 220 für ein Foto 2000 × 2000 bei
 *    fx 0,5 / fy 0,64 / Zoom 115 %. Darum reicht EIN Ausschnitt für alle Rahmen.
 *  - Ziehen: Das Foto folgt dem Finger, gerechnet vom Aufsetzen; am Rand ist
 *    Schluss; eine Achse, in der das Foto genau passt, bleibt stehen.
 *  - Pfeiltasten verschieben um 2 %, mit Umschalt um 10 %; andere Tasten nichts.
 *  - Was „Speichern“ schickt: je Ziel ein eigener Wert; das Logo nur ohne Filter.
 */
import { describe, expect, it } from 'vitest'
import {
  BILD_FILTER,
  ausschnittNachTaste,
  ausschnittNachZiehen,
  bildLage,
  bildStil,
  filterMit,
  nurFilterStil,
} from '@/lib/bild-ausschnitt'
import { BILD_FILTER_NAMEN, bildAusschnittSchema, bildAusschnittSpeichernSchema, leseAusschnitt, type BildAusschnitt } from '@/schemas/bild-ausschnitt'

const GUELTIG: BildAusschnitt = { fokusX: 50, fokusY: 64, zoom: 115, filter: 'WARM' }

describe('bildAusschnittSchema (ein Format für alle Fotos)', () => {
  it.each([
    ['Fokus an den Rändern', { ...GUELTIG, fokusX: 0, fokusY: 100 }],
    ['Zoom an den Grenzen (100)', { ...GUELTIG, zoom: 100 }],
    ['Zoom an den Grenzen (250)', { ...GUELTIG, zoom: 250 }],
    ['mit Wahl GANZ', { ...GUELTIG, darstellung: 'GANZ' }],
    ['mit Wahl AUTO', { ...GUELTIG, darstellung: 'AUTO' }],
  ])('nimmt %s', (_name, wert) => {
    expect(bildAusschnittSchema.safeParse(wert).success).toBe(true)
  })

  it.each([
    ['Fokus unter 0', { ...GUELTIG, fokusX: -1 }],
    ['Fokus über 100', { ...GUELTIG, fokusY: 101 }],
    ['Fokus mit Komma', { ...GUELTIG, fokusX: 50.5 }],
    ['Zoom unter 100', { ...GUELTIG, zoom: 99 }],
    ['Zoom über 250', { ...GUELTIG, zoom: 251 }],
    ['einen unbekannten Filter', { ...GUELTIG, filter: 'VINTAGE' }],
    ['eine unbekannte Wahl', { ...GUELTIG, darstellung: 'STRECKEN' }],
    ['einen fremden Schlüssel (Hof-Kennung)', { ...GUELTIG, farmId: 'fremder-hof' }],
    ['Zahlen als Text', { ...GUELTIG, zoom: '115' }],
  ])('weist %s ab', (_name, wert) => {
    expect(bildAusschnittSchema.safeParse(wert).success).toBe(false)
  })
})

describe('leseAusschnitt (gespeichertes Json)', () => {
  it('gibt einen gültigen Wert zurück', () => {
    expect(leseAusschnitt(GUELTIG)).toEqual(GUELTIG)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['eine Zahl', 42],
    ['einen Text', 'WARM'],
    ['eine Liste', [GUELTIG]],
    ['ein leeres Objekt', {}],
    ['einen Wert außerhalb der Grenzen', { ...GUELTIG, zoom: 900 }],
    ['einen fremden Filter', { ...GUELTIG, filter: 'HUE' }],
  ])('macht aus %s null — die Seite zeigt das Foto wie vorher', (_name, json) => {
    expect(leseAusschnitt(json)).toBeNull()
  })
})

describe('bildStil (ein Stil für jeden Rahmen)', () => {
  it('liefert Fokus, Zoom um den Fokus und den Filter', () => {
    expect(bildStil(GUELTIG)).toEqual({
      objectPosition: '50% 64%',
      transform: 'scale(1.15)',
      transformOrigin: '50% 64%',
      filter: 'sepia(0.22) saturate(1.2)',
    })
  })

  it('lässt den Filter weg, wenn der Aufrufer ihn nicht will (Logo, Kopie mit eigenem Filter)', () => {
    expect(bildStil(GUELTIG, { filter: false })).toEqual({ objectPosition: '50% 64%', transform: 'scale(1.15)', transformOrigin: '50% 64%' })
  })

  it('setzt bei Natürlich keinen Filter', () => {
    expect(bildStil({ ...GUELTIG, filter: 'NATUERLICH' })).not.toHaveProperty('filter')
  })

  it('ohne Ausschnitt nichts — das Foto steht wie vorher', () => {
    expect(bildStil(null)).toEqual({})
  })

  it('stellt einen Filter davor in EINER Angabe zusammen (Weichzeichner der Kopie)', () => {
    expect(filterMit('blur(28px)', GUELTIG)).toBe('blur(28px) sepia(0.22) saturate(1.2)')
    expect(filterMit('blur(28px)', { ...GUELTIG, filter: 'NATUERLICH' })).toBe('blur(28px)')
    expect(filterMit('blur(28px)', null)).toBe('blur(28px)')
  })

  it('kennt genau die sechs Filter des Mockups, keiner dreht die Farben', () => {
    expect(Object.keys(BILD_FILTER)).toEqual([...BILD_FILTER_NAMEN])
    expect(BILD_FILTER).toEqual({
      NATUERLICH: '',
      KLAR: 'contrast(1.08) brightness(1.03) saturate(1.05)',
      WARM: 'sepia(0.22) saturate(1.2)',
      KRAEFTIG: 'contrast(1.12) saturate(1.35)',
      SANFT: 'contrast(0.9) brightness(1.07) saturate(0.85)',
      SCHWARZWEISS: 'grayscale(1) contrast(1.1)',
    })
    for (const css of Object.values(BILD_FILTER)) expect(css).not.toContain('hue-rotate')
  })
})

describe('bildLage (ein Ausschnitt für jede Rahmengröße)', () => {
  const FOTO = { breite: 2000, hoehe: 2000 }
  const AUSSCHNITT = { fokusX: 50, fokusY: 64, zoom: 115 }

  it.each([
    ['Computer, breit', { breite: 1920, hoehe: 420 }],
    ['Computer, schmal', { breite: 768, hoehe: 300 }],
    ['Handy', { breite: 390, hoehe: 220 }],
  ])('%s: der Bildpunkt (0,5 | 0,64) liegt bei 50 % | 64 % des Rahmens, und das Foto deckt den Rahmen', (_name, rahmen) => {
    const lage = bildLage(rahmen, FOTO, AUSSCHNITT)
    // cover: das Foto auf die größere Seite gestellt, dann 115 %.
    const s0 = Math.max(rahmen.breite / FOTO.breite, rahmen.hoehe / FOTO.hoehe)
    expect(lage.breite).toBeCloseTo(FOTO.breite * s0 * 1.15, 6)
    expect(lage.hoehe).toBeCloseTo(FOTO.hoehe * s0 * 1.15, 6)
    // Der Bildpunkt unter dem Fokus bleibt fest.
    expect(lage.links + 0.5 * lage.breite).toBeCloseTo(0.5 * rahmen.breite, 6)
    expect(lage.oben + 0.64 * lage.hoehe).toBeCloseTo(0.64 * rahmen.hoehe, 6)
    // Kein Rand bleibt frei.
    expect(lage.links).toBeLessThanOrEqual(0)
    expect(lage.oben).toBeLessThanOrEqual(0)
    expect(lage.links + lage.breite).toBeGreaterThanOrEqual(rahmen.breite)
    expect(lage.oben + lage.hoehe).toBeGreaterThanOrEqual(rahmen.hoehe)
  })

  it('1920 × 420 in Zahlen: 2208 px breit, 144 px links und 1144,32 px oben über den Rahmen hinaus', () => {
    const lage = bildLage({ breite: 1920, hoehe: 420 }, FOTO, AUSSCHNITT)
    expect(lage.breite).toBeCloseTo(2208, 6)
    expect(lage.links).toBeCloseTo(-144, 6)
    expect(lage.oben).toBeCloseTo(-1144.32, 6)
  })

  it('rechnet im Verhältnis so wie in Pixeln (die blasse Fortsetzung liegt in Prozent)', () => {
    const inPixeln = bildLage({ breite: 360, hoehe: 100 }, FOTO, AUSSCHNITT)
    const imVerhaeltnis = bildLage({ breite: 3.6, hoehe: 1 }, FOTO, AUSSCHNITT)
    expect(imVerhaeltnis.links * 100).toBeCloseTo(inPixeln.links, 6)
    expect(imVerhaeltnis.oben * 100).toBeCloseTo(inPixeln.oben, 6)
  })
})

describe('ausschnittNachZiehen (das Foto folgt dem Finger)', () => {
  const FOTO = { breite: 2000, hoehe: 2000 }
  // Rahmen am Handy, ~100 px hoch: Das Quadrat ist 412 px hoch, 312 px Spiel senkrecht, keins waagrecht.
  const RAHMEN = { breite: 358, hoehe: 100 }
  const START = { fokusX: 50, fokusY: 50, zoom: 115 }

  it('nach unten ziehen zeigt mehr vom oberen Rand: der Fokus wandert nach oben', () => {
    const lage = bildLage(RAHMEN, FOTO, START)
    const spiel = RAHMEN.hoehe - lage.hoehe
    const nachher = ausschnittNachZiehen(START, { dx: 0, dy: 31 }, RAHMEN, FOTO)
    expect(nachher.fokusY).toBe(Math.round(50 + (100 * 31) / spiel))
    expect(nachher.fokusY).toBeLessThan(50)
    // Das Foto ist dem Finger gefolgt: 31 px nach unten, bis auf die Rundung auf ganze Prozent.
    const oben = bildLage(RAHMEN, FOTO, { ...START, ...nachher }).oben
    expect(Math.abs(oben - (lage.oben + 31))).toBeLessThanOrEqual(Math.abs(spiel) / 200)
  })

  it('waagrecht passt das Foto bei 115 % noch über — dort bewegt es sich auch', () => {
    const nachher = ausschnittNachZiehen(START, { dx: -20, dy: 0 }, RAHMEN, FOTO)
    expect(nachher.fokusX).toBeGreaterThan(50)
  })

  it('am Rand ist Schluss (0 und 100)', () => {
    expect(ausschnittNachZiehen(START, { dx: 0, dy: 5000 }, RAHMEN, FOTO).fokusY).toBe(0)
    expect(ausschnittNachZiehen(START, { dx: 0, dy: -5000 }, RAHMEN, FOTO).fokusY).toBe(100)
  })

  it('eine Achse, in der das Foto genau passt, bleibt stehen (100 %, Quadrat im Quadrat)', () => {
    const nachher = ausschnittNachZiehen({ fokusX: 40, fokusY: 60, zoom: 100 }, { dx: 80, dy: -80 }, { breite: 200, hoehe: 200 }, FOTO)
    expect(nachher).toEqual({ fokusX: 40, fokusY: 60 })
  })

  it('rechnet vom Aufsetzen: derselbe Zug ergibt dasselbe, kein Springen beim Loslassen', () => {
    const einmal = ausschnittNachZiehen(START, { dx: 10, dy: 40 }, RAHMEN, FOTO)
    const nochmal = ausschnittNachZiehen(START, { dx: 10, dy: 40 }, RAHMEN, FOTO)
    expect(nochmal).toEqual(einmal)
    expect(Number.isInteger(einmal.fokusX) && Number.isInteger(einmal.fokusY)).toBe(true)
  })
})

describe('ausschnittNachTaste (WCAG 2.1.1)', () => {
  // Quadrat im Rahmen 2 : 1, Zoom 150 %: Das Foto ragt auf beiden Achsen über den Rahmen — beide haben Spiel.
  const RAHMEN = { breite: 2, hoehe: 1 }
  const QUADRAT = { breite: 1000, hoehe: 1000 }
  const WERT = { fokusX: 50, fokusY: 50, zoom: 150 }

  it.each([
    ['ArrowRight', false, { fokusX: 48, fokusY: 50 }],
    ['ArrowLeft', false, { fokusX: 52, fokusY: 50 }],
    ['ArrowDown', false, { fokusX: 50, fokusY: 48 }],
    ['ArrowUp', false, { fokusX: 50, fokusY: 52 }],
    ['ArrowRight', true, { fokusX: 40, fokusY: 50 }],
    ['ArrowUp', true, { fokusX: 50, fokusY: 60 }],
  ])('%s (Umschalt: %s) verschiebt das Foto in Pfeilrichtung', (taste, umschalt, erwartet) => {
    expect(ausschnittNachTaste(WERT, taste, umschalt, RAHMEN, QUADRAT)).toEqual(erwartet)
  })

  it('bleibt in 0–100', () => {
    expect(ausschnittNachTaste({ fokusX: 1, fokusY: 99, zoom: 150 }, 'ArrowRight', true, RAHMEN, QUADRAT)).toEqual({ fokusX: 0, fokusY: 99 })
    expect(ausschnittNachTaste({ fokusX: 1, fokusY: 99, zoom: 150 }, 'ArrowUp', true, RAHMEN, QUADRAT)).toEqual({ fokusX: 1, fokusY: 100 })
  })

  it('verschiebt nur auf einer Achse mit Spiel — Quadrat im Rahmen 3,6 : 1 bei 100 %: ←/→ tun nichts, ↑/↓ schon', () => {
    const titelbild = { breite: 3.6, hoehe: 1 }
    const wert = { fokusX: 50, fokusY: 50, zoom: 100 }
    expect(ausschnittNachTaste(wert, 'ArrowRight', false, titelbild, QUADRAT)).toEqual({ fokusX: 50, fokusY: 50 })
    expect(ausschnittNachTaste(wert, 'ArrowLeft', true, titelbild, QUADRAT)).toEqual({ fokusX: 50, fokusY: 50 })
    expect(ausschnittNachTaste(wert, 'ArrowUp', false, titelbild, QUADRAT)).toEqual({ fokusX: 50, fokusY: 52 })
    // Gegenprobe: gezoomt ragt das Foto auch waagrecht hinaus — dann wirkt → wieder.
    expect(ausschnittNachTaste({ ...wert, zoom: 250 }, 'ArrowRight', false, titelbild, QUADRAT)).toEqual({ fokusX: 48, fokusY: 50 })
  })

  it('füllt das Foto den Rahmen genau, zählt die Achse als ohne Spiel (Kommazahlen-Rest)', () => {
    // 3 : 1 im Rahmen 3 : 1 — rechnerisch 0 Spiel, mit Kommazahlen ein winziger Rest.
    expect(ausschnittNachTaste({ fokusX: 50, fokusY: 50, zoom: 100 }, 'ArrowUp', false, { breite: 3, hoehe: 1 }, { breite: 0.3 * 10, hoehe: 1 })).toEqual({ fokusX: 50, fokusY: 50 })
  })

  it('ohne Maße (das Foto lädt noch) bleibt der Fokus stehen — die Taste gilt trotzdem als erkannt', () => {
    expect(ausschnittNachTaste(WERT, 'ArrowRight', false, RAHMEN, null)).toEqual({ fokusX: 50, fokusY: 50 })
  })

  it.each(['Enter', 'a', 'Tab', 'toString'])('tut bei %s nichts', (taste) => {
    expect(ausschnittNachTaste(WERT, taste, false, RAHMEN, QUADRAT)).toBeNull()
  })
})

describe('bildAusschnittSpeichernSchema (was „Speichern“ schickt)', () => {
  it('nimmt das Titelbild mit Wahl', () => {
    expect(bildAusschnittSpeichernSchema.safeParse({ ziel: 'banner', wert: { ...GUELTIG, darstellung: 'FUELLEN' } }).success).toBe(true)
  })

  it('weist eine Hof-Kennung neben dem Wert ab — der Hof kommt aus der Sitzung', () => {
    expect(bildAusschnittSpeichernSchema.safeParse({ ziel: 'banner', wert: GUELTIG, farmId: 'fremder-hof' }).success).toBe(false)
  })

  it('weist ein unbekanntes Ziel ab', () => {
    expect(bildAusschnittSpeichernSchema.safeParse({ ziel: 'meldung', wert: GUELTIG }).success).toBe(false)
  })

  it('das Logo nur ohne Filter und ohne Wahl (Register N17)', () => {
    const logo = { fokusX: 50, fokusY: 50, zoom: 120 }
    expect(bildAusschnittSpeichernSchema.safeParse({ ziel: 'logo', wert: { ...logo, filter: 'NATUERLICH' } }).success).toBe(true)
    expect(bildAusschnittSpeichernSchema.safeParse({ ziel: 'logo', wert: { ...logo, filter: 'WARM' } }).success).toBe(false)
    expect(bildAusschnittSpeichernSchema.safeParse({ ziel: 'logo', wert: { ...logo, filter: 'NATUERLICH', darstellung: 'GANZ' } }).success).toBe(false)
  })

  it('Produkt, Foto und Beitrag brauchen ihre Kennung', () => {
    expect(bildAusschnittSpeichernSchema.safeParse({ ziel: 'produkt', wert: GUELTIG }).success).toBe(false)
    expect(bildAusschnittSpeichernSchema.safeParse({ ziel: 'produkt', productId: 'p1', wert: GUELTIG }).success).toBe(true)
  })
})

describe('fehlender Ausschnitt (Sentry JAVASCRIPT-NEXTJS-C, Nr. 180)', () => {
  it('undefined (Feld fehlt in alten Zwischenspeicher-Daten) ist wie null, kein Absturz', () => {
    expect(bildStil(undefined as never)).toEqual({})
    expect(nurFilterStil(undefined as never)).toEqual({})
    expect(filterMit('blur', undefined as never)).toBe('blur')
  })
})
