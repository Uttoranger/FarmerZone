/**
 * Die Hofseite für Kundinnen im neuen Design — gerendert (react-dom/server in
 * Node, TESTING_GUIDELINES §1), so wie die Seite sie zeigt: KundeShell um
 * FarmPageView. Merkmale sind Texte, aria-Beschriftungen, Anker und
 * data-abschnitt — keine Layout-Klassen.
 *
 * Beweist:
 *  - Die Seite steht in der KundeShell (data-design="neu", Kopfzeile, eine
 *    Unterleiste) — für Kundinnen wie in der Vorschau des Hofs.
 *  - E1: Im Reiter Produkte stehen die Kategorie-Abschnitte in der Reihenfolge
 *    aus kategorieAbschnitte, mit Chips als Sprungmarken; kein Umschalter
 *    Hofladen | Futtermittel mehr.
 *  - ?bereich=futter öffnet den Reiter Produkte mit dem Futter-Abschnitt.
 *  - Die rechte Spalte ist EINE Komponente: Nächste Abholung, Abholzeiten,
 *    Zahlung & Kontakt (mit Gebührenhinweis), Anfahrt in einem <aside>, und
 *    nur hofseite-kunde.tsx bindet sie ein.
 *  - Zustände knapp und ausverkauft aus dem Bestand; kein „Merken".
 *  - E5: „Bar bei Abholung", nie „Karte bei Abholung"; E4: der Hinweis nennt
 *    den Satz des Hofs, gebührenfrei steht keiner da.
 *  - Reiter „Beiträge · n" nur mit Beitrag; er zeigt alle aktiven Beiträge, der neueste
 *    zuerst mit „Aktuell", die weiteren nur mit „vor …" (Register F8).
 *  - Schaufenster zuerst (Register N5, Nr. 51): In der Übersicht steht der
 *    Quelltext in der Reihenfolge, die man unter lg sieht — Fotos, bis zu
 *    vier Produkte, „Alle Produkte (n)", rechte Spalte, Über uns —, also
 *    folgen Tastatur und Screenreader ihr; Über uns und die Spalte je genau
 *    einmal. Ohne Produkte kein Schaufenster, die Übersicht wie bisher.
 *    Nach „Alle ansehen" und „Alle Produkte (n)" geht der Fokus auf den Reiter.
 *  - Die Produktkarte hat eine Vorschau-Variante ohne Link und ohne Korb
 *    (Käufer-Vorschau im Produktdialog); die Kaufkarte bleibt, wie sie ist.
 * Je Aussage eine Gegenprobe, dass die Suche das Merkmal auch findet.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const adresse = { suche: '' }
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(adresse.suche),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('next/link', () => ({
  // onNavigate und prefetch gehören Nexts Link, nicht dem <a>.
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; onNavigate?: unknown; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))

import { FarmPageView } from '@/components/farm/farm-page-view'
import { ProduktKarte } from '@/components/hofseite/produkt-karte'
import { HofseiteFotos } from '@/components/hofseite/hofseite-fotos'
import { kartenZustand } from '@/lib/bereiche-anzeige'
import { KAEUFER_VORSCHAU, type KartenVorschau } from '@/lib/hofseite-kunde'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import type { ProductCategoryValue } from '@/lib/taxonomie'

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
function dateien(ordner: string): string[] {
  const funde: string[] = []
  for (const name of readdirSync(join(WURZEL, ordner))) {
    const pfad = join(ordner, name)
    if (statSync(join(WURZEL, pfad)).isDirectory()) funde.push(...dateien(pfad))
    else if (/\.tsx?$/.test(name)) funde.push(relative(WURZEL, join(WURZEL, pfad)))
  }
  return funde
}

function produkt(id: string, name: string, category: ProductCategoryValue | null, stock = 20): PublicProduct {
  return {
    id, name, description: null, imageUrl: null, bildAusschnitt: null, category, categoryImageUrl: null,
    price: 4.5, unit: 'STUECK', unitSize: null, stock, isAvailable: true, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null,
    familieId: null, brennmaterial: null,
  }
}

const HOF: PublicFarm = {
  id: 'farm_test', slug: 'hof-test', name: 'Hof Test', ownerName: 'Erika Muster',
  description: 'Gemüse aus Musterdorf', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf',
  phone: '+43 660 0000000', email: 'hof@example.com', logoUrl: null, logoAusschnitt: null, bannerUrl: null,
  tagline: null, foundedYear: null, aboutText: 'Ein kleiner Familienbetrieb.', bannerType: 'GRADIENT', bannerValue: null, bannerFocusY: 50, bannerAusschnitt: null,
  sectionsConfig: [], farmValues: [], farmPhotos: [],
  acceptsOnline: true, acceptsOnsite: true, stripeAccountReady: true, isPaused: false, pauseMessage: null,
  serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: '2026-01-01T00:00:00.000Z',
  betriebsstatus: null,
  gruendungshof: false,
  gruendungSeit: null,
  abzeichenBlatt: null,
  products: [
    produkt('p_holz', 'Buchenscheite', 'BRENNHOLZ'),
    produkt('p_heu', 'Bergwiesen-Heu', 'HEU_STROH'),
    produkt('p_eier', 'Freilandeier', 'EIER', 3),
    produkt('p_honig', 'Blütenhonig', 'HONIG', 0),
    produkt('p_karotten', 'Karotten', 'GEMUESE'),
  ],
  pickupSlots: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
}

const STATUS: ActiveStatusPost = {
  id: 'status_1', title: 'Neue Ernte', body: 'Frische Karotten ab Freitag.', anlass: 'ANNOUNCEMENT',
  photoUrl: null, fotoAusschnitt: null, linkedProductIds: [], publishedAt: '2026-09-30T08:00:00.000Z',
}

type Ansicht = { art: 'kundin' | 'vorschau'; kaufen: boolean }
const KUNDIN: Ansicht = { art: 'kundin', kaufen: true }

/** Genau wie page.tsx: die KundeShell um FarmPageView. */
/** Der Zeitpunkt, den page.tsx einmal auf dem Server bestimmt (Nachbesserung 1: kein Date.now() beim Rendern). */
const JETZT = '2026-10-02T08:00:00.000Z'

function seite({ suche = '', farm = HOF, beitraege = [STATUS], ansicht = KUNDIN, jetzt = JETZT }: { suche?: string; farm?: PublicFarm; beitraege?: ActiveStatusPost[]; ansicht?: Ansicht; jetzt?: string } = {}): string {
  adresse.suche = suche
  return renderToStaticMarkup(
    createElement(KundeShellMitSitzung, null, createElement(FarmPageView, { farm, beitraege, reorderItems: [], ansicht, jetzt }))
  )
}

/** Die Reihenfolge, in der Texte im HTML stehen. */
function reihenfolge(html: string, texte: string[]): string[] {
  return texte.filter((t) => html.includes(t)).sort((a, b) => html.indexOf(a) - html.indexOf(b))
}

describe('die Hofseite steht in der KundeShell', () => {
  it('neues Design, Kopfzeile und Unterleiste — für Kundinnen und in der Vorschau', () => {
    for (const html of [seite(), seite({ ansicht: { art: 'vorschau', kaufen: false } })]) {
      expect(html).toContain('data-design="neu"')
      expect(html).toMatch(/<header\b/)
      expect(html.match(/<main\b/g)).toHaveLength(1)
      expect(html).toContain('Hof Test')
    }
  })

  it('die Seite legt die Shell herum, über die Hülle mit der Sitzung im Browser', () => {
    const text = quelle('src/app/(public)/[farmSlug]/page.tsx')
    expect(text).toMatch(/<KundeShellMitSitzung>\s*<FarmPageView/)
    expect(text).not.toMatch(/KundenKopf|auth\.api|headers\(\)/)
  })
})

describe('E1 — Kategorie-Abschnitte im Reiter Produkte', () => {
  const html = seite({ suche: 'reiter=produkte' })

  it('Abschnitte in der Reihenfolge des Hofs, Futtermittel und Brennmaterial am Ende', () => {
    const titel = ['id="kategorie-eier-titel"', 'id="kategorie-honig-titel"', 'id="kategorie-gemuese-titel"', 'id="kategorie-futtermittel-titel"', 'id="kategorie-brennmaterial-titel"']
    expect(reihenfolge(html, titel)).toEqual(titel)
  })

  it('Chips springen zu den Abschnitten; kein Umschalter Hofladen | Futtermittel', () => {
    expect(html).toContain('aria-label="Zu einer Kategorie springen"')
    for (const anker of ['#kategorie-eier', '#kategorie-futtermittel', '#kategorie-brennmaterial']) expect(html).toContain(`href="${anker}"`)
    expect(html).not.toContain('Hofladen')
  })

  it('die Übersicht zeigt keine Abschnitte, aber „Alle ansehen" zum Reiter Produkte', () => {
    const uebersicht = seite()
    expect(uebersicht).not.toContain('id="kategorie-futtermittel"')
    expect(uebersicht).toContain('href="/hof-test?reiter=produkte"')
    expect(uebersicht).toContain('Alle ansehen')
  })
})

describe('?bereich=futter springt zum Futter', () => {
  it('öffnet den Reiter Produkte mit dem Futter-Abschnitt', () => {
    const html = seite({ suche: 'bereich=futter' })
    expect(html).toMatch(/aria-current="page"[^>]*>Produkte · 5</)
    expect(html).toContain('id="kategorie-futtermittel"')
  })

  it('Gegenprobe: ohne Parameter ist die Übersicht offen', () => {
    expect(seite()).toMatch(/aria-current="page"[^>]*>Übersicht</)
  })
})

describe('die rechte Spalte ist EINE Komponente', () => {
  const KARTEN = ['Nächste Abholung', 'Abholzeiten', 'Zahlung &amp; Kontakt', 'Anfahrt']

  it('alle vier Karten in einem <aside>', () => {
    const html = seite()
    const aside = html.slice(html.indexOf('<aside'), html.indexOf('</aside>'))
    expect(html.match(/<aside\b/g)).toHaveLength(1)
    for (const titel of KARTEN) expect(aside, titel).toContain(titel)
  })

  it('nur die Hofseite und die Produktseite (Nr. 11) binden sie ein, und die Karten stehen nirgends sonst', () => {
    const src = dateien('src')
    const einbinder = src.filter((p) => /<HofseiteSeitenspalte\b/.test(quelle(p)))
    expect(einbinder.sort()).toEqual(['src/components/hofseite/hofseite-kunde.tsx', 'src/components/produktdetail/produktdetail-kunde.tsx'])
    const mitKartentitel = dateien('src/components/hofseite').filter((p) => />\s*Abholzeiten\s*</.test(quelle(p)))
    expect(mitKartentitel).toEqual(['src/components/hofseite/hofseite-seitenspalte.tsx'])
  })
})

describe('Zustände der Produktkarten — knapp, ausverkauft, kein „Merken"', () => {
  const html = seite({ suche: 'reiter=produkte' })

  it('knapp nennt den Bestand, ausverkauft steht da, wo sonst der Knopf ist', () => {
    expect(html).toContain('Nur noch 3 Stück')
    expect(html).toContain('Ausverkauft')
    // Gegenprobe: ein Produkt mit genug Bestand hat den Knopf.
    expect(html).toContain('aria-label="Karotten in den Korb legen"')
    expect(html).not.toContain('aria-label="Blütenhonig in den Korb legen"')
  })

  it('knapp ist eine leise Zeile, keine Marke — „tun" (Orange) passt nicht für einen Hinweis an die Kundin (Freigabe Lauf 13)', () => {
    // Die Zeile selbst: gedämpfter Text, kein Element der Marke.
    expect(html).toMatch(/<span class="[^"]*text-muted-foreground[^"]*">Nur noch 3 Stück<\/span>/)
    expect(html).not.toMatch(/data-art="tun"[^>]*><span[^>]*>Nur noch 3 Stück/)
    // Gegenprobe: „Ausverkauft" bleibt eine Marke.
    expect(html).toMatch(/data-art="erledigt"[^>]*><span[^>]*>Ausverkauft/)
  })

  it('kein „Merken" — in keinem Reiter', () => {
    for (const suche of ['', 'reiter=produkte', 'reiter=beitraege']) expect(seite({ suche })).not.toMatch(/Merken/)
  })
})

describe('Zahlung und Gebühr', () => {
  it('E5: online und bar bei Abholung, nie Karte bei Abholung', () => {
    const html = seite()
    expect(html).toContain('Online bezahlen')
    expect(html).toContain('Bar bei Abholung')
    expect(html).not.toMatch(/Karte bei Abholung|Vor Ort \(Bar &amp; Karte\)|Online \(Karte\)/)
  })

  it('E4: der Hinweis nennt den Satz des Hofs — gebührenfrei steht keiner da', () => {
    expect(seite()).toContain('Preise zzgl. 5 % Servicegebühr (mind. € 0,50)')
    expect(seite({ suche: 'reiter=produkte' })).toContain('einmal pro Bestellung')
    expect(seite({ farm: { ...HOF, serviceFeeActiveFrom: null } })).not.toContain('Servicegebühr (mind.')
  })
})

describe('Reiter „Beiträge"', () => {
  it('nur mit Beitrag; dort steht er', () => {
    expect(seite()).toContain('>Beiträge · 1<')
    expect(seite({ suche: 'reiter=beitraege' })).toContain('Neue Ernte')
    expect(seite({ beitraege: [] })).not.toMatch(/>Beiträge/)
  })
})

describe('Reiter „Beiträge" — alle aktiven Beiträge (Register F8)', () => {
  const beitrag = (id: string, title: string, anlass: ActiveStatusPost['anlass'], publishedAt: string): ActiveStatusPost => ({
    ...STATUS, id, title, anlass, publishedAt,
  })
  // JETZT ist der 2. Oktober, 8 Uhr: vor 2 Stunden, vor 3 Tagen, vor 12 Tagen.
  const NEU = beitrag('status_neu', 'Frische Wels-Filets ab Freitag', 'FRESH_PRODUCT', '2026-10-02T06:00:00.000Z')
  const MITTE = beitrag('status_mitte', 'Zehn Ballen Heu zum Preis von neun', 'PROMOTION', '2026-09-29T08:00:00.000Z')
  const ALT = beitrag('status_alt', 'Neue Saison im Hofladen', 'NEW_SEASON', '2026-09-20T08:00:00.000Z')
  const LISTE = [NEU, MITTE, ALT]
  const offen = (beitraege: ActiveStatusPost[], farm: PublicFarm = HOF) => seite({ suche: 'reiter=beitraege', beitraege, farm })

  it('der Reiter nennt, wie viele Beiträge die Seite zeigt', () => {
    expect(seite({ beitraege: LISTE })).toContain('>Beiträge · 3<')
    expect(seite({ beitraege: [NEU] })).toContain('>Beiträge · 1<')
  })

  it('alle stehen da, in der Reihenfolge der Liste — der neueste zuerst', () => {
    const html = offen(LISTE)
    expect(reihenfolge(html, [ALT.title, MITTE.title, NEU.title])).toEqual([NEU.title, MITTE.title, ALT.title])
    // Jede Karte trägt ihren eigenen Anlass, nicht den der ersten.
    expect(html).toContain('Frisches Produkt')
    expect(html).toContain('Neue Saison</span>')
  })

  it('„Aktuell" steht genau einmal, am neuesten; die weiteren tragen nur „vor …"', () => {
    const html = offen(LISTE)
    expect(html.match(/Aktuell ·/g)).toHaveLength(1)
    // Die Zeit steht über dem Titel ihrer Karte, Karte für Karte.
    const folge = ['Aktuell · vor 2 Stunden', NEU.title, 'vor 3 Tagen', MITTE.title, 'vor 12 Tagen', ALT.title]
    expect(reihenfolge(html, [...folge].reverse())).toEqual(folge)
  })

  it('ein einzelner Beitrag ist der neueste: „Aktuell" steht da, wie vorher', () => {
    expect(offen([MITTE])).toContain('Aktuell · vor 3 Tagen')
  })

  it('jede Karte benennt sich mit ihrer eigenen Überschrift — keine Kennung kommt zweimal vor', () => {
    const html = offen(LISTE)
    const kennungen = [...html.matchAll(/aria-labelledby="(beitrag-titel-[^"]+)"/g)].map((treffer) => treffer[1])
    expect(kennungen).toHaveLength(3)
    expect(new Set(kennungen).size).toBe(3)
    for (const kennung of kennungen) expect(html).toContain(`id="${kennung}"`)
  })

  it('hat der Hof den Abschnitt Status ausgeblendet, gibt es weder Reiter noch Beiträge', () => {
    const ohneStatus: PublicFarm = { ...HOF, sectionsConfig: [{ key: 'status', visible: false, order: 1 }] }
    expect(seite({ beitraege: LISTE, farm: ohneStatus })).not.toMatch(/>Beiträge/)
    expect(offen(LISTE, ohneStatus)).not.toContain(NEU.title)
  })
})

describe('Leer, pausiert, lange Namen', () => {
  it('ohne Produkte und Abholzeiten: Leerzustand mit Ausweg', () => {
    const html = seite({ farm: { ...HOF, products: [], pickupSlots: [] } })
    expect(html).toContain('Dieser Hof richtet gerade seinen Shop ein')
    expect(html).toContain('href="/hoefe"')
  })

  it('pausiert: Hinweis mit dem Text des Hofs, keine Termine, kein Kaufknopf', () => {
    const html = seite({ farm: { ...HOF, isPaused: true, pauseMessage: 'Wir sind im Urlaub.' }, suche: 'reiter=produkte' })
    expect(html).toContain('Hof Test pausiert gerade.')
    expect(html).toContain('Wir sind im Urlaub.')
    expect(html).not.toContain('Nächste Abholung')
    expect(html).not.toMatch(/in den Korb legen/)
  })

  it('ein Hofname mit 80 Zeichen steht in höchstens zwei Zeilen', () => {
    const lang = 'Biohof '.repeat(12).slice(0, 80)
    const html = seite({ farm: { ...HOF, name: lang } })
    expect(html).toMatch(new RegExp(`<h1[^>]*line-clamp-2[^>]*>${lang}</h1>`))
  })
})

describe('beide Themes: nur Tokens in den Teilen der Hofseite', () => {
  // Wie auf /hoefe (tests/hoefe-seite.test.ts): keine Palettenfarben, kein
  // Schwarz/Weiß (Schleier auf Fotos nehmen die theme-festen Tokens,
  // DESIGN_SYSTEM „Bild-Overlays"), keine Hexwerte, keine Bestandspalette --app-*.
  const PALETTE = /\b(?:text|bg|border|ring|from|to|via)-(?:red|amber|green|emerald|lime|yellow|orange|slate|gray|zinc|neutral|stone|sky|blue|teal)-\d{2,3}\b/
  const SCHWARZ_WEISS = /\b(?:text|bg|border|ring|from|to|via|fill|stroke|outline|shadow|divide|decoration)-(?:black|white)(?![\w-])/
  const HEX = /#[0-9a-fA-F]{3,8}\b/
  const BESTAND = /\b(?:app-(?:page|ink|chip|line-firm|button|bar|trough)|notice)\b|var\(--app-/

  it('erkennt sie (Gegenprobe)', () => {
    expect(SCHWARZ_WEISS.test('from-black/25')).toBe(true)
    expect(PALETTE.test('text-amber-700')).toBe(true)
    expect(HEX.test("'#2D5F3F'")).toBe(true)
    expect(BESTAND.test('bg-app-chip text-app-ink')).toBe(true)
    expect(SCHWARZ_WEISS.test('from-primary-foreground/75 text-accent-foreground whitespace-nowrap')).toBe(false)
  })

  it('keine Datei der Kundenansicht nutzt sie', () => {
    const route = [
      'src/app/(public)/[farmSlug]/page.tsx',
      'src/app/(public)/[farmSlug]/loading.tsx',
      'src/components/farm/cart-sheet.tsx',
      ...dateien('src/components/hofseite'),
    ]
    for (const pfad of route) {
      const text = quelle(pfad)
      expect(PALETTE.test(text), pfad).toBe(false)
      expect(SCHWARZ_WEISS.test(text), pfad).toBe(false)
      expect(HEX.test(text), pfad).toBe(false)
      // Die Ladeansicht staffelt wie die übrigen Skelette über app-trough/app-chip (DESIGN_SYSTEM, Ladeansicht).
      if (!pfad.endsWith('loading.tsx')) expect(BESTAND.test(text), pfad).toBe(false)
    }
  })

  it('die Ladeansicht steht im neuen Design (sie kommt vor der Shell)', () => {
    expect(quelle('src/app/(public)/[farmSlug]/loading.tsx')).toContain('data-design="neu"')
  })
})

describe('Reiter und Chips schreiben die Adresse so, dass Next sie abgleicht', () => {
  it('replaceState mit Zustand null — mit window.history.state gleicht Next useSearchParams nicht ab', () => {
    for (const pfad of ['src/components/hofseite/hofseite-kunde.tsx', 'src/components/hofseite/produkt-abschnitte.tsx']) {
      const text = quelle(pfad)
      expect(text, pfad).toMatch(/history\.replaceState\(null,/)
      expect(text, pfad).not.toMatch(/replaceState\(window\.history\.state/)
    }
  })
})

// ─── Nachbesserung 1 ────────────────────────────────────────────────────────

describe('JSON-LD: Text des Hofs bleibt im <script>', () => {
  const ANGRIFF = '</script><script>alert(1)</script>'
  const html = seite({ farm: { ...HOF, name: `Hof ${ANGRIFF}`, description: ANGRIFF } })
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)

  it('der Block endet erst nach dem JSON, und das JSON trägt Name und Beschreibung', () => {
    expect(block).not.toBeNull()
    expect(JSON.parse(block![1])).toMatchObject({ name: `Hof ${ANGRIFF}`, description: ANGRIFF })
  })

  it('kein eingeschleustes <script>alert', () => {
    expect(html).not.toContain('<script>alert(1)')
  })

  it('die Seite nimmt dafür jsonLdSicher, nie JSON.stringify direkt im Script', () => {
    const text = quelle('src/components/hofseite/hofseite-kunde.tsx')
    expect(text).toContain('jsonLdSicher(')
    expect(text).not.toMatch(/__html:\s*JSON\.stringify/)
  })
})

describe('Mini-Warenkorb rechnet in Cent, nicht in Fließkomma', () => {
  it('keine Multiplikation oder Summe über price in der rechten Spalte', () => {
    const text = quelle('src/components/hofseite/hofseite-seitenspalte.tsx')
    expect(text).not.toMatch(/\.price\s*\*/)
    expect(text).toContain('korbBetraege(')
    expect(text).toContain('centsAlsEuro(')
  })
})

describe('Gebührenhinweis bei Mindestgebühr 0', () => {
  it('kein „mind. € 0,00"', () => {
    const html = seite({ farm: { ...HOF, serviceFeeMinCents: 0 } })
    expect(html).toContain('Preise zzgl. 5 % Servicegebühr – im Warenkorb')
    expect(html).not.toContain('mind. € 0,00')
  })
})

describe('Stepper der Produktkarte endet am Bestand', () => {
  const karte = (stock: number, imKorb: number) => {
    const p = { ...HOF.products[4]!, stock }
    return renderToStaticMarkup(
      createElement(ProduktKarte, {
        produkt: p, zustand: kartenZustand(p, false), imKorb, wirdHinzugefuegt: false,
        href: '/hof-test/produkt/p_karotten', onInDenKorb: () => {}, onMenge: () => {},
      })
    )
  }
  const plus = (html: string) => html.match(/<button[^>]*aria-label="Menge Karotten: eins mehr"[^>]*>/)?.[0] ?? ''

  // Base UI sperrt über aria-disabled (die Klasse „disabled:…" zählt nicht).
  it('alles im Korb, was da ist: „+" ist gesperrt', () => {
    expect(plus(karte(3, 3))).toContain('aria-disabled="true"')
  })

  it('Gegenprobe: unter dem Bestand geht „+"', () => {
    expect(plus(karte(20, 3))).toContain('aria-disabled="false"')
  })
})

describe('Hydration: kein Zeitpunkt aus der Uhr beim Rendern', () => {
  it('„vor 2 Tagen" aus dem übergebenen Zeitpunkt', () => {
    expect(seite({ suche: 'reiter=beitraege' })).toContain('vor 2 Tagen')
    expect(seite({ suche: 'reiter=beitraege', jetzt: '2026-09-30T10:00:00.000Z' })).toContain('vor 2 Stunden')
  })

  it('weder Date.now() noch new Date() in der Kundenansicht; page.tsx bestimmt den Zeitpunkt', () => {
    const text = quelle('src/components/hofseite/hofseite-kunde.tsx')
    expect(text).not.toMatch(/Date\.now\(\)|new Date\(\)/)
    expect(quelle('src/app/(public)/[farmSlug]/page.tsx')).toMatch(/jetzt=\{/)
  })
})

// ─── Nr. 11: Produktseite ───────────────────────────────────────────────────

describe('Produktkarten verlinken auf die Produktseite (Nr. 11)', () => {
  it('Bild und Name sind ein echter Link — kein Blatt mehr', () => {
    const html = seite({ suche: 'reiter=produkte' })
    expect(html).toContain('href="/hof-test/produkt/p_karotten"')
    expect(html).toContain('href="/hof-test/produkt/p_honig"')
    expect(html).not.toContain('Details ansehen')
  })

  it('in der Vorschau des Hofs bleibt der Link in der Vorschau', () => {
    const html = seite({ suche: 'reiter=produkte', ansicht: { art: 'vorschau', kaufen: false } })
    expect(html).toContain('href="/hof-test/produkt/p_karotten?vorschau=1"')
  })

  it('das alte Produktblatt gibt es nicht mehr — eine Darstellung der Produktdetails', () => {
    const src = dateien('src')
    expect(src).not.toContain('src/components/farm/produkt-detail.tsx')
    expect(src.filter((p) => /\bProduktDetail\b/.test(quelle(p)))).toEqual([])
  })
})

// ─── Nr. 51: Schaufenster zuerst (Register N5) ──────────────────────────────

describe('Schaufenster zuerst (Register N5, Nr. 51)', () => {
  const FOTOS = [1, 2, 3].map((i) => ({ id: `foto_${i}`, url: `/landing/row-${i}.jpg`, caption: null, sortOrder: i, ausschnitt: null }))

  it('der Quelltext hat die Reihenfolge, die man unter lg sieht: Fotos, Produkte, „Alle Produkte (n)", rechte Spalte, Über uns', () => {
    const html = seite({ farm: { ...HOF, farmPhotos: FOTOS } })
    const stellen = [
      html.indexOf('id="fotos"'),
      html.indexOf('aria-label="Karotten in den Korb legen"'),
      html.indexOf('>Alle Produkte (5)<'),
      html.indexOf('<aside'),
      html.indexOf('id="ueber-uns"'),
    ]
    expect(stellen.every((stelle) => stelle > -1), String(stellen)).toBe(true)
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
    // Über uns steht im Quelltext nach dem Schaufenster UND nach der Spalte — Screenreader lesen es zuletzt.
    expect(html.indexOf('id="ueber-uns"')).toBeGreaterThan(html.indexOf('</aside>'))
  })

  it('Über uns und die rechte Spalte stehen je genau einmal da — keine doppelte Kennung, nichts doppelt fokussierbar', () => {
    for (const farm of [{ ...HOF, farmPhotos: FOTOS }, { ...HOF, products: [], farmPhotos: FOTOS }]) {
      const html = seite({ farm })
      expect(html.match(/id="ueber-uns"/g)).toHaveLength(1)
      expect(html.match(/<aside\b/g)).toHaveLength(1)
      expect(html.match(/data-abschnitt="kontakt"/g)).toHaveLength(1)
      expect(html.match(/id="fotos"/g)).toHaveLength(1)
    }
  })

  it('bis zu vier Produkte: Kaufbares in der Reihenfolge des Hofs, Ausverkauftes rückt nicht nach', () => {
    const html = seite()
    for (const name of ['Buchenscheite', 'Bergwiesen-Heu', 'Freilandeier', 'Karotten']) {
      expect(html, name).toContain(`aria-label="${name} in den Korb legen"`)
    }
    expect(html).not.toContain('Blütenhonig')
    // Gegenprobe: Im Reiter Produkte steht auch der Honig.
    expect(seite({ suche: 'reiter=produkte' })).toContain('Blütenhonig')
  })

  it('„Alle Produkte (n)" wechselt in den Reiter Produkte — n ist die Zahl des Reiters', () => {
    const html = seite()
    expect(html).toMatch(/<a[^>]*href="\/hof-test\?reiter=produkte"[^>]*>Alle Produkte \(5\)</)
    expect(html).toContain('>Produkte · 5<')
    // Nur in der Übersicht: Im Reiter Produkte steht schon alles.
    expect(seite({ suche: 'reiter=produkte' })).not.toContain('Alle Produkte (')
  })

  it('Fotos: jede Kachel öffnet die Bildansicht, kein Bild liegt in einem Link (Meldung cmua8bof); ohne Fotos kein Abschnitt', () => {
    expect(seite()).not.toContain('id="fotos"')
    const html = seite({ farm: { ...HOF, farmPhotos: FOTOS } })
    const bereich = html.slice(html.indexOf('id="fotos"'), html.indexOf('</section>', html.indexOf('id="fotos"')))
    // Je drei im Mosaik (unter lg) und im Raster (ab lg) — Register N5, Nr. 107.
    expect(bereich.match(/<button[^>]*aria-label="Foto \d von 3 öffnen"/g)).toHaveLength(6)
    expect(bereich).toContain('aria-label="Fotos von Hof Test, 3 insgesamt"')
    expect(bereich).not.toMatch(/<a\b/)
    // Auch die Fotos stehen vor der rechten Spalte.
    expect(html.indexOf('id="fotos"')).toBeLessThan(html.indexOf('<aside'))
  })

  it('EINE Fotokomponente mit EINER Bildansicht — Mosaik und Raster sind zwei Listen derselben Fotos, je eine zu sehen', () => {
    for (const schaufenster of [true, false]) {
      const html = renderToStaticMarkup(createElement(HofseiteFotos, { fotos: FOTOS, hofName: 'Hof Test', schaufenster }))
      expect(html.match(/<ul\b/g), String(schaufenster)).toHaveLength(2)
      expect(html.match(/<button\b/g), String(schaufenster)).toHaveLength(6)
      expect(html).not.toMatch(/<a\b/)
    }
    expect(quelle('src/components/hofseite/hofseite-fotos.tsx').match(/useBildansicht\(/g)).toHaveLength(1)
    expect(quelle('src/components/hofseite/hofseite-fotos.tsx').match(/<BildansichtEbene\b/g)).toHaveLength(1)
    expect(quelle('src/components/hofseite/hofseite-kunde.tsx').match(/<HofseiteFotos\b/g)).toHaveLength(1)
  })

  it('ohne Produkte kein Schaufenster: die Übersicht bleibt, wie sie war — rechte Spalte, Über uns, Fotos', () => {
    const html = seite({ farm: { ...HOF, products: [], farmPhotos: FOTOS } })
    expect(html).not.toContain('Alle Produkte (')
    expect(html).toContain('Gerade keine Produkte')
    expect(html.indexOf('<aside')).toBeLessThan(html.indexOf('id="ueber-uns"'))
    expect(html.indexOf('id="ueber-uns"')).toBeLessThan(html.indexOf('id="fotos"'))
  })

  it('in den Reitern Produkte und Beiträge bleibt die Reihenfolge, wie sie war', () => {
    for (const suche of ['reiter=produkte', 'reiter=beitraege']) {
      const html = seite({ suche })
      expect(html.indexOf('<aside'), suche).toBeLessThan(html.indexOf('id="produkte"'))
    }
  })

  it('nach „Alle ansehen" und „Alle Produkte (n)" geht der Fokus auf den Reiter Produkte, ohne Scrollen — der Link verschwindet mit dem Wechsel', () => {
    const text = quelle('src/components/hofseite/hofseite-kunde.tsx')
    // Beide Links im Inhalt wechseln über dieselbe Funktion, mit Fokus auf den Reiter.
    expect(text.match(/onNavigate=\{zeigeReiter\('produkte', \{ fokusAufReiter: true \}\)\}/g)).toHaveLength(2)
    expect(text).toMatch(/document\.querySelector<HTMLElement>\(`\[data-reiter="\$\{id\}"\]`\)\?\.focus\(\{ preventScroll: true \}\)/)
    // Die Reiterleiste und „Bestellen" im Kopf bleiben nach dem Wechsel stehen — ihr Fokus auch.
    expect(text).toMatch(/onNavigate=\{zeigeReiter\(r\.id\)\}/)
    expect(text.match(/onNavigate=\{zeigeReiter\('produkte'\)\}/g)).toHaveLength(1)
    // Gegenprobe: Die Reiterleiste trägt das Merkmal, das der Fokus sucht — gerendert.
    expect(seite()).toMatch(/<a[^>]*data-reiter="produkte"[^>]*>Produkte · 5</)
  })
})

// ─── Nr. 51: Produktkarte als Vorschau ──────────────────────────────────────

describe('ProduktKarte: Vorschau-Variante (muster) ohne Link und ohne Korb (Nr. 51)', () => {
  const VORSCHAU: KartenVorschau = {
    name: 'Bergkäse', imageUrl: null, categoryImageUrl: '/categories/milch.webp', price: 12.9, unit: 'KG', unitSize: 0.5,
  }
  const vorschau = (produkt: KartenVorschau) => renderToStaticMarkup(createElement(ProduktKarte, { variante: 'muster', produkt }))

  it('zeigt Bild, Name und Preis mit denselben Helfern wie die Kaufkarte', () => {
    const html = vorschau(VORSCHAU)
    expect(html).toContain('Bergkäse')
    expect(html).toContain('€ 12,90 für 0,5 kg')
    expect(html).toContain('€ 25,80 / kg')
    expect(html).toContain('src="/categories/milch.webp"')
  })

  it('kein Link, kein Korb-Knopf, keine Menge', () => {
    const html = vorschau(VORSCHAU)
    expect(html).not.toMatch(/<a\b/)
    expect(html).not.toMatch(/<button\b/)
    expect(html).not.toMatch(/in den Korb|Menge /)
  })

  it('ohne gültigen Preis ein ruhiger Platzhalter, nie „NaN" oder „€ 0,00"', () => {
    const html = vorschau({ ...VORSCHAU, price: null })
    expect(html).toContain(KAEUFER_VORSCHAU.preisFehlt)
    expect(html).not.toMatch(/NaN|€ 0,00/)
    // Gegenprobe: mit Preis kein Platzhalter.
    expect(vorschau(VORSCHAU)).not.toContain(KAEUFER_VORSCHAU.preisFehlt)
  })

  it('ein Name mit 100 Zeichen steht in höchstens zwei Zeilen, der volle Name im title', () => {
    const lang = 'Bergkäse '.repeat(12).slice(0, 100)
    const html = vorschau({ ...VORSCHAU, name: lang })
    expect(html).toMatch(new RegExp(`title="${lang}"`))
    expect(html).toMatch(new RegExp(`<span[^>]*line-clamp-2[^>]*>${lang}</span>`))
  })

  it('Gegenprobe: die Kaufkarte hat weiter Link und Korb-Knopf', () => {
    const p = HOF.products[4]!
    const html = renderToStaticMarkup(
      createElement(ProduktKarte, {
        produkt: p, zustand: kartenZustand(p, false), imKorb: 0, wirdHinzugefuegt: false,
        href: '/hof-test/produkt/p_karotten', onInDenKorb: () => {}, onMenge: () => {},
      })
    )
    expect(html).toContain('href="/hof-test/produkt/p_karotten"')
    expect(html).toContain('aria-label="Karotten in den Korb legen"')
  })
})
