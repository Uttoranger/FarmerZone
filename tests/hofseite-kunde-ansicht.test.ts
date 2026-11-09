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
 *  - Kein Reiter „Beiträge" mehr (Register F8, Nr. 128): Die aktiven Beiträge
 *    stehen als „Aktuell vom Hof" oben in der Übersicht, höchstens fünf, der
 *    neueste zuerst mit „Aktuell"; ?beitrag= und alte Links ?reiter=beitraege.
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
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))

import { FarmPageView } from '@/components/farm/farm-page-view'
import { ProduktKarte } from '@/components/hofseite/produkt-karte'
import { HofseiteFotos } from '@/components/hofseite/hofseite-fotos'
import { ohneKommaNachTag } from '@/components/hofseite/hofseite-seitenspalte'
import { kartenZustand, kaufSperre } from '@/lib/bereiche-anzeige'
import { KAEUFER_VORSCHAU, type KartenVorschau } from '@/lib/hofseite-kunde'
import { TESTHOF_HINWEIS } from '@/lib/testhof'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import { publicProduct } from './fabrik/public-product'
import { publicFarm } from './fabrik/public-farm'
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
  return publicProduct({ id, name, category, stock })
}

const HOF: PublicFarm = publicFarm({
  aboutText: 'Ein kleiner Familienbetrieb.',
  products: [
    produkt('p_holz', 'Buchenscheite', 'BRENNHOLZ'),
    produkt('p_heu', 'Bergwiesen-Heu', 'HEU_STROH'),
    produkt('p_eier', 'Freilandeier', 'EIER', 3),
    produkt('p_honig', 'Blütenhonig', 'HONIG', 0),
    produkt('p_karotten', 'Karotten', 'GEMUESE'),
  ],
})

const STATUS: ActiveStatusPost = {
  id: 'status_1', title: 'Neue Ernte', body: 'Frische Karotten ab Freitag.', anlass: 'ANNOUNCEMENT',
  photoUrl: null, fotoAusschnitt: null, linkedProductIds: [], publishedAt: '2026-09-30T08:00:00.000Z',
}

type Ansicht = { art: 'kundin' | 'vorschau'; kaufen: boolean }
const KUNDIN: Ansicht = { art: 'kundin', kaufen: true }

/** Genau wie page.tsx: die KundeShell um FarmPageView. */
/** Der Zeitpunkt, den page.tsx einmal auf dem Server bestimmt (Nachbesserung 1: kein Date.now() beim Rendern). */
const JETZT = '2026-10-02T08:00:00.000Z'

function seite({ suche = '', farm = HOF, beitraege = [STATUS], beitraegeFehler = false, ansicht = KUNDIN, jetzt = JETZT }: { suche?: string; farm?: PublicFarm; beitraege?: ActiveStatusPost[]; beitraegeFehler?: boolean; ansicht?: Ansicht; jetzt?: string } = {}): string {
  adresse.suche = suche
  return renderToStaticMarkup(
    // Die Kaufsperre wie page.tsx: einmal, mit demselben Zeitpunkt (Register N24).
    createElement(KundeShellMitSitzung, null, createElement(FarmPageView, { farm, beitraege, beitraegeFehler, reorderItems: [], ansicht, jetzt, sperre: kaufSperre(farm, new Date(jetzt)) }))
  )
}

/** Die Reihenfolge, in der Texte im HTML stehen. */
function reihenfolge(html: string, texte: string[]): string[] {
  return texte.filter((t) => html.includes(t)).sort((a, b) => html.indexOf(a) - html.indexOf(b))
}

describe('Titelbild der echten Hofseite (Nr. 117, Sammel-PR)', () => {
  it('trägt „Titelbild von {Hof}“ – die Seite reicht den Namen an das Titelbild weiter', () => {
    const html = seite({ farm: { ...HOF, bannerType: 'PHOTO', bannerUrl: 'https://blob.example/titel.jpg' } })
    expect(html).toContain('alt="Titelbild von Hof Test"')
    // Gegenprobe: Das Foto steht wirklich im HTML (sonst prüfte der Test nichts).
    expect(html).toContain('src="https://blob.example/titel.jpg"')
  })
})

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
    expect(text).toMatch(/<KundeShellMitSitzung aktiv="entdecken">\s*<FarmPageView/)
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
  }, 30_000)
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
    // Ein Satz in „Zahlung & Kontakt“ (Board w1-hofseite, Nr. 235).
    expect(html).toContain('Online bezahlen oder bar bei Abholung.')
    expect(html).not.toMatch(/Karte bei Abholung|Vor Ort \(Bar &amp; Karte\)|Online \(Karte\)/)
  })

  it('E4: der Hinweis nennt den Satz des Hofs — gebührenfrei steht keiner da', () => {
    expect(seite()).toContain('Preise zzgl. 5 % Servicegebühr (mind. € 0,50)')
    expect(seite({ suche: 'reiter=produkte' })).toContain('einmal pro Bestellung')
    expect(seite({ farm: { ...HOF, serviceFeeActiveFrom: null } })).not.toContain('Servicegebühr (mind.')
  })
})

describe('Kein Reiter „Beiträge" mehr (Register F8, Nr. 128)', () => {
  it('die Reiter heißen Übersicht · Produkte — auch mit Beiträgen', () => {
    const html = seite()
    expect(html).toMatch(/data-reiter="uebersicht"/)
    expect(html).toMatch(/data-reiter="produkte"/)
    expect(html).not.toMatch(/data-reiter="beitraege"|>Beiträge · /)
    // Gegenprobe: Der Beitrag steht trotzdem da — in der Übersicht.
    expect(html).toContain('Neue Ernte')
  })

  it('ein alter Link ?reiter=beitraege landet in der Übersicht bei „Aktuell vom Hof"', () => {
    const html = seite({ suche: 'reiter=beitraege' })
    expect(html).toMatch(/<a[^>]*data-reiter="uebersicht"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*data-reiter="uebersicht"/)
    expect(html).toContain('id="aktuell"')
    expect(html).toContain('Neue Ernte')
  })

  it('der Sprung zu „Aktuell vom Hof" hängt an EINER Regel, mit reduzierter Bewegung ohne Animation', () => {
    // Verdrahtungswache über den Quelltext: jsdom gibt es seit Nr. 135 als Entwicklungspaket,
    // diese Datei nutzt es nicht, deshalb läuft der Effekt hier nicht; die Regeln selbst prüft tests/aktuell-vom-hof-regeln.test.ts.
    const text = quelle('src/components/hofseite/hofseite-kunde.tsx')
    expect(text).toMatch(/springeZuAktuell\(suche\.get\(REITER_PARAMETER\), mitAktuell\)/)
    expect(text).toMatch(/prefers-reduced-motion: reduce/)
    expect(text).toMatch(/scrollVerhalten\(reduziert\)/)
  })
})

describe('„Aktuell vom Hof" in der Übersicht (Register F8, N5)', () => {
  const beitrag = (id: string, title: string, anlass: ActiveStatusPost['anlass'], publishedAt: string, mehr: Partial<ActiveStatusPost> = {}): ActiveStatusPost => ({
    ...STATUS, id, title, anlass, publishedAt, ...mehr,
  })
  // JETZT ist der 2. Oktober, 8 Uhr: vor 2 Stunden, vor 3 Tagen, vor 12 Tagen.
  const NEU = beitrag('statusneu', 'Frische Wels-Filets ab Freitag', 'FRESH_PRODUCT', '2026-10-02T06:00:00.000Z', {
    linkedProductIds: ['p_honig', 'p_karotten', 'p_weg'],
  })
  const MITTE = beitrag('statusmitte', 'Zehn Ballen Heu zum Preis von neun', 'PROMOTION', '2026-09-29T08:00:00.000Z')
  const ALT = beitrag('statusalt', 'Neue Saison im Hofladen', 'NEW_SEASON', '2026-09-20T08:00:00.000Z')
  const LISTE = [NEU, MITTE, ALT]
  const FOTOS = [1, 2].map((i) => ({ id: `foto_${i}`, url: `/landing/row-${i}.jpg`, caption: null, sortOrder: i, ausschnitt: null }))

  it('ohne aktiven Beitrag entfällt der Abschnitt ganz', () => {
    const html = seite({ beitraege: [] })
    expect(html).not.toContain('id="aktuell"')
    expect(html).not.toContain('Aktuell vom Hof')
    // Gegenprobe
    expect(seite({ beitraege: LISTE })).toContain('Aktuell vom Hof')
  })

  it('nur in der Übersicht — nicht im Reiter Produkte', () => {
    expect(seite({ beitraege: LISTE, suche: 'reiter=produkte' })).not.toContain('id="aktuell"')
  })

  it('Kopf: Abschnitt mit Überschrift „Aktuell vom Hof", ohne Zahl daneben (Board w1-/s1-hofseite, Nr. 235)', () => {
    const html = seite({ beitraege: LISTE })
    expect(html).toMatch(/<section[^>]*id="aktuell"[^>]*aria-labelledby="aktuell-titel"/)
    expect(html).toMatch(/<h2[^>]*id="aktuell-titel"[^>]*>Aktuell vom Hof<\/h2>/)
    expect(html).not.toContain('3 Beiträge')
    // Gegenprobe: alle drei Beiträge stehen da — nur die Zahl fehlt.
    expect(html.match(/<article aria-labelledby="beitrag-titel-/g)).toHaveLength(3)
  })

  it('unter lg steht er im Quelltext nach den Knöpfen und dem Reiter, vor Fotos und Produkten (N5)', () => {
    const html = seite({ beitraege: LISTE, farm: { ...HOF, farmPhotos: FOTOS } })
    const stellen = [
      html.indexOf('aria-label="Bereiche der Hofseite"'),
      html.indexOf('id="aktuell"'),
      html.indexOf('id="fotos"'),
      html.indexOf('aria-label="Buchenscheite in den Korb legen"'),
      html.indexOf('<aside'),
      html.indexOf('id="ueber-uns"'),
    ]
    expect(stellen.every((stelle) => stelle > -1), String(stellen)).toBe(true)
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
  })

  it('höchstens fünf, der neueste zuerst — „Aktuell" steht genau einmal, am neuesten (F8)', () => {
    const sechs = [NEU, MITTE, ALT, ...[4, 5, 6].map((n) => beitrag(`status${n}`, `Beitrag ${n}`, 'ANNOUNCEMENT', `2026-09-1${n}T08:00:00.000Z`))]
    const html = seite({ beitraege: sechs })
    expect(html.match(/<article aria-labelledby="beitrag-titel-/g)).toHaveLength(5)
    expect(html).not.toContain('Beitrag 6')
    expect(html.match(/Aktuell ·/g)).toHaveLength(1)
    // Die Zeit steht seit Nr. 235 in der Zeile des Titels, hinter ihm (Board w1-hofseite: die Karte bleibt zweizeilig).
    const folge = [NEU.title, 'Aktuell · vor 2 Stunden', MITTE.title, 'vor 3 Tagen', ALT.title, 'vor 12 Tagen']
    expect(reihenfolge(html, [...folge].reverse())).toEqual(folge)
  })

  it('je Beitrag ein article mit eigener Überschrift — keine Kennung doppelt', () => {
    const html = seite({ beitraege: LISTE })
    const kennungen = [...html.matchAll(/<article aria-labelledby="(beitrag-titel-[^"]+)"/g)].map((treffer) => treffer[1])
    expect(kennungen).toHaveLength(3)
    expect(new Set(kennungen).size).toBe(3)
    for (const kennung of kennungen) expect(html.match(new RegExp(`id="${kennung}"`, 'g'))).toHaveLength(1)
  })

  it('„Dazu im Hofladen": kaufbare zuerst, ausverkaufte gedimmt mit „derzeit aus", Fremdes und Gelöschtes fällt weg', () => {
    const html = seite({ beitraege: LISTE })
    const teil = html.slice(html.indexOf('Dazu im Hofladen'), html.indexOf('</article>', html.indexOf('Dazu im Hofladen')))
    expect(reihenfolge(teil, ['Blütenhonig', 'Karotten'])).toEqual(['Karotten', 'Blütenhonig'])
    expect(teil).toContain('aria-label="Karotten in den Korb"')
    expect(teil).not.toContain('aria-label="Blütenhonig in den Korb"')
    expect(teil).toContain('derzeit aus')
    expect(teil).toContain('href="/hof-test/produkt/p_karotten"')
  })

  it('nicht im Shop fällt weg — dieselbe Regel wie die Produktliste', () => {
    const farm: PublicFarm = { ...HOF, products: HOF.products.map((p) => (p.id === 'p_karotten' ? { ...p, isAvailable: false } : p)) }
    const html = seite({ beitraege: LISTE, farm })
    const teil = html.slice(html.indexOf('id="aktuell"'), html.indexOf('</section>', html.indexOf('id="aktuell"')))
    // Der Text der Beiträge nennt Karotten — gesucht wird der Link der Produktzeile.
    expect(teil).not.toContain('href="/hof-test/produkt/p_karotten"')
    expect(teil).toContain('href="/hof-test/produkt/p_honig"')
  })

  it('kein „+" in der Vorschau des Hofs und bei Pause — wie bei allen Kaufwegen', () => {
    const vorschau = seite({ beitraege: LISTE, ansicht: { art: 'vorschau', kaufen: false } })
    const pausiert = seite({ beitraege: LISTE, farm: { ...HOF, isPaused: true }, suche: 'beitrag=statusneu' })
    for (const html of [vorschau, pausiert]) {
      expect(html).toContain('Dazu im Hofladen')
      expect(html).not.toContain('aria-label="Karotten in den Korb"')
    }
    // Pausiert ist nichts „derzeit aus", was Vorrat hat.
    expect(pausiert.match(/derzeit aus/g)).toHaveLength(1)
  })

  it('?beitrag= eines älteren Beitrags: er steht oben, „Aktuell" nur am neuesten, darunter „Neuester: …"', () => {
    const html = seite({ beitraege: LISTE, suche: 'beitrag=statusmitte' })
    expect(reihenfolge(html, [NEU.title, MITTE.title])).toEqual([MITTE.title, NEU.title])
    expect(html).toContain('Neuester:</span> Frische Wels-Filets ab Freitag')
    expect(html).not.toContain('Dieser Beitrag ist nicht mehr aktuell.')
    // Die Karte trägt die normale Zeit (Abweichung 1: kein „Geteilt").
    expect(html).not.toMatch(/Aktuell ·|Geteilt/)
    // Der geteilte als Karte, der älteste als Zeile — der neueste steht als Link „Neuester: …“ darunter.
    expect(html.match(/<article aria-labelledby="beitrag-titel-/g)).toHaveLength(2)
  })

  it('bei Pause bleibt „Aktuell vom Hof": das Register (F8) nennt keine Ausnahme — „Register vor Board“ zu Board Bild 4', () => {
    const pausiert = seite({ beitraege: LISTE, farm: { ...HOF, isPaused: true } })
    expect(pausiert).toContain('id="aktuell"')
    expect(pausiert).toContain(NEU.title)
    // Gegenprobe: mit geteiltem Beitrag steht auch bei Pause dieser oben.
    const geteilt = seite({ beitraege: LISTE, farm: { ...HOF, isPaused: true }, suche: 'beitrag=statusmitte' })
    expect(reihenfolge(geteilt, [NEU.title, MITTE.title])).toEqual([MITTE.title, NEU.title])
  })

  it('?beitrag= abgelaufen, gelöscht, fremd oder unbekannt: die normale Übersicht mit dem Satz darüber', () => {
    const html = seite({ beitraege: LISTE, suche: 'beitrag=gibtesnicht' })
    expect(html).toContain('Dieser Beitrag ist nicht mehr aktuell.')
    expect(html.indexOf('Dieser Beitrag ist nicht mehr aktuell.')).toBeLessThan(html.indexOf('id="aktuell"'))
    expect(html).toContain('Aktuell · vor 2 Stunden')
    expect(html).not.toContain('Neuester:')
    // Auch ohne aktiven Beitrag steht der Satz — ohne Abschnitt.
    const leer = seite({ beitraege: [], suche: 'beitrag=gibtesnicht' })
    expect(leer).toContain('Dieser Beitrag ist nicht mehr aktuell.')
    expect(leer).not.toContain('id="aktuell"')
  })

  it('?beitrag= und das Laden der Beiträge scheiterte: kein Satz „nicht mehr aktuell“ (den Beitrag kann es geben), die Seite wie ohne Beiträge (Nr. 134)', () => {
    const html = seite({ beitraege: [], beitraegeFehler: true, suche: 'beitrag=statusmitte' })
    expect(html).not.toContain('Dieser Beitrag ist nicht mehr aktuell.')
    expect(html).not.toContain('id="aktuell"')
    // Produkte und Korb bleiben: Die Seite zeigt sich wie ohne Beiträge.
    expect(html).toContain('Karotten')
    // Gegenprobe: ohne den Merker derselbe Aufruf mit dem Satz.
    expect(seite({ beitraege: [], suche: 'beitrag=statusmitte' })).toContain('Dieser Beitrag ist nicht mehr aktuell.')
  })

  it('?beitrag= mit unzulässigen Zeichen wird verworfen — kein Satz, die normale Übersicht', () => {
    for (const wert of ['STATUSMITTE', 'status-mitte', 'a'.repeat(41)]) {
      const html = seite({ beitraege: LISTE, suche: `beitrag=${wert}` })
      expect(html, wert).not.toContain('Dieser Beitrag ist nicht mehr aktuell.')
      expect(html, wert).toContain('Aktuell · vor 2 Stunden')
    }
  })

  it('hat der Hof den Abschnitt Status ausgeblendet, gibt es keinen Abschnitt und keinen Beitrag', () => {
    const ohneStatus: PublicFarm = { ...HOF, sectionsConfig: [{ key: 'status', visible: false, order: 1 }] }
    const html = seite({ beitraege: LISTE, farm: ohneStatus })
    expect(html).not.toContain('id="aktuell"')
    expect(html).not.toContain(NEU.title)
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
    // Board w1-/s1-hofseite Bild 4: die Nachricht in Anführungszeichen und was noch geht.
    expect(html).toContain('„Wir sind im Urlaub.“ Du kannst dir das Angebot ansehen. Dein Warenkorb bleibt gespeichert.')
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
      'src/app/(public)/[farmSlug]/hofseite-skelett.tsx',
      'src/components/farm/cart-sheet.tsx',
      ...dateien('src/components/hofseite'),
    ]
    for (const pfad of route) {
      const text = quelle(pfad)
      expect(PALETTE.test(text), pfad).toBe(false)
      expect(SCHWARZ_WEISS.test(text), pfad).toBe(false)
      expect(HEX.test(text), pfad).toBe(false)
      // Das Skelett staffelt wie die übrigen über app-trough/app-chip (DESIGN_SYSTEM, Ladeansicht).
      if (!pfad.endsWith('skelett.tsx')) expect(BESTAND.test(text), pfad).toBe(false)
    }
  })

  it('das Skelett steht im neuen Design (es kommt vor der Shell)', () => {
    expect(quelle('src/app/(public)/[farmSlug]/hofseite-skelett.tsx')).toContain('data-design="neu"')
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

describe('JSON-LD: baut seit Nr. 117 die Seite auf dem Server', () => {
  // Der Schutz gegen `</script>` im Hofnamen (jsonLdSicher) prüft tests/hofseite-404.test.ts am Block der Seite.
  it('die Client-Komponente trägt keinen Block mehr — Koordinaten und volle Adressen bleiben auf dem Server', () => {
    const html = seite({ farm: HOF })
    expect(html).not.toContain('application/ld+json')
    // Gegenprobe: Der Hof steht da.
    expect(html).toContain('Hof Test')
  })

  it('die Seite nimmt dafür jsonLdSicher, nie JSON.stringify direkt im Script', () => {
    const text = quelle('src/app/(public)/[farmSlug]/page.tsx')
    expect(text).toContain('jsonLdSicher(hofJsonLd(')
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
    expect(html).toContain('Preise zzgl. 5 % Servicegebühr – einmal pro Bestellung')
    expect(html).not.toContain('mind. € 0,00')
  })
})

describe('„In den Korb“ der Produktkarte endet am Bestand (seit Nr. 235 ohne Mengenfeld)', () => {
  const karte = (stock: number, imKorb: number) => {
    const p = { ...HOF.products[4]!, stock }
    return renderToStaticMarkup(
      createElement(ProduktKarte, {
        produkt: p, zustand: kartenZustand(p, null), imKorb, wirdHinzugefuegt: false,
        href: '/hof-test/produkt/p_karotten', onInDenKorb: () => {},
      })
    )
  }
  const knopf = (html: string) => html.match(/<button[^>]*aria-label="Karotten in den Korb legen[^"]*"[^>]*>/)?.[0] ?? ''

  it('alles im Korb, was da ist: der Knopf ist gesperrt und sagt, wie viel im Korb liegt', () => {
    expect(knopf(karte(3, 3))).toContain('disabled=""')
    expect(knopf(karte(3, 3))).toContain('3 im Warenkorb')
  })

  it('Gegenprobe: unter dem Bestand geht er, auch mit Ware im Korb', () => {
    expect(knopf(karte(20, 3))).not.toContain('disabled=""')
    expect(knopf(karte(20, 0))).not.toContain('disabled=""')
  })

  it('kein Mengenfeld auf der Karte — die Menge ändert man im Warenkorb (Board s1-/w1-hofseite)', () => {
    expect(karte(20, 3)).not.toContain('<input')
    expect(karte(20, 3)).not.toContain('data-slot="stepper"')
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
  }, 30_000)
})

// ─── Nr. 51: Schaufenster zuerst (Register N5) ──────────────────────────────

describe('Schaufenster zuerst (Register N5, Nr. 51)', () => {
  const FOTOS = [1, 2, 3].map((i) => ({ id: `foto_${i}`, url: `/landing/row-${i}.jpg`, caption: null, sortOrder: i, ausschnitt: null }))

  it('der Quelltext hat die Reihenfolge, die man unter lg sieht: Fotos, Produkte, „Alle Produkte (n)" (bei Pause), rechte Spalte, Über uns', () => {
    const html = seite({ farm: { ...HOF, farmPhotos: FOTOS, isPaused: true } })
    const stellen = [
      html.indexOf('id="fotos"'),
      html.indexOf('id="produkte"'),
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

  it('„Alle Produkte (n)" wechselt in den Reiter Produkte — n ist die Zahl des Reiters; nur bei Pause (Nr. 271)', () => {
    const html = seite({ farm: { ...HOF, isPaused: true } })
    expect(html).toMatch(/<a[^>]*href="\/hof-test\?reiter=produkte"[^>]*>Alle Produkte \(5\)</)
    expect(html).toContain('>Produkte · 5<')
    // Offen kein zweiter Knopf mit demselben Ziel: „Alle ansehen“ über der Liste reicht (Abnahme Lauf 32, hofseite 5).
    expect(seite()).not.toContain('Alle Produkte (')
    expect(seite()).toContain('Alle ansehen')
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

  it('ohne Produkte kein Schaufenster: dieselbe Reihenfolge — Fotos, rechte Spalte, Über uns (Nr. 235)', () => {
    const html = seite({ farm: { ...HOF, products: [], farmPhotos: FOTOS } })
    expect(html).not.toContain('Alle Produkte (')
    expect(html).toContain('Gerade keine Produkte')
    expect(html.indexOf('id="fotos"')).toBeLessThan(html.indexOf('<aside'))
    expect(html.indexOf('<aside')).toBeLessThan(html.indexOf('id="ueber-uns"'))
  })

  it('im Reiter Produkte steht die Spalte nach den Produkten und nur ab lg (rechts, Board w1-hofseite Bild 3)', () => {
    const html = seite({ suche: 'reiter=produkte' })
    expect(html.indexOf('<aside')).toBeGreaterThan(html.indexOf('id="produkte"'))
    expect(html.match(/<aside[^>]*class="[^"]*"/)?.[0]).toMatch(/\bhidden\b.*\blg:flex\b/)
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
    // Seit Nr. 252: Name mit Gebinde, Preis fett, Grundpreis darunter (Board s1-/w1-hofseite).
    expect(html).toContain('Bergkäse, 0,5 kg')
    expect(html).toContain('€ 12,90')
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
    // Seit Nr. 252 hängt das Gebinde am Namen („…, 0,5 kg“) — der volle Name steht weiter im title.
    expect(html).toMatch(new RegExp(`<span[^>]*line-clamp-2[^>]*>${lang}, 0,5 kg</span>`))
  })

  it('Gegenprobe: die Kaufkarte hat weiter Link und Korb-Knopf', () => {
    const p = HOF.products[4]!
    const html = renderToStaticMarkup(
      createElement(ProduktKarte, {
        produkt: p, zustand: kartenZustand(p, null), imKorb: 0, wirdHinzugefuegt: false,
        href: '/hof-test/produkt/p_karotten', onInDenKorb: () => {},
      })
    )
    expect(html).toContain('href="/hof-test/produkt/p_karotten"')
    expect(html).toContain('aria-label="Karotten in den Korb legen"')
  })
})

describe('Hofseite eines Testhofs (Register N21, Nr. 119)', () => {
  it('oben der ruhige Hinweis aus der Hinweiskarte im neutralen Ton (nicht orange, nicht grün) — Bestellen bleibt möglich', () => {
    const html = seite({ farm: { ...HOF, istTesthof: true } })
    expect(html).toContain(TESTHOF_HINWEIS)
    const karte = html.slice(html.lastIndexOf('<div data-slot="hinweiskarte"', html.indexOf(TESTHOF_HINWEIS)), html.indexOf(TESTHOF_HINWEIS))
    expect(karte).toContain('data-ton="neutral"')
    // Vor dem Titelbild und dem Namen — „oben“.
    expect(html.indexOf(TESTHOF_HINWEIS)).toBeLessThan(html.indexOf('>Hof Test</h1>'))
    // Testbestellungen sind der Zweck: Korb und Bestellen bleiben.
    expect(html).toContain('aria-label="Karotten in den Korb legen"')
  })

  it('Gegenprobe: ohne Testhof kein Hinweis und keine neutrale Karte', () => {
    const html = seite()
    expect(html).not.toContain(TESTHOF_HINWEIS)
    expect(html).not.toContain('data-ton="neutral"')
  })
})

describe('Nr. 235, UI-Runde 2 — Abweichungen aus der Bewertung r1', () => {
  /** Das öffnende Tag eines Elements mit dieser Kennung. */
  const tagMit = (html: string, merkmal: string) => html.match(new RegExp(`<[a-z]+[^>]*${merkmal}[^>]*>`))?.[0] ?? ''

  it('Reiter Produkte: kleine Abschnitte stehen ab 768 px nebeneinander — je Produkt eine der drei Spalten', () => {
    const html = seite({ suche: 'reiter=produkte' })
    // Jeder Abschnitt des Testhofs hat ein Produkt: eine Spalte, darin eine Kachel so breit wie überall.
    for (const anker of ['kategorie-eier', 'kategorie-brennmaterial']) {
      expect(tagMit(html, `id="${anker}"`)).toContain('md:col-span-1')
    }
    expect(html).toMatch(/class="[^"]*md:grid md:grid-cols-3 md:gap-x-3[^"]*"/)
    expect(html).toContain('md:grid-cols-1')
  })

  it('Gegenprobe: ein Abschnitt mit drei Produkten nimmt die ganze Zeile', () => {
    const farm = publicFarm({
      products: [produkt('e1', 'Eier S', 'EIER'), produkt('e2', 'Eier M', 'EIER'), produkt('e3', 'Eier L', 'EIER'), produkt('h1', 'Honig', 'HONIG')],
    })
    const html = seite({ farm, suche: 'reiter=produkte' })
    expect(tagMit(html, 'id="kategorie-eier"')).toContain('md:col-span-3')
    expect(tagMit(html, 'id="kategorie-honig"')).toContain('md:col-span-1')
  })

  it('bei Pause kein „Alle ansehen" (Board Bild 4) — „Alle Produkte (n)" am Handy bleibt (Register N5)', () => {
    const pausiert = seite({ farm: { ...HOF, isPaused: true } })
    expect(pausiert).not.toContain('Alle ansehen')
    expect(pausiert).toContain('Alle Produkte (5)')
    // Gegenprobe: offen steht der Link da — unterstrichen, mit dem Pfeil als Symbol.
    const offen = seite()
    expect(offen).toMatch(/<a[^>]*class="[^"]*underline decoration-\[1\.5px\][^"]*"[^>]*>Alle ansehen<svg[^>]*lucide-arrow-right/)
  })

  it('das Hof-Zeichen ist rund (Freigabe Nr. 98, Register vor Board), kein abgerundetes Quadrat', () => {
    const zeichen = tagMit(seite(), 'size-14 shrink-0 items-center justify-center overflow-hidden')
    expect(zeichen).toContain('rounded-full')
    expect(zeichen).not.toContain('rounded-[14px]')
  })

  it('Abholzeiten ohne Komma nach dem Wochentag („Mittwoch 15–18 Uhr") — nur die Darstellung', () => {
    expect(ohneKommaNachTag('Mittwoch, 15–18 Uhr')).toBe('Mittwoch 15–18 Uhr')
    expect(ohneKommaNachTag('Samstag, 9–12 · 14–16 Uhr')).toBe('Samstag 9–12 · 14–16 Uhr')
    // Gegenprobe: ohne Uhrzeit nach dem Komma bleibt die Zeile, wie sie ist.
    expect(ohneKommaNachTag('Nach Vereinbarung, bitte anrufen')).toBe('Nach Vereinbarung, bitte anrufen')
  })

  it('Illustrationen im Dunkeln gedämpft wie ein Foto', () => {
    const farm = publicFarm({
      products: [
        publicProduct({ id: 'i1', name: 'Milch', category: 'MILCH', stock: 9, categoryImageUrl: '/categories/milch.webp' }),
        publicProduct({ id: 'f1', name: 'Käse', category: 'MILCH', stock: 9, imageUrl: '/foto/kaese.jpg' }),
      ],
    })
    const html = seite({ farm })
    // Die Hülle entscheidet (next/image ist hier ein schlichtes <img>): F041 — dieselbe Dämpfung wie ein Foto, gerahmt.
    expect(html).toMatch(/<span class="[^"]*border-border[^"]*dark:brightness-\[0\.85\][^"]*"><img src="\/categories\/milch\.webp"/)
    expect(html).toMatch(/<span class="[^"]*dark:brightness-\[0\.85\][^"]*"><img src="\/foto\/kaese\.jpg"/)
    expect(html).not.toContain('dark:brightness-[1.6]')
    expect(html).not.toContain('mix-blend')
  })
})
