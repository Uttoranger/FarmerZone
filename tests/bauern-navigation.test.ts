/**
 * Tests für die Bauern-Navigation (src/lib/bauern-navigation.ts).
 *
 * Beweist:
 *  - Handy: fünf Plätze in fester Reihenfolge — Heute · Bestellungen · ➕ ·
 *    Mein Hof · Mehr; Produkte liegt dort oben im Mehr-Blatt.
 *  - Browser: dieselbe Ordnung als Leiste, mit „Produkte" zwischen
 *    Bestellungen und Mein Hof; „Neu" dort mit genau zwei Einträgen.
 *  - „Mein Hof" ist auf Hofseite und Beiträge aktiv; die Reiter darunter
 *    kennen ihre Seite; Produkte trägt den Kopf nicht mehr.
 *  - Aktiv ist der längste passende Punkt; „Mehr" für alles, was im Blatt liegt.
 *  - „Hilfe und Rückmeldung" ist EIN Punkt nach /meldungen, aktiv auch auf
 *    /fehler-melden; die Seite trägt den Titel und den Knopf „Fehler melden".
 *  - „Admin" nur für den Betreiber.
 *  - Jede Seite unter src/app/(farmer) ist über die Navigation erreichbar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  HANDY_LEISTE,
  HAUPT,
  MEIN_HOF_HINWEIS,
  MEIN_HOF_REITER,
  NEU,
  NEU_BROWSER,
  NUR_IM_MEHR,
  UNTEN,
  VERKAUF_UND_KUNDEN,
  VERKAUF_UND_KUNDEN_TITEL,
  aktiverPunkt,
  ariaAktuell,
  fuerNutzer,
  mehrAktiv,
} from '@/lib/bauern-navigation'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('Reihenfolge', () => {
  it('Handy: Heute · Bestellungen · Plus · Mein Hof · Mehr', () => {
    expect(HANDY_LEISTE.map((p) => (p.art === 'punkt' ? p.punkt.label : p.art))).toEqual([
      'Heute',
      'Bestellungen',
      'neu',
      'Mein Hof',
      'mehr',
    ])
  })

  it('Browser: Produkte zwischen Bestellungen und Mein Hof; nur Bestellungen trägt eine Zahl', () => {
    expect(HAUPT.map((p) => [p.label, p.href, p.zahl])).toEqual([
      ['Heute', '/dashboard', undefined],
      ['Bestellungen', '/orders', 'bestellungen'],
      ['Produkte', '/products', undefined],
      ['Mein Hof', '/farm-page', undefined],
    ])
  })

  it('am Handy hat Produkte keinen Platz in der Leiste und steht deshalb im Mehr-Blatt', () => {
    expect(NUR_IM_MEHR.map((p) => p.id)).toEqual(['produkte'])
    expect(fuerNutzer({ isAdmin: false }).nurImMehr.map((p) => p.href)).toEqual(['/products'])
  })

  it('Plus am Handy: Verkauf eintragen, Status posten, Produkt anlegen — jeweils mit einem Satz', () => {
    expect(NEU.map((p) => [p.label, p.href])).toEqual([
      ['Verkauf eintragen', '/sales?neu=1'],
      ['Status posten', '/status/new'],
      ['Produkt anlegen', '/products?neu=1'],
    ])
    for (const p of NEU) expect(p.satz).toMatch(/^\S.*\.$/)
  })

  it('„Neu" im Browser: Neues Produkt und Neuer Beitrag, mit Untertitel, auf dieselben Ziele wie das Plus', () => {
    expect(NEU_BROWSER.map((p) => [p.label, p.satz, p.href])).toEqual([
      ['Neues Produkt', 'Foto, Preis, Lagerstand', '/products?neu=1'],
      ['Neuer Beitrag', 'Neuigkeit auf deiner Hofseite', '/status/new'],
    ])
    for (const p of NEU_BROWSER) expect(NEU.map((n) => n.href)).toContain(p.href)
  })

  it('Verkauf und Kunden: Kunden, Verkäufe, Auswertung — ohne Hofseite und Beiträge', () => {
    expect(VERKAUF_UND_KUNDEN_TITEL).toBe('Verkauf und Kunden')
    expect(VERKAUF_UND_KUNDEN.map((p) => [p.label, p.href])).toEqual([
      ['Kunden', '/customers'],
      ['Verkäufe', '/sales'],
      ['Auswertung', '/analytics'],
    ])
  })

  it('Unten: Einstellungen, Hilfe und Rückmeldung, Admin — kein zweiter Eintrag fürs Melden', () => {
    expect(UNTEN.map((p) => [p.label, p.href])).toEqual([
      ['Einstellungen', '/settings'],
      ['Hilfe und Rückmeldung', '/meldungen'],
      ['Admin', '/admin'],
    ])
    expect(UNTEN.map((p) => p.href)).not.toContain('/fehler-melden')
  })

  it('das Mehr-Blatt kennt Produkte, aber weder Hofseite noch Beiträge', () => {
    const imBlatt = [...NUR_IM_MEHR, ...VERKAUF_UND_KUNDEN, ...UNTEN].map((p) => p.href)
    expect(imBlatt).toContain('/products')
    expect(imBlatt).not.toContain('/farm-page')
    expect(imBlatt).not.toContain('/status')
  })
})

describe('Mein Hof', () => {
  it('Reiter: Hofseite (Standard) · Beiträge — Produkte ist keiner mehr', () => {
    expect(MEIN_HOF_REITER.map((r) => [r.label, r.href])).toEqual([
      ['Hofseite', '/farm-page'],
      ['Beiträge', '/status'],
    ])
    // Der Punkt „Mein Hof" führt zum ersten Reiter.
    expect(HAUPT.find((p) => p.id === 'mein-hof')?.href).toBe(MEIN_HOF_REITER[0].href)
    expect(MEIN_HOF_HINWEIS).toContain('Produkte')
  })

  it('der Kopf sitzt über jeder Reiter-Seite, mit genau ihrem Reiter und parallel geladenen Daten', () => {
    for (const reiter of MEIN_HOF_REITER) {
      const seite = quelle(`src/app/(farmer)${reiter.href}/page.tsx`)
      expect(seite, reiter.href).toMatch(new RegExp(`<MeinHofKopf[^>]*aktiv="${reiter.id}"`))
      expect(seite, reiter.href).toContain('getMeinHofKopf(session.user.id)')
    }
  })

  it('Produkte trägt den Kopf nicht mehr, sondern eine eigene Überschrift', () => {
    const seite = quelle('src/app/(farmer)/products/page.tsx')
    expect(seite).not.toContain('MeinHofKopf')
    expect(seite).toMatch(/<h1[^>]*>Produkte<\/h1>/)
  })

  it('die Reiterleiste trägt den Hinweis und keine Produktzahl mehr', () => {
    const kopf = quelle('src/components/farmer/mein-hof-kopf.tsx')
    const nav = kopf.slice(kopf.indexOf('<nav aria-label="Mein Hof"'), kopf.indexOf('</nav>'))
    expect(nav).toContain('{MEIN_HOF_HINWEIS}')
    expect(nav).not.toContain('produktZahl')
  })

  it('Unterseiten der Reiter (z. B. „Neuer Status") bekommen ihn nicht', () => {
    const unterseiten: string[] = []
    const suche = (ordner: string) => {
      for (const name of readdirSync(ordner)) {
        const pfad = join(ordner, name)
        if (statSync(pfad).isDirectory()) suche(pfad)
        else if (name === 'page.tsx') unterseiten.push(pfad)
      }
    }
    for (const reiter of MEIN_HOF_REITER) {
      const wurzel = join(process.cwd(), `src/app/(farmer)${reiter.href}`)
      for (const name of readdirSync(wurzel)) {
        if (statSync(join(wurzel, name)).isDirectory()) suche(join(wurzel, name))
      }
    }
    expect(unterseiten.length).toBeGreaterThan(0)
    for (const pfad of unterseiten) expect(readFileSync(pfad, 'utf8'), pfad).not.toContain('MeinHofKopf')
  })
})

describe('Hilfe und Rückmeldung', () => {
  // Sicher: Der Test „Unten: …" oben beweist, dass der Punkt existiert.
  const hilfe = UNTEN.find((p) => p.id === 'hilfe')!

  it('leuchtet auf /meldungen und auf /fehler-melden', () => {
    expect(aktiverPunkt('/meldungen')).toBe('hilfe')
    expect(aktiverPunkt('/fehler-melden')).toBe('hilfe')
    expect(ariaAktuell('/meldungen', hilfe)).toBe('page')
    expect(ariaAktuell('/fehler-melden', hilfe)).toBe('true')
  })

  it('die Seite heißt so und trägt den Knopf „Fehler melden" nach /fehler-melden', () => {
    const seite = quelle('src/app/(farmer)/meldungen/page.tsx')
    expect(seite).toContain('title="Hilfe und Rückmeldung"')
    expect(seite).toMatch(/href="\/fehler-melden"[\s\S]{0,400}Fehler melden/)
  })
})

describe('aria-current', () => {
  // Sicher: Der Test „Browser: …" oben beweist, dass die Punkte existieren.
  const meinHof = HAUPT.find((p) => p.id === 'mein-hof')!
  const produkte = HAUPT.find((p) => p.id === 'produkte')!
  const bestellungen = HAUPT.find((p) => p.id === 'bestellungen')!

  it("'page' nur auf genau der Zielseite, sonst 'true' — nie zwei Links als dieselbe Seite", () => {
    expect(ariaAktuell('/farm-page', meinHof)).toBe('page')
    expect(ariaAktuell('/status', meinHof)).toBe('true')
    expect(ariaAktuell('/status/new', meinHof)).toBe('true')
    expect(ariaAktuell('/products', produkte)).toBe('page')
    expect(ariaAktuell('/orders', bestellungen)).toBe('page')
    expect(ariaAktuell('/orders/abc', bestellungen)).toBe('true')
  })

  it('kein aria-current für andere Punkte', () => {
    expect(ariaAktuell('/products', meinHof)).toBeUndefined()
    expect(ariaAktuell('/farm-page', produkte)).toBeUndefined()
    expect(ariaAktuell('/orders', meinHof)).toBeUndefined()
    expect(ariaAktuell('/dashboard', bestellungen)).toBeUndefined()
  })
})

describe('Admin nur für Admins', () => {
  it('ohne Betreiberrechte fehlt Admin, sonst ist alles gleich', () => {
    const bauer = fuerNutzer({ isAdmin: false })
    const betreiber = fuerNutzer({ isAdmin: true })
    expect(bauer.unten.map((p) => p.id)).toEqual(['einstellungen', 'hilfe'])
    expect(betreiber.unten.map((p) => p.id)).toEqual(['einstellungen', 'hilfe', 'admin'])
    expect(bauer.haupt).toEqual(betreiber.haupt)
    expect(bauer.nurImMehr).toEqual(betreiber.nurImMehr)
    expect(bauer.verkaufUndKunden).toEqual(betreiber.verkaufUndKunden)
    expect(bauer.neu).toEqual(betreiber.neu)
    expect(bauer.neuBrowser).toEqual(betreiber.neuBrowser)
  })

  it('Admin trägt die Zahl der Meldungen', () => {
    expect(UNTEN.find((p) => p.id === 'admin')?.zahl).toBe('admin')
  })
})

describe('aktive Pfade', () => {
  it.each([
    ['/dashboard', 'heute'],
    ['/orders', 'bestellungen'],
    ['/orders/abc123', 'bestellungen'],
    ['/orders/today/print', 'bestellungen'],
    ['/products', 'produkte'],
    ['/farm-page', 'mein-hof'],
    ['/status', 'mein-hof'],
    ['/status/new', 'mein-hof'],
    ['/status/xyz/send-whatsapp', 'mein-hof'],
    ['/customers/abc', 'kunden'],
    ['/sales', 'verkaeufe'],
    ['/analytics/umfeld', 'auswertung'],
    ['/settings/pickup-slots', 'einstellungen'],
    ['/fehler-melden', 'hilfe'],
    ['/meldungen', 'hilfe'],
    ['/admin/meldungen', 'admin'],
  ])('%s → %s', (pfad, id) => {
    expect(aktiverPunkt(pfad)).toBe(id)
  })

  it('kein Treffer über ein Namenspräfix hinweg', () => {
    expect(aktiverPunkt('/ordersxyz')).toBeNull()
    expect(aktiverPunkt('/statusmeldung')).toBeNull()
    expect(aktiverPunkt('/onboarding')).toBeNull()
    expect(aktiverPunkt('/')).toBeNull()
  })

  it('Mehr ist aktiv für alles, was im Mehr-Blatt liegt — auch Produkte —, nicht für die Leiste', () => {
    for (const pfad of ['/products', '/customers', '/sales', '/analytics/umfeld', '/settings', '/fehler-melden', '/meldungen', '/admin']) {
      expect(mehrAktiv(pfad), pfad).toBe(true)
    }
    for (const pfad of ['/dashboard', '/orders', '/orders/today/print', '/farm-page', '/status', '/status/new', '/onboarding']) {
      expect(mehrAktiv(pfad), pfad).toBe(false)
    }
  })
})

describe('Vollständigkeit', () => {
  it('jede Seite unter src/app/(farmer) hat ihren Punkt in der Navigation', () => {
    const wurzel = join(process.cwd(), 'src/app/(farmer)')
    const ordner = readdirSync(wurzel).filter((n) => statSync(join(wurzel, n)).isDirectory())
    expect(ordner.length).toBeGreaterThan(5)
    for (const name of ordner) {
      expect(aktiverPunkt(`/${name}`), name).not.toBeNull()
    }
  })
})
