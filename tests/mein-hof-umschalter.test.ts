/**
 * Die Bausteine von „Mein Hof" aus Nachtlauf Nr. 49 (Register N3/N4),
 * serverseitig gerendert (TESTING_GUIDELINES §1) und am Quelltext geprüft:
 *
 *  - Reiterleiste: EIN Baustein, Produkte · Hofseite · Beiträge als Links mit
 *    aria-current; „Produkte" nur unter md, an seiner Stelle ab md der Hinweis.
 *  - Umschalter „Bearbeiten · So sieht’s die Kundin": Bearbeiten zeigt den
 *    Inhalt, die Kundenansicht das iframe der echten Hofseite (passender
 *    Reiter, vorschauLink) mit dem leisen Link „In neuem Tab öffnen"; die Wahl
 *    steht in der Adresse und wird nur über ansichtAdresse geschrieben. Das
 *    iframe kommt erst im Browser und nur, wo der Umschalter zu sehen ist —
 *    vom Server kommt an seiner Stelle eine leere Fläche.
 *  - „Kundenansicht" im Kopf schaltet im Umschalter um (Knopf, kein neuer
 *    Tab); ohne Umschalter bleibt es der Link.
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
}))
// Nur die Aufrufe zählen: welcher Toast mit welcher Kennung.
const toast = vi.hoisted(() => ({ custom: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { MeinHofReiterLeiste } from '@/components/mein-hof/reiter-leiste'
import { KundenRahmen, MeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { KundenansichtKnopf } from '@/components/mein-hof/kundenansicht-knopf'
import { GespeichertAnsehenKarte, meldeGespeichertAnsehen } from '@/components/mein-hof/gespeichert-ansehen'
import { MEIN_HOF_HINWEIS } from '@/lib/bauern-navigation'
import { MEIN_HOF_ANSICHT_TEXT, gespeichertHinweisId, kundenAnsichtAdresse } from '@/lib/mein-hof-ansicht'
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

  it('der Hinweis steht im Kopf von Mein Hof, auf /products (nur unter md) nicht', () => {
    expect(leiste('hofseite')).toContain(MEIN_HOF_HINWEIS)
    expect(leiste('produkte', true)).not.toContain(MEIN_HOF_HINWEIS)
  })

  it('am Quelltext: ein Reiter mit nurUnterMd ist ab md ausgeblendet, der Hinweis erst ab md sichtbar', () => {
    const text = quelle('src/components/mein-hof/reiter-leiste.tsx')
    expect(text).toContain("reiter.nurUnterMd && 'md:hidden'")
    expect(text).toContain("nurUnterMd && 'md:hidden'")
    expect(text).toMatch(/<p className="[^"]*hidden[^"]*md:block[^"]*">\{MEIN_HOF_HINWEIS\}/)
  })
})

describe('Umschalter „Bearbeiten · So sieht’s die Kundin"', () => {
  it('Bearbeiten (ohne Parameter): Umschalter und Inhalt, kein Rahmen', () => {
    const html = ansicht('hofseite')
    expect(html).toContain('role="toolbar"')
    expect(html).toContain('aria-label="Ansicht von Mein Hof"')
    expect(html).toContain('>Bearbeiten<')
    expect(html).toContain('>So sieht’s die Kundin<')
    expect(html).toContain('Inhalt zum Bearbeiten')
    expect(html).not.toContain('<iframe')
  })

  it('So sieht’s die Kundin (?ansicht=kundin): der leise Link in einen neuen Tab und die Fläche des Rahmens', () => {
    const html = ansicht('hofseite', 'ansicht=kundin')
    const ziel = kundenAnsichtAdresse('hof-test', 'hofseite')
    expect(html).toMatch(new RegExp(`<a href="${ziel.replace(/[?]/g, '\\?')}" target="_blank" rel="noopener noreferrer"[^>]*>In neuem Tab öffnen`))
    expect(html).toContain('<h1 class="sr-only">So sieht’s die Kundin</h1>')
    // Vom Server noch ohne Hofseite: Ob man den Rahmen sieht, weiß erst der Browser (Nachbesserung 8).
    expect(html).not.toContain('<iframe')
    expect(html).toContain('data-rahmen-platz=""')
    // Der Inhalt bleibt eingehängt — ab der Grenze steht er dort, wo es keinen Umschalter gibt.
    expect(html).toContain('Inhalt zum Bearbeiten')
  })

  it('der Link sagt „In neuem Tab öffnen" selbst — kein zweiter Hinweis für Screenreader', () => {
    const html = ansicht('hofseite', 'ansicht=kundin')
    const link = html.match(/<a [^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? ''
    expect(link).toContain(MEIN_HOF_ANSICHT_TEXT.neuerTab)
    expect(link).not.toContain('sr-only')
    expect(link).not.toContain(MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis)
  })

  it('Produkte zeigt den Reiter Produkte der Hofseite, Beiträge den Reiter Beiträge', () => {
    expect(ansicht('produkte', 'ansicht=kundin')).toContain('<a href="/hof-test?vorschau=1&amp;reiter=produkte" target="_blank"')
    expect(ansicht('beitraege', 'ansicht=kundin')).toContain('<a href="/hof-test?vorschau=1&amp;reiter=beitraege" target="_blank"')
  })

  it('der Rahmen: im Browser, wo man ihn sieht, das iframe der echten Hofseite; sonst dieselbe Fläche ohne Inhalt', () => {
    const ziel = kundenAnsichtAdresse('hof-test', 'produkte')
    const rahmen = (laden: boolean) => renderToStaticMarkup(createElement(KundenRahmen, { adresse: ziel, markiert: null, laden, className: 'lg:hidden' }))
    expect(rahmen(true)).toContain(`<iframe src="${ziel.replace('&', '&amp;')}" title="So sehen Kunden deine Hofseite"`)
    expect(rahmen(true)).not.toContain('data-rahmen-platz')
    expect(rahmen(false)).not.toContain('<iframe')
    expect(rahmen(false)).toMatch(/<div aria-hidden="true" data-rahmen-platz=""/)
  })

  it('am Quelltext: der Rahmen lädt nur, wo der Umschalter zu sehen ist — live über matchMedia', () => {
    const text = quelle('src/components/mein-hof/mein-hof-ansicht.tsx')
    expect(text).toContain('const sichtbar = useSchmalerAls(UMSCHALTER_AB_PX[bis])')
    expect(text).toContain('laden={sichtbar}')
    expect(text).toMatch(/\{laden \? \(\s*<iframe/)
    // Gegenprobe: die Suche findet das iframe dort, wo es steht.
    expect(text.match(/<iframe/g)).toHaveLength(1)
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

  it('Unsinn in der Adresse ist Bearbeiten', () => {
    expect(ansicht('hofseite', 'ansicht=vorschau')).not.toContain('<iframe')
  })

  it('der Kopf steht über dem Umschalter, der Inhalt darunter', () => {
    const html = ansicht('hofseite', '', createElement('header', null, 'Kopf von Mein Hof'))
    expect(html.indexOf('Kopf von Mein Hof')).toBeLessThan(html.indexOf('role="toolbar"'))
    expect(html.indexOf('role="toolbar"')).toBeLessThan(html.indexOf('Inhalt zum Bearbeiten'))
  })

  it('jedes Symbol ist aria-hidden', () => {
    for (const svg of ansicht('beitraege', 'ansicht=kundin').match(/<svg[^>]*>/g) ?? []) expect(svg).toContain('aria-hidden="true"')
  })

  it('am Quelltext: die Wahl geht nur über ansichtAdresse in die Adresse, mit null als Zustand; der Umschalter klebt oben', () => {
    const text = quelle('src/components/mein-hof/mein-hof-ansicht.tsx')
    expect(text).toContain("window.history.replaceState(null, '', ansichtAdresse(pathname, search, neu) + hash)")
    expect(text.match(/replaceState\(/g)).toHaveLength(1)
    expect(text).toContain('meinHofAnsichtAus(useSearchParams().get(MEIN_HOF_ANSICHT_PARAMETER))')
    expect(text).toMatch(/data-umschalter=""[\s\S]{0,120}sticky top-0/)
  })
})

describe('„Kundenansicht" im Kopf', () => {
  const knopf = () => createElement(KundenansichtKnopf, { slug: 'hof-test', className: 'knopf' })

  it('im Umschalter: ein Knopf, der umschaltet — kein neuer Tab', () => {
    adresse.suche = ''
    const html = renderToStaticMarkup(mitInhalt({ reiter: 'hofseite', slug: 'hof-test', kopf: knopf() }))
    expect(html).toMatch(/<button type="button" class="knopf">[\s\S]*?Kundenansicht<\/button>/)
    expect(html).not.toContain('target="_blank"')
  })

  it('Gegenprobe ohne Umschalter: der Link in einen neuen Tab', () => {
    const html = renderToStaticMarkup(knopf())
    expect(html).toContain('<a href="/hof-test?vorschau=1" target="_blank"')
    expect(html).toContain('Kundenansicht')
  })

  it('der Kopf nimmt den Knopf unter lg; ab lg bleibt der Link in den neuen Tab', () => {
    const kopf = quelle('src/components/mein-hof/seitenkopf.tsx')
    expect(kopf).toContain('<KundenansichtKnopf slug={hof.slug}')
    expect(kopf).toMatch(/breit \? \(\s*<a href=\{vorschauLink\(hof\.slug\)\} target="_blank"/)
  })

  it('„Kundenansicht" und „(öffnet in neuem Tab)" kommen aus der einen Quelle', () => {
    const kopf = quelle('src/components/mein-hof/seitenkopf.tsx')
    expect(kopf).toMatch(/target="_blank" rel="noopener noreferrer" className=\{KNOPF\}>\s*\{MEIN_HOF_ANSICHT_TEXT\.kundenansicht\}/)
    expect(kopf.match(/<span className="sr-only">\{MEIN_HOF_ANSICHT_TEXT\.neuerTabHinweis\}<\/span>/g)).toHaveLength(2)
    const knopfText = quelle('src/components/mein-hof/kundenansicht-knopf.tsx')
    expect(knopfText).toContain('<span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis}</span>')
    for (const pfad of ['src/components/mein-hof/seitenkopf.tsx', 'src/components/mein-hof/kundenansicht-knopf.tsx', 'src/components/mein-hof/mein-hof-ansicht.tsx']) {
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
    // Die Bestandsansicht mit Stiften meldet weiter über onGespeichert (ohne Aufrufer seit Nr. 50).
    const ansichtHof = quelle('src/components/farm/farm-page-view.tsx')
    expect(ansichtHof).toContain("meldeErfolg={onGespeichert ? () => onGespeichert('titelbild') : undefined}")
  })

  it('Beiträge: nach dem Veröffentlichen auf der Hofseite — „Ansehen" führt in den Reiter mit der Kundenansicht', () => {
    const neu = quelle('src/app/(hof)/status/new/status-new-client.tsx')
    expect(neu).toMatch(/if \(showOnFarmPage\) \{[\s\S]*?meldeGespeichertAnsehen\(\{\s*abschnitt: 'beitraege',\s*beschreibung: meldung,\s*onAnsehen: \(\) => router\.push\(kundinAdresse\('beitraege'\)\),?\s*\}\)/)
    expect(neu).toMatch(/\} else \{\s*toast\.success\(meldung\)/)
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

  it('am Quelltext: der Umschalter gibt den Abschnitt mit, der Beitrag seinen eigenen', () => {
    expect(quelle('src/components/mein-hof/mein-hof-ansicht.tsx')).toContain('meldeGespeichertAnsehen({ abschnitt, onAnsehen: () => zeigeKundin(abschnitt) })')
    expect(quelle('src/app/(hof)/status/new/status-new-client.tsx')).toContain("abschnitt: 'beitraege'")
  })
})
