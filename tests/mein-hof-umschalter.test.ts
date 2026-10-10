/**
 * Die Bausteine von „Mein Hof" aus Nachtlauf Nr. 49 (Register N3/N4),
 * serverseitig gerendert (TESTING_GUIDELINES §1) und am Quelltext geprüft:
 *
 *  - Reiterleiste: EIN Baustein, Produkte · Hofseite · Beiträge als Links mit
 *    aria-current; „Produkte" nur unter md, an seiner Stelle ab md der Hinweis.
 *  - Umschalter „Bearbeiten · So sieht’s die Kundin": Bearbeiten zeigt den
 *    Inhalt, die Kundenansicht das iframe der echten Hofseite (passender
 *    Reiter, vorschauLink) mit dem leisen Link „In neuem Tab öffnen"; die Wahl
 *    steht in der Adresse und wird nur über ansichtAdresse geschrieben.
 *  - „Kundenansicht" im Kopf schaltet im Umschalter um (Knopf, kein neuer
 *    Tab); ohne Umschalter bleibt es der Link.
 *  - „Gespeichert · Ansehen" nur auf Hofseite und Beiträge: nach Titelbild,
 *    Ausschnitt und Fotos der Hofseite mit Stiften und nach dem Veröffentlichen
 *    eines Beitrags; Produkte behält seinen Teilen-Moment (Nr. 30).
 *
 * Jede Suche hat ihre Gegenprobe; Verhalten im Browser (Umschalten, Sprung,
 * Markierung) prüfen die Bilder und die Abnahme im Bericht.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentProps, type ComponentType, type ReactNode } from 'react'
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

import { MeinHofReiterLeiste } from '@/components/mein-hof/reiter-leiste'
import { MeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { KundenansichtKnopf } from '@/components/mein-hof/kundenansicht-knopf'
import { GespeichertAnsehenKarte } from '@/components/mein-hof/gespeichert-ansehen'
import { MEIN_HOF_HINWEIS } from '@/lib/bauern-navigation'
import { kundenAnsichtAdresse } from '@/lib/mein-hof-ansicht'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const INHALT = createElement('p', null, 'Inhalt zum Bearbeiten')

type AnsichtProps = Omit<ComponentProps<typeof MeinHofAnsicht>, 'children'>

/** MeinHofAnsicht mit dem Inhalt als Kind — ohne dass TypeScript `children` in den Props verlangt. */
function mitInhalt(props: AnsichtProps): ReturnType<typeof createElement> {
  return createElement(MeinHofAnsicht as unknown as ComponentType<AnsichtProps>, props, INHALT)
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

  it('So sieht’s die Kundin (?ansicht=kundin): das iframe der echten Hofseite und der leise Link in einen neuen Tab', () => {
    const html = ansicht('hofseite', 'ansicht=kundin')
    const ziel = kundenAnsichtAdresse('hof-test', 'hofseite')
    expect(html).toContain(`<iframe src="${ziel}" title="So sehen Kunden deine Hofseite"`)
    expect(html).toMatch(new RegExp(`<a href="${ziel.replace(/[?]/g, '\\?')}" target="_blank" rel="noopener noreferrer"[^>]*>In neuem Tab öffnen`))
    expect(html).toContain('<h1 class="sr-only">So sieht’s die Kundin</h1>')
    // Der Inhalt bleibt eingehängt — ab der Grenze steht er dort, wo es keinen Umschalter gibt.
    expect(html).toContain('Inhalt zum Bearbeiten')
  })

  it('Produkte zeigt den Reiter Produkte der Hofseite, Beiträge den Reiter Beiträge', () => {
    expect(ansicht('produkte', 'ansicht=kundin')).toContain('<iframe src="/hof-test?vorschau=1&amp;reiter=produkte"')
    expect(ansicht('beitraege', 'ansicht=kundin')).toContain('<iframe src="/hof-test?vorschau=1&amp;reiter=beitraege"')
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

  it('Hofseite: Titelbild, Ausschnitt und Fotos melden ihren Abschnitt, statt selbst zu toasten', () => {
    const ansichtHof = quelle('src/components/farm/farm-page-view.tsx')
    expect(ansichtHof).toContain("if (onGespeichert) onGespeichert('titelbild')")
    expect(ansichtHof).toContain("meldeErfolg={onGespeichert ? () => onGespeichert('titelbild') : undefined}")
    expect(ansichtHof).toContain("onGespeichert={onGespeichert ? () => onGespeichert('fotos') : undefined}")
    const client = quelle('src/components/farmer/farm-page-client.tsx')
    expect(client).toContain('onGespeichert={ansicht ? (abschnitt) => ansicht.gespeichert(abschnitt) : undefined}')
  })

  it('Beiträge: nach dem Veröffentlichen auf der Hofseite — „Ansehen" führt in den Reiter mit der Kundenansicht', () => {
    const neu = quelle('src/app/(hof)/status/new/status-new-client.tsx')
    expect(neu).toMatch(/if \(showOnFarmPage\) \{[\s\S]*?meldeGespeichertAnsehen\(\{ beschreibung: meldung, onAnsehen: \(\) => router\.push\(kundinAdresse\('beitraege'\)\) \}\)/)
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
    expect(text).toMatch(/matchMedia\(`\(min-width: \$\{UMSCHALTER_AB_PX\.lg\}px\)`\)\.matches\) \{\s*toast\.success\(beschreibung \?\? MEIN_HOF_ANSICHT_TEXT\.gespeichert\)/)
  })
})
