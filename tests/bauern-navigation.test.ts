/**
 * Tests für die Bauern-Navigation (src/lib/bauern-navigation.ts).
 *
 * Beweist:
 *  - Handy: fünf Plätze in fester Reihenfolge — Heute · Bestellungen · ➕ ·
 *    Mein Hof · Mehr; Produkte liegt dort oben im Mehr-Blatt.
 *  - Browser: dieselbe Ordnung als Leiste, mit „Produkte" zwischen
 *    Bestellungen und Mein Hof; „Neu" dort mit genau zwei Einträgen.
 *  - „Mein Hof" ist auf Hofseite, Beiträge und den /status-Unterseiten aktiv;
 *    beide Reiter liegen auf /farm-page; Produkte trägt den Kopf nicht mehr.
 *  - Aktiv ist der längste passende Punkt; „Mehr" für alles, was im Blatt liegt.
 *  - „Hilfe und Rückmeldung" ist EIN Punkt nach /meldungen, aktiv auch auf
 *    /fehler-melden; „Meine Meldungen" trägt den Knopf „+ Neue Meldung",
 *    „Meldung abgeben" die Überschrift „Hilfe und Rückmeldung" (Nr. 22e).
 *  - „Admin" nur für den Betreiber.
 *  - Jede Seite unter src/app/(farmer) ist über die Navigation erreichbar.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  HANDY_LEISTE,
  HAUPT,
  BEITRAEGE_HREF,
  MEIN_HOF_HINWEIS,
  MEIN_HOF_REITER_HOFBEREICH,
  NEU,
  NEU_BROWSER,
  NUR_IM_MEHR,
  UNTEN,
  VERKAUF_UND_KUNDEN,
  VERKAUF_UND_KUNDEN_TITEL,
  aktiverPunkt,
  ariaAktuell,
  fuerNutzer,
  hofAktiverPunkt,
  hofAriaAktuell,
  hofMehrAktiv,
  hofNavigation,
  HOF_NEU_TITEL,
  mehrAktiv,
} from '@/lib/bauern-navigation'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

/** Die Routengruppen des Hofbereichs: Bestand (FarmerNav) und HofShell (seit Nr. 16). */
const HOF_GRUPPEN = ['src/app/(farmer)', 'src/app/(hof)'] as const

/** Die page.tsx einer Hof-Route — in welcher der beiden Gruppen sie gerade liegt. */
function hofSeite(href: string): string {
  const treffer = HOF_GRUPPEN.map((g) => `${g}${href}/page.tsx`).filter((p) => existsSync(join(process.cwd(), p)))
  expect(treffer, href).toHaveLength(1)
  return treffer[0]
}

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
  it('Reiter: Hofseite (Standard) · Beiträge, beide auf /farm-page — Produkte ist keiner mehr', () => {
    expect(MEIN_HOF_REITER_HOFBEREICH.map((r) => [r.label, r.href])).toEqual([
      ['Hofseite', '/farm-page'],
      ['Beiträge', BEITRAEGE_HREF],
    ])
    // Der Punkt „Mein Hof" führt zum ersten Reiter und gilt auch für /status und seine Unterseiten.
    expect(HAUPT.find((p) => p.id === 'mein-hof')?.href).toBe(MEIN_HOF_REITER_HOFBEREICH[0].href)
    expect(HAUPT.find((p) => p.id === 'mein-hof')?.auchAktivAuf).toEqual(['/status'])
    expect(MEIN_HOF_HINWEIS).toContain('Produkte')
  })

  it('der Kopf sitzt über beiden Reitern, mit genau ihrem Reiter und parallel geladenen Daten', () => {
    // /status trägt seit Nr. 22e keinen Kopf mehr — es leitet in den Reiter um.
    expect(quelle(hofSeite('/status'))).toContain('redirect(BEITRAEGE_HREF)')
    const meinHof = quelle(hofSeite('/farm-page'))
    for (const reiter of MEIN_HOF_REITER_HOFBEREICH) {
      expect(reiter.href.split('?')[0]).toBe('/farm-page')
      expect(meinHof, reiter.id).toMatch(new RegExp(`<MeinHofSeitenkopf[^>]*aktiv="${reiter.id}"`))
    }
    expect(meinHof).toContain('getMeinHofKopf(session.user.id)')
  })

  it('Produkte trägt den Kopf nicht, sondern eine eigene Überschrift', () => {
    // Seit Nr. 18 in der HofShell: Die Überschrift steht in der Ansicht der Seite.
    const seite = quelle('src/app/(hof)/products/page.tsx') + quelle('src/components/produkte/produkte-ansicht.tsx')
    expect(seite).not.toContain('MeinHofSeitenkopf')
    expect(seite).toMatch(/<h1[^>]*>Produkte<\/h1>/)
  })

  it('die Reiterleiste trägt den Hinweis und keine Produktzahl', () => {
    const kopf = quelle('src/components/mein-hof/seitenkopf.tsx')
    const nav = kopf.slice(kopf.indexOf('<nav aria-label="Mein Hof"'), kopf.indexOf('</nav>'))
    expect(nav).toContain('{MEIN_HOF_HINWEIS}')
    expect(nav).not.toContain('produktZahl')
  })

  it('Unterseiten von /status (z. B. „Neuer Beitrag") bekommen den Kopf nicht', () => {
    const unterseiten: string[] = []
    const suche = (ordner: string) => {
      for (const name of readdirSync(ordner)) {
        const pfad = join(ordner, name)
        if (statSync(pfad).isDirectory()) suche(pfad)
        else if (name === 'page.tsx') unterseiten.push(pfad)
      }
    }
    suche(join(process.cwd(), 'src/app/(hof)/status'))
    // Gegenprobe: Umleitung, Neuer Beitrag, WhatsApp fortsetzen und (seit Nr. 21) das QR-Plakat wurden gefunden.
    expect(unterseiten.length).toBe(4)
    for (const pfad of unterseiten) expect(readFileSync(pfad, 'utf8'), pfad).not.toContain('MeinHofSeitenkopf')
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

  it('Meine Meldungen trägt „+ Neue Meldung", Meldung abgeben die Überschrift des Punkts', () => {
    const meldungen = quelle(hofSeite('/meldungen')) + quelle('src/components/hof-hilfe/meine-meldungen.tsx')
    expect(meldungen).toContain('Meine Meldungen')
    expect(meldungen).toMatch(/href=\{NEUE_MELDUNG_HREF\}[\s\S]{0,400}Neue Meldung/)
    const abgeben = quelle(hofSeite('/fehler-melden'))
    expect(abgeben).toContain('Hilfe und Rückmeldung')
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
  it('jede Seite unter src/app/(farmer) und src/app/(hof) hat ihren Punkt in der Navigation', () => {
    const ordner = HOF_GRUPPEN.flatMap((gruppe) => {
      const wurzel = join(process.cwd(), gruppe)
      return readdirSync(wurzel).filter((n) => statSync(join(wurzel, n)).isDirectory())
    })
    expect(ordner.length).toBeGreaterThan(5)
    // Gegenprobe: Die Suche erreicht beide Gruppen.
    expect(ordner).toContain('farm-page')
    expect(ordner).toContain('status')
    for (const name of ordner) {
      expect(aktiverPunkt(`/${name}`), name).not.toBeNull()
      expect(hofAktiverPunkt(`/${name}`), name).not.toBeNull()
    }
  })
})

// ─── Neue HofShell (Gate 2, Redesign) ────────────────────────────────────────
// Die Ordnung nach docs/ai/DESIGN_SYSTEM.md, „Shells und Navigation – feste
// Einträge". Sie steht in derselben Datei wie die Bestandsnavigation und baut
// aus denselben Punkten; die Bestandsnavigation oben bleibt unverändert, bis
// die erste Route in die HofShell umzieht.
describe('HofShell: Seitenleiste', () => {
  it('Hauptpunkte: Heute · Bestellungen · Produkte · Mein Hof — dieselben Punkte wie im Bestand', () => {
    const nav = hofNavigation({ isAdmin: false })
    expect(nav.haupt.map((p) => p.label)).toEqual(['Heute', 'Bestellungen', 'Produkte', 'Mein Hof'])
    expect(nav.haupt).toEqual(HAUPT)
  })

  it('„Verkauf und Kunden": Kunden · Verkäufe · Auswertung · Region', () => {
    const nav = hofNavigation({ isAdmin: false })
    expect(nav.verkaufUndKunden.map((p) => [p.label, p.href])).toEqual([
      ['Kunden', '/customers'],
      ['Verkäufe', '/sales'],
      ['Auswertung', '/analytics'],
      // Region gibt es als eigene Route erst mit Gate 8; bis dahin ist es das Umfeld.
      ['Region', '/analytics/umfeld'],
    ])
  })

  it('unten: Einstellungen · Hilfe und Rückmeldung · Admin (nur Betreiber, mit Zahl)', () => {
    expect(hofNavigation({ isAdmin: false }).unten.map((p) => p.id)).toEqual(['einstellungen', 'hilfe'])
    const betreiber = hofNavigation({ isAdmin: true }).unten
    expect(betreiber.map((p) => p.id)).toEqual(['einstellungen', 'hilfe', 'admin'])
    expect(betreiber.find((p) => p.id === 'admin')?.zahl).toBe('admin')
  })

  it('„Beiträge" ist kein eigener Punkt neben „Mein Hof" (E12: Reiter in Mein Hof)', () => {
    const nav = hofNavigation({ isAdmin: true })
    const alle = [...nav.haupt, ...nav.verkaufUndKunden, ...nav.unten, ...nav.mehr]
    expect(alle.map((p) => p.href)).not.toContain('/status')
    expect(alle.map((p) => p.label)).not.toContain('Beiträge')
  })

  it('Neu-Menü: „Was legst du an?" mit den drei Bereichen, Beitrag und Verkauf eintragen (E13) — auf die vorhandenen Dialoge', () => {
    expect(HOF_NEU_TITEL).toBe('Was legst du an?')
    expect(hofNavigation({ isAdmin: false }).neu.map((p) => [p.label, p.href])).toEqual([
      ['Lebensmittel', '/products?neu=1&bereich=lebensmittel'],
      ['Futtermittel', '/products?neu=1&bereich=futter'],
      ['Brennmaterial', '/products?neu=1&bereich=brennmaterial'],
      ['Neuer Beitrag', '/status/new'],
      ['Verkauf eintragen', '/sales?neu=1'],
    ])
    // Jeder Eintrag führt in einen vorhandenen Dialog — der Bereich ist nur ein Zusatz zum Auftrag.
    for (const p of hofNavigation({ isAdmin: false }).neu) {
      const ohneBereich = p.href.replace(/&bereich=[a-z]+$/, '')
      expect(NEU.map((n) => n.href)).toContain(ohneBereich)
    }
  })
})

describe('HofShell: Handy', () => {
  it('Unterleiste: Heute · Bestellungen · Plus · Produkte · Mehr', () => {
    const leiste = hofNavigation({ isAdmin: false }).handyLeiste
    expect(leiste.map((p) => (p.art === 'punkt' ? p.punkt.label : p.art))).toEqual([
      'Heute',
      'Bestellungen',
      'neu',
      'Produkte',
      'mehr',
    ])
  })

  it('„Mehr": Mein Hof, Kunden, Verkäufe, Auswertung, Region, Einstellungen, Hilfe und Rückmeldung, Admin', () => {
    expect(hofNavigation({ isAdmin: true }).mehr.map((p) => p.label)).toEqual([
      'Mein Hof',
      'Kunden',
      'Verkäufe',
      'Auswertung',
      'Region',
      'Einstellungen',
      'Hilfe und Rückmeldung',
      'Admin',
    ])
    expect(hofNavigation({ isAdmin: false }).mehr.map((p) => p.id)).not.toContain('admin')
  })

  it('Web und Handy bekommen dieselben Einträge — jeder Punkt der Seitenleiste steckt in Leiste oder „Mehr", als derselbe Eintrag', () => {
    for (const isAdmin of [false, true]) {
      const nav = hofNavigation({ isAdmin })
      const web = [...nav.haupt, ...nav.verkaufUndKunden, ...nav.unten]
      const handy = [
        ...nav.handyLeiste.flatMap((p) => (p.art === 'punkt' ? [p.punkt] : [])),
        ...nav.mehr,
      ]
      expect(handy.map((p) => p.id).sort()).toEqual(web.map((p) => p.id).sort())
      for (const punkt of handy) expect(web).toContainEqual(punkt)
    }
  })
})

describe('HofShell: aktive Punkte', () => {
  it.each([
    ['/dashboard', 'heute'],
    ['/orders/abc', 'bestellungen'],
    ['/products', 'produkte'],
    ['/status/new', 'mein-hof'],
    ['/analytics', 'auswertung'],
    ['/analytics/umfeld', 'region'],
    ['/admin/finanzen', 'admin'],
  ])('%s → %s', (pfad, id) => {
    expect(hofAktiverPunkt(pfad)).toBe(id)
  })

  it('„Mehr" leuchtet für alles im Mehr-Blatt, nicht für die Leiste', () => {
    for (const pfad of ['/farm-page', '/status', '/customers', '/analytics/umfeld', '/settings', '/meldungen']) {
      expect(hofMehrAktiv(pfad), pfad).toBe(true)
    }
    for (const pfad of ['/dashboard', '/orders', '/products', '/onboarding']) {
      expect(hofMehrAktiv(pfad), pfad).toBe(false)
    }
  })

  it("aria-current: 'page' auf der Zielseite, 'true' auf Unterseiten", () => {
    const nav = hofNavigation({ isAdmin: false })
    const region = nav.verkaufUndKunden.find((p) => p.id === 'region')
    const auswertung = nav.verkaufUndKunden.find((p) => p.id === 'auswertung')
    expect(region && hofAriaAktuell('/analytics/umfeld', region)).toBe('page')
    expect(auswertung && hofAriaAktuell('/analytics/umfeld', auswertung)).toBeUndefined()
    expect(auswertung && hofAriaAktuell('/analytics', auswertung)).toBe('page')
  })

  it('die Bestandsnavigation bleibt, wie sie ist: /analytics/umfeld gehört dort weiter zur Auswertung', () => {
    expect(aktiverPunkt('/analytics/umfeld')).toBe('auswertung')
  })
})
