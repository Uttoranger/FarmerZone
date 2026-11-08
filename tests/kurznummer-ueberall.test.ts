/**
 * Nr. 263 (Register N48): Kurznummer überall gleich — sechs Zeichen, groß, aus dem ENDE der ID (`kurznummerAus`).
 *
 * Beweist: Die Danke-Seite (Server-Action) nennt dieselbe Nummer wie die Mail an den Betrieb, auch der
 * Scheinerfolg der Bot-Bremse hat diese Form (aus crypto); Admin › Heute zeigt für „meldung-seed-1“ keine
 * „Nr. meldung-“ mehr; die Suche erkennt neue, alte und volle Nummer über EINE Regel und nimmt bei mehreren
 * Treffern keine beliebige; die alte Nummer steht nur noch im CLI-Export und unter /api.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => null) } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    meldung: { count: vi.fn(async () => 0), create: vi.fn() },
    farm: { findUnique: vi.fn() },
    betreiberEmpfaenger: { findMany: vi.fn(async () => []) },
  },
}))
vi.mock('@/server/mail-warteschlange', () => ({ stelleMailEin: vi.fn(async () => 0) }))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(async () => []) }))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn(async () => true) }))

import { meldungAbsenden } from '@/server/actions/meldung'
import { generateFormToken } from '@/lib/form-token'
import { KURZNUMMER_MEHRDEUTIG, kurznummerAus, waehleZurKurznummer } from '@/lib/kurznummer'
import { sucheMeldungen, type SuchMeldung } from '@/lib/meldung'
import { ADMIN_AUFGABEN, LEERER_STAND } from '@/lib/admin-aufgaben'
import { prisma } from '@/lib/prisma'

const NEUE_ID = 'cmfabcdefgh123456789xyz'
const AUSGESTELLT = new Date('2026-09-01T10:00:00.000Z')

function eingabe(website = ''): Parameters<typeof meldungAbsenden>[0] {
  vi.useFakeTimers()
  vi.setSystemTime(AUSGESTELLT)
  const formToken = generateFormToken('meldung')
  vi.setSystemTime(new Date(AUSGESTELLT.getTime() + 10_000))
  return {
    art: 'WUNSCH',
    text: 'Bitte eine Liste der Abholzeiten auf der Hofseite anzeigen.',
    seiteUrl: 'https://agrilo.at/hoefe',
    userAgent: 'Mozilla/5.0 (iPhone)',
    viewport: '375x667',
    customerEmail: 'kundin@example.com',
    website,
    formToken,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.meldung.create).mockResolvedValue({ id: NEUE_ID, createdAt: AUSGESTELLT } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Danke-Seite (meldungAbsenden)', () => {
  it('nennt die Kurznummer aus dem Ende der ID, sechs Zeichen groß — wie die Mail an den Betrieb', async () => {
    const ergebnis = await meldungAbsenden(eingabe())
    expect(ergebnis).toEqual({ ok: true, kurznummer: '789XYZ' })
    expect(kurznummerAus(NEUE_ID)).toBe('789XYZ')
  })

  it('der Scheinerfolg der Bot-Bremse hat dieselbe Form: sechs Zeichen, A–Z und 0–9', async () => {
    const formen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const ergebnis = await meldungAbsenden(eingabe('https://spam.example.com'))
      expect(ergebnis).toHaveProperty('kurznummer')
      const nummer = (ergebnis as { kurznummer: string }).kurznummer
      expect(nummer).toMatch(/^[A-Z0-9]{6}$/)
      formen.add(nummer)
    }
    expect(prisma.meldung.create).not.toHaveBeenCalled()
    // Zufall, nicht fest: 40 Ziehungen aus 2,2 Mrd. Nummern sind praktisch nie gleich.
    expect(formen.size).toBeGreaterThan(35)
  })
})

describe('Admin › Heute (Aufgabe „Neue Meldung“)', () => {
  it('zeigt für „meldung-seed-1“ die Nummer aus dem Ende, nie „Nr. meldung-“', () => {
    const jetzt = new Date('2026-11-08T10:00:00.000Z')
    const stand = {
      ...LEERER_STAND,
      meldungen: [{ id: 'meldung-seed-1', art: 'FEHLER' as const, createdAt: new Date('2026-11-08T09:00:00.000Z'), ersteZeile: 'Foto lädt nicht', von: 'Hof Müller' }],
    }
    const [aufgabe] = ADMIN_AUFGABEN.meldung_neu(stand, jetzt)
    expect(aufgabe.bezug?.text).toContain('Nr. SEED-1')
    expect(aufgabe.bezug?.text).not.toContain('Nr. meldung-')
  })
})

describe('EINE Regel für die Suche (waehleZurKurznummer)', () => {
  const A = { id: 'cmw4fc4j0000aaaaaaa4f8m2q' }
  const B = { id: 'cmx9zz1k0000bbbbbbb4f8m2q' }
  const C = { id: 'cmy7aa2m0000ccccccc9k3l7p' }

  it('findet neue (Ende, groß oder klein), alte (Anfang, acht Zeichen) und volle Nummer', () => {
    for (const eingabe of ['9K3L7P', ' #9k3l7p ', 'cmy7aa2m', 'CMY7AA2M', C.id, C.id.toUpperCase()]) {
      expect(waehleZurKurznummer([A, C], eingabe)).toEqual({ art: 'eine', meldung: C })
    }
  })

  it('passt eine Nummer zu mehreren, nimmt sie keine beliebige; die volle Nummer ist der Ausweg', () => {
    expect(waehleZurKurznummer([A, B, C], '4F8M2Q')).toEqual({ art: 'mehrdeutig' })
    expect(waehleZurKurznummer([A, B, C], B.id)).toEqual({ art: 'eine', meldung: B })
    expect(KURZNUMMER_MEHRDEUTIG).toBe('Diese Kurznummer passt zu mehreren Meldungen – gib die volle Nummer ein.')
  })

  it('ein Stück unter sechs Zeichen (oder ein beliebiges Stück aus der Mitte) trifft nichts', () => {
    for (const eingabe of ['', ' ', '#', 'Q', '2Q', 'F8M2Q', 'cmy7a', 'cmy7aa2', 'cmy7aa2m0', 'y7aa2m00', 'ccccc9k3']) {
      expect(waehleZurKurznummer([A, C], eingabe)).toEqual({ art: 'keine' })
    }
  })

  it('eine kurze Seed-Kennung findet sich über Ende, alte Nummer und ganz', () => {
    const seed = { id: 'meldung-seed-1' }
    expect(kurznummerAus(seed.id)).toBe('SEED-1')
    for (const eingabe of ['SEED-1', 'meldung-', 'meldung-seed-1']) {
      expect(waehleZurKurznummer([seed], eingabe)).toEqual({ art: 'eine', meldung: seed })
    }
  })
})

describe('sucheMeldungen (Zusammenfassen, Dazunehmen)', () => {
  const stand = { status: 'NEU' as const, art: 'FEHLER' as const, clusterKey: null, triageNotiz: null, duplikatVonId: null, sprintName: null, antwortAnMelder: null }
  const zeile = (id: string, ersteZeile: string): SuchMeldung => ({ id, kurznummer: kurznummerAus(id), art: 'FEHLER', status: 'NEU', ersteZeile, wer: 'Hof Müller', teil: 'neu', clusterKey: null, stand })
  const liste = [zeile('cmw4fc4j0000aaaaaaa4f8m2q', 'Foto lädt nicht hoch'), zeile('cmx9zz1k0000bbbbbbb4f8m2q', 'Abholzeit fehlt'), zeile('cmy7aa2m0000ccccccc9k3l7p', 'Knopf grau')]
  const alle = (): boolean => true

  const titel = (wort: string, erlaubt: (m: SuchMeldung) => boolean = alle) => {
    const { treffer, mehrdeutig } = sucheMeldungen(liste, wort, erlaubt)
    return { titel: treffer.map((m) => m.ersteZeile), mehrdeutig }
  }

  it('Wortsuche im Kurztitel bleibt: „Foto“ findet die Meldung mit „Foto“ im Kurztitel', () => {
    expect(titel('Foto')).toEqual({ titel: ['Foto lädt nicht hoch'], mehrdeutig: false })
  })

  it('Nummer nach DER Regel: neue, alte und volle finden genau eine', () => {
    for (const nummer of ['9K3L7P', 'cmy7aa2m', 'cmy7aa2m0000ccccccc9k3l7p']) expect(titel(nummer)).toEqual({ titel: ['Knopf grau'], mehrdeutig: false })
    expect(titel('cm')).toEqual({ titel: [], mehrdeutig: false })
  })

  it('passt die Nummer zu mehreren: keine Auswahl aus ihnen, sondern mehrdeutig (der Dialog sagt den Satz)', () => {
    expect(titel('4f8m2q')).toEqual({ titel: [], mehrdeutig: true })
    // Auch wenn eine der beiden im Dialog ausgeschlossen ist: Die Nummer bleibt mehrdeutig, keine wird still genommen.
    expect(titel('4F8M2Q', (m) => m.ersteZeile !== 'Abholzeit fehlt')).toEqual({ titel: [], mehrdeutig: true })
    // Der Ausweg: die volle Nummer.
    expect(titel('cmx9zz1k0000bbbbbbb4f8m2q')).toEqual({ titel: ['Abholzeit fehlt'], mehrdeutig: false })
  })
})

describe('Wachen', () => {
  const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

  /**
   * Nutzt der Text die alte Kurznummer? Ein Aufruf `kurznummer(` bzw. `.kurznummer(` (nicht `kurznummerAus(`) oder ein
   * Import von `kurznummer` aus '@/lib/meldung', auch unter anderem Namen (`kurznummer as …`).
   */
  const alteNummerIn = (text: string): boolean => {
    const ohneDefinition = text.replace(/export function kurznummer\(/g, '')
    if (/(?<!\w)kurznummer\(/.test(ohneDefinition)) return true
    const importe = [...text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@\/lib\/meldung['"]/g)]
    return importe.some((i) => (i[1] ?? '').split(',').some((name) => name.trim().split(/\s+/)[0] === 'kurznummer'))
  }

  it('die alte Kurznummer nennen unter src/ nur noch der CLI-Export und /api (bleiben bei ihr, Nr. 263)', () => {
    const dateien = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' }).split('\n').filter((d) => /\.(ts|tsx)$/.test(d))
    const funde = dateien.filter((d) => !d.startsWith('src/app/api/') && d !== 'src/lib/briefkasten-export.ts' && alteNummerIn(quelle(d)))
    expect(funde).toEqual([])
    // Gegenprobe: Der Export nennt sie, und ein Aufruf wie vorher würde gefunden.
    expect(alteNummerIn(quelle('src/lib/briefkasten-export.ts'))).toBe(true)
    expect(alteNummerIn('zeile: `Nr. ${kurznummer(m.id)}`')).toBe(true)
    expect(alteNummerIn('zeile: `Nr. ${kurznummerAus(m.id)}`')).toBe(false)
    expect(alteNummerIn("import { MELDUNG_ART_LABEL, kurznummer as nr } from '@/lib/meldung'\nconst t = nr(id)")).toBe(true)
    expect(alteNummerIn("import {\n  ersteZeile,\n  kurznummer,\n} from '@/lib/meldung'")).toBe(true)
    expect(alteNummerIn('const n = meldung.kurznummer(id)')).toBe(true)
    expect(alteNummerIn("import { kurznummerAus } from '@/lib/kurznummer'\nconst k = z.kurznummer")).toBe(false)
  })

  /** Kommt die Scheinnummer aus crypto statt aus Math.random? */
  const scheinAusCrypto = (text: string): boolean => /from 'node:crypto'/.test(text) && /randomInt\(/.test(text) && !/Math\.random\(/.test(text)

  it('die Scheinnummer der Bot-Bremse kommt aus crypto, nie aus Math.random', () => {
    expect(scheinAusCrypto(quelle('src/server/actions/meldung.ts'))).toBe(true)
    // Gegenprobe: der Stand vor Nr. 263.
    expect(scheinAusCrypto("return Math.random().toString(36).slice(2, 10).padEnd(8, '0')")).toBe(false)
  })
})
