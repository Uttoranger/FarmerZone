/**
 * Tests für die Icons der App (src/app/manifest.ts und Nexts Dateikonvention).
 *
 * Beweist:
 *  - Jedes Icon im Manifest liegt in public/ und hat die angegebene Größe
 *    (gelesen aus dem PNG-Kopf, nicht geglaubt).
 *  - 192 und 512 als „any", 512 als „maskable"; Favicon und das alte
 *    app-icon-256.png stehen nicht mehr im Manifest.
 *  - favicon.ico und apple-icon.png liegen in src/app — dort wirken sie über
 *    die Dateikonvention.
 *  - app-icon-256.png ist weg und wird nirgends mehr verwendet.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import manifest from '@/app/manifest'

const wurzel = process.cwd()

/** Breite × Höhe aus dem IHDR-Block eines PNG (Bytes 16–23, Big Endian). */
function pngGroesse(datei: string): string {
  const bytes = readFileSync(datei)
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`
}

describe('Manifest-Icons', () => {
  const icons = manifest().icons ?? []

  it('192 und 512 für alles, 512 maskierbar — sonst nichts', () => {
    expect(icons.map((i) => [i.src, i.sizes, i.purpose])).toEqual([
      ['/icons/icon-192.png', '192x192', 'any'],
      ['/icons/icon-512.png', '512x512', 'any'],
      ['/icons/icon-maskable-512.png', '512x512', 'maskable'],
    ])
  })

  it('jedes Icon liegt in public/ und hat die angegebene Größe', () => {
    for (const icon of icons) {
      const datei = join(wurzel, 'public', icon.src)
      expect(existsSync(datei), icon.src).toBe(true)
      expect(pngGroesse(datei), icon.src).toBe(icon.sizes)
    }
  })
})

describe('Icons über die Dateikonvention', () => {
  it('favicon.ico und apple-icon.png (180 × 180) liegen in src/app', () => {
    expect(existsSync(join(wurzel, 'src/app/favicon.ico'))).toBe(true)
    expect(pngGroesse(join(wurzel, 'src/app/apple-icon.png'))).toBe('180x180')
  })

  it('das alte app-icon-256.png ist weg', () => {
    expect(existsSync(join(wurzel, 'public/app-icon-256.png'))).toBe(false)
    expect(readFileSync(join(wurzel, 'src/app/manifest.ts'), 'utf8')).not.toContain("'/app-icon-256.png'")
  })
})
