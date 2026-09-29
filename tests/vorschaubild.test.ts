/**
 * Tests für das Vorschaubild beim Teilen (src/lib/vorschaubild.ts).
 *
 * Beweist:
 *  - Das Startseiten-Bild liegt in public/ und ist 1200 × 630.
 *  - Eine Hofseite zeigt ihr Titelbild — nur ein echtes Foto; ohne Titelbild
 *    (Verlauf, fehlende Adresse) das Startseiten-Bild.
 *  - Es gibt keine Datei opengraph-image/twitter-image im app-Ordner: Sie
 *    überschriebe nach Nexts Dateikonvention die Titelbilder der Hofseiten.
 *  - metadataBase kommt aus der Adresse der Umgebung — nur, wenn sie gültig
 *    ist; eine Adresse ohne Schema legt keine Seite lahm.
 *  - Die Hofseite nutzt den Rückfall.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { STARTSEITE_VORSCHAUBILD, hofVorschaubild, metadatenBasis } from '@/lib/vorschaubild'

const wurzel = process.cwd()

/** Breite × Höhe aus dem SOF-Block eines JPEG. */
function jpegGroesse(datei: string): string {
  const b = readFileSync(datei)
  let i = 2
  while (i < b.length) {
    const marker = b[i + 1]
    const laenge = b.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc2) return `${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`
    i += 2 + laenge
  }
  return 'unbekannt'
}

describe('Startseite', () => {
  it('das Bild liegt in public/og und ist 1200 × 630', () => {
    const datei = join(wurzel, 'public', STARTSEITE_VORSCHAUBILD.url)
    expect(existsSync(datei)).toBe(true)
    expect(jpegGroesse(datei)).toBe(`${STARTSEITE_VORSCHAUBILD.width}x${STARTSEITE_VORSCHAUBILD.height}`)
    expect(STARTSEITE_VORSCHAUBILD.alt).toBe('FarmerZone — Lebensmittel und Futter direkt vom Hof')
  })
})

describe('Hofseite', () => {
  it('mit Titelbild: das Titelbild', () => {
    expect(
      hofVorschaubild({ name: 'Hof Test', bannerType: 'PHOTO', bannerUrl: 'https://bilder.example/titel.jpg' })
    ).toEqual({ url: 'https://bilder.example/titel.jpg', alt: 'Hof Test' })
  })

  it('ohne Titelbild: das Bild der Startseite — auch bei einem Verlauf mit alter Foto-Adresse', () => {
    expect(hofVorschaubild({ name: 'Hof Test', bannerType: 'PHOTO', bannerUrl: null })).toBe(STARTSEITE_VORSCHAUBILD)
    expect(
      hofVorschaubild({ name: 'Hof Test', bannerType: 'GRADIENT', bannerUrl: 'https://bilder.example/alt.jpg' })
    ).toBe(STARTSEITE_VORSCHAUBILD)
  })

  it('die Hofseite setzt das Vorschaubild immer über hofVorschaubild', () => {
    const seite = readFileSync(join(wurzel, 'src/app/(public)/[farmSlug]/page.tsx'), 'utf8')
    expect(seite).toContain('images: [hofVorschaubild(farm)]')
  })
})

describe('Konvention', () => {
  it('keine Datei opengraph-image oder twitter-image im app-Ordner', () => {
    const treffer: string[] = []
    const suche = (ordner: string) => {
      for (const name of readdirSync(ordner)) {
        const pfad = join(ordner, name)
        if (statSync(pfad).isDirectory()) suche(pfad)
        else if (/^(opengraph|twitter)-image\./.test(name)) treffer.push(pfad)
      }
    }
    suche(join(wurzel, 'src/app'))
    expect(treffer).toEqual([])
  })

  it('metadataBase: eine gültige Adresse wird die Basis, alles andere keine — nie ein Wurf', () => {
    expect(metadatenBasis('https://hof.example')?.href).toBe('https://hof.example/')
    expect(metadatenBasis('https://vorschau-zweig.example')?.origin).toBe('https://vorschau-zweig.example')
    expect(metadatenBasis(null)).toBeUndefined()
    // Ohne Schema würfe new URL — und mit ihm jede Seite.
    expect(() => metadatenBasis('hof.example')).not.toThrow()
    expect(metadatenBasis('hof.example')).toBeUndefined()
  })

  it('das Root-Layout setzt metadataBase über metadatenBasis aus der Adresse der Umgebung', () => {
    const layout = readFileSync(join(wurzel, 'src/app/layout.tsx'), 'utf8')
    expect(layout).toContain('metadataBase: metadatenBasis(UMGEBUNG.appUrl)')
    expect(layout).not.toMatch(/new URL\(APP_URL\)/)
  })
})
