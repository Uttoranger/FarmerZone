/**
 * robots.txt (Register N19, Filter-Falle auf /hoefe): Crawler dürfen alles außer /hoefe mit
 * Parametern — jede Filterkombination ist eine eigene Adresse — und den privaten Bereichen.
 * Die Bereiche stehen in EINER Konstante; sie deckt jeden geschützten Pfad aus src/proxy.ts
 * ab (am Quelltext gelesen wie in tests/proxy-pfade.test.ts).
 *
 * Geprüft wird mit einem kleinen Leser nach RFC 9309 (Präfix, `$` am Ende, die längste
 * passende Regel gewinnt, bei Gleichstand Allow) — so, wie Google und Bing die Datei lesen —
 * und mit einem Leser, bei dem die erste passende Regel gilt (einfache Crawler, etwa über
 * Pythons urllib.robotparser).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Die Adresse der App je Fall: Die Metadaten-Route liest sie beim Aufruf.
const umgebung = vi.hoisted(() => ({ appUrl: 'https://hof.example' as string | null }))
vi.mock('@/lib/umgebung-server', () => ({ UMGEBUNG: umgebung }))

import robots from '@/app/robots'
import { HOEFE_MIT_PARAMETERN, PRIVATE_BEREICHE, gesperrtePfade } from '@/lib/robots'

const proxy = readFileSync(join(process.cwd(), 'src/proxy.ts'), 'utf8')
const FARMER_PATHS = [...(/const FARMER_PATHS = \[([\s\S]*?)\]/.exec(proxy)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])

type Regel = { erlaubt: boolean; muster: string }

/** Der Quelltext der Metadaten-Route. */
const quelle = () => readFileSync(join(process.cwd(), 'src/app/robots.ts'), 'utf8')

/** Passt das Muster auf den Pfad (samt Query)? Präfix, `$` verankert das Ende. */
function passt(muster: string, pfad: string): boolean {
  return muster.endsWith('$') ? pfad === muster.slice(0, -1) : pfad.startsWith(muster)
}

/** Darf ein Crawler den Pfad abrufen? Die längste passende Regel gewinnt, bei Gleichstand Allow. */
function darf(regeln: Regel[], pfad: string): boolean {
  const treffer = regeln.filter((r) => passt(r.muster, pfad))
  if (treffer.length === 0) return true
  const laengste = Math.max(...treffer.map((r) => r.muster.length))
  return treffer.some((r) => r.muster.length === laengste && r.erlaubt)
}

/**
 * Ein einfacher Crawler: Die erste passende Zeile in Dateireihenfolge gilt. Next schreibt je
 * Gruppe erst alle Allow-, dann alle Disallow-Zeilen (resolveRobots) — `regelnFuerAlle` hält
 * dieselbe Reihenfolge.
 */
function darfErsteRegel(regeln: Regel[], pfad: string): boolean {
  return regeln.find((r) => passt(r.muster, pfad))?.erlaubt ?? true
}

/** Die Regeln für alle Crawler aus dem Ergebnis der Metadaten-Route, in der Reihenfolge der Datei. */
function regelnFuerAlle(): Regel[] {
  const { rules } = robots()
  const liste = Array.isArray(rules) ? rules : [rules]
  const alle = liste.filter((r) => r.userAgent === '*' || (Array.isArray(r.userAgent) && r.userAgent.includes('*')))
  expect(alle).toHaveLength(1)
  const zuListe = (wert: string | string[] | undefined) => (wert === undefined ? [] : Array.isArray(wert) ? wert : [wert])
  return [
    ...zuListe(alle[0].allow).map((muster) => ({ erlaubt: true, muster })),
    ...zuListe(alle[0].disallow).map((muster) => ({ erlaubt: false, muster })),
  ]
}

describe('robots.txt', () => {
  const regeln = regelnFuerAlle()

  it('erlaubt alles Öffentliche: Startseite, /hoefe ohne Parameter, Hofseiten mit und ohne Bereich', () => {
    for (const pfad of ['/', '/hoefe', '/hof-test', '/hof-test?bereich=futter', '/hof-test/produkt/abc', '/fuer-hoefe', '/konditionen']) {
      expect(darf(regeln, pfad), pfad).toBe(true)
    }
  })

  it('sperrt /hoefe mit Parametern — jede Filterkombination', () => {
    expect(HOEFE_MIT_PARAMETERN).toBe('/hoefe?')
    expect(regeln).toContainEqual({ erlaubt: false, muster: '/hoefe?' })
    for (const pfad of ['/hoefe?kat=EIER', '/hoefe?ansicht=karte', '/hoefe?bereich=futter&siegel=BIO&sort=grundpreis']) {
      expect(darf(regeln, pfad), pfad).toBe(false)
    }
    // Gegenprobe: ohne die Sperre dürfte der Crawler jede Kombination abrufen.
    expect(darf([{ erlaubt: true, muster: '/' }], '/hoefe?kat=EIER')).toBe(true)
  })

  it('keine Allow-Zeile: Auch ein Crawler, bei dem die erste passende Regel gilt, hält sich an die Sperren', () => {
    // Erlaubt ist ohne passende Regel ohnehin alles; ein „Allow: /" stünde VOR allen Disallow-Zeilen.
    expect(regeln.filter((r) => r.erlaubt)).toEqual([])
    for (const pfad of ['/hoefe?kat=EIER', '/dashboard/x', '/admin?reiter=alle', '/api/upload/token']) {
      expect(darfErsteRegel(regeln, pfad), pfad).toBe(false)
    }
    expect(darfErsteRegel(regeln, '/hof-test')).toBe(true)
    // Gegenprobe: mit „Allow: /" davor dürfte dieser Crawler alles.
    expect(darfErsteRegel([{ erlaubt: true, muster: '/' }, ...regeln], '/hoefe?kat=EIER')).toBe(true)
  })

  it('sperrt jeden geschützten Pfad aus src/proxy.ts — die Konstante kennt sie alle', () => {
    expect(FARMER_PATHS).toContain('/dashboard')
    expect(FARMER_PATHS).toContain('/postfach')
    for (const pfad of FARMER_PATHS) {
      expect(PRIVATE_BEREICHE, pfad).toContain(pfad)
      expect(darf(regeln, pfad), pfad).toBe(false)
      expect(darf(regeln, `${pfad}?filter=offen`), pfad).toBe(false)
      expect(darf(regeln, `${pfad}/unterseite`), pfad).toBe(false)
    }
  })

  it('sperrt die übrigen privaten Bereiche', () => {
    // /sicherheit seit Nr. 117: „Das warst nicht du?" (Nr. 114) kommt mit einem Token aus der Mail.
    for (const pfad of ['/admin', '/account', '/intern', '/onboarding', '/verify', '/reset-password', '/bestellungen', '/teilen', '/sicherheit']) {
      expect(PRIVATE_BEREICHE, pfad).toContain(pfad)
      expect(darf(regeln, pfad), pfad).toBe(false)
      expect(darf(regeln, `${pfad}?x=1`), pfad).toBe(false)
      expect(darf(regeln, `${pfad}/x`), pfad).toBe(false)
    }
    expect(darf(regeln, '/admin?reiter=alle')).toBe(false)
    expect(darf(regeln, '/api/upload/token')).toBe(false)
    expect(darf(regeln, '/teilen/abc?t=signiert')).toBe(false)
    expect(darf(regeln, '/sicherheit/nicht-ich?t=signiert')).toBe(false)
  })

  it('der Admin-Zugang steht nicht in robots.txt — die Datei nennte ihn sonst jedem', () => {
    // /login/admin trägt nur noindex (Nr. 115); eine Sperre hier verriete die Adresse.
    expect(gesperrtePfade().some((muster) => muster.startsWith('/login'))).toBe(false)
    expect(darf(regeln, '/login/admin')).toBe(true)
  })

  it('eine Hofseite, deren Slug mit einem gesperrten Wort beginnt, bleibt erreichbar', () => {
    // Ein Slug ist frei wählbar: „Regionalhof …" darf nicht unter /region fallen.
    for (const pfad of ['/regionalhof-test', '/regionalhof-test?bereich=futter', '/statushof', '/adminhof', '/apfelhof', '/internatshof']) {
      expect(darf(regeln, pfad), pfad).toBe(true)
    }
    // Gegenprobe: eine Sperre als blankes Präfix träfe den Hof.
    expect(darf([{ erlaubt: true, muster: '/' }, { erlaubt: false, muster: '/region' }], '/regionalhof-test')).toBe(false)
  })

  it('die Sperrliste kommt aus der einen Konstante', () => {
    const verboten = regeln.filter((r) => !r.erlaubt).map((r) => r.muster)
    expect(verboten).toEqual(gesperrtePfade())
    expect(verboten).toEqual([HOEFE_MIT_PARAMETERN, ...PRIVATE_BEREICHE.flatMap((b) => [`${b}$`, `${b}?`, `${b}/`])])
  })

  it('die Zeile „Sitemap:" nennt /sitemap.xml als volle Adresse — aus der Basis von metadataBase (Nr. 117)', () => {
    expect(robots().sitemap).toBe('https://hof.example/sitemap.xml')
    expect(quelle()).toMatch(/metadatenBasis\(UMGEBUNG\.appUrl\)/)
  })

  it('ohne bekannte Adresse keine Zeile „Sitemap:" — eine relative wäre ungültig', () => {
    umgebung.appUrl = null
    try {
      expect(robots().sitemap).toBeUndefined()
      // Gegenprobe: Die Regeln bleiben.
      expect(regelnFuerAlle().length).toBeGreaterThan(1)
    } finally {
      umgebung.appUrl = 'https://hof.example'
    }
  })

  it('die Route ist statisch und sagt, dass robots kein Schutz ist', () => {
    expect(quelle()).not.toMatch(/force-dynamic|next\/headers|\bheaders\(\)|\bcookies\(\)/)
    expect(quelle()).toMatch(/kein Schutz/)
  })
})
