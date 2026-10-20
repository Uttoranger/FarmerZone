/**
 * Sicherheitsstand der Pakete im Lockfile (Sicherheitsupdate 20.10.2026).
 *
 * Beweist am tatsächlich aufgelösten Stand (pnpm-lock.yaml), nicht an
 * package.json allein:
 *  - next und eslint-config-next stehen auf 16.4.2 (GHSA-vcvr-r3jv-pc5j,
 *    GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r) — kein älteres next im Baum.
 *  - Kein sharp unter 0.35.5 (GHSA-wq5f-xc86-pv6w), auch nicht über next.
 *  - Kein undici aus den betroffenen Bereichen von GHSA-w293-vg96-wgc3.
 *  - Jede Ausnahme vom Mindestalter (Register G6) nennt genau eine Version —
 *    ein bloßer Paketname nähme jede künftige Version ungeprüft mit — und
 *    gehört zur Freigabe für next 16.4.2. Ist die Liste entfernt (wie der
 *    Kommentar in pnpm-workspace.yaml verlangt), bleibt der Test grün.
 *
 * Gegenprobe: Die Vergleiche laufen auch an Attrappen-Zeilen, damit ein
 * kaputter Parser nicht still „nichts gefunden" meldet.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCK = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8')
const WORKSPACE = readFileSync(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8')

type Version = [number, number, number]

function zerlege(v: string): Version {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v)
  if (!m) throw new Error(`keine Version: ${v}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function vergleiche(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

/** Alle aufgelösten Versionen eines Pakets aus dem Abschnitt `packages:` (Zeilen „  name@x.y.z:"). */
function versionenIm(lock: string, name: string): string[] {
  const kopf = name.startsWith('@') ? `'${name}@` : `${name}@`
  const funde = new Set<string>()
  for (const zeile of lock.split('\n')) {
    if (!zeile.startsWith(`  ${kopf}`)) continue
    const rest = zeile.slice(2 + kopf.length)
    const m = /^(\d+\.\d+\.\d+[^:'(]*)/.exec(rest)
    if (m) funde.add(m[1])
  }
  return [...funde]
}

/** Die Version eines direkten Pakets im Importer „." (Abschnitt dependencies bzw. devDependencies). */
function direkteVersion(lock: string, name: string): string | null {
  const zeilen = lock.split('\n')
  const schluessel = name.includes('/') || name.startsWith('@') ? `'${name}':` : `${name}:`
  const i = zeilen.findIndex((z) => z === `      ${schluessel}`)
  if (i < 0) return null
  const m = /^\s+version: (\d+\.\d+\.\d+)/.exec(zeilen[i + 2] ?? '')
  return m ? m[1] : null
}

const UNDICI_BETROFFEN: [Version, Version][] = [
  [[7, 24, 1], [7, 29, 1]],
  [[8, 0, 0], [8, 10, 2]],
]

function undiciBetroffen(v: string): boolean {
  const z = zerlege(v)
  return UNDICI_BETROFFEN.some(([ab, bis]) => vergleiche(z, ab) >= 0 && vergleiche(z, bis) < 0)
}

describe('Lockfile: next 16.4.2', () => {
  it('next und eslint-config-next sind direkt 16.4.2', () => {
    expect(direkteVersion(LOCK, 'next')).toBe('16.4.2')
    expect(direkteVersion(LOCK, 'eslint-config-next')).toBe('16.4.2')
  })

  it('kein älteres next im ganzen Baum', () => {
    const versionen = versionenIm(LOCK, 'next')
    expect(versionen.length).toBeGreaterThan(0)
    for (const v of versionen) expect(vergleiche(zerlege(v), [16, 4, 2]), v).toBeGreaterThanOrEqual(0)
  })
})

describe('Lockfile: sharp ab 0.35.5', () => {
  it('kein sharp unter 0.35.5, auch nicht über next', () => {
    const versionen = versionenIm(LOCK, 'sharp')
    expect(versionen.length).toBeGreaterThan(0)
    for (const v of versionen) expect(vergleiche(zerlege(v), [0, 35, 5]), v).toBeGreaterThanOrEqual(0)
  })

  it('der Override hebt jedes ältere sharp an', () => {
    expect(WORKSPACE).toMatch(/^\s+sharp@<0\.35\.5: '>=0\.35\.5'$/m)
  })
})

describe('Lockfile: undici außerhalb der betroffenen Bereiche', () => {
  it('kein undici aus >=7.24.1 <7.29.1 oder >=8.0.0 <8.10.2', () => {
    const versionen = versionenIm(LOCK, 'undici')
    expect(versionen.length).toBeGreaterThan(0)
    for (const v of versionen) expect(undiciBetroffen(v), v).toBe(false)
  })

  it('Gegenprobe: die Bereiche treffen, was sie sollen', () => {
    expect(undiciBetroffen('8.7.0')).toBe(true)
    expect(undiciBetroffen('7.24.1')).toBe(true)
    expect(undiciBetroffen('7.29.1')).toBe(false)
    expect(undiciBetroffen('8.10.2')).toBe(false)
    expect(undiciBetroffen('6.29.0')).toBe(false)
  })
})

describe('Mindestalter (Register G6)', () => {
  /** Die Einträge der Liste minimumReleaseAgeExclude (ohne Kommentare). */
  function ausnahmen(text: string): string[] {
    const zeilen = text.split('\n')
    const start = zeilen.findIndex((z) => z.startsWith('minimumReleaseAgeExclude:'))
    if (start < 0) return []
    const liste: string[] = []
    for (const zeile of zeilen.slice(start + 1)) {
      if (/^\S/.test(zeile)) break
      const m = /^\s+-\s+['"]?([^'"#\s]+)['"]?/.exec(zeile)
      if (m) liste.push(m[1])
    }
    return liste
  }

  it('das Mindestalter bleibt 14 Tage', () => {
    expect(WORKSPACE).toMatch(/^minimumReleaseAge: 20160$/m)
  })

  /**
   * Was an der Liste nicht stimmt. Eine leere oder fehlende Liste ist richtig:
   * Der Kommentar in pnpm-workspace.yaml verlangt, sie zu entfernen, sobald
   * die Versionen 14 Tage alt sind — dann darf dieser Test nicht rot werden.
   */
  function fehlerInAusnahmen(liste: string[]): string[] {
    const fehler = liste.filter((eintrag) => !/^(@[a-z0-9-]+\/)?[a-z0-9.-]+@\d+\.\d+\.\d+$/.test(eintrag)).map((e) => `ohne Version: ${e}`)
    // Solange es die Ausnahme gibt, gilt sie nur für next 16.4.2 und seine Begleiter (G6-Freigabe 20.10.2026).
    fehler.push(...liste.filter((e) => !/^(next|eslint-config-next|@next\/[a-z0-9-]+)@16\.4\.2$/.test(e)).map((e) => `nicht freigegeben: ${e}`))
    if (liste.length > 0 && !liste.includes('next@16.4.2')) fehler.push('next@16.4.2 fehlt')
    return fehler
  }

  it('jede Ausnahme nennt genau eine Version und gehört zur Freigabe für next 16.4.2', () => {
    expect(fehlerInAusnahmen(ausnahmen(WORKSPACE))).toEqual([])
  })

  it('Gegenprobe: ohne die Liste (nach dem Entfernen) bleibt es grün, Fremdes fällt auf', () => {
    expect(fehlerInAusnahmen(ausnahmen('minimumReleaseAge: 20160\noverrides:\n  a@<1: ^1\n'))).toEqual([])
    expect(fehlerInAusnahmen(['next@16.4.2', 'sharp@0.35.5'])).toEqual(['nicht freigegeben: sharp@0.35.5'])
    expect(fehlerInAusnahmen(['eslint-config-next@16.4.2'])).toEqual(['next@16.4.2 fehlt'])
  })

  it('Gegenprobe: ein bloßer Name fällt auf', () => {
    const attrappe = 'minimumReleaseAgeExclude:\n  - next\n  - sharp@0.35.5\nandere: 1\n'
    expect(ausnahmen(attrappe)).toEqual(['next', 'sharp@0.35.5'])
    expect('next').not.toMatch(/^(@[a-z0-9-]+\/)?[a-z0-9.-]+@\d+\.\d+\.\d+$/)
  })
})

describe('Parser (Gegenprobe an Attrappen)', () => {
  const ATTRAPPE = [
    'importers:',
    '',
    '  .:',
    '    dependencies:',
    '      next:',
    '        specifier: 16.2.6',
    '        version: 16.2.6(react@19.2.4)',
    'packages:',
    '',
    '  next@16.2.6:',
    '  sharp@0.34.5:',
    "  '@vercel/blob@2.4.0':",
    '  undici@8.7.0:',
  ].join('\n')

  it('findet alte Versionen, wo sie stehen', () => {
    expect(direkteVersion(ATTRAPPE, 'next')).toBe('16.2.6')
    expect(versionenIm(ATTRAPPE, 'sharp')).toEqual(['0.34.5'])
    expect(versionenIm(ATTRAPPE, '@vercel/blob')).toEqual(['2.4.0'])
    expect(undiciBetroffen(versionenIm(ATTRAPPE, 'undici')[0] ?? '0.0.0')).toBe(true)
  })
})
