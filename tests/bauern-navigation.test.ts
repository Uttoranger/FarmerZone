/**
 * Tests für die Bauern-Navigation (src/lib/bauern-navigation.ts).
 *
 * Beweist:
 *  - Handy: fünf Plätze in fester Reihenfolge — Heute · Bestellungen · ➕ ·
 *    Mein Hof · Mehr; Produkte liegt dort oben im Mehr-Blatt.
 *  - Browser: dieselbe Ordnung als Leiste, mit „Produkte" zwischen
 *    Bestellungen und Mein Hof; „Neu" dort mit genau zwei Einträgen.
 *  - „Mein Hof" ist auf Hofseite, Beiträge und den /status-Unterseiten aktiv;
 *    Hofseite und Beiträge liegen auf /farm-page; Produkte trägt den Kopf
 *    nicht, ist aber seit Nr. 49 (Register N3) unter md der erste Reiter —
 *    EINE Liste (MEIN_HOF_REITER_HOFBEREICH), der Hinweis steht genau dort,
 *    wo der Reiter fehlt.
 *  - HofShell am Handy (N3): „Mein Hof" in der Leiste öffnet Produkte und gilt
 *    auf /products, /farm-page und /status; eigene Aktiv-Regel nur für die
 *    Leiste (gleich lange Treffer wie „Produkte" der Seitenleiste), das
 *    Mehr-Blatt ohne Mein Hof und ohne Produkte, die Seitenleiste unverändert.
 *  - Aktiv ist der längste passende Punkt; „Mehr" für alles, was im Blatt liegt.
 *  - „Hilfe und Rückmeldung" ist EIN Punkt nach /meldungen, aktiv auch auf
 *    /fehler-melden; „Meine Meldungen" trägt den Knopf „+ Neue Meldung",
 *    „Meldung abgeben" die Überschrift „Hilfe und Rückmeldung" (Nr. 22e).
 *  - „Admin" nur für den Betreiber.
 *  - Jede Seite unter src/app/(farmer) ist über die Navigation erreichbar.
 *  - Rückweg (Nr. 44, Register N1): elternseite() kennt jede Unterseite mit
 *    Name und Ziel aus Leiste und Mehr-Blatt; deren Seiten haben keinen.
 *    zielNachSpeichern(): Einstellungs-Unterseiten zurück zur Übersicht,
 *    Abholzeiten bleibt.
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
  hofHandyAktiverPunkt,
  hofHandyAriaAktuell,
  hofMehrAktiv,
  hofNavigation,
  PRODUKTE_HREF,
  HOF_NEU_TITEL,
  mehrAktiv,
  elternseite,
  zielNachSpeichern,
  EINSTELLUNG_KONTO,
  EINSTELLUNG_MEIN_AUFTRITT,
  GESPEICHERT_TEXT,
  HOFSEITE_HREF,
  HOFSEITE_WEG,
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
  it('Reiter (N3): Produkte (nur unter md) · Hofseite (Standard) · Beiträge — EINE Liste', () => {
    expect(MEIN_HOF_REITER_HOFBEREICH.map((r) => [r.id, r.label, r.href, r.nurUnterMd === true])).toEqual([
      ['produkte', 'Produkte', '/products', true],
      ['hofseite', 'Hofseite', '/farm-page', false],
      ['beitraege', 'Beiträge', BEITRAEGE_HREF, false],
    ])
    // Der Punkt „Mein Hof" der Seitenleiste führt zur Hofseite und gilt auch für /status und seine Unterseiten.
    expect(HAUPT.find((p) => p.id === 'mein-hof')?.href).toBe('/farm-page')
    expect(HAUPT.find((p) => p.id === 'mein-hof')?.auchAktivAuf).toEqual(['/status'])
    // Der Reiter „Produkte" ist dieselbe Seite wie der Punkt „Produkte" — keine zweite Adresse.
    expect(HAUPT.find((p) => p.id === 'produkte')?.href).toBe(PRODUKTE_HREF)
    expect(PRODUKTE_HREF).toBe('/products')
  })

  it('der Hinweis nennt den Platz von Produkte ab md — aus dem Reiter „Produkte", nicht abgeschrieben', () => {
    const produkte = MEIN_HOF_REITER_HOFBEREICH.find((r) => r.id === 'produkte')
    expect(produkte?.nurUnterMd).toBe(true)
    expect(MEIN_HOF_HINWEIS).toBe('Produkte verwaltest du links unter „Produkte“.')
    expect(MEIN_HOF_HINWEIS).toContain(`„${produkte?.label}“`)
  })

  it('der Kopf sitzt über Hofseite und Beiträge, mit genau ihrem Reiter und parallel geladenen Daten', () => {
    // /status trägt seit Nr. 22e keinen Kopf mehr — es leitet in den Reiter um.
    expect(quelle(hofSeite('/status'))).toContain('redirect(BEITRAEGE_HREF)')
    const meinHof = quelle(hofSeite('/farm-page'))
    const aufFarmPage = MEIN_HOF_REITER_HOFBEREICH.filter((r) => r.id !== 'produkte')
    // Gegenprobe: genau die beiden Reiter auf /farm-page.
    expect(aufFarmPage.map((r) => r.id)).toEqual(['hofseite', 'beitraege'])
    for (const reiter of aufFarmPage) {
      expect(reiter.href.split('?')[0]).toBe('/farm-page')
      expect(meinHof, reiter.id).toMatch(new RegExp(`<MeinHofSeitenkopf[^>]*aktiv="${reiter.id}"`))
    }
    expect(meinHof).toContain('getMeinHofKopf(session.user.id)')
  })

  it('Produkte trägt die Reiterleiste als ersten Reiter — nur unter md, ab md bleibt die Seite, wie sie war', () => {
    const seite = quelle('src/app/(hof)/products/page.tsx')
    expect(seite).toMatch(/<MeinHofReiterLeiste[^>]*aktiv="produkte"[^>]*nurUnterMd/)
  })

  it('Produkte trägt den Kopf nicht, sondern eine eigene Überschrift', () => {
    // Seit Nr. 18 in der HofShell: Die Überschrift steht in der Ansicht der Seite.
    const seite = quelle('src/app/(hof)/products/page.tsx') + quelle('src/components/produkte/produkte-ansicht.tsx')
    expect(seite).not.toContain('MeinHofSeitenkopf')
    expect(seite).toMatch(/<h1[^>]*>Produkte<\/h1>/)
  })

  it('die Reiterleiste ist EIN Baustein mit dem Hinweis und ohne Produktzahl; der Kopf nimmt ihn', () => {
    const leiste = quelle('src/components/mein-hof/reiter-leiste.tsx')
    const nav = leiste.slice(leiste.indexOf('<nav'), leiste.indexOf('</nav>'))
    expect(nav).toContain('{MEIN_HOF_HINWEIS}')
    expect(nav).toContain('MEIN_HOF_REITER_HOFBEREICH.map(')
    expect(nav).not.toContain('produktZahl')
    const kopf = quelle('src/components/mein-hof/seitenkopf.tsx')
    expect(kopf).toContain('<MeinHofReiterLeiste')
    // Keine zweite Reiterleiste im Kopf.
    expect(kopf).not.toContain('MEIN_HOF_REITER_HOFBEREICH.map(')
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
      return readdirSync(wurzel)
        .filter((n) => statSync(join(wurzel, n)).isDirectory())
        .map((name) => ({ gruppe, name }))
    })
    expect(ordner.length).toBeGreaterThan(5)
    // Gegenprobe: Die Suche erreicht beide Gruppen.
    expect(ordner.map((o) => o.name)).toContain('farm-page')
    expect(ordner.map((o) => o.name)).toContain('status')
    for (const { gruppe, name } of ordner) {
      expect(hofAktiverPunkt(`/${name}`), name).not.toBeNull()
      // Die Bestandsleiste (farmer-nav.tsx) zeichnet nur das Layout von
      // (farmer). Routen, die es dort nie gab (seit Nr. 22c /region), braucht
      // sie nicht zu kennen — alle früheren (farmer)-Routen kennt sie weiter.
      if (gruppe.includes('(farmer)') || name !== 'region') expect(aktiverPunkt(`/${name}`), name).not.toBeNull()
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
      // Seit Nr. 22c (Gate 8) eine eigene Route; /analytics/umfeld leitet dorthin um.
      ['Region', '/region'],
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
  it('Unterleiste (N3): Heute · Bestellungen · Plus · Mein Hof · Mehr', () => {
    const leiste = hofNavigation({ isAdmin: false }).handyLeiste
    expect(leiste.map((p) => (p.art === 'punkt' ? p.punkt.label : p.art))).toEqual([
      'Heute',
      'Bestellungen',
      'neu',
      'Mein Hof',
      'mehr',
    ])
  })

  it('„Mein Hof" in der Leiste öffnet Produkte — der Vorrat bleibt ein Tipp — und gilt für alle drei Reiter', () => {
    const leiste = hofNavigation({ isAdmin: false }).handyLeiste
    const meinHof = leiste.flatMap((p) => (p.art === 'punkt' && p.punkt.id === 'mein-hof' ? [p.punkt] : []))[0]
    expect(meinHof?.href).toBe(PRODUKTE_HREF)
    expect(meinHof?.auchAktivAuf).toEqual(['/farm-page', '/status'])
    // Ein eigener Punkt: In der Seitenleiste führt „Mein Hof" weiter zur Hofseite.
    expect(HAUPT.find((p) => p.id === 'mein-hof')?.href).toBe('/farm-page')
  })

  it('„Mehr" (N3): Kunden, Verkäufe, Auswertung, Region, Einstellungen, Hilfe und Rückmeldung, Admin — ohne Mein Hof und ohne Produkte', () => {
    expect(hofNavigation({ isAdmin: true }).mehr.map((p) => p.label)).toEqual([
      'Kunden',
      'Verkäufe',
      'Auswertung',
      'Region',
      'Einstellungen',
      'Hilfe und Rückmeldung',
      'Admin',
    ])
    const ziele = hofNavigation({ isAdmin: true }).mehr.map((p) => p.href)
    expect(ziele).not.toContain('/products')
    expect(ziele).not.toContain('/farm-page')
    expect(hofNavigation({ isAdmin: false }).mehr.map((p) => p.id)).not.toContain('admin')
  })

  it('Web und Handy haben dieselben Ziele — keins nur am Handy, keins doppelt; die Hofseite ist am Handy der Reiter von „Mein Hof"', () => {
    const hofseite = MEIN_HOF_REITER_HOFBEREICH.find((r) => r.id === 'hofseite')?.href
    // Der Reiter „Hofseite" ist genau das Ziel von „Mein Hof" in der Seitenleiste.
    expect(hofseite).toBe(HAUPT.find((p) => p.id === 'mein-hof')?.href)
    for (const isAdmin of [false, true]) {
      const nav = hofNavigation({ isAdmin })
      const web = [...nav.haupt, ...nav.verkaufUndKunden, ...nav.unten]
      const leiste = nav.handyLeiste.flatMap((p) => (p.art === 'punkt' ? [p.punkt] : []))
      const handy = [...leiste, ...nav.mehr]
      const webZiele = web.map((p) => p.href)
      const handyZiele = handy.map((p) => p.href)
      // Kein Eintrag doppelt — weder als Punkt noch als Ziel, auf keiner Seite.
      expect(new Set(webZiele).size, 'Seitenleiste').toBe(webZiele.length)
      expect(new Set(handyZiele).size, 'Leiste und Mehr-Blatt').toBe(handyZiele.length)
      expect(new Set(handy.map((p) => p.id)).size).toBe(handy.length)
      // Dieselbe Menge an Zielen. Einzige, benannte Ausnahme (N3): „Mein Hof" der
      // Leiste öffnet Produkte, die Hofseite liegt dort im Reiter. Kein Ziel steht nur am Handy.
      expect(new Set([...handyZiele, hofseite])).toEqual(new Set(webZiele))
      expect(webZiele.filter((ziel) => !handyZiele.includes(ziel))).toEqual([hofseite])
      expect(handyZiele.filter((ziel) => !webZiele.includes(ziel))).toEqual([])
      // Die Punkte des Mehr-Blatts sind dieselben Einträge wie in der Seitenleiste.
      for (const punkt of nav.mehr) expect(web).toContainEqual(punkt)
    }
  })

  it('Gegenprobe: ein Ziel nur am Handy oder ein doppelter Eintrag fiele auf', () => {
    const nav = hofNavigation({ isAdmin: false })
    const webZiele = [...nav.haupt, ...nav.verkaufUndKunden, ...nav.unten].map((p) => p.href)
    const handyZiele = [...nav.handyLeiste.flatMap((p) => (p.art === 'punkt' ? [p.punkt] : [])), ...nav.mehr].map((p) => p.href)
    const nurHandy = [...handyZiele, '/nur-am-handy']
    expect(nurHandy.filter((ziel) => !webZiele.includes(ziel))).toEqual(['/nur-am-handy'])
    const doppelt = [...handyZiele, handyZiele[0]]
    expect(new Set(doppelt).size).not.toBe(doppelt.length)
  })
})

describe('HofShell: aktive Punkte', () => {
  it.each([
    ['/dashboard', 'heute'],
    ['/orders/abc', 'bestellungen'],
    ['/products', 'produkte'],
    ['/status/new', 'mein-hof'],
    ['/analytics', 'auswertung'],
    ['/region', 'region'],
    // Die alte Adresse leitet nur noch um (Nr. 22c) — als Pfad gehört sie zur Auswertung.
    ['/analytics/umfeld', 'auswertung'],
    ['/admin/finanzen', 'admin'],
  ])('%s → %s', (pfad, id) => {
    expect(hofAktiverPunkt(pfad)).toBe(id)
  })

  it('„Mehr" leuchtet für alles im Mehr-Blatt, nicht für die Leiste — Mein Hof und Produkte gehören seit N3 zur Leiste', () => {
    for (const pfad of ['/customers', '/customers/abc', '/region', '/settings', '/settings/profile', '/meldungen', '/analytics/umfeld', '/admin']) {
      expect(hofMehrAktiv(pfad), pfad).toBe(true)
    }
    for (const pfad of ['/dashboard', '/orders', '/products', '/farm-page', '/status', '/status/new', '/onboarding']) {
      expect(hofMehrAktiv(pfad), pfad).toBe(false)
    }
  })

  it.each([
    ['/dashboard', 'heute'],
    ['/orders/abc', 'bestellungen'],
    ['/products', 'mein-hof'],
    ['/farm-page', 'mein-hof'],
    ['/status', 'mein-hof'],
    ['/status/new', 'mein-hof'],
    ['/status/xyz/send-whatsapp', 'mein-hof'],
    ['/customers', 'kunden'],
    ['/region', 'region'],
    ['/settings/teilen', 'einstellungen'],
  ])('Handy: %s → %s (eigene Regel der Leiste)', (pfad, id) => {
    expect(hofHandyAktiverPunkt(pfad)).toBe(id)
  })

  it('Handy: kein Treffer über ein Namenspräfix hinweg und keiner ohne Punkt', () => {
    expect(hofHandyAktiverPunkt('/productsx')).toBeNull()
    expect(hofHandyAktiverPunkt('/farm-pages')).toBeNull()
    expect(hofHandyAktiverPunkt('/onboarding')).toBeNull()
  })

  it('Aktiv-Zustand bei gleicher Länge: /products trifft „Produkte" der Seitenleiste und „Mein Hof" der Leiste mit demselben Ziel — jede Liste entscheidet für sich', () => {
    const nav = hofNavigation({ isAdmin: false })
    const produkte = nav.haupt.find((p) => p.id === 'produkte')
    const meinHofSeitenleiste = nav.haupt.find((p) => p.id === 'mein-hof')
    const meinHofLeiste = nav.handyLeiste.flatMap((p) => (p.art === 'punkt' && p.punkt.id === 'mein-hof' ? [p.punkt] : []))[0]
    // Gegenprobe: beide Punkte haben wirklich dasselbe Ziel, also gleich lange Treffer.
    expect(produkte?.href).toBe(meinHofLeiste?.href)
    // Seitenleiste unverändert: Produkte ist die Seite, Mein Hof nicht.
    expect(produkte && hofAriaAktuell('/products', produkte)).toBe('page')
    expect(meinHofSeitenleiste && hofAriaAktuell('/products', meinHofSeitenleiste)).toBeUndefined()
    expect(hofAktiverPunkt('/products')).toBe('produkte')
    // Leiste: Mein Hof ist die Seite; „Produkte" gibt es am Handy nicht als Punkt.
    expect(meinHofLeiste && hofHandyAriaAktuell('/products', meinHofLeiste)).toBe('page')
    for (const pfad of ['/products', '/farm-page', '/status/new', '/dashboard', '/customers']) {
      expect(hofHandyAktiverPunkt(pfad), pfad).not.toBe('produkte')
    }
  })

  it("Leiste: 'page' auf /products, 'true' auf den Reitern der Hofseite und den Unterseiten von /status", () => {
    const meinHofLeiste = hofNavigation({ isAdmin: false }).handyLeiste.flatMap((p) =>
      p.art === 'punkt' && p.punkt.id === 'mein-hof' ? [p.punkt] : []
    )[0]
    expect(meinHofLeiste).toBeDefined()
    if (!meinHofLeiste) return
    expect(hofHandyAriaAktuell('/products', meinHofLeiste)).toBe('page')
    expect(hofHandyAriaAktuell('/farm-page', meinHofLeiste)).toBe('true')
    expect(hofHandyAriaAktuell('/status/new', meinHofLeiste)).toBe('true')
    expect(hofHandyAriaAktuell('/dashboard', meinHofLeiste)).toBeUndefined()
  })

  it('die Seitenleiste bleibt, wie sie war: Produkte und Mein Hof getrennt, Mein Hof auf /farm-page und /status', () => {
    const nav = hofNavigation({ isAdmin: false })
    expect(nav.haupt.map((p) => [p.id, p.href])).toEqual([
      ['heute', '/dashboard'],
      ['bestellungen', '/orders'],
      ['produkte', '/products'],
      ['mein-hof', '/farm-page'],
    ])
    expect(hofAktiverPunkt('/farm-page')).toBe('mein-hof')
    expect(hofAktiverPunkt('/status/new')).toBe('mein-hof')
    const meinHof = nav.haupt.find((p) => p.id === 'mein-hof')
    expect(meinHof && hofAriaAktuell('/farm-page', meinHof)).toBe('page')
    expect(meinHof && hofAriaAktuell('/status/new', meinHof)).toBe('true')
  })

  it("aria-current: 'page' auf der Zielseite, 'true' auf Unterseiten", () => {
    const nav = hofNavigation({ isAdmin: false })
    const region = nav.verkaufUndKunden.find((p) => p.id === 'region')
    const auswertung = nav.verkaufUndKunden.find((p) => p.id === 'auswertung')
    expect(region && hofAriaAktuell('/region', region)).toBe('page')
    expect(auswertung && hofAriaAktuell('/region', auswertung)).toBeUndefined()
    expect(region && hofAriaAktuell('/analytics', region)).toBeUndefined()
    expect(auswertung && hofAriaAktuell('/analytics', auswertung)).toBe('page')
  })

  it('die Bestandsnavigation bleibt, wie sie ist: /analytics/umfeld gehört dort weiter zur Auswertung', () => {
    expect(aktiverPunkt('/analytics/umfeld')).toBe('auswertung')
  })
})

// ─── Rückweg auf Unterseiten (Nachtlauf Nr. 44, Register N1) ────────────────

describe('elternseite — wohin der Rückweg einer Unterseite führt', () => {
  const nav = hofNavigation({ isAdmin: true })
  const punkt = (id: string) => {
    const p = [...nav.haupt, ...nav.verkaufUndKunden, ...nav.unten].find((x) => x.id === id)
    if (!p) throw new Error(`kein Punkt ${id}`)
    return { href: p.href, name: p.label }
  }
  // Sicher: Der Test „Reiter: Hofseite (Standard) · Beiträge" oben beweist, dass es den Reiter gibt.
  const beitraege = MEIN_HOF_REITER_HOFBEREICH.find((r) => r.id === 'beitraege')!

  it.each([
    ['/settings/profile', 'einstellungen'],
    ['/settings/pickup-slots', 'einstellungen'],
    ['/settings/payments', 'einstellungen'],
    ['/settings/pause', 'einstellungen'],
    ['/settings/account', 'einstellungen'],
    ['/settings/appearance', 'einstellungen'],
    ['/settings/konditionen', 'einstellungen'],
    ['/settings/teilen', 'einstellungen'],
    ['/customers/k-1', 'kunden'],
    ['/orders/bestellung-1', 'bestellungen'],
    ['/fehler-melden', 'hilfe'],
    ['/analytics/umfeld', 'auswertung'],
    ['/status/plakat', 'heute'],
  ])('%s → %s (Name und Ziel aus der Navigation)', (pfad, id) => {
    expect(elternseite(pfad)).toEqual(punkt(id))
  })

  it('die Zuordnung mit den Namen, wie sie der Kopf zeigt', () => {
    expect(elternseite('/settings/profile')).toEqual({ href: '/settings', name: 'Einstellungen' })
    expect(elternseite('/customers/abc')).toEqual({ href: '/customers', name: 'Kunden' })
    expect(elternseite('/orders/abc')).toEqual({ href: '/orders', name: 'Bestellungen' })
    expect(elternseite('/fehler-melden')).toEqual({ href: '/meldungen', name: 'Hilfe und Rückmeldung' })
    expect(elternseite('/analytics/umfeld')).toEqual({ href: '/analytics', name: 'Auswertung' })
    expect(elternseite('/status/plakat')).toEqual({ href: '/dashboard', name: 'Heute' })
  })

  it('/status/new und WhatsApp fortsetzen → der Reiter „Beiträge" von Mein Hof (E12)', () => {
    expect(elternseite('/status/new')).toEqual({ href: BEITRAEGE_HREF, name: 'Beiträge' })
    expect(elternseite('/status/beitrag-1/send-whatsapp')).toEqual({ href: beitraege.href, name: beitraege.label })
  })

  it('Seiten der Leiste und des Mehr-Blatts haben keinen Rückweg', () => {
    const ziele = [
      ...nav.handyLeiste.flatMap((p) => (p.art === 'punkt' ? [p.punkt.href] : [])),
      ...nav.mehr.map((p) => p.href),
      ...nav.haupt.map((p) => p.href),
      ...MEIN_HOF_REITER_HOFBEREICH.map((r) => r.href),
    ]
    // Gegenprobe: alle Ziele beider Teile sind dabei.
    expect(ziele).toEqual(expect.arrayContaining(['/dashboard', '/orders', '/products', '/farm-page', '/customers', '/sales', '/analytics', '/region', '/settings', '/meldungen', '/admin', BEITRAEGE_HREF]))
    for (const ziel of ziele) expect(elternseite(ziel), ziel).toBeNull()
  })

  it('Suche, Anker und Schrägstrich am Ende ändern nichts; tiefer als die Route trifft nichts', () => {
    expect(elternseite('/orders/abc?filter=heute')).toEqual({ href: '/orders', name: 'Bestellungen' })
    expect(elternseite('/settings/profile#betriebsnummer')).toEqual({ href: '/settings', name: 'Einstellungen' })
    expect(elternseite('/fehler-melden/')).toEqual({ href: '/meldungen', name: 'Hilfe und Rückmeldung' })
    // Druckansichten (ohne HofShell) und Pfade über ein Namenspräfix hinweg haben keinen.
    expect(elternseite('/orders/today/print')).toBeNull()
    expect(elternseite('/orders/abc/print')).toBeNull()
    expect(elternseite('/settingsx/profile')).toBeNull()
    expect(elternseite('/status')).toBeNull()
    expect(elternseite('/onboarding')).toBeNull()
    expect(elternseite(null)).toBeNull()
    expect(elternseite('')).toBeNull()
  })

  it('jede Seite unter src/app/(hof) ist entweder ein Ziel der Navigation oder hat einen Rückweg', () => {
    const seiten: string[] = []
    const wurzel = join(process.cwd(), 'src/app/(hof)')
    const suche = (ordner: string) => {
      for (const name of readdirSync(ordner)) {
        const p = join(ordner, name)
        if (statSync(p).isDirectory()) suche(p)
        else if (name === 'page.tsx') seiten.push(ordner.slice(wurzel.length).replace(/\\/g, '/').replace(/\[[^\]]+\]/g, 'x'))
      }
    }
    suche(wurzel)
    // Gegenprobe: die Suche erreicht Unterseiten in allen Tiefen.
    expect(seiten).toEqual(expect.arrayContaining(['/settings/profile', '/customers/x', '/status/x/send-whatsapp', '/dashboard']))
    const ziele = new Set([...nav.haupt, ...nav.verkaufUndKunden, ...nav.unten].map((p) => p.href.split('?')[0]))
    for (const pfad of seiten) {
      // /status leitet nur in den Reiter „Beiträge" um (E12) und zeigt nie einen Kopf.
      if (pfad === '/status') continue
      if (ziele.has(pfad)) expect(elternseite(pfad), pfad).toBeNull()
      else expect(elternseite(pfad), pfad).not.toBeNull()
    }
  })
})

describe('zielNachSpeichern — Einstellungs-Unterseiten führen zur Übersicht zurück', () => {
  it.each(['profile', 'appearance', 'pause', 'account', 'payments', 'teilen', 'konditionen'])('/settings/%s → /settings', (seite) => {
    expect(zielNachSpeichern(`/settings/${seite}`)).toBe('/settings')
  })

  it('Ausnahme: Abholzeiten bleibt auf der Seite', () => {
    expect(zielNachSpeichern('/settings/pickup-slots')).toBeNull()
    expect(zielNachSpeichern('/settings/pickup-slots/')).toBeNull()
  })

  it('außerhalb der Einstellungs-Unterseiten bleibt jede Seite — auch derselbe Baustein im Hofseiten-Editor', () => {
    for (const pfad of ['/settings', '/farm-page', '/orders/abc', '/status/new', '/customers/x', '/dashboard', null]) {
      expect(zielNachSpeichern(pfad), String(pfad)).toBeNull()
    }
  })

  it('der Toast heißt „Gespeichert"', () => {
    expect(GESPEICHERT_TEXT).toBe('Gespeichert')
  })
})

describe('Einstellungs-Unterseiten mit Namen außerhalb der Übersicht', () => {
  it('Mein Auftritt und Konto und Sicherheit: Name und Ziel an einer Stelle, das Ziel ist eine echte Seite', () => {
    // Seit Nr. 50 (Register N4) führt „Mein Auftritt" in Mein Hof, Reiter Hofseite.
    expect(EINSTELLUNG_MEIN_AUFTRITT).toEqual({ label: 'Mein Auftritt', href: '/farm-page' })
    expect(EINSTELLUNG_KONTO).toEqual({ label: 'Konto und Sicherheit', href: '/settings/account' })
    for (const ziel of [EINSTELLUNG_MEIN_AUFTRITT, EINSTELLUNG_KONTO]) expect(hofSeite(ziel.href)).toContain('(hof)')
  })

  it('die Adresse der Hofseite gibt es einmal: Reiter, Punkt „Mein Hof" und Mein Auftritt nehmen sie', () => {
    expect(HOFSEITE_HREF).toBe('/farm-page')
    expect(MEIN_HOF_REITER_HOFBEREICH.find((r) => r.id === 'hofseite')?.href).toBe(HOFSEITE_HREF)
    expect(EINSTELLUNG_MEIN_AUFTRITT.href).toBe(HOFSEITE_HREF)
    expect(quelle('src/lib/bauern-navigation.ts').match(/'\/farm-page'/g) ?? []).toHaveLength(0)
  })

  it('der Weg in Worten für das Hof-Profil: „Mein Hof → Hofseite" aus den Namen von Punkt und Reiter', () => {
    expect(HOFSEITE_WEG).toBe('Mein Hof → Hofseite')
  })
})
