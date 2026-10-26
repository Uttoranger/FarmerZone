/**
 * Nr. 181 (Lauf 25): die letzten Altrouten und die Fakten der Datenschutzerklärung.
 *
 *  - Die Druckseiten (Abholzettel, Packliste) stehen in der eigenen Gruppe
 *    (druck): schlankes Papier-Layout ohne Navigation, nur Tokens, Wache wie
 *    jede Hof-Seite. Die Gruppe (farmer) und die alte Leiste (FarmerNav) gibt
 *    es nicht mehr.
 *  - /datenschutz steht in der KundeShell; der alte Kopf (KundenKopf) ist weg.
 *  - Die Erklärung nennt, was gebaut ist (Anmeldung mit Code, Geräte-Cookie,
 *    IP-Adresse je Sitzung, Cookie „Bestellungen finden", Cloudflare) und
 *    widerspricht sich bei der Reichweitenmessung nicht mehr.
 *  - /teilen trägt das neue Design; der Service Worker bleibt unberührt.
 *  - Toter Code (newsletter.tsx, ungenutzte Onboarding-Actions) ist entfernt.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', { 'data-shell': 'kunde' }, children),
}))

import DatenschutzPage from '@/app/(public)/datenschutz/page'
import { GERAETE_COOKIE } from '@/lib/geraete'
import { BESTELLUNGEN_COOKIE, BESTELLUNGEN_PFAD } from '@/lib/bestellungen-finden'

const WURZEL = process.cwd()
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8')
const gibt = (pfad: string): boolean => existsSync(join(WURZEL, pfad))
/** Nur der Code zählt — Kommentare dürfen erklären, was hier gesucht wird. */
const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function dateien(ordner: string, endung: RegExp): string[] {
  return readdirSync(join(WURZEL, ordner)).flatMap((name) => {
    const rel = `${ordner}/${name}`
    if (statSync(join(WURZEL, rel)).isDirectory()) return dateien(rel, endung)
    return endung.test(name) ? [rel] : []
  })
}
const QUELLEN = [...dateien('src', /\.(ts|tsx)$/), ...dateien('tests', /\.(ts|tsx)$/)].filter((d) => d !== 'tests/altrouten-datenschutz.test.ts')

const DRUCKSEITEN = ['src/app/(druck)/orders/[orderId]/print/page.tsx', 'src/app/(druck)/orders/today/print/page.tsx']

describe('Druckseiten — eigene Gruppe (druck), Papier ohne Navigation', () => {
  it('die Seiten liegen in (druck), die Gruppe (farmer) gibt es nicht mehr', () => {
    for (const seite of DRUCKSEITEN) expect(gibt(seite), seite).toBe(true)
    expect(gibt('src/app/(farmer)')).toBe(false)
    // Gegenprobe: Die Suche findet, was es gibt.
    expect(gibt('src/app/(hof)/layout.tsx')).toBe(true)
  })

  it('das Layout ist schlank: Papier aus Tokens, Sitzungsprüfung über die Wache, keine Navigation', () => {
    const layout = ohneKommentare(lies('src/app/(druck)/layout.tsx'))
    expect(layout).toContain('data-design="neu"')
    expect(layout).toContain('bg-accent-foreground')
    expect(layout).toContain('text-primary-foreground')
    expect(layout).toMatch(/await verlangeHofDerSitzung\(\)/)
    for (const verboten of ['FarmerNav', 'HofShell', 'KundeShell', 'ladeHofbereich', 'Banner']) expect(layout, verboten).not.toContain(verboten)
  })

  it.each(DRUCKSEITEN)('%s prüft über die Wache und kennt keine Palette', (seite) => {
    const code = ohneKommentare(lies(seite))
    expect(code).toMatch(/await verlangeHofDerSitzung\(\)/)
    expect(code).not.toMatch(/auth\.api\.getSession|redirect\(\s*['"`]\/login/)
    expect(code).not.toMatch(/\b(?:text|bg|border|divide)-(?:slate|gray|zinc|neutral|stone|white|black)\b/)
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it.each(DRUCKSEITEN)('%s hat ihre Ladeansicht', (seite) => {
    expect(gibt(seite.replace('page.tsx', 'loading.tsx'))).toBe(true)
  })

  it('die alte Leiste ist entfernt — nichts importiert sie mehr', () => {
    expect(gibt('src/components/farmer/farmer-nav.tsx')).toBe(false)
    const treffer = QUELLEN.filter((d) => /components\/farmer\/farmer-nav|<FarmerNav\b/.test(ohneKommentare(lies(d))))
    expect(treffer).toEqual([])
    // Gegenprobe: Die Suche würde einen Import finden.
    expect(/components\/farmer\/farmer-nav/.test("import { FarmerNav } from '@/components/farmer/farmer-nav'")).toBe(true)
  }, 30_000)

  it('der alte Teil der Navigation ist entfernt, die HofShell-Ordnung bleibt', () => {
    const quelle = ohneKommentare(lies('src/lib/bauern-navigation.ts'))
    for (const name of ['fuerNutzer', 'aktiverPunkt', 'mehrAktiv', 'ariaAktuell', 'HANDY_LEISTE', 'NUR_IM_MEHR', 'NEU_BROWSER']) {
      expect(quelle, name).not.toMatch(new RegExp(`export (?:const|function|type) ${name}\\b`))
    }
    for (const name of ['hofNavigation', 'hofAktiverPunkt', 'hofHandyAktiverPunkt', 'HOF_NEU', 'elternseite']) {
      expect(quelle, name).toMatch(new RegExp(`export (?:const|function) ${name}\\b`))
    }
    expect(lies('src/lib/bauern-navigation.ts')).not.toContain('farmer-nav')
  })
})

describe('/datenschutz — KundeShell statt des alten Kopfes', () => {
  it('die Seite trägt die KundeShell; KundenKopf und sein Menü-Blatt sind weg', () => {
    const seite = ohneKommentare(lies('src/app/(public)/datenschutz/page.tsx'))
    expect(seite).toContain('KundeShellMitSitzung')
    expect(seite).not.toMatch(/KundenKopf|KundeFuss/)
    const kopf = lies('src/components/shared/kunden-kopf.tsx')
    expect(kopf).not.toMatch(/export function KundenKopf\b|function MenueBlatt\b/)
    expect(gibt('src/lib/kunden-menue.ts')).toBe(false)
    const nutzer = QUELLEN.filter((d) => d.startsWith('src/')).filter((d) => /<KundenKopf\b|from '@\/components\/shared\/kunden-kopf'[^\n]*\bKundenKopf\b|\{[^}]*\bKundenKopf\b[^}]*\} from '@\/components\/shared\/kunden-kopf'/.test(ohneKommentare(lies(d))))
    expect(nutzer).toEqual([])
  }, 30_000)

  it('rendert in der Shell, der Seitenfuß kommt von ihr (nicht doppelt)', () => {
    const html = renderToStaticMarkup(createElement(DatenschutzPage))
    expect(html).toContain('data-shell="kunde"')
    expect(html).toContain('Datenschutzerklärung')
    expect(html).not.toContain('<footer')
  })
})

describe('Datenschutzerklärung — Fakten wie gebaut', () => {
  const html = (): string => renderToStaticMarkup(createElement(DatenschutzPage))
  const text = (): string => html().replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ')

  it('Abschnitt 10 beschreibt die Anmeldung mit Code, nicht den Magic-Link', () => {
    expect(text()).toContain('Anmeldung mit Code')
    expect(text()).not.toMatch(/Magic|Login-Link/)
  })

  it('das Geräte-Cookie steht da, mit Namen und den 400 Tagen aus dem Code', () => {
    expect(text()).toContain(GERAETE_COOKIE)
    expect(text()).toContain('400 Tage')
  })

  it('das Cookie „Bestellungen finden" steht da: 30 Minuten, nur für seinen Pfad', () => {
    expect(text()).toContain(BESTELLUNGEN_COOKIE)
    expect(text()).toContain('30 Minuten')
    expect(text()).toContain(BESTELLUNGEN_PFAD)
  })

  it('die IP-Adresse je Sitzung steht da', () => {
    expect(text()).toMatch(/IP-Adresse[^.]*Sitzung|Sitzung[^.]*IP-Adresse/)
  })

  it('Cloudflare steht bei den Dienstleistern: DNS und Empfang von E-Mails', () => {
    expect(text()).toMatch(/Cloudflare[^.]*DNS/)
    expect(text()).toMatch(/Cloudflare[^.]*E-Mail/)
  })

  it('Abschnitt 8 widerspricht Abschnitt 4 nicht mehr: Vercel Web Analytics wird genannt, „keine Analyse-Tools" nicht behauptet', () => {
    const t = text()
    expect(t).toContain('Vercel Web Analytics')
    expect(t).not.toMatch(/keine[^.]*Analyse-Tools/)
  })

  it('Satzzeichen: zwischen Wort und Markenname steht ein Leerzeichen („Betreiber von X“, nicht „vonX“)', () => {
    expect(text()).toMatch(/Betreiber von \S+ \(Kontaktdaten/)
    expect(text()).toMatch(/gespeichert\. \S+ speichert keine/)
  })

  it('Links sind grün (INFOSEITE_LINK), nie text-primary (orange) — in der KundeShell wie im Impressum', () => {
    expect(ohneKommentare(lies('src/app/(public)/datenschutz/page.tsx'))).not.toMatch(/text-primary\b/)
    expect(html()).toContain('text-brand-text')
  })

  it('Gegenprobe: die alten Zusagen bleiben (Sentry, Stripe, Stand)', () => {
    expect(text()).toContain('Sentry')
    expect(text()).toContain('Stripe')
    expect(text()).toContain('Stand: Oktober 2026')
  })
})

describe('/teilen — neues Design, Verhalten unverändert', () => {
  it('die Seite trägt data-design="neu"', () => {
    expect(lies('src/app/teilen/teilen-client.tsx')).toContain('data-design="neu"')
  })

  it('der Service Worker ist unberührt: POST /teilen, 303 auf die Seite', () => {
    const sw = lies('public/sw.js')
    expect(sw).toMatch(/\/teilen/)
    expect(sw).toMatch(/303/)
  })

  it('die Anmeldung behält den Rücksprung auf /teilen', () => {
    const seite = lies('src/app/teilen/page.tsx')
    expect(seite).toContain("redirect('/login?von=/teilen')")
  })

  it('keine Palette-Klasse, kein text-primary als Linkfarbe', () => {
    const code = ohneKommentare(lies('src/app/teilen/teilen-client.tsx'))
    expect(code).not.toMatch(/\btext-primary\b(?!-)/)
  })
})

describe('Toter Code — entfernt, mit Nachweis', () => {
  it('newsletter.tsx ist weg, und niemand importiert sie', () => {
    expect(gibt('src/emails/newsletter.tsx')).toBe(false)
    expect(QUELLEN.filter((d) => /emails\/newsletter|NewsletterEmail/.test(lies(d)))).toEqual([])
  }, 30_000)

  it('createOnboardingProducts und createOnboardingSlots sind weg, createFarm und checkSlugAvailability bleiben', () => {
    const quelle = lies('src/server/actions/onboarding.ts')
    expect(quelle).not.toMatch(/createOnboardingProducts|createOnboardingSlots/)
    expect(quelle).toMatch(/export async function createFarm\b/)
    expect(quelle).toMatch(/export async function checkSlugAvailability\b/)
    expect(QUELLEN.filter((d) => /createOnboardingProducts|createOnboardingSlots/.test(lies(d)))).toEqual([])
  }, 30_000)
})

describe('Wache deckt (druck) mit ab', () => {
  it('die Hof-Seiten-Wache liest beide Gruppen', () => {
    expect(relative(WURZEL, join(WURZEL, 'tests/hof-seiten-wache.test.ts'))).toBe('tests/hof-seiten-wache.test.ts')
    expect(lies('tests/hof-seiten-wache.test.ts')).toContain("'(druck)'")
  })
})
