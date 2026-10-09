/**
 * Der Cookie-Hinweis verdeckt weder Unterleiste noch Kaufknopf (Nachtlauf
 * Nr. 46). Die Lage rechnet `cookieHinweisUnten` (rein); welche Leisten
 * zählen, sagt das Merkmal `data-unten-fest` an der Leiste selbst — die Wache
 * unten findet jede feste Leiste am unteren Rand im Quelltext und verlangt es.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  COOKIE_HINWEIS_LUFT_PX,
  COOKIE_HINWEIS_RAND_PX,
  UNTEN_FEST_ATTRIBUT,
  cookieHinweisUnten,
  leistenMass,
} from '@/lib/cookie-hinweis'

const FENSTER = 844

describe('cookieHinweisUnten — über der höchsten festen Leiste', () => {
  it('ohne Leiste: der gewohnte Rand', () => {
    expect(cookieHinweisUnten([], FENSTER)).toBe(COOKIE_HINWEIS_RAND_PX)
  })

  it('Unterleiste (68 px): der Hinweis steht mit Luft darüber', () => {
    expect(cookieHinweisUnten([{ oben: FENSTER - 68, hoehe: 68 }], FENSTER)).toBe(68 + COOKIE_HINWEIS_LUFT_PX)
  })

  it('Kaufknopf der Kasse (130 px) und Korb-Leiste über der Unterleiste: die höchste zählt', () => {
    const unterleiste = { oben: FENSTER - 68, hoehe: 68 }
    const korbLeiste = { oben: FENSTER - 68 - 28 - 52, hoehe: 52 }
    expect(cookieHinweisUnten([{ oben: FENSTER - 130, hoehe: 130 }], FENSTER)).toBe(130 + COOKIE_HINWEIS_LUFT_PX)
    expect(cookieHinweisUnten([unterleiste, korbLeiste], FENSTER)).toBe(148 + COOKIE_HINWEIS_LUFT_PX)
  })

  it('angefangene Pixel zählen voll — der Hinweis berührt die Leiste nie', () => {
    expect(cookieHinweisUnten([{ oben: FENSTER - 67.25, hoehe: 67.25 }], FENSTER)).toBe(68 + COOKIE_HINWEIS_LUFT_PX)
  })

  it('ausgeblendete Leisten (Höhe 0), Leisten unter dem Fenster und Unsinn zählen nicht', () => {
    expect(cookieHinweisUnten([{ oben: 0, hoehe: 0 }], FENSTER)).toBe(COOKIE_HINWEIS_RAND_PX)
    expect(cookieHinweisUnten([{ oben: FENSTER + 10, hoehe: 60 }], FENSTER)).toBe(COOKIE_HINWEIS_RAND_PX)
    expect(cookieHinweisUnten([{ oben: Number.NaN, hoehe: 60 }], FENSTER)).toBe(COOKIE_HINWEIS_RAND_PX)
  })

  it('mehr als das ganze Fenster belegt keine Leiste', () => {
    expect(cookieHinweisUnten([{ oben: -200, hoehe: 1200 }], FENSTER)).toBe(FENSTER + COOKIE_HINWEIS_LUFT_PX)
  })
})

describe('leistenMass — die Leiste samt dem, was aus ihr herausragt', () => {
  // Unterleiste 68 px am unteren Rand; der Mittelknopf (54 px, -mt-5) ragt 20 px über sie hinaus.
  const UNTERLEISTE = { top: FENSTER - 68, bottom: FENSTER, height: 68 }
  const MITTELKNOPF = { top: FENSTER - 88, bottom: FENSTER - 34, height: 54 }

  it('ohne Inhalt: der Rahmen der Leiste', () => {
    expect(leistenMass(UNTERLEISTE, [])).toEqual({ oben: FENSTER - 68, hoehe: 68 })
  })

  it('der erhobene Mittelknopf zählt mit — der Hinweis steht auch über dem Korb', () => {
    const eintrag = { top: FENSTER - 56, bottom: FENSTER - 12, height: 44 }
    const mass = leistenMass(UNTERLEISTE, [eintrag, MITTELKNOPF])
    expect(mass).toEqual({ oben: FENSTER - 88, hoehe: 88 })
    expect(cookieHinweisUnten([mass], FENSTER)).toBe(88 + COOKIE_HINWEIS_LUFT_PX)
    // Gegenprobe: Mit dem Rahmen der Leiste allein ragte der Hinweis 8 px in den Knopf.
    expect(cookieHinweisUnten([leistenMass(UNTERLEISTE, [])], FENSTER)).toBe(68 + COOKIE_HINWEIS_LUFT_PX)
  })

  it('Inhalt ohne Höhe (ausgeblendet) und Unsinn verschieben nichts', () => {
    const versteckt = { top: 0, bottom: 0, height: 0 }
    const unsinn = { top: Number.NaN, bottom: 0, height: 10 }
    expect(leistenMass(UNTERLEISTE, [versteckt, unsinn])).toEqual({ oben: FENSTER - 68, hoehe: 68 })
  })
})

describe('Wache: jede feste Leiste am unteren Rand trägt das Merkmal', () => {
  const WURZEL = join(process.cwd(), 'src')
  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((name) => {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) return dateien(pfad)
      return name.endsWith('.tsx') ? [pfad] : []
    })
  }

  /** Eine Klassenliste mit `fixed` und einem Abstand nach unten (`bottom-0`, `bottom-[calc(…)]`). */
  const FESTE_LEISTE = /['"`][^'"`]*\bfixed\b[^'"`]*\bbottom-(?:0|\[)[^'"`]*['"`]|['"`][^'"`]*\bbottom-(?:0|\[)[^'"`]*\bfixed\b[^'"`]*['"`]/g

  // Bewusst ausgenommen: Blätter (eigene Ebene mit Schleier) und Ladeansichten
  // (sie stehen nur, bis die Seite da ist — der Hinweis erscheint erst danach).
  const AUSNAHMEN = ['components/ui/sheet.tsx']
  const istAusnahme = (pfad: string) => AUSNAHMEN.includes(pfad) || pfad.endsWith('/loading.tsx')

  it('erkennt feste Leisten (Gegenprobe) — und nicht den Hinweis selbst', () => {
    expect('className="fixed inset-x-0 bottom-0 z-40"'.match(FESTE_LEISTE)).toHaveLength(1)
    expect("'fixed inset-x-4 bottom-[calc(68px+1.75rem)] z-40'".match(FESTE_LEISTE)).toHaveLength(1)
    expect("'fixed bottom-0 left-0 right-0 border-t'".match(FESTE_LEISTE)).toHaveLength(1)
    expect('className="fixed right-4 z-50 w-80"'.match(FESTE_LEISTE)).toBeNull()
    expect('className="fixed inset-0 z-[70]"'.match(FESTE_LEISTE)).toBeNull()
  })

  it('jede Datei mit einer festen Leiste unten setzt data-unten-fest so oft, wie sie Leisten hat', () => {
    const funde = dateien(WURZEL)
      .map((pfad) => ({ pfad: relative(WURZEL, pfad).replaceAll('\\', '/'), text: readFileSync(pfad, 'utf8') }))
      .filter(({ pfad }) => !istAusnahme(pfad))
      .map(({ pfad, text }) => ({
        pfad,
        leisten: (text.match(FESTE_LEISTE) ?? []).length,
        merkmale: (text.match(new RegExp(`${UNTEN_FEST_ATTRIBUT}=`, 'g')) ?? []).length,
      }))
      .filter((f) => f.leisten > 0)
    // Gegenprobe, dass gesucht wurde: Unterleiste, Kasse, Produktseite, Hofseite, Fokus-Shell, Bestandsleiste.
    expect(funde.map((f) => f.pfad).sort()).toEqual(
      expect.arrayContaining([
        'components/ui/bottom-nav.tsx',
        'components/checkout/kasse-teile.tsx',
        'components/produktdetail/produktdetail-kunde.tsx',
        'components/farm/product-grid.tsx',
        'components/shells/kunde-shell.tsx',
        'components/farmer/farmer-nav.tsx',
      ])
    )
    for (const f of funde) expect(f.merkmale, f.pfad).toBeGreaterThanOrEqual(f.leisten)
  })

  it('der Hinweis selbst steht über den Leisten — gemessen, nicht mit festem bottom-4', () => {
    const banner = readFileSync(join(WURZEL, 'components/cookie-banner.tsx'), 'utf8')
    expect(banner).toContain('cookieHinweisUnten(festeLeisten(), window.innerHeight)')
    // Gemessen wird die Leiste samt Inhalt — sonst läge der Hinweis auf dem erhobenen Mittelknopf.
    expect(banner).toContain("leistenMass(el.getBoundingClientRect(), Array.from(el.querySelectorAll('*')")
    expect(banner).toContain('style={{ bottom: unten }}')
    expect(banner).not.toMatch(/\bbottom-4\b/)
    // Der Knopf „Verstanden" ist ein 44-px-Ziel.
    expect(banner).toMatch(/'min-h-11 shrink-0 rounded-xl bg-primary/)
  })
})
