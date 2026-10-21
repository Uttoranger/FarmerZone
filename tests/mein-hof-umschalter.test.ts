/**
 * Die Bausteine von „Mein Hof" aus Nachtlauf Nr. 49 (Register N3/N4),
 * serverseitig gerendert (TESTING_GUIDELINES §1) und am Quelltext geprüft:
 *
 *  - Reiterleiste: EIN Baustein, Produkte · Hofseite · Beiträge als Links mit
 *    aria-current; „Produkte" nur unter md (ab md hat Produkte seinen Punkt in
 *    der Seitenleiste; der Hinweis dazu steht seit Nr. 73 am Ende der Liste
 *    im Editor, Register N7).
 *  - Kundenansicht (seit Nr. 107 als Vollbild, Register N4 ergänzt): den
 *    Umschalter „Bearbeiten · So sieht’s die Kundin" gibt es nicht mehr; der
 *    Inhalt steht immer. Das iframe der echten Hofseite (passender Reiter,
 *    vorschauLink) kommt erst im Browser und nur unter der Grenze des
 *    Reiters — vom Server nie. Die Wahl steht in der Adresse und wird nur über
 *    ansichtAdresse geschrieben (Verlauf: tests/kundenansicht-vollbild.test.ts).
 *  - „Kundenansicht" im Kopf öffnet das Vollbild (Knopf, kein neuer Tab);
 *    ohne Kundenansicht darum herum bleibt es der Link.
 *  - „Gespeichert · Ansehen" nur auf Hofseite und Beiträge: nach Titelbild,
 *    Ausschnitt und Fotos der Hofseite mit Stiften und nach dem Veröffentlichen
 *    eines Beitrags; Produkte behält seinen Teilen-Moment (Nr. 30). Je
 *    Abschnitt EIN Hinweis: Ein neues Speichern ersetzt den offenen.
 *  - Texte aus einer Quelle; „(öffnet in neuem Tab)" nur an Links, deren Text
 *    es nicht schon sagt.
 *
 * Jede Suche hat ihre Gegenprobe; Verhalten im Browser (Umschalten, Sprung,
 * Markierung) prüfen die Bilder und die Abnahme im Bericht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const adresse = { suche: '' }
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(adresse.suche),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/farm-page',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
  // Die Reiter tragen seit Nr. 127 den Ladepunkt (useLinkStatus) — hier lädt nie etwas.
  useLinkStatus: () => ({ pending: false }),
}))
// Nur die Aufrufe zählen: welcher Toast mit welcher Kennung.
const toast = vi.hoisted(() => ({ custom: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { MeinHofReiterLeiste } from '@/components/mein-hof/reiter-leiste'
import { MeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { KundenansichtKnopf } from '@/components/mein-hof/kundenansicht-knopf'
import { GespeichertAnsehenKarte, meldeGespeichertAnsehen } from '@/components/mein-hof/gespeichert-ansehen'
import { MEIN_HOF_HINWEIS } from '@/lib/bauern-navigation'
import { MEIN_HOF_ANSICHT_TEXT, gespeichertHinweisId } from '@/lib/mein-hof-ansicht'
import { useSchmalerAls } from '@/lib/use-mindestbreite'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const INHALT = createElement('p', null, 'Inhalt zum Bearbeiten')

type AnsichtProps = ComponentProps<typeof MeinHofAnsicht>

/** MeinHofAnsicht mit dem Inhalt „Bearbeiten" — die Kinder stehen in den Props, wie JSX sie übergibt. */
function mitInhalt(props: Omit<AnsichtProps, 'children'>): ReturnType<typeof createElement> {
  const mitKind: AnsichtProps = { ...props, children: INHALT }
  return createElement(MeinHofAnsicht, mitKind)
}

function ansicht(reiter: 'produkte' | 'hofseite' | 'beitraege', suche = '', kopf: ReactNode = null): string {
  adresse.suche = suche
  return renderToStaticMarkup(mitInhalt({ reiter, slug: 'hof-test', kopf }))
}

describe('Reiterleiste', () => {
  const leiste = (aktiv: 'produkte' | 'hofseite' | 'beitraege', nurUnterMd = false) =>
    renderToStaticMarkup(createElement(MeinHofReiterLeiste, { aktiv, beitraegeZahl: 3, nurUnterMd }))

  it('Produkte · Hofseite · Beiträge · N als Links, in dieser Reihenfolge, der aktive mit aria-current', () => {
    const html = leiste('produkte')
    expect([...html.matchAll(/<a href="([^"]+)"/g)].map((t) => t[1])).toEqual(['/products', '/farm-page', '/farm-page?reiter=beitraege'])
    expect(html).toMatch(/<a href="\/products"[^>]*aria-current="page"/)
    expect(html).not.toMatch(/<a href="\/farm-page"[^>]*aria-current/)
    expect(html).toContain('Beiträge · 3')
    expect(leiste('beitraege')).toMatch(/<a href="\/farm-page\?reiter=beitraege"[^>]*aria-current="page"/)
  })

  it('der Hinweis steht nicht mehr in der Leiste — weder im Kopf von Mein Hof noch auf /products (er steht seit Nr. 73 am Ende der Liste im Editor)', () => {
    expect(leiste('hofseite')).not.toContain(MEIN_HOF_HINWEIS)
    expect(leiste('produkte', true)).not.toContain(MEIN_HOF_HINWEIS)
  })

  it('am Quelltext: ein Reiter mit nurUnterMd ist ab md ausgeblendet, die Leiste trägt den Hinweis nicht mehr', () => {
    const text = quelle('src/components/mein-hof/reiter-leiste.tsx')
    expect(text).toContain("reiter.nurUnterMd && 'md:hidden'")
    expect(text).toContain("nurUnterMd && 'md:hidden'")
    expect(text).not.toContain('MEIN_HOF_HINWEIS')
  })
})

describe('Kundenansicht als Vollbild — kein Umschalter mehr (Nr. 107)', () => {
  it('ohne Parameter: der Inhalt, kein Umschalter, kein Rahmen', () => {
    const html = ansicht('hofseite')
    expect(html).toContain('Inhalt zum Bearbeiten')
    expect(html).not.toContain('role="toolbar"')
    expect(html).not.toContain('So sieht’s die Kundin')
    expect(html).not.toContain('<iframe')
  })

  it('?ansicht=kundin vom Server: der Inhalt bleibt, das Vollbild samt Hofseite kommt erst im Browser', () => {
    for (const reiter of ['produkte', 'hofseite', 'beitraege'] as const) {
      const html = ansicht(reiter, 'ansicht=kundin')
      expect(html, reiter).toContain('Inhalt zum Bearbeiten')
      expect(html, reiter).not.toContain('<iframe')
      expect(html, reiter).not.toContain('role="dialog"')
    }
  })

  it('am Quelltext: das Vollbild gilt nur unter der Grenze des Reiters — live über matchMedia, vom Server „nein"', () => {
    const text = quelle('src/components/mein-hof/mein-hof-ansicht.tsx')
    expect(text).toContain('const schmal = useSchmalerAls(UMSCHALTER_AB_PX[umschalterBis(reiter)])')
    expect(text).toContain('useKundenansicht(schmal)')
    expect(text).toContain('adresse={kundenAnsichtAdresse(slug, reiter)}')
    const hook = quelle('src/lib/use-mindestbreite.ts')
    expect(hook).toMatch(
      /export function useSchmalerAls[\s\S]*?!window\.matchMedia\(`\(min-width: \$\{px\}px\)`\)\.matches[\s\S]*?useSyncExternalStore\(anmelden, lesen, \(\) => false\)/
    )
    expect(hook).toContain("abfrage.addEventListener('change', melde)")
  })

  it('Server und Hydrieren sagen „nicht schmal" — so bleibt das HTML beim Hydrieren gleich und ohne iframe', () => {
    function Zeige(): React.JSX.Element {
      return createElement('span', null, String(useSchmalerAls(1024)))
    }
    expect(renderToStaticMarkup(createElement(Zeige))).toBe('<span>false</span>')
  })

  it('am Quelltext: EIN Rahmen der echten Hofseite, die Adresse nur über ansichtAdresse, mit null als Zustand', () => {
    const vollbild = quelle('src/components/mein-hof/kundenansicht-vollbild.tsx')
    expect(vollbild.match(/<iframe/g)).toHaveLength(1)
    expect(vollbild).toMatch(/<iframe ref=\{rahmen\} src=\{adresse\}/)
    expect(vollbild).toContain("window.history.pushState(null, '', ansichtAdresse(pathname, search, 'kundin') + hash)")
    expect(vollbild).toContain("window.history.replaceState(null, '', ansichtAdresse(pathname, search, 'bearbeiten') + hash)")
    expect(vollbild.match(/pushState\(/g)).toHaveLength(1)
    expect(vollbild.match(/replaceState\(/g)).toHaveLength(1)
    expect(vollbild).toContain('meinHofAnsichtAus(useSearchParams().get(MEIN_HOF_ANSICHT_PARAMETER))')
    // Gegenprobe: Mein Hof selbst schreibt die Adresse nicht mehr.
    expect(quelle('src/components/mein-hof/mein-hof-ansicht.tsx')).not.toMatch(/history\./)
  })

  it('der Kopf steht über dem Inhalt', () => {
    const html = ansicht('hofseite', '', createElement('header', null, 'Kopf von Mein Hof'))
    expect(html.indexOf('Kopf von Mein Hof')).toBeLessThan(html.indexOf('Inhalt zum Bearbeiten'))
  })
})

describe('„Kundenansicht" im Kopf', () => {
  const knopf = () => createElement(KundenansichtKnopf, { slug: 'hof-test', className: 'knopf' })

  it('in Mein Hof: ein Knopf, der das Vollbild öffnet — kein neuer Tab', () => {
    adresse.suche = ''
    const html = renderToStaticMarkup(mitInhalt({ reiter: 'hofseite', slug: 'hof-test', kopf: knopf() }))
    expect(html).toMatch(/<button type="button" class="knopf">[\s\S]*?Kundenansicht<\/button>/)
    expect(html).not.toContain('target="_blank"')
  })

  it('Gegenprobe ohne Kundenansicht darum herum: der Link in einen neuen Tab', () => {
    const html = renderToStaticMarkup(knopf())
    expect(html).toContain('<a href="/hof-test?vorschau=1" target="_blank"')
    expect(html).toContain('Kundenansicht')
  })

  it('der Kopf nimmt den Knopf unter lg; ab lg bleibt der Link in den neuen Tab', () => {
    const kopf = quelle('src/components/mein-hof/seitenkopf.tsx')
    expect(kopf).toContain('<KundenansichtKnopf slug={hof.slug}')
    expect(kopf).toMatch(/breit \? \(\s*<a href=\{vorschauLink\(hof\.slug\)\} target="_blank"/)
  })

  it('auf /products steht derselbe Knopf unter den Reitern — nur unter md, als Knopf mit dem Vollbild (Nr. 118)', () => {
    /** Der `kopf` der Seite: das, was MeinHofAnsicht über dem Inhalt zeigt. */
    const kopfDerSeite = (seite: string): string => /kopf=\{([\s\S]*?)\n      \}\n    >/.exec(seite)?.[1] ?? ''
    /** Steht der Knopf im Kopf, in demselben Kasten wie die Reiter, der ab md verschwindet? */
    const knopfNurUnterMd = (kopf: string): boolean =>
      /<div className="[^"]*\bmd:hidden\b[^"]*">[\s\S]*<MeinHofReiterLeiste[\s\S]*<KundenansichtKnopf slug=\{farm\.slug\}/.test(kopf)

    const seite = quelle('src/app/(hof)/products/page.tsx')
    expect(kopfDerSeite(seite)).toContain('<MeinHofReiterLeiste aktiv="produkte"')
    expect(knopfNurUnterMd(kopfDerSeite(seite))).toBe(true)
    // Gegenprobe: ohne den Knopf bzw. außerhalb des md:hidden-Kastens schlägt die Suche an.
    expect(knopfNurUnterMd(kopfDerSeite(seite.replace(/\s*<KundenansichtKnopf[^>]*\/>/, '')))).toBe(false)
    expect(knopfNurUnterMd(kopfDerSeite(seite.replace('px-4 pt-5 md:hidden', 'px-4 pt-5')))).toBe(false)
    // Der Knopf kommt aus dem Baustein von Mein Hof, nicht aus einem eigenen Link in einen neuen Tab.
    expect(seite).toContain("from '@/components/mein-hof/kundenansicht-knopf'")
    expect(seite).not.toContain('vorschauLink')
  })

  it('auf /products öffnet der Knopf das Vollbild: unter MeinHofAnsicht mit Reiter produkte ein Knopf, kein Link', () => {
    adresse.suche = ''
    const html = renderToStaticMarkup(mitInhalt({ reiter: 'produkte', slug: 'hof-test', kopf: knopf() }))
    expect(html).toMatch(/<button type="button" class="knopf">[\s\S]*?Kundenansicht<\/button>/)
    expect(html).not.toContain('target="_blank"')
  })

  it('„Kundenansicht" und „(öffnet in neuem Tab)" kommen aus der einen Quelle', () => {
    const kopf = quelle('src/components/mein-hof/seitenkopf.tsx')
    expect(kopf).toMatch(/target="_blank" rel="noopener noreferrer" className=\{KNOPF\}>\s*\{MEIN_HOF_ANSICHT_TEXT\.kundenansicht\}/)
    expect(kopf.match(/<span className="sr-only">\{MEIN_HOF_ANSICHT_TEXT\.neuerTabHinweis\}<\/span>/g)).toHaveLength(2)
    const knopfText = quelle('src/components/mein-hof/kundenansicht-knopf.tsx')
    expect(knopfText).toContain('<span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis}</span>')
    for (const pfad of [
      'src/components/mein-hof/seitenkopf.tsx',
      'src/components/mein-hof/kundenansicht-knopf.tsx',
      'src/components/mein-hof/mein-hof-ansicht.tsx',
      'src/components/mein-hof/kundenansicht-vollbild.tsx',
    ]) {
      const text = quelle(pfad)
      expect(text, pfad).not.toContain('(öffnet in neuem Tab)')
      expect(text, pfad).not.toMatch(/>\s*Kundenansicht\s*</)
    }
    // Gegenprobe: die Suchen finden die feste Fassung.
    expect('<span className="sr-only"> (öffnet in neuem Tab)</span>').toContain('(öffnet in neuem Tab)')
    expect('className={KNOPF}>\n          Kundenansicht\n          <ArrowUpRight').toMatch(/>\s*Kundenansicht\s*</)
    // Und gerendert: der Link ohne Umschalter trägt den Hinweis aus der Quelle.
    expect(renderToStaticMarkup(knopf())).toContain(`<span class="sr-only">${MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis}</span>`)
  })
})

describe('„Gespeichert · Ansehen"', () => {
  it('„Gespeichert", leise ein Punkt, und der Knopf „Ansehen"', () => {
    const html = renderToStaticMarkup(createElement(GespeichertAnsehenKarte, { onAnsehen: () => {} }))
    expect(html).toContain('Gespeichert')
    expect(html).toMatch(/<span aria-hidden="true"[^>]*> ·<\/span>/)
    expect(html).toMatch(/<button type="button"[^>]*>Ansehen<\/button>/)
    expect(html).toContain('focus-visible:outline-solid')
    for (const svg of html.match(/<svg[^>]*>/g) ?? []) expect(svg).toContain('aria-hidden="true"')
  })

  it('mit Beschreibung (Beitrag) steht der Satz darunter, sonst nichts', () => {
    const mit = renderToStaticMarkup(createElement(GespeichertAnsehenKarte, { beschreibung: 'Beitrag veröffentlicht — auf der Hof-Seite', onAnsehen: () => {} }))
    expect(mit).toContain('Beitrag veröffentlicht — auf der Hof-Seite')
    const ohne = renderToStaticMarkup(createElement(GespeichertAnsehenKarte, { onAnsehen: () => {} }))
    expect(ohne.match(/<p[ >]/g)).toHaveLength(1)
  })

  it('Fotos: auch eine Serie, in der jedes Foto geklappt hat, meldet „Gespeichert · Ansehen" (Nr. 50 Runde 1)', () => {
    // Die Galerie reicht meldeErfolg als Abschluss der Serie weiter — der Abschnitt „fotos" kommt von der Liste.
    expect(quelle('src/components/mein-hof/bild-bausteine.tsx')).toMatch(/serieGespeichert: meldeErfolg,/)
    // Der Upload ruft ihn nur, wenn nichts übersprungen wurde; sonst bleibt die Sammelmeldung mit dem Grund.
    const upload = quelle('src/components/shared/image-upload.tsx')
    expect(upload).toMatch(/else if \(skipped\.length > 0\) toast\.warning\(text\)\s*else if \(serieGespeichert\) serieGespeichert\(\)\s*else toast\.success\(text\)/)
    // Gegenprobe: ohne meldeErfolg (ab lg) bleibt die Sammelmeldung — die Option ist freiwillig.
    expect(upload).toMatch(/serieGespeichert\?: \(\) => void/)
  })

  it('Hofseite (seit Nr. 50 die Liste „Bearbeiten"): jedes Blatt meldet „Gespeichert · Ansehen" mit seinem Abschnitt, statt selbst zu toasten', () => {
    const liste = quelle('src/components/mein-hof/abschnitte-liste.tsx')
    // Je Abschnitt EIN Hinweis (Nr. 49 Runde 1): die Liste gibt den Abschnitt mit.
    expect(liste).toContain('meldeErfolg={ansicht ? () => meldeGespeichertAnsehen({ abschnitt: zeile.id, onAnsehen: () => ansehen(zeile.id) }) : undefined}')
    // „Ansehen" schließt erst das Blatt und schaltet danach um — unter dem Blatt sähe niemand die Kundenansicht.
    expect(liste).toMatch(/nachDemSchliessen\.current = \(\) => ansicht\.zeigeKundin\(id\)\s*setzeOffen\(null\)/)
    expect(liste).toMatch(/onOpenChangeComplete=\{\(auf\) => \{[\s\S]*?danach\?\.\(\)/)
    // Jeder Baustein nimmt meldeErfolg statt seines Toasts: Bilder, Abholzeiten, Pause und die Formulare.
    const inhalt = quelle('src/components/mein-hof/abschnitt-inhalt.tsx')
    for (const baustein of ['TitelbildBaustein', 'LogoUpload', 'GallerySection', 'PickupSlotsClient', 'PauseClient']) {
      expect(inhalt, baustein).toMatch(new RegExp(`<${baustein}[^>]*meldeErfolg=\\{meldeErfolg\\}`))
    }
    expect(inhalt).toContain('const formular = { onGespeichert, onAbbrechen, meldeErfolg }')
    expect(quelle('src/components/mein-hof/abschnitt-formulare.tsx')).toMatch(/if \(meldeErfolg\) meldeErfolg\(\)\s*else toast\.success\(GESPEICHERT_TEXT\)/)
    // Die Bestandsansicht mit Stiften ist seit Nr. 50 Runde 1 entfernt — FarmPageView meldet nichts mehr.
    expect(quelle('src/components/farm/farm-page-view.tsx')).not.toMatch(/onGespeichert\('titelbild'\)/)
  })

  it('Beiträge: nach dem Veröffentlichen auf der Hofseite öffnet sich das Teilen-Fenster (T5) statt „Gespeichert · Ansehen"', () => {
    const neu = quelle('src/app/(hof)/status/new/status-new-client.tsx')
    expect(neu).toMatch(/if \(showOnFarmPage && res\.postId\) \{\s*const fenster = await ladeBeitragFenster\(res\.postId\)/)
    expect(neu).toContain('<TeilenFenster')
    expect(neu).not.toContain('meldeGespeichertAnsehen')
  })

  it('Produkte behält den Teilen-Moment aus Nr. 30 — kein „Gespeichert · Ansehen"', () => {
    const produkte = quelle('src/components/produkte/produkte-ansicht.tsx') + quelle('src/app/(hof)/products/page.tsx')
    expect(produkte).not.toContain('meldeGespeichertAnsehen')
    expect(produkte).not.toContain('gespeichert(')
    expect(quelle('src/components/produkte/produkte-ansicht.tsx')).toContain("art: 'gespeichert'")
    // Gegenprobe: die Suche findet den Aufruf dort, wo er steht.
    expect(quelle('src/components/mein-hof/mein-hof-ansicht.tsx')).toContain('meldeGespeichertAnsehen')
  })

  it('ab lg bleibt der bisherige Toast — dort gibt es keinen Umschalter', () => {
    const text = quelle('src/components/mein-hof/gespeichert-ansehen.tsx')
    expect(text).toMatch(/matchMedia\(`\(min-width: \$\{UMSCHALTER_AB_PX\.lg\}px\)`\)\.matches\) \{\s*toast\.success\(beschreibung \?\? MEIN_HOF_ANSICHT_TEXT\.gespeichert, \{ id \}\)/)
  })
})

describe('„Gespeichert · Ansehen" je Abschnitt EINMAL — ein neues Speichern ersetzt den offenen Hinweis', () => {
  const bildschirm = { breit: false }
  beforeEach(() => {
    bildschirm.breit = false
    vi.stubGlobal('window', { matchMedia: () => ({ matches: bildschirm.breit }) })
    toast.custom.mockClear()
    toast.success.mockClear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const kennungen = () => toast.custom.mock.calls.map((aufruf) => aufruf[1])

  it('dreimal Fotos umsortiert: dieselbe Kennung, also ein Hinweis, der jedes Mal neu anfängt', () => {
    for (let i = 0; i < 3; i++) meldeGespeichertAnsehen({ abschnitt: 'fotos', onAnsehen: () => {} })
    expect(kennungen()).toEqual(Array(3).fill({ id: gespeichertHinweisId('fotos'), duration: 8000 }))
  })

  it('ein anderer Abschnitt hat seinen eigenen Hinweis — „Ansehen" springt dorthin, wo gespeichert wurde', () => {
    meldeGespeichertAnsehen({ abschnitt: 'fotos', onAnsehen: () => {} })
    meldeGespeichertAnsehen({ abschnitt: 'titelbild', onAnsehen: () => {} })
    meldeGespeichertAnsehen({ abschnitt: 'beitraege', beschreibung: 'Beitrag veröffentlicht', onAnsehen: () => {} })
    const ids = kennungen().map((o) => (o as { id: string }).id)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual([gespeichertHinweisId('fotos'), gespeichertHinweisId('titelbild'), gespeichertHinweisId('beitraege')])
  })

  it('ohne Abschnitt: eine feste Kennung für alle — auch dann stapelt sich nichts', () => {
    meldeGespeichertAnsehen({ onAnsehen: () => {} })
    meldeGespeichertAnsehen({ onAnsehen: () => {} })
    expect(kennungen()).toEqual(Array(2).fill({ id: gespeichertHinweisId(null), duration: 8000 }))
    expect(gespeichertHinweisId(null)).not.toBe(gespeichertHinweisId('fotos'))
  })

  it('ab lg der bisherige Toast mit derselben Kennung', () => {
    bildschirm.breit = true
    meldeGespeichertAnsehen({ abschnitt: 'fotos', onAnsehen: () => {} })
    meldeGespeichertAnsehen({ abschnitt: 'fotos', onAnsehen: () => {} })
    expect(toast.custom).not.toHaveBeenCalled()
    expect(toast.success.mock.calls).toEqual(Array(2).fill(['Gespeichert', { id: gespeichertHinweisId('fotos') }]))
  })

  it('„Ansehen" schließt genau diesen Hinweis und schaltet um', () => {
    const angesehen = vi.fn()
    meldeGespeichertAnsehen({ abschnitt: 'fotos', onAnsehen: angesehen })
    const [zeichne] = toast.custom.mock.calls[0] as [(id: string) => { props: { onAnsehen: () => void } }]
    zeichne(gespeichertHinweisId('fotos')).props.onAnsehen()
    expect(toast.dismiss).toHaveBeenCalledWith(gespeichertHinweisId('fotos'))
    expect(angesehen).toHaveBeenCalledOnce()
  })

  it('am Quelltext: der Umschalter gibt den Abschnitt mit; der Beitrag meldet sich über das Teilen-Fenster (T5)', () => {
    expect(quelle('src/components/mein-hof/mein-hof-ansicht.tsx')).toContain('meldeGespeichertAnsehen({ abschnitt, onAnsehen: () => zeigeKundin(abschnitt) })')
    expect(quelle('src/app/(hof)/status/new/status-new-client.tsx')).not.toContain("abschnitt: 'beitraege'")
  })
})
